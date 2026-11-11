// Roda: node --experimental-strip-types scripts/test-tour-order.mjs
// Tour virtual completo (menu próprio, dono 2026-11-10): ordem dos cômodos, caminhada × corte, cópia da tela,
// tour fora do plano da semana e as travas do servidor.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { orderTour, tourSegments, tourOrderCfgFrom, linked, roomOf, tourSeconds } from '../supabase/functions/_shared/tourOrder.ts'
import * as front from '../src/lib/tourOrder.ts'
import { tourCfgFrom } from '../supabase/functions/_shared/tourPick.ts'
import { planningFormats, inWeeklyPlan, weekSlots, ensureMinVideos, weeklyMixPlan } from '../supabase/functions/_shared/formatCatalog.ts'
import { weekSlots as frontWeekSlots, OUT_OF_WEEKLY_PLAN as FRONT_OUT } from '../src/lib/weekSlots.ts'

let n = 0
const t = (name, fn) => { fn(); n++; console.log('ok -', name) }
const config = { tour: {
  rooms: ['fachada', 'vista', 'hall', 'sala', 'sala_jantar', 'varanda', 'cozinha', 'quarto', 'banheiro', 'corredor', 'outro'].map(k => ({ key: k, label: k })),
  adjacent_rooms: [['sala', 'varanda'], ['sala', 'cozinha'], ['sala', 'sala_jantar'], ['quarto', 'banheiro'], ['sala', 'hall'], ['sala_jantar', 'cozinha']],
  opening_rooms: ['fachada', 'vista'], room_priority: ['fachada', 'vista', 'sala', 'varanda', 'cozinha', 'quarto'],
  walk_order: ['fachada', 'vista', 'hall', 'sala', 'sala_jantar', 'varanda', 'cozinha', 'corredor', 'quarto', 'banheiro'],
  min_quality: 50, min_room_conf: 0.6,
} }
const cfg = tourCfgFrom(config), ocfg = tourOrderCfgFrom(config, cfg)
const P = (i, room, quality = 80, conf = 0.9) => ({ url: `https://x/${i}.jpg`, room, room_conf: conf, quality })

t('config: walk_order da ficha, máximo 10 e 2 por cômodo por padrão; sem walk_order usa room_priority', () => {
  assert.equal(ocfg.tour_max_photos, 10); assert.equal(ocfg.tour_per_room, 2); assert.equal(ocfg.walk_order[2], 'hall')
  assert.deepEqual(tourOrderCfgFrom({ tour: { room_priority: ['sala'] } }, { room_priority: ['sala'] }).walk_order, ['sala'])
  assert.equal(tourOrderCfgFrom({ tour: { tour_max_photos: 99 } }, cfg).tour_max_photos, 10)   // fora da faixa = padrão
})
t('ordem: abre de fora com a melhor fachada/vista e segue a ordem da ficha', () => {
  const o = orderTour([P(1, 'quarto'), P(2, 'cozinha'), P(3, 'fachada', 70), P(4, 'sala'), P(5, 'vista', 90), P(6, 'banheiro')], cfg, ocfg)
  assert.deepEqual(o.rooms, ['vista', 'fachada', 'sala', 'cozinha', 'quarto', 'banheiro'])
  assert.deepEqual(o.segments[0], { kind: 'pair', from: 0, to: 1 })   // caminhada contínua: sai de fora andando até a próxima foto
})
t('no máximo 2 fotos por cômodo (as melhores); foto ruim e excesso ficam de fora com motivo', () => {
  const o = orderTour([P(1, 'sala', 60), P(2, 'sala', 95), P(3, 'sala', 80), P(4, 'cozinha', 30)], cfg, ocfg)
  assert.deepEqual(o.photos, ['https://x/2.jpg', 'https://x/3.jpg'])
  assert.deepEqual(o.excluded.map(e => e.reason).sort(), ['low_quality', 'repeat_room'])
})
t('foto sem nota ou com cômodo incerto vai pro fim, na ordem do cadastro', () => {
  const o = orderTour([{ url: 'https://x/a.jpg' }, P(1, 'sala'), P(2, 'quarto', 80, 0.3)], cfg, ocfg)
  assert.deepEqual(o.photos, ['https://x/1.jpg', 'https://x/a.jpg', 'https://x/2.jpg'])
  assert.equal(roomOf(P(2, 'quarto', 80, 0.3), cfg), null)
})
t('limite de fotos por tour', () => {
  const many = Array.from({ length: 14 }, (_, i) => ({ url: `https://x/u${i}.jpg` }))
  const o = orderTour(many, cfg, ocfg)
  assert.equal(o.photos.length, 10); assert.equal(o.excluded.filter(e => e.reason === 'over_limit').length, 4)
})
t('url inválida ou repetida não entra', () => {
  const o = orderTour([P(1, 'sala'), P(1, 'sala'), { url: 'http://inseguro/x.jpg', room: 'sala', room_conf: 1, quality: 90 }], cfg, ocfg)
  assert.deepEqual(o.photos, ['https://x/1.jpg'])
})
t('caminhada CONTÍNUA (dono, 11/11): uma foto até a seguinte, sem corte; passagem não confirmada marcada', () => {
  const adj = cfg.adjacent_rooms
  assert.ok(linked('sala', 'varanda', adj)); assert.ok(linked('varanda', 'sala', adj)); assert.ok(!linked('quarto', 'quarto', adj))
  assert.ok(!linked('cozinha', 'quarto', adj)); assert.ok(!linked(null, 'sala', adj))
  const r = tourSegments(['fachada', 'sala', 'varanda', 'quarto', 'banheiro', 'cozinha'], adj, cfg.opening_rooms)
  assert.deepEqual(r.segments, [0, 1, 2, 3, 4].map(i => ({ kind: 'pair', from: i, to: i + 1 })))
  assert.deepEqual(r.passages, ['start', 'walk_unconfirmed', 'walk', 'walk_unconfirmed', 'walk', 'walk_unconfirmed'])   // varanda→quarto não é vizinho na ficha do teste
  assert.ok(!r.segments.some(s => s.kind === 'room'))
})
t('2 fotos do mesmo tipo (ex.: 2 quartos): caminha, mas marcada como não confirmada', () => {
  const r = tourSegments(['quarto', 'quarto'], cfg.adjacent_rooms, cfg.opening_rooms)
  assert.deepEqual(r.passages, ['start', 'walk_unconfirmed'])
})
t('corte só onde o dono pediu; foto sozinha vira trecho próprio (abertura se for de fora)', () => {
  const r = tourSegments(['fachada', 'sala', 'varanda', 'quarto'], cfg.adjacent_rooms, cfg.opening_rooms, [1, 3])
  assert.deepEqual(r.segments, [{ kind: 'opening', from: 0 }, { kind: 'pair', from: 1, to: 2 }, { kind: 'room', from: 3 }])
  assert.deepEqual(r.passages, ['start', 'cut', 'walk', 'cut'])
  assert.deepEqual(tourSegments(['sala', 'quarto'], cfg.adjacent_rooms, cfg.opening_rooms, [0, 2, 9, 1.5]).segments, [{ kind: 'pair', from: 0, to: 1 }])  // cortes inválidos ignorados
})
t('1 foto só: um trecho (abertura de fora só com foto de fachada/vista)', () => {
  assert.deepEqual(tourSegments(['vista'], cfg.adjacent_rooms, cfg.opening_rooms).segments, [{ kind: 'opening', from: 0 }])
  assert.deepEqual(tourSegments(['sala'], cfg.adjacent_rooms, cfg.opening_rooms).segments, [{ kind: 'room', from: 0 }])
})
t('toda foto aparece em algum trecho', () => {
  for (const [rooms, cuts] of [[['sala'], []], [['fachada'], []], [['fachada', 'vista', 'sala'], [1]], [['sala', 'quarto', 'sala', 'varanda', null, 'cozinha'], [2, 4, 5]]]) {
    const { segments } = tourSegments(rooms, cfg.adjacent_rooms, cfg.opening_rooms, cuts)
    const seen = new Set(segments.flatMap(s => (s.to !== undefined ? [s.from, s.to] : [s.from])))
    assert.equal(seen.size, rooms.length, JSON.stringify(rooms))
  }
})
t('duração = soma dos trechos', () => {
  const { segments } = tourSegments(['fachada', 'sala', 'varanda'], cfg.adjacent_rooms, cfg.opening_rooms)
  assert.equal(tourSeconds(segments, { opening: 5, pair: 6, room: 5 }), 12)
})
t('a cópia da tela dá as mesmas passagens que o servidor', () => {
  const cases = [['fachada', 'sala', 'varanda', 'quarto', 'banheiro', 'cozinha'], ['sala', null, 'sala'], ['vista'], [], ['quarto', 'banheiro', 'quarto']]
  for (const c of cases) for (const cuts of [[], [1], [1, 2], [2, 4]]) assert.deepEqual(front.tourSegments(c, cfg.adjacent_rooms, cfg.opening_rooms, cuts), tourSegments(c, cfg.adjacent_rooms, cfg.opening_rooms, cuts), JSON.stringify([c, cuts]))
})
t('plano da semana sem tour: estratégia, calendário e "pra fazer" (servidor e tela)', () => {
  const fmts = [{ key: 'reel', name: 'Vídeo', pillar: 'x', producer: 'item_video', status: 'live' }, { key: 'card', name: 'Card', pillar: 'x', producer: 'post', status: 'live' }]
  assert.deepEqual(planningFormats(fmts).map(f => f.key), ['card']); assert.equal(inWeeklyPlan('item_video'), false); assert.equal(inWeeklyPlan('post'), true)
  const mix = [{ format: 'reel', name: 'Vídeo', producer: 'item_video', per_week: 3, pillar: 'x', purpose: '' }, { format: 'card', name: 'Card', producer: 'post', per_week: 4, pillar: 'x', purpose: '' }]
  const dates = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']
  assert.ok(weekSlots({ weekly_mix: mix }, dates).every(s => s.producer === 'post'))
  assert.ok(frontWeekSlots(mix, dates).every(s => s.producer === 'post'))
  assert.deepEqual(FRONT_OUT, ['item_video'])
  assert.deepEqual(ensureMinVideos(mix, fmts, 3).map(m => m.format), ['card'])
  assert.deepEqual(weeklyMixPlan({ weekly_mix: mix }).todo, [])
})
t('servidor: tour só pelo caminho com peça e encerramento; passagens recalculadas pela nota gravada; teto conferido', () => {
  const iv = readFileSync(new URL('../supabase/functions/item-videos/index.ts', import.meta.url), 'utf8')
  const create = iv.slice(iv.indexOf("body.action === 'create' && body.kind === 'tour'"), iv.indexOf("if (body.action === 'create') {"))
  assert.match(create, /if \(!isCron\) return json/)
  assert.match(create, /requirePaidAccess/); assert.match(create, /ownerBlockMessage/); assert.match(create, /validEndcardUrl/)
  assert.match(create, /tourSegments\(photos\.map\(u => roomOf\(meta\.get\(u\) as never, tcfg\)\), tcfg\.adjacent_rooms, tcfg\.opening_rooms, cuts\)/)
  assert.match(iv.slice(iv.indexOf('async function createTourVideo')), /fitsCap\(admin, company\.id, estimate\)/)
  const cg = readFileSync(new URL('../supabase/functions/creative-generate/index.ts', import.meta.url), 'utf8')
  const tp = cg.slice(cg.indexOf("body.action === 'tour_piece'"), cg.indexOf("body.action === 'relearn'"))
  assert.match(tp, /studioReady/); assert.match(tp, /ownerBlockMessage/); assert.match(tp, /roomOf\(byUrl\.get\(u\)/)
  assert.match(cg, /planned_for: full \? null/)   // tour nasce sem dia: o dono aprova em Aprovações
  const guard = readFileSync(new URL('../src/lib/showcaseGuard.ts', import.meta.url), 'utf8')
  assert.match(guard, /'item-videos': \{ actions: \['create', 'plan_tour'\] \}/)
})
console.log(`\n${n} verificações ok`)
