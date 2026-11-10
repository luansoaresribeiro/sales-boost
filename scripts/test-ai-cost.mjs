import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-ai-cost.mjs
// A.6 (2026-11-07): (3) estratégia sem custo interno do Sales Boost no texto do cliente; (4) custo real a partir de tokens.
import { anthropicCostUsd, logAiCost, newCostTracker, priceFor, breakdownOf, insertPerf, cachedContent, MIN_CACHE_CHARS } from '../supabase/functions/_shared/aiCost.ts'
import { answerCost } from '../supabase/functions/_shared/opportunityRun.ts'
import { cleanBudgetText, formatCatalogBlock, hasInternalCost, sanitizeContentPlan, stripInternalCost, ensureMinVideos } from '../supabase/functions/_shared/formatCatalog.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

// ── 4) custo a partir de tokens ──────────────────────────────────────────────
assert.equal(anthropicCostUsd('claude-sonnet-4-6', { input_tokens: 1_000_000, output_tokens: 0 }), 3)
assert.equal(anthropicCostUsd('claude-sonnet-4-6', { input_tokens: 0, output_tokens: 1_000_000 }), 15)
assert.equal(anthropicCostUsd('claude-sonnet-4-6', { input_tokens: 10_000, output_tokens: 3_000 }), 0.075)   // 0,03 + 0,045
assert.equal(anthropicCostUsd('claude-haiku-4-5-20251001', { input_tokens: 2_000_000, output_tokens: 1_000_000 }), 7) // 2 + 5
assert.deepEqual(priceFor('modelo-novo'), priceFor('claude-sonnet-4-6'))   // desconhecido = preço do Sonnet (nunca subestima)
assert.equal(anthropicCostUsd('claude-sonnet-4-6', undefined), 0); assert.equal(anthropicCostUsd('claude-sonnet-4-6', { input_tokens: -5, output_tokens: NaN }), 0)
ok('cálculo de custo por tokens (Sonnet 3/15, Haiku 1/5 por milhão; modelo desconhecido = Sonnet; lixo = 0)')

const t = newCostTracker()
t.add('claude-sonnet-4-6', { input_tokens: 10_000, output_tokens: 3_000 })
t.add('claude-haiku-4-5-20251001', { input_tokens: 1_000_000, output_tokens: 0 })
t.add('claude-sonnet-4-6', undefined)   // sem usage: não conta
assert.equal(t.tokens(), 1_013_000); assert.equal(t.calls(), 2); assert.equal(t.costUsd(), 1.075)
ok('acumulador de uma peça soma tokens e dólares das chamadas (Diretor, legenda, refações, guarda)')

const rows = []
const admin = { from: (tb) => ({ insert: async (row) => { rows.push({ tb, row }); return { error: null } } }) }
await logAiCost(admin, { companyId: 'c1', role: 'conteudo', taskKey: 'ai_text_content', description: 'x'.repeat(500), tokens: 13_000, costUsd: 0.075, latencyMs: 1234.6 })
assert.equal(rows.length, 1); const r = rows[0].row
assert.equal(rows[0].tb, 'agent_performance')
assert.deepEqual({ ...r, task_description: r.task_description.length }, { company_id: 'c1', agent_role: 'conteudo', task_key: 'ai_text_content', task_description: 200, tokens_used: 13000, cost_usd: 0.075, latency_ms: 1235, success: true, error_message: null })
await logAiCost(admin, { companyId: 'c1', role: 'conteudo', taskKey: 'k', description: 'd', tokens: 0, costUsd: 0 })
assert.equal(rows.length, 1, 'nada medido = nada gravado (não inventa custo)')
ok('grava em agent_performance no formato das outras functions (tokens_used, cost_usd, latency_ms); sem tokens não grava')
await logAiCost({ from: () => ({ insert: async () => { throw new Error('banco fora') } }) }, { companyId: 'c', role: 'r', taskKey: 'k', description: 'd', tokens: 5, costUsd: 0.1 })
await logAiCost({ from: () => { throw new Error('sem tabela') } }, { companyId: 'c', role: 'r', taskKey: 'k', description: 'd', tokens: 5, costUsd: 0.1 })
ok('falha na gravação nunca quebra o fluxo')

// A estratégia não grava mais o fixo de US$ 0,15 e o creative-generate mede por peça (código-fonte: sem Deno).
const strat = readFileSync(new URL('../supabase/functions/strategy-generate/index.ts', import.meta.url), 'utf8')
const cre = readFileSync(new URL('../supabase/functions/creative-generate/index.ts', import.meta.url), 'utf8')
assert.doesNotMatch(strat, /ESTIMATED_COST_USD|cost_usd: 0\.15|generate: 0\.15/); assert.match(strat, /recordCost\(opts\.cost/); assert.match(strat, /'estrategia_ia'/)
assert.equal((strat.match(/cost: \{ admin, companyId/g) ?? []).length, 4, 'partes 1, 2, 3 e refresh passam o contexto de custo')
assert.match(cre, /ai_text_content/); assert.match(cre, /track\?\.add\('claude-sonnet-4-6', data\.usage\)/)
ok('strategy-generate: custo real por chamada (sem o US$ 0,15 fixo); creative-generate: 1 linha por peça com os tokens medidos')

// ── 3) estratégia sem custo interno ──────────────────────────────────────────
// Textos REAIS das estratégias 5946c3c7 / 22d120e1.
const real1 = 'Cada vídeo custa ~US$ 0,42–0,50 gerado pelo Sales Boost, debitado do teto mensal contratado. Vídeo mostra o imóvel por dentro.'
const real2 = 'Mínimo de 3 vídeos por semana (regra do setor), porque vídeo constrói confiança.'
assert.ok(hasInternalCost(real1) && hasInternalCost(real2))
assert.equal(stripInternalCost(real1), 'Vídeo mostra o imóvel por dentro.')
assert.equal(stripInternalCost(real2), '')   // a frase inteira cita a diretriz: sai por inteiro
ok('frases com custo interno (US$, teto, débito, "mínimo de 3 vídeos", "regra do setor") saem; o resto da frase vizinha fica')
const budget = cleanBudgetText({ total: null, currency: 'BRL', allocation: [{ channel: 'Vídeos curtos', amount: null, reason: real1 }, { channel: 'Posts', amount: 500, reason: 'Posts e carrosséis semanais.' }], budget_reasoning: `${real2} O dono não informou orçamento mensal.` })
assert.equal(budget.allocation[0].reason, 'Vídeo mostra o imóvel por dentro.'); assert.equal(budget.allocation[1].reason, 'Posts e carrosséis semanais.')
assert.equal(budget.budget_reasoning, 'O dono não informou orçamento mensal.'); assert.equal(budget.currency, 'BRL'); assert.equal(budget.allocation[1].amount, 500)
assert.deepEqual(cleanBudgetText(null), {}); assert.deepEqual(cleanBudgetText({ allocation: 'x' }), { allocation: 'x' })
ok('orçamento da estratégia (allocation[].reason + budget_reasoning) sai sem custo interno; números e demais campos intocados')

const fmts = [
  { key: 'reel_item', name: 'Vídeo do imóvel', pillar: 'vitrine', producer: 'item_video', status: 'live', cost: '~US$ 0,42 por vídeo (5 s)' },
  { key: 'post_card', name: 'Post card', pillar: 'qualquer', producer: 'post', status: 'live', cost: 'centavos' },
]
const block = formatCatalogBlock(fmts)
assert.doesNotMatch(block, /US\$|teto|custo:|centavos/i); assert.match(block, /reel_item/)
ok('catálogo de formatos no prompt: sem custo da ficha e sem "custa ~US$ … do teto mensal"')

// Prompts montados em strategy-generate (constantes lidas do código-fonte): nenhum preço/teto ensinado à IA como dado a citar.
const mixRules = strat.slice(strat.indexOf('const weeklyMixRules'), strat.indexOf('// Com Social Selling na ficha'))
const scope = strat.slice(strat.indexOf('const SCOPE_BLOCK'), strat.indexOf('// Opções que o Hermes recebe'))
for (const [nome, txt] of [['weeklyMixRules', mixRules], ['SCOPE_BLOCK', scope]]) {
  assert.doesNotMatch(txt, /US\$ ?\d|custa ~|teto mensal de/i, nome)
}
assert.match(mixRules, /NUNCA cite preço/); assert.match(scope, /NUNCA cite o custo interno/)
assert.match(scope, /\$\{ss\?\.block|O QUE O SALES BOOST/)
// Os 3 prompts (partes 1, 2 e refresh) levam o SCOPE_BLOCK com a proibição; a parte 3 (orçamento) é limpa em código.
assert.equal((strat.match(/\$\{formatCatalogBlock\(formats\)\}\$\{SCOPE_BLOCK\}/g) ?? []).length, 3)
assert.match(strat, /budget: parsed3\.budget && typeof parsed3\.budget === 'object' \? cleanBudgetText\(parsed3\.budget\)/)
ok('prompt da estratégia: sem preço/teto, com proibição explícita; orçamento passa por cleanBudgetText antes de gravar')

// Mix: vídeo de mínimo entra com texto neutro; purpose/why vindos da IA também passam pelo filtro.
const mix = ensureMinVideos([], fmts, 3)
assert.equal(mix.length, 1); assert.equal(mix[0].per_week, 3); assert.doesNotMatch(mix[0].purpose, /m[ií]nimo|regra do setor|US\$/i)
const plan = sanitizeContentPlan({ central_line: 'Linha', why: 'Vídeo ajuda. Custa US$ 0,42 do teto mensal.', weekly_mix: [{ format: 'reel_item', per_week: 3, purpose: 'Mostrar o imóvel. Debitado do teto mensal.' }] }, fmts, null, 0)
assert.equal(plan.why, 'Vídeo ajuda.'); assert.equal(plan.weekly_mix[0].purpose, 'Mostrar o imóvel.')
ok('mix semanal: texto do vídeo de mínimo neutro; "why" e "purpose" da IA sem custo interno (a política de 3 vídeos/semana NÃO mudou: per_week = 3)')


// ── Medição 10/11: reaproveitamento de prompt (cache) e origem da chamada ─────────────────────────────────────────
// Sonnet: entrada 3/milhão. Escrita no cache 5 min = 1,25× (3,75), 1 h = 2× (6), leitura = 0,1× (0,30).
assert.equal(anthropicCostUsd('claude-sonnet-4-6', { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 1_000_000 }), 3.75)
assert.equal(anthropicCostUsd('claude-sonnet-4-6', { cache_creation_input_tokens: 1_000_000, cache_creation: { ephemeral_1h_input_tokens: 1_000_000 } }), 6)
assert.equal(anthropicCostUsd('claude-sonnet-4-6', { cache_read_input_tokens: 1_000_000 }), 0.3)
assert.equal(anthropicCostUsd('claude-sonnet-4-6', { input_tokens: 10_000, output_tokens: 3_000 }), 0.075)   // sem cache: igual a antes
ok('custo com cache: escrita 1,25× (5 min) / 2× (1 h), leitura 0,1×; sem cache, valor igual ao de antes')
const tc = newCostTracker()
tc.add('claude-sonnet-4-6', { input_tokens: 500, output_tokens: 300, cache_creation_input_tokens: 2000 })
tc.add('claude-sonnet-4-6', { input_tokens: 500, output_tokens: 300, cache_read_input_tokens: 2000 })
assert.deepEqual(tc.breakdown(), { input: 1000, output: 600, cacheWrite: 2000, cacheRead: 2000 }); assert.equal(tc.tokens(), 5600)
ok('acumulador separa entrada, saída, cache escrito e cache lido')
const rows2 = []
const adm2 = { from: () => ({ insert: async (row) => { rows2.push(row); return { error: null } } }) }
await logAiCost(adm2, { companyId: 'c1', role: 'conteudo', taskKey: 'ai_text_content', description: 'x', tokens: 5600, costUsd: 0.01, breakdown: tc.breakdown(), trigger: 'cron' })
assert.deepEqual([rows2[0].input_tokens, rows2[0].output_tokens, rows2[0].cache_write_tokens, rows2[0].cache_read_tokens, rows2[0].call_origin], [1000, 600, 2000, 2000, 'cron'])
ok('grava as colunas novas (tokens separados e origem cron/manual)')
const rows3 = []
const adm3 = { from: () => ({ insert: async (row) => { rows3.push(row); return 'call_origin' in row ? { error: { message: 'column "call_origin" does not exist' } } : { error: null } } }) }
await insertPerf(adm3, { company_id: 'c1', task_key: 'k', tokens_used: 1 }, { breakdown: breakdownOf({ input_tokens: 1 }), trigger: 'manual' })
assert.equal(rows3.length, 2); assert.equal('call_origin' in rows3[1], false); assert.equal(rows3[1].tokens_used, 1)
ok('migration pendente: grava de novo sem as colunas novas (a medição antiga nunca se perde)')
assert.deepEqual(answerCost(0), { tokens: 0, costUsd: null, breakdown: null })
assert.deepEqual(answerCost({ text: '', tokens: 13000 }), { tokens: 13000, costUsd: null, breakdown: null })
const ac = answerCost({ text: '', tokens: 13000, model: 'claude-sonnet-4-6', usage: { input_tokens: 10_000, output_tokens: 3_000 } })
assert.equal(ac.costUsd, 0.075); assert.equal(ac.breakdown.input, 10000)
ok('oportunidades: dólares medidos quando a IA devolve usage; sem usage, custo fica vazio (não inventa)')

// ── Passo 3 (10/11): reaproveitamento de prompt SEM mudar o texto ──────────────────────────────────────────────────
const big = 'Você é o agente de marketing da Imobiliária X. '.repeat(80)   // > 3.000 caracteres
const prompt = big + '\n\nAgora escreva a legenda do imóvel.'
const parts = cachedContent(prompt, big)
assert.ok(Array.isArray(parts) && parts.length === 2 && parts[0].cache_control?.type === 'ephemeral' && !parts[1].cache_control)
assert.equal(parts.map(x => x.text).join(''), prompt); ok('o texto enviado é IDÊNTICO ao prompt (começo marcado + resto)')
assert.equal(cachedContent(prompt, big.slice(0, MIN_CACHE_CHARS - 1)), prompt); ok('começo curto demais: manda como antes (texto único)')
assert.equal(cachedContent(prompt, 'outro começo'.repeat(400)), prompt); ok('começo que não bate com o prompt: manda como antes')
assert.equal(cachedContent(big + '   \n', big), big + '   \n'); assert.equal(cachedContent(prompt, null), prompt); ok('sem resto ou sem começo: manda como antes')
for (const f of ['creative-generate', 'strategy-generate']) assert.match(readFileSync(new URL(`../supabase/functions/${f}/index.ts`, import.meta.url), 'utf8'), /cachedContent\(prompt, /, f)
ok('peças e estratégia (partes 2 e 3) usam o reaproveitamento')
console.log(`\n${n} verificações ok`)
