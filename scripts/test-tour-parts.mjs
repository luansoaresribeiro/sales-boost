// Roda: node --experimental-strip-types scripts/test-tour-parts.mjs
// Frente 1, item 1.4 (20/11): tour em partes — só por ligação confirmada, ≤ 8 passagens, nada some calado.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { planParts, MAX_PASSAGES } = await import('../supabase/functions/_shared/tourParts.ts')

const S = (key, area, photos, label = key) => ({ key, label, area, photos })
const L = (a, b, cls, photo, other_photo) => ({ a, b, cls, photo, other_photo })
const check = (plan, spaces) => {
  // Regra 0: todo ambiente numa parte OU pendente, nunca os dois, nunca nenhum.
  const inParts = new Set(plan.parts.flatMap(p => p.spaces)), pend = new Set(plan.pending.map(p => p.key))
  for (const s of spaces) assert.ok(inParts.has(s.key) !== pend.has(s.key), `ambiente ${s.key} sumiu ou repetiu`)
  for (const p of plan.parts) {
    assert.equal(p.passages.length, p.photos.length - 1)
    assert.ok(p.passages.length <= MAX_PASSAGES, 'passou de 8 passagens')
    for (let i = 0; i < p.passages.length; i++) { assert.equal(p.passages[i].from, p.photos[i]); assert.equal(p.passages[i].to, p.photos[i + 1]) }
  }
}

// 1) Mapa real da Tespon (20/11): 4 ligações confirmadas, o resto provável → 4 partes curtas, 14 pendentes.
const T = [
  S('s1', 'social', [0, 48]), S('s2', 'social', [1, 49]), S('s3', 'social', [3, 6]), S('s4', 'social', [44, 46]), S('s5', 'social', [47]),
  S('s6', 'intima', [4, 34, 39]), S('s7', 'intima', [5, 38]), S('s8', 'intima', [7, 33]), S('s9', 'intima', [8, 31, 37]), S('s10', 'intima', [9, 10, 11, 30, 32]),
  S('s11', 'intima', [28, 29]), S('s13', 'intima', [35, 36]), S('s14', 'intima', [41]), S('s15', 'intima', [42, 45]),
  S('s16', 'lazer', [12, 15, 18, 19]), S('s17', 'lazer', [13, 14, 27]), S('s18', 'lazer', [16, 17, 20]), S('s19', 'lazer', [22, 23]), S('s20', 'lazer', [24, 25, 26]),
  S('s21', 'servico', [43]), S('s22', 'externa', [2, 40]), S('s23', 'externa', [21]),
]
const TL = [
  L('s2', 's5', 'confirmed', 49, 47), L('s15', 's7', 'confirmed', 45, 5), L('s6', 's8', 'confirmed', 34, 33), L('s19', 's17', 'confirmed', 22, 27),
  L('s2', 's1', 'probable', 1, 0), L('s22', 's2', 'probable', 40, 1), L('s22', 's17', 'probable', 40, 13), L('s14', 's10', 'probable', 41, 30),
]
const t = planParts(T, TL)
check(t, T)
assert.equal(t.parts.length, 4)
assert.equal(t.covered, 8)
assert.deepEqual(t.parts.map(p => p.area), ['social', 'intima', 'intima', 'lazer'])
assert.deepEqual(t.parts[0].photos, [49, 47])                                         // sai da foto que mostra a passagem, chega no escritório
assert.ok(t.parts.every(p => p.passages.every(x => x.cls !== 'probable')))          // provável não entra sem o dono pedir
assert.equal(t.pending.find(p => p.key === 's22').reason, 'so_provavel')           // varanda: só provável
assert.equal(t.pending.find(p => p.key === 's23').reason, 'sem_passagem')          // pátio: nada
assert.deepEqual(t.parts.map(p => `${p.index}/${p.total}`), ['1/4', '2/4', '3/4', '4/4'])

// 2) Com "gerar mesmo assim" nas prováveis, a social cresce e as passagens ficam marcadas.
const tp = planParts(T, TL, { allowProbable: true })
check(tp, T)
assert.ok(tp.covered > t.covered)
assert.ok(tp.parts.some(p => p.passages.some(x => x.cls === 'probable')))
assert.ok(!tp.parts.some(p => p.spaces.includes('s22') && p.spaces.includes('s17') && p.area !== 'social' && p.area !== 'lazer'))

// 3) Corredor comprido (12 ambientes em linha) vira 2 partes de ≤ 8 passagens; a 2ª reabre o último ambiente da 1ª.
const C = Array.from({ length: 12 }, (_, i) => S(`c${i}`, 'intima', [100 + i * 2, 101 + i * 2]))
const CL = C.slice(1).map((s, i) => L(C[i].key, s.key, 'confirmed', 101 + i * 2, 100 + (i + 1) * 2))
const c = planParts(C, CL)
check(c, C)
assert.ok(c.parts.length >= 2)
assert.equal(c.covered, 12)
const last1 = c.parts[0].spaces[c.parts[0].spaces.length - 1]
assert.equal(c.parts[1].spaces[0], last1)

// 4) Uma parte nunca atravessa áreas: ligação social ↔ íntima não junta as duas.
const X = [S('a', 'social', [0]), S('b', 'social', [1]), S('c', 'intima', [2]), S('d', 'intima', [3])]
const x = planParts(X, [L('a', 'b', 'confirmed', 0, 1), L('b', 'c', 'confirmed', 1, 2), L('c', 'd', 'confirmed', 2, 3)])
check(x, X)
assert.ok(x.parts.every(p => new Set(p.spaces.map(k => X.find(s => s.key === k).area)).size === 1))

// 5) Externa entra na parte da área a que está ligada (terraço → sala = social).
const E = [S('t', 'externa', [0]), S('s', 'social', [1]), S('j', 'social', [2])]
const e = planParts(E, [L('t', 's', 'confirmed', 0, 1), L('s', 'j', 'confirmed', 1, 2)])
check(e, E)
assert.deepEqual(e.parts.map(p => p.area), ['social'])
assert.equal(e.covered, 3)

// Servidor e tela.
const iv = readFileSync('supabase/functions/item-videos/index.ts', 'utf8')
assert.ok(iv.includes("body.action === 'plan_parts'") && iv.includes('planParts('))
// Pelo servidor (cron_secret) só a análise do tour; publicar ou gerar peça continuam fora dessa lista.
assert.ok(iv.includes("['create', 'group_spaces', 'map_links', 'coverage', 'plan_parts'].includes(String(body.action))"))
console.log('ok — tour em partes: só ligação confirmada, ≤ 8 passagens, nada some, partes por área')
