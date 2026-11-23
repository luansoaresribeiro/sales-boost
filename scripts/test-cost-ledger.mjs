import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-cost-ledger.mjs
// Etapa A (22/11): tipos de custo separados, sem contar duas vezes, fixo separado do variável, 1 linha por operação.
import { costKindOf, featureOf, providerOf, dedupe, summarize, NAO_MEDIDO } from '../supabase/functions/_shared/costLedger.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

const row = (o) => ({ id: o.id ?? String(Math.random()), company_id: 'A', agent_role: 'conteudo', task_key: 'ai_text_content', cost_usd: 0, tokens_used: 0, created_at: '2026-11-20T10:00:00Z', ...o })

// 1. Tipos (linhas reais de 30 dias, formato do banco)
assert.equal(costKindOf(row({ task_key: 'ai_text_content', cost_usd: '0.068', tokens_used: 14000 })), 'medido')
assert.equal(costKindOf(row({ task_key: 'market_news_search', cost_usd: 0.008, tokens_used: 0 })), 'preco_por_uso')
assert.equal(costKindOf(row({ task_key: 'image_generation', cost_usd: 0.04 })), 'preco_por_uso')
assert.equal(costKindOf(row({ task_key: 'strategy_generate', cost_usd: 0.12, tokens_used: 0 })), 'estimado')
assert.equal(costKindOf(row({ task_key: 'strategy_generate', cost_usd: 0, tokens_used: 0 })), null)   // depois de 10/11: 0, o real vai em ai_text_strategy
assert.equal(costKindOf(row({ task_key: 'opportunity_piece_created', cost_usd: 0 })), null)
assert.equal(costKindOf(row({ cost_usd: 0.01, tokens_used: 500, cost_kind: 'estimado' })), 'estimado')   // o gravado na linha manda
assert.equal(costKindOf(row({ source: 'video_tours', task_key: null, cost_usd: 0.504 })), 'preco_por_uso')
ok('4 tipos: medido, preço por uso, estimado (estratégia antiga) e sem custo fora da soma')

// 2. Funcionalidade, quem paga e provedor
assert.equal(featureOf(row({ task_key: 'ai_text_catalog' })).key, 'post_imovel')
assert.equal(featureOf(row({ task_key: 'ai_text_content' })).key, 'post_semana')
assert.equal(featureOf(row({ task_key: 'ai_text_quality_score' })).key, 'nota_qualidade')
assert.equal(featureOf(row({ task_key: 'ai_vision_links_pair' })).paidByClient, true)
assert.equal(featureOf(row({ task_key: 'ai_vision_staging_check' })).key, 'mobiliado')
assert.equal(featureOf(row({ task_key: 'run_opportunities' })).key, 'oportunidades')
assert.equal(featureOf(row({ task_key: 'ai_text_strategy' })).paidByClient, false)
assert.equal(providerOf(row({ task_key: 'market_news_search' })), 'tavily')
assert.equal(providerOf(row({ task_key: 'ai_text_catalog', provider: 'anthropic' })), 'anthropic')
assert.equal(providerOf(row({ source: 'video_tours' })), 'higgsfield')
ok('funcionalidade, grátis × pago pelo cliente e provedor')

// 3. Anti-duplicação
const a = row({ id: '1', operation_id: 'op1', cost_usd: 0.05, tokens_used: 9000 })
assert.equal(dedupe([a, { ...a }, row({ id: '2', operation_id: 'op1', cost_usd: 0.05, tokens_used: 9000 })]).length, 1)
assert.equal(dedupe([row({ id: '3' }), row({ id: '3', source: 'video_tours' })]).length, 2)   // tabelas diferentes, ids podem coincidir
ok('mesma linha ou mesma operação entra uma vez só')

// 4. Somas batem: por tipo = por cliente = por funcionalidade = total; fixo separado; rateio rotulado
const rows = [
  row({ id: 'p1', company_id: 'A', task_key: 'ai_text_content', cost_usd: 0.07, tokens_used: 14000 }),
  row({ id: 'p2', company_id: 'A', task_key: 'ai_text_catalog', cost_usd: 0.03, tokens_used: 6000, ref_id: 'peca1', operation_id: 'o2' }),
  row({ id: 'p3', company_id: 'A', task_key: 'ai_text_quality_score', cost_usd: 0.02, tokens_used: 4000, ref_id: 'peca1', operation_id: 'o3' }),
  row({ id: 'p4', company_id: 'B', task_key: 'market_news_search', agent_role: 'cmo', cost_usd: 0.008 }),
  row({ id: 'p5', company_id: 'B', task_key: 'strategy_refresh', agent_role: 'estrategia', cost_usd: 0.08, created_at: '2026-11-05T09:00:00Z' }),
  row({ id: 'p5', company_id: 'B', task_key: 'strategy_refresh', agent_role: 'estrategia', cost_usd: 0.08, created_at: '2026-11-05T09:00:00Z' }),  // repetida
  row({ id: 'p6', company_id: 'B', task_key: 'opportunity_piece_created', cost_usd: 0 }),
  row({ id: 't1', company_id: 'A', source: 'video_tours', task_key: null, agent_role: 'tour', cost_usd: 0.504 }),
]
const s = summarize(rows, [{ month: '2026-11-01', item: 'VPS', provider: 'hostinger', amount_usd: 20 }], { A: 'Teste Zero' })
const near = (x, y) => assert.ok(Math.abs(x - y) < 1e-9, `${x} != ${y}`)
near(s.variable.total, 0.07 + 0.03 + 0.02 + 0.008 + 0.08 + 0.504)
near(s.variable.kinds.medido, 0.12); near(s.variable.kinds.preco_por_uso, 0.512); near(s.variable.kinds.estimado, 0.08)
const sum = (bs) => bs.reduce((t, b) => t + b.total, 0)
for (const k of ['byCompany', 'byFeature', 'byOperation', 'byAgent', 'byProvider', 'byDay']) near(sum(s[k]), s.variable.total)
assert.equal(s.variable.rows, 6)
assert.equal(s.byCompany.find(b => b.key === 'A').label, 'Teste Zero')
near(s.freeVsPaid.paidByClient, 0.504); near(s.freeVsPaid.free + s.freeVsPaid.paidByClient, s.variable.total)
assert.equal(s.fixed.total, 20); assert.equal(s.fixed.informed, true); assert.equal(s.fixedPerActiveClient, 10)
assert.ok(!s.byFeature.some(b => b.key === 'fixo'))
ok('somas batem em todos os cortes; fixo fora do variável; rateio = fixo ÷ clientes com custo')
const empty = summarize([], [])
assert.equal(empty.fixed.informed, false); assert.equal(empty.fixedPerActiveClient, null)
ok('sem fixo informado: "não informado", sem rateio')

// 5. Post de imóvel: texto + nota ligados à mesma peça (ref_id), cada um uma operação
const piece = rows.filter(r => r.ref_id === 'peca1')
assert.equal(new Set(piece.map(r => r.operation_id)).size, 2); near(piece.reduce((t, r) => t + r.cost_usd, 0), 0.05)
const pc = s.byPiece.find(p => p.ref === 'peca1'); near(pc.total, 0.05); assert.equal(pc.ops.length, 2); assert.equal(pc.company, 'Teste Zero')
assert.equal(featureOf(row({ source: 'video_tours', kind: 'staging' })).key, 'mobiliado')
ok('post de imóvel = operação de texto + operação de nota, ligadas pela peça (custo por peça na tela)')

// 6. Código: cada chamada à Anthropic das funções instrumentadas soma na operação; cada operação tem id único
const src = (p) => readFileSync(new URL(`../supabase/functions/${p}`, import.meta.url), 'utf8')
for (const f of ['catalog-package/index.ts', 'content-test/index.ts']) {
  const c = src(f)
  assert.equal((c.match(/await res\.json\(\)\n\s+trackUsage\(/g) ?? []).length, (c.match(/api\.anthropic\.com\/v1\/messages/g) ?? []).length, f)
  assert.ok(/withCostScope\(/.test(c) && /beginCostOperation\(\)/.test(c), f)
}
assert.ok(/operationId: crypto\.randomUUID\(\)/.test(src('_shared/costScope.ts')))
assert.ok(/operationId: crypto\.randomUUID\(\), refId: pieceId/.test(src('creative-generate/index.ts')))
assert.ok(/23505/.test(src('_shared/aiCost.ts')))
const mig = readFileSync(new URL('../supabase/migrations/20261122160000_custos_operacao_fixos.sql', import.meta.url), 'utf8')
const sqlOnly = mig.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
assert.ok(/create unique index if not exists agent_performance_operation_uq/i.test(sqlOnly) && !/\b(delete|drop|update|truncate)\b/i.test(sqlOnly))
ok('funções instrumentadas: toda chamada soma; id único; migration só acrescenta')
assert.ok(NAO_MEDIDO.length > 0 && !NAO_MEDIDO.some(x => /catalog-package|content-test/.test(x.fn)))
ok('lista "não medido" sem as funções já medidas')

// 7. Etapa A2: sem conta dupla na ficha da empresa e sem a estimativa de US$ 6/M tokens no total da plataforma
const usage = readFileSync(new URL('../src/pages/owner/CompanyAiUsage.tsx', import.meta.url), 'utf8')
assert.ok(!/COST_PER_1K/.test(usage) && /const rowCost = \(r: PerfRow\) => Number\(r\.cost_usd\) \|\| 0/.test(usage))
const api = src('api-usage/index.ts')
assert.ok(!/\* 6 \*/.test(api) && /summarize\(/.test(api) && /action === 'costs'/.test(api))
ok('ficha da empresa soma só o custo gravado; api-usage usa o classificador único')

console.log(`\n${n} ok`)
