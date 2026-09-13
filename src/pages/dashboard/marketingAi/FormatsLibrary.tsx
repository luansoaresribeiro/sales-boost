import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { CARD, MUTED, BORDER, D, inputStyle, FORMAT_CLASS, FUNNEL_LABEL, type FunnelStage } from './shared'
import { TEMPLATES, type Template, type Brand } from './formatTemplates'
import FormatStudio from './FormatStudio'
import FormatsGallery from './FormatsGallery'

const ORANGE = '#FF6D29'

interface Fmt { id: string; title: string; content: string | null; meta: { fields?: string[]; example?: string } | null; created_at: string }

// Modelos prontos pra começar rápido — clicou, preenche o formulário. Print
// de Tweet e Antes/Depois já têm motor de imagem de verdade (acima); ficam
// só aqui os que ainda são só guia pro Diretor Criativo, sem motor próprio.
const PRESETS: { title: string; content: string; fields: string[] }[] = [
  { title: 'Infográfico', content: 'Dados/passos em blocos visuais numerados.', fields: ['título', 'itens (lista)', 'ícone por item', 'fonte do dado', 'logo'] },
  { title: 'Foco no Produto', content: 'Produto em destaque com nome e preço.', fields: ['foto do produto', 'nome', 'preço', 'chamada', 'logo'] },
]

// Formatos — a anatomia de cada tipo de post: quais campos/componentes a IA
// precisa preencher pra montar aquela imagem. Reusa marketing_ai_knowledge
// (module='formato'); o creative-generate consulta esses formatos ao criar.
export default function FormatsLibrary({ companyId, module }: { companyId: string; module?: string }) {
  const [formats, setFormats] = useState<Fmt[]>([])
  const [loading, setLoading] = useState(true)
  const [studio, setStudio] = useState<Template | null>(null)
  const [brand, setBrand] = useState<Brand>({ primary: ORANGE, name: 'Sua marca' })
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [fields, setFields] = useState('')
  const [example, setExample] = useState('')
  const [funnelFilter, setFunnelFilter] = useState<'todos' | FunnelStage>('todos')

  const load = useCallback(async () => {
    const [{ data }, { data: comp }, { data: bd }] = await Promise.all([
      supabase.from('marketing_ai_knowledge').select('id, title, content, meta, created_at').eq('company_id', companyId).eq('module', 'formato').order('created_at', { ascending: false }),
      supabase.from('companies').select('business_name').eq('id', companyId).maybeSingle(),
      supabase.from('brand_dna').select('kit, logo_url').eq('company_id', companyId).maybeSingle(),
    ])
    setFormats((data ?? []) as Fmt[])
    const kit = (bd?.kit as { colors?: { primary?: string[]; accent?: string[]; text?: string; bg?: string }; typography?: { heading?: string; body?: string } } | null) ?? null
    const c = kit?.colors ?? {}
    setBrand({
      name: comp?.business_name || 'Sua marca',
      primary: c.primary?.[0] || ORANGE, primary2: c.primary?.[1], accent: c.accent?.[0], accent2: c.accent?.[1],
      text: c.text, bg: c.bg, logoUrl: (bd?.logo_url as string | null) ?? undefined,
      heading: kit?.typography?.heading, body: kit?.typography?.body,
    })
    setLoading(false)
  }, [companyId])
  useEffect(() => { load() }, [load])

  const usePreset = (p: typeof PRESETS[number]) => { setName(p.title); setDesc(p.content); setFields(p.fields.join(', ')); setExample(''); setAdding(true) }

  const save = async () => {
    if (!name.trim()) return
    const arr = fields.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
    await supabase.from('marketing_ai_knowledge').insert({
      company_id: companyId, module: 'formato', kind: 'format', title: name.trim(), content: desc.trim() || null,
      meta: { fields: arr, example: example.trim() || undefined },
    })
    setName(''); setDesc(''); setFields(''); setExample(''); setAdding(false)
    await load()
  }
  const remove = async (id: string) => { await supabase.from('marketing_ai_knowledge').delete().eq('id', id); await load() }

  return (
    <div>
      <div style={{ padding: '12px 16px', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6, marginBottom: '16px' }}>
        🧩 <strong>Formatos.</strong> Cada formato é a <strong>anatomia</strong> de um tipo de post. Os formatos com <strong>motor de imagem</strong> (abaixo) você <strong>gera de verdade</strong> — a imagem é montada campo a campo, não é foto de IA. Os formatos que você cadastra no catálogo (mais abaixo) <strong>guiam o Diretor Criativo</strong> ao gerar. Quanto mais formatos, mais tipos de imagem o agente sabe montar.
      </div>

      {/* Biblioteca de formatos & dimensões (tamanhos/placements + custom + presets) */}
      <FormatsGallery companyId={companyId} />

      {/* Motor de imagem — formatos que geram a imagem real, campo a campo */}
      <div style={{ marginBottom: '22px' }}>
        <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>🎨 Gerar imagem de formato</div>
        <div style={{ fontSize: '11px', color: MUTED, marginBottom: '9px' }}>Escolha um formato, preencha (ou deixe a IA preencher) e gere a imagem real. Ela cai na Área de Testes pra aprovação. Cada um serve melhor pra uma etapa do funil — use o filtro pra achar o certo.</div>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '11px' }}>
          {(['todos', 'topo', 'meio', 'fundo'] as const).map(f => (
            <button key={f} onClick={() => setFunnelFilter(f)}
              style={{ padding: '5px 12px', borderRadius: '99px', border: `1px solid ${funnelFilter === f ? 'rgba(255,109,41,0.5)' : BORDER}`, background: funnelFilter === f ? 'rgba(255,109,41,0.12)' : 'transparent', color: funnelFilter === f ? ORANGE : MUTED, fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: D, textTransform: 'capitalize' }}>
              {f === 'todos' ? 'Todos' : FUNNEL_LABEL[f]}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
          {TEMPLATES.filter(t => funnelFilter === 'todos' || FORMAT_CLASS[t.key]?.funnel.includes(funnelFilter)).map(t => {
            const cls = FORMAT_CLASS[t.key]
            return (
              <button key={t.key} onClick={() => setStudio(t)} style={{ textAlign: 'left', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '11px', padding: '13px', cursor: 'pointer', fontFamily: D }}>
                <div style={{ fontSize: '22px', marginBottom: '6px' }}>{t.icon}</div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white', marginBottom: '2px' }}>{t.label}</div>
                <div style={{ fontSize: '9.5px', color: MUTED, marginBottom: cls ? '6px' : 0 }}>{t.w}×{t.h} · {t.fields.length} campos</div>
                {cls && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '8.5px', fontWeight: 800, color: '#A78BFA', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '99px', padding: '2px 7px', letterSpacing: '0.03em' }}>
                      {cls.funnel.map(f => FUNNEL_LABEL[f].toUpperCase()).join(' / ')}
                    </span>
                    <span style={{ fontSize: '8.5px', fontWeight: 700, color: '#60a5fa', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '99px', padding: '2px 7px' }}>
                      {cls.objective}
                    </span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>📚 Catálogo de formatos</div>
      <div style={{ fontSize: '11px', color: MUTED, marginBottom: '13px' }}>Formatos que guiam a IA na hora de gerar (sem motor de imagem próprio ainda).</div>

      {/* Modelos prontos */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '10.5px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '7px' }}>Começar rápido</div>
        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <button key={p.title} onClick={() => usePreset(p)} style={{ padding: '6px 12px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '99px', color: '#93c5fd', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>+ {p.title}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '18px' }}>
        <button onClick={() => setAdding(a => !a)} style={{ padding: '6px 13px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '7px', color: ORANGE, fontSize: '11.5px', cursor: 'pointer', fontFamily: D }}>
          {adding ? 'Cancelar' : '+ Criar formato do zero'}
        </button>
        {adding && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', padding: '14px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '11px', maxWidth: '560px' }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do formato (ex: Print de Tweet)" style={inputStyle} />
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Quando usar / o que é" style={inputStyle} />
            <textarea value={fields} onChange={e => setFields(e.target.value)} placeholder="Campos necessários, separados por vírgula (ex: @usuário, nome, avatar, texto, curtidas)" rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: D }} />
            <input value={example} onChange={e => setExample(e.target.value)} placeholder="Exemplo/observação (opcional)" style={inputStyle} />
            <button onClick={save} disabled={!name.trim()} style={{ alignSelf: 'flex-start', padding: '8px 18px', background: name.trim() ? ORANGE : 'rgba(255,255,255,0.08)', color: name.trim() ? '#000' : MUTED, fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: name.trim() ? 'pointer' : 'not-allowed', fontFamily: D }}>Salvar formato</button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: '12px', color: MUTED }}>Carregando...</div>
      ) : formats.length === 0 ? (
        <div style={{ padding: '28px', textAlign: 'center', color: MUTED, fontSize: '12.5px', background: CARD, border: `1px dashed ${BORDER}`, borderRadius: '12px' }}>
          Nenhum formato ainda. Use um modelo pronto acima ou crie do zero — o Diretor Criativo passa a usar assim que você salvar.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
          {formats.map(f => (
            <div key={f.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'white', flex: 1 }}>{f.title}</span>
                <button onClick={() => remove(f.id)} title="Remover" style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: '12px', cursor: 'pointer' }}>🗑</button>
              </div>
              {f.content && <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5, marginBottom: '8px' }}>{f.content}</div>}
              {f.meta?.fields?.length ? (
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {f.meta.fields.map((c, i) => <span key={i} style={{ fontSize: '9px', fontWeight: 600, color: '#93c5fd', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '99px', padding: '2px 8px' }}>{c}</span>)}
                </div>
              ) : null}
              {f.meta?.example && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '8px', fontStyle: 'italic' }}>{f.meta.example}</div>}
            </div>
          ))}
        </div>
      )}

      {studio && <FormatStudio template={studio} brand={brand} initialKind={module} onClose={() => setStudio(null)} onSaved={() => { /* fica na Área de Testes */ }} />}
    </div>
  )
}
