// Roda: node --experimental-strip-types scripts/test-tour-coverage.mjs
// Frente 1, item 1.3 (20/11): cobertura e fotos que faltam — com o mapa real da Tespon de 20/11.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { computeCoverage, hintsFrom, DEFAULT_HINTS } = await import('../supabase/functions/_shared/tourCoverage.ts')
const { carryOver } = await import('../supabase/functions/_shared/spaceLinks.ts')

const S = (key, label, area, photos) => ({ key, label, area, photos })
const spaces = [
  S('s1', 'Sala de jantar', 'social', [0, 48]), S('s2', 'Sala de estar com escada', 'social', [1, 49]), S('s3', 'Copa', 'social', [3, 6]),
  S('s5', 'Escritório', 'social', [47]), S('s6', 'Quarto 2', 'intima', [4, 34, 39]), S('s8', 'Closet do quarto 2', 'intima', [7]),
  S('s10', 'Suíte master', 'intima', [9, 10, 11, 30, 32]), S('s14', 'Corredor íntimo', 'intima', [41]), S('s17', 'Sala de TV', 'lazer', [13, 14, 27]),
  S('s19', 'Sala de jogos', 'lazer', [22, 23]), S('s22', 'Varanda coberta', 'externa', [2, 40]), S('s23', 'Pátio', 'externa', [21]),
]
const L = (a, b, cls, photo = null, missing = null) => ({ a, b, cls, photo, missing })
const links = [
  L('s19', 's17', 'confirmed', 22), L('s6', 's8', 'confirmed', 34),
  L('s2', 's1', 'probable', 1), L('s22', 's2', 'probable', 40), L('s22', 's17', 'probable', 40),   // terraço–salão: erro conhecido, só provável
  L('s3', 's14', 'probable', 3), L('s14', 's10', 'probable', 41), L('s2', 's5', 'probable', 1, null),
  L('s2', 's99', 'confirmed'),                                                                     // ambiente que não existe: ignorado
]
const c = computeCoverage(spaces, links, DEFAULT_HINTS.pt)
// Só confirmada conta: 4 ligados (jogos, salão de TV, quarto 2, closet); provável não sobe a barra.
assert.equal(c.total, 12)
assert.equal(c.linked, 4)
assert.equal(c.spaces.find(s => s.key === 's17').status, 'linked')
assert.equal(c.spaces.find(s => s.key === 's22').status, 'probable')
assert.equal(c.spaces.find(s => s.key === 's23').status, 'none')
assert.equal(c.linked, c.spaces.filter(s => s.status === 'linked').length)        // barra = lista
// Todo ambiente não ligado aparece em pelo menos 1 pedido de foto.
for (const s of c.spaces.filter(x => x.status !== 'linked')) assert.ok(c.todo.some(t => t.spaces.includes(s.key)), s.key)
// A provável entre um ligado e um não ligado gera o pedido; a pátio isolado gera o "da porta para dentro".
assert.ok(c.todo.some(t => t.kind === 'probable' && t.text.includes('Varanda coberta') && t.text.includes('Sala de estar')))
assert.ok(c.todo.some(t => t.kind === 'isolated' && t.text.includes('Pátio')))
// O pedido parte do ambiente da foto que mostrou a passagem (foto 40 é da varanda).
assert.ok(c.todo.find(t => t.spaces.includes('s22') && t.spaces.includes('s2')).text.startsWith('Fique em Varanda coberta'))
// Escada que falta gera a dica da escada.
const c2 = computeCoverage(spaces, [L('s2', 's17', 'unknown', 1, 'escada')], DEFAULT_HINTS.pt)
assert.ok(c2.todo.some(t => t.kind === 'stairs' && t.text.includes('Sala de estar com escada')))
assert.equal(c2.linked, 0)
// Lista em ordem de área (externa → social → íntima → lazer) e sem pedido repetido.
const areas = c.todo.map(t => t.area); const order = ['externa', 'social', 'intima', 'lazer']
assert.deepEqual(areas, [...areas].sort((x, y) => order.indexOf(x) - order.indexOf(y)))
assert.equal(new Set(c.todo.map(t => t.text)).size, c.todo.length)
// Textos da ficha (com {a}); modelo sem {a} ou faltando = padrão.
const h = hintsFrom({ pt: { probable: 'P {a}>{b}', isolated: 'sem placeholder' } }, 'pt')
assert.equal(h.probable, 'P {a}>{b}'); assert.equal(h.isolated, DEFAULT_HINTS.pt.isolated); assert.equal(h.stairs, DEFAULT_HINTS.pt.stairs)
assert.equal(hintsFrom(null, 'en').probable, DEFAULT_HINTS.en.probable)

// Prova de uma rodada continua valendo com as mesmas fotos, remapeada pelos números das fotos.
const ps = spaces.map(s => ({ ...s, room: 'x', uncertain: false }))
const carried = carryOver([{ photo: 34, other_photo: 7, why: 'closet' }, { photo: 45, other_photo: 5 }, { photo: 1, other_photo: 0 }], ps, [{ a: 's1', b: 's2', photo: 0, other_photo: 1, why: '' }])
assert.deepEqual(carried.map(p => [p.a, p.b]), [['s6', 's8']])                  // 45/5 fora destes ambientes; sala–jantar já está

// Servidor e tela ligados; migration só acrescenta.
const iv = readFileSync('supabase/functions/item-videos/index.ts', 'utf8')
assert.ok(iv.includes("body.action === 'coverage'") && iv.includes('computeCoverage('))
assert.ok(readFileSync('src/pages/dashboard/TourVirtualPage.tsx', 'utf8').includes('<TourCoverage'))
const mig = readFileSync('supabase/migrations/20261120200000_tour_coverage_hints.sql', 'utf8')
assert.ok(mig.includes("not (config->'tour' ? 'coverage_hints')") && !/delete\s+from/i.test(mig.replace(/^--.*$/gm, '')))
console.log('ok — cobertura do tour: só confirmada conta, fotos que faltam com o ângulo, textos da ficha, prova acumulada')
