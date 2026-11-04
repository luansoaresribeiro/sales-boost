import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-results-model.mjs
// Fase 5: blocos Marketing × Comercial. Null = desconhecido (nunca 0), consulta com erro = "não foi possível verificar", sem soma entre blocos.
import { marketingBlock, commercialBlock, conversationsByMedia, show, leftOutLines, isPublished } from '../src/pages/dashboard/marketingAi/resultsModel.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }
const src = (rows, okk = true) => ({ ok: okk, rows })
const post = (id, media, status = 'published') => ({ id, status, instagram_media_id: media })
const perf = (media_id, o = {}) => ({ media_id, reach: null, likes: null, comments: null, shares: null, saves: null, ...o })

// ── Marketing ──
let m = marketingBlock(src([]), src([]))
assert.equal(m.state, 'absent'); assert.equal(m.posts, null); assert.equal(m.reach, null); ok('sem posts -> ausência, nada de 0 nas métricas')
m = marketingBlock(src([post('a', 'm1', 'rascunho'), post('b', null, 'aprovado')]), src([]))
assert.equal(m.state, 'absent'); ok('só rascunho/aprovado (não publicado) -> ausência')
m = marketingBlock(src([], false), src([]))
assert.equal(m.state, 'error'); assert.equal(m.posts, null); ok('consulta de posts falhou -> erro, tudo null')
m = marketingBlock(src([post('a', 'm1')]), src([], false))
assert.equal(m.state, 'ok'); assert.equal(m.posts, 1); assert.equal(m.metricsError, true); assert.equal(m.reach, null); ok('métricas falharam -> posts contados, métricas null + aviso')
m = marketingBlock(src([post('a', 'm1')]), src([]))
assert.equal(m.posts, 1); assert.equal(m.reach, null); assert.equal(m.saves, null); assert.equal(m.postsWithoutMetric, 1); assert.equal(m.metricsError, false); ok('publicado sem linha de métrica -> null (sem medição), não 0')
m = marketingBlock(src([post('a', 'm1'), post('b', 'm2'), post('c', null), post('d', 'm3', 'publicado')]),
  src([perf('m1', { reach: 100, saves: 4, likes: 10, comments: 2, shares: null }), perf('m2', { reach: 50, saves: null, likes: 5, comments: 0, shares: null })]))
assert.equal(m.posts, 4); assert.equal(m.reach, 150); assert.equal(m.saves, 4); assert.equal(m.shares, null); assert.equal(m.likes, 15); assert.equal(m.comments, 2)
assert.equal(m.postsWithoutMetric, 2); ok('parcial: soma só o conhecido, campo sem nenhum valor fica null, conta posts sem métrica')
m = marketingBlock(src([post('a', 'm1')]), src([perf('m1', { reach: 0, saves: 0 })]))
assert.equal(m.reach, 0); assert.equal(m.saves, 0); ok('zero medido de verdade continua 0')
m = marketingBlock(src([post('a', 'm1'), post('b', 'm1')]), src([perf('m1', { reach: 10 })]))
assert.equal(m.reach, 10); assert.equal(m.posts, 2); assert.equal(m.postsWithoutMetric, 0); ok('mesma mídia em dois posts não duplica a soma')
assert.equal(isPublished({ status: 'Publicado' }), true); assert.equal(isPublished({ status: null }), false); ok('status publicado (pt/en)')

// ── Conversas ──
const ev = (media_ref, who, intent = 'keyword') => ({ media_ref, intent_detected: intent, ig_user_id: who })
let c = conversationsByMedia([ev('m1', 'u1'), ev('m1', 'u1'), ev('m1', 'u2'), ev('m2', 'u1'), ev('m9', 'u3'), ev('m1', 'u4', null), ev(null, 'u5')], ['m1', 'm2'])
assert.deepEqual(c, { m1: 2, m2: 1 }); ok('conversas: dedup por usuário e post, ignora sem intenção, sem media_ref e de outro post')

// ── Comercial ──
const lead = (o = {}) => ({ visit_at: null, proposal_at: null, closed_at: null, closed_value: null, ...o })
let k = commercialBlock(src([], false), src([]), src([]))
assert.equal(k.state, 'error'); assert.equal(k.leads, null); assert.equal(k.vendas, null); ok('leads falhou -> erro, tudo null')
k = commercialBlock(src([]), src([]), src([]))
assert.equal(k.state, 'ok'); assert.equal(k.leads, 0); assert.equal(k.vendas, 0); assert.equal(k.valor, null); assert.equal(k.conversas, null); ok('zero leads (consulta ok) -> 0 real; conversas null sem post publicado; valor null')
k = commercialBlock(src([lead()]), src([post('a', 'm1')], false), src([]))
assert.equal(k.conversasError, true); assert.equal(k.conversas, null); assert.equal(k.leads, 1); ok('posts falharam -> conversas não verificadas, leads seguem')
k = commercialBlock(src([lead()]), src([post('a', 'm1')]), src([], false))
assert.equal(k.conversasError, true); assert.equal(k.conversas, null); ok('eventos falharam -> conversas não verificadas, nunca 0')
k = commercialBlock(src([lead()]), src([post('a', 'm1')]), src([]))
assert.equal(k.conversas, 0); assert.equal(k.conversasError, false); ok('post com media_id e eventos lidos sem nada -> 0 real')
k = commercialBlock(
  src([lead({ visit_at: 'x' }), lead({ visit_at: 'x', proposal_at: 'x' }), lead({ visit_at: 'x', proposal_at: 'x', closed_at: 'x', closed_value: 500000 }), lead({ closed_at: 'x' }), lead()]),
  src([post('a', 'm1'), post('b', 'm2')]), src([ev('m1', 'u1'), ev('m2', 'u1'), ev('m2', 'u2')]))
assert.equal(k.leads, 5); assert.equal(k.visitas, 3); assert.equal(k.propostas, 2); assert.equal(k.vendas, 2); assert.equal(k.valor, 500000); assert.equal(k.vendasComValor, 1); assert.equal(k.conversas, 3)
ok('parcial: funil, soma só dos valores informados (1 de 2 vendas) e conversas')
k = commercialBlock(src([lead({ closed_at: 'x' })]), src([]), src([]))
assert.equal(k.vendas, 1); assert.equal(k.valor, null); assert.equal(k.vendasComValor, 0); ok('venda sem valor informado -> valor null, não 0')
assert.equal(Object.keys(k).some(x => /score|total|nota/i.test(x)), false); ok('não existe nota única nem total combinado')

// ── Texto ──
assert.equal(show(null, 'sem dado'), 'sem dado'); assert.equal(show(0, 'sem dado'), '0'); assert.equal(show(1500, 'x', 'pt-BR'), '1.500'); ok('show: null vira texto, 0 continua 0')
let l = leftOutLines({ ok: true, count: 3 }, { ok: true, count: 2 }, 'pt')
assert.equal(l[0], '2 leads sem origem registrada'); assert.match(l[1], /3 posts publicados ficaram de fora \(imóvel não registrado\)/); ok('linhas obrigatórias (pt)')
l = leftOutLines({ ok: true, count: 1 }, { ok: true, count: 1 }, 'pt')
assert.equal(l[0], '1 lead sem origem registrada'); assert.match(l[1], /^1 post publicado ficou/); ok('singular')
l = leftOutLines({ ok: false, count: null }, { ok: false, count: null }, 'pt')
assert.match(l[0], /não foi possível verificar/); assert.match(l[1], /não foi possível verificar/); assert.ok(!/\b0\b/.test(l.join(' '))); ok('contagem falhou -> não foi possível verificar, nunca 0')
l = leftOutLines({ ok: true, count: 0 }, { ok: true, count: 0 }, 'en')
assert.equal(l[0], '0 leads without a recorded origin'); ok('zero real, em inglês')
console.log(`\n${n} verificações ok`)
