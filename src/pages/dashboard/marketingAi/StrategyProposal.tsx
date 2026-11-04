import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, D, ORANGE } from './shared'
import type { Strategy } from './strategyTypes'

// "Proposta de mudança" (Fase 3, 2026-11-04): o check-up semanal NÃO troca mais a estratégia sozinho — quando acha que o
// rumo deve mudar, gera uma proposta (status needs_review) e o dono decide aqui. Só aparece proposta aberta (não descartada).
// Estados: carregando / "Não foi possível verificar" / nada (some) / proposta. Nada é inventado: mostra só o que está gravado.
const TX = {
  pt: {
    title: 'Proposta de mudança', intro: 'O sistema acha que vale mudar o rumo da sua estratégia. Nada muda até você decidir.',
    loading: 'Verificando…', error: 'Não foi possível verificar', retry: 'Tentar de novo',
    changes: 'O que muda', now: 'Hoje', proposed: 'Proposta', unchanged: 'igual ao de hoje', none: 'Não definido',
    thesis: 'Tese', biz: 'Objetivo de negócio', mkt: 'Objetivo de marketing', audience: 'Público', why: 'Por que o sistema propõe isso',
    approve: 'Aprovar', discard: 'Descartar', working: 'Salvando…', errAct: 'Não foi possível salvar — tente de novo.', decided: 'Essa proposta já foi decidida.',
    confirmApprove: 'Aprovar esta mudança? A estratégia atual vai para o histórico e a nova passa a valer, inclusive no calendário.',
  },
  en: {
    title: 'Change proposal', intro: 'The system thinks it is worth changing the direction of your strategy. Nothing changes until you decide.',
    loading: 'Checking…', error: 'Could not verify', retry: 'Try again',
    changes: 'What changes', now: 'Today', proposed: 'Proposal', unchanged: 'same as today', none: 'Not defined',
    thesis: 'Thesis', biz: 'Business objective', mkt: 'Marketing objective', audience: 'Audience', why: 'Why the system proposes this',
    approve: 'Approve', discard: 'Discard', working: 'Saving…', errAct: 'Could not save — try again.', decided: 'This proposal was already decided.',
    confirmApprove: 'Approve this change? The current strategy goes to the history and the new one takes over, including the calendar.',
  },
} as const

type Prov = { proposal?: { discarded_at?: string; reason?: string; reasoning?: string } } | null
type State = { s: 'loading' } | { s: 'error' } | { s: 'none' } | { s: 'value'; p: Strategy }

const audiences = (s: Strategy) => [...new Set((s.funnel_plan ?? []).map(f => f.audience?.trim()).filter(Boolean))].join(' · ')

export default function StrategyProposal({ companyId, active, call, onChanged, readOnly }: {
  companyId: string; active: Strategy | null; call: (body: Record<string, unknown>) => Promise<unknown>; onChanged: () => Promise<void> | void; readOnly?: boolean
}) {
  const { lang } = useLang(); const t = TX[lang]
  const [st, setSt] = useState<State>({ s: 'loading' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setSt({ s: 'loading' })
    const { data, error } = await supabase.from('marketing_ai_strategies').select('*').eq('company_id', companyId).eq('kind', 'main').eq('status', 'needs_review').order('created_at', { ascending: false }).limit(5)
    if (error) { setSt({ s: 'error' }); return }
    const open = ((data ?? []) as Strategy[]).find(r => { const pr = (r as unknown as { data_provenance?: Prov }).data_provenance?.proposal; return !!pr && !pr.discarded_at })
    setSt(open ? { s: 'value', p: open } : { s: 'none' })
  }, [companyId])
  useEffect(() => { void load() }, [load])

  const decide = async (action: 'approve_proposal' | 'discard_proposal', id: string) => {
    if (action === 'approve_proposal' && !window.confirm(t.confirmApprove)) return
    setBusy(true); setErr('')
    try { await call({ action, strategy_id: id }); await onChanged(); await load() }
    catch (e) {
      // 409 not_pending: já foi decidida (outra aba/automático) → recarrega pra a proposta velha sumir.
      if ((e as { code?: string })?.code === 'not_pending') { await onChanged(); await load(); setErr(t.decided) } else setErr(t.errAct)
    }
    setBusy(false)
  }

  if (st.s === 'none') return err ? <div style={{ fontSize: '12.5px', color: MUTED, maxWidth: '1000px' }}>{err}</div> : null
  const box: React.CSSProperties = { background: CARD, border: `1px solid ${ORANGE}`, borderRadius: '12px', padding: '14px 16px', maxWidth: '1000px' }
  const lbl: React.CSSProperties = { fontSize: '9.5px', fontWeight: 800, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }
  const txt: React.CSSProperties = { fontSize: '12.5px', color: 'white', lineHeight: 1.55 }
  if (st.s === 'loading') return <div style={{ ...box, borderColor: BORDER }}><div style={{ ...txt, color: MUTED }}>{t.loading}</div></div>
  if (st.s === 'error') return <div style={{ ...box, borderColor: BORDER }}><div style={{ ...txt, color: MUTED }}>{t.error} · <button onClick={() => void load()} style={{ background: 'none', border: 'none', color: ORANGE, fontWeight: 700, cursor: 'pointer', fontFamily: D, fontSize: '12.5px' }}>{t.retry}</button></div></div>

  const p = st.p
  const pr = (p as unknown as { data_provenance?: Prov }).data_provenance?.proposal
  const rows: [string, string, string][] = [
    [t.thesis, active?.thesis?.trim() ?? '', p.thesis?.trim() ?? ''],
    [t.biz, active?.primary_business_objective?.trim() ?? '', p.primary_business_objective?.trim() ?? ''],
    [t.mkt, active?.primary_marketing_objective?.trim() ?? '', p.primary_marketing_objective?.trim() ?? ''],
    [t.audience, active ? audiences(active) : '', audiences(p)],
  ]
  const btn = (primary: boolean): React.CSSProperties => ({ padding: '9px 16px', background: primary ? ORANGE : 'transparent', color: primary ? '#000' : MUTED, fontWeight: 800, fontSize: '12.5px', border: primary ? 'none' : `1px solid ${BORDER}`, borderRadius: '9px', cursor: busy ? 'default' : 'pointer', fontFamily: D, opacity: busy ? 0.6 : 1 })
  return (
    <div style={box}>
      <div style={lbl}>{t.title}</div>
      <div style={{ ...txt, color: MUTED, marginBottom: '10px' }}>{t.intro}</div>
      <div style={{ ...lbl, color: MUTED }}>{t.changes}</div>
      {rows.map(([k, now, next]) => (
        <div key={k} style={{ ...txt, marginBottom: '8px' }}>
          <strong>{k}</strong>
          {now && next && now === next
            ? <div style={{ color: MUTED }}>{t.unchanged}</div>
            : <>
                <div><span style={{ color: MUTED }}>{t.now}: </span>{now || <span style={{ color: MUTED }}>{t.none}</span>}</div>
                <div><span style={{ color: ORANGE }}>{t.proposed}: </span>{next || <span style={{ color: MUTED }}>{t.none}</span>}</div>
              </>}
        </div>
      ))}
      {(pr?.reason || pr?.reasoning) && <div style={{ ...txt, marginBottom: '10px' }}><strong>{t.why}</strong><div style={{ color: MUTED }}>{pr?.reason}{pr?.reason && pr?.reasoning ? ' — ' : ''}{pr?.reasoning}</div></div>}
      {err && <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '8px' }}>{err}</div>}
      {!readOnly && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button disabled={busy} onClick={() => void decide('approve_proposal', p.id)} style={btn(true)}>{busy ? t.working : t.approve}</button>
          <button disabled={busy} onClick={() => void decide('discard_proposal', p.id)} style={btn(false)}>{t.discard}</button>
        </div>
      )}
    </div>
  )
}
