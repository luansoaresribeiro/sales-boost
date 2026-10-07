// Tipos compartilhados do Agente de Estratégia — StrategySection.tsx e
// StrategyPanels.tsx trabalham em cima da mesma forma de dado.
export interface FunnelStep {
  stage: string; objective: string; audience: string; message: string; format: string
  cta: string; destination: string; metric: string; dependencies: string; horizon: string
}
export interface Budget {
  total: number | null; currency: string; period: string
  paid_ads: number | null; organic: number | null; creative: number | null; other: number | null
  is_flexible: boolean; allocation: { channel: string; amount: number | null; reason: string }[]
  budget_reasoning?: string
}
export interface Estimates {
  time_to_signals: string; time_to_progress: string; time_to_target: string
  confidence: 'high' | 'medium' | 'low' | string
  risks: string
  feasibility_status: 'supports_plan' | 'needs_more_data' | 'needs_adjustment' | 'significant_constraints' | string
  feasibility_reasoning: string
}
export interface Strategy {
  id: string
  kind: 'main' | 'initiative'
  parent_strategy_id: string | null
  name: string
  status: 'draft' | 'active' | 'paused' | 'completed' | 'needs_review' | 'generating' | 'failed'
  thesis: string | null
  primary_constraint: string | null
  strategic_opportunity: string | null
  primary_business_objective: string | null
  primary_marketing_objective: string | null
  strategic_focus: string | null
  horizon: string | null
  review_cadence: string | null
  assumptions: string[]
  constraints: string[]
  exclusions: string[]
  active_components: string[]
  success_conditions: string | null
  failure_conditions: string | null
  reasoning: string | null
  funnel_plan: FunnelStep[]
  budget: Budget
  estimates: Estimates
  created_by: 'ai' | 'user'
  created_at: string
  updated_at: string
  last_reanalyzed_at: string | null
  last_refreshed_at: string | null
}
export interface Goal {
  id: string
  strategy_id: string
  name: string
  goal_type: string
  baseline_value: number | null
  baseline_verified: boolean
  target_value: number | null
  period: string | null
  deadline: string | null
  priority: 'high' | 'medium' | 'low'
  data_source: string | null
  measurement_method: string | null
  current_progress: number | null
  status: 'active' | 'achieved' | 'at_risk' | 'abandoned'
}
export interface LogRow {
  id: string; company_id: string; strategy_id: string | null
  recommendation: string; reasoning: string; status: 'proposed' | 'approved' | 'dismissed' | 'implemented'; created_at: string
  decision_type: 'refine' | 'pivot' | 'terminate' | null
}

export const GOAL_TYPE_LABEL: Record<string, string> = {
  lead_gen: 'Geração de leads', sales: 'Vendas / receita', acquisition: 'Aquisição de clientes', awareness: 'Reconhecimento de marca',
  instagram_growth: 'Crescimento no Instagram', engagement: 'Engajamento', website_conversions: 'Conversões no site',
  whatsapp: 'Conversas no WhatsApp', bookings: 'Agendamentos', retention: 'Retenção de clientes', other: 'Outro',
}
export const STATUS_LABEL: Record<string, string> = { draft: 'Rascunho', active: 'Ativa', paused: 'Pausada', completed: 'Concluída', needs_review: 'Precisa revisão', generating: 'Gerando...', failed: 'Falhou' }
export const STATUS_COLOR: Record<string, string> = { draft: '#BABABA', active: '#4ade80', paused: '#FBBF24', completed: '#60a5fa', needs_review: '#f87171', generating: '#FF6D29', failed: '#f87171' }
export const FEASIBILITY_LABEL: Record<string, string> = {
  supports_plan: 'As condições atuais sustentam o plano', needs_more_data: 'Precisa de mais dado pra ter certeza',
  needs_adjustment: 'O plano precisa de ajustes', significant_constraints: 'Há restrições importantes hoje',
}
export const FEASIBILITY_COLOR: Record<string, string> = { supports_plan: '#4ade80', needs_more_data: '#60a5fa', needs_adjustment: '#FBBF24', significant_constraints: '#f87171' }
export const FUNNEL_STAGE_LABEL: Record<string, string> = { awareness: 'Topo (Reconhecimento)', consideration: 'Meio (Consideração)', conversion: 'Fundo (Conversão)', retention: 'Retenção' }
export const DECISION_TYPE_LABEL: Record<string, string> = { refine: 'Ajustar', pivot: 'Mudar de direção', terminate: 'Encerrar' }
export const DECISION_TYPE_COLOR: Record<string, string> = { refine: '#FBBF24', pivot: '#FF6D29', terminate: '#f87171' }
export const COMPONENT_LABEL: Record<string, string> = {
  positioning: 'Posicionamento', offer: 'Oferta', acquisition: 'Aquisição', content: 'Conteúdo', conversion: 'Conversão',
  customer_service: 'Atendimento', retention: 'Retenção', reactivation: 'Reativação', reputation: 'Reputação',
  competitive_response: 'Resposta à concorrência', digital_infrastructure: 'Infraestrutura digital',
}

// Versão EN dos rótulos acima (mesmas chaves) — usada quando o idioma é 'en'.
const LABELS_EN = {
  GOAL_TYPE: {
    lead_gen: 'Lead generation', sales: 'Sales / revenue', acquisition: 'Customer acquisition', awareness: 'Brand awareness',
    instagram_growth: 'Instagram growth', engagement: 'Engagement', website_conversions: 'Website conversions',
    whatsapp: 'WhatsApp conversations', bookings: 'Bookings', retention: 'Customer retention', other: 'Other',
  } as Record<string, string>,
  STATUS: { draft: 'Draft', active: 'Active', paused: 'Paused', completed: 'Completed', needs_review: 'Needs review', generating: 'Generating...', failed: 'Failed' } as Record<string, string>,
  FEASIBILITY: {
    supports_plan: 'Current conditions support the plan', needs_more_data: 'Needs more data to be sure',
    needs_adjustment: 'The plan needs adjustments', significant_constraints: 'There are important constraints today',
  } as Record<string, string>,
  FUNNEL_STAGE: { awareness: 'Top (Awareness)', consideration: 'Middle (Consideration)', conversion: 'Bottom (Conversion)', retention: 'Retention' } as Record<string, string>,
  DECISION_TYPE: { refine: 'Refine', pivot: 'Change direction', terminate: 'End' } as Record<string, string>,
  COMPONENT: {
    positioning: 'Positioning', offer: 'Offer', acquisition: 'Acquisition', content: 'Content', conversion: 'Conversion',
    customer_service: 'Customer service', retention: 'Retention', reactivation: 'Reactivation', reputation: 'Reputation',
    competitive_response: 'Competitive response', digital_infrastructure: 'Digital infrastructure',
  } as Record<string, string>,
}
export function strategyLabels(lang: 'pt' | 'en') {
  return lang === 'en'
    ? LABELS_EN
    : { GOAL_TYPE: GOAL_TYPE_LABEL, STATUS: STATUS_LABEL, FEASIBILITY: FEASIBILITY_LABEL, FUNNEL_STAGE: FUNNEL_STAGE_LABEL, DECISION_TYPE: DECISION_TYPE_LABEL, COMPONENT: COMPONENT_LABEL }
}

export const EMPTY_BUDGET: Budget = { total: null, currency: 'BRL', period: 'monthly', paid_ads: null, organic: null, creative: null, other: null, is_flexible: true, allocation: [] }
export const EMPTY_ESTIMATES: Estimates = { time_to_signals: '', time_to_progress: '', time_to_target: '', confidence: 'medium', risks: '', feasibility_status: 'needs_more_data', feasibility_reasoning: '' }
