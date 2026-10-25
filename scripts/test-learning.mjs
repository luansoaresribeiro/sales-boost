// Roda: node --experimental-strip-types scripts/test-learning.mjs
import assert from 'node:assert/strict'
import { computeEightyTwenty as run, learningHighlights, learningPromptBlock } from '../supabase/functions/_shared/learning.ts'

const NOW = Date.parse('2026-10-01T12:00:00Z')
let n = 0
const post = (pillar, i, media = true, extra = {}) => ({
  instagram_media_id: media ? `m_${pillar}_${i}` : null, pillar, recipe: null, format: null,
  published_at: new Date(NOW - (i + 1) * 86400000).toISOString(), ...extra,
})
const ev = (pillar, i, user) => ({ media_ref: `m_${pillar}_${i}`, intent_detected: 'quer_info', ig_user_id: user, created_at: new Date(NOW - 3600000).toISOString() })
const posts3 = p => [0, 1, 2].map(i => post(p, i))
const t = (name, fn) => { fn(); n++; console.log('ok -', name) }
const g = (r, k) => r.groups.find(x => x.kind === 'pillar' && x.key === k)

t('vazio', () => {
  const r = run([], [], [], { now: NOW })
  assert.equal(r.status, 'insufficient_data'); assert.equal(r.groups.length, 0)
})
t('1 post', () => {
  const r = run([post('a', 0)], [ev('a', 0, 'u1')], [], { now: NOW })
  assert.equal(r.status, 'insufficient_data'); assert.equal(g(r, 'a').score, null)
})
t('grupo com 2 posts = insuficiente', () => {
  const posts = [...posts3('a'), post('b', 0), post('b', 1)]
  const r = run(posts, [ev('a', 0, 'u1'), ev('b', 0, 'u2')], [], { now: NOW })
  assert.equal(g(r, 'b').status, 'insufficient_data'); assert.equal(g(r, 'b').score, null)
  assert.equal(r.status, 'insufficient_data') // só 1 grupo elegível
})
t('só curtidas/alcance => insuficiente (sem conversas)', () => {
  const posts = [...posts3('a'), ...posts3('b')]
  const perf = posts.map(p => ({ media_id: p.instagram_media_id, saves: null, shares: null, likes: 999, reach: 99999 }))
  const r = run(posts, [], perf, { now: NOW })
  assert.equal(r.status, 'insufficient_data')
})
t('null != 0', () => {
  const posts = [...posts3('a'), ...posts3('b')]
  const r = run(posts, [ev('a', 0, 'u1'), ev('b', 0, 'u2')], [{ media_id: 'm_a_0', saves: 0, shares: 0 }], { now: NOW })
  assert.equal(g(r, 'a').saves, 0); assert.equal(g(r, 'b').saves, null); assert.equal(g(r, 'b').shares, null)
})
t('empate: mesmo rank e fatias somam 100', () => {
  const posts = [...posts3('a'), ...posts3('b')]
  const r = run(posts, [ev('a', 0, 'u1'), ev('b', 0, 'u2')], [], { now: NOW })
  assert.equal(r.status, 'ok'); assert.equal(g(r, 'a').rank, 1); assert.equal(g(r, 'b').rank, 1)
  assert.equal(g(r, 'a').suggested_share_pct + g(r, 'b').suggested_share_pct, 100)
})
t('3 pilares com 80/20 claro + dedup por usuário', () => {
  const posts = [...posts3('a'), ...posts3('b'), ...posts3('c')]
  const events = [
    ev('a', 0, 'u1'), ev('a', 0, 'u1'), ev('a', 1, 'u2'), ev('a', 2, 'u3'), ev('a', 2, 'u4'), // a: 5 conversas (u1 duplicado)
    ev('b', 0, 'u5'),
    // c: nenhuma
  ]
  const perf = [{ media_id: 'm_b_0', saves: 2, shares: 1 }]
  const r = run(posts, events, perf, { now: NOW })
  assert.equal(r.status, 'ok')
  assert.equal(g(r, 'a').conversas, 4) // u1 contado 1x
  assert.equal(g(r, 'a').score, 12); assert.equal(g(r, 'b').score, 6); assert.equal(g(r, 'c').score, 0)
  assert.equal(g(r, 'a').status, 'maintain'); assert.equal(g(r, 'a').rank, 1)
  assert.equal(g(r, 'c').status, 'test'); assert.equal(g(r, 'c').rank, 3)
  const sum = r.groups.filter(x => x.kind === 'pillar').reduce((s, x) => s + (x.suggested_share_pct ?? 0), 0)
  assert.equal(sum, 100)
})
t('fora da janela de 56 dias é ignorado', () => {
  const old = [0, 1, 2].map(i => post('a', i, true, { published_at: new Date(NOW - (60 + i) * 86400000).toISOString() }))
  const r = run([...old, ...posts3('b')], [ev('b', 0, 'u1')], [], { now: NOW })
  assert.equal(r.basis.posts_in_window, 3)
})

// ── rótulos novos: família, pilar_ss, família × pilar ──
const lp = (fam, ps, i, extra = {}) => post(`${fam}${ps}`, i, true, { familia: fam, pilar_ss: ps, ...extra })
const combo = (r, k) => r.groups.find(x => x.kind === 'familia_pilar' && x.key === k)
t('combo único em 1º: frase pronta por código', () => {
  const posts = [0, 1, 2].flatMap(i => [lp('fx', 'p1', i), lp('fy', 'p2', i)])
  const events = [ev('fxp1', 0, 'u1'), ev('fxp1', 1, 'u2'), ev('fyp2', 0, 'u3')]
  const r = run(posts, events, [{ media_id: 'm_fxp1_0', saves: 2, shares: null }], { now: NOW })
  assert.equal(r.status_by_kind.familia_pilar, 'ok')
  assert.equal(combo(r, 'fx × p1').rank, 1); assert.equal(combo(r, 'fx × p1').suggested_share_pct, null)
  const h = learningHighlights(r)
  assert.equal(h.length, 1); assert.match(h[0], /fx × p1/); assert.match(h[0], /2 conversa/); assert.match(h[0], /2 save/); assert.doesNotMatch(h[0], /compartilhamento/)
  assert.match(learningPromptBlock(r), /cite só estas/)
})
t('empate no 1º lugar: sem frase', () => {
  const posts = [0, 1, 2].flatMap(i => [lp('fx', 'p1', i), lp('fy', 'p2', i)])
  const r = run(posts, [ev('fxp1', 0, 'u1'), ev('fyp2', 0, 'u2')], [], { now: NOW })
  assert.equal(r.status_by_kind.familia_pilar, 'ok'); assert.deepEqual(learningHighlights(r), [])
  assert.doesNotMatch(learningPromptBlock(r), /cite só estas/)
})
t('rótulos ausentes: grupos novos vazios, avisos e contadores', () => {
  const posts = [...posts3('a'), ...posts3('b')]
  const r = run(posts, [ev('a', 0, 'u1')], [], { now: NOW })
  assert.equal(r.status_by_kind.familia_pilar, 'insufficient_data'); assert.equal(r.groups.filter(x => x.kind === 'familia_pilar').length, 0)
  assert.equal(r.basis.posts_without_familia, 6); assert.equal(r.basis.posts_without_pilar_ss, 6)
  assert.deepEqual(learningHighlights(r), []); assert.ok(r.basis.warnings.some(w => /sem família/.test(w)))
})
t('só um dos rótulos: não entra em família × pilar', () => {
  const posts = [0, 1, 2].map(i => post('a', i, true, { familia: 'fx' }))
  const r = run(posts, [], [], { now: NOW })
  assert.equal(r.groups.filter(x => x.kind === 'familia').length, 1); assert.equal(r.groups.filter(x => x.kind === 'familia_pilar').length, 0)
})
t('labelsUnavailable: 3 tipos novos insuficientes + aviso', () => {
  const posts = [0, 1, 2].flatMap(i => [lp('fx', 'p1', i), lp('fy', 'p2', i)])
  const r = run(posts, [ev('fxp1', 0, 'u1')], [], { now: NOW, labelsUnavailable: true })
  for (const k of ['familia', 'pilar_ss', 'familia_pilar']) assert.equal(r.status_by_kind[k], 'insufficient_data')
  assert.ok(r.basis.warnings.some(w => /Não consegui ler família/.test(w)))
})
console.log(`\n${n} testes passaram`)
