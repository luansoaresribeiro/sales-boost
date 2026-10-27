// Roda: node --experimental-strip-types scripts/test-publish-slot.mjs
// Testa o horário de publicação das peças planejadas (_shared/publishSlot.ts) e que a cópia da tela bate.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { todayBRT, plannedPublishAt, publishWhenLabel, PUBLISH_HOUR_BRT, currentWeekBRT } from '../supabase/functions/_shared/publishSlot.ts'
import * as front from '../src/lib/publishSlot.ts'

let n = 0
const t = (name, fn) => { fn(); n++; console.log('ok -', name) }
const NOW = Date.parse('2026-10-26T14:00:00Z')   // 11h em Brasília, segunda

t('hoje em Brasília (virada de dia às 21h BRT = 00h UTC)', () => {
  assert.equal(todayBRT(Date.parse('2026-10-26T02:30:00Z')), '2026-10-25')   // 23h30 BRT de domingo
  assert.equal(todayBRT(Date.parse('2026-10-26T03:00:00Z')), '2026-10-26')
})
t('dia futuro agenda às 18h de Brasília', () => {
  const p = plannedPublishAt('2026-10-28', NOW)
  assert.equal(p.iso, '2026-10-28T21:00:00.000Z'); assert.equal(p.hour, 18)
  assert.equal(publishWhenLabel(p), 'dia 28/10 às 18h')
})
t('hoje, passado, vazio e lixo: publica ao aprovar (null)', () => {
  for (const v of ['2026-10-26', '2026-10-20', null, undefined, '', '28/10/2026', 42]) assert.equal(plannedPublishAt(v, NOW), null, String(v))
})
t('23h30 de segunda em Brasília: terça ainda é futuro (agenda), segunda já é hoje (publica)', () => {
  const late = Date.parse('2026-10-27T02:30:00Z')
  assert.equal(plannedPublishAt('2026-10-27', late).iso, '2026-10-27T21:00:00.000Z')
  assert.equal(plannedPublishAt('2026-10-26', late), null)
})
t('a cópia da tela dá o mesmo resultado e o mesmo horário', () => {
  assert.equal(front.PUBLISH_HOUR_BRT, PUBLISH_HOUR_BRT)
  for (const d of ['2026-10-28', '2026-10-26', '2026-12-31', null]) assert.deepEqual(front.plannedPublishAt(d, NOW), plannedPublishAt(d, NOW))
  assert.equal(front.publishWhenLabel(plannedPublishAt('2026-10-28', NOW)), 'dia 28/10 às 18h')
  assert.ok(/PUBLISH_HOUR_BRT = 18\b/.test(readFileSync(new URL('../src/lib/publishSlot.ts', import.meta.url), 'utf8')))
})
t('semana atual: segunda a domingo, e só os dias que faltam (amanhã em diante)', () => {
  const w = currentWeekBRT(NOW)                                       // segunda 26/10
  assert.deepEqual(w.week, ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
  assert.equal(w.remaining.length, 6); assert.equal(w.remaining[0], '2026-10-27')
  assert.equal(currentWeekBRT(Date.parse('2026-10-30T15:00:00Z')).remaining.length, 2)   // sexta: sáb + dom (limite do "pelo menos 2")
  assert.equal(currentWeekBRT(Date.parse('2026-10-31T15:00:00Z')).remaining.length, 1)   // sábado: só domingo → não planeja
  const sun = currentWeekBRT(Date.parse('2026-11-01T15:00:00Z'))                           // domingo: ainda é a semana de segunda 26
  assert.equal(sun.week[0], '2026-10-26'); assert.equal(sun.remaining.length, 0)
})
console.log(`\n${n} grupos OK`)
