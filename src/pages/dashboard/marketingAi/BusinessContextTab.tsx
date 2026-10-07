import { useEffect, useMemo, useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { supabase } from '../../../lib/supabase'
import { CARD, MUTED, BORDER, D } from './shared'
import { useLang } from '../../../contexts/LanguageContext'
import {
  buildContextDemo, CONTEXT_CATEGORY_META, IMPORTANCE_META,
  type ContextNote, type ContextCategory, type Importance,
} from './growthIntelDemo'

const ORANGE = '#FF6D29'

// Linha real da tabela business_context (snake_case) → ContextNote (camelCase).
interface ContextRow {
  id: string; text: string; category: ContextCategory; tags: string[]; importance: Importance
  effective_date: string | null; expiration_date: string | null; ai_summary: string | null
  edits: number; archived: boolean; created_at: string; updated_at: string
}
function rowToNote(r: ContextRow): ContextNote {
  return {
    id: r.id, text: r.text, category: r.category, tags: r.tags ?? [], importance: r.importance,
    effectiveDate: r.effective_date ?? '', expirationDate: r.expiration_date, aiSummary: r.ai_summary ?? '',
    createdAt: r.created_at, updatedAt: r.updated_at, edits: r.edits ?? 0, archived: r.archived,
  }
}

const CATS = Object.keys(CONTEXT_CATEGORY_META) as ContextCategory[]
const inputStyle = { width: '100%', boxSizing: 'border-box' as const, padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '9px', color: 'white', fontSize: '13px', outline: 'none', fontFamily: D }

const CAT_EN: Record<string, string> = { operacao: 'Operations', equipe: 'Team', estrategia: 'Strategy', financeiro: 'Finance', marketing: 'Marketing', clientes: 'Customers', expansao: 'Expansion' }
const IMP_EN: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' }
// Exemplos (só leitura) em inglês — mesmos ids de buildContextDemo().
const DEMO_EN: Record<string, { text: string; tags: string[]; aiSummary: string }> = {
  c1: { text: 'We will focus on weddings and events this season — I want campaigns and content aimed at that audience.', tags: ['weddings', 'events', 'season'], aiSummary: 'Season priority: weddings/events audience. I will prioritize campaigns, creatives and offers for that segment for about 4 months.' },
  c2: { text: 'I hired another salesperson, so we can now answer leads much faster.', tags: ['sales', 'support'], aiSummary: 'Response capacity went up — I can be more aggressive on lead generation without overloading the team.' },
  c3: { text: "We're closed every Monday. Don't schedule anything or suggest campaigns calling people in on Monday.", tags: ['hours', 'opening'], aiSummary: 'Closed on Mondays — never schedule actions, promotions or bookings for that day.' },
  c4: { text: 'We will raise prices by about 8% next month because of costs.', tags: ['price', 'margin'], aiSummary: 'A ~8% price increase is coming — communicate value before the increase and avoid promising old prices.' },
  c5: { text: "We're sponsoring the local neighborhood soccer team this year.", tags: ['sponsorship', 'community', 'neighborhood'], aiSummary: 'Local sponsorship active — use it as proof of community ties in content and PR.' },
  c6: { text: 'We lost our biggest corporate client last month — we need to replace that revenue.', tags: ['b2b', 'revenue'], aiSummary: 'B2B revenue gap — prioritize corporate prospecting and business offers to replace it.' },
}
const TX = {
  pt: {
    intro1: '🧠 Aqui você ensina à IA o que ', introB1: 'nenhuma integração consegue saber', intro2: ' — decisões, planos, mudanças na equipe, foco da temporada. Vira a ', introB2: 'memória estratégica', intro3: ' do negócio e passa a influenciar toda campanha, conteúdo e recomendação do agente.',
    prev1: 'As notas abaixo são ', prevB: 'exemplos', prev2: '. Adicione a sua primeira nota real e estes exemplos desaparecem — a partir daí a IA passa a usar só o que você registrar.',
    learned: '✨ O que a IA aprendeu com você', none: 'Nada registrado ainda. Adicione a primeira nota abaixo pra IA começar a entender a estratégia do negócio.',
    considering: (n: number) => `Considerando ${n} nota(s) ativa(s): restrições de operação, mudanças de equipe/preço e prioridades da temporada entram em toda decisão de conteúdo, campanha e automação do agente.`,
    search: 'Buscar por texto, tag ou categoria…', active: '← Ativas', archived: '🗄️ Arquivadas', cancel: 'Cancelar', newNote: '+ Nova nota',
    ph: 'Ex: "Vamos focar em casamentos nesta temporada." / "Fechamos toda segunda." / "Aumentaremos preços mês que vem."',
    category: 'Categoria', tagsL: 'Tags (separe por vírgula)', tagsPh: 'casamentos, temporada', from: 'Vale a partir de', expires: 'Expira em (opcional)', importance: 'Importância',
    saving: 'Salvando…', saveMem: 'Salvar na memória do negócio', loading: 'Carregando…', noArchived: 'Nenhuma nota arquivada.', noNotes: 'Nenhuma nota ainda. Registre a primeira acima.',
    impOf: 'Importância ', example: '🧪 exemplo', restore: 'Restaurar', archive: 'Arquivar', del: 'Excluir', aiSum: '✨ Resumo IA:',
    validFrom: 'Vale a partir de ', expiresOn: '· expira em ', updated: '· atualizado em ', edited: (n: number) => `· editado ${n}×`,
    aiWill: (s: string) => `A IA vai considerar isto nas decisões: "${s}"`,
  },
  en: {
    intro1: '🧠 Here you teach the AI what ', introB1: 'no integration can know', intro2: " — decisions, plans, team changes, the season's focus. It becomes the business's ", introB2: 'strategic memory', intro3: ' and influences every campaign, piece of content and recommendation from the agent.',
    prev1: 'The notes below are ', prevB: 'examples', prev2: '. Add your first real note and these examples disappear — from then on the AI only uses what you record.',
    learned: '✨ What the AI learned from you', none: 'Nothing recorded yet. Add the first note below so the AI can start understanding the business strategy.',
    considering: (n: number) => `Considering ${n} active note(s): operating constraints, team/price changes and season priorities feed into every content, campaign and automation decision by the agent.`,
    search: 'Search by text, tag or category…', active: '← Active', archived: '🗄️ Archived', cancel: 'Cancel', newNote: '+ New note',
    ph: 'E.g.: "We will focus on weddings this season." / "We close every Monday." / "We will raise prices next month."',
    category: 'Category', tagsL: 'Tags (comma separated)', tagsPh: 'weddings, season', from: 'Valid from', expires: 'Expires on (optional)', importance: 'Importance',
    saving: 'Saving…', saveMem: 'Save to business memory', loading: 'Loading…', noArchived: 'No archived notes.', noNotes: 'No notes yet. Add the first one above.',
    impOf: 'Importance: ', example: '🧪 example', restore: 'Restore', archive: 'Archive', del: 'Delete', aiSum: '✨ AI summary:',
    validFrom: 'Valid from ', expiresOn: '· expires on ', updated: '· updated on ', edited: (n: number) => `· edited ${n}×`,
    aiWill: (s: string) => `The AI will consider this in its decisions: "${s}"`,
  },
} as const

function fmt(d: string | null | undefined, loc: string) { return d ? new Date(d).toLocaleDateString(loc) : null }

export default function BusinessContextTab({ company }: { company: Pick<CompanyData, 'id'> }) {
  const { lang } = useLang()
  const tx = TX[lang]
  const loc = lang === 'en' ? 'en-US' : 'pt-BR'
  const [notes, setNotes] = useState<ContextNote[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [adding, setAdding] = useState(false)

  // form
  const [text, setText] = useState('')
  const [cat, setCat] = useState<ContextCategory>('estrategia')
  const [tags, setTags] = useState('')
  const [importance, setImportance] = useState<Importance>('medium')
  const [effective, setEffective] = useState(new Date().toISOString().slice(0, 10))
  const [expiration, setExpiration] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('business_context')
      .select('*')
      .eq('company_id', company.id)
      .order('updated_at', { ascending: false })
    setNotes((data as ContextRow[] | null ?? []).map(rowToNote))
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [company.id])

  // Enquanto o dono não registrou nada, mostramos exemplos (só leitura) pra ele
  // entender pra que serve. Somem no instante em que a primeira nota real entra.
  const isPreview = !loading && notes.length === 0
  const demoNotes = useMemo(() => (isPreview ? buildContextDemo() : []), [isPreview])
  const source = isPreview ? demoNotes : notes

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return source
      .filter(n => n.archived === showArchived)
      .filter(n => !q || n.text.toLowerCase().includes(q) || n.tags.some(t => t.toLowerCase().includes(q)) || CONTEXT_CATEGORY_META[n.category].label.toLowerCase().includes(q))
      .sort((a, b) => (b.updatedAt).localeCompare(a.updatedAt))
  }, [source, query, showArchived])

  const activeCount = notes.filter(n => !n.archived).length

  const addNote = async () => {
    if (!text.trim() || saving) return
    setSaving(true)
    const clean = text.trim()
    const { error } = await supabase.from('business_context').insert({
      company_id: company.id,
      text: clean,
      category: cat,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      importance,
      effective_date: effective || null,
      expiration_date: expiration || null,
      ai_summary: tx.aiWill(`${clean.slice(0, 90)}${clean.length > 90 ? '…' : ''}`),
    })
    setSaving(false)
    if (!error) {
      setText(''); setTags(''); setExpiration(''); setImportance('medium'); setCat('estrategia'); setAdding(false)
      await load()
    }
  }

  const archive = async (id: string, v: boolean) => {
    await supabase.from('business_context').update({ archived: v, updated_at: new Date().toISOString() }).eq('id', id)
    await load()
  }
  const remove = async (id: string) => {
    await supabase.from('business_context').delete().eq('id', id)
    await load()
  }

  return (
    <div>
      <div style={{ padding: '12px 16px', background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6, marginBottom: '18px' }}>
        {tx.intro1}<strong>{tx.introB1}</strong>{tx.intro2}<strong>{tx.introB2}</strong>{tx.intro3}
      </div>

      {isPreview && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '10px 14px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.5, marginBottom: '16px' }}>
          <span style={{ fontSize: '15px' }}>🧪</span>
          <span>{tx.prev1}<strong style={{ color: '#FBBF24' }}>{tx.prevB}</strong>{tx.prev2}</span>
        </div>
      )}

      {/* Resumo da IA */}
      <div style={{ background: CARD, border: '1px solid rgba(255,109,41,0.2)', borderRadius: '14px', padding: '16px 18px', marginBottom: '18px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{tx.learned}</div>
        <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
          {activeCount === 0
            ? tx.none
            : tx.considering(activeCount)}
        </div>
      </div>

      {/* Busca + ações */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={tx.search} style={{ ...inputStyle, flex: 1, minWidth: '200px' }} />
        <button onClick={() => setShowArchived(v => !v)} style={{ padding: '9px 14px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '9px', color: showArchived ? ORANGE : MUTED, fontSize: '12.5px', cursor: 'pointer', fontFamily: D }}>
          {showArchived ? tx.active : tx.archived}
        </button>
        {!showArchived && (
          <button onClick={() => setAdding(a => !a)} style={{ padding: '9px 16px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12.5px', border: 'none', borderRadius: '9px', cursor: 'pointer', fontFamily: D }}>
            {adding ? tx.cancel : tx.newNote}
          </button>
        )}
      </div>

      {/* Formulário */}
      {adding && !showArchived && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '18px', marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder={tx.ph} style={{ ...inputStyle, resize: 'vertical' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '10.5px', color: MUTED, marginBottom: '4px' }}>{tx.category}</div>
              <select value={cat} onChange={e => setCat(e.target.value as ContextCategory)} style={{ ...inputStyle, appearance: 'none' }}>
                {CATS.map(c => <option key={c} value={c} style={{ background: '#150E08' }}>{CONTEXT_CATEGORY_META[c].icon} {lang === 'en' ? CAT_EN[c] ?? CONTEXT_CATEGORY_META[c].label : CONTEXT_CATEGORY_META[c].label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10.5px', color: MUTED, marginBottom: '4px' }}>{tx.tagsL}</div>
              <input value={tags} onChange={e => setTags(e.target.value)} placeholder={tx.tagsPh} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10.5px', color: MUTED, marginBottom: '4px' }}>{tx.from}</div>
              <input type="date" value={effective} onChange={e => setEffective(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10.5px', color: MUTED, marginBottom: '4px' }}>{tx.expires}</div>
              <input type="date" value={expiration} onChange={e => setExpiration(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10.5px', color: MUTED, marginBottom: '6px' }}>{tx.importance}</div>
            <div style={{ display: 'flex', gap: '7px' }}>
              {(['high', 'medium', 'low'] as Importance[]).map(imp => (
                <button key={imp} onClick={() => setImportance(imp)}
                  style={{ padding: '6px 14px', borderRadius: '8px', border: `1px solid ${importance === imp ? IMPORTANCE_META[imp].color : BORDER}`, background: importance === imp ? `${IMPORTANCE_META[imp].color}18` : 'transparent', color: importance === imp ? IMPORTANCE_META[imp].color : MUTED, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>
                  {lang === 'en' ? IMP_EN[imp] : IMPORTANCE_META[imp].label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={addNote} disabled={!text.trim() || saving} style={{ alignSelf: 'flex-start', padding: '9px 20px', background: text.trim() && !saving ? ORANGE : 'rgba(255,255,255,0.08)', color: text.trim() && !saving ? '#000' : MUTED, fontWeight: 700, fontSize: '13px', border: 'none', borderRadius: '9px', cursor: text.trim() && !saving ? 'pointer' : 'not-allowed', fontFamily: D }}>
            {saving ? tx.saving : tx.saveMem}
          </button>
        </div>
      )}

      {/* Notas */}
      {loading ? (
        <div style={{ color: MUTED, fontSize: '13px', padding: '30px 0', textAlign: 'center' }}>{tx.loading}</div>
      ) : visible.length === 0 ? (
        <div style={{ color: MUTED, fontSize: '13px', padding: '30px 0', textAlign: 'center' }}>
          {showArchived ? tx.noArchived : tx.noNotes}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {visible.map(n => {
            const c = CONTEXT_CATEGORY_META[n.category]
            const imp = IMPORTANCE_META[n.importance]
            const demo = isPreview && lang === 'en' ? DEMO_EN[n.id] : undefined
            const catLabel = lang === 'en' ? CAT_EN[n.category] ?? c.label : c.label
            const impLabel = lang === 'en' ? IMP_EN[n.importance] : imp.label
            return (
              <div key={n.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '13px', padding: '15px 17px', opacity: isPreview ? 0.7 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '9px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: MUTED, background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '99px', padding: '2px 9px' }}>{c.icon} {catLabel}</span>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: imp.color, border: `1px solid ${imp.color}44`, borderRadius: '99px', padding: '2px 9px' }}>{tx.impOf}{impLabel}</span>
                  {(demo?.tags ?? n.tags).map(t => <span key={t} style={{ fontSize: '10px', color: '#60a5fa' }}>#{t}</span>)}
                  {isPreview ? (
                    <span style={{ marginLeft: 'auto', fontSize: '9.5px', fontWeight: 700, color: '#FBBF24' }}>{tx.example}</span>
                  ) : (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                      <button onClick={() => archive(n.id, !n.archived)} style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: '11px', cursor: 'pointer' }}>{n.archived ? tx.restore : tx.archive}</button>
                      <button onClick={() => remove(n.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(248,113,113,0.6)', fontSize: '11px', cursor: 'pointer' }}>{tx.del}</button>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '13.5px', color: 'white', lineHeight: 1.55, marginBottom: '9px' }}>{demo?.text ?? n.text}</div>
                <div style={{ padding: '9px 12px', background: 'rgba(255,109,41,0.05)', borderRadius: '9px', fontSize: '11.5px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginBottom: '9px' }}>
                  <span style={{ color: ORANGE, fontWeight: 700 }}>{tx.aiSum}</span> {demo?.aiSummary ?? n.aiSummary}
                </div>
                <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.35)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {n.effectiveDate && <span>{tx.validFrom}{fmt(n.effectiveDate, loc)}</span>}
                  {n.expirationDate && <span>{tx.expiresOn}{fmt(n.expirationDate, loc)}</span>}
                  <span>{tx.updated}{fmt(n.updatedAt, loc)}</span>
                  {n.edits > 0 && <span>{tx.edited(n.edits)}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
