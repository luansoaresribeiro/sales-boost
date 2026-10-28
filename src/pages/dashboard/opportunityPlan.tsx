import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LanguageContext'
import { useShowcase } from '../../contexts/ShowcaseContext'
import { callMarketingAi, MUTED, BORDER, D, ORANGE } from './marketingAi/shared'
import type { Evidence } from './opportunityCard'

// Plano de uma oportunidade APROVADA (Inteligência comercial — Etapa 4, Parte A). Tudo automático: o plano é criado
// sozinho quando a oportunidade é aprovada (marketing-ai → decide_opportunity); aqui o dono só APROVA o plano
// (approve_opportunity_plan). Não há botão de gerar nem de refazer. Aprovar só guarda a decisão: nada é publicado
// ou enviado daqui (regra 1); gerar as peças é a Parte B.

export interface PlanData {
  audience: string | null; objective: string; buyer_problem: string; value_proposition: string; key_message: string
  channel: string; format_suggestion: string; format_reason: string; format_is_default?: boolean
  cta: string; cta_replaced?: boolean; success_metrics: string
  item_ids: string[]; cited_evidence: (Evidence & { index: number })[]; hypotheses: string[]
}
export const PLAN_WAIT_MS = 2 * 60_000 // quanto tempo a tela espera o plano sair antes de dizer "próxima rodada"
export interface PlanPatch { plan: PlanData | null; plan_generated_at: string | null; plan_approved_at: string | null }

const GREEN = '#4ade80'
const TX = {
  pt: {
    building: 'Montando o plano…', later: 'O plano sai na próxima rodada automática.', approve: 'Aprovar plano', unapprove: 'Desfazer aprovação', approvedBadge: 'Plano aprovado', draftBadge: 'Plano ainda não aprovado',
    fixed: 'Nada é publicado daqui. Gerar as peças vem no próximo passo.', title: 'Plano da oportunidade', hint: 'O plano transforma esta oportunidade em uma ação: público, mensagem e formato. É criado sozinho depois que você aprova a oportunidade.',
    audience: 'Público', objective: 'Objetivo', problem: 'Problema do comprador', value: 'Proposta de valor', message: 'Mensagem principal', channel: 'Canal', format: 'Formato sugerido', cta: 'Chamada final (CTA)',
    measure: 'Como medir', items: 'Imóveis ligados', evidence: 'Evidências citadas', hypotheses: 'Hipóteses (ainda não verificadas)',
    formats: { carousel: 'Carrossel', reel: 'Vídeo curto (Reel)', post: 'Post com foto', story: 'Story' } as Record<string, string>,
    channels: { instagram: 'Instagram', whatsapp: 'WhatsApp', email: 'E-mail' } as Record<string, string>,
    formatDefault: 'formato padrão', ctaFixed: 'Ajustado: sem resposta automática aprovada, o sistema não usa “comente PALAVRA”.',
    ev: { fact: 'Fato', data: 'Dado', hypothesis: 'Hipótese' }, source: 'Fonte', noDate: 'sem data', errApprove: 'Erro ao salvar a decisão',
  },
  en: {
    building: 'Building the plan…', later: 'The plan will come out in the next automatic round.', approve: 'Approve plan', unapprove: 'Undo approval', approvedBadge: 'Plan approved', draftBadge: 'Plan not approved yet',
    fixed: 'Nothing is published from here. Generating the pieces comes in the next step.', title: 'Opportunity plan', hint: 'The plan turns this opportunity into an action: audience, message and format. It is created automatically after you approve the opportunity.',
    audience: 'Audience', objective: 'Objective', problem: 'Buyer problem', value: 'Value proposition', message: 'Key message', channel: 'Channel', format: 'Suggested format', cta: 'Call to action (CTA)',
    measure: 'How to measure', items: 'Linked properties', evidence: 'Evidence cited', hypotheses: 'Hypotheses (not verified yet)',
    formats: { carousel: 'Carousel', reel: 'Short video (Reel)', post: 'Photo post', story: 'Story' } as Record<string, string>,
    channels: { instagram: 'Instagram', whatsapp: 'WhatsApp', email: 'Email' } as Record<string, string>,
    formatDefault: 'default format', ctaFixed: 'Adjusted: with no approved automatic reply, the system does not use “comment WORD”.',
    ev: { fact: 'Fact', data: 'Data', hypothesis: 'Hypothesis' }, source: 'Source', noDate: 'no date', errApprove: 'Could not save the decision',
  },
} as const
const EV_COLOR: Record<Evidence['type'], string> = { fact: GREEN, data: '#60a5fa', hypothesis: '#a78bfa' }

const fmtDate = (iso: string | null, lang: 'pt' | 'en') => {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null
  return m ? (lang === 'en' ? `${m[2]}/${m[3]}/${m[1]}` : `${m[3]}/${m[2]}/${m[1]}`) : null
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: ORANGE, marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.86)', lineHeight: 1.6, overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  )
}

export default function OpportunityPlan({ plan, opportunityId, decidedAt, approvedAt, itemNames, onChange }: {
  opportunityId: string; plan: PlanData | null; decidedAt: string | null; approvedAt: string | null; itemNames: Record<string, string>; onChange: (p: Partial<PlanPatch>) => void
}) {
  const { lang } = useLang()
  const t = TX[lang]
  const { session } = useAuth()
  const { readOnly, openPlanModal } = useShowcase()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const approve = async (undo: boolean) => {
    if (readOnly) { openPlanModal(); return }
    if (busy || !session?.access_token) return
    setBusy(true); setMsg(null)
    try {
      const r = await callMarketingAi(session.access_token, 'approve_opportunity_plan', { opportunity_id: opportunityId, undo }) as { plan_approved_at: string | null }
      onChange({ plan_approved_at: r.plan_approved_at ?? null })
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : t.errApprove }) }
    setBusy(false)
  }
  // Sem plano ainda: "montando" por 2 min depois da aprovação; depois disso a rede de segurança automática gera.
  const waiting = !!decidedAt && Date.now() - Date.parse(decidedAt) < PLAN_WAIT_MS

  const btn = (bg: string, fg: string, border?: string) => ({ padding: '9px 18px', background: bg, color: fg, fontWeight: 700, fontSize: '12.5px', border: border ?? 'none', borderRadius: '9px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: D } as const)
  const lock = readOnly ? '🔒 ' : ''
  const names = (plan?.item_ids ?? []).map(id => itemNames[id]).filter(Boolean)

  return (
    <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: `1px dashed ${BORDER}` }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'white' }}>{t.title}</div>
        {plan && <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 9px', borderRadius: '99px', border: `1px solid ${approvedAt ? GREEN : MUTED}55`, color: approvedAt ? GREEN : MUTED }}>{approvedAt ? `✓ ${t.approvedBadge}` : t.draftBadge}</span>}
      </div>

      {!plan ? (
        <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.5, margin: '6px 0 0' }}>
          <div>{t.hint}</div>
          <div role="status" style={{ marginTop: '6px', color: waiting ? ORANGE : MUTED, fontWeight: 700 }}>{waiting ? t.building : t.later}</div>
        </div>
      ) : (
        <>
          {plan.audience && <Row label={t.audience}>{plan.audience}</Row>}
          <Row label={t.objective}>{plan.objective}</Row>
          <Row label={t.problem}>{plan.buyer_problem}</Row>
          <Row label={t.value}>{plan.value_proposition}</Row>
          <Row label={t.message}>{plan.key_message}</Row>
          <Row label={t.channel}>{t.channels[plan.channel] ?? plan.channel}</Row>
          <Row label={t.format}>
            <b>{t.formats[plan.format_suggestion] ?? plan.format_suggestion}</b>{plan.format_is_default ? ` (${t.formatDefault})` : ''} — {plan.format_reason}
          </Row>
          <Row label={t.cta}>{plan.cta}{plan.cta_replaced && <div style={{ fontSize: '10.5px', color: MUTED }}>{t.ctaFixed}</div>}</Row>
          {plan.success_metrics && <Row label={t.measure}>{plan.success_metrics}</Row>}
          {names.length > 0 && <Row label={t.items}>{names.join(' · ')}</Row>}
          {plan.cited_evidence.length > 0 && (
            <Row label={t.evidence}>
              {plan.cited_evidence.map(e => (
                <div key={e.index} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <span style={{ flexShrink: 0, fontSize: '9.5px', fontWeight: 800, padding: '2px 7px', borderRadius: '6px', marginTop: '2px', border: `1px solid ${EV_COLOR[e.type]}66`, color: EV_COLOR[e.type] }}>{t.ev[e.type]}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', lineHeight: 1.5 }}>{e.text}</div>
                    <div style={{ fontSize: '10.5px', color: MUTED }}>{e.source ? `${t.source}: ${e.source}` : ''}{e.type !== 'hypothesis' ? `${e.source ? ' · ' : ''}${fmtDate(e.date, lang) ?? t.noDate}` : ''}</div>
                  </div>
                </div>
              ))}
            </Row>
          )}
          {plan.hypotheses.length > 0 && (
            <Row label={t.hypotheses}>
              {plan.hypotheses.map(h => <div key={h} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}><span style={{ flexShrink: 0, fontSize: '9.5px', fontWeight: 800, padding: '2px 7px', borderRadius: '6px', border: '1px solid #a78bfa66', color: '#a78bfa' }}>{t.ev.hypothesis}</span><span>{h}</span></div>)}
            </Row>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px', alignItems: 'center' }}>
            {approvedAt
              ? <button disabled={busy} onClick={() => approve(true)} style={btn('transparent', MUTED, `1px solid ${BORDER}`)}>{lock}{t.unapprove}</button>
              : <button disabled={busy} onClick={() => approve(false)} style={btn(readOnly ? 'rgba(255,255,255,0.08)' : ORANGE, readOnly ? MUTED : '#000')}>{lock}{t.approve}</button>}
          </div>
        </>
      )}
      {msg && <div role="status" style={{ fontSize: '12px', marginTop: '8px', color: msg.ok ? GREEN : '#FBBF24' }}>{msg.text}</div>}
      <div style={{ fontSize: '10.5px', color: MUTED, marginTop: '8px' }}>{t.fixed}</div>
    </div>
  )
}
