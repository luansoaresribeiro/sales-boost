// Resumo dos 3 dias do trial + conversão. Serve duas situações: dia 3 (o
// cliente ainda está no trial, vendo o valor acumulado) e trial expirado
// (mesma tela, deixando claro que nada foi apagado). Métricas sempre reais
// — nunca mostra um número que não veio de uma contagem de verdade.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useCompany } from '../../contexts/CompanyContext'
import { supabase } from '../../lib/supabase'
import { getTrialInfo, formatExpiresAt } from '../../lib/trialState'
import { CARD, MUTED, BORDER, ORANGE, D, SUPABASE_URL } from './marketingAi/shared'

const PLAN_PRICE_BR = 'R$14,49'
const PLAN_PRICE_US = '$2.99'

interface Metrics {
  opportunities: number
  contentCreated: number
  competitorsAnalyzed: number
  actionsCompleted: number
  gpEarned: number
}
interface OpenOpportunity { id: string; title: string; value_estimate: number | null }

export default function TrialSummaryPage() {
  const { company } = useCompany()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [openOpps, setOpenOpps] = useState<OpenOpportunity[]>([])
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')

  const info = getTrialInfo(company)

  useEffect(() => {
    if (!company?.id) return
    let alive = true
    ;(async () => {
      const [{ count: opportunities }, { count: contentCreated }, { count: competitorsAnalyzed }, { data: events }, { data: opps }] = await Promise.all([
        supabase.from('opportunities').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('competitors').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('progress_events').select('gp').eq('company_id', company.id),
        supabase.from('opportunities').select('id, title, value_estimate').eq('company_id', company.id).eq('status', 'open').order('value_estimate', { ascending: false, nullsFirst: false }).limit(3),
      ])
      if (!alive) return
      setMetrics({
        opportunities: opportunities ?? 0,
        contentCreated: contentCreated ?? 0,
        competitorsAnalyzed: competitorsAnalyzed ?? 0,
        actionsCompleted: (events ?? []).length,
        gpEarned: (events ?? []).reduce((s, e) => s + (e.gp ?? 0), 0),
      })
      setOpenOpps((opps ?? []) as OpenOpportunity[])
    })()
    return () => { alive = false }
  }, [company?.id])

  useEffect(() => {
    if (!company?.id || info.state !== 'trial_day_3') return
    void supabase.from('progress_events').insert({
      company_id: company.id, event_type: 'trial_completed', gp: 50, source: 'trial', dedupe_key: `trial_completed:${company.id}`,
    })
  }, [company?.id, info.state])

  const startCheckout = async () => {
    if (!session) return
    setCheckoutLoading(true)
    setCheckoutError('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'pro',
          success_url: `${window.location.origin}/dashboard?upgrade=success`,
          cancel_url: `${window.location.origin}/dashboard/trial`,
        }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Erro ao iniciar assinatura')
      window.location.href = data.url
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : String(e))
      setCheckoutLoading(false)
    }
  }

  if (!company) return <div style={{ padding: '40px', color: MUTED, fontFamily: D }}>Carregando…</div>
  if (info.state === 'subscribed') {
    navigate('/dashboard', { replace: true })
    return null
  }

  const isExpired = info.isBlocked

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '32px 24px', fontFamily: D, display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
          {isExpired ? 'Seu trial terminou' : '🏆 Seus primeiros 3 dias com o SalesBoost'}
        </div>
        <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          {isExpired ? 'Seu negócio já começou a progredir.' : 'Seu negócio já começou a progredir.'}
        </h1>
        <p style={{ fontSize: '13.5px', color: MUTED, lineHeight: 1.6, marginTop: '10px', maxWidth: '560px' }}>
          {isExpired
            ? 'O trial acabou, mas nada foi apagado — todo o progresso, as descobertas e as conquistas do seu Business Game continuam guardados. É só continuar de onde parou.'
            : 'Veja o que o SalesBoost já fez pelo seu negócio nesses 3 dias, com dados reais.'}
        </p>
      </div>

      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          <MetricCard icon="💡" value={metrics.opportunities} label="oportunidades descobertas" />
          <MetricCard icon="✍️" value={metrics.contentCreated} label="conteúdos criados" />
          <MetricCard icon="🔍" value={metrics.competitorsAnalyzed} label="concorrentes analisados" />
          <MetricCard icon="⚡" value={metrics.actionsCompleted} label="ações de crescimento" />
          <MetricCard icon="🟢" value={metrics.gpEarned} label="XP ganhos" color="#4ade80" prefix="+" />
        </div>
      )}

      {openOpps.length > 0 && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '20px 22px' }}>
          <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white', marginBottom: '12px' }}>O que ainda está esperando por você</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {openOpps.map(o => (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', gap: '10px' }}>
                <span style={{ fontSize: '12.5px', color: 'white' }}>{o.title}</span>
                {o.value_estimate != null && <span style={{ fontSize: '12px', fontWeight: 700, color: '#4ade80', flexShrink: 0 }}>R$ {o.value_estimate.toLocaleString('pt-BR')}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: `linear-gradient(180deg, ${CARD}, #100b07)`, border: '1px solid rgba(255,109,41,0.3)', borderRadius: '16px', padding: '26px' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '8px' }}>Continue o progresso do seu negócio</div>
        <div style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.6, marginBottom: '18px' }}>
          {info.expiresAt && !isExpired && `Seu trial termina em ${formatExpiresAt(info.expiresAt)}. `}
          Continue com o SalesBoost por <strong style={{ color: 'white' }}>{PLAN_PRICE_BR}/mês</strong> ({PLAN_PRICE_US}/mo) e o Agente segue analisando, criando conteúdo e encontrando oportunidades — sem interrupção no seu progresso.
        </div>
        {checkoutError && <div style={{ fontSize: '12px', color: '#f87171', marginBottom: '12px' }}>{checkoutError}</div>}
        <button onClick={startCheckout} disabled={checkoutLoading}
          style={{ padding: '14px 24px', background: ORANGE, color: '#000', fontWeight: 800, fontSize: '13.5px', border: 'none', borderRadius: '11px', cursor: checkoutLoading ? 'wait' : 'pointer' }}>
          {checkoutLoading ? 'Abrindo checkout...' : `Continuar com o SalesBoost — ${PLAN_PRICE_BR}/mês →`}
        </button>
      </div>
    </div>
  )
}

function MetricCard({ icon, value, label, color, prefix }: { icon: string; value: number; label: string; color?: string; prefix?: string }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
      <div style={{ fontSize: '16px', marginBottom: '6px' }}>{icon}</div>
      <div style={{ fontSize: '22px', fontWeight: 900, color: color ?? 'white' }}>{prefix ?? ''}{value}</div>
      <div style={{ fontSize: '10.5px', color: MUTED, marginTop: '2px' }}>{label}</div>
    </div>
  )
}
