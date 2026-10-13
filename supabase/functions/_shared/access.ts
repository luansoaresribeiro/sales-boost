// Rede de segurança de pagamento (decisão do dono 2026-10-13, docs/DECISIONS.md).
//
// Contas NOVAS (criadas a partir de 2026-10-06) entram em "modo vitrine": veem o
// painel, mas só quem pagou (ou foi liberado à mão pelo Owner) pode usar o que
// gasta IA/provedor pago ou publica/envia. A tela já esconde isso, mas a tela não
// é segurança — quem chama a function direto pularia a tela. Por isso TODA function
// que gasta ou publica, no caminho chamado por USUÁRIO (JWT) e nos varreduras de
// cron, chama este helper (ver docs/PITFALLS.md).
//
// Mesma regra do frontend (src/lib/setupGate.ts → isShowcaseMode):
//  - empresa criada antes de NEW_FLOW_FROM: sempre libera (Liga dos Sonhos, conta Sales Boost);
//  - bloqueada pelo Owner (access_blocked_at): 402;
//  - paga (subscription active/trialing ou stripe_subscription_id) ou liberada à mão: libera;
//  - qualquer outro caso (inclusive o "trial" de 7 dias que o claim-diagnostic ainda grava,
//    que deixou de valer pra conta nova em 2026-10-10): 402.
// Falha ABERTA: se a consulta der erro, libera — um erro de rede/banco nunca pode
// trancar um cliente que paga.
//
// deno-lint-ignore-file no-explicit-any

export const NEW_FLOW_FROM = '2026-10-06T00:00:00Z'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const PLAN_REQUIRED_BODY = { error: 'Disponível no plano', code: 'plan_required' } as const

// true = pode usar. Nunca lança.
export async function hasPaidAccess(admin: any, companyId: string | null | undefined): Promise<boolean> {
  if (!companyId) return true // sem empresa não há o que cobrar aqui (a function trata o resto)
  try {
    const { data: co, error } = await admin.from('companies').select('created_at, stripe_subscription_id, manual_access').eq('id', companyId).maybeSingle()
    if (error || !co) return true
    const t = co.created_at ? new Date(co.created_at as string).getTime() : NaN
    if (!Number.isFinite(t) || t < new Date(NEW_FLOW_FROM).getTime()) return true // conta antiga
    // Mesma função do banco que a tela e o Owner usam (migration 049).
    const { data: acc, error: accErr } = await admin.rpc('company_access_status', { p_company_id: companyId }).maybeSingle()
    if (accErr) return true
    const source = (acc as { source?: string } | null)?.source
    if (source === 'blocked') return false
    if (source === 'paid' || source === 'manual') return true
    // Liberação manual do Owner vale mesmo quando o banco responde "trial"
    // (lá o trial vem antes do manual na prioridade — ex.: Tespon).
    if (co.manual_access === true) return true
    return !!co.stripe_subscription_id
  } catch (e) {
    console.error('[access] consulta falhou — liberando (falha aberta)', String(e))
    return true
  }
}

// Devolve null (libera) ou uma Response 402 pronta pra retornar da function.
export async function requirePaidAccess(admin: any, companyId: string | null | undefined): Promise<Response | null> {
  if (await hasPaidAccess(admin, companyId)) return null
  return new Response(JSON.stringify(PLAN_REQUIRED_BODY), {
    status: 402,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
