// Roda: node --experimental-strip-types scripts/test-week-approval.mjs
// Testa a aprovação da semana (_shared/weekApproval.ts), a cópia da tela e as travas no agent-actions.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseWeekIds, planWeek, weekSlot, weekSkipReason, weekWindow, WEEK_MAX, WEEK_DAYS, TODAY_MARGIN_MS, SKIP_LABEL } from '../supabase/functions/_shared/weekApproval.ts'
import * as front from '../src/lib/weekApproval.ts'
import { PUBLISH_HOUR_BRT } from '../supabase/functions/_shared/publishSlot.ts'

let n = 0
const t = (name, fn) => { fn(); n++; console.log('ok -', name) }
const SUN = Date.parse('2026-11-15T21:30:00Z')   // domingo 18h30 em Brasília (plano da semana acabou de sair)
const id = i => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
const piece = (i, day, extra = {}) => ({ id: id(i), status: 'vault', planned_for: day, ...extra })

t('ids: valida, tira repetidos e respeita o máximo', () => {
  assert.deepEqual(parseWeekIds([id(1), id(1), id(2)]), [id(1), id(2)])
  for (const bad of [null, [], 'x', [42], ['nao-e-uuid'], Array.from({ length: WEEK_MAX + 1 }, (_, i) => id(i))]) assert.equal(parseWeekIds(bad), null, JSON.stringify(bad).slice(0, 40))
  assert.equal(parseWeekIds(Array.from({ length: WEEK_MAX }, (_, i) => id(i))).length, WEEK_MAX)
})
t('semana = hoje até hoje + 7 (domingo cobre segunda a domingo)', () => {
  assert.deepEqual(weekWindow(SUN), { from: '2026-11-15', to: '2026-11-22' })
  assert.equal(WEEK_DAYS, 7)
})
t('dia futuro sai às 18h de Brasília', () => {
  assert.equal(weekSlot('2026-11-16', SUN).iso, '2026-11-16T21:00:00.000Z')
})
t('hoje: agenda às 18h só se ainda faltar a margem', () => {
  const mon9 = Date.parse('2026-11-16T12:00:00Z')                 // segunda 9h BRT
  assert.equal(weekSlot('2026-11-16', mon9).iso, '2026-11-16T21:00:00.000Z')
  assert.equal(weekSlot('2026-11-16', Date.parse('2026-11-16T21:00:00Z') - TODAY_MARGIN_MS + 1), null)
  assert.equal(weekSlot('2026-11-15', SUN), null)                  // domingo 18h30: já passou das 18h
})
t('motivos de ficar de fora', () => {
  const s = new Set([id(5)])
  assert.equal(weekSkipReason(undefined, s, SUN), 'not_found')
  assert.equal(weekSkipReason(piece(1, '2026-11-16', { status: 'draft' }), s, SUN), 'not_ready')
  assert.equal(weekSkipReason(piece(5, '2026-11-16'), s, SUN), 'already_scheduled')
  assert.equal(weekSkipReason(piece(2, '2026-11-17', { recipe: 'video_imovel', video_url: null }), s, SUN), 'video_not_ready')
  assert.equal(weekSkipReason(piece(3, null), s, SUN), 'no_date')
  assert.equal(weekSkipReason(piece(3, '16/11/2026'), s, SUN), 'no_date')
  assert.equal(weekSkipReason(piece(4, '2026-11-23'), s, SUN), 'beyond_week')
  assert.equal(weekSkipReason(piece(6, '2026-11-10'), s, SUN), 'past')
  assert.equal(weekSkipReason(piece(7, '2026-11-18', { recipe: 'video_imovel', video_url: 'https://x/v.mp4' }), s, SUN), null)
  for (const k of Object.keys(SKIP_LABEL)) assert.ok(SKIP_LABEL[k].length > 3, k)
})
t('planWeek: agenda o que dá, na ordem dos dias, e explica o resto', () => {
  const rows = [piece(1, '2026-11-20'), piece(2, '2026-11-16'), piece(3, null), piece(4, '2026-11-17', { recipe: 'video_imovel' })]
  const r = planWeek([id(1), id(2), id(3), id(4), id(9)], rows, new Set(), SUN)
  assert.deepEqual(r.toSchedule.map(x => x.piece.id), [id(2), id(1)])
  assert.deepEqual(r.toSchedule.map(x => x.slot.day), ['2026-11-16', '2026-11-20'])
  assert.deepEqual(r.skipped, [{ id: id(3), reason: 'no_date' }, { id: id(4), reason: 'video_not_ready' }, { id: id(9), reason: 'not_found' }])
})
t('peça de outra empresa nunca entra (o servidor só busca as da empresa → not_found)', () => {
  const r = planWeek([id(1)], [], new Set(), SUN)
  assert.equal(r.toSchedule.length, 0); assert.equal(r.skipped[0].reason, 'not_found')
})
t('a cópia da tela bate com o servidor', () => {
  assert.equal(front.PUBLISH_HOUR_BRT, PUBLISH_HOUR_BRT)
  assert.equal(front.WEEK_MAX, WEEK_MAX); assert.equal(front.WEEK_DAYS, WEEK_DAYS); assert.equal(front.TODAY_MARGIN_MS, TODAY_MARGIN_MS)
  const nows = [SUN, Date.parse('2026-11-16T12:00:00Z'), Date.parse('2026-11-16T20:50:00Z'), Date.parse('2026-11-17T02:30:00Z')]
  const days = ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-22', '2026-11-23', '2026-11-24', null, 'lixo']
  for (const now of nows) {
    assert.deepEqual(front.weekWindow(now), weekWindow(now))
    for (const d of days) assert.equal(front.weekSlotIso(d, now), weekSlot(d, now)?.iso && (d <= weekWindow(now).to) ? weekSlot(d, now).iso : null, `${d} @ ${new Date(now).toISOString()}`)
  }
  assert.equal(front.dayLabel('2026-11-16', 'pt'), 'seg 16/11')
  assert.equal(front.dayLabel('2026-11-22', 'en'), 'Sun 11/22')
})
t('agent-actions: aprovar a semana passa pelo pagamento, grava quem aprovou e agenda (nunca AUTO_APPROVED)', () => {
  const src = readFileSync(new URL('../supabase/functions/agent-actions/index.ts', import.meta.url), 'utf8')
  assert.match(src, /action === 'approve_week'\) \{\n\s*const noPlan = await requirePaidAccess/)
  const fn = src.slice(src.indexOf('async function approveWeek'), src.indexOf('async function unscheduleWeek'))
  assert.match(fn, /parseWeekIds\(rawIds\)/)
  assert.match(fn, /\.eq\('company_id', companyId\)\.in\('id', ids\)/)
  assert.match(fn, /scheduled_at: slot\.iso,\n\s*\}, false, false, userId\)/)   // autoMode=false, forceApprove=false → APPROVED + approved_by pelo agendamento
  assert.doesNotMatch(fn, /approve_now/)
  // proposeAction: agendamento vira APPROVED com approved_by = quem clicou
  assert.match(src, /approval_status: forceApprove \|\| scheduledAt \? 'APPROVED'/)
  assert.match(src, /approved_by: forceApprove \|\| scheduledAt \? userId : null/)
  const un = src.slice(src.indexOf('async function unscheduleWeek'), src.indexOf('async function listActions'))
  assert.match(un, /\.eq\('company_id', companyId\)/); assert.match(un, /\.eq\('execution_status', 'QUEUED'\)/)
})
t('domingo: aviso "sua semana está pronta" no lugar do "aprove em Posts"', () => {
  const cg = readFileSync(new URL('../supabase/functions/creative-generate/index.ts', import.meta.url), 'utf8')
  assert.match(cg, /action: 'week_ready', count: r\.planned, reason: 'Calendário da semana planejado'/)
  const lb = readFileSync(new URL('../supabase/functions/log-bot-event/index.ts', import.meta.url), 'utf8')
  assert.match(lb, /action === 'week_ready'/); assert.match(lb, /Central do dono → Aprovações/)
})
console.log(`\n${n} verificações ok`)
