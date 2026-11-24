import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-ai-models.mjs
// Economia de IA (dono 23/11): modelo por tipo de tarefa, sem raciocínio estendido, texto lido pelo tipo do bloco.
import { claudeBody, MODEL_SUPPORT, MODEL_WRITE, textOf, thinkingOff } from '../supabase/functions/_shared/aiModels.ts'
import { anthropicCostUsd } from '../supabase/functions/_shared/aiCost.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

assert.equal(MODEL_WRITE, 'claude-sonnet-5-5'); assert.equal(MODEL_SUPPORT, 'claude-haiku-5-5'); ok('escrita no Sonnet 5.5, apoio no Haiku 5.5')
assert.deepEqual(thinkingOff(MODEL_WRITE), { type: 'between_tools' }); ok('Sonnet 5.5 sem raciocínio = between_tools (disabled dá 400)')
assert.deepEqual(thinkingOff(MODEL_SUPPORT), { type: 'disabled' }); ok('Haiku 5.5 sem raciocínio = disabled')
assert.equal(thinkingOff('claude-sonnet-4-6'), undefined); ok('modelo antigo não recebe campo novo')
const b = claudeBody(MODEL_WRITE, { max_tokens: 100, messages: [{ role: 'user', content: 'oi' }] })
assert.equal(b.model, MODEL_WRITE); assert.equal(b.max_tokens, 100); assert.ok(!('temperature' in b)); ok('corpo do pedido sem temperature')

assert.equal(textOf({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'olá' }] }), 'olá'); ok('bloco de raciocínio antes do texto é ignorado')
assert.equal(textOf({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }), 'ab'); ok('vários blocos de texto são juntados')
assert.equal(textOf(null), ''); assert.equal(textOf({}), ''); ok('resposta vazia = texto vazio')

// Preço: a mesma chamada (10 mil tokens de entrada, 1 mil de saída) fica mais barata nos modelos novos.
const u = { input_tokens: 10_000, output_tokens: 1_000 }
const old = anthropicCostUsd('claude-sonnet-4-6', u), w = anthropicCostUsd(MODEL_WRITE, u), s = anthropicCostUsd(MODEL_SUPPORT, u)
assert.equal(old, 0.045); assert.equal(w, 0.03); assert.equal(s, 0.0015); ok(`custo da mesma chamada: Sonnet 4.6 US$ ${old} → Sonnet 5.5 US$ ${w} → Haiku 5.5 US$ ${s}`)

// Nenhuma das funções migradas manda mais o modelo antigo nem lê só o primeiro bloco.
const files = ['creative-generate/index.ts', 'strategy-generate/index.ts', 'catalog-package/index.ts', 'marketing-ai/index.ts', 'content-test/index.ts',
  '_shared/contentLessons.ts', '_shared/socialSelling.ts', '_shared/marketScan.ts', '_shared/faqCheck.ts']
for (const f of files) {
  const src = readFileSync(new URL(`../supabase/functions/${f}`, import.meta.url), 'utf8')
  assert.ok(!/claude-sonnet-4-6|claude-haiku-4-5/.test(src), `${f} ainda cita modelo antigo`)
  assert.ok(!/content\?\.\[0\]\?\.text/.test(src), `${f} ainda lê content[0].text`)
}
ok('funções de conteúdo, estratégia e mercado usam o modelo por tarefa')
const ct = readFileSync(new URL('../supabase/functions/content-test/index.ts', import.meta.url), 'utf8')
assert.ok(/callClaude\(anthropicKey, prompt, 400, MODEL_SUPPORT\)/.test(ct)); ok('nota de qualidade no modelo de apoio')

console.log(`\n${n} testes ok`)
