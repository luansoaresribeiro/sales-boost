import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { MODE_META, type AiMode } from './CompanyAiControl'

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.06)'
const GREEN = '#4ade80'

const COST_PER_1K = 0.006 // igual ao backend (ESTIMATED_COST_PER_1K_TOKENS)

const AGENT_LABEL: Record<string, string> = { marketing: 'Agente Geral', hermes: 'Orquestrador', sales: 'Vendas', imagem: 'Geração de Imagem' }
const agentLabel = (r: string | null) => AGENT_LABEL[r ?? ''] ?? (r ?? 'Agente')

// cost_usd é custo real não-baseado em token (hoje só geração de imagem) —
// soma direto ao custo estimado de tokens, mesma linha do tempo/agente.
interface PerfRow { agent_role: string | null; tokens_used: number | null; cost_usd: number | null; success: boolean | null; created_at: string }
const rowCost = (r: PerfRow) => ((Number(r.tokens_used) || 0) / 1000) * COST_PER_1K + (Number(r.cost_usd) || 0)

function fmtTokens(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n) }
function fmtUsd(n: number) { return `US$ ${n.toFixed(2)}` }

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '12px 14px' }}>
      <div style={{ fontSize: '9.5px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>{label}</div>
      <div style={{ fontSize: '18px', fontWeight: 800, color: accent ?? 'white' }}>{value}</div>
      {sub && <div style={{ fontSize: '10px', color: MUTED, marginTop: '2px' }}>{sub}</div>}
    </div>
  )
}

export default function CompanyAiUsage({ companyId, plan }: { companyId: string; plan: string }) {
  const [rows, setRows] = useState<PerfRow[]>([])
  const [monthlyBudget, setMonthlyBudget] = useState(0)
  const [mode, setMode] = useState<AiMode>('balanced')
  const [freqMin, setFreqMin] = useState(120)
  const [lastCycleAt, setLastCycleAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const planKey = (plan || 'free').toLowerCase()
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0)
    Promise.all([
      supabase.from('plan_ai_defaults').select('mode, monthly_budget_usd, think_frequency_min').eq('plan', planKey).maybeSingle(),
      supabase.from('company_ai_settings').select('mode, monthly_budget_usd, think_frequency_min, last_cycle_at').eq('company_id', companyId).maybeSingle(),
      supabase.from('agent_performance').select('agent_role, tokens_used, cost_usd, success, created_at').eq('company_id', companyId).gte('created_at', monthStart.toISOString()).order('created_at', { ascending: false }).limit(2000),
    ]).then(([planRes, coRes, perfRes]) => {
      const pd = (planRes.data ?? {}) as { mode?: AiMode; monthly_budget_usd?: number; think_frequency_min?: number }
      const co = (coRes.data ?? null) as { mode?: AiMode | null; monthly_budget_usd?: number | null; think_frequency_min?: number | null; last_cycle_at?: string | null } | null
      const m = (co?.mode ?? pd.mode ?? 'balanced') as AiMode
      setMode(m)
      setMonthlyBudget(Number(co?.monthly_budget_usd ?? pd.monthly_budget_usd ?? 0) || 0)
      setFreqMin(Number(co?.think_frequency_min ?? pd.think_frequency_min ?? MODE_META[m]?.freq ?? 120))
      setLastCycleAt(co?.last_cycle_at ?? null)
      setRows((perfRes.data as PerfRow[] | null) ?? [])
      setLoading(false)
    })
  }, [companyId, plan])

  const stats = useMemo(() => {
    const totalTokens = rows.reduce((s, r) => s + (Number(r.tokens_used) || 0), 0)
    const totalCost = rows.reduce((s, r) => s + rowCost(r), 0)
    const successes = rows.filter(r => r.success).length
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayTokens = rows.filter(r => new Date(r.created_at) >= todayStart).reduce((s, r) => s + (Number(r.tokens_used) || 0), 0)

    const byAgent = new Map<string, { cost: number; calls: number }>()
    rows.forEach(r => {
      const k = r.agent_role ?? 'outro'
      const e = byAgent.get(k) ?? { cost: 0, calls: 0 }
      e.cost += rowCost(r); e.calls += 1; byAgent.set(k, e)
    })
    const agents = [...byAgent.entries()].map(([role, e]) => ({ role, cost: e.cost, calls: e.calls }))
      .sort((a, b) => b.cost - a.cost)

    // Tendência dos últimos 14 dias (custo por dia).
    const days: { label: string; cost: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i)
      const next = new Date(d); next.setDate(d.getDate() + 1)
      const cost = rows.filter(r => { const t = new Date(r.created_at); return t >= d && t < next }).reduce((s, r) => s + rowCost(r), 0)
      days.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, cost })
    }

    const lastExec = rows.length ? rows[0].created_at : null
    return { totalTokens, totalCost, successes, todayTokens, agents, days, lastExec, calls: rows.length }
  }, [rows])

  if (loading) return <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '22px', marginBottom: '20px', color: MUTED, fontSize: '13px' }}>Carregando uso da IA…</div>

  const unlimited = monthlyBudget <= 0
  const pctUsed = unlimited ? 0 : Math.min(100, (stats.totalCost / monthlyBudget) * 100)
  const remaining = unlimited ? 0 : Math.max(0, monthlyBudget - stats.totalCost)
  const barColor = pctUsed >= 90 ? '#f87171' : pctUsed >= 70 ? '#FBBF24' : GREEN
  const resetDate = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 1).toLocaleDateString('pt-BR') })()
  const nextScheduled = lastCycleAt ? new Date(new Date(lastCycleAt).getTime() + freqMin * 60000) : null
  const costPerResult = stats.successes > 0 ? stats.totalCost / stats.successes : 0
  const maxDay = Math.max(...stats.days.map(d => d.cost), 0.0001)

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '22px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>📊 Uso da IA (ao vivo)</div>
        <span style={{ fontSize: '9.5px', fontWeight: 700, color: ORANGE, background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.3)', borderRadius: '99px', padding: '2px 9px' }}>
          {MODE_META[mode]?.icon} {MODE_META[mode]?.label ?? mode}
        </span>
      </div>
      <div style={{ fontSize: '11px', color: MUTED, marginBottom: '18px', lineHeight: 1.5 }}>Consumo real deste mês, calculado das execuções do agente. Reseta em {resetDate}.</div>

      {/* Barra de orçamento */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
          <span style={{ fontSize: '12px', color: 'white', fontWeight: 700 }}>
            {unlimited ? 'Orçamento ilimitado' : `${pctUsed.toFixed(0)}% do orçamento`}
          </span>
          <span style={{ fontSize: '11px', color: MUTED }}>{fmtUsd(stats.totalCost)}{unlimited ? '' : ` / ${fmtUsd(monthlyBudget)}`}</span>
        </div>
        <div style={{ height: '10px', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{ width: `${unlimited ? 100 : pctUsed}%`, height: '100%', background: unlimited ? 'rgba(255,255,255,0.2)' : barColor, borderRadius: '99px' }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '9px', marginBottom: '18px' }}>
        <Stat label="Custo do mês" value={fmtUsd(stats.totalCost)} accent={ORANGE} />
        <Stat label="Tokens (mês)" value={fmtTokens(stats.totalTokens)} sub={`${stats.calls} execuções`} />
        <Stat label="Restante" value={unlimited ? '∞' : fmtUsd(remaining)} />
        <Stat label="Hoje" value={fmtTokens(stats.todayTokens)} sub="tokens" />
        <Stat label="Custo por resultado" value={costPerResult > 0 ? fmtUsd(costPerResult) : '—'} sub={`${stats.successes} entregas`} />
      </div>

      {/* Scheduler */}
      <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', padding: '11px 14px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '10px', marginBottom: '18px', fontSize: '11.5px' }}>
        <div><span style={{ color: MUTED }}>Última execução: </span><span style={{ color: 'white' }}>{stats.lastExec ? new Date(stats.lastExec).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</span></div>
        <div><span style={{ color: MUTED }}>Próxima: </span><span style={{ color: 'white' }}>{nextScheduled ? (nextScheduled.getTime() < Date.now() ? 'no próximo ciclo' : nextScheduled.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) : 'no próximo ciclo'}</span></div>
        <div><span style={{ color: MUTED }}>Frequência: </span><span style={{ color: 'white' }}>a cada {freqMin >= 60 ? `${freqMin / 60}h` : `${freqMin}min`}</span></div>
      </div>

      {stats.calls === 0 ? (
        <div style={{ fontSize: '12.5px', color: MUTED, textAlign: 'center', padding: '18px 0' }}>Sem consumo de IA registrado neste mês ainda.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
          {/* Por agente */}
          <div>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Custo por agente</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.agents.map((a, i) => {
                const w = stats.agents[0].cost > 0 ? (a.cost / stats.agents[0].cost) * 100 : 0
                return (
                  <div key={a.role}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '3px' }}>
                      <span style={{ color: 'white' }}>{agentLabel(a.role)} {i === 0 && <span style={{ fontSize: '8.5px', color: '#FBBF24', fontWeight: 700 }}>⬆ mais caro</span>}</span>
                      <span style={{ color: MUTED }}>{fmtUsd(a.cost)}</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ width: `${w}%`, height: '100%', background: ORANGE, borderRadius: '99px' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tendência 14 dias */}
          <div>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Custo por dia (14 dias)</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '70px' }}>
              {stats.days.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }} title={`${d.label}: ${fmtUsd(d.cost)}`}>
                  <div style={{ width: '100%', height: `${Math.max((d.cost / maxDay) * 100, 2)}%`, background: d.cost > 0 ? 'rgba(255,109,41,0.7)' : 'rgba(255,255,255,0.06)', borderRadius: '3px 3px 0 0' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: MUTED, marginTop: '4px' }}>
              <span>{stats.days[0]?.label}</span><span>hoje</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
