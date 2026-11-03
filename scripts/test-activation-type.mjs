import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-activation-type.mjs
// Tipo de ativação e objetivo da peça (Pacote A): tabela final decidida com SQL real de 03/11/2026.
import { activationType, pieceObjective } from '../src/pages/dashboard/marketingAi/activationType.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }
const opps = { o1: { id: 'o1', title: 'Opp aprovada', status: 'approved' }, o2: { id: 'o2', title: 'Opp sugerida', status: 'suggested' } }
const k = (p, m = opps) => activationType(p, m)

assert.deepEqual(k({ opportunity_id: 'o1', item_id: 'i', familia: 'educativo' }), { kind: 'opportunity', state: 'ok' }); ok('oportunidade aprovada vence, mesmo com imóvel')
assert.deepEqual(k({ opportunity_id: 'o1', familia: 'educativo' }), { kind: 'opportunity', state: 'ok' }); ok('oportunidade aprovada sem imóvel')
assert.equal(k({ opportunity_id: 'o2', familia: 'educativo' }).kind, 'unknown'); ok('oportunidade não aprovada = não identificado')
assert.equal(k({ opportunity_id: 'zz', familia: 'tour', item_id: 'i' }).kind, 'unknown'); ok('oportunidade não achada = não identificado (mesmo com imóvel)')
assert.deepEqual(k({ opportunity_id: 'o1', familia: 'educativo' }, null), { kind: 'unknown', state: 'unverifiable' }); ok('consulta falhou = não foi possível verificar')
assert.deepEqual(k({ familia: 'tour', item_id: 'i' }, null), { kind: 'property', state: 'ok' }); ok('consulta de oportunidade falhou mas a peça não tem oportunidade = segue normal')
assert.equal(k({ familia: null }).kind, 'unknown'); assert.equal(k({}).kind, 'unknown'); assert.equal(k({ familia: 'xpto', item_id: 'i' }).kind, 'unknown'); ok('familia null / fora da lista = não identificado')
for (const f of ['tour', 'oferta', 'bairro']) { assert.equal(k({ familia: f, item_id: 'i' }).kind, 'property'); assert.equal(k({ familia: f }).kind, 'unknown') }
ok('tour/oferta/bairro: com imóvel = apresentação; sem imóvel = não identificado')
assert.equal(k({ familia: 'educativo', item_id: 'i' }).kind, 'educational_with_property'); assert.equal(k({ familia: 'educativo' }).kind, 'educational_without_property'); ok('educativo com / sem imóvel')
assert.equal(k({ familia: 'eventual', item_id: 'i' }).kind, 'unknown'); ok('eventual = não identificado')

assert.equal(pieceObjective(null), null); assert.equal(pieceObjective({}), null); assert.equal(pieceObjective({ funnel: { objective: '  ' } }), null); ok('sem objetivo = null')
assert.deepEqual(pieceObjective({ funnel: { objective: 'Gerar visita' }, opportunity: { objective: 'x' } }), { key: 'funnel', label: 'Objetivo da etapa do funil', text: 'Gerar visita' }); ok('funil vence')
assert.deepEqual(pieceObjective({ funnel: null, opportunity: { objective: 'Vender o imóvel parado' } }), { key: 'opportunity', label: 'Objetivo da oportunidade', text: 'Vender o imóvel parado' }); ok('cai pro objetivo da oportunidade')
console.log(`\n${n} grupos de teste OK`)
