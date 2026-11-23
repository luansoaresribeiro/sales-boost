// Etapa A2 (dono, 22/11): visão central de custos do Owner. Os números vêm prontos da função api-usage (ação "costs"),
// classificados por _shared/costLedger.ts: medido · preço por uso · estimado · não medido, e FIXO sempre à parte.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import FixedCostForm from './FixedCostForm'

const ORANGE = '#FF6D29'
const BG = '#0E0B0A'
const CARD = '#150E08'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.06)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

type Kinds = { medido: number; preco_por_uso: number; estimado: number }
interface Bucket { key: string; label: string; total: number; kinds: Kinds; rows: number; paidByClient?: boolean }
interface Piece { ref: string; company: string; total: number; ops: { task: string; usd: number; calls: number | null; tokens: number; at: string }[] }
interface Summary {
  variable: { total: number; kinds: Kinds; rows: number }
  fixed: { total: number; items: { item: string; provider: string | null; amount_usd: number }[]; informed: boolean }
  fixedPerActiveClient: number | null
  byCompany: Bucket[]; byFeature: Bucket[]; byOperation: Bucket[]; byAgent: Bucket[]; byProvider: Bucket[]; byDay: Bucket[]
  freeVsPaid: { free: number; paidByClient: number }
  byPiece: Piece[]
}
interface Report { period: { label: string; since: string; until: string }; summary: Summary; fixed_rows: { month: string; item: string; amount_usd: number; source: string }[]; not_measured: { fn: string; provider: string; what: string }[]; generated_at: string }

const KIND_META: { key: keyof Kinds; label: string; color: string; hint: string }[] = [
  { key: 'medido', label: 'Medido', color: '#4ade80', hint: 'tokens reais da Anthropic × tabela de preço' },
  { key: 'preco_por_uso', label: 'Preço por uso', color: '#60a5fa', hint: 'preço de lista por chamada (Tavily, imagem, vídeo do tour)' },
  { key: 'estimado', label: 'Estimado', color: '#FBBF24', hint: 'valor fixo antigo, sem medição (estratégia antes de 10/11)' },
]
const usd = (n: number) => `US$ ${n < 0.1 && n > 0 ? n.toFixed(4) : n.toFixed(2)}`
const card = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }
const h2 = { fontFamily: D, fontSize: '15px', fontWeight: 700, margin: '0 0 10px' }

function KindBar({ k, total }: { k: Kinds; total: number }) {
  return (
    <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', minWidth: '60px' }}>
      {total > 0 && KIND_META.map(m => k[m.key] > 0 && <div key={m.key} title={`${m.label}: ${usd(k[m.key])}`} style={{ width: `${(k[m.key] / total) * 100}%`, background: m.color }} />)}
    </div>
  )
}

function Table({ title, rows, total, note }: { title: string; rows: Bucket[]; total: number; note?: string }) {
  return (
    <div style={card}>
      <h2 style={h2}>{title}</h2>
      {note && <p style={{ fontSize: '11px', color: MUTED, margin: '-4px 0 10px' }}>{note}</p>}
      {rows.length === 0 ? <p style={{ fontSize: '12px', color: MUTED }}>Nenhum custo registrado no período.</p> : (
        <div style={{ display: 'grid', gap: '8px' }}>
          {rows.map(b => (
            <div key={b.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 70px 88px', gap: '10px', alignItems: 'center', fontSize: '12.5px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.label}>
                  {b.label}{b.paidByClient && <span style={{ marginLeft: '6px', fontSize: '10px', color: ORANGE }}>pago pelo cliente</span>}
                </div>
                <div style={{ fontSize: '10.5px', color: MUTED }}>{b.rows} registro{b.rows === 1 ? '' : 's'} · {total > 0 ? Math.round((b.total / total) * 100) : 0}%</div>
              </div>
              <KindBar k={b.kinds} total={b.total} />
              <div style={{ textAlign: 'right', fontWeight: 700 }}>{usd(b.total)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function OwnerCostsPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [period, setPeriod] = useState<string>('30')
  const [data, setData] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true); setError(null)
    try {
      const body = /^\d{4}-\d{2}$/.test(period) ? { action: 'costs', month: period } : { action: 'costs', days: Number(period) }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/api-usage`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok || !j.ok) throw new Error(j.error ?? `Erro ${res.status}`)
      setData(j as Report)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [session, period])
  useEffect(() => { void load() }, [load])

  const thisMonth = new Date().toISOString().slice(0, 7)
  const lastMonth = (() => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7) })()
  const s = data?.summary
  const maxDay = Math.max(0.0001, ...(s?.byDay ?? []).map(d => d.total))

  return (
    <div style={{ minHeight: '100vh', background: BG, color: 'white' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px 16px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => navigate('/owner')} style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: '15px', cursor: 'pointer' }}>← Voltar</button>
            <h1 style={{ fontFamily: D, fontSize: '22px', margin: 0 }}>💲 Custos</h1>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[['7', '7 dias'], ['30', '30 dias'], ['90', '90 dias'], [thisMonth, 'Este mês'], [lastMonth, 'Mês passado']].map(([v, l]) => (
              <button key={v} onClick={() => setPeriod(v)} style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', border: `1px solid ${period === v ? ORANGE : BORDER}`, background: period === v ? 'rgba(255,109,41,0.12)' : 'transparent', color: period === v ? ORANGE : MUTED }}>{l}</button>
            ))}
          </div>
        </div>

        {error && <div style={{ ...card, borderColor: 'rgba(248,113,113,0.4)', color: '#f87171', marginBottom: '12px' }}>Não foi possível carregar os custos: {error}</div>}
        {loading && !data && <div style={{ color: MUTED, padding: '40px 0', textAlign: 'center' }}>Carregando custos…</div>}

        {s && data && (
          <div style={{ display: 'grid', gap: '12px', opacity: loading ? 0.6 : 1 }}>
            <p style={{ fontSize: '12px', color: MUTED, margin: 0 }}>
              Período: {data.period.label} ({data.period.since.slice(0, 10)} a {data.period.until.slice(0, 10)}). Variável = o que cada uso custa; fixo = o que a plataforma paga todo mês, informado por você. Os dois nunca são somados sem aviso.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
              <div style={card}>
                <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase' }}>Variável no período</div>
                <div style={{ fontFamily: D, fontSize: '24px', fontWeight: 800 }}>{usd(s.variable.total)}</div>
                <div style={{ fontSize: '11px', color: MUTED }}>{s.variable.rows} registros · {s.byCompany.length} conta(s)</div>
              </div>
              {KIND_META.map(m => (
                <div key={m.key} style={card} title={m.hint}>
                  <div style={{ fontSize: '10px', color: m.color, textTransform: 'uppercase' }}>{m.label}</div>
                  <div style={{ fontFamily: D, fontSize: '20px', fontWeight: 800 }}>{usd(s.variable.kinds[m.key])}</div>
                  <div style={{ fontSize: '11px', color: MUTED }}>{m.hint}</div>
                </div>
              ))}
              <div style={card}>
                <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase' }}>Fixo (meses do período)</div>
                <div style={{ fontFamily: D, fontSize: '20px', fontWeight: 800 }}>{s.fixed.informed ? usd(s.fixed.total) : 'não informado'}</div>
                <div style={{ fontSize: '11px', color: MUTED }}>{s.fixedPerActiveClient != null ? `Rateio: ${usd(s.fixedPerActiveClient)} por conta com uso (divisão, não medido)` : 'Informe abaixo (VPS, Supabase…)'}</div>
              </div>
            </div>

            <div style={{ ...card, display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '13px' }}>
              <div>Grátis para o cliente (nós pagamos): <b>{usd(s.freeVsPaid.free)}</b></div>
              <div>Em funções pagas pelo cliente (tour, mobiliado): <b>{usd(s.freeVsPaid.paidByClient)}</b></div>
            </div>

            <div style={card}>
              <h2 style={h2}>Evolução diária (variável)</h2>
              {s.byDay.length === 0 ? <p style={{ fontSize: '12px', color: MUTED }}>Sem custo no período.</p> : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '110px', overflowX: 'auto' }}>
                  {s.byDay.map(d => (
                    <div key={d.key} title={`${d.key}: ${usd(d.total)}`} style={{ flex: '1 0 8px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                      {KIND_META.map(m => d.kinds[m.key] > 0 && <div key={m.key} style={{ height: `${(d.kinds[m.key] / maxDay) * 100}%`, background: m.color, minHeight: '1px' }} />)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
              <Table title="Por cliente" rows={s.byCompany} total={s.variable.total} note="Só variável. O fixo fica à parte (rateio acima)." />
              <Table title="Por funcionalidade" rows={s.byFeature} total={s.variable.total} />
              <Table title="Por operação" rows={s.byOperation} total={s.variable.total} />
              <Table title="Por provedor" rows={s.byProvider} total={s.variable.total} />
              <Table title="Por agente" rows={s.byAgent} total={s.variable.total} />
            </div>

            <div style={card}>
              <h2 style={h2}>Custo por peça (últimas, medidas desde 22/11)</h2>
              {s.byPiece.length === 0 ? <p style={{ fontSize: '12px', color: MUTED }}>Ainda nenhuma operação ligada a uma peça no período.</p> : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {s.byPiece.map(p => (
                    <div key={p.ref} style={{ fontSize: '12px', borderTop: `1px solid ${BORDER}`, paddingTop: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ color: MUTED }}>{p.company} · peça {p.ref.slice(0, 8)}</span><b>{usd(p.total)}</b>
                      </div>
                      <div style={{ color: MUTED, fontSize: '11px' }}>{p.ops.map(o => `${o.task}: ${usd(o.usd)} (${o.calls ?? '?'} chamada${o.calls === 1 ? '' : 's'}, ${o.tokens.toLocaleString('pt-BR')} tokens)`).join(' + ')}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={card}>
              <h2 style={h2}>Não medido (ainda sem registro de custo)</h2>
              <p style={{ fontSize: '11px', color: MUTED, margin: '-4px 0 10px' }}>Estas funções chamam serviço pago e ainda não gravam o custo. Nenhum valor é inventado: elas ficam fora dos totais acima.</p>
              <div style={{ display: 'grid', gap: '4px', fontSize: '12px' }}>
                {data.not_measured.map(x => <div key={x.fn}><b>{x.what}</b> <span style={{ color: MUTED }}>· {x.fn} · {x.provider}</span></div>)}
              </div>
            </div>

            <FixedCostForm rows={data.fixed_rows} accessToken={session?.access_token ?? ''} onSaved={load} />
          </div>
        )}
      </div>
    </div>
  )
}
