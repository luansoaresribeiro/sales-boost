import { useLang } from '../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, D, ORANGE } from './marketingAi/shared'
import OpportunityPlan, { type PieceStats, type PlanData, type PlanPatch } from './opportunityPlan'

// Cartão de uma oportunidade (Inteligência comercial — Etapa 1). Só mostra: a decisão
// (aprovar/descartar) sobe pro pai. Nada daqui publica ou envia (regra 1).

export interface Evidence { type: 'fact' | 'data' | 'hypothesis'; text: string; source: string | null; date: string | null }
export interface Opportunity {
  id: string; kind: string | null; title: string; description: string | null; commercial_problem: string | null
  evidence: Evidence[] | null; item_ids: string[] | null; audience: string | null; suggested_action: string | null
  how_to_measure: string | null; confidence: 'high' | 'medium' | 'low' | 'needs_validation'; needs_validation: boolean
  status: 'suggested' | 'approved' | 'dismissed'; priority_rank: number | null; priority_reasons: string[] | null
  run_id: string | null; created_at: string; decided_at?: string | null
  plan?: PlanData | null; plan_generated_at?: string | null; plan_approved_at?: string | null // Etapa 4A (migration 20261029120000)
  pieces_generated_at?: string | null // Etapa 4B (migration 20261029130000)
}

const GREEN = '#4ade80'
const TX = {
  pt: {
    problem: 'Problema comercial', evidence: 'Evidências', items: 'Imóveis ligados', audience: 'Público', action: 'Ação sugerida', measure: 'Como medir',
    why: (n: number | null) => (n ? `Por que está em ${n}º` : 'Por quê'), approve: 'Aprovar', dismiss: 'Descartar', undo: 'Desfazer', approved: 'Aprovada', dismissedBadge: 'Descartada',
    approveHint: 'Aprovar monta o plano sozinho — nada é publicado ou enviado.',
    ev: { fact: 'Fato', data: 'Dado', hypothesis: 'Hipótese' }, conf: { high: 'Confiança alta', medium: 'Confiança média', low: 'Confiança baixa', needs_validation: 'Precisa validar' },
    kinds: { content_gap: 'Falta de conteúdo', low_traction: 'Pouca reação', unmet_demand: 'Demanda sem resposta', positioning: 'Posicionamento', market_change: 'Mudança de mercado', other: 'Outra' } as Record<string, string>,
    noDate: 'sem data', source: 'Fonte',
  },
  en: {
    problem: 'Commercial problem', evidence: 'Evidence', items: 'Linked properties', audience: 'Audience', action: 'Suggested action', measure: 'How to measure',
    why: (n: number | null) => (n ? `Why it is #${n}` : 'Why'), approve: 'Approve', dismiss: 'Dismiss', undo: 'Undo', approved: 'Approved', dismissedBadge: 'Dismissed',
    approveHint: 'Approving builds the plan automatically — nothing is published or sent.',
    ev: { fact: 'Fact', data: 'Data', hypothesis: 'Hypothesis' }, conf: { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence', needs_validation: 'Needs validation' },
    kinds: { content_gap: 'Content gap', low_traction: 'Low traction', unmet_demand: 'Unmet demand', positioning: 'Positioning', market_change: 'Market change', other: 'Other' } as Record<string, string>,
    noDate: 'no date', source: 'Source',
  },
} as const

const CONF_COLOR: Record<Opportunity['confidence'], string> = { high: GREEN, medium: '#FBBF24', low: MUTED, needs_validation: '#a78bfa' }
const EV_COLOR: Record<Evidence['type'], string> = { fact: GREEN, data: '#60a5fa', hypothesis: '#a78bfa' }
const EV_ORDER: Evidence['type'][] = ['fact', 'data', 'hypothesis']

const fmtDate = (iso: string | null, lang: 'pt' | 'en') => {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null
  return m ? (lang === 'en' ? `${m[2]}/${m[3]}/${m[1]}` : `${m[3]}/${m[2]}/${m[1]}`) : null
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: ORANGE, marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.86)', lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

export default function OpportunityCard({ o, itemNames, pieces, busy, onDecide, onPlan }: {
  o: Opportunity; itemNames: Record<string, string>; pieces?: PieceStats; busy: boolean; onDecide: (status: Opportunity['status']) => void; onPlan: (patch: Partial<PlanPatch>) => void
}) {
  const { lang } = useLang()
  const t = TX[lang]
  const color = CONF_COLOR[o.confidence]
  const evidence = o.evidence ?? []
  const names = (o.item_ids ?? []).map(id => itemNames[id]).filter(Boolean)
  const btn = (bg: string, fg: string, border?: string) => ({ padding: '9px 18px', background: bg, color: fg, fontWeight: 700, fontSize: '12.5px', border: border ?? 'none', borderRadius: '9px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: D } as const)
  return (
    <div style={{ background: CARD, border: `1px solid ${o.status === 'approved' ? 'rgba(74,222,128,0.35)' : BORDER}`, borderRadius: '13px', padding: '16px 16px 14px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
        {o.priority_rank && <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 9px', borderRadius: '99px', background: 'rgba(255,109,41,0.14)', color: ORANGE }}>#{o.priority_rank}</span>}
        {o.kind && <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 9px', borderRadius: '99px', border: `1px solid ${BORDER}`, color: MUTED }}>{t.kinds[o.kind] ?? o.kind}</span>}
        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 9px', borderRadius: '99px', border: `1px solid ${color}55`, color }}>{t.conf[o.confidence]}</span>
        {o.status === 'dismissed' && <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 9px', borderRadius: '99px', border: `1px solid ${BORDER}`, color: MUTED }}>{t.dismissedBadge}</span>}
        {o.status === 'approved' && <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 9px', borderRadius: '99px', border: `1px solid ${GREEN}55`, color: GREEN }}>✓ {t.approved}</span>}
      </div>
      <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', lineHeight: 1.35 }}>{o.title}</div>
      {o.description && <div style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.6, marginTop: '6px' }}>{o.description}</div>}

      {o.commercial_problem && <Block label={t.problem}>{o.commercial_problem}</Block>}

      {evidence.length > 0 && (
        <Block label={t.evidence}>
          {EV_ORDER.map(type => {
            const list = evidence.filter(e => e.type === type)
            if (!list.length) return null
            return list.map((e, i) => (
              <div key={`${type}-${i}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '7px' }}>
                <span style={{ flexShrink: 0, fontSize: '9.5px', fontWeight: 800, padding: '2px 7px', borderRadius: '6px', marginTop: '2px', border: `1px solid ${EV_COLOR[type]}66`, color: EV_COLOR[type] }}>{t.ev[type]}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12.5px', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{e.text}</div>
                  <div style={{ fontSize: '10.5px', color: MUTED, overflowWrap: 'anywhere' }}>{e.source ? `${t.source}: ${e.source}` : ''}{e.type !== 'hypothesis' ? `${e.source ? ' · ' : ''}${fmtDate(e.date, lang) ?? t.noDate}` : ''}</div>
                </div>
              </div>
            ))
          })}
        </Block>
      )}

      {names.length > 0 && <Block label={t.items}>{names.join(' · ')}</Block>}
      {o.audience && <Block label={t.audience}>{o.audience}</Block>}
      {o.suggested_action && <Block label={t.action}>{o.suggested_action}</Block>}
      {o.how_to_measure && <Block label={t.measure}>{o.how_to_measure}</Block>}
      {(o.priority_reasons ?? []).length > 0 && <Block label={t.why(o.priority_rank)}>{(o.priority_reasons ?? []).join(' · ')}</Block>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px', alignItems: 'center' }}>
        {o.status === 'suggested' ? (
          <>
            <button disabled={busy} onClick={() => onDecide('approved')} style={btn(ORANGE, '#000')}>{t.approve}</button>
            <button disabled={busy} onClick={() => onDecide('dismissed')} style={btn('transparent', MUTED, `1px solid ${BORDER}`)}>{t.dismiss}</button>
          </>
        ) : (
          <button disabled={busy} onClick={() => onDecide('suggested')} style={btn('transparent', MUTED, `1px solid ${BORDER}`)}>{t.undo}</button>
        )}
      </div>
      {o.status === 'suggested' && <div style={{ fontSize: '10.5px', color: MUTED, marginTop: '8px' }}>{t.approveHint}</div>}
      {o.status === 'approved' && <OpportunityPlan opportunityId={o.id} plan={o.plan ?? null} approvedAt={o.plan_approved_at ?? null} itemNames={itemNames} decidedAt={o.decided_at ?? null} piecesGeneratedAt={o.pieces_generated_at ?? null} pieces={pieces} onChange={onPlan} />}
    </div>
  )
}
