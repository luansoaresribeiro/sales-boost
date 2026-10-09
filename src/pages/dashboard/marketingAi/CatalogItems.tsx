import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { processImageTo4x5 } from '../../../lib/imageProcessing'
import { catalogMinPhotos } from '../../../lib/setupRules'
import { bi, sanitizeCatalogValues, type CatalogSchema, type CatalogField } from '../../../lib/verticalPlaybook'
import { CARD, MUTED, BORDER, D, inputStyle, SUPABASE_URL } from './shared'
import { ImageModal } from './TestingArea'
import ItemVideos from './ItemVideos'
import { useLang } from '../../../contexts/LanguageContext'

const TX = {
  pt: {
    select: 'Selecione...', whatToCreate: 'O que criar com este ', create: 'Criar', notifyDone: '✓ Avisar quando lançar', soonNotify: 'Em breve — avisar',
    errPackage: 'Erro ao gerar pacote', errUpload: 'Não consegui enviar as fotos. Tente de novo.', errSavePhotos: 'Não consegui salvar as fotos. Tente de novo.',
    info1: 'Cadastre cada ', info2: ' com fotos reais (mínimo ', info3: ') e os dados dele — é a partir daqui que os pacotes de conteúdo são gerados.',
    add: '＋ Adicionar ', newItem: 'Novo ', sending: 'Enviando...', addPhotos: '＋ Adicionar fotos', save: 'Salvar', cancel: 'Cancelar',
    loading: 'Carregando...', none: (item: string) => `Nenhum ${item} cadastrado ainda.`, remove: 'Remover',
    photosN: 'fotos', bedrooms: 'q', generating: 'Gerando...', genPackage: '✨ Gerar pacote',
    pieces: (n: number) => `${n} peça${n === 1 ? '' : 's'} em rascunho, esperando aprovação:`,
  },
  en: {
    select: 'Select...', whatToCreate: 'What to create with this ', create: 'Create', notifyDone: '✓ We will notify you at launch', soonNotify: 'Coming soon — notify me',
    errPackage: 'Error generating package', errUpload: "Couldn't upload the photos. Please try again.", errSavePhotos: "Couldn't save the photos. Please try again.",
    info1: 'Add each ', info2: ' with real photos (at least ', info3: ') and its details — this is where content packages are generated from.',
    add: '＋ Add ', newItem: 'New ', sending: 'Uploading...', addPhotos: '＋ Add photos', save: 'Save', cancel: 'Cancel',
    loading: 'Loading...', none: (item: string) => `No ${item} added yet.`, remove: 'Remove',
    photosN: 'photos', bedrooms: 'bd', generating: 'Generating...', genPackage: '✨ Generate package',
    pieces: (n: number) => `${n} draft piece${n === 1 ? '' : 's'}, waiting for approval:`,
  },
} as const

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
  const { lang } = useLang()
  const tx = TX[lang]
  const label = bi(field.label, lang)
  if (field.type === 'select') {
    return (
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>{label}</label>
        <select value={String(value ?? '')} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          <option value="">{tx.select}</option>
          {(field.options ?? []).map(o => <option key={o.pt} value={o.pt}>{bi(o, lang)}</option>)}
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
  const tx = TX[useLang().lang]
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
      <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{tx.whatToCreate}{itemLabel.toLowerCase()}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {tools.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span style={{ fontSize: '10.5px', color: 'white' }}>{t.name}</span>
            {t.status === 'live' && TOOL_RECIPE[t.id] ? (
              <button onClick={() => onGenerate(itemId, TOOL_RECIPE[t.id])} disabled={busy === itemId}
                style={{ padding: '4px 9px', background: 'rgba(255,109,41,0.14)', border: '1px solid rgba(255,109,41,0.4)', borderRadius: '6px', color: ORANGE, fontWeight: 700, fontSize: '10px', cursor: busy === itemId ? 'default' : 'pointer' }}>
                {busy === itemId ? '...' : tx.create}
              </button>
            ) : interested.has(t.id) ? (
              <span style={{ fontSize: '9.5px', color: '#4ade80' }}>{tx.notifyDone}</span>
            ) : (
              <button onClick={() => registerInterest(t.id)} style={{ padding: '4px 9px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '6px', color: MUTED, fontSize: '9.5px', cursor: 'pointer' }}>
                {tx.soonNotify}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// `setupMode` (tela /setup): só cadastrar/adicionar fotos — sem gerar pacote nem
// ferramentas de criação. `onChanged` avisa quem estiver de olho no status.
export default function CatalogItems({ companyId, schema, verticalKey, focusItemId, setupMode, onChanged }: { companyId: string; schema: CatalogSchema; verticalKey: string; focusItemId?: string | null; setupMode?: boolean; onChanged?: () => void }) {
  const { session } = useAuth()
  const { lang } = useLang()
  const tx = TX[lang]
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
      setPackageResult({ itemId, result: res.ok ? data : { error: data.error ?? tx.errPackage } })
    } catch (e) {
      setPackageResult({ itemId, result: { error: e instanceof Error ? e.message : tx.errPackage } })
    }
    setPackageBusyId(null)
  }

  const photosField = [...schema.required, ...schema.optional].find(f => f.type === 'photos')
  const minPhotos = catalogMinPhotos(schema)
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
  // "＋ Adicionar fotos" em item que já existe (um input escondido, compartilhado)
  const addRef = useRef<HTMLInputElement>(null)
  const addTargetRef = useRef<CatalogItem | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(focusItemId ?? null)

  const onChangedRef = useRef(onChanged)
  onChangedRef.current = onChanged
  const load = useCallback(async () => {
    const { data } = await supabase.from('marketing_ai_knowledge').select('id, title, image_url, meta, created_at').eq('company_id', companyId).eq('module', 'visual').eq('kind', 'product').order('created_at', { ascending: false })
    setItems((data ?? []) as CatalogItem[])
    setLoading(false)
    onChangedRef.current?.()
  }, [companyId])
  useEffect(() => { load() }, [load])

  // Veio do sino de pendências: rola até o item e destaca com borda laranja.
  useEffect(() => { setHighlightId(focusItemId ?? null) }, [focusItemId])
  useEffect(() => {
    if (!highlightId || loading) return
    const t = setTimeout(() => document.getElementById(`catalog-item-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
    return () => clearTimeout(t)
  }, [highlightId, loading, items.length])

  // Mesmo upload/processamento/bucket da criação; só acrescenta em meta.photos
  // (e põe a capa se o item ainda não tinha image_url).
  const onAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const item = addTargetRef.current
    if (addRef.current) addRef.current.value = ''
    if (!files.length || !item) return
    setAddingId(item.id); setAddError(null)
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
      if (!uploaded.length) { setAddError(tx.errUpload); return }
      // relê o item antes de gravar, pra não sobrescrever fotos adicionadas em outra aba
      const { data: fresh } = await supabase.from('marketing_ai_knowledge').select('image_url, meta').eq('id', item.id).eq('company_id', companyId).maybeSingle()
      const meta = (fresh?.meta ?? item.meta ?? {}) as ItemMeta
      const patch: Record<string, unknown> = { meta: { ...meta, photos: [...(meta.photos ?? []), ...uploaded] } }
      if (!(fresh?.image_url ?? item.image_url)) patch.image_url = uploaded[0].url
      const { error } = await supabase.from('marketing_ai_knowledge').update(patch).eq('id', item.id).eq('company_id', companyId)
      if (error) setAddError(tx.errSavePhotos)
      await load()
    } catch { setAddError(tx.errUpload) }
    finally { setAddingId(null) }
  }

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
      {!setupMode && <div style={{ padding: '12px 16px', background: 'rgba(255,109,41,0.07)', border: '1px solid rgba(255,109,41,0.25)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6, marginBottom: '16px' }}>
        📋 <strong>{schema.catalogLabel}.</strong> {tx.info1}{schema.itemLabel.toLowerCase()}{tx.info2}{minPhotos}{tx.info3}
      </div>}

      {!creating ? (
        <button onClick={() => setCreating(true)} style={{ padding: '9px 18px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12.5px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontFamily: D, marginBottom: '18px' }}>
          {tx.add}{schema.itemLabel.toLowerCase()}
        </button>
      ) : (
        <div style={{ padding: '16px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', marginBottom: '18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>{tx.newItem}{schema.itemLabel.toLowerCase()}</div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              {bi(photosField?.label, lang)} — {photos.length}/{minPhotos}
            </label>
            {photos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 96px))', gap: '8px', marginBottom: '8px' }}>
                {photos.map(p => (
                  <div key={p.path} style={{ position: 'relative' }}>
                    <img src={p.url} alt="" style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', borderRadius: '8px', display: 'block' }} />
                    <button onClick={() => removePendingPhoto(p.path)} style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', background: '#000', border: `1px solid ${BORDER}`, color: 'white', fontSize: '11px', cursor: 'pointer' }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} style={{ display: 'none' }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ padding: '7px 14px', background: 'rgba(255,109,41,0.14)', border: '1px solid rgba(255,109,41,0.5)', borderRadius: '8px', color: ORANGE, fontWeight: 700, fontSize: '11.5px', cursor: 'pointer', fontFamily: D }}>
              {uploading ? tx.sending : tx.addPhotos}
            </button>
          </div>

          {formFields.map(f => (
            <FieldInput key={f.key} field={f} value={fields[f.key]} onChange={v => setFields(p => ({ ...p, [f.key]: v }))} />
          ))}

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button onClick={save} disabled={!canSave} style={{ padding: '9px 18px', background: canSave ? ORANGE : 'rgba(255,255,255,0.08)', color: canSave ? '#000' : MUTED, fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: D }}>{tx.save}</button>
            <button onClick={() => { setCreating(false); setPhotos([]); setFields({}) }} style={{ padding: '9px 16px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, fontSize: '12px', cursor: 'pointer', fontFamily: D }}>{tx.cancel}</button>
          </div>
        </div>
      )}

      <input ref={addRef} type="file" accept="image/*" multiple onChange={onAddFiles} style={{ display: 'none' }} />
      {addError && <div style={{ fontSize: '11.5px', color: '#f87171', marginBottom: '10px' }}>{addError}</div>}

      {loading ? <div style={{ fontSize: '12px', color: MUTED }}>{tx.loading}</div> : items.length === 0 ? (
        <div style={{ padding: '28px', textAlign: 'center', color: MUTED, fontSize: '12.5px', background: CARD, border: `1px dashed ${BORDER}`, borderRadius: '12px' }}>{tx.none(schema.itemLabel.toLowerCase())}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          {items.map(item => {
            const photoCount = item.meta?.photos?.length ?? 0
            const f = item.meta?.fields ?? {}
            return (
              <div key={item.id} id={`catalog-item-${item.id}`} style={{ background: CARD, border: `1px solid ${highlightId === item.id ? ORANGE : BORDER}`, boxShadow: highlightId === item.id ? '0 0 0 2px rgba(255,109,41,0.35)' : 'none', borderRadius: '11px', overflow: 'hidden' }}>
                {item.image_url && <img src={item.image_url} alt="" onClick={() => setZoom(item.image_url)} style={{ width: '100%', height: '160px', objectFit: 'cover', cursor: 'zoom-in' }} />}
                <div style={{ padding: '10px 11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'white', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                    <button onClick={() => remove(item)} title={tx.remove} style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: '12px', cursor: 'pointer' }}>🗑</button>
                  </div>
                  <div style={{ fontSize: '10.5px', color: MUTED, marginBottom: '8px' }}>
                    <span style={{ color: photoCount < minPhotos ? '#f87171' : MUTED, fontWeight: photoCount < minPhotos ? 700 : 400 }}>{photoCount}/{minPhotos} {tx.photosN}</span>{f.preco ? ` · R$ ${f.preco}` : ''}{f.quartos ? ` · ${f.quartos}${tx.bedrooms}` : ''}
                  </div>
                  <button onClick={() => { addTargetRef.current = item; addRef.current?.click() }} disabled={addingId === item.id}
                    style={{ width: '100%', padding: '7px 10px', marginBottom: '6px', background: photoCount < minPhotos ? 'rgba(255,109,41,0.14)' : 'transparent', border: `1px solid ${photoCount < minPhotos ? 'rgba(255,109,41,0.5)' : BORDER}`, borderRadius: '7px', color: photoCount < minPhotos ? ORANGE : MUTED, fontWeight: 700, fontSize: '11px', cursor: addingId === item.id ? 'default' : 'pointer', fontFamily: D }}>
                    {addingId === item.id ? tx.sending : tx.addPhotos}
                  </button>
                  {!setupMode && <button onClick={() => generatePackage(item.id)} disabled={packageBusyId === item.id}
                    style={{ width: '100%', padding: '7px 10px', background: packageBusyId === item.id ? 'rgba(255,255,255,0.06)' : 'rgba(255,109,41,0.14)', border: '1px solid rgba(255,109,41,0.4)', borderRadius: '7px', color: ORANGE, fontWeight: 700, fontSize: '11px', cursor: packageBusyId === item.id ? 'default' : 'pointer', fontFamily: D }}>
                    {packageBusyId === item.id ? tx.generating : tx.genPackage}
                  </button>}
                  {packageResult?.itemId === item.id && (
                    <div style={{ marginTop: '8px', fontSize: '10.5px', lineHeight: 1.5 }}>
                      {'error' in packageResult.result ? (
                        <div style={{ color: '#f87171' }}>{packageResult.result.error}</div>
                      ) : (
                        <>
                          {packageResult.result.generated.length > 0 && (
                            <div style={{ color: '#4ade80', marginBottom: '4px' }}>
                              {tx.pieces(packageResult.result.generated.length)}
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
                  {!setupMode && <ItemVideos itemId={item.id} photos={(item.meta?.photos ?? []).map(p => p.url)} />}
                  {!setupMode && <ItemCreationTools itemId={item.id} companyId={companyId} verticalKey={verticalKey} itemLabel={schema.itemLabel} onGenerate={generatePackage} busy={packageBusyId} />}
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
