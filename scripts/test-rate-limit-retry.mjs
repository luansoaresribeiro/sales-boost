// Roda: node --experimental-strip-types scripts/test-rate-limit-retry.mjs
// C1 (16/11): o plano de domingo perdia posts quando o Supabase limitava as chamadas entre funções.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { parseRetryAfterMs, isRateLimit, shouldRetry, fetchRetry, mapLimit } = await import('../supabase/functions/_shared/rateLimitRetry.ts')

// Mensagem real do log de 15/11
const real = 'RateLimitError: Rate limit exceeded for trace 01a1e102817d7ae6a5618524e6249d74. Retry after 8223ms.'
assert.equal(parseRetryAfterMs(real), 8223)
assert.equal(parseRetryAfterMs('Retry after 10ms'), null)          // sem "rate limit exceeded" não é limite
assert.equal(parseRetryAfterMs('Rate limit exceeded'), null)
const err = new Error(real); err.name = 'RateLimitError'
assert.equal(isRateLimit(err), true)
assert.equal(isRateLimit(new Error('boom')), false)

// Espera curta cabe; espera longa (48 s) não; tentativas e orçamento têm teto
assert.ok(shouldRetry(8223, 0, 0) >= 8223)
assert.equal(shouldRetry(48855, 0, 0), null)
assert.equal(shouldRetry(1000, 2, 0), null)                       // 3ª tentativa já foi
assert.equal(shouldRetry(10_000, 0, 20_000), null)                // passaria do orçamento de 25 s
assert.ok(shouldRetry(null, 0, 0) >= 3000)                        // sem número: espera padrão

// fetchRetry: 1ª chamada recusada pelo limite, 2ª passa
let calls = 0
globalThis.fetch = async () => { calls++; if (calls === 1) { const e = new Error('Rate limit exceeded for trace x. Retry after 600ms.'); e.name = 'RateLimitError'; throw e } return new Response('ok') }
const res = await fetchRetry('https://x', {}, { maxWaitMs: 1000 })
assert.equal(await res.text(), 'ok'); assert.equal(calls, 2)
// Erro que não é limite passa direto
globalThis.fetch = async () => { throw new Error('rede caiu') }
await assert.rejects(fetchRetry('https://x', {}), /rede caiu/)

// mapLimit: ordem mantida e no máximo 2 ao mesmo tempo
let live = 0, peak = 0
const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => { live++; peak = Math.max(peak, live); await new Promise(r => setTimeout(r, 5)); live--; return n * 10 })
assert.deepEqual(out, [10, 20, 30, 40, 50, 60]); assert.equal(peak, 2)

// O creative-generate usa: render-format e content-test com nova tentativa, slides com no máximo 2, vagas espaçadas
const cg = readFileSync('supabase/functions/creative-generate/index.ts', 'utf8')
assert.ok(cg.includes('fetchRetry(`${supabaseUrl}/functions/v1/render-format`'))
assert.ok(cg.includes('mapLimit(deckSlides, 2,'))
assert.ok(cg.includes('DISPATCH_GAP_MS'))
assert.equal((cg.match(/fetchRetry\(`\$\{supabaseUrl\}\/functions\/v1\/content-test`/g) ?? []).length, 2)
console.log('ok — limite de chamadas: nova tentativa, slides 2 por vez e vagas espaçadas')
