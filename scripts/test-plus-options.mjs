import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-plus-options.mjs
// Botão "+" (Pacote B2): só aparece o que funciona de ponta a ponta. Função pura plusOptionStates/usableFormats.
import { plusOptionStates, usableFormats, plusStateNote, SIGNAL_PATH, CATALOG_PATH } from '../src/pages/dashboard/plusOptions.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }
const post = { key: 'post_card', name: 'Post', producer: 'post', surface: 'feed' }
const tour = { key: 'tour', name: 'Tour', producer: 'item_video', surface: 'reels' }
const item = { id: 'i1', title: 'Apto' }
const schema = { itemLabel: 'Imóvel', signals: true }
const done = (formats, items = []) => ({ status: 'ok', formats, items })
const keys = (o) => o.map(x => x.key)
const get = (o, k) => o.find(x => x.key === k)

let o = plusOptionStates({ readOnly: false, schema, check: done([post], [item]) })
assert.deepEqual(keys(o), ['item', 'piece', 'signal']); assert.equal(get(o, 'item').label, 'Adicionar imóvel'); assert.equal(get(o, 'item').href, `${CATALOG_PATH}?add=1`)
assert.equal(get(o, 'signal').href, SIGNAL_PATH); assert.ok(o.every(x => x.state === 'enabled')); ok('tudo funcionando -> 3 opções habilitadas, rótulo vem da ficha')

o = plusOptionStates({ readOnly: true, schema, check: { status: 'idle' } })
assert.deepEqual(keys(o), ['item']); ok('vitrine/readOnly -> só adicionar item (peça e sinal somem, sem chamar)')

o = plusOptionStates({ readOnly: false, schema, check: { status: 'plan' } })
assert.deepEqual(keys(o), ['item', 'signal']); ok('402 -> peça some')

o = plusOptionStates({ readOnly: false, schema, check: { status: 'failed' } })
assert.equal(get(o, 'piece').state, 'unverifiable'); assert.equal(plusStateNote('unverifiable'), 'Não foi possível verificar'); ok('falha de rede/status ≠ 200 -> "Não foi possível verificar" (desabilitada)')

for (const st of ['idle', 'checking']) {
  o = plusOptionStates({ readOnly: false, schema, check: { status: st } })
  assert.equal(get(o, 'piece').state, 'checking')
}
assert.equal(plusStateNote('checking'), 'Verificando…'); ok('verificando -> linha desabilitada')

o = plusOptionStates({ readOnly: false, schema, check: done([]) })
assert.equal(get(o, 'piece'), undefined); ok('zero formatos -> peça some')

o = plusOptionStates({ readOnly: false, schema, check: done([tour], []) })
assert.equal(get(o, 'piece'), undefined); ok('só formato de imóvel e nenhum imóvel com fotos -> peça some (daria 400)')
o = plusOptionStates({ readOnly: false, schema, check: done([tour], [item]) })
assert.equal(get(o, 'piece').state, 'enabled'); ok('formato de imóvel + imóvel elegível -> habilitada')
o = plusOptionStates({ readOnly: false, schema, check: done([post, tour], []) })
assert.equal(get(o, 'piece').state, 'enabled'); assert.deepEqual(usableFormats([post, tour], []).map(f => f.key), ['post_card']); ok('post não precisa de imóvel; usableFormats tira o formato de imóvel')

for (const sc of [undefined, null, { itemLabel: 'Imóvel', signals: false }]) {
  o = plusOptionStates({ readOnly: false, schema: sc, check: done([post]) })
  assert.equal(get(o, 'signal'), undefined)
}
ok('ficha carregando / sem ficha / sem opportunity_fields -> sem "Adicionar sinal"')
o = plusOptionStates({ readOnly: false, schema: undefined, check: done([post]) })
assert.equal(get(o, 'item').label, 'Adicionar item'); assert.equal(get(o, 'item').href, CATALOG_PATH); ok('ficha nula/carregando -> "Adicionar item" sem ?add')

o = plusOptionStates({ readOnly: false, schema: { itemLabel: 'Listing', signals: true }, check: done([post]), lang: 'en' })
assert.equal(get(o, 'item').label, 'Add listing'); assert.equal(get(o, 'signal').label, 'Add signal'); ok('inglês')
console.log(`\n${n} grupos ok`)
