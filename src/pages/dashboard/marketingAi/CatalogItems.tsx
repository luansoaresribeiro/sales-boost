import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { processImageTo4x5 } from '../../../lib/imageProcessing'
import { bi, sanitizeCatalogValues, type CatalogSchema, type CatalogField } from '../../../lib/verticalPlaybook'
import { CARD, MUTED, BORDER, D, inputStyle, SUPABASE_URL } from './shared'
import { ImageModal } from './TestingArea'

const ORANGE = '#FF6D29'

interface Photo { url: string; path: string }
interface ItemMeta { photos?: Photo[]; fields?: Record<string, unknown> }
interface CatalogItem { id: string; title: string; image_url: string | null; meta: ItemMeta | null; created_at: string }

function titleFromFields(fields: Record<string, unknown>, fallback: string): string {
  const tipo = fields.tipo ? String(fields.tipo) : ''
  const bairro = fields.bairro ? String(fields.bairro) : ''
  if (tipo && bairro) return `${tipo} em ${bairro}`
  return tipo || bairro || fallback
}

function FieldInput({ field, value, onChange }: { field: CatalogField; value: unknown; onChange: (v: unknown) => void }) {
  const label = bi(field.label)
  if (field.type === 'select') {
    return (
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>{label}</label>
        <select value={String(value ?? '')} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          <option value="">Selecione...</option>
          {(field.options ?? []).map(o => <option key={o.pt} value={o.pt}>{bi(o)}</option>)}
        </select>
      </div>
    )
  }
  return (
    <div style={{ marginBottom: '10px' }}>
      <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>{label}</label>
      <input type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'} value={String(value ?? '')} onChange={e => onChange(e.target.value)} style={inputStyle} />
    </div>
  )
}

// Catálogo genérico — mesma tabela/kind que "Produtos", só que com fotos
// múltiplas + campos estruturados vindos da ficha do setor (catalog_fields).
// Quem não tem ficha com catálogo nunca vê essa tela (fica só "Produtos").
interface PackageResult { generated: { recipe: string; pillar: string; planned_for: string }[]; skipped: { recipe: string; reason: string }[] }
interface ToolRow { id: string; name: string; description: string; status: 'live' | 'partial' | 'planned' }
// Só a ferramenta "Tour virtual" já gera de verdade hoje (carrossel de
// fotos reais) — mapeia pro mesmo motor do "Gerar pacote", só que 1 receita
// isolada em vez do pacote inteiro. Ferramentas novas que também virarem
// "live" no futuro entram aqui.
const TOOL_RECIPE: Record<string, string> = { tour_virtual_tool: 'carrossel_tour' }

// "O que criar com este {item}" — ferramentas de criação da ficha, dentro
// de CADA item (ação, diferente da visão geral em Configuração → Ferramentas,
// que é só informativa). Ready = botão que gera de verdade; planned = "Em
// breve" + "Quero quando lançar" (mesma tabela de interesse do ToolsTab).
function ItemCreationTools({ itemId, companyId, verticalKey, itemLabel, onGenerate, busy }: {
  itemId: string; companyId: string; verticalKey: string; itemLabel: string; onGenerate: (itemId: string, recipe: string) => void; busy: string | null
}) {
  const [tools, setTools] = useState<ToolRow[]>([])
  const [interested, setInterested] = useState<Set<string>>(new Set())
  useEffect(() => {
    supabase.from('marketing_ai_tool_registry').select('id, name, description, status').eq('vertical_key', verticalKey).eq('category', 'criacao')
      .then(({ data }) => setTools((data ?? []) as ToolRow[]))
  }, [verticalKey])
  useEffect(() => {
    supabase.from('marketing_ai_tool_interest').select('tool_id').eq('company_id', companyId)
      .then(({ data }) => setInterested(new Set((data ?? []).map(r => r.tool_id as string))))
  }, [companyId])
  const registerInterest = async (toolId: string) => {
    await supabase.from('marketing_ai_tool_interest').upsert({ tool_id: toolId, company_id: companyId }, { onConflict: 'tool_id,company_id' })
    setInterested(s => new Set(s).add(toolId))
  }
  if (!tools.length) return null
  return (
    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>O que criar com este {itemLabel.toLowerCase()}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {tools.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span style={{ fontSize: '10.5px', color: 'white' }}>{t.name}</span>
            {t.status === 'live' && TOOL_RECIPE[t.id] ? (
              <button onClick={() => onGenerate(itemId, TOOL_RECIPE[t.id])} disabled={busy === itemId}
                style={{ padding: '4px 9px', background: 'rgba(255,109,41,0.14)', border: '1px solid rgba(255,109,41,0.4)', borderRadius: '6px', color: ORANGE, fontWeight: 700, fontSize: '10px', cursor: busy === itemId ? 'default' : 'pointer' }}>
                {busy === itemId ? '...' : 'Criar'}
              </button>
            ) : interested.has(t.id) ? (
              <span style={{ fontSize: '9.5px', color: '#4ade80' }}>✓ Avisar quando lançar</span>
            ) : (
              <button onClick={() => registerInterest(t.id)} style={{ padding: '4px 9px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '6px', color: MUTED, fontSize: '9.5px', cursor: 'pointer' }}>
                Em breve — avisar
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CatalogItems({ companyId, schema, verticalKey }: { companyId: string; schema: CatalogSchema; verticalKey: string }) {
  const { session } = useAuth()
  const [packageBusyId, setPackageBusyId] = useState<string | null>(null)
  const [packageResult, setPackageResult] = useState<{ itemId: string; result: PackageResult | { error: string } } | null>(null)

  const generatePackage = async (itemId: string, onlyRecipe?: string) => {
    if (!session) return
    setPackageBusyId(itemId); setPackageResult(null)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/catalog-package`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, ...(onlyRecipe ? { only_recipe: onlyRecipe } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      setPackageResult({ itemId, result: res.ok ? data : { error: data.error ?? 'Erro ao gerar pacote' } })
    } catch (e) {
      setPackageResult({ itemId, result: { error: e instanceof Error ? e.message : 'Erro ao gerar pacote' } })
    }
    setPackageBusyId(null)
  }

  const photosField = [...schema.required, ...schema.optional].find(f => f.type === 'photos')
  const minPhotos = photosField?.min ?? 5
  const formFields = [...schema.required, ...schema.optional].filter(f => f.type !== 'photos')
  const requiredKeys = new Set(schema.required.filter(f => f.type !== 'photos').map(f => f.key))

  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [zoom, setZoom] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [fields, setFields] = useState<Record<string, unknown>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('marketing_ai_knowledge').select('id, title, image_url, meta, created_at').eq('company_id', companyId).eq('module', 'visual').eq('kind', 'product').order('created_at', { ascending: false })
    setItems((data ?? []) as CatalogItem[])
    setLoading(false)
  }, [companyId])
  useEffect(() => { load() }, [load])

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      const uploaded: Photo[] = []
      for (const file of files) {
        const blob = await processImageTo4x5(file)
        const path = `renders/${companyId}/catalog-${crypto.randomUUID()}.jpg`
        const { error } = await supabase.storage.from('post-images').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
        if (!error) {
          const { data } = supabase.storage.from('post-images').getPublicUrl(path)
          uploaded.push({ url: data.publicUrl, path })
        }
      }
      setPhotos(p => [...p, ...uploaded])
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const removePendingPhoto = (path: string) => setPhotos(p => p.filter(x => x.path !== path))

  const canSave = photos.length >= minPhotos && [...requiredKeys].every(k => {
    const v = fields[k]
    return v !== undefined && v !== null && String(v).trim() !== ''
  })

  const save = async () => {
    if (!canSave) return
    const cleanFields = sanitizeCatalogValues(fields, schema)
    const title = titleFromFields(cleanFields, schema.itemLabel)
    await supabase.from('marketing_ai_knowledge').insert({
      company_id: companyId, module: 'visual', kind: 'product', title,
      image_url: photos[0].url, // capa = 1ª foto escolhida — mantém compatível com quem já lê image_url
      meta: { photos, fields: cleanFields },
    })
    setPhotos([]); setFields({}); setCreating(false); await load()
  }

  const remove = async (item: CatalogItem) => {
    const paths = (item.meta?.photos ?? []).map(p => p.path)
    if (paths.length) await supabase.storage.from('post-images').remove(paths).catch(() => {})
    await supabase.from('marketing_ai_knowledge').delete().eq('id', item.id)
    await load()
  }

  return (
    <div>
      <div style={{ padding: '12px 16px', background: 'rgba(255,109,41,0.07)', border: '1px solid rgba(255,109,41,0.25)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6, marginBottom: '16px' }}>
        📋 <strong>{schema.catalogLabel}.</strong> Cadastre cada {schema.itemLabel.toLowerCase()} com fotos reais (mínimo {minPhotos}) e os dados dele — é a partir daqui que os pacotes de conteúdo são gerados.
      </div>

      {!creating ? (
        <button onClick={() => setCreating(true)} style={{ padding: '9px 18px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12.5px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontFamily: D, marginBottom: '18px' }}>
          ＋ Adicionar {schema.itemLabel.toLowerCase()}
        </button>
      ) : (
        <div style={{ padding: '16px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', marginBottom: '18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Novo {schema.itemLabel.toLowerCase()}</div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              {bi(photosField?.label)} — {photos.length}/{minPhotos}
            </label>
            {photos.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                {photos.map(p => (
                  <div key={p.path} style={{ position: 'relative' }}>
                    <img src={p.url} alt="" style={{ width: '74px', height: '92px', objectFit: 'cover', borderRadius: '8px' }} />
                    <button onClick={() => removePendingPhoto(p.path)} style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', background: '#000', border: `1px solid ${BORDER}`, color: 'white', fontSize: '11px', cursor: 'pointer' }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} style={{ display: 'none' }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ padding: '7px 14px', background: 'rgba(255,109,41,0.14)', border: '1px solid rgba(255,109,41,0.5)', borderRadius: '8px', color: ORANGE, fontWeight: 700, fontSize: '11.5px', cursor: 'pointer', fontFamily: D }}>
              {uploading ? 'Enviando...' : '＋ Adicionar fotos'}
            </button>
          </div>

          {formFields.map(f => (
            <FieldInput key={f.key} field={f} value={fields[f.key]} onChange={v => setFields(p => ({ ...p, [f.key]: v }))} />
          ))}

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button onClick={save} disabled={!canSave} style={{ padding: '9px 18px', background: canSave ? ORANGE : 'rgba(255,255,255,0.08)', color: canSave ? '#000' : MUTED, fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: D }}>Salvar</button>
            <button onClick={() => { setCreating(false); setPhotos([]); setFields({}) }} style={{ padding: '9px 16px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, fontSize: '12px', cursor: 'pointer', fontFamily: D }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ fontSize: '12px', color: MUTED }}>Carregando...</div> : items.length === 0 ? (
        <div style={{ padding: '28px', textAlign: 'center', color: MUTED, fontSize: '12.5px', background: CARD, border: `1px dashed ${BORDER}`, borderRadius: '12px' }}>Nenhum {schema.itemLabel.toLowerCase()} cadastrado ainda.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          {items.map(item => {
            const photoCount = item.meta?.photos?.length ?? 0
            const f = item.meta?.fields ?? {}
            return (
              <div key={item.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '11px', overflow: 'hidden' }}>
                {item.image_url && <img src={item.image_url} alt="" onClick={() => setZoom(item.image_url)} style={{ width: '100%', height: '160px', objectFit: 'cover', cursor: 'zoom-in' }} />}
                <div style={{ padding: '10px 11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'white', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                    <button onClick={() => remove(item)} title="Remover" style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: '12px', cursor: 'pointer' }}>🗑</button>
                  </div>
                  <div style={{ fontSize: '10.5px', color: MUTED, marginBottom: '8px' }}>
                    {photoCount} foto{photoCount === 1 ? '' : 's'}{f.preco ? ` · R$ ${f.preco}` : ''}{f.quartos ? ` · ${f.quartos}q` : ''}
                  </div>
                  <button onClick={() => generatePackage(item.id)} disabled={packageBusyId === item.id}
                    style={{ width: '100%', padding: '7px 10px', background: packageBusyId === item.id ? 'rgba(255,255,255,0.06)' : 'rgba(255,109,41,0.14)', border: '1px solid rgba(255,109,41,0.4)', borderRadius: '7px', color: ORANGE, fontWeight: 700, fontSize: '11px', cursor: packageBusyId === item.id ? 'default' : 'pointer', fontFamily: D }}>
                    {packageBusyId === item.id ? 'Gerando...' : '✨ Gerar pacote'}
                  </button>
                  {packageResult?.itemId === item.id && (
                    <div style={{ marginTop: '8px', fontSize: '10.5px', lineHeight: 1.5 }}>
                      {'error' in packageResult.result ? (
                        <div style={{ color: '#f87171' }}>{packageResult.result.error}</div>
                      ) : (
                        <>
                          {packageResult.result.generated.length > 0 && (
                            <div style={{ color: '#4ade80', marginBottom: '4px' }}>
                              {packageResult.result.generated.length} peça{packageResult.result.generated.length === 1 ? '' : 's'} em rascunho, esperando aprovação:
                              <ul style={{ margin: '4px 0 0', paddingLeft: '16px' }}>
                                {packageResult.result.generated.map((g, i) => <li key={i}>{g.recipe} — {g.planned_for}</li>)}
                              </ul>
                            </div>
                          )}
                          {packageResult.result.skipped.length > 0 && (
                            <div style={{ color: MUTED }}>
                              {packageResult.result.skipped.map((s, i) => <div key={i}>⏸ {s.recipe}: {s.reason}</div>)}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  <ItemCreationTools itemId={item.id} companyId={companyId} verticalKey={verticalKey} itemLabel={schema.itemLabel} onGenerate={generatePackage} busy={packageBusyId} />
                </div>
              </div>
            )
          })}
        </div>
      )}
      {zoom && <ImageModal images={[{ url: zoom }]} onClose={() => setZoom(null)} />}
    </div>
  )
}
