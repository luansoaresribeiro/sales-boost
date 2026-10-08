// Resumo do trial (7 dias nos novos; 3 nos antigos) + conversão. Serve duas situações: último dia (o
// cliente ainda está no trial, vendo o valor acumulado) e trial expirado
// (mesma tela, deixando claro que nada foi apagado). Métricas sempre reais
// — nunca mostra um número que não veio de uma contagem de verdade.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useCompany } from '../../contexts/CompanyContext'
import { supabase } from '../../lib/supabase'
import { getTrialInfo, TRIAL_DAYS } from '../../lib/trialState'
import { useLang } from '../../contexts/LanguageContext'
import TrialVideoPreviews from './TrialVideoPreviews'
import { CARD, MUTED, BORDER, ORANGE, D, SUPABASE_URL } from './marketingAi/shared'

const PLAN_PRICE_BR = 'R$14,49'
const PLAN_PRICE_US = '$2.99'

const TX = {
  pt: {
    loading: 'Carregando…', checkoutErr: 'Erro ao iniciar assinatura',
    endedTag: 'Seu trial terminou', firstDays: (n: number) => `🏆 Seus primeiros ${n} dias com o SalesBoost`,
    h1: 'Seu negócio já começou a progredir.',
    endedP: 'O trial acabou, mas nada foi apagado — todo o progresso, as descobertas e as conquistas do seu Business Game continuam guardados. É só continuar de onde parou.',
    activeP: (n: number) => `Veja o que o SalesBoost já fez pelo seu negócio nesses ${n} dias, com dados reais.`,
    mOpps: 'oportunidades descobertas', mContent: 'conteúdos criados', mComp: 'concorrentes analisados', mActions: 'ações de crescimento', mXp: 'XP ganhos',
    bStrat: 'Estratégia do Hermes', bAnalysis: 'Análise do negócio e do mercado',
    analysisN: (n: number) => `${n} ${n === 1 ? 'análise pronta' : 'análises prontas'}`,
    bComp: 'Concorrentes', compN: (n: number) => `${n} ${n === 1 ? 'concorrente' : 'concorrentes'}`,
    bIdeas: 'Oportunidades de conteúdo', ideasN: (n: number) => `${n} ${n === 1 ? 'ideia' : 'ideias'}`,
    bPlan: 'Plano de ação', planN: (n: number) => `${n} ${n === 1 ? 'iniciativa' : 'iniciativas'}`,
    bTg: 'Inteligência no Telegram', tgOn: 'Conectado', tgOff: 'Ainda não conectado', see: 'Ver →', connect: 'Conectar →',
    bResults: 'Resultados esperados', resultsV: (total: string, n: number) => `R$ ${total} em ${n} ${n === 1 ? 'oportunidade' : 'oportunidades'}`,
    estimate: 'Estimativa — não é garantia', waiting: 'O que ainda está esperando por você',
    contT: 'Continue o progresso do seu negócio', endsOn: (d: string) => `Seu trial termina em ${d}. `,
    contB1: 'Continue com o SalesBoost por ', perMonth: '/mês',
    contB2: ' e o Agente segue analisando, criando conteúdo e encontrando oportunidades — sem interrupção no seu progresso.',
    opening: 'Abrindo checkout...', contBtn: (p: string) => `Continuar com o SalesBoost — ${p}/mês →`,
    analyzing: 'Hermes ainda está analisando', open: 'Abrir →',
  },
  en: {
    loading: 'Loading…', checkoutErr: 'Error starting subscription',
    endedTag: 'Your trial has ended', firstDays: (n: number) => `🏆 Your first ${n} days with SalesBoost`,
    h1: 'Your business has already started to grow.',
    endedP: 'The trial is over, but nothing was deleted — all your progress, discoveries and Business Game achievements are safe. Just pick up where you left off.',
    activeP: (n: number) => `See what SalesBoost has already done for your business in these ${n} days, with real data.`,
    mOpps: 'opportunities found', mContent: 'content pieces created', mComp: 'competitors analyzed', mActions: 'growth actions', mXp: 'XP earned',
    bStrat: "Hermes' strategy", bAnalysis: 'Business and market analysis',
    analysisN: (n: number) => `${n} ${n === 1 ? 'analysis ready' : 'analyses ready'}`,
    bComp: 'Competitors', compN: (n: number) => `${n} ${n === 1 ? 'competitor' : 'competitors'}`,
    bIdeas: 'Content opportunities', ideasN: (n: number) => `${n} ${n === 1 ? 'idea' : 'ideas'}`,
    bPlan: 'Action plan', planN: (n: number) => `${n} ${n === 1 ? 'initiative' : 'initiatives'}`,
    bTg: 'Telegram intelligence', tgOn: 'Connected', tgOff: 'Not connected yet', see: 'View →', connect: 'Connect →',
    bResults: 'Expected results', resultsV: (total: string, n: number) => `R$ ${total} across ${n} ${n === 1 ? 'opportunity' : 'opportunities'}`,
    estimate: 'Estimate — not a guarantee', waiting: 'Still waiting for you',
    contT: "Keep your business's progress going", endsOn: (d: string) => `Your trial ends on ${d}. `,
    contB1: 'Continue with SalesBoost for ', perMonth: '/month',
    contB2: ' and the Agent keeps analyzing, creating content and finding opportunities — with no interruption to your progress.',
    opening: 'Opening checkout...', contBtn: (p: string) => `Continue with SalesBoost — ${p}/month →`,
    analyzing: 'Hermes is still analyzing', open: 'Open →',
  },
} as const

interface Metrics {
  opportunities: number
  contentCreated: number
  competitorsAnalyzed: number
  actionsCompleted: number
  gpEarned: number
}
interface Panel {
  strategyName: string | null
  analysisReports: number
  ideas: number
  initiatives: number
  telegramConnected: boolean
  estimateTotal: number | null
  estimateCount: number
}
interface OpenOpportunity { id: string; title: string; value_estimate: number | null }

export default function TrialSummaryPage() {
  const { company } = useCompany()
  const { lang } = useLang()
  const tx = TX[lang]
  const loc = lang === 'en' ? 'en-US' : 'pt-BR'
  const { session } = useAuth()
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [panel, setPanel] = useState<Panel | null>(null)
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

  // Painel do trial: só contagens reais; vazio vira "Hermes ainda está analisando".
  useEffect(() => {
    if (!company?.id) return
    let alive = true
    ;(async () => {
      const [{ data: strat }, { count: reports }, { count: diags }, { count: ideas }, { data: co }, { data: vals }] = await Promise.all([
        supabase.from('marketing_ai_strategies').select('id, name').eq('company_id', company.id).eq('kind', 'main').eq('status', 'active').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('insights_reports').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('diagnostics').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('marketing_ai_ideas').select('id', { count: 'exact', head: true }).eq('company_id', company.id).neq('status', 'dismissed'),
        supabase.from('companies').select('telegram_chat_id').eq('id', company.id).maybeSingle(),
        supabase.from('opportunities').select('value_estimate').eq('company_id', company.id).eq('status', 'open').not('value_estimate', 'is', null),
      ])
      let initiatives = 0
      if (strat?.id) {
        const { count } = await supabase.from('marketing_ai_strategies').select('id', { count: 'exact', head: true }).eq('parent_strategy_id', strat.id)
        initiatives = count ?? 0
      }
      if (!alive) return
      const nums = (vals ?? []).map(v => v.value_estimate as number).filter(n => typeof n === 'number' && n > 0)
      setPanel({
        strategyName: strat?.name ?? null,
        analysisReports: (reports ?? 0) + (diags ?? 0),
        ideas: ideas ?? 0,
        initiatives,
        telegramConnected: !!co?.telegram_chat_id,
        estimateTotal: nums.length ? nums.reduce((a, b) => a + b, 0) : null,
        estimateCount: nums.length,
      })
    })()
    return () => { alive = false }
  }, [company?.id])

  useEffect(() => {
    if (!company?.id || !info.isTrial || !(info.state === 'trial_expiring' || (info.dayNumber != null && info.dayNumber === info.totalDays))) return
    void supabase.from('progress_events').insert({
      company_id: company.id, event_type: 'trial_completed', gp: 50, source: 'trial', dedupe_key: `trial_completed:${company.id}`,
    })
  }, [company?.id, info.state, info.dayNumber, info.totalDays, info.isTrial])

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
      if (!res.ok || !data.url) throw new Error(data.error ?? tx.checkoutErr)
      window.location.href = data.url
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : String(e))
      setCheckoutLoading(false)
    }
  }

  if (!company) return <div style={{ padding: '40px', color: MUTED, fontFamily: D }}>{tx.loading}</div>
  if (info.state === 'subscribed') {
    navigate('/dashboard', { replace: true })
    return null
  }

  const isExpired = info.isBlocked

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '32px 16px', fontFamily: D, display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
          {isExpired ? tx.endedTag : tx.firstDays(info.totalDays ?? TRIAL_DAYS)}
        </div>
        <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          {tx.h1}
        </h1>
        <p style={{ fontSize: '13.5px', color: MUTED, lineHeight: 1.6, marginTop: '10px', maxWidth: '560px' }}>
          {isExpired
            ? tx.endedP
            : tx.activeP(info.totalDays ?? TRIAL_DAYS)}
        </p>
      </div>

      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          <MetricCard icon="💡" value={metrics.opportunities} label={tx.mOpps} />
          <MetricCard icon="✍️" value={metrics.contentCreated} label={tx.mContent} />
          <MetricCard icon="🔍" value={metrics.competitorsAnalyzed} label={tx.mComp} />
          <MetricCard icon="⚡" value={metrics.actionsCompleted} label={tx.mActions} />
          <MetricCard icon="🟢" value={metrics.gpEarned} label={tx.mXp} color="#4ade80" prefix="+" />
        </div>
      )}

      {panel && metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
          <PanelBlock icon="🧠" title={tx.bStrat} value={panel.strategyName} to="/dashboard/marketing-ai/estrategia" />
          <PanelBlock icon="📊" title={tx.bAnalysis} value={panel.analysisReports > 0 ? tx.analysisN(panel.analysisReports) : null} to="/dashboard/insights" />
          <PanelBlock icon="🔍" title={tx.bComp} value={metrics.competitorsAnalyzed > 0 ? tx.compN(metrics.competitorsAnalyzed) : null} to="/dashboard/marketing-ai/dados" />
          <PanelBlock icon="💡" title={tx.bIdeas} value={panel.ideas > 0 ? tx.ideasN(panel.ideas) : null} to="/dashboard/marketing-ai/content" />
          <PanelBlock icon="✅" title={tx.bPlan} value={panel.initiatives > 0 ? tx.planN(panel.initiatives) : null} to="/dashboard/marketing-ai/estrategia" />
          <PanelBlock icon="✈️" title={tx.bTg} value={panel.telegramConnected ? tx.tgOn : tx.tgOff} to="/dashboard/settings?tab=integracoes" cta={panel.telegramConnected ? tx.see : tx.connect} />
          {panel.estimateTotal != null && (
            <PanelBlock icon="📈" title={tx.bResults} value={tx.resultsV(panel.estimateTotal.toLocaleString(loc), panel.estimateCount)} note={tx.estimate} to="/dashboard/oportunidades" />
          )}
        </div>
      )}

      {info.isTrial && <TrialVideoPreviews companyId={company.id} verticalKey={company.vertical_key} />}

      {openOpps.length > 0 && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '20px 22px' }}>
          <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white', marginBottom: '12px' }}>{tx.waiting}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {openOpps.map(o => (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', gap: '10px' }}>
                <span style={{ fontSize: '12.5px', color: 'white' }}>{o.title}</span>
                {o.value_estimate != null && <span style={{ fontSize: '12px', fontWeight: 700, color: '#4ade80', flexShrink: 0 }}>R$ {o.value_estimate.toLocaleString(loc)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: `linear-gradient(180deg, ${CARD}, #100b07)`, border: '1px solid rgba(255,109,41,0.3)', borderRadius: '16px', padding: '26px' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '8px' }}>{tx.contT}</div>
        <div style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.6, marginBottom: '18px' }}>
          {info.expiresAt && !isExpired && tx.endsOn(info.expiresAt.toLocaleString(loc, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}
          {tx.contB1}<strong style={{ color: 'white' }}>{PLAN_PRICE_BR}{tx.perMonth}</strong> ({PLAN_PRICE_US}/mo){tx.contB2}
        </div>
        {checkoutError && <div style={{ fontSize: '12px', color: '#f87171', marginBottom: '12px' }}>{checkoutError}</div>}
        <button onClick={startCheckout} disabled={checkoutLoading}
          style={{ padding: '14px 24px', background: ORANGE, color: '#000', fontWeight: 800, fontSize: '13.5px', border: 'none', borderRadius: '11px', cursor: checkoutLoading ? 'wait' : 'pointer' }}>
          {checkoutLoading ? tx.opening : tx.contBtn(PLAN_PRICE_BR)}
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

function PanelBlock({ icon, title, value, to, note, cta }: { icon: string; title: string; value: string | null; to: string; note?: string; cta?: string }) {
  const navigate = useNavigate()
  const tx = TX[useLang().lang]
  return (
    <div onClick={() => navigate(to)} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px', cursor: 'pointer', minWidth: 0 }}>
      <div style={{ fontSize: '11.5px', fontWeight: 700, color: MUTED, marginBottom: '8px' }}>{icon} {title}</div>
      <div style={{ fontSize: '14px', fontWeight: 800, color: value ? 'white' : MUTED, lineHeight: 1.35, wordBreak: 'break-word' }}>{value ?? tx.analyzing}</div>
      {note && <div style={{ fontSize: '10.5px', color: MUTED, marginTop: '4px' }}>{note}</div>}
      <div style={{ fontSize: '11.5px', fontWeight: 700, color: ORANGE, marginTop: '10px' }}>{cta ?? tx.open}</div>
    </div>
  )
}
