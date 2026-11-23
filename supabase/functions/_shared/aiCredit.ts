// Item 1 da estratégia (dono, 23/11): avisar quando a IA para. O `GET /v1/models` responde 200 mesmo com o crédito da
// Anthropic zerado — foi assim que a IA ficou parada em 23/11 sem ninguém saber. A checagem real é um pedido mínimo
// (max_tokens 1) e esta função pura lê a resposta. Testado em scripts/test-ai-credit.mjs.

export type AiCreditState = 'ok' | 'no_credit' | 'bad_key' | 'rate_limited' | 'provider_down' | 'unknown'

export const AI_CREDIT_PROBE = { model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{ role: 'user', content: 'ok' }] }

export function classifyAiCredit(status: number | null, body: string): { state: AiCreditState; detail: string } {
  const msg = (() => { try { return String(JSON.parse(body)?.error?.message ?? '') } catch { return body.slice(0, 200) } })()
  if (status === null) return { state: 'provider_down', detail: 'A Anthropic não respondeu.' }
  if (status >= 200 && status < 300) return { state: 'ok', detail: 'IA respondendo normalmente.' }
  if (/credit balance|billing|purchase credits/i.test(msg)) return { state: 'no_credit', detail: 'IA parada: o crédito da Anthropic acabou.' }
  if (status === 401 || status === 403) return { state: 'bad_key', detail: `IA parada: a chave da Anthropic foi recusada (HTTP ${status}).` }
  if (status === 429) return { state: 'rate_limited', detail: 'IA no limite de uso por minuto (HTTP 429); volta sozinha.' }
  if (status >= 500) return { state: 'provider_down', detail: `A Anthropic está com problema (HTTP ${status}).` }
  return { state: 'unknown', detail: `Resposta inesperada da Anthropic (HTTP ${status}): ${msg.slice(0, 120)}` }
}

/** Estado do monitor: crédito zerado ou chave recusada = IA parada para todos (down); limite/instabilidade = degraded. */
export function aiCreditStatus(state: AiCreditState): 'ok' | 'degraded' | 'down' | 'unknown' {
  if (state === 'ok') return 'ok'
  if (state === 'no_credit' || state === 'bad_key') return 'down'
  if (state === 'rate_limited' || state === 'provider_down') return 'degraded'
  return 'unknown'
}
