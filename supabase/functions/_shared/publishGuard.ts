// Etapa 0 (2026-11-07, decisão do dono): nenhuma publicação no Instagram sem aprovação HUMANA.
// O modo automático pode executar ações internas, mas uma ação que publica (ligada a uma peça) só roda
// quando uma pessoa aprovou: approval_status = 'APPROVED' e approved_by preenchido (clique no painel,
// agendamento feito pelo dono ou botão assinado do Telegram). AUTO_APPROVED nunca publica.
// Trava no servidor (agent-actions → execute), não só na tela.

/** Tipos de referência cuja execução publica no Instagram. */
export const PUBLISHING_REF_TYPES = ['marketing_ai_content', 'marketing_ai_test_content'] as const

export const HUMAN_APPROVAL_REQUIRED = 'Publicação no Instagram exige aprovação de uma pessoa. Ação não executada.'

export interface ActLike { ref_type?: string | null; ref_id?: string | null; approval_status?: string | null; approved_by?: string | null }

export function publishes(act: ActLike): boolean {
  return !!act.ref_id && (PUBLISHING_REF_TYPES as readonly string[]).includes(String(act.ref_type ?? ''))
}

export function humanApproved(act: ActLike): boolean {
  return act.approval_status === 'APPROVED' && typeof act.approved_by === 'string' && act.approved_by.length > 0
}

/** null = pode seguir; string = motivo para recusar sem executar. */
export function publishBlockReason(act: ActLike): string | null {
  if (!publishes(act)) return null
  return humanApproved(act) ? null : HUMAN_APPROVAL_REQUIRED
}
