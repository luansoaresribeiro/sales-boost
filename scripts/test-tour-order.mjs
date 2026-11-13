// Roda: node --experimental-strip-types scripts/test-tour-order.mjs
// Tour virtual completo (menu próprio, dono 2026-11-10): ordem dos cômodos, imóvel inteiro em caminhada contínua sem cortes (11/11), cópia da tela,
// tour fora do plano da semana e as travas do servidor.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { orderTour, tourSegments, tourOrderCfgFrom, linked, roomOf, tourSeconds } from '../supabase/functions/_shared/tourOrder.ts'
import * as front from '../src/lib/tourOrder.ts'
import { withOutsideFirst } from '../supabase/functions/_shared/tourOrder.ts'
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

t('config: walk_order da ficha, até 15 fotos e 2 por cômodo por padrão (imóvel inteiro); sem walk_order usa room_priority', () => {
  assert.equal(ocfg.tour_max_photos, 15); assert.equal(ocfg.tour_per_room, 2); assert.equal(ocfg.walk_order[2], 'hall')
  assert.deepEqual(tourOrderCfgFrom({ tour: { room_priority: ['sala'] } }, { room_priority: ['sala'] }).walk_order, ['sala'])
  assert.equal(tourOrderCfgFrom({ tour: { tour_max_photos: 99 } }, cfg).tour_max_photos, 15)   // fora da faixa = padrão
  assert.equal(tourOrderCfgFrom({ tour: { tour_max_photos: 16 } }, cfg).tour_max_photos, 16)
})
t('ordem: começa de fora com a MELHOR foto de fora (só uma) e segue a ordem da ficha', () => {
  const o = orderTour([P(1, 'quarto'), P(2, 'cozinha'), P(3, 'fachada', 70), P(4, 'sala'), P(5, 'vista', 90), P(6, 'banheiro')], cfg, ocfg)
  assert.deepEqual(o.rooms, ['vista', 'sala', 'cozinha', 'quarto', 'banheiro'])
  assert.deepEqual(o.excluded.map(e => e.reason), ['repeat_room'])   // a 2ª foto de fora fica disponível pra incluir
})
t('IMÓVEL INTEIRO: 1 foto de CADA cômodo antes de qualquer 2ª foto; limite avisa o cômodo que faltou', () => {
  const photos = [P(1, 'sala', 95), P(2, 'sala', 90), P(3, 'sala', 85), P(4, 'cozinha'), P(5, 'quarto'), P(6, 'banheiro'), P(7, 'varanda'), P(8, 'hall')]
  const o = orderTour(photos, cfg, ocfg)
  assert.deepEqual([...new Set(o.rooms)].sort(), ['banheiro', 'cozinha', 'hall', 'quarto', 'sala', 'varanda'])
  assert.equal(o.rooms.filter(r => r === 'sala').length, 2)   // 2ª foto da sala entra (cabe no limite); a 3ª não
  assert.deepEqual(o.missing_rooms, [])
  const small = tourOrderCfgFrom({ tour: { ...config.tour, tour_max_photos: 3 } }, cfg)
  const s = orderTour(photos, cfg, small)
  assert.equal(s.photos.length, 3); assert.ok(!s.rooms.includes('sala') || s.rooms.filter(r => r === 'sala').length === 1)   // nunca 2ª foto antes de cobrir os cômodos
  assert.equal(s.missing_rooms.length, 3)
})
t('foto ruim fica de fora com motivo; sem nota vai pro fim', () => {
  const o = orderTour([{ url: 'https://x/a.jpg' }, P(1, 'sala'), P(2, 'quarto', 80, 0.3), P(4, 'cozinha', 30)], cfg, ocfg)
  assert.deepEqual(o.photos, ['https://x/1.jpg', 'https://x/a.jpg', 'https://x/2.jpg'])
  assert.deepEqual(o.excluded.map(e => e.reason), ['low_quality'])
  assert.equal(roomOf(P(2, 'quarto', 80, 0.3), cfg), null)
})
t('limite de fotos por tour', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ url: `https://x/u${i}.jpg` }))
  const o = orderTour(many, cfg, ocfg)
  assert.equal(o.photos.length, 15); assert.equal(o.excluded.filter(e => e.reason === 'over_limit').length, 5)
})
t('url inválida ou repetida não entra', () => {
  const o = orderTour([P(1, 'sala'), P(1, 'sala'), { url: 'http://inseguro/x.jpg', room: 'sala', room_conf: 1, quality: 90 }], cfg, ocfg)
  assert.deepEqual(o.photos, ['https://x/1.jpg'])
})
t('ZERO CORTES (dono, 11/11): com 2+ fotos, todo trecho é caminhada até a foto seguinte — em qualquer ordem', () => {
  const cases = [['sala', 'varanda', 'quarto', 'banheiro', 'cozinha'], ['quarto', 'quarto'], ['sala', null, 'sala'], ['fachada', 'vista', 'hall', 'sala'], ['sala', 'vista', 'quarto'], ['vista', 'sala']]
  for (const rooms of cases) {
    const { segments, passages } = tourSegments(rooms, cfg.adjacent_rooms, cfg.opening_rooms, [1, 2])   // cuts de tela antiga: ignorados
    assert.equal(segments.length, rooms.length - 1, JSON.stringify(rooms))
    assert.ok(segments.every((s, i) => s.kind === 'pair' && s.from === i && s.to === i + 1), JSON.stringify(rooms))
    assert.ok(!passages.some(p => p === 'cut' || p === 'enter'))
  }
  const r = tourSegments(['sala', 'varanda', 'quarto', 'banheiro'], cfg.adjacent_rooms, cfg.opening_rooms)
  assert.deepEqual(r.passages, ['start', 'walk', 'walk_unconfirmed', 'walk'])
  assert.deepEqual(tourSegments(['quarto', 'quarto'], cfg.adjacent_rooms, cfg.opening_rooms).passages, ['start', 'walk_unconfirmed'])
})
t('foto DE FORA: a câmera entra caminhando (walk_in, com instrução própria), sem corte', () => {
  const r = tourSegments(['vista', 'sala', 'sala_jantar', 'cozinha', 'quarto'], cfg.adjacent_rooms, cfg.opening_rooms)
  assert.deepEqual(r.segments[0], { kind: 'pair', from: 0, to: 1, entry: true })
  assert.ok(r.segments.slice(1).every(s => !s.entry))
  assert.deepEqual(r.passages, ['start', 'walk_in', 'walk', 'walk', 'walk_unconfirmed'])
  const iv = readFileSync(new URL('../supabase/functions/item-videos/index.ts', import.meta.url), 'utf8')
  assert.match(iv, /prompt: g\.entry \? prompts\.pair_in : prompts\[g\.kind\]/)
})
t('1 foto só: um trecho solto (abertura de fora só com foto de fachada/vista)', () => {
  assert.deepEqual(tourSegments(['vista'], cfg.adjacent_rooms, cfg.opening_rooms).segments, [{ kind: 'opening', from: 0 }])
  assert.deepEqual(tourSegments(['sala'], cfg.adjacent_rooms, cfg.opening_rooms).segments, [{ kind: 'room', from: 0 }])
})
t('duração = soma dos trechos (N fotos = N−1 caminhadas)', () => {
  const { segments } = tourSegments(['fachada', 'sala', 'varanda'], cfg.adjacent_rooms, cfg.opening_rooms)
  assert.equal(tourSeconds(segments, { opening: 5, pair: 6, room: 5 }), 12)
})
t('instrução de câmera: drone só no MOVIMENTO, nunca inventar arquitetura; entrada de fora com instrução própria', () => {
  const eng = readFileSync(new URL('../supabase/functions/_shared/tourEngine.ts', import.meta.url), 'utf8')
  // motivo da falha do fornecedor guardado e traduzido (11/11: "sem crédito" virava só "passagem falhou 2x")
  assert.ok(eng.includes('sem crédito no Higgsfield') && eng.includes('c.error = st.error') && eng.includes('error: failReason('))
  const rule = /must not invent geometry, architecture, rooms, furniture or landscape that is not supported by the two photos/
  const pair = eng.slice(eng.indexOf('  pair:'), eng.indexOf('  pair_in:')), pairIn = eng.slice(eng.indexOf('  pair_in:'), eng.indexOf('  opening:'))
  assert.match(pair, rule); assert.match(pairIn, rule); assert.match(pair, /no cut and no jump/); assert.match(pairIn, /visible in the photos/)
  assert.match(eng, /pair_in: WALK_SECONDS/)
})
t('orçamento: tour completo não refaz trecho sozinho; falha cobra só os trechos prontos', () => {
  const iv = readFileSync(new URL('../supabase/functions/item-videos/index.ts', import.meta.url), 'utf8')
  const eng = readFileSync(new URL('../supabase/functions/_shared/tourEngine.ts', import.meta.url), 'utf8')
  assert.match(iv.slice(iv.indexOf('async function createTourVideo')), /max_attempts: 1/)
  assert.match(eng, /const max = notAccepted \? MAX_ATTEMPTS : \(c\.max_attempts \?\? MAX_ATTEMPTS\)/)
  assert.match(iv, /const paid = full \? paidClips\.reduce/)
  const mig = readFileSync(new URL('../supabase/migrations/20261111180000_tour_imovel_inteiro.sql', import.meta.url), 'utf8')
  assert.match(mig, /tour_max_photos\}', '15'/)
})
t('dono escolhe abrir de fora com a 1ª foto: só ambientes da ficha (varanda sim, quarto nunca)', () => {
  const op = cfg.opening_rooms, cand = ['varanda']
  assert.deepEqual(withOutsideFirst(['varanda', 'sala'], op, cand, true), [op[op.length - 1], 'sala'])
  assert.deepEqual(withOutsideFirst(['varanda', 'sala'], op, cand, false), ['varanda', 'sala'])
  assert.deepEqual(withOutsideFirst(['quarto', 'sala'], op, cand, true), ['quarto', 'sala'])
  assert.deepEqual(withOutsideFirst([null, 'sala'], op, cand, true), [null, 'sala'])
  assert.deepEqual(withOutsideFirst(['vista', 'sala'], op, cand, true), ['vista', 'sala'])
  const r = tourSegments(withOutsideFirst(['varanda', 'sala', 'sala_jantar'], op, cand, true), cfg.adjacent_rooms, op)
  assert.deepEqual(r.segments[0], { kind: 'pair', from: 0, to: 1, entry: true }); assert.equal(r.passages[1], 'walk_in')   // escolheu abrir de fora: entra caminhando
  for (const c of [['varanda', 'sala'], ['quarto'], [], ['vista', 'varanda']]) for (const f of [true, false]) assert.deepEqual(front.withOutsideFirst(c, op, cand, f), withOutsideFirst(c, op, cand, f))
  const ficha = readFileSync(new URL('../supabase/migrations/20261111170000_tour_opening_candidates.sql', import.meta.url), 'utf8')
  assert.match(ficha, /opening_candidates\}', '\["varanda"\]'/)
  const iv = readFileSync(new URL('../supabase/functions/item-videos/index.ts', import.meta.url), 'utf8')
  const cg = readFileSync(new URL('../supabase/functions/creative-generate/index.ts', import.meta.url), 'utf8')
  assert.match(iv, /withOutsideFirst\(photos\.map\(u => roomOf\(meta\.get\(u\) as never, tcfg\)\), tcfg\.opening_rooms, ocfg\.opening_candidates, body\.outside_first === true\)/)
  assert.match(cg, /withOutsideFirst\(order\.map\(u => roomOf\(byUrl\.get\(u\) as never, tcfg\)\), tcfg\.opening_rooms, ocfg\.opening_candidates, outsideFirst\)/)
  assert.match(cg, /outside_first: full\.outsideFirst === true/)
})
t('prompt de abertura: drone, mas só dentro da foto (código e ficha)', () => {
  const eng = readFileSync(new URL('../supabase/functions/_shared/tourEngine.ts', import.meta.url), 'utf8')
  const mig = readFileSync(new URL('../supabase/migrations/20261111160000_tour_abertura_aerea.sql', import.meta.url), 'utf8')
  for (const src of [eng, mig]) { assert.match(src, /aerial drone shot/); assert.match(src, /never reveal anything beyond the edges of the frame/) }
})
t('a cópia da tela dá as mesmas passagens que o servidor', () => {
  const cases = [['fachada', 'sala', 'varanda', 'quarto', 'banheiro', 'cozinha'], ['sala', null, 'sala'], ['vista'], [], ['quarto', 'banheiro', 'quarto'], ['fachada', 'vista', 'hall'], ['sala', 'vista', 'quarto']]
  for (const c of cases) assert.deepEqual(front.tourSegments(c, cfg.adjacent_rooms, cfg.opening_rooms), tourSegments(c, cfg.adjacent_rooms, cfg.opening_rooms), JSON.stringify(c))
  const tb = readFileSync(new URL('../src/pages/dashboard/TourBuilder.tsx', import.meta.url), 'utf8')
  assert.ok(!/✂️|toggleCut|cutBefore/.test(tb))   // tela sem botão de corte
  assert.match(tb, /missingRooms/)
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
  assert.match(create, /tourSegments\(rooms, tcfg\.adjacent_rooms, tcfg\.opening_rooms\)/)
  assert.match(iv.slice(iv.indexOf('async function createTourVideo')), /fitsCap\(admin, company\.id, estimate\)/)
  const cg = readFileSync(new URL('../supabase/functions/creative-generate/index.ts', import.meta.url), 'utf8')
  const tp = cg.slice(cg.indexOf("body.action === 'tour_piece'"), cg.indexOf("body.action === 'relearn'"))
  assert.match(tp, /studioReady/); assert.match(tp, /ownerBlockMessage/); assert.match(tp, /roomOf\(byUrl\.get\(u\)/)
  assert.match(cg, /planned_for: full \? null/)   // tour nasce sem dia: o dono aprova em Aprovações
  const guard = readFileSync(new URL('../src/lib/showcaseGuard.ts', import.meta.url), 'utf8')
  assert.match(guard, /'item-videos': \{ actions: \['create', 'plan_tour'\] \}/)
})
t('agente de conteúdo só com FOTO: "Gerar agora" não oferece nem aceita vídeo; card do imóvel aponta pro Tour virtual; avatar "em breve"', () => {
  const cg = readFileSync(new URL('../supabase/functions/creative-generate/index.ts', import.meta.url), 'utf8')
  assert.match(cg, /const canMake = \(f: typeof formats\[number\]\) => f\.status === 'live' && f\.producer !== 'dm' && inWeeklyPlan\(f\.producer\) && \(f\.producer === 'post' \|\| !!f\.recipe\)/)
  assert.match(cg, /if \(!inWeeklyPlan\(f\.producer\)\) return 'Vídeo do imóvel agora é feito no menu Tour virtual\.'/)
  const cat = readFileSync(new URL('../src/pages/dashboard/marketingAi/CatalogItems.tsx', import.meta.url), 'utf8')
  assert.ok(!/<ItemVideos/.test(cat)); assert.match(cat, /\/dashboard\/tour-virtual/)
  const tv = readFileSync(new URL('../src/pages/dashboard/TourVirtualPage.tsx', import.meta.url), 'utf8')
  assert.match(tv, /EM BREVE/); assert.match(tv, /<button disabled title=\{tx\.avatarHelp\}/)
})
t('fotos de ligação: resposta da IA lida com segurança; só "não" bloqueia; servidor recusa sem confirmação', async () => {})
{
  const pc = await import('../supabase/functions/_shared/passageCheck.ts')
  assert.deepEqual(pc.parsePassageCheck('{"linked":"yes","missing":""}'), { linked: 'yes', missing: null })
  assert.deepEqual(pc.parsePassageCheck('texto {"linked":"no","missing":"escada"} fim'), { linked: 'no', missing: 'escada' })
  assert.deepEqual(pc.parsePassageCheck('{"linked":"no","missing":"door"}'), { linked: 'no', missing: 'porta' })
  assert.deepEqual(pc.parsePassageCheck('{"linked":"talvez"}'), { linked: 'unsure', missing: null })
  assert.equal(pc.parsePassageCheck('lixo'), null)
  // v2: descrição antes do JSON — vale o último objeto com "linked"
  assert.deepEqual(pc.parsePassageCheck('FOTO 1: sala {piso madeira}. FOTO 2: jogos.\n{"linked":"no","missing":"escada"}'), { linked: 'no', missing: 'escada' })
  // cache de versão antiga é refeito
  // v3: a regra decide a partir dos fatos (casos do vídeo real da Tespon)
  const F = (o1, o2, same, st, door) => ({ outside1: o1, outside2: o2, sameFloor: same, stairsInPhoto1: st, doorBetweenVisible: door })
  assert.deepEqual(pc.decidePassage(F('yes', 'no', 'yes', 'no', 'no')), { linked: 'no', missing: 'porta' })      // piscina → salão sem porta
  assert.deepEqual(pc.decidePassage(F('yes', 'no', 'yes', 'no', 'unsure')), { linked: 'no', missing: 'porta' })  // v4: porta incerta também bloqueia
  assert.deepEqual(pc.decidePassage({ ...F('no', 'no', 'yes', 'no', 'unsure'), stairsInPhoto2: 'yes' }), { linked: 'no', missing: 'escada' }) // v4: escada só no destino (jogos → sala de baixo)
  assert.deepEqual(pc.decidePassage({ ...F('no', 'no', 'yes', 'yes', 'unsure'), stairsInPhoto2: 'yes' }), { linked: 'yes', missing: null })
  assert.deepEqual(pc.decidePassage(F('yes', 'no', 'yes', 'no', 'yes')), { linked: 'yes', missing: null })      // terraço com porta de vidro → salão
  assert.deepEqual(pc.decidePassage(F('no', 'no', 'no', 'no', 'unsure')), { linked: 'no', missing: 'escada' })  // jogos → sala de baixo
  assert.deepEqual(pc.decidePassage(F('no', 'no', 'no', 'yes', 'unsure')), { linked: 'yes', missing: null })    // escada na foto de saída
  assert.deepEqual(pc.decidePassage(F('no', 'no', 'yes', 'no', 'unsure')), { linked: 'yes', missing: null })    // hall → quarto
  assert.equal(pc.decidePassage(F('yes', 'yes', 'yes', 'no', 'unsure')).linked, 'unsure')                      // fora → fora
  assert.equal(pc.decidePassage(F('no', 'no', 'unsure', 'no', 'unsure')).linked, 'unsure')
  assert.deepEqual(pc.parseFacts('Foto 1: sala. {x}\n{"photo1_outside":"no","photo2_outside":"no","same_floor":"no","stairs_in_photo1":"no","door_between_visible":"unsure"}'), { ...F('no', 'no', 'no', 'no', 'unsure'), stairsInPhoto2: 'unsure' })
  assert.equal(pc.parseFacts('sem json'), null)
  assert.ok(!pc.isCurrent({ linked: 'yes', missing: null })); assert.ok(pc.isCurrent({ linked: 'yes', missing: null, v: pc.CHECK_VERSION }))
  assert.ok(pc.blocks({ linked: 'no', missing: 'escada' })); assert.ok(!pc.blocks({ linked: 'unsure', missing: null })); assert.ok(!pc.blocks(null))
  assert.equal(pc.pairKey('https://x/a/1.jpg?v=2', 'https://x/b/2.jpg'), '1.jpg>2.jpg'); assert.notEqual(pc.pairKey('a/1.jpg', 'b/2.jpg'), pc.pairKey('b/2.jpg', 'a/1.jpg'))
  const cg = readFileSync(new URL('../supabase/functions/creative-generate/index.ts', import.meta.url), 'utf8')
  assert.match(cg, /if \(unlinked\.length && body\.confirm_unlinked !== true\)/); assert.match(cg, /code: 'unlinked'/)
  const iv = readFileSync(new URL('../supabase/functions/item-videos/index.ts', import.meta.url), 'utf8')
  const cp = iv.slice(iv.indexOf("body.action === 'check_passages'"), iv.indexOf("body.action === 'plan_tour'"))
  assert.match(cp, /requirePaidAccess/); assert.match(cp, /photos\.some\(u => !own\.has\(u\)\)/)
  const tb = readFileSync(new URL('../src/pages/dashboard/TourBuilder.tsx', import.meta.url), 'utf8')
  assert.match(tb, /disabled=\{busy \|\| order\.length < 2 \|\| !!plan\.blocked \|\| \(unlinkedCount > 0 && !confirmUnlinked\)\}/)
  assert.match(tb, /confirm_unlinked: confirmUnlinked/)
  const tv = readFileSync(new URL('../src/lib/verticalPlaybook.ts', import.meta.url), 'utf8')
  assert.match(tv, /if \(tipo && bairro\) return `\$\{tipo\} \$\{bairro\}`/)   // título "Tipo Bairro"
}
console.log(`\n${n} verificações ok`)

// Legenda do tour: ambientes na ordem do vídeo (2026-11-13)
{
  const { tourRoomLabels } = await import('../supabase/functions/_shared/tourOrder.ts')
  const L = [{ key: 'varanda', label: 'varanda' }, { key: 'sala', label: 'sala' }, { key: 'quarto', label: 'quarto' }, { key: 'banheiro', label: 'banheiro' }]
  const a = tourRoomLabels(['varanda', 'sala', 'sala', null, 'quarto', 'banheiro'], L, true)
  if (JSON.stringify(a) !== JSON.stringify(['área externa', 'sala', 'outro ambiente', 'quarto', 'banheiro'])) throw new Error('tourRoomLabels outside: ' + JSON.stringify(a))
  const b = tourRoomLabels(['varanda', 'sala'], L, false)
  if (JSON.stringify(b) !== JSON.stringify(['varanda', 'sala'])) throw new Error('tourRoomLabels: ' + JSON.stringify(b))
  console.log('ok — legenda do tour recebe os ambientes na ordem do vídeo')
}

// Exatamente 1 post por dia, 7 por semana (dono, 2026-11-13) — servidor e tela iguais
{
  const { weekSlots: wsS, dailySeven } = await import('../supabase/functions/_shared/formatCatalog.ts')
  const { weekSlots: wsF } = await import('../src/lib/weekSlots.ts')
  const dates = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']
  const it = (format, producer, per_week) => ({ format, name: format, producer, per_week, pillar: 'x', purpose: '' })
  const cases = {
    'A3 (8 com DM)': [it('carrossel_imovel', 'item_package', 2), it('comente_quero', 'dm', 1), it('o_que_rs_compra', 'item_package', 1), it('tres_coisas_perto', 'item_package', 1), it('carrossel_educativo', 'post', 2), it('dica_faq', 'post', 1)],
    'Teste Zero (6 de verdade)': [it('carrossel_imovel', 'item_package', 2), it('comente_quero', 'dm', 2), it('o_que_rs_compra', 'item_package', 1), it('carrossel_educativo', 'post', 1), it('dica_faq', 'post', 1), it('tres_coisas_perto', 'item_package', 1), it('video_comodo', 'item_video', 2)],
    'só 2 peças': [it('carrossel_educativo', 'post', 1), it('carrossel_imovel', 'item_package', 1)],
    'demais (12)': [it('a', 'post', 4), it('b', 'item_package', 4), it('c', 'post', 4)],
    'só imóvel': [it('carrossel_imovel', 'item_package', 3)],
  }
  for (const [nome, mix] of Object.entries(cases)) {
    const s = wsS({ weekly_mix: mix }, dates), f = wsF(mix, dates)
    assert.equal(s.length, 7, nome + ': 7 posts')
    assert.deepEqual(s.map(x => x.date), dates, nome + ': 1 por dia, todos os dias')
    assert.ok(s.every(x => x.producer !== 'dm' && x.producer !== 'item_video'), nome + ': DM e vídeo não contam')
    assert.deepEqual(s, f, nome + ': tela igual ao servidor')
    const fmts = new Set(mix.filter(m => m.producer !== 'dm' && m.producer !== 'item_video').map(m => m.format))
    if (fmts.size > 1) assert.ok(s.every((x, i) => i === 0 || x.format !== s[i - 1].format), nome + ': mesmo formato não cai em dias seguidos')
  }
  // menos de 7: completa girando a fila, sem perder a variedade
  const s2 = wsS({ weekly_mix: cases['só 2 peças'] }, dates)
  assert.equal(s2.filter(x => x.producer === 'post').length, 4)
  // stories não contam
  const st = wsS({ weekly_mix: [it('stories_x', 'item_package', 3), it('carrossel_educativo', 'post', 1)] }, dates, { excludeFormats: ['stories_x'] })
  assert.ok(st.length === 7 && st.every(x => x.format !== 'stories_x'))
  assert.deepEqual(wsS({ weekly_mix: [] }, dates), [])
  assert.deepEqual(dailySeven([]), [])
  // servidor: vaga sem imóvel vira post (nunca dia vazio); caminho antigo = 1 por dia
  const cg = readFileSync(new URL('../supabase/functions/creative-generate/index.ts', import.meta.url), 'utf8')
  assert.match(cg, /if \(!recipe \|\| !picked\) \{ pushFiller\(slot\); continue \}/)
  assert.match(cg, /const postsCount = 1/)
  assert.match(cg, /excludeFormats: await storiesFormats\(admin, company\)/)
  console.log('ok — exatamente 1 post por dia, 7 por semana (servidor = tela)')
}
