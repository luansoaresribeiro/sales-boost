export const ORANGE = '#FF6D29'
export const CARD = '#150E08'
export const MUTED = '#BABABA'
export const BORDER = 'rgba(255,255,255,0.06)'
export const D = "'Bricolage Grotesque', system-ui, sans-serif"
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

export interface MarketingAiConfig {
  company_id: string
  agent_name: string
  business_objectives: string | null
  brand_voice: string | null
  tone: string | null
  posting_frequency: string
  preferred_content_types: string[]
  automatic_publishing: boolean
  approval_workflow: 'draft_only' | 'auto_publish'
  competitors: string[]
  brand_colors: string[]
  target_audience: string | null
  content_pillars: string[]
  marketing_goals: string | null
}

export interface TrackingSnapshot {
  id: string
  followers: number | null
  posts_count: number | null
  avg_likes: number | null
  avg_comments: number | null
  engagement_rate: number | null
  best_posting_hour: number | null
  collected_at: string
}

export interface Insight {
  id: string
  pillar: 'tracking' | 'content' | 'competitor' | 'strategy'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low' | null
  status: 'open' | 'dismissed' | 'acted_on'
  created_at: string
}

export interface ContentItem {
  id: string
  idea: string | null
  caption: string | null
  hashtags: string | null
  format: 'reel' | 'carrossel' | 'story' | 'foto' | null
  image_url: string | null
  image_options: string[] | null
  status: 'idea' | 'draft' | 'approved' | 'scheduled' | 'published'
  reasoning: string | null
  campaign_id: string | null
  created_at: string
}

export interface CompetitorRow {
  id: string
  name: string
  instagram_url: string | null
  posting_frequency_days: number | null
  avg_engagement: number | null
  followers: number | null
  last_analyzed_at: string | null
}

export interface StrategyLogRow {
  id: string
  recommendation: string
  reasoning: string
  status: 'proposed' | 'approved' | 'dismissed' | 'implemented'
  created_at: string
}

export interface ChatMessage { role: 'user' | 'assistant'; content: string }

export interface ActivityLogRow {
  id: string
  pillar: string | null
  action: string
  reasoning: string | null
  created_at: string
}

export interface BrainNode {
  id: string
  node_type: 'pattern' | 'learned_behavior' | 'recommendation' | 'successful_strategy' | 'failed_strategy' | 'experiment_result' | 'competitor_observation' | 'brand_fact'
  source_pillar: 'tracking' | 'content' | 'competitor' | 'strategy' | 'experiment'
  title: string
  body: string
  confidence: 'high' | 'medium' | 'low' | null
  created_at: string
}

export interface Experiment {
  id: string
  hypothesis: string
  variable: string
  variant_a: string
  variant_b: string
  status: 'proposed' | 'running' | 'completed' | 'cancelled'
  winner: 'a' | 'b' | 'inconclusive' | null
  results: Record<string, unknown>
  reasoning: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
}

export interface ToolRegistryRow {
  id: string
  name: string
  description: string
  category: string
  connected: boolean
  requires_integration: string | null
  status: 'live' | 'partial' | 'planned'
  notes: string | null
}

export interface ToolConfigRow {
  id: string
  tool_id: string
  enabled: boolean
  settings: Record<string, unknown>
  health: 'ok' | 'warning' | 'error' | 'unknown'
  last_sync_at: string | null
}

export interface Campaign {
  id: string
  name: string
  goal: string | null
  budget: number | null
  status: 'planned' | 'active' | 'completed' | 'cancelled'
  start_date: string | null
  end_date: string | null
  created_at: string
}

export interface Trend {
  id: string
  title: string
  description: string
  category: string | null
  relevance: 'high' | 'medium' | 'low' | null
  detected_at: string
}

export interface MarketingReport {
  id: string
  report_type: 'weekly' | 'monthly' | 'campaign' | 'executive' | 'growth' | 'audience'
  title: string
  summary: string
  period_start: string | null
  period_end: string | null
  created_at: string
}

export const REPORT_TYPE_LABEL: Record<string, string> = {
  weekly: 'Semanal', monthly: 'Mensal', campaign: 'Campanha', executive: 'Executivo', growth: 'Crescimento', audience: 'Audiência',
}

export const BRAIN_NODE_LABEL: Record<string, string> = {
  pattern: 'Padrão', learned_behavior: 'Comportamento aprendido', recommendation: 'Recomendação',
  successful_strategy: 'Estratégia bem-sucedida', failed_strategy: 'Estratégia malsucedida',
  experiment_result: 'Resultado de experimento', competitor_observation: 'Observação de concorrente', brand_fact: 'Fato da marca',
}
export const BRAIN_NODE_ICON: Record<string, string> = {
  pattern: '📊', learned_behavior: '🧩', recommendation: '💡', successful_strategy: '✅',
  failed_strategy: '❌', experiment_result: '🧪', competitor_observation: '🔍', brand_fact: '🏷️',
}

export const IMPACT_COLOR: Record<string, string> = { high: '#f87171', medium: '#FBBF24', low: MUTED }
export const IMPACT_LABEL: Record<string, string> = { high: 'Alto impacto', medium: 'Médio impacto', low: 'Baixo impacto' }
export const PILLAR_LABEL: Record<string, string> = { tracking: 'Tracking', content: 'Conteúdo', competitor: 'Concorrentes', strategy: 'Estratégia' }
export const PILLAR_ICON: Record<string, string> = { tracking: '📈', content: '✍️', competitor: '🔍', strategy: '🧭' }
export const STATUS_LABEL: Record<string, string> = { idea: 'Ideia', draft: 'Rascunho', approved: 'Aprovado', scheduled: 'Agendado', published: 'Publicado' }

export async function callMarketingAi(accessToken: string, action: string, extra: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/marketing-ai`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Erro ao chamar Marketing AI')
  return data
}

// Opcional/manual: gera imagem pra uma linha de conteúdo. O fluxo automático
// (dados da Meta) faz o mesmo sozinho; isto é só o atalho manual do dono.
// action: 'generate' (1 imagem → image_url) | 'variations' (2..4 → image_options)
//       | 'select' (fixa image_url a partir de uma opção; passa `url`).
export async function callContentImage(accessToken: string, contentId: string, action: 'generate' | 'variations' | 'select', extra: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/content-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, content_id: contentId, ...extra }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar imagem')
  return data as { image_url?: string; options?: string[] }
}

export const inputStyle = { padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' } as const

// Classificação de cada formato de imagem: em que etapa do FUNIL ele funciona
// melhor (Topo/Meio/Fundo) e qual OBJETIVO principal (Awareness/Consideration/
// Conversion/Flexible) — pra escolher o formato certo pra cada momento do
// cliente, não só pelo visual. Uma tabela só, reusada nos dois motores de
// template que existem: o motor manual (formatTemplates.tsx/FormatStudio —
// chaves tweet/beforeafter/product/announcement/photo/stat) e o motor do
// Diretor Criativo (creative-generate/TestingArea — chaves livre/tweet/
// beforeafter/announcement/product; "livre" é o equivalente de "photo").
export type FunnelStage = 'topo' | 'meio' | 'fundo'
export interface FormatClass { funnel: FunnelStage[]; objective: string }
export const FORMAT_CLASS: Record<string, FormatClass> = {
  tweet: { funnel: ['topo'], objective: 'Awareness' },
  stat: { funnel: ['topo', 'meio'], objective: 'Awareness' },
  beforeafter: { funnel: ['meio', 'fundo'], objective: 'Consideration' },
  product: { funnel: ['meio', 'fundo'], objective: 'Consideration' },
  announcement: { funnel: ['fundo'], objective: 'Conversion' },
  photo: { funnel: ['topo', 'meio', 'fundo'], objective: 'Flexible' },
  livre: { funnel: ['topo', 'meio', 'fundo'], objective: 'Flexible' },
}
export const FUNNEL_LABEL: Record<FunnelStage, string> = { topo: 'Topo', meio: 'Meio', fundo: 'Fundo' }
export const funnelText = (key: string): string => FORMAT_CLASS[key]?.funnel.map(f => FUNNEL_LABEL[f].toUpperCase()).join(' / ') ?? ''

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  return `${days}d atrás`
}
