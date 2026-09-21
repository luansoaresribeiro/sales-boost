import { CARD, MUTED, BORDER, D, ORANGE, timeAgo } from './shared'
import {
  type Strategy, type LogRow, type Budget,
  FUNNEL_STAGE_LABEL, FEASIBILITY_LABEL, FEASIBILITY_COLOR, STATUS_LABEL, STATUS_COLOR,
} from './strategyTypes'

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '9px', color: 'white', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }
const label: React.CSSProperties = { display: 'block', fontSize: '10.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }
const cardBox: React.CSSProperties = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 16px' }

// ── Orçamento ────────────────────────────────────────────────────────────
export function BudgetPanel({ budget, onChange, onSave, saving }: { budget: Budget; onChange: (b: Budget) => void; onSave: () => void; saving: boolean }) {
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
        <div><label style={label}>Total mensal (R$)</label><input type="number" style={inputStyle} value={budget.total ?? ''} onChange={e => set('total')(num(e.target.value))} placeholder="Ex: 500" /></div>
        <div><label style={label}>Período</label>
          <select style={inputStyle} value={budget.period} onChange={e => set('period')(e.target.value)}>
            {['daily', 'weekly', 'monthly', 'campaign', 'custom'].map(p => <option key={p} value={p} style={{ background: '#150E08' }}>{{ daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal', campaign: 'Por campanha', custom: 'Personalizado' }[p]}</option>)}
          </select>
        </div>
        <div><label style={label}>Mídia paga (R$)</label><input type="number" style={inputStyle} value={budget.paid_ads ?? ''} onChange={e => set('paid_ads')(num(e.target.value))} /></div>
        <div><label style={label}>Conteúdo orgânico (R$)</label><input type="number" style={inputStyle} value={budget.organic ?? ''} onChange={e => set('organic')(num(e.target.value))} /></div>
        <div><label style={label}>Produção criativa (R$)</label><input type="number" style={inputStyle} value={budget.creative ?? ''} onChange={e => set('creative')(num(e.target.value))} /></div>
        <div><label style={label}>Outros custos (R$)</label><input type="number" style={inputStyle} value={budget.other ?? ''} onChange={e => set('other')(num(e.target.value))} /></div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: MUTED, marginBottom: '16px', cursor: 'pointer' }}>
        <input type="checkbox" checked={budget.is_flexible} onChange={e => set('is_flexible')(e.target.checked)} style={{ accentColor: ORANGE }} />
        Orçamento flexível (pode ajustar durante o período)
      </label>
      {budget.allocation.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <label style={label}>Alocação sugerida por canal</label>
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
        {saving ? 'Salvando...' : 'Salvar orçamento'}
      </button>
    </div>
  )
}

// ── Conteúdo & Campanha (plano de funil) ────────────────────────────────
export function FunnelPanel({ strategy }: { strategy: Strategy }) {
  if (!strategy.funnel_plan.length) return <div style={{ fontSize: '12.5px', color: MUTED }}>Nenhum plano de funil ainda.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {strategy.funnel_plan.map((f, i) => (
        <div key={i} style={cardBox}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '9.5px', fontWeight: 800, color: ORANGE, background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.3)', borderRadius: '99px', padding: '3px 9px' }}>{FUNNEL_STAGE_LABEL[f.stage] ?? f.stage}</span>
            {f.metric && <span style={{ fontSize: '10.5px', color: MUTED }}>métrica: {f.metric}</span>}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>{f.objective}</div>
          <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55 }}>
            {f.audience && <div><strong style={{ color: 'rgba(255,255,255,0.7)' }}>Audiência:</strong> {f.audience}</div>}
            {f.message && <div><strong style={{ color: 'rgba(255,255,255,0.7)' }}>Mensagem:</strong> {f.message}</div>}
            {f.format && <div><strong style={{ color: 'rgba(255,255,255,0.7)' }}>Formato:</strong> {f.format}{f.cta ? ` · CTA: ${f.cta}` : ''}</div>}
            {f.destination && <div><strong style={{ color: 'rgba(255,255,255,0.7)' }}>Destino:</strong> {f.destination}</div>}
            {f.dependencies && <div><strong style={{ color: 'rgba(255,255,255,0.7)' }}>Depende de:</strong> {f.dependencies}</div>}
          </div>
        </div>
      ))}
      <div style={{ fontSize: '11px', color: MUTED, marginTop: '4px', lineHeight: 1.55 }}>
        Rascunho de campanha paga (se houver) já foi salvo em <strong style={{ color: 'white' }}>Agente Orgânico e Campanha → Campanha</strong> como planejado — nunca é publicado sozinho.
      </div>
    </div>
  )
}

// ── Prazo & Viabilidade ──────────────────────────────────────────────────
export function EstimatesPanel({ strategy }: { strategy: Strategy }) {
  const e = strategy.estimates
  const feasColor = FEASIBILITY_COLOR[e.feasibility_status] ?? MUTED
  return (
    <div>
      <div style={{ ...cardBox, marginBottom: '14px', borderColor: `${feasColor}55` }}>
        <div style={{ fontSize: '9.5px', fontWeight: 800, color: feasColor, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Viabilidade</div>
        <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'white', marginBottom: '6px' }}>{FEASIBILITY_LABEL[e.feasibility_status] ?? e.feasibility_status}</div>
        <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.55 }}>{e.feasibility_reasoning}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        <div style={cardBox}><div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>Sinais iniciais</div><div style={{ fontSize: '12.5px', color: 'white', lineHeight: 1.5 }}>{e.time_to_signals || '—'}</div></div>
        <div style={cardBox}><div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>Progresso relevante</div><div style={{ fontSize: '12.5px', color: 'white', lineHeight: 1.5 }}>{e.time_to_progress || '—'}</div></div>
        <div style={cardBox}><div style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>Horizonte da meta</div><div style={{ fontSize: '12.5px', color: 'white', lineHeight: 1.5 }}>{e.time_to_target || '—'}</div></div>
      </div>
      <div style={{ fontSize: '11px', color: MUTED, marginBottom: '10px' }}>Confiança da estimativa: <strong style={{ color: 'white', textTransform: 'capitalize' }}>{e.confidence === 'high' ? 'Alta' : e.confidence === 'low' ? 'Baixa' : 'Média'}</strong></div>
      {e.risks && <div style={{ fontSize: '12px', color: '#FBBF24', lineHeight: 1.55 }}>⚠ {e.risks}</div>}
    </div>
  )
}

// ── Iniciativas ───────────────────────────────────────────────────────────
export function InitiativesPanel({ initiatives, onCreate, creating, onOpen }: { initiatives: Strategy[]; onCreate: () => void; creating: boolean; onOpen: (id: string) => void }) {
  return (
    <div>
      <button onClick={onCreate} disabled={creating} style={{ padding: '9px 16px', background: 'transparent', border: `1px solid ${BORDER}`, color: ORANGE, fontWeight: 700, fontSize: '12.5px', borderRadius: '9px', cursor: creating ? 'default' : 'pointer', fontFamily: D, marginBottom: '14px' }}>
        {creating ? 'Criando...' : '+ Criar iniciativa'}
      </button>
      {initiatives.length === 0 ? (
        <div style={{ fontSize: '12.5px', color: MUTED }}>Nenhuma iniciativa ainda. Iniciativas são ações específicas que rodam junto com a estratégia principal (ex: uma campanha sazonal, um teste de novo canal).</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {initiatives.map(i => (
            <button key={i.id} onClick={() => onOpen(i.id)} style={{ textAlign: 'left', ...cardBox, cursor: 'pointer', fontFamily: D, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <div><div style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{i.name}</div><div style={{ fontSize: '11px', color: MUTED }}>{i.strategic_focus}</div></div>
              <span style={{ fontSize: '9.5px', fontWeight: 800, color: STATUS_COLOR[i.status] ?? MUTED, flexShrink: 0 }}>● {STATUS_LABEL[i.status] ?? i.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Acompanhamento (reaproveita marketing_ai_strategy_log) ───────────────
export function MonitoringPanel({ log, onReanalyze, reanalyzing }: { log: LogRow[]; onReanalyze: () => void; reanalyzing: boolean }) {
  return (
    <div>
      <button onClick={onReanalyze} disabled={reanalyzing} style={{ padding: '9px 16px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12.5px', border: 'none', borderRadius: '9px', cursor: reanalyzing ? 'default' : 'pointer', fontFamily: D, marginBottom: '14px', opacity: reanalyzing ? 0.7 : 1 }}>
        {reanalyzing ? 'Reavaliando...' : '↻ Reavaliar com dado atual'}
      </button>
      {log.length === 0 ? (
        <div style={{ fontSize: '12.5px', color: MUTED }}>Nenhuma recomendação ainda — clique em "Reavaliar" pra a IA comparar a estratégia com o dado real mais recente.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {log.map(l => (
            <div key={l.id} style={cardBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 800, color: l.status === 'proposed' ? '#FBBF24' : l.status === 'implemented' ? '#4ade80' : MUTED }}>
                  {{ proposed: 'PROPOSTO', approved: 'APROVADO', dismissed: 'DISPENSADO', implemented: 'IMPLEMENTADO' }[l.status] ?? l.status}
                </span>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{timeAgo(l.created_at)}</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>{l.recommendation}</div>
              <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.5 }}>{l.reasoning}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.35)', marginTop: '10px' }}>Essas recomendações também aparecem em Aprendizado (Feedback Loop).</div>
    </div>
  )
}
