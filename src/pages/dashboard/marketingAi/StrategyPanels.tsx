import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, D, ORANGE, timeAgo } from './shared'
import {
  type Strategy, type LogRow, type Budget,
  FEASIBILITY_COLOR, STATUS_COLOR, DECISION_TYPE_COLOR, strategyLabels,
} from './strategyTypes'

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '9px', color: 'white', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }
const label: React.CSSProperties = { display: 'block', fontSize: '10.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }
const cardBox: React.CSSProperties = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 16px' }

const TX = {
  pt: {
    periods: { daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal', campaign: 'Por campanha', custom: 'Personalizado' } as Record<string, string>,
    totalMonthly: 'Total mensal (R$)', totalPh: 'Ex: 500', period: 'Período', paidMedia: 'Mídia paga (R$)', organic: 'Conteúdo orgânico (R$)', creative: 'Produção criativa (R$)', other: 'Outros custos (R$)',
    flexible: 'Orçamento flexível (pode ajustar durante o período)', allocation: 'Alocação sugerida por canal', saving: 'Salvando...', saveBudget: 'Salvar orçamento',
    noFunnel: 'Nenhum plano de funil ainda.', metric: 'métrica: ', audience: 'Audiência:', message: 'Mensagem:', format: 'Formato:', destination: 'Destino:', dependsOn: 'Depende de:',
    draftNoteA: 'Rascunho de campanha paga (se houver) já foi salvo em ', draftNoteB: 'Agente Orgânico e Campanha → Campanha', draftNoteC: ' como planejado — nunca é publicado sozinho.',
    feasibility: 'Viabilidade', firstSignals: 'Sinais iniciais', relevantProgress: 'Progresso relevante', targetHorizon: 'Horizonte da meta', confidence: 'Confiança da estimativa: ',
    conf: { high: 'Alta', low: 'Baixa', medium: 'Média' } as Record<string, string>,
    creating: 'Criando...', createInit: '+ Criar iniciativa', noInit: 'Nenhuma iniciativa ainda. Iniciativas são ações específicas que rodam junto com a estratégia principal (ex: uma campanha sazonal, um teste de novo canal).',
    reanalyzing: 'Reavaliando...', reanalyze: '↻ Reavaliar com dado atual', noRec: 'Nenhuma recomendação ainda — clique em "Reavaliar" pra a IA comparar a estratégia com o dado real mais recente.',
    logStatus: { proposed: 'PROPOSTO', approved: 'APROVADO', dismissed: 'DISPENSADO', implemented: 'IMPLEMENTADO' } as Record<string, string>,
    alsoIn: 'Essas recomendações também aparecem em Aprendizado (Feedback Loop).',
  },
  en: {
    periods: { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', campaign: 'Per campaign', custom: 'Custom' } as Record<string, string>,
    totalMonthly: 'Monthly total (R$)', totalPh: 'E.g.: 500', period: 'Period', paidMedia: 'Paid media (R$)', organic: 'Organic content (R$)', creative: 'Creative production (R$)', other: 'Other costs (R$)',
    flexible: 'Flexible budget (can be adjusted during the period)', allocation: 'Suggested allocation by channel', saving: 'Saving...', saveBudget: 'Save budget',
    noFunnel: 'No funnel plan yet.', metric: 'metric: ', audience: 'Audience:', message: 'Message:', format: 'Format:', destination: 'Destination:', dependsOn: 'Depends on:',
    draftNoteA: 'A paid campaign draft (if any) was already saved in ', draftNoteB: 'Organic & Campaign Agent → Campaign', draftNoteC: ' as planned — it is never published on its own.',
    feasibility: 'Feasibility', firstSignals: 'First signals', relevantProgress: 'Relevant progress', targetHorizon: 'Goal horizon', confidence: 'Estimate confidence: ',
    conf: { high: 'High', low: 'Low', medium: 'Medium' } as Record<string, string>,
    creating: 'Creating...', createInit: '+ Create initiative', noInit: 'No initiatives yet. Initiatives are specific actions that run alongside the main strategy (e.g.: a seasonal campaign, a new channel test).',
    reanalyzing: 'Re-evaluating...', reanalyze: '↻ Re-evaluate with current data', noRec: 'No recommendations yet — click "Re-evaluate" so the AI compares the strategy with the latest real data.',
    logStatus: { proposed: 'PROPOSED', approved: 'APPROVED', dismissed: 'DISMISSED', implemented: 'IMPLEMENTED' } as Record<string, string>,
    alsoIn: 'These recommendations also appear in Learning (Feedback Loop).',
  },
} as const

// ── Orçamento ────────────────────────────────────────────────────────────
export function BudgetPanel({ budget, onChange, onSave, saving }: { budget: Budget; onChange: (b: Budget) => void; onSave: () => void; saving: boolean }) {
  const t = TX[useLang().lang]
  const set = <K extends keyof Budget>(k: K) => (v: Budget[K]) => onChange({ ...budget, [k]: v })
  const num = (s: string): number | null => (s.trim() === '' ? null : Number(s))
  return (
    <div>
      {budget.budget_reasoning && (
        <div style={{ fontSize: '11.5px', color: MUTED, marginBottom: '14px', lineHeight: 1.55, padding: '10px 12px', background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.15)', borderRadius: '9px' }}>
          💡 {budget.budget_reasoning}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div><label style={label}>{t.totalMonthly}</label><input type="number" style={inputStyle} value={budget.total ?? ''} onChange={e => set('total')(num(e.target.value))} placeholder={t.totalPh} /></div>
        <div><label style={label}>{t.period}</label>
          <select style={inputStyle} value={budget.period} onChange={e => set('period')(e.target.value)}>
            {['daily', 'weekly', 'monthly', 'campaign', 'custom'].map(p => <option key={p} value={p} style={{ background: '#150E08' }}>{t.periods[p]}</option>)}
          </select>
        </div>
        <div><label style={label}>{t.paidMedia}</label><input type="number" style={inputStyle} value={budget.paid_ads ?? ''} onChange={e => set('paid_ads')(num(e.target.value))} /></div>
        <div><label style={label}>{t.organic}</label><input type="number" style={inputStyle} value={budget.organic ?? ''} onChange={e => set('organic')(num(e.target.value))} /></div>
        <div><label style={label}>{t.creative}</label><input type="number" style={inputStyle} value={budget.creative ?? ''} onChange={e => set('creative')(num(e.target.value))} /></div>
        <div><label style={label}>{t.other}</label><input type="number" style={inputStyle} value={budget.other ?? ''} onChange={e => set('other')(num(e.target.value))} /></div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: MUTED, marginBottom: '16px', cursor: 'pointer' }}>
        <input type="checkbox" checked={budget.is_flexible} onChange={e => set('is_flexible')(e.target.checked)} style={{ accentColor: ORANGE }} />
        {t.flexible}
      </label>
      {budget.allocation.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <label style={label}>{t.allocation}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {budget.allocation.map((a, i) => (
              <div key={i} style={{ ...cardBox, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <div><div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>{a.channel}</div><div style={{ fontSize: '11px', color: MUTED }}>{a.reason}</div></div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: ORANGE, flexShrink: 0 }}>{a.amount != null ? `R$ ${a.amount}` : '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <button onClick={onSave} disabled={saving} style={{ padding: '9px 18px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12.5px', border: 'none', borderRadius: '9px', cursor: saving ? 'default' : 'pointer', fontFamily: D, opacity: saving ? 0.7 : 1 }}>
        {saving ? t.saving : t.saveBudget}
      </button>
    </div>
  )
}

// ── Conteúdo & Campanha (plano de funil) ────────────────────────────────
export function FunnelPanel({ strategy }: { strategy: Strategy }) {
  const { lang } = useLang()
  const t = TX[lang]
  const L = strategyLabels(lang)
  if (!strategy.funnel_plan.length) return <div style={{ fontSize: '12.5px', color: MUTED }}>{t.noFunnel}</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {strategy.funnel_plan.map((f, i) => (
        <div key={i} style={cardBox}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '9.5px', fontWeight: 800, color: ORANGE, background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.3)', borderRadius: '99px', padding: '3px 9px' }}>{L.FUNNEL_STAGE[f.stage] ?? f.stage}</span>
            {f.metric && <span style={{ fontSize: '10.5px', color: MUTED }}>{t.metric}{f.metric}</span>}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>{f.objective}</div>
          <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55 }}>
            {f.audience && <div><strong style={{ color: 'rgba(255,255,255,0.7)' }}>{t.audience}</strong> {f.audience}</div>}
            {f.message && <div><strong style={{ color: 'rgba(255,255,255,0.7)' }}>{t.message}</strong> {f.message}</div>}
            {f.format && <div><strong style={{ color: 'rgba(255,255,255,0.7)' }}>{t.format}</strong> {f.format}{f.cta ? ` · CTA: ${f.cta}` : ''}</div>}
            {f.destination && <div><strong style={{ color: 'rgba(255,255,255,0.7)' }}>{t.destination}</strong> {f.destination}</div>}
            {f.dependencies && <div><strong style={{ color: 'rgba(255,255,255,0.7)' }}>{t.dependsOn}</strong> {f.dependencies}</div>}
          </div>
        </div>
      ))}
      <div style={{ fontSize: '11px', color: MUTED, marginTop: '4px', lineHeight: 1.55 }}>
        {t.draftNoteA}<strong style={{ color: 'white' }}>{t.draftNoteB}</strong>{t.draftNoteC}
      </div>
    </div>
  )
}

// ── Prazo & Viabilidade ──────────────────────────────────────────────────
export function EstimatesPanel({ strategy }: { strategy: Strategy }) {
  const { lang } = useLang()
  const t = TX[lang]
  const L = strategyLabels(lang)
  const e = strategy.estimates
  const feasColor = FEASIBILITY_COLOR[e.feasibility_status] ?? MUTED
  return (
    <div>
      <div style={{ ...cardBox, marginBottom: '14px', borderColor: `${feasColor}55` }}>
        <div style={{ fontSize: '9.5px', fontWeight: 800, color: feasColor, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{t.feasibility}</div>
        <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'white', marginBottom: '6px' }}>{L.FEASIBILITY[e.feasibility_status] ?? e.feasibility_status}</div>
        <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.55 }}>{e.feasibility_reasoning}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        <div style={cardBox}><div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>{t.firstSignals}</div><div style={{ fontSize: '12.5px', color: 'white', lineHeight: 1.5 }}>{e.time_to_signals || '—'}</div></div>
        <div style={cardBox}><div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>{t.relevantProgress}</div><div style={{ fontSize: '12.5px', color: 'white', lineHeight: 1.5 }}>{e.time_to_progress || '—'}</div></div>
        <div style={cardBox}><div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>{t.targetHorizon}</div><div style={{ fontSize: '12.5px', color: 'white', lineHeight: 1.5 }}>{e.time_to_target || '—'}</div></div>
      </div>
      <div style={{ fontSize: '11px', color: MUTED, marginBottom: '10px' }}>{t.confidence}<strong style={{ color: 'white', textTransform: 'capitalize' }}>{e.confidence === 'high' ? t.conf.high : e.confidence === 'low' ? t.conf.low : t.conf.medium}</strong></div>
      {e.risks && <div style={{ fontSize: '12px', color: '#FBBF24', lineHeight: 1.55 }}>⚠ {e.risks}</div>}
    </div>
  )
}

// ── Iniciativas ───────────────────────────────────────────────────────────
export function InitiativesPanel({ initiatives, onCreate, creating, onOpen }: { initiatives: Strategy[]; onCreate: () => void; creating: boolean; onOpen: (id: string) => void }) {
  const { lang } = useLang()
  const t = TX[lang]
  const L = strategyLabels(lang)
  return (
    <div>
      <button onClick={onCreate} disabled={creating} style={{ padding: '9px 16px', background: 'transparent', border: `1px solid ${BORDER}`, color: ORANGE, fontWeight: 700, fontSize: '12.5px', borderRadius: '9px', cursor: creating ? 'default' : 'pointer', fontFamily: D, marginBottom: '14px' }}>
        {creating ? t.creating : t.createInit}
      </button>
      {initiatives.length === 0 ? (
        <div style={{ fontSize: '12.5px', color: MUTED }}>{t.noInit}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {initiatives.map(i => (
            <button key={i.id} onClick={() => onOpen(i.id)} style={{ textAlign: 'left', ...cardBox, cursor: 'pointer', fontFamily: D, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <div><div style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{i.name}</div><div style={{ fontSize: '11px', color: MUTED }}>{i.strategic_focus}</div></div>
              <span style={{ fontSize: '9.5px', fontWeight: 800, color: STATUS_COLOR[i.status] ?? MUTED, flexShrink: 0 }}>● {L.STATUS[i.status] ?? i.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Acompanhamento (reaproveita marketing_ai_strategy_log) ───────────────
export function MonitoringPanel({ log, onReanalyze, reanalyzing }: { log: LogRow[]; onReanalyze: () => void; reanalyzing: boolean }) {
  const { lang } = useLang()
  const t = TX[lang]
  const L = strategyLabels(lang)
  return (
    <div>
      <button onClick={onReanalyze} disabled={reanalyzing} style={{ padding: '9px 16px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12.5px', border: 'none', borderRadius: '9px', cursor: reanalyzing ? 'default' : 'pointer', fontFamily: D, marginBottom: '14px', opacity: reanalyzing ? 0.7 : 1 }}>
        {reanalyzing ? t.reanalyzing : t.reanalyze}
      </button>
      {log.length === 0 ? (
        <div style={{ fontSize: '12.5px', color: MUTED }}>{t.noRec}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {log.map(l => (
            <div key={l.id} style={cardBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {l.decision_type && (
                    <span style={{ fontSize: '9px', fontWeight: 800, color: DECISION_TYPE_COLOR[l.decision_type], border: `1px solid ${DECISION_TYPE_COLOR[l.decision_type]}55`, borderRadius: '99px', padding: '2px 8px' }}>
                      {L.DECISION_TYPE[l.decision_type]?.toUpperCase()}
                    </span>
                  )}
                  <span style={{ fontSize: '9.5px', fontWeight: 800, color: l.status === 'proposed' ? '#FBBF24' : l.status === 'implemented' ? '#4ade80' : MUTED }}>
                    {t.logStatus[l.status] ?? l.status}
                  </span>
                </div>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{timeAgo(l.created_at, lang)}</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>{l.recommendation}</div>
              <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.5 }}>{l.reasoning}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.35)', marginTop: '10px' }}>{t.alsoIn}</div>
    </div>
  )
}
