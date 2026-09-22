// Tipos, constantes e helpers compartilhados entre a página operacional de
// Leads (ProspectsPage) e a página de configuração (LeadDiscoverySettingsPage)
// — evita duplicar a definição de dados que as duas telas usam.

export const BUSINESS_TYPES = ['Moda & Vestuário', 'Beleza & Cosméticos', 'Acessórios', 'Produtos de Consumo', 'Alimentos & Bebidas', 'E-commerce', 'Serviços Profissionais']

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
  status: string
  discovered_at: string
}

export interface Activity { id: string; activity_type: string; notes: string | null; created_at: string }

export interface ScanLog { id: string; started_at: string; finished_at: string | null; status: string; found_count: number; error_message: string | null; candidates_total: number; candidates_processed: number }

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

export const DEFAULT_WEIGHTS = {
  rating_in_range: 30, reviews_in_range: 15, instagram_active: 15, has_website: 10,
  no_online_ordering: 10, has_phone: 10, independent_business: 10, recent_review: 5, likely_chain_penalty: -40,
}
export type ScoringWeights = typeof DEFAULT_WEIGHTS
export const WEIGHT_LABELS: Record<keyof ScoringWeights, string> = {
  rating_in_range: 'Nota do Google dentro da faixa',
  reviews_in_range: 'Nº de avaliações dentro da faixa',
  instagram_active: 'Instagram ativo',
  has_website: 'Site próprio',
  no_online_ordering: 'Sem pedido online (oportunidade)',
  has_phone: 'Telefone público disponível',
  independent_business: 'Parece negócio independente',
  recent_review: 'Avaliação recente (60 dias)',
  likely_chain_penalty: 'Penalidade se parecer rede/franquia',
}

export function scoreColor(s: number) {
  return s >= 75 ? '#4ade80' : s >= 50 ? '#FBBF24' : '#f87171'
}

export function recommendationTier(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Prioridade alta', color: '#4ade80' }
  if (score >= 60) return { label: 'Prioridade média', color: '#FBBF24' }
  return { label: 'Prioridade baixa', color: '#f87171' }
}
