// Roda: node --experimental-strip-types scripts/test-photo-spaces.mjs
// Frente 1, item 1.1 (17/11): ambientes físicos — leitura da resposta da IA e comparação com a tabela 2.1 da Tespon.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { parseSpaces, compareSpaces, photosSig, spacesPrompt } = await import('../supabase/functions/_shared/photoSpaces.ts')

// Tabela 2.1 do PLANO-TOUR-COMPLETO (índices de meta.photos da Tespon, 50 fotos). Os ❓ entram no grupo mais provável.
export const TESPON_21 = [
  [2, 40], [1, 49], [0, 48], [3, 6], [43], [47], [44, 46], [41], [9, 30, 32, 10, 11], [28, 29], [4, 34, 39], [7, 33],
  [42, 45], [35, 36], [5, 38], [8, 31, 37], [13, 14, 27], [22, 23], [24, 25, 26], [12, 15, 18, 19], [16, 17, 20], [21],
]
assert.equal(TESPON_21.flat().length, 50)
assert.equal(new Set(TESPON_21.flat()).size, 50)

// Leitura: última linha JSON; índice repetido/fora do intervalo ignorado; foto esquecida vira ambiente incerto próprio.
const txt = 'Penso que...\n{"spaces":[{"label":"Quarto 2 (cabeceira cinza)","room":"quarto","area":"intima","photos":[4,34,39,99]},{"label":"Sala","room":"sala","area":"social","photos":[1,4]},{"label":"Lixo","photos":[]}]}'
const s = parseSpaces(txt, 50, ['quarto', 'sala'])
assert.ok(s)
assert.deepEqual(s.find(x => x.label.startsWith('Quarto 2')).photos, [4, 34, 39])
assert.deepEqual(s.find(x => x.label === 'Sala').photos, [1])        // o 4 já estava no quarto
assert.equal(s.length, 2 + 46)                                         // 46 fotos sem ambiente viram ambientes incertos
assert.ok(s.filter(x => x.uncertain).every(x => x.photos.length === 1))
assert.equal(new Set(s.flatMap(x => x.photos)).size, 50)              // toda foto aparece uma vez só
assert.equal(parseSpaces('sem json', 5, []), null)
assert.equal(parseSpaces('{"spaces":[{"photos":[0],"room":"xyz","area":"lua"}]}', 2, ['quarto'])[0].room, 'outro')

// Comparação: igual = 1/1; juntar dois quartos diferentes derruba a precisão; separar um quarto derruba o recall.
assert.deepEqual(compareSpaces(TESPON_21, TESPON_21).precision, 1)
const merged = TESPON_21.filter(g => g[0] !== 42).map(g => g[0] === 4 ? [...g, 42, 45] : g)
assert.ok(compareSpaces(merged, TESPON_21).precision < 1)
const split = TESPON_21.flatMap(g => g[0] === 13 ? [[13], [14, 27]] : [g])
assert.ok(compareSpaces(split, TESPON_21).recall < 1)

// Assinatura muda quando as fotos mudam (ou de ordem); prompt pede separação de cômodos do mesmo tipo.
assert.notEqual(photosSig(['a', 'b']), photosSig(['b', 'a']))
assert.ok(spacesPrompt(50, [{ key: 'quarto', label: 'quarto' }]).includes('quarto 2 e quarto 3) ficam SEPARADOS'))

// item-videos expõe a ação e grava o custo (auditoria)
const iv = readFileSync('supabase/functions/item-videos/index.ts', 'utf8')
assert.ok(iv.includes("body.action === 'group_spaces'") && iv.includes('requirePaidAccess'))
assert.ok(readFileSync('supabase/functions/_shared/photoSpaces.ts', 'utf8').includes("taskKey: 'ai_vision_spaces'"))
console.log('ok — ambientes físicos: leitura da IA, comparação com a tabela 2.1, ação group_spaces')
