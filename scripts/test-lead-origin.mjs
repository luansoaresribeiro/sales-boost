import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-lead-origin.mjs
// Origem do lead no funil (Pacote B1): função pura leadOrigin. Nunca devolve peça; ausência só quando as colunas foram lidas.
import { leadOrigin } from '../src/pages/dashboard/marketingAi/leadOrigin.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }
const none = { item_id: null, link_id: null, opportunity_id: null }
const lk = (over = {}, failed = {}) => ({ itemTitles: { i1: 'Apto Leblon' }, linkChannels: { l1: 'caption', l2: 'dm' }, oppTitles: { o1: 'Obra no bairro' }, failed: { columns: false, items: false, links: false, opps: false, ...failed }, ...over })

let o = leadOrigin(none, lk(), 'pt')
assert.deepEqual(o, { lines: [], unverified: false, registered: false }); ok('colunas lidas e vazias -> não registrada')
o = leadOrigin(none, lk({}, { columns: true }), 'pt')
assert.equal(o.unverified, true); assert.equal(o.registered, false); assert.equal(o.lines.length, 0); ok('fallback (colunas não lidas) -> não verificado, nunca não registrada')
o = leadOrigin({ item_id: 'i1', link_id: 'l1', opportunity_id: null }, lk(), 'pt')
assert.deepEqual(o.lines, ['Imóvel: Apto Leblon · página pública (legenda)']); assert.equal(o.unverified, false); ok('link presente -> imóvel + canal')
o = leadOrigin({ item_id: 'i1', link_id: 'l2', opportunity_id: null }, lk(), 'en')
assert.equal(o.lines[0], 'Listing: Apto Leblon · public page (DM)'); ok('canal DM em inglês')
o = leadOrigin({ item_id: null, link_id: null, opportunity_id: 'o1' }, lk(), 'pt')
assert.deepEqual(o.lines, ['Oportunidade: Obra no bairro']); ok('oportunidade só com opportunity_id')
for (const f of ['items', 'links', 'opps']) {
  o = leadOrigin({ item_id: 'i1', link_id: 'l1', opportunity_id: 'o1' }, lk({}, { [f]: true }), 'pt')
  assert.equal(o.unverified, true); ok(`consulta auxiliar ${f} falhou -> não verificado`)
}
o = leadOrigin({ item_id: 'i1', link_id: 'l1', opportunity_id: 'o1' }, lk(), 'pt')
assert.ok(!o.lines.some(l => /pe[cç]a|piece|post/i.test(l))); ok('nunca mostra peça de origem')
console.log(`\n${n} ok`)
