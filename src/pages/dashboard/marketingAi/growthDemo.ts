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
import type { CompanyData } from '../../../contexts/CompanyContext'

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
export interface GrowthKpis {
  revenue: number; revenueDelta: number
  leads: number; leadsDelta: number
  funnelConversion: number; funnelConversionDelta: number
  roas: number; roasDelta: number
  adSpend: number
  igFollowers: number; igFollowersGained: number
  contentEngagement: number; contentEngagementDelta: number
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

// ── Gerador principal ────────────────────────────────────────────────────
export function buildGrowthDemo(company: Pick<CompanyData, 'id' | 'business_name' | 'instagram_user_id' | 'website_url' | 'google_place_id'>): GrowthDemoData {
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
    { key: 'instagram', name: 'Instagram Business', category: 'meta', icon: '📸', connected: !!company.instagram_user_id, detail: company.instagram_user_id ? 'Conta conectada' : 'Conectar via Meta Business' },
    { key: 'facebook', name: 'Facebook Page', category: 'meta', icon: '👍', connected: !!company.instagram_user_id, detail: company.instagram_user_id ? 'Página vinculada' : 'Conectar via Meta Business' },
    { key: 'meta_ads', name: 'Meta Ads Manager', category: 'meta', icon: '🎯', connected: false, detail: 'Aguardando verificação da Meta', requiresVerification: true },
    { key: 'whatsapp', name: 'WhatsApp Business API', category: 'mensageria', icon: '💬', connected: false, detail: 'Aguardando verificação da Meta', requiresVerification: true },
    { key: 'gbp', name: 'Google Business Profile', category: 'reputacao', icon: '🗺️', connected: !!company.google_place_id, detail: company.google_place_id ? 'Perfil vinculado' : 'Conectar para reviews e Maps' },
    { key: 'website', name: 'Website', category: 'site', icon: '🌐', connected: !!company.website_url, detail: company.website_url ? String(company.website_url) : 'Adicione a URL do site' },
    { key: 'crm', name: 'CRM', category: 'crm', icon: '🗂️', connected: false, detail: 'Pipeline nativo do Sales Boost (em breve)' },
    { key: 'shopify', name: 'Shopify / E-commerce', category: 'ecommerce', icon: '🛒', connected: false, detail: 'Conectar loja para atribuir receita' },
  ]

  // Funil — contagens decrescentes coerentes com leads e conversão.
  const sales = Math.max(1, Math.round(leads * (funnelConversion / 100)))
  const proposals = Math.round(sales * between(1.8, 2.6))
  const qualified = Math.round(proposals * between(1.7, 2.4))
  const contacted = Math.round(qualified * between(1.3, 1.8))
  const ticket = Math.round(revenue / Math.max(sales, 1))
  const funnel: DemoFunnelStage[] = [
    { key: 'novo', label: 'Novo Lead', count: leads, value: 0 },
    { key: 'contato', label: 'Contato realizado', count: contacted, value: 0 },
    { key: 'qualificado', label: 'Qualificado', count: qualified, value: qualified * ticket },
    { key: 'proposta', label: 'Proposta', count: proposals, value: proposals * ticket },
    { key: 'venda', label: 'Venda realizada', count: sales, value: sales * ticket },
  ]

  const agents: DemoAgentStatus[] = [
    { key: 'market', name: 'Inteligência de Mercado', icon: '🧭', state: 'active', lastAction: 'Mapeou 3 movimentos de concorrentes' },
    { key: 'content', name: 'Conteúdo', icon: '✍️', state: 'active', lastAction: `Criou ${iBetween(4, 10)} ideias de posts` },
    { key: 'ads', name: 'Meta Ads', icon: '🎯', state: 'soon', lastAction: 'Aguardando verificação da Meta' },
    { key: 'sales', name: 'Vendas (Funil)', icon: '🔀', state: 'idle', lastAction: `${iBetween(2, 9)} leads aguardando follow-up` },
    { key: 'whatsapp', name: 'Atendimento WhatsApp', icon: '💬', state: 'soon', lastAction: 'Aguardando verificação da Meta' },
  ]

  const cpl = Math.round(adSpend / Math.max(leads, 1))
  const cplRise = iBetween(18, 32)
  const insights: CommandInsight[] = [
    { id: 'op1', kind: 'oportunidade', title: 'Vídeos de prova social estão performando', description: `Reels com depoimento tiveram ${iBetween(2, 4)}x mais alcance que imagens nos últimos 30 dias. A maior oportunidade é aumentar o investimento nesse formato.`, impact: 'high' },
    { id: 'op2', kind: 'oportunidade', title: `Público 25-34 tem o menor custo por lead`, description: `Esse público converte a R$ ${Math.round(cpl * 0.7)} por lead, ${iBetween(20, 40)}% abaixo da média. Vale concentrar verba nele.`, impact: 'medium' },
    { id: 'pr1', kind: 'problema', title: `Custo por lead subiu ${cplRise}%`, description: `Identificamos que o criativo principal perdeu eficiência (fadiga de anúncio). Recomendamos novas variações.`, impact: 'high' },
    { id: 'pr2', kind: 'problema', title: `${iBetween(120, 300)} leads ficaram sem resposta`, description: 'O gargalo não é o anúncio, é o atendimento. Leads sem resposta em 24h têm 3x menos chance de fechar.', impact: 'high' },
    { id: 'ar1', kind: 'acao_recomendada', title: 'Criar campanha de remarketing', description: 'Impactar de novo quem visitou o site mas não comprou — costuma ter o melhor ROAS do funil.', impact: 'medium' },
    { id: 'ae1', kind: 'acao_executada', title: `Criamos ${iBetween(3, 6)} novas variações de criativo`, description: 'Baseadas no formato de depoimento que está performando melhor. Aguardando sua aprovação para publicar.', impact: 'medium' },
    { id: 'ae2', kind: 'acao_executada', title: `Rascunhamos follow-up para ${iBetween(4, 12)} leads parados`, description: 'Mensagens prontas na aba Funil, esperando sua aprovação antes de enviar.', impact: 'low' },
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

export function buildMetaAdsDemo(company: Pick<CompanyData, 'id' | 'business_name'>): MetaAdsDemo {
  const rng = seededRng((company.id || company.business_name || 'demo') + ':ads')
  const between = (min: number, max: number) => min + rng() * (max - min)
  const iBetween = (min: number, max: number) => Math.round(between(min, max))
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]

  const CAMPAIGN_SPECS: { name: string; objective: string }[] = [
    { name: 'Conversões · Prova social', objective: 'Conversões' },
    { name: 'Remarketing · Visitantes do site', objective: 'Remarketing' },
    { name: 'Tráfego · Reels de bastidores', objective: 'Tráfego' },
    { name: 'Mensagens · WhatsApp direto', objective: 'Mensagens' },
    { name: 'Alcance · Reconhecimento local', objective: 'Alcance' },
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
    { name: '25-34 · interesse no segmento', cpl: iBetween(5, 12), conversions: iBetween(30, 90), share: 0 },
    { name: '35-44 · lookalike de clientes', cpl: iBetween(9, 18), conversions: iBetween(20, 60), share: 0 },
    { name: '18-24 · geolocalizado', cpl: iBetween(12, 26), conversions: iBetween(8, 30), share: 0 },
    { name: 'Remarketing · visitou o site', cpl: iBetween(3, 9), conversions: iBetween(25, 70), share: 0 },
  ]
  const audTotal = audiences.reduce((s, a) => s + a.conversions, 0)
  audiences.forEach(a => { a.share = Math.round((a.conversions / audTotal) * 100) })

  const creatives: DemoCreative[] = [
    { name: 'Depoimento da cliente Ana', type: 'Vídeo (depoimento)', roas: Number(between(3.5, 6.8).toFixed(1)), ctr: Number(between(1.8, 3.6).toFixed(2)), status: 'active', share: 0 },
    { name: 'Carrossel · antes e depois', type: 'Carrossel', roas: Number(between(2.2, 4.5).toFixed(1)), ctr: Number(between(1.1, 2.4).toFixed(2)), status: 'active', share: 0 },
    { name: 'Reels · bastidores', type: 'Reels', roas: Number(between(1.6, 3.4).toFixed(1)), ctr: Number(between(0.9, 2.1).toFixed(2)), status: 'learning', share: 0 },
    { name: 'Imagem única · promoção', type: 'Imagem única', roas: Number(between(0.7, 1.6).toFixed(1)), ctr: Number(between(0.4, 1.2).toFixed(2)), status: 'paused', share: 0 },
  ]
  const totalRoas = creatives.reduce((s, c) => s + c.roas, 0)
  creatives.forEach(c => { c.share = Math.round((c.roas / totalRoas) * 100) })

  const worst = [...campaigns].sort((a, b) => a.roas - b.roas)[0]
  const best = [...campaigns].sort((a, b) => b.roas - a.roas)[0]
  const recommendations: AdRecommendation[] = [
    { id: 'r_pause', kind: 'pausar', title: `Pausar "${worst.name}"`, description: `ROAS de ${worst.roas}x — abaixo do ponto de equilíbrio. Está queimando verba sem retorno.`, impact: 'high', executedNote: `Campanha "${worst.name}" pausada. Verba realocada para as de melhor desempenho.` },
    { id: 'r_budget', kind: 'orcamento', title: `Aumentar orçamento de "${best.name}"`, description: `ROAS de ${best.roas}x — a mais eficiente. Escalar aos poucos (+20%) tende a manter o retorno.`, impact: 'high', executedNote: `Orçamento de "${best.name}" aumentado em 20%. Monitorando o ROAS nas próximas 48h.` },
    { id: 'r_creative', kind: 'criativo', title: 'Criar 3 variações do vídeo de depoimento', description: `O criativo de depoimento tem o melhor ROAS (${creatives[0].roas}x). Novas variações combatem a fadiga de anúncio.`, impact: 'medium', executedNote: '3 variações do vídeo de depoimento criadas como rascunho, aguardando sua aprovação.' },
    { id: 'r_audience', kind: 'publico', title: 'Concentrar verba no público 25-34', description: `Menor custo por lead (R$ ${audiences[0].cpl}) e ${audiences[0].share}% das conversões. Vale priorizar.`, impact: 'medium', executedNote: 'Distribuição de verba ajustada para priorizar o público 25-34.' },
    { id: 'r_campaign', kind: 'campanha', title: 'Criar campanha de remarketing', description: 'Impactar de novo quem visitou o site e não comprou — costuma ter o melhor ROAS do funil.', impact: 'medium', executedNote: 'Campanha de remarketing montada como rascunho, aguardando sua aprovação para publicar.' },
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

export function useDemoMode(companyId: string | undefined): [boolean, (v: boolean) => void] {
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
  return [on, set]
}

// ── Formatadores pt-BR ───────────────────────────────────────────────────
export function fmtBRL(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 1000) {
    return `R$ ${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
  }
  return `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}
export function fmtNum(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}
export function fmtDelta(n: number): { text: string; positive: boolean } {
  const positive = n >= 0
  return { text: `${positive ? '+' : ''}${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`, positive }
}
