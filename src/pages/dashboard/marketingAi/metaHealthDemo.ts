// Dados DEMO do "Meta Health Score" — o KPI mestre do Growth OS. Tudo fictício:
// nenhuma Graph API / Insights da Meta é chamada. A estrutura já é a que a
// integração real vai preencher: um score 0–100 por categoria, motivos, ações
// priorizadas, evolução histórica, benchmark do segmento e resumo executivo.
// Pensa como um consultor de marketing da Meta: traduz métrica em prioridade.
import type { Lang } from '../../../contexts/LanguageContext'

export type HealthClass = 'excellent' | 'very_good' | 'good' | 'attention' | 'critical'

export const HEALTH_CLASS_META: Record<HealthClass, { label: string; color: string; range: string }> = {
  excellent: { label: 'Excelente', color: '#4ade80', range: '95–100' },
  very_good: { label: 'Muito bom', color: '#34d399', range: '85–94' },
  good: { label: 'Bom', color: '#FBBF24', range: '70–84' },
  attention: { label: 'Precisa de atenção', color: '#fb923c', range: '50–69' },
  critical: { label: 'Crítico', color: '#f87171', range: '< 50' },
}

export function classifyHealth(score: number): HealthClass {
  if (score >= 95) return 'excellent'
  if (score >= 85) return 'very_good'
  if (score >= 70) return 'good'
  if (score >= 50) return 'attention'
  return 'critical'
}

export type CheckStatus = 'ok' | 'warning' | 'missing'
export const CHECK_META: Record<CheckStatus, { icon: string; color: string }> = {
  ok: { icon: '✓', color: '#4ade80' },
  warning: { icon: '!', color: '#FBBF24' },
  missing: { icon: '✕', color: '#f87171' },
}

export interface HealthCheck { label: string; status: CheckStatus; note?: string }

export interface HealthCategory {
  key: string
  label: string
  icon: string
  score: number
  weight: number       // peso no score geral (soma 100)
  summary: string      // frase-resumo
  reasons: string[]    // por que esse score (a IA explica)
  checks: HealthCheck[]
}

export type Priority = 'critical' | 'high' | 'medium' | 'low'
export const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  critical: { label: 'Crítica', color: '#f87171' },
  high: { label: 'Alta', color: '#fb923c' },
  medium: { label: 'Média', color: '#FBBF24' },
  low: { label: 'Baixa', color: '#BABABA' },
}
export type Difficulty = 'easy' | 'medium' | 'hard'
export const DIFFICULTY_META: Record<Difficulty, { label: string; color: string }> = {
  easy: { label: 'Fácil', color: '#4ade80' },
  medium: { label: 'Médio', color: '#FBBF24' },
  hard: { label: 'Difícil', color: '#fb923c' },
}

export interface HealthRecommendation {
  id: string
  title: string
  category: string
  priority: Priority
  difficulty: Difficulty
  scoreGain: number
  impact: string
  action: string
}

export interface ActionItem { id: string; label: string; done: boolean; scoreGain: number }

export interface HistoryPoint { period: string; score: number }
export interface HealthHistory { weekly: HistoryPoint[]; monthly: HistoryPoint[]; quarterly: HistoryPoint[] }

export interface HealthBenchmark { segment: string; percentile: number; segmentAvg: number; segmentTop: number; yourScore: number }

export interface MetaHealthDemo {
  overall: number
  trendDelta: number     // variação vs. período anterior
  categories: HealthCategory[]
  recommendations: HealthRecommendation[]
  actions: ActionItem[]
  history: HealthHistory
  benchmark: HealthBenchmark
  executiveSummary: string
}

export function buildMetaHealthDemo(company: { business_name?: string; business_type?: string | null; city?: string | null }, lang: Lang = 'pt'): MetaHealthDemo {
  const biz = company.business_name ?? 'seu negócio'
  const segment = company.business_type ?? 'negócios parecidos com o seu'

  const categories: HealthCategory[] = [
    {
      key: 'account', label: 'Configuração da conta', icon: '⚙️', score: 88, weight: 15,
      summary: 'Base bem montada — falta a API de Conversões e a verificação do negócio.',
      reasons: ['Business Manager, Página e Instagram conectados', 'Pixel instalado e ativo', 'Falta API de Conversões (rastreamento server-side)', 'Verificação do negócio ainda pendente'],
      checks: [
        { label: 'Business Manager configurado', status: 'ok' },
        { label: 'Página do Facebook conectada', status: 'ok' },
        { label: 'Instagram conectado', status: 'ok' },
        { label: 'Conta de anúncios configurada', status: 'ok' },
        { label: 'Pixel instalado', status: 'ok' },
        { label: 'Domínio verificado', status: 'ok' },
        { label: 'Verificação do negócio', status: 'warning', note: 'Aumenta limites e confiança' },
        { label: 'API de Conversões (CAPI)', status: 'missing', note: 'Rastreamento server-side' },
        { label: 'Autenticação de 2 fatores', status: 'ok' },
      ],
    },
    {
      key: 'content', label: 'Saúde do conteúdo', icon: '✍️', score: 82, weight: 15,
      summary: 'Boa consistência visual; falta variedade de formatos e mais conteúdo educativo.',
      reasons: ['Postagem consistente (4×/semana)', 'Identidade visual forte', 'Poucos Reels em relação a fotos', 'Pouco conteúdo educativo / de autoridade'],
      checks: [
        { label: 'Consistência de postagem', status: 'ok' },
        { label: 'Frequência de postagem', status: 'ok' },
        { label: 'Identidade visual', status: 'ok' },
        { label: 'Qualidade das legendas', status: 'ok' },
        { label: 'Uso de Reels', status: 'warning', note: 'Formato de maior alcance hoje' },
        { label: 'Uso de Stories', status: 'ok' },
        { label: 'Conteúdo educativo', status: 'warning' },
        { label: 'Qualidade dos CTAs', status: 'warning' },
      ],
    },
    {
      key: 'audience', label: 'Saúde da audiência', icon: '👥', score: 76, weight: 12,
      summary: 'Crescimento saudável e engajamento acima da média do segmento.',
      reasons: ['Seguidores crescendo ~4%/mês', 'Engajamento acima da média local', 'Alinhamento com o cliente ideal (ICP) ainda a refinar', 'Comunidade pouco ativa nos comentários'],
      checks: [
        { label: 'Crescimento de seguidores', status: 'ok' },
        { label: 'Engajamento da audiência', status: 'ok' },
        { label: 'Seguidores recorrentes', status: 'ok' },
        { label: 'Alinhamento com o ICP', status: 'warning' },
        { label: 'Diversidade da audiência', status: 'ok' },
        { label: 'Atividade da comunidade', status: 'warning' },
      ],
    },
    {
      key: 'campaign', label: 'Saúde das campanhas', icon: '🎯', score: 68, weight: 20,
      summary: 'Estrutura ok, mas sem remarketing e com verba concentrada em público frio.',
      reasons: ['CTR abaixo da meta (1,1%)', 'Nenhuma campanha de remarketing ativa', 'Verba concentrada em um único público', 'Baixa diversidade de criativos'],
      checks: [
        { label: 'Estrutura das campanhas', status: 'ok' },
        { label: 'Objetivos corretos', status: 'ok' },
        { label: 'Segmentação de público', status: 'warning' },
        { label: 'Qualidade dos criativos', status: 'warning' },
        { label: 'CTR', status: 'warning', note: '1,1% — meta 1,5%' },
        { label: 'ROAS', status: 'ok' },
        { label: 'Alocação de orçamento', status: 'warning' },
        { label: 'Uso de remarketing', status: 'missing' },
      ],
    },
    {
      key: 'funnel', label: 'Saúde do funil', icon: '🔀', score: 61, weight: 13,
      summary: 'O fundo do funil está bem servido, mas falta topo e remarketing.',
      reasons: ['Sem campanhas de reconhecimento (topo)', 'Remarketing ausente', 'Concentração no fundo de funil (conversão)', 'Retenção só em rascunho'],
      checks: [
        { label: 'Topo — Descoberta', status: 'missing', note: 'Nenhuma campanha de reconhecimento' },
        { label: 'Meio — Consideração', status: 'ok' },
        { label: 'Fundo — Conversão', status: 'ok' },
        { label: 'Retenção', status: 'warning', note: 'Só em rascunho' },
        { label: 'Remarketing', status: 'missing' },
      ],
    },
    {
      key: 'pixel', label: 'Saúde do Pixel', icon: '📡', score: 54, weight: 15,
      summary: 'Pixel ativo, mas eventos de conversão incompletos — a IA "enxerga" pouco.',
      reasons: ['Pixel instalado e disparando PageView', 'Faltam eventos Lead, Purchase e Checkout', 'Sem API de Conversões (perde dados de iOS)', 'Atribuição de conversão parcial'],
      checks: [
        { label: 'Pixel instalado', status: 'ok' },
        { label: 'Pixel ativo', status: 'ok' },
        { label: 'PageView', status: 'ok' },
        { label: 'ViewContent', status: 'ok' },
        { label: 'Lead', status: 'missing' },
        { label: 'InitiateCheckout', status: 'missing' },
        { label: 'Purchase', status: 'missing' },
        { label: 'Eventos personalizados', status: 'warning' },
        { label: 'Atribuição de conversão', status: 'warning' },
      ],
    },
    {
      key: 'growth', label: 'Crescimento do negócio', icon: '📈', score: 79, weight: 10,
      summary: 'Tendências positivas em alcance e leads; vendas subindo de forma consistente.',
      reasons: ['Alcance +18% no trimestre', 'Leads +12% no mês', 'Vendas em alta constante', 'Engajamento estável'],
      checks: [
        { label: 'Tendência de alcance', status: 'ok' },
        { label: 'Tendência de leads', status: 'ok' },
        { label: 'Tendência de vendas', status: 'ok' },
        { label: 'Tendência de engajamento', status: 'warning' },
        { label: 'Tendência de conversão', status: 'ok' },
      ],
    },
  ]

  // Score geral = média ponderada pelas categorias (mesma conta que a real fará).
  const overall = Math.round(categories.reduce((s, c) => s + c.score * c.weight, 0) / categories.reduce((s, c) => s + c.weight, 0))

  const recommendations: HealthRecommendation[] = [
    { id: 'rec1', title: 'Completar os eventos do Pixel (Lead, Purchase, Checkout)', category: 'Pixel', priority: 'critical', difficulty: 'medium', scoreGain: 8, impact: 'A IA passa a enxergar quem converte — otimização e público muito melhores.', action: 'Configurar os eventos de conversão no Gerenciador de Eventos e testar com o Meta Pixel Helper.' },
    { id: 'rec2', title: 'Ativar a API de Conversões (CAPI)', category: 'Configuração', priority: 'high', difficulty: 'hard', scoreGain: 6, impact: 'Recupera dados perdidos no iOS e melhora a atribuição das vendas.', action: 'Integrar a CAPI (server-side) junto ao Pixel para rastreamento redundante.' },
    { id: 'rec3', title: 'Criar campanha de remarketing', category: 'Campanhas', priority: 'high', difficulty: 'easy', scoreGain: 6, impact: 'Público quente converte mais barato — costuma ser o maior ROAS do funil.', action: 'Criar um público de quem visitou o site/engajou nos últimos 30 dias e rodar oferta de valor.' },
    { id: 'rec4', title: 'Adicionar campanhas de topo (reconhecimento)', category: 'Funil', priority: 'high', difficulty: 'medium', scoreGain: 5, impact: 'Enche o funil de público novo pra nutrir e remarketar depois.', action: 'Rodar conteúdo educativo (isca de valor) mirando público frio da sua região.' },
    { id: 'rec5', title: 'Aumentar a diversidade de criativos', category: 'Campanhas', priority: 'medium', difficulty: 'easy', scoreGain: 4, impact: 'Reduz a fadiga de anúncio e melhora o CTR.', action: 'Gerar 3–4 variações (ângulos e formatos) por campanha e testar em A/B.' },
    { id: 'rec6', title: 'Mais conteúdo educativo e Reels', category: 'Conteúdo', priority: 'medium', difficulty: 'easy', scoreGain: 3, impact: 'Reels têm o maior alcance orgânico hoje; conteúdo educativo gera autoridade.', action: 'Adicionar 2 Reels educativos por semana ao calendário do Agente de Conteúdo.' },
    { id: 'rec7', title: 'Concluir a verificação do negócio', category: 'Configuração', priority: 'low', difficulty: 'medium', scoreGain: 2, impact: 'Libera limites maiores e passa mais confiança na conta.', action: 'Enviar os documentos do negócio no Business Manager.' },
  ]

  const actions: ActionItem[] = [
    { id: 'a1', label: 'Configurar eventos do Pixel (Lead, Purchase)', done: false, scoreGain: 8 },
    { id: 'a2', label: 'Ativar API de Conversões (CAPI)', done: false, scoreGain: 6 },
    { id: 'a3', label: 'Criar campanha de remarketing', done: false, scoreGain: 6 },
    { id: 'a4', label: 'Criar campanha de reconhecimento (topo)', done: false, scoreGain: 5 },
    { id: 'a5', label: 'Adicionar 3+ variações de criativo', done: false, scoreGain: 4 },
    { id: 'a6', label: 'Aumentar Reels e conteúdo educativo', done: true, scoreGain: 3 },
    { id: 'a7', label: 'Concluir verificação do negócio', done: false, scoreGain: 2 },
    { id: 'a8', label: 'Conectar Instagram e Página', done: true, scoreGain: 0 },
  ]

  const history: HealthHistory = {
    weekly: [
      { period: '6 sem', score: 61 }, { period: '5 sem', score: 63 }, { period: '4 sem', score: 62 },
      { period: '3 sem', score: 66 }, { period: '2 sem', score: 69 }, { period: 'Agora', score: overall },
    ],
    monthly: [
      { period: 'Fev', score: 52 }, { period: 'Mar', score: 57 }, { period: 'Abr', score: 60 },
      { period: 'Mai', score: 64 }, { period: 'Jun', score: 66 }, { period: 'Jul', score: overall },
    ],
    quarterly: [
      { period: 'T3/25', score: 44 }, { period: 'T4/25', score: 53 }, { period: 'T1/26', score: 62 }, { period: 'T2/26', score: overall },
    ],
  }

  const trendDelta = overall - history.monthly[history.monthly.length - 2].score

  const benchmark: HealthBenchmark = { segment, percentile: 78, segmentAvg: 61, segmentTop: 88, yourScore: overall }

  const executiveSummary = `A presença de ${biz} na Meta está saudável no geral (${overall}/100, acima de ${benchmark.percentile}% dos ${segment}), com crescimento consistente de alcance e leads. As maiores oportunidades dos próximos 30 dias estão no rastreamento e no funil: completar os eventos do Pixel e ativar a API de Conversões daria à IA muito mais visibilidade sobre quem converte, enquanto criar remarketing e campanhas de topo equilibraria um funil hoje concentrado no fundo. Priorizando o Pixel primeiro, o score projetado passa de ${overall} para ${Math.min(100, overall + 14)} em poucas semanas.`

  const demo: MetaHealthDemo = { overall, trendDelta, categories, recommendations, actions, history, benchmark, executiveSummary }
  return lang === 'en' ? translateMetaHealthDemo(demo, company) : demo
}

// Overlay EN: mantém scores/estrutura e troca só os textos (por chave/id/posição).
function translateMetaHealthDemo(d: MetaHealthDemo, company: { business_name?: string; business_type?: string | null }): MetaHealthDemo {
  const biz = company.business_name ?? 'your business'
  const segment = company.business_type ?? 'businesses like yours'
  const CAT: Record<string, { label: string; summary: string; reasons: string[]; checks: [string, string?][] }> = {
    account: {
      label: 'Account setup', summary: 'Well-built base — missing the Conversions API and business verification.',
      reasons: ['Business Manager, Page and Instagram connected', 'Pixel installed and active', 'Missing Conversions API (server-side tracking)', 'Business verification still pending'],
      checks: [['Business Manager set up'], ['Facebook Page connected'], ['Instagram connected'], ['Ad account set up'], ['Pixel installed'], ['Domain verified'], ['Business verification', 'Increases limits and trust'], ['Conversions API (CAPI)', 'Server-side tracking'], ['Two-factor authentication']],
    },
    content: {
      label: 'Content health', summary: 'Good visual consistency; lacks format variety and more educational content.',
      reasons: ['Consistent posting (4×/week)', 'Strong visual identity', 'Few Reels compared to photos', 'Little educational / authority content'],
      checks: [['Posting consistency'], ['Posting frequency'], ['Visual identity'], ['Caption quality'], ['Reels usage', 'Highest-reach format today'], ['Stories usage'], ['Educational content'], ['CTA quality']],
    },
    audience: {
      label: 'Audience health', summary: 'Healthy growth and engagement above the segment average.',
      reasons: ['Followers growing ~4%/month', 'Engagement above the local average', 'Alignment with the ideal customer (ICP) still to refine', 'Community not very active in comments'],
      checks: [['Follower growth'], ['Audience engagement'], ['Returning followers'], ['ICP alignment'], ['Audience diversity'], ['Community activity']],
    },
    campaign: {
      label: 'Campaign health', summary: 'Structure is fine, but no remarketing and budget concentrated on a cold audience.',
      reasons: ['CTR below target (1.1%)', 'No active remarketing campaign', 'Budget concentrated on a single audience', 'Low creative diversity'],
      checks: [['Campaign structure'], ['Correct objectives'], ['Audience targeting'], ['Creative quality'], ['CTR', '1.1% — target 1.5%'], ['ROAS'], ['Budget allocation'], ['Remarketing usage']],
    },
    funnel: {
      label: 'Funnel health', summary: 'The bottom of the funnel is well served, but the top and remarketing are missing.',
      reasons: ['No awareness campaigns (top)', 'Remarketing missing', 'Concentration at the bottom of the funnel (conversion)', 'Retention only in draft'],
      checks: [['Top — Discovery', 'No awareness campaign'], ['Middle — Consideration'], ['Bottom — Conversion'], ['Retention', 'Draft only'], ['Remarketing']],
    },
    pixel: {
      label: 'Pixel health', summary: 'Pixel active, but conversion events incomplete — the AI "sees" little.',
      reasons: ['Pixel installed and firing PageView', 'Lead, Purchase and Checkout events missing', 'No Conversions API (loses iOS data)', 'Partial conversion attribution'],
      checks: [['Pixel installed'], ['Pixel active'], ['PageView'], ['ViewContent'], ['Lead'], ['InitiateCheckout'], ['Purchase'], ['Custom events'], ['Conversion attribution']],
    },
    growth: {
      label: 'Business growth', summary: 'Positive trends in reach and leads; sales rising consistently.',
      reasons: ['Reach +18% in the quarter', 'Leads +12% in the month', 'Sales steadily rising', 'Engagement stable'],
      checks: [['Reach trend'], ['Lead trend'], ['Sales trend'], ['Engagement trend'], ['Conversion trend']],
    },
  }
  const REC: Record<string, { title: string; category: string; impact: string; action: string }> = {
    rec1: { title: 'Complete the Pixel events (Lead, Purchase, Checkout)', category: 'Pixel', impact: 'The AI starts seeing who converts — much better optimization and audiences.', action: 'Set up the conversion events in Events Manager and test with the Meta Pixel Helper.' },
    rec2: { title: 'Enable the Conversions API (CAPI)', category: 'Setup', impact: 'Recovers data lost on iOS and improves sales attribution.', action: 'Integrate CAPI (server-side) alongside the Pixel for redundant tracking.' },
    rec3: { title: 'Create a remarketing campaign', category: 'Campaigns', impact: 'Warm audiences convert cheaper — usually the highest ROAS in the funnel.', action: 'Create an audience of people who visited the site/engaged in the last 30 days and run a value offer.' },
    rec4: { title: 'Add top-of-funnel (awareness) campaigns', category: 'Funnel', impact: 'Fills the funnel with new audience to nurture and remarket later.', action: 'Run educational content (value lead magnet) targeting a cold audience in your area.' },
    rec5: { title: 'Increase creative diversity', category: 'Campaigns', impact: 'Reduces ad fatigue and improves CTR.', action: 'Generate 3–4 variations (angles and formats) per campaign and A/B test them.' },
    rec6: { title: 'More educational content and Reels', category: 'Content', impact: 'Reels have the highest organic reach today; educational content builds authority.', action: 'Add 2 educational Reels per week to the Content Agent calendar.' },
    rec7: { title: 'Complete business verification', category: 'Setup', impact: 'Unlocks higher limits and builds more trust in the account.', action: 'Submit the business documents in Business Manager.' },
  }
  const ACT: Record<string, string> = {
    a1: 'Set up Pixel events (Lead, Purchase)', a2: 'Enable Conversions API (CAPI)', a3: 'Create a remarketing campaign', a4: 'Create an awareness (top) campaign',
    a5: 'Add 3+ creative variations', a6: 'Increase Reels and educational content', a7: 'Complete business verification', a8: 'Connect Instagram and Page',
  }
  const wk = ['6 wk', '5 wk', '4 wk', '3 wk', '2 wk', 'Now']
  const mo = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul']
  const qt = ['Q3/25', 'Q4/25', 'Q1/26', 'Q2/26']
  return {
    ...d,
    categories: d.categories.map(c => {
      const t = CAT[c.key]
      if (!t) return c
      return { ...c, label: t.label, summary: t.summary, reasons: t.reasons, checks: c.checks.map((k, i) => ({ ...k, label: t.checks[i]?.[0] ?? k.label, note: k.note ? (t.checks[i]?.[1] ?? k.note) : k.note })) }
    }),
    recommendations: d.recommendations.map(r => ({ ...r, ...(REC[r.id] ?? {}) })),
    actions: d.actions.map(a => ({ ...a, label: ACT[a.id] ?? a.label })),
    history: {
      weekly: d.history.weekly.map((h, i) => ({ ...h, period: wk[i] ?? h.period })),
      monthly: d.history.monthly.map((h, i) => ({ ...h, period: mo[i] ?? h.period })),
      quarterly: d.history.quarterly.map((h, i) => ({ ...h, period: qt[i] ?? h.period })),
    },
    executiveSummary: `${biz}'s presence on Meta is healthy overall (${d.overall}/100, above ${d.benchmark.percentile}% of ${segment}), with consistent growth in reach and leads. The biggest opportunities for the next 30 days are in tracking and the funnel: completing the Pixel events and enabling the Conversions API would give the AI far more visibility into who converts, while creating remarketing and top-of-funnel campaigns would balance a funnel that is currently concentrated at the bottom. Prioritizing the Pixel first, the projected score goes from ${d.overall} to ${Math.min(100, d.overall + 14)} in a few weeks.`,
  }
}
