import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, D, SUPABASE_URL } from './shared'

// Agente de Dados → "Dicas e FAQ" (etapa 2, decisão do dono 2026-10-14).
// A IA sugere dicas (ou o dono escreve) e o servidor (`nearby-places`, área
// faq → _shared/faqHandler.ts) confere: geral passa
// sozinha; com número/regra só com fonte OFICIAL (selo com data e link);
// sem fonte fica "precisa revisar" até o dono aprovar. O post feito com a
// dica continua esperando a aprovação do dono no calendário (regra 1).

const ORANGE = '#FF6D29'
const TX = {
  pt: {
    intro: 'Dúvidas que seus clientes têm (jurídico, financiamento, documentação). A IA confere cada dica com número ou regra em site oficial do governo antes de ela poder virar post. Toda semana o calendário usa uma dica liberada.',
    suggest: '✨ Sugerir dicas', suggesting: 'Escrevendo e conferindo em fonte oficial... (até 1 min)', write: '＋ Escrever uma',
    q: 'Pergunta', a: 'Resposta', cat: 'Categoria', save: 'Salvar e conferir', saving: 'Conferindo...', cancel: 'Cancelar',
    none: 'Nenhuma dica ainda. Clique em "Sugerir dicas" ou escreva a sua.',
    geral: '✓ Dica geral — aprovada sozinha (sem número nem regra)',
    conferida: (d: string) => `✓ Conferida pela IA em ${d}`, corrigida: (d: string) => `✓ Conferida e corrigida pela IA em ${d}`,
    revisar: '⚠ Precisa revisar — não achei fonte oficial', aprovada: '✓ Aprovada por você', vencida: '⏳ Passou de 60 dias — reconferindo antes de usar',
    source: 'fonte', was: 'Antes estava:', approve: 'Aprovar mesmo assim', recheck: 'Conferir de novo', edit: 'Editar', del: 'Apagar',
    confirmDel: 'Apagar esta dica?', confirmApprove: 'Você confere que esta dica está certa? Ela vai poder virar post (que ainda passa pela sua aprovação).',
    used: (n: number) => `usada em ${n} post${n === 1 ? '' : 's'}`, err: 'Não deu certo. Tente de novo.',
  },
  en: {
    intro: 'Questions your clients ask (legal, financing, paperwork). The AI checks every tip with a number or rule against an official government site before it can become a post. Every week the calendar uses one cleared tip.',
    suggest: '✨ Suggest tips', suggesting: 'Writing and checking official sources... (up to 1 min)', write: '＋ Write one',
    q: 'Question', a: 'Answer', cat: 'Category', save: 'Save and check', saving: 'Checking...', cancel: 'Cancel',
    none: 'No tips yet. Click "Suggest tips" or write your own.',
    geral: '✓ General tip — auto-approved (no number or rule)',
    conferida: (d: string) => `✓ Checked by AI on ${d}`, corrigida: (d: string) => `✓ Checked and corrected by AI on ${d}`,
    revisar: '⚠ Needs review — no official source found', aprovada: '✓ Approved by you', vencida: '⏳ Over 60 days old — rechecking before use',
    source: 'source', was: 'It used to say:', approve: 'Approve anyway', recheck: 'Check again', edit: 'Edit', del: 'Delete',
    confirmDel: 'Delete this tip?', confirmApprove: 'Do you confirm this tip is correct? It can become a post (which still needs your approval).',
    used: (n: number) => `used in ${n} post${n === 1 ? '' : 's'}`, err: 'Something went wrong. Please try again.',
  },
} as const

interface Check { status: 'geral' | 'conferida' | 'corrigida' | 'revisar' | 'aprovada_dono'; checked_at: string; next_check_at: string | null; source_url?: string; source_title?: string; evidence?: string; note?: string; original_answer?: string }
interface Tip { id: string; title: string; content: string; meta: { category?: string; check?: Check; used_count?: number } | null }
export interface FaqCategory { key: string; label: string }

const host = (u?: string) => { try { return u ? new URL(u).hostname.replace(/^www\./, '') : '' } catch { return '' } }

export default function FaqTips({ companyId, categories }: { companyId: string; categories: FaqCategory[] }) {
  const { lang } = useLang()
  const tx = TX[lang]
  const { session } = useAuth()
  const [tips, setTips] = useState<Tip[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<{ id?: string; question: string; answer: string; category: string } | null>(null)
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR')

  const load = useCallback(async () => {
    const { data } = await supabase.from('marketing_ai_knowledge').select('id, title, content, meta').eq('company_id', companyId).eq('module', 'dados').eq('kind', 'faq').order('created_at', { ascending: false })
    setTips((data ?? []) as Tip[])
  }, [companyId])

  const call = useCallback(async (body: Record<string, unknown>) => {
    if (!session) return false
    setErr(null)
    try {
      // Dicas e FAQ divide a function com "Lugares perto" (limite de functions do plano).
      const res = await fetch(`${SUPABASE_URL}/functions/v1/nearby-places`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ area: 'faq', ...body }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(data.error ?? tx.err); return false }
      return true
    } catch { setErr(tx.err); return false }
  }, [session, tx.err])

  // Abriu a aba: mostra o que tem e, por trás, reconfere as dicas vencidas.
  useEffect(() => {
    load()
    if (session) call({ action: 'recheck_due' }).then(ok => { if (ok) load() })
  }, [load]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (key: string, body: Record<string, unknown>) => {
    setBusy(key)
    const ok = await call(body)
    await load()
    setBusy(null)
    return ok
  }
  const remove = async (id: string) => {
    if (!window.confirm(tx.confirmDel)) return
    const { error } = await supabase.from('marketing_ai_knowledge').delete().eq('id', id).eq('company_id', companyId)
    if (error) setErr(tx.err)
    load()
  }
  const submit = async () => {
    if (!form) return
    const ok = await run('form', form.id ? { action: 'update', ...form } : { action: 'add', ...form })
    if (ok) setForm(null)
  }

  const badge = (c?: Check) => {
    if (!c) return { text: tx.revisar, color: '#ffcc80' }
    const due = (c.status === 'conferida' || c.status === 'corrigida') && c.next_check_at && Date.parse(c.next_check_at) <= Date.now()
    if (due) return { text: tx.vencida, color: '#ffcc80' }
    if (c.status === 'geral') return { text: tx.geral, color: '#81c784' }
    if (c.status === 'aprovada_dono') return { text: tx.aprovada, color: '#81c784' }
    if (c.status === 'conferida') return { text: tx.conferida(fmtDate(c.checked_at)), color: '#81c784' }
    if (c.status === 'corrigida') return { text: tx.corrigida(fmtDate(c.checked_at)), color: '#81c784' }
    return { text: tx.revisar, color: '#ffcc80' }
  }

  const btn = (primary = false): React.CSSProperties => ({ background: primary ? ORANGE : 'transparent', color: primary ? '#fff' : MUTED, border: primary ? 'none' : `1px solid ${BORDER}`, borderRadius: '8px', padding: primary ? '9px 14px' : '4px 10px', fontSize: primary ? '13px' : '11px', fontWeight: primary ? 700 : 500, cursor: 'pointer' })
  const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: '#0E0B0A', color: '#fff', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '9px 10px', fontSize: '13px', fontFamily: 'inherit' }

  if (tips === null) return null
  return (
    <div style={{ maxWidth: '760px' }}>
      <div style={{ fontSize: '12px', color: MUTED, marginBottom: '14px', lineHeight: 1.55 }}>{tx.intro}</div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <button style={{ ...btn(true), opacity: busy ? 0.5 : 1 }} disabled={!!busy} onClick={() => run('suggest', { action: 'suggest', count: 4 })}>{tx.suggest}</button>
        <button style={{ ...btn(), padding: '9px 14px', fontSize: '13px' }} disabled={!!busy} onClick={() => setForm({ question: '', answer: '', category: categories[0]?.key ?? 'geral' })}>{tx.write}</button>
      </div>
      {busy === 'suggest' && <div style={{ fontSize: '13px', color: MUTED, marginBottom: '12px' }}>{tx.suggesting}</div>}
      {err && <div style={{ fontSize: '13px', color: '#ff8a65', marginBottom: '12px' }}>{err}</div>}

      {form && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px', marginBottom: '14px', display: 'grid', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: MUTED }}>{tx.cat}</label>
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={input}>
            {categories.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <label style={{ fontSize: '12px', color: MUTED }}>{tx.q}</label>
          <input value={form.question} maxLength={200} onChange={e => setForm({ ...form, question: e.target.value })} style={input} />
          <label style={{ fontSize: '12px', color: MUTED }}>{tx.a}</label>
          <textarea value={form.answer} maxLength={600} rows={4} onChange={e => setForm({ ...form, answer: e.target.value })} style={{ ...input, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ ...btn(true), opacity: busy ? 0.5 : 1 }} disabled={!!busy} onClick={submit}>{busy === 'form' ? tx.saving : tx.save}</button>
            <button style={{ ...btn(), padding: '9px 14px', fontSize: '13px' }} onClick={() => setForm(null)}>{tx.cancel}</button>
          </div>
        </div>
      )}

      {!tips.length && !form && <div style={{ fontSize: '13px', color: MUTED }}>{tx.none}</div>}
      <div style={{ display: 'grid', gap: '10px' }}>
        {tips.map(t => {
          const c = t.meta?.check
          const b = badge(c)
          const catLabel = categories.find(x => x.key === t.meta?.category)?.label
          return (
            <div key={t.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '12px 14px', opacity: busy === t.id ? 0.6 : 1 }}>
              {catLabel && <div style={{ fontSize: '11px', color: ORANGE, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{catLabel}</div>}
              <div style={{ fontFamily: D, fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{t.title}</div>
              <div style={{ fontSize: '13px', lineHeight: 1.5, marginBottom: '8px', whiteSpace: 'pre-wrap' }}>{t.content}</div>
              <div style={{ fontSize: '12px', color: b.color, lineHeight: 1.5 }}>
                {b.text}
                {c?.source_url && (c.status === 'conferida' || c.status === 'corrigida') && <> · {tx.source}: <a href={c.source_url} target="_blank" rel="noreferrer" style={{ color: b.color }}>{host(c.source_url)}</a></>}
              </div>
              {c?.note && c.status !== 'geral' && c.status !== 'aprovada_dono' && <div style={{ fontSize: '12px', color: MUTED, marginTop: '4px', lineHeight: 1.5 }}>{c.note}</div>}
              {c?.status === 'corrigida' && c.original_answer && <div style={{ fontSize: '12px', color: MUTED, marginTop: '4px', lineHeight: 1.5 }}>{tx.was} <s>{c.original_answer}</s></div>}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px', alignItems: 'center' }}>
                {c?.status === 'revisar' && <button style={btn()} disabled={!!busy} onClick={() => { if (window.confirm(tx.confirmApprove)) run(t.id, { action: 'approve', id: t.id }) }}>{tx.approve}</button>}
                <button style={btn()} disabled={!!busy} onClick={() => run(t.id, { action: 'verify', id: t.id })}>{busy === t.id ? tx.saving : tx.recheck}</button>
                <button style={btn()} disabled={!!busy} onClick={() => setForm({ id: t.id, question: t.title, answer: t.content, category: t.meta?.category ?? categories[0]?.key ?? 'geral' })}>{tx.edit}</button>
                <button style={btn()} disabled={!!busy} onClick={() => remove(t.id)}>{tx.del}</button>
                {(t.meta?.used_count ?? 0) > 0 && <span style={{ fontSize: '11px', color: MUTED }}>{tx.used(t.meta!.used_count!)}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
