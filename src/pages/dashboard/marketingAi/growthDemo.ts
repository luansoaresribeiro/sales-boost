// ── Camada de dados DEMO do Growth OS ────────────────────────────────────
// Enquanto a Meta (e as outras integrações) não estão verificadas/ligadas de
// verdade, o Growth Command Center e as Conexões precisam mostrar o produto
// funcionando de ponta a ponta — como uma demonstração. Este módulo gera
// números realistas e ESTÁVEIS por empresa (mesma empresa → sempre os mesmos
// números), a partir de um seed derivado do id da empresa.
//
// IMPORTANTE (arquitetura demo-first): a FORMA dos dados aqui é a mesma que a
// Meta API vai preencher no futuro. Quando a conta for verificada, a gente só
// troca a FONTE (demo → Meta live) — as telas não mudam. Nada aqui grava no
// banco; é só apresentação.

import { useCallback, useState } from 'react'
import { useCompany, type CompanyData } from '../../../contexts/CompanyContext'
import { getTrialInfo } from '../../../lib/trialState'
import type { Lang } from '../../../contexts/LanguageContext'

// ── PRNG determinístico (xmur3 + mulberry32) ─────────────────────────────
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function seededRng(key: string): () => number {
  return mulberry32(xmur3(key)())
}

// ── Tipos ────────────────────────────────────────────────────────────────
// No modo demo todo campo vem preenchido. No painel-resumo real (Growth
// Command Center), cada peça só é real se a fonte dela estiver conectada —
// os campos "*Delta" exigem uma comparação histórica que hoje só existe pro
// Instagram (igFollowersGained não é um "delta" calculado, é um fato: quanto
// cresceu de verdade no período). Sem fonte real, o campo fica null — o
// KpiTile mostra "—" em vez de inventar um zero que pareceria dado real.
export interface GrowthKpis {
  revenue: number | null; revenueDelta: number | null
  leads: number; leadsDelta: number | null
  funnelConversion: number | null; funnelConversionDelta: number | null
  roas: number | null; roasDelta: number | null
  adSpend: number | null
  igFollowers: number | null; igFollowersGained: number | null
  contentEngagement: number | null; contentEngagementDelta: number | null
}

export type ConnectionCategory = 'meta' | 'mensageria' | 'reputacao' | 'site' | 'crm' | 'ecommerce'

export interface DemoConnection {
  key: string
  name: string
  category: ConnectionCategory
  icon: string
  connected: boolean
  detail: string
  requiresVerification?: boolean
}

export interface DemoFunnelStage { key: string; label: string; count: number; value: number }

export interface DemoAgentStatus {
  key: string; name: string; icon: string
  state: 'active' | 'idle' | 'soon'
  lastAction: string
}

export type CommandInsightKind = 'oportunidade' | 'problema' | 'acao_recomendada' | 'acao_executada'

export interface CommandInsight {
  id: string
  kind: CommandInsightKind
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
}

export interface GrowthDemoData {
  kpis: GrowthKpis
  connections: DemoConnection[]
  funnel: DemoFunnelStage[]
  agents: DemoAgentStatus[]
  insights: CommandInsight[]
}

const CONNECTION_CATEGORY_LABEL: Record<ConnectionCategory, string> = {
  meta: 'Meta Business', mensageria: 'Mensageria', reputacao: 'Reputação',
  site: 'Site', crm: 'CRM', ecommerce: 'E-commerce',
}
export { CONNECTION_CATEGORY_LABEL }
export const CONNECTION_CATEGORY_LABEL_EN: Record<ConnectionCategory, string> = {
  meta: 'Meta Business', mensageria: 'Messaging', reputacao: 'Reputation',
  site: 'Website', crm: 'CRM', ecommerce: 'E-commerce',
}

// ── Gerador principal ────────────────────────────────────────────────────
export function buildGrowthDemo(company: Pick<CompanyData, 'id' | 'business_name' | 'instagram_user_id' | 'website_url' | 'google_place_id'>, lang: Lang = 'pt'): GrowthDemoData {
  const L = (pt: string, en: string) => (lang === 'en' ? en : pt)
  const rng = seededRng(company.id || company.business_name || 'demo')
  const between = (min: number, max: number) => min + rng() * (max - min)
  const iBetween = (min: number, max: number) => Math.round(between(min, max))

  const adSpend = iBetween(1500, 8000)
  const roas = Number(between(2.6, 6.2).toFixed(1))
  const revenue = Math.round(adSpend * roas + between(8000, 45000))
  const leads = iBetween(90, 420)
  const funnelConversion = Number(between(6, 18).toFixed(1))
  const igFollowers = iBetween(1200, 26000)
  const igFollowersGained = Math.round(igFollowers * between(0.03, 0.09))
  const contentEngagement = Number(between(2.1, 6.8).toFixed(1))

  const kpis: GrowthKpis = {
    revenue, revenueDelta: Number(between(-8, 34).toFixed(1)),
    leads, leadsDelta: Number(between(-12, 41).toFixed(1)),
    funnelConversion, funnelConversionDelta: Number(between(-4, 9).toFixed(1)),
    roas, roasDelta: Number(between(-1.1, 1.8).toFixed(1)),
    adSpend,
    igFollowers, igFollowersGained,
    contentEngagement, contentEngagementDelta: Number(between(-1.4, 2.6).toFixed(1)),
  }

  // Conexões — reflete o estado real quando dá pra saber; o resto é demo,
  // com a Meta Ads honestamente marcada como aguardando verificação.
  const connections: DemoConnection[] = [
    { key: 'instagram', name: 'Instagram Business', category: 'meta', icon: '📸', connected: !!company.instagram_user_id, detail: company.instagram_user_id ? L('Conta conectada', 'Account connected') : L('Conectar via Meta Business', 'Connect via Meta Business') },
    { key: 'facebook', name: 'Facebook Page', category: 'meta', icon: '👍', connected: !!company.instagram_user_id, detail: company.instagram_user_id ? L('Página vinculada', 'Page linked') : L('Conectar via Meta Business', 'Connect via Meta Business') },
    { key: 'meta_ads', name: 'Meta Ads Manager', category: 'meta', icon: '🎯', connected: false, detail: L('Aguardando verificação da Meta', 'Waiting for Meta verification'), requiresVerification: true },
    { key: 'whatsapp', name: 'WhatsApp Business API', category: 'mensageria', icon: '💬', connected: false, detail: L('Aguardando verificação da Meta', 'Waiting for Meta verification'), requiresVerification: true },
    { key: 'gbp', name: 'Google Business Profile', category: 'reputacao', icon: '🗺️', connected: !!company.google_place_id, detail: company.google_place_id ? L('Perfil vinculado', 'Profile linked') : L('Conectar para reviews e Maps', 'Connect for reviews and Maps') },
    { key: 'website', name: 'Website', category: 'site', icon: '🌐', connected: !!company.website_url, detail: company.website_url ? String(company.website_url) : L('Adicione a URL do site', 'Add the website URL') },
    { key: 'crm', name: 'CRM', category: 'crm', icon: '🗂️', connected: false, detail: L('Pipeline nativo do Sales Boost (em breve)', 'Native Sales Boost pipeline (coming soon)') },
    { key: 'shopify', name: 'Shopify / E-commerce', category: 'ecommerce', icon: '🛒', connected: false, detail: L('Conectar loja para atribuir receita', 'Connect store to attribute revenue') },
  ]

  // Funil — contagens decrescentes coerentes com leads e conversão.
  const sales = Math.max(1, Math.round(leads * (funnelConversion / 100)))
  const proposals = Math.round(sales * between(1.8, 2.6))
  const qualified = Math.round(proposals * between(1.7, 2.4))
  const contacted = Math.round(qualified * between(1.3, 1.8))
  const ticket = Math.round(revenue / Math.max(sales, 1))
  const funnel: DemoFunnelStage[] = [
    { key: 'novo', label: L('Novo Lead', 'New Lead'), count: leads, value: 0 },
    { key: 'contato', label: L('Contato realizado', 'Contacted'), count: contacted, value: 0 },
    { key: 'qualificado', label: L('Qualificado', 'Qualified'), count: qualified, value: qualified * ticket },
    { key: 'proposta', label: L('Proposta', 'Proposal'), count: proposals, value: proposals * ticket },
    { key: 'venda', label: L('Venda realizada', 'Sale closed'), count: sales, value: sales * ticket },
  ]

  const agents: DemoAgentStatus[] = [
    { key: 'market', name: L('Inteligência de Mercado', 'Market Intelligence'), icon: '🧭', state: 'active', lastAction: L('Mapeou 3 movimentos de concorrentes', 'Mapped 3 competitor moves') },
    { key: 'content', name: L('Conteúdo', 'Content'), icon: '✍️', state: 'active', lastAction: (() => { const n = iBetween(4, 10); return L(`Criou ${n} ideias de posts`, `Created ${n} post ideas`) })() },
    { key: 'ads', name: 'Meta Ads', icon: '🎯', state: 'soon', lastAction: L('Aguardando verificação da Meta', 'Waiting for Meta verification') },
    { key: 'sales', name: L('Vendas (Funil)', 'Sales (Funnel)'), icon: '🔀', state: 'idle', lastAction: (() => { const n = iBetween(2, 9); return L(`${n} leads aguardando follow-up`, `${n} leads waiting for follow-up`) })() },
    { key: 'whatsapp', name: L('Atendimento WhatsApp', 'WhatsApp Support'), icon: '💬', state: 'soon', lastAction: L('Aguardando verificação da Meta', 'Waiting for Meta verification') },
  ]

  const cpl = Math.round(adSpend / Math.max(leads, 1))
  const cplRise = iBetween(18, 32)
  const reelsMult = iBetween(2, 4)
  const cplPct = iBetween(20, 40)
  const noReply = iBetween(120, 300)
  const variations = iBetween(3, 6)
  const followUps = iBetween(4, 12)
  const insights: CommandInsight[] = [
    { id: 'op1', kind: 'oportunidade', title: L('Vídeos de prova social estão performando', 'Social proof videos are performing'), description: L(`Reels com depoimento tiveram ${reelsMult}x mais alcance que imagens nos últimos 30 dias. A maior oportunidade é aumentar o investimento nesse formato.`, `Testimonial Reels had ${reelsMult}x more reach than images in the last 30 days. The biggest opportunity is to increase investment in this format.`), impact: 'high' },
    { id: 'op2', kind: 'oportunidade', title: L(`Público 25-34 tem o menor custo por lead`, 'The 25-34 audience has the lowest cost per lead'), description: L(`Esse público converte a R$ ${Math.round(cpl * 0.7)} por lead, ${cplPct}% abaixo da média. Vale concentrar verba nele.`, `This audience converts at R$ ${Math.round(cpl * 0.7)} per lead, ${cplPct}% below average. Worth concentrating budget on it.`), impact: 'medium' },
    { id: 'pr1', kind: 'problema', title: L(`Custo por lead subiu ${cplRise}%`, `Cost per lead rose ${cplRise}%`), description: L(`Identificamos que o criativo principal perdeu eficiência (fadiga de anúncio). Recomendamos novas variações.`, 'We found that the main creative lost efficiency (ad fatigue). We recommend new variations.'), impact: 'high' },
    { id: 'pr2', kind: 'problema', title: L(`${noReply} leads ficaram sem resposta`, `${noReply} leads went unanswered`), description: L('O gargalo não é o anúncio, é o atendimento. Leads sem resposta em 24h têm 3x menos chance de fechar.', 'The bottleneck is not the ad, it is the service. Leads without a reply within 24h are 3x less likely to close.'), impact: 'high' },
    { id: 'ar1', kind: 'acao_recomendada', title: L('Criar campanha de remarketing', 'Create a remarketing campaign'), description: L('Impactar de novo quem visitou o site mas não comprou — costuma ter o melhor ROAS do funil.', 'Reach again those who visited the site but did not buy — usually has the best ROAS in the funnel.'), impact: 'medium' },
    { id: 'ae1', kind: 'acao_executada', title: L(`Criamos ${variations} novas variações de criativo`, `We created ${variations} new creative variations`), description: L('Baseadas no formato de depoimento que está performando melhor. Aguardando sua aprovação para publicar.', 'Based on the testimonial format that is performing best. Waiting for your approval to publish.'), impact: 'medium' },
    { id: 'ae2', kind: 'acao_executada', title: L(`Rascunhamos follow-up para ${followUps} leads parados`, `We drafted follow-ups for ${followUps} stalled leads`), description: L('Mensagens prontas na aba Funil, esperando sua aprovação antes de enviar.', 'Messages ready in the Funnel tab, waiting for your approval before sending.'), impact: 'low' },
  ]

  return { kpis, connections, funnel, agents, insights }
}

// ── Meta Ads (demo) ──────────────────────────────────────────────────────
// Mesma forma que a Meta Marketing API vai preencher quando a conta for
// verificada. Seed distinto (':ads') pra números estáveis e próprios.
export type AdStatus = 'active' | 'paused' | 'learning'

export interface DemoAdCampaign {
  id: string; name: string; objective: string; status: AdStatus
  spend: number; roas: number; ctr: number; cpc: number; cpa: number; conversions: number
}
export interface DemoAudience { name: string; cpl: number; conversions: number; share: number }
export interface DemoCreative { name: string; type: string; roas: number; ctr: number; status: AdStatus; share: number }

export type AdRecoKind = 'pausar' | 'orcamento' | 'criativo' | 'publico' | 'campanha'
export interface AdRecommendation {
  id: string; kind: AdRecoKind; title: string; description: string
  impact: 'high' | 'medium' | 'low'; executedNote: string
}

export interface MetaAdsDemo {
  totals: { spend: number; roas: number; ctr: number; cpc: number; cpa: number; conversions: number; revenue: number }
  campaigns: DemoAdCampaign[]
  audiences: DemoAudience[]
  creatives: DemoCreative[]
  recommendations: AdRecommendation[]
}

export const AD_STATUS_META: Record<AdStatus, { label: string; color: string }> = {
  active: { label: 'Ativo', color: '#4ade80' },
  paused: { label: 'Pausado', color: 'rgba(255,255,255,0.4)' },
  learning: { label: 'Aprendizado', color: '#FBBF24' },
}

export const AD_RECO_META: Record<AdRecoKind, { icon: string; label: string }> = {
  pausar: { icon: '⏸️', label: 'Pausar anúncio' },
  orcamento: { icon: '💰', label: 'Ajustar orçamento' },
  criativo: { icon: '🎬', label: 'Novo criativo' },
  publico: { icon: '👥', label: 'Público' },
  campanha: { icon: '🚀', label: 'Nova campanha' },
}

export function buildMetaAdsDemo(company: Pick<CompanyData, 'id' | 'business_name'>, lang: Lang = 'pt'): MetaAdsDemo {
  const L = (pt: string, en: string) => (lang === 'en' ? en : pt)
  const rng = seededRng((company.id || company.business_name || 'demo') + ':ads')
  const between = (min: number, max: number) => min + rng() * (max - min)
  const iBetween = (min: number, max: number) => Math.round(between(min, max))
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]

  const CAMPAIGN_SPECS: { name: string; objective: string }[] = [
    { name: L('Conversões · Prova social', 'Conversions · Social proof'), objective: L('Conversões', 'Conversions') },
    { name: L('Remarketing · Visitantes do site', 'Remarketing · Site visitors'), objective: 'Remarketing' },
    { name: L('Tráfego · Reels de bastidores', 'Traffic · Behind-the-scenes Reels'), objective: L('Tráfego', 'Traffic') },
    { name: L('Mensagens · WhatsApp direto', 'Messages · Direct WhatsApp'), objective: L('Mensagens', 'Messages') },
    { name: L('Alcance · Reconhecimento local', 'Reach · Local awareness'), objective: L('Alcance', 'Reach') },
  ]

  const campaigns: DemoAdCampaign[] = CAMPAIGN_SPECS.map((spec, i) => {
    const spend = iBetween(300, 2600)
    const roas = Number(between(0.8, 6.5).toFixed(1))
    const ctr = Number(between(0.6, 3.4).toFixed(2))
    const cpc = Number(between(0.4, 2.8).toFixed(2))
    const cpa = iBetween(6, 48)
    const conversions = Math.max(1, Math.round(spend / cpa))
    const status: AdStatus = roas < 1.4 ? 'paused' : i === 2 ? 'learning' : 'active'
    return { id: `cmp_${i}`, name: spec.name, objective: spec.objective, status, spend, roas, ctr, cpc, cpa, conversions }
  })

  const spend = campaigns.reduce((s, c) => s + c.spend, 0)
  const revenue = Math.round(campaigns.reduce((s, c) => s + c.spend * c.roas, 0))
  const conversions = campaigns.reduce((s, c) => s + c.conversions, 0)
  const totals = {
    spend, revenue, conversions,
    roas: Number((revenue / Math.max(spend, 1)).toFixed(1)),
    ctr: Number((campaigns.reduce((s, c) => s + c.ctr, 0) / campaigns.length).toFixed(2)),
    cpc: Number((campaigns.reduce((s, c) => s + c.cpc, 0) / campaigns.length).toFixed(2)),
    cpa: Math.round(spend / Math.max(conversions, 1)),
  }

  const audiences: DemoAudience[] = [
    { name: L('25-34 · interesse no segmento', '25-34 · interest in the segment'), cpl: iBetween(5, 12), conversions: iBetween(30, 90), share: 0 },
    { name: L('35-44 · lookalike de clientes', '35-44 · customer lookalike'), cpl: iBetween(9, 18), conversions: iBetween(20, 60), share: 0 },
    { name: L('18-24 · geolocalizado', '18-24 · geotargeted'), cpl: iBetween(12, 26), conversions: iBetween(8, 30), share: 0 },
    { name: L('Remarketing · visitou o site', 'Remarketing · visited the site'), cpl: iBetween(3, 9), conversions: iBetween(25, 70), share: 0 },
  ]
  const audTotal = audiences.reduce((s, a) => s + a.conversions, 0)
  audiences.forEach(a => { a.share = Math.round((a.conversions / audTotal) * 100) })

  const creatives: DemoCreative[] = [
    { name: L('Depoimento da cliente Ana', 'Testimonial from customer Ana'), type: L('Vídeo (depoimento)', 'Video (testimonial)'), roas: Number(between(3.5, 6.8).toFixed(1)), ctr: Number(between(1.8, 3.6).toFixed(2)), status: 'active', share: 0 },
    { name: L('Carrossel · antes e depois', 'Carousel · before and after'), type: L('Carrossel', 'Carousel'), roas: Number(between(2.2, 4.5).toFixed(1)), ctr: Number(between(1.1, 2.4).toFixed(2)), status: 'active', share: 0 },
    { name: L('Reels · bastidores', 'Reels · behind the scenes'), type: 'Reels', roas: Number(between(1.6, 3.4).toFixed(1)), ctr: Number(between(0.9, 2.1).toFixed(2)), status: 'learning', share: 0 },
    { name: L('Imagem única · promoção', 'Single image · promotion'), type: L('Imagem única', 'Single image'), roas: Number(between(0.7, 1.6).toFixed(1)), ctr: Number(between(0.4, 1.2).toFixed(2)), status: 'paused', share: 0 },
  ]
  const totalRoas = creatives.reduce((s, c) => s + c.roas, 0)
  creatives.forEach(c => { c.share = Math.round((c.roas / totalRoas) * 100) })

  const worst = [...campaigns].sort((a, b) => a.roas - b.roas)[0]
  const best = [...campaigns].sort((a, b) => b.roas - a.roas)[0]
  const recommendations: AdRecommendation[] = [
    { id: 'r_pause', kind: 'pausar', title: L(`Pausar "${worst.name}"`, `Pause "${worst.name}"`), description: L(`ROAS de ${worst.roas}x — abaixo do ponto de equilíbrio. Está queimando verba sem retorno.`, `ROAS of ${worst.roas}x — below break-even. It is burning budget with no return.`), impact: 'high', executedNote: L(`Campanha "${worst.name}" pausada. Verba realocada para as de melhor desempenho.`, `Campaign "${worst.name}" paused. Budget reallocated to the best performers.`) },
    { id: 'r_budget', kind: 'orcamento', title: L(`Aumentar orçamento de "${best.name}"`, `Increase budget of "${best.name}"`), description: L(`ROAS de ${best.roas}x — a mais eficiente. Escalar aos poucos (+20%) tende a manter o retorno.`, `ROAS of ${best.roas}x — the most efficient. Scaling gradually (+20%) tends to keep the return.`), impact: 'high', executedNote: L(`Orçamento de "${best.name}" aumentado em 20%. Monitorando o ROAS nas próximas 48h.`, `Budget of "${best.name}" increased by 20%. Monitoring ROAS over the next 48h.`) },
    { id: 'r_creative', kind: 'criativo', title: L('Criar 3 variações do vídeo de depoimento', 'Create 3 variations of the testimonial video'), description: L(`O criativo de depoimento tem o melhor ROAS (${creatives[0].roas}x). Novas variações combatem a fadiga de anúncio.`, `The testimonial creative has the best ROAS (${creatives[0].roas}x). New variations fight ad fatigue.`), impact: 'medium', executedNote: L('3 variações do vídeo de depoimento criadas como rascunho, aguardando sua aprovação.', '3 variations of the testimonial video created as drafts, waiting for your approval.') },
    { id: 'r_audience', kind: 'publico', title: L('Concentrar verba no público 25-34', 'Concentrate budget on the 25-34 audience'), description: L(`Menor custo por lead (R$ ${audiences[0].cpl}) e ${audiences[0].share}% das conversões. Vale priorizar.`, `Lowest cost per lead (R$ ${audiences[0].cpl}) and ${audiences[0].share}% of conversions. Worth prioritizing.`), impact: 'medium', executedNote: L('Distribuição de verba ajustada para priorizar o público 25-34.', 'Budget distribution adjusted to prioritize the 25-34 audience.') },
    { id: 'r_campaign', kind: 'campanha', title: L('Criar campanha de remarketing', 'Create a remarketing campaign'), description: L('Impactar de novo quem visitou o site e não comprou — costuma ter o melhor ROAS do funil.', 'Reach again those who visited the site and did not buy — usually has the best ROAS in the funnel.'), impact: 'medium', executedNote: L('Campanha de remarketing montada como rascunho, aguardando sua aprovação para publicar.', 'Remarketing campaign set up as a draft, waiting for your approval to publish.') },
  ]
  void pick

  return { totals, campaigns, audiences, creatives, recommendations }
}

// ── Modo demo por empresa (localStorage) ─────────────────────────────────
// Fase 1 usa localStorage pra não depender de migration no banco. Quando a
// Meta live entrar (fase 5), isso vira uma coluna real por empresa e o mesmo
// toggle passa a alternar entre "demo" e "dados reais da Meta".
function demoKey(companyId: string | undefined): string {
  return `sb_growth_demo_${companyId ?? 'anon'}`
}

// Durante o teste grátis o cliente só vê dado real (decisão 2026-10-02,
// "7-Day Growth Preview" não é demo): o modo demonstração fica sempre
// desligado e as telas escondem a chave/botão (ver useDemoAllowed).
export function useDemoAllowed(): boolean {
  const { company } = useCompany()
  return !getTrialInfo(company).isTrial
}

export function useDemoMode(companyId: string | undefined): [boolean, (v: boolean) => void] {
  const allowed = useDemoAllowed()
  const [on, setOn] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false
    const stored = localStorage.getItem(demoKey(companyId))
    // Default DESLIGADO: em produção nunca mostramos número fictício como se
    // fosse real. Sem dado real, a tela fica borrada (DataVeil) até o dono
    // LIGAR o Modo demonstração de propósito.
    return stored == null ? false : stored === '1'
  })
  const set = useCallback((v: boolean) => {
    setOn(v)
    try { localStorage.setItem(demoKey(companyId), v ? '1' : '0') } catch { /* ignore */ }
  }, [companyId])
  return [allowed && on, set]
}

// ── Formatadores (pt-BR por padrão; en-US quando lang === 'en') ──────────
const locOf = (lang: Lang) => (lang === 'en' ? 'en-US' : 'pt-BR')
export function fmtBRL(n: number, compact = false, lang: Lang = 'pt'): string {
  if (compact && Math.abs(n) >= 1000) {
    return `R$ ${(n / 1000).toLocaleString(locOf(lang), { maximumFractionDigits: 1 })}k`
  }
  return `R$ ${n.toLocaleString(locOf(lang), { maximumFractionDigits: 0 })}`
}
export function fmtNum(n: number, lang: Lang = 'pt'): string {
  return n.toLocaleString(locOf(lang), { maximumFractionDigits: 0 })
}
export function fmtDelta(n: number, lang: Lang = 'pt'): { text: string; positive: boolean } {
  const positive = n >= 0
  return { text: `${positive ? '+' : ''}${n.toLocaleString(locOf(lang), { maximumFractionDigits: 1 })}%`, positive }
}
