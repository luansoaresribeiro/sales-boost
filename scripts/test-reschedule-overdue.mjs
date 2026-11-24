import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-reschedule-overdue.mjs
// P2 (dono 24/11): posts vencidos remarcados para os próximos dias livres — só muda a data, 1 post por dia.
import { isOverdue, planReschedule, RESCHEDULE_HORIZON_DAYS } from '../src/lib/rescheduleOverdue.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }
const now = Date.parse('2026-11-24T18:00:00Z') // 15h em Brasília, dia 24

assert.equal(isOverdue('2026-11-23', now), true); assert.equal(isOverdue('2026-11-24', now), false); assert.equal(isOverdue(null, now), false); ok('vencido = antes de hoje (Brasília)')
assert.equal(isOverdue('2026-11-24', Date.parse('2026-11-25T02:00:00Z')), false); ok('23h em Brasília ainda é o mesmo dia')

const overdue = [{ id: 'b', planned_for: '2026-11-20' }, { id: 'a', planned_for: '2026-11-17' }, { id: 'c', planned_for: '2026-11-22' }]
const taken = ['2026-11-25', '2026-11-27', null, '2026-11-24']
const plan = planReschedule(overdue, taken, now)
assert.deepEqual(plan.map(p => p.id), ['a', 'b', 'c']); ok('do mais antigo para o mais novo')
assert.deepEqual(plan.map(p => p.to), ['2026-11-26', '2026-11-28', '2026-11-29']); ok('começa amanhã e pula os dias ocupados')
assert.equal(new Set(plan.map(p => p.to)).size, plan.length); ok('1 post por dia (sem repetir dia)')
assert.ok(plan.every(p => !taken.includes(p.to))); ok('nunca cai em dia já ocupado')

const many = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, planned_for: '2026-11-01' }))
assert.equal(planReschedule(many, [], now).length, RESCHEDULE_HORIZON_DAYS); ok('o que não cabe no horizonte fica como está')
assert.deepEqual(planReschedule([], taken, now), []); ok('sem vencidos, nada muda')
console.log(`\n${n} testes ok`)
