// Tipos, constantes e helpers compartilhados entre a página operacional de
// Leads (ProspectsPage) e a página de configuração (LeadDiscoverySettingsPage)
// — evita duplicar a definição de dados que as duas telas usam.

// Público dos leads (decisão do dono 2026-10-11): o setor piloto é imóveis.
// As palavras-chave de cada categoria ficam em prospect_search_keywords.
export const BUSINESS_TYPES = ['Imobiliárias', 'Corretores de imóveis', 'Aluguel por temporada (Airbnb)']

export const STATUS_LABELS: Record<string, string> = { new: 'Novo', contacted: 'Contatado', qualified: 'Qualificado', discarded: 'Descartado', converted: 'Convertido' }
export const STATUS_COLORS: Record<string, string> = { new: '#FF6D29', contacted: '#60a5fa', qualified: '#4ade80', discarded: '#BABABA', converted: '#4ade80' }

export interface ScoreBreakdownItem { label: string; points: number; passed: boolean }

export interface Prospect {
  id: string
  business_name: string
  city: string | null
  address: string | null
  phone: string | null
  website_url: string | null
  instagram_url: string | null
  facebook_url: string | null
  has_whatsapp: boolean
  has_online_ordering: boolean | null
  google_rating: number | null
  google_review_count: number | null
  days_since_last_review: number | null
  price_level: number | null
  is_likely_chain: boolean | null
  marketing_score: number | null
  lead_score: number | null
  icp_confidence: number | null
  score_breakdown: ScoreBreakdownItem[] | null
  ai_summary: string | null
  ai_cold_call_notes: string | null
  // 'ativa' | 'sem_instagram' | 'instagram_parado' (null = lead antigo)
  digital_presence: string | null
  // Sinais de conteúdo do Instagram (ICP 2026-10-15) — null = não medido
  ig_followers: number | null
  ig_last_video_days: number | null
  ig_engagement_rate: number | null
  content_quality: number | null
  content_issues: string | null
  status: string
  discovered_at: string
}

export interface Activity { id: string; activity_type: string; notes: string | null; created_at: string }

export interface ScanLog { id: string; started_at: string; finished_at: string | null; heartbeat_at?: string | null; status: string; found_count: number; error_message: string | null; candidates_total: number; candidates_processed: number }

export interface SearchKeyword { id: string; business_type: string; keyword: string; active: boolean }

export interface QueryLogRow {
  id: string; city: string; business_type: string; keyword: string
  companies_found: number; companies_rejected: number; companies_accepted: number
  avg_lead_score: number | null; search_time_ms: number | null
}

export interface CandidateLogRow {
  id: string; business_name: string | null; search_keyword: string | null; business_type: string | null; city: string | null
  status: 'accepted' | 'rejected'; lead_score: number | null; icp_confidence: number | null; rejection_reason: string | null; checked_at: string
}

// ICP do dono (2026-10-15): imobiliária com Instagram sem vídeo há tempo, OU
// flopado, OU mal produzido — com potencial. Score = POTENCIAL (até 50) +
// OPORTUNIDADE (até 50). Igual ao DEFAULT_WEIGHTS de find-sales-leads.
export const DEFAULT_WEIGHTS = {
  rating_in_range: 15, reviews_in_range: 10, recent_review: 5, has_phone: 5, independent_business: 10, has_audience: 5,
  no_recent_video: 20, low_engagement: 15, poor_quality: 15, weak_presence_opportunity: 25,
  likely_chain_penalty: -40, instagram_active: 0, has_website: 0, no_online_ordering: 0,
}
export type ScoringWeights = typeof DEFAULT_WEIGHTS
export const WEIGHT_LABELS: Record<keyof ScoringWeights, string> = {
  rating_in_range: 'Potencial: nota do Google dentro da faixa',
  reviews_in_range: 'Potencial: nº de avaliações dentro da faixa',
  recent_review: 'Potencial: avaliação recente (60 dias)',
  has_phone: 'Potencial: telefone público',
  independent_business: 'Potencial: negócio independente',
  has_audience: 'Potencial: já tem público no Instagram (300+)',
  no_recent_video: 'Oportunidade: sem vídeo há 90+ dias',
  low_engagement: 'Oportunidade: engajamento baixo (flopado, < 1%)',
  poor_quality: 'Oportunidade: conteúdo mal produzido',
  weak_presence_opportunity: 'Oportunidade: sem Instagram / Instagram parado',
  likely_chain_penalty: 'Penalidade se parecer rede/franquia',
  instagram_active: 'Instagram ativo (antigo — 0 = não conta)',
  has_website: 'Site próprio (antigo — 0 = não conta)',
  no_online_ordering: 'Sem pedido online (antigo — 0 = não conta)',
}

// Selos do diagnóstico de conteúdo (lead com Instagram vivo).
export function contentBadges(p: Prospect): string[] {
  if (p.digital_presence && p.digital_presence !== 'ativa') return []
  const out: string[] = []
  if (p.ig_last_video_days == null && p.ig_followers != null) out.push('🎬 Sem vídeo recente')
  else if (p.ig_last_video_days != null && p.ig_last_video_days >= 90) out.push(`🎬 Último vídeo há ${p.ig_last_video_days} dias`)
  if (p.ig_engagement_rate != null && p.ig_engagement_rate < 1) out.push(`📉 Engajamento ${String(p.ig_engagement_rate).replace('.', ',')}%`)
  if (p.content_quality != null && p.content_quality <= 6) out.push(`🎨 Produção ${p.content_quality}/10`)
  return out
}

// Selo do lead com pouca presença digital — é oportunidade, não defeito.
export const WEAK_PRESENCE_LABEL: Record<string, string> = {
  sem_instagram: '🌱 Sem Instagram no site — oportunidade',
  instagram_parado: '🌱 Instagram parado — oportunidade',
}

export function scoreColor(s: number) {
  return s >= 75 ? '#4ade80' : s >= 50 ? '#FBBF24' : '#f87171'
}

export function recommendationTier(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Prioridade alta', color: '#4ade80' }
  if (score >= 60) return { label: 'Prioridade média', color: '#FBBF24' }
  return { label: 'Prioridade baixa', color: '#f87171' }
}
