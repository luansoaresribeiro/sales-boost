import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-flow-strip.mjs
// Regras puras da faixa de fluxo: "próxima rodada" tem que bater com shouldRunOpportunities (opportunityCron.ts).
import { nextOpportunityRound, shortError, fmtStamp, usd, RERUN_AFTER_MS, MIN_BETWEEN_RUNS_MS, RETRY_AFTER_FAIL_MS } from '../src/pages/dashboard/marketingAi/flowStripLogic.ts'
import { shouldRunOpportunities } from '../supabase/functions/_shared/opportunityCron.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }
const H = 3600_000, now = Date.parse('2026-11-01T12:00:00Z')

assert.deepEqual(nextOpportunityRound(null, null), { kind: 'first', atMs: null }); ok('nunca rodou: próxima verificação')
assert.deepEqual(nextOpportunityRound(null, null, now), { kind: 'first', atMs: now + RETRY_AFTER_FAIL_MS }); ok('nunca rodou e falhou: espera 6 h')
const lr = now - 2 * H
assert.deepEqual(nextOpportunityRound(lr, null), { kind: 'weekly', atMs: lr + RERUN_AFTER_MS }); ok('sem sinal novo: 7 dias')
assert.deepEqual(nextOpportunityRound(lr, lr + 1), { kind: 'signal', atMs: lr + MIN_BETWEEN_RUNS_MS }); ok('sinal novo: 24 h depois da última')
assert.deepEqual(nextOpportunityRound(lr, lr - 1), { kind: 'weekly', atMs: lr + RERUN_AFTER_MS }); ok('sinal antigo não conta')
const old = now - 30 * H
assert.equal(nextOpportunityRound(old, old + 1, now - H).atMs, now - H + RETRY_AFTER_FAIL_MS); ok('falha depois da última rodada atrasa')
assert.equal(nextOpportunityRound(lr, lr + 1, lr - H).atMs, lr + MIN_BETWEEN_RUNS_MS); ok('falha antes da última rodada não atrasa')

// Consistência com a regra real: logo antes do instante previsto NÃO roda, logo depois roda (nos casos sem falha).
for (const [run, sig] of [[lr, null], [lr, lr + 1], [now - 30 * 24 * H, null], [now - 10 * H, now - 5 * H]]) {
  const r = nextOpportunityRound(run, sig)
  assert.equal(shouldRunOpportunities(run, sig, r.atMs - 1), false)
  assert.equal(shouldRunOpportunities(run, sig, r.atMs + 1), true)
}
ok('bate com shouldRunOpportunities')
assert.equal(shouldRunOpportunities(null, null, now, now - H), false); assert.equal(nextOpportunityRound(null, null, now - H).atMs, now - H + RETRY_AFTER_FAIL_MS); ok('falha recente coerente com a regra real')

assert.equal(shortError('  a\n\n b  '), 'a b'); assert.equal(shortError('x'.repeat(200), 20).length, 20); assert.equal(shortError(null), ''); ok('shortError')
assert.equal(fmtStamp(null), null); assert.equal(fmtStamp('lixo'), null); assert.match(fmtStamp('2026-11-01T12:00:00Z'), /^\d\d\/\d\d \d\d:\d\d$/); ok('fmtStamp')
assert.equal(usd(null), null); assert.equal(usd('1.5'), 'US$ 1.50'); assert.equal(usd('abc'), null); ok('usd')
console.log(`${n} grupos ok`)
