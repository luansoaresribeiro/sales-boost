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
  status: 'draft' | 'active' | 'paused' | 'completed' | 'needs_review'
  primary_business_objective: string | null
  primary_marketing_objective: string | null
  strategic_focus: string | null
  horizon: string | null
  assumptions: string[]
  constraints: string[]
  reasoning: string | null
  funnel_plan: FunnelStep[]
  budget: Budget
  estimates: Estimates
  created_by: 'ai' | 'user'
  created_at: string
  updated_at: string
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
}

export const GOAL_TYPE_LABEL: Record<string, string> = {
  lead_gen: 'Geração de leads', sales: 'Vendas / receita', acquisition: 'Aquisição de clientes', awareness: 'Reconhecimento de marca',
  instagram_growth: 'Crescimento no Instagram', engagement: 'Engajamento', website_conversions: 'Conversões no site',
  whatsapp: 'Conversas no WhatsApp', bookings: 'Agendamentos', retention: 'Retenção de clientes', other: 'Outro',
}
export const STATUS_LABEL: Record<string, string> = { draft: 'Rascunho', active: 'Ativa', paused: 'Pausada', completed: 'Concluída', needs_review: 'Precisa revisão' }
export const STATUS_COLOR: Record<string, string> = { draft: '#BABABA', active: '#4ade80', paused: '#FBBF24', completed: '#60a5fa', needs_review: '#f87171' }
export const FEASIBILITY_LABEL: Record<string, string> = {
  supports_plan: 'As condições atuais sustentam o plano', needs_more_data: 'Precisa de mais dado pra ter certeza',
  needs_adjustment: 'O plano precisa de ajustes', significant_constraints: 'Há restrições importantes hoje',
}
export const FEASIBILITY_COLOR: Record<string, string> = { supports_plan: '#4ade80', needs_more_data: '#60a5fa', needs_adjustment: '#FBBF24', significant_constraints: '#f87171' }
export const FUNNEL_STAGE_LABEL: Record<string, string> = { awareness: 'Topo (Reconhecimento)', consideration: 'Meio (Consideração)', conversion: 'Fundo (Conversão)', retention: 'Retenção' }

export const EMPTY_BUDGET: Budget = { total: null, currency: 'BRL', period: 'monthly', paid_ads: null, organic: null, creative: null, other: null, is_flexible: true, allocation: [] }
export const EMPTY_ESTIMATES: Estimates = { time_to_signals: '', time_to_progress: '', time_to_target: '', confidence: 'medium', risks: '', feasibility_status: 'needs_more_data', feasibility_reasoning: '' }
