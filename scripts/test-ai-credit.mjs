import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-ai-credit.mjs
// Item 1 (23/11): o monitor acusa IA parada por crédito zerado (o /v1/models não acusa).
import { classifyAiCredit, aiCreditStatus, AI_CREDIT_PROBE } from '../supabase/functions/_shared/aiCredit.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }
const credit = JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.' } })
let c = classifyAiCredit(400, credit)
assert.equal(c.state, 'no_credit'); assert.equal(aiCreditStatus(c.state), 'down'); assert.match(c.detail, /crédito/); ok('crédito zerado = IA parada (down)')
c = classifyAiCredit(401, JSON.stringify({ error: { message: 'invalid x-api-key' } }))
assert.equal(c.state, 'bad_key'); assert.equal(aiCreditStatus(c.state), 'down'); ok('chave recusada = down')
c = classifyAiCredit(429, '{}'); assert.equal(aiCreditStatus(c.state), 'degraded'); ok('rate limit = degraded, não liga a faixa')
c = classifyAiCredit(529, 'overloaded'); assert.equal(aiCreditStatus(c.state), 'degraded'); ok('Anthropic sobrecarregada = degraded')
c = classifyAiCredit(null, 'timeout'); assert.equal(c.state, 'provider_down'); ok('sem resposta = degraded')
c = classifyAiCredit(200, '{"content":[]}'); assert.equal(aiCreditStatus(c.state), 'ok'); ok('200 = ok')
assert.equal(AI_CREDIT_PROBE.max_tokens, 1); ok('pedido mínimo (1 token)')
const mon = readFileSync(new URL('../supabase/functions/platform-monitor/index.ts', import.meta.url), 'utf8')
assert.ok(/t === 'ai_credit'/.test(mon) && /eq\('key', 'ai_paused'\)/.test(mon)); ok('monitor checa o crédito e liga/desliga a faixa')
const layout = readFileSync(new URL('../src/pages/dashboard/DashboardLayout.tsx', import.meta.url), 'utf8')
assert.ok(/<AiPausedBanner \/>/.test(layout)); ok('faixa no painel do cliente')
console.log(`\n${n} testes ok`)
