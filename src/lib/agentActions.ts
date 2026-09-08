// Cliente da Central de Approvals (edge function `agent-actions`).
// Todo agente/produtor PROPÕE aqui; o motor decide auto vs manual; o dono
// aprova/rejeita/edita. Nada executa fora deste caminho.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

export type ApprovalStatus = 'PENDING' | 'AUTO_APPROVED' | 'APPROVED' | 'REJECTED' | 'EDITED' | 'CANCELLED'
export type ExecutionStatus = 'NOT_READY' | 'QUEUED' | 'EXECUTING' | 'EXECUTED' | 'FAILED'

export interface AgentAction {
  id: string
  company_id: string
  agent_key: string
  agent_name: string | null
  action_type: string
  channel: string | null
  integration: string | null
  target: string | null
  title: string
  description: string | null
  agent_interpretation: string | null
  reason: string | null
  expected_outcome: string | null
  payload: Record<string, unknown>
  risk_level: string
  priority: string
  source: string | null
  ref_type: string | null
  ref_id: string | null
  automation_enabled: boolean
  approval_status: ApprovalStatus
  execution_status: ExecutionStatus
  created_at: string
  approved_at: string | null
  executed_at: string | null
  execution_result: Record<string, unknown> | null
  execution_error: string | null
  external_id: string | null
}

async function call(token: string, body: Record<string, unknown>): Promise<{ action?: AgentAction; actions?: AgentAction[]; error?: string }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-actions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Erro na Central de Approvals')
  return data
}

export interface ProposeInput {
  company_id: string
  agent_key?: string
  agent_name?: string
  action_type: string
  channel?: string
  integration?: string
  target?: string
  title: string
  description?: string
  agent_interpretation?: string
  reason?: string
  expected_outcome?: string
  payload?: Record<string, unknown>
  risk_level?: 'low' | 'medium' | 'high'
  priority?: 'low' | 'normal' | 'high'
  source?: string
  ref_type?: string
  ref_id?: string
  automation_enabled?: boolean
}

export const proposeAgentAction = (token: string, input: ProposeInput) =>
  call(token, { action: 'propose', ...input }).then(r => r.action!)

export const listAgentActions = (token: string, company_id: string, status?: 'pending' | 'history') =>
  call(token, { action: 'list', company_id, status }).then(r => r.actions ?? [])

export const decideAgentAction = (token: string, company_id: string, id: string, decision: 'approve' | 'reject' | 'cancel') =>
  call(token, { action: decision, company_id, id }).then(r => r.action!)

export const editAgentAction = (token: string, company_id: string, id: string, patch: Partial<Pick<AgentAction, 'title' | 'description' | 'payload' | 'reason' | 'expected_outcome' | 'agent_interpretation' | 'priority' | 'risk_level'>>) =>
  call(token, { action: 'edit', company_id, id, ...patch }).then(r => r.action!)

export const APPROVAL_META: Record<ApprovalStatus, { label: string; color: string }> = {
  PENDING: { label: 'Aguardando aprovação', color: '#FBBF24' },
  AUTO_APPROVED: { label: 'Auto-aprovada', color: '#60a5fa' },
  APPROVED: { label: 'Aprovada', color: '#4ade80' },
  REJECTED: { label: 'Rejeitada', color: '#f87171' },
  EDITED: { label: 'Editada', color: '#c084fc' },
  CANCELLED: { label: 'Cancelada', color: '#BABABA' },
}
export const EXECUTION_META: Record<ExecutionStatus, { label: string; color: string }> = {
  NOT_READY: { label: 'Não pronta', color: '#BABABA' },
  QUEUED: { label: 'Na fila', color: '#60a5fa' },
  EXECUTING: { label: 'Executando', color: '#FBBF24' },
  EXECUTED: { label: 'Executada', color: '#4ade80' },
  FAILED: { label: 'Falhou', color: '#f87171' },
}
