import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { useAuth } from '../../../contexts/AuthContext'
import { CARD, MUTED, BORDER, D, SUPABASE_URL } from './shared'
import {
  buildMetaAdsDemo, fmtBRL, fmtNum, AD_STATUS_META, AD_RECO_META, useDemoMode,
  type DemoAdCampaign, type AdRecommendation,
} from './growthDemo'
import DataVeil, { veilMode } from './DataVeil'

interface LiveAds {
  account_name?: string
  totals: { spend: number; revenue: number; roas: number; ctr: number; cpc: number; cpa: number; conversions: number }
  campaigns: { id: string; name: string; objective: string; status: string; spend: number; roas: number; ctr: number; cpc: number; cpa: number }[]
}

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'
const RED = '#f87171'

function roasColor(roas: number): string {
  if (roas >= 3) return GREEN
  if (roas >= 1.5) return '#FBBF24'
  return RED
}

// ── KPI row ─────────────────────────────────────────────────────────────
function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '13px 15px' }}>
      <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '19px', fontWeight: 800, color: color ?? 'white', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}

// ── Campaign row ─────────────────────────────────────────────────────────
function CampaignRow({ c }: { c: DemoAdCampaign }) {
  const st = AD_STATUS_META[c.status]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.8fr 0.7fr 0.7fr 0.8fr', gap: '8px', alignItems: 'center', padding: '11px 14px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '3px' }}>
          <span style={{ fontSize: '9.5px', color: MUTED }}>{c.objective}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: 700, color: st.color }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '99px', background: st.color }} />{st.label}
          </span>
        </div>
      </div>
      <Metric label="Investido" value={fmtBRL(c.spend, true)} />
      <Metric label="ROAS" value={`${c.roas}x`} color={roasColor(c.roas)} />
      <Metric label="CTR" value={`${c.ctr}%`} />
      <Metric label="CPC" value={fmtBRL(c.cpc)} />
      <Metric label="CPA" value={fmtBRL(c.cpa)} />
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '12.5px', fontWeight: 700, color: color ?? 'white' }}>{value}</div>
    </div>
  )
}

// ── Recommendation card ──────────────────────────────────────────────────
function RecoCard({ r, executed, onExecute }: { r: AdRecommendation; executed: boolean; onExecute: () => void }) {
  const meta = AD_RECO_META[r.kind]
  const impactColor = r.impact === 'high' ? RED : r.impact === 'medium' ? '#FBBF24' : MUTED
  return (
    <div style={{ background: CARD, border: `1px solid ${executed ? 'rgba(74,222,128,0.3)' : BORDER}`, borderRadius: '12px', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '5px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>{meta.icon} {r.title}</span>
        <span style={{ fontSize: '9px', fontWeight: 700, color: impactColor, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>{meta.label}</span>
      </div>
      <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55, marginBottom: '12px' }}>{r.description}</div>
      {executed ? (
        <div style={{ fontSize: '11.5px', color: GREEN, lineHeight: 1.5, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '8px', padding: '8px 11px' }}>
          ✓ {r.executedNote}
        </div>
      ) : (
        <button onClick={onExecute}
          style={{ padding: '7px 15px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '11.5px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: D }}>
          Executar recomendação da IA
        </button>
      )}
    </div>
  )
}

export default function MetaAdsTab({ company }: { company: Pick<CompanyData, 'id' | 'business_name'> }) {
  const demo = useMemo(() => buildMetaAdsDemo(company), [company])
  const { session } = useAuth()
  const navigate = useNavigate()
  const [demoMode] = useDemoMode(company.id)
  const [executed, setExecuted] = useState<Set<string>>(new Set())
  const [live, setLive] = useState<LiveAds | null>(null)
  // connected = a conta de anúncios está de fato ligada; apiError = conectada
  // mas a Meta falhou. Juntos definem o estado real (nunca fingir sucesso).
  const [connected, setConnected] = useState(false)
  const [apiError, setApiError] = useState(false)
  const execute = (id: string) => setExecuted(prev => new Set(prev).add(id))

  // Puxa os números REAIS da conta de anúncios (se conectada). Sem conexão ou
  // com erro, NÃO troca por número falso — o layout fica borrado (DataVeil).
  useEffect(() => {
    if (!company.id || !session) return
    let alive = true
    fetch(`${SUPABASE_URL}/functions/v1/meta-ads-insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ company_id: company.id }),
    })
      .then(r => r.json())
      .then(d => {
        if (!alive) return
        // Conectada de verdade? (connected pode vir true com erro de API.)
        setConnected(!!d?.connected)
        if (d?.connected && d.totals && !d.error) { setLive(d as LiveAds); setApiError(false) }
        else if (d?.connected && (d.error || d.expired)) { setApiError(true); console.error('meta-ads-insights:', d.error ?? 'token expirado') }
      })
      .catch((e) => { if (alive) { /* falha de rede: trata como erro só se estava conectada */ console.error('meta-ads-insights fetch falhou:', e) } })
    return () => { alive = false }
  }, [company.id, session])

  // Estado da fonte de dado → decide real / demo / borrado / erro.
  const mode = veilMode({ hasReal: !!live, demoMode, error: connected && apiError })

  // Campanhas reais no formato que a linha de campanha espera.
  const liveCampaigns: DemoAdCampaign[] | null = live
    ? live.campaigns.map(c => ({
        ...c,
        status: (c.status === 'active' ? 'active' : c.status === 'paused' ? 'paused' : 'learning') as DemoAdCampaign['status'],
      } as DemoAdCampaign))
    : null

  const totals = live?.totals ?? demo.totals
  const campaigns = liveCampaigns ?? demo.campaigns

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
      {mode === 'real' && (
        <div style={{ padding: '12px 16px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6 }}>
          🟢 <strong>Dados reais</strong> da sua conta de anúncios{live?.account_name ? ` (${live.account_name})` : ''} — últimos 30 dias. Investido, ROAS, campanhas e conversões vêm direto da Meta. Públicos, criativos e recomendações da IA seguem sendo a leitura do agente; "Executar recomendação" continua passando pela sua aprovação.
        </div>
      )}
      {mode === 'demo' && (
        <div style={{ padding: '12px 16px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6 }}>
          🔵 <strong>Modo demonstração.</strong> Estes números são fictícios, só pra explorar o layout. Conecte sua conta em <strong>Conexões → Meta Ads Manager</strong> pra ver os reais. "Executar recomendação" aqui é uma simulação.
        </div>
      )}

      <DataVeil mode={mode}
        title="Conecte o Meta Ads"
        message="Estes números são um exemplo do layout. Conecte sua conta de anúncios pra ver investido, ROAS e campanhas de verdade — ou ligue o Modo demonstração no topo do Growth OS."
        cta={{ label: 'Conectar Meta Ads', onClick: () => navigate('/dashboard/settings?tab=conexoes') }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
      {/* KPIs agregados */}
      <section>
        <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '11px' }}>Últimos 30 dias</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
          <Kpi label="Investido" value={fmtBRL(totals.spend, true)} />
          <Kpi label="Receita" value={fmtBRL(totals.revenue, true)} />
          <Kpi label="ROAS" value={`${totals.roas}x`} color={roasColor(totals.roas)} />
          <Kpi label="CTR médio" value={`${totals.ctr}%`} />
          <Kpi label="CPC médio" value={fmtBRL(totals.cpc)} />
          <Kpi label="CPA médio" value={fmtBRL(totals.cpa)} />
          <Kpi label="Conversões" value={fmtNum(totals.conversions)} />
        </div>
      </section>

      {/* Campanhas */}
      <section>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '11px' }}>📊 Campanhas</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {campaigns.length === 0
            ? <div style={{ fontSize: '12px', color: MUTED, padding: '14px', textAlign: 'center', border: `1px dashed ${BORDER}`, borderRadius: '10px' }}>Nenhuma campanha ativa na sua conta nos últimos 30 dias.</div>
            : campaigns.map(c => <CampaignRow key={c.id} c={c} />)}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>
        {/* Públicos */}
        <section>
          <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '11px' }}>👥 Públicos que convertem</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {demo.audiences.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 14px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
                <span style={{ fontSize: '12px', color: 'white', fontWeight: 600 }}>{a.name}</span>
                <div style={{ display: 'flex', gap: '14px', flexShrink: 0 }}>
                  <Metric label="CPL" value={fmtBRL(a.cpl)} />
                  <Metric label="Conv." value={fmtNum(a.conversions)} />
                  <Metric label="Share" value={`${a.share}%`} color={ORANGE} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Criativos */}
        <section>
          <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '11px' }}>🎬 Criativos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {demo.creatives.map((c, i) => {
              const st = AD_STATUS_META[c.status]
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 14px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: 'white', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '3px' }}>
                      <span style={{ fontSize: '9.5px', color: MUTED }}>{c.type}</span>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: st.color }}>· {st.label}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '14px', flexShrink: 0 }}>
                    <Metric label="ROAS" value={`${c.roas}x`} color={roasColor(c.roas)} />
                    <Metric label="CTR" value={`${c.ctr}%`} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* Recomendações da IA */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '11px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: 'white' }}>✨ Recomendações da IA</span>
          <span style={{ fontSize: '10.5px', color: MUTED }}>{executed.size}/{demo.recommendations.length} executadas</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
          {demo.recommendations.map(r => (
            <RecoCard key={r.id} r={r} executed={executed.has(r.id)} onExecute={() => execute(r.id)} />
          ))}
        </div>
      </section>
      </div>
      </DataVeil>
    </div>
  )
}
