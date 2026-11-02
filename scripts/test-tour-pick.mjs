import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-tour-pick.mjs
// Escolha de foto do tour: qualidade, cômodos a evitar, opening só com fachada/vista, pair só com vizinhos, variação.
import { tourCfgFrom, pickTour, kindForFormat, weekKinds, parsePhotoScore, tourNotice, PAIR_NOTICE, TOUR_NOTICE_PREFIX } from '../supabase/functions/_shared/tourPick.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

// Ficha de teste (a de verdade vive na migration; aqui só prova o código).
const cfg = tourCfgFrom({ tour: {
  rooms: [{ key: 'fachada', label: 'fachada' }, { key: 'vista', label: 'vista' }, { key: 'sala', label: 'sala' }, { key: 'varanda', label: 'varanda' }, { key: 'cozinha', label: 'cozinha' }, { key: 'quarto', label: 'quarto' }, { key: 'banheiro', label: 'banheiro' }, { key: 'corredor', label: 'corredor' }, { key: 'area_servico', label: 'área de serviço' }, { key: 'outro', label: 'outro' }],
  adjacent_rooms: [['sala', 'varanda'], ['sala', 'cozinha'], ['quarto', 'banheiro']],
  opening_rooms: ['fachada', 'vista'], room_priority: ['fachada', 'vista', 'sala', 'varanda', 'cozinha', 'quarto'],
  avoid_rooms: ['banheiro', 'corredor', 'area_servico'], min_quality: 50, min_room_conf: 0.6,
} })
const P = (url, room, quality, room_conf = 0.9) => ({ url, room, quality, room_conf })
const photos = [P('banheiro', 'banheiro', 95), P('corredor', 'corredor', 90), P('servico', 'area_servico', 88), P('cozinha', 'cozinha', 70), P('sala', 'sala', 80), P('varanda', 'varanda', 75), P('quarto', 'quarto', 60), P('fachada', 'fachada', 85), P('vista', 'vista', 72)]

// room: nunca banheiro/corredor/serviço havendo alternativa
const r1 = pickTour(photos, 'room', { cfg })
assert.equal(r1.kind, 'room'); assert.ok(!['banheiro', 'corredor', 'servico'].includes(r1.photos[0])); assert.equal(r1.photos[0], 'fachada'); ok('room: prioridade da ficha, sem banheiro/corredor/serviço')
const onlyBad = pickTour([P('banheiro', 'banheiro', 95), P('corredor', 'corredor', 90)], 'room', { cfg })
assert.ok(onlyBad && onlyBad.photos[0] === 'banheiro'); ok('room: só entra banheiro/corredor se não houver alternativa')
assert.equal(pickTour([P('sala_ruim', 'sala', 20), P('quarto_bom', 'quarto', 80)], 'room', { cfg }).photos[0], 'quarto_bom'); ok('room: abaixo do piso de qualidade perde')
assert.equal(pickTour([{ url: 'sem_nota' }, P('quarto_ok', 'quarto', 55)], 'room', { cfg }).photos[0], 'quarto_ok'); ok('room: foto sem nota é último recurso')
const only = pickTour([{ url: 'sem_nota' }], 'room', { cfg }); assert.match(only.notes.join(' '), /sem nota/); ok('room: sem nota avisa')
assert.equal(pickTour([], 'room', { cfg }), null); ok('sem fotos = null')

// variação: exclui cômodos dos últimos tours e os já tomados na semana
const v1 = pickTour(photos, 'room', { cfg, recentRooms: ['fachada', 'vista'] }); assert.equal(v1.rooms[0], 'sala'); ok('variar: pula os 2 últimos cômodos do imóvel')
const taken = new Set(), takenP = new Set(), seen = []
for (let i = 0; i < 3; i++) { const c = pickTour(photos, 'room', { cfg, takenRooms: taken, takenPhotos: takenP }); seen.push(c.rooms[0]); taken.add(c.rooms[0]); takenP.add(c.photos[0]) }
assert.equal(new Set(seen).size, 3); ok(`3 vagas na semana = 3 cômodos diferentes (${seen.join(', ')})`)
assert.equal(pickTour(photos, 'room', { cfg, usedPhotos: new Set(['fachada']) }).photos[0], 'vista'); ok('prefere foto ainda não usada em vídeo')

// opening: só fachada/vista com confiança e qualidade
const op = pickTour(photos, 'opening', { cfg }); assert.equal(op.kind, 'opening'); assert.equal(op.photos[0], 'fachada'); ok('opening: usa fachada/vista')
const noOut = photos.filter(p => !['fachada', 'vista'].includes(p.room))
const fb = pickTour(noOut, 'opening', { cfg }); assert.equal(fb.kind, 'room'); assert.match(fb.notes[0], /opening/); ok('opening sem fachada/vista cai pra room e avisa')
assert.equal(pickTour([P('f', 'fachada', 90, 0.3), P('q', 'quarto', 70)], 'opening', { cfg }).kind, 'room'); ok('opening: confiança baixa na fachada não vale')
assert.equal(pickTour([P('f', 'fachada', 30), P('q', 'quarto', 70)], 'opening', { cfg }).kind, 'room'); ok('opening: qualidade baixa não vale')

// pair: só vizinhos da ficha, na ordem da ficha, com aviso
const pr = pickTour(photos, 'pair', { cfg }); assert.equal(pr.kind, 'pair'); assert.equal(pr.photos.length, 2)
assert.ok(cfg.adjacent_rooms.some(([a, b]) => a === pr.rooms[0] && b === pr.rooms[1])); assert.ok(pr.notes.includes(PAIR_NOTICE)); ok(`pair: vizinhos da ficha em ordem (${pr.rooms.join(' → ')}) + aviso de planta`)
assert.deepEqual(pickTour([P('v', 'varanda', 80), P('s', 'sala', 70)], 'pair', { cfg }).rooms, ['sala', 'varanda']); ok('pair: ordem segue a ficha (sala → varanda)')
assert.notEqual(pickTour([P('s', 'sala', 80), P('q', 'quarto', 80)], 'pair', { cfg }).kind, 'pair'); ok('pair: sala e quarto não são vizinhos → não faz pair')
assert.equal(pickTour([P('s1', 'sala', 80), P('s2', 'sala', 80)], 'pair', { cfg }).kind, 'room'); ok('pair: dois da mesma sala não é pair')
assert.equal(pickTour([P('s', 'sala', 80), P('q', 'quarto', 80), P('f', 'fachada', 80)], 'pair', { cfg }).kind, 'opening'); ok('pair impossível cai pra opening quando há fachada')
assert.deepEqual(pickTour([P('q', 'quarto', 80), P('b', 'banheiro', 80)], 'pair', { cfg }).rooms, ['quarto', 'banheiro']); ok('pair quarto↔banheiro (suíte) é permitido pela ficha')
assert.equal(pickTour([P('s', 'sala', 80, 0.3), P('v', 'varanda', 80)], 'pair', { cfg }).kind, 'room'); ok('pair: cômodo com confiança baixa não conta')

// sem ficha (setor sem config.tour): só room, nunca pair/opening (regra 6)
const empty = tourCfgFrom(null)
assert.equal(pickTour(photos, 'pair', { cfg: empty }).kind, 'room'); assert.equal(pickTour(photos, 'opening', { cfg: empty }).kind, 'room'); ok('sem ficha: sempre room')
assert.equal(pickTour([P('a', 'x', 40), P('b', 'y', 90)], 'room', { cfg: empty }).photos[0], 'b'); ok('sem ficha: ainda escolhe a de maior qualidade')

// tipo da vaga
assert.equal(kindForFormat('video_comodo', cfg), 'room'); assert.equal(kindForFormat('video_dois_comodos', cfg), 'pair'); assert.equal(kindForFormat('video_abertura_vista', cfg), 'opening'); assert.equal(kindForFormat('outro', cfg), null); ok('formato → tipo')
assert.deepEqual(weekKinds(['room', 'room', 'room'], 0), ['room', 'pair', 'room']); assert.deepEqual(weekKinds([null, null, null], 1), ['room', 'opening', 'room']); ok('rodízio: 2ª vaga vira pair/opening por semana')
assert.deepEqual(weekKinds(['room', 'opening', 'room'], 0), ['room', 'opening', 'room']); assert.deepEqual(weekKinds(['room'], 0), ['room']); ok('rodízio respeita o pedido explícito e não mexe com 1 vaga')

// leitura tolerante da ficha
assert.deepEqual(tourCfgFrom({ tour: { adjacent_rooms: [['sala'], ['a', 'a'], ['Sala', 'Varanda']], min_quality: 'x' } }).adjacent_rooms, [['sala', 'varanda']]); assert.equal(tourCfgFrom({ tour: { min_quality: 'x' } }).min_quality, 50); ok('ficha lida de forma tolerante')

// nota da IA de visão
const rooms = cfg.rooms
assert.deepEqual(parsePhotoScore('{"room":"Sala","room_conf":0.9,"quality":81.4}', rooms), { room: 'sala', room_conf: 0.9, quality: 81 }); ok('nota: JSON válido')
assert.deepEqual(parsePhotoScore('{"room":"jardim","room_conf":0.9,"light":60,"sharp":70,"framing":80}', rooms), { room: null, room_conf: 0, quality: 70 }); ok('nota: cômodo fora da lista = desconhecido; qualidade pela média')
assert.equal(parsePhotoScore('não sei', rooms), null); assert.equal(parsePhotoScore('{"room":"sala"}', rooms), null); ok('nota: JSON inválido/sem qualidade = sem nota (nunca inventa)')
assert.equal(parsePhotoScore('{"room":"sala","room_conf":9,"quality":500}', rooms).quality, 100); ok('nota: valores clampados')

assert.equal(tourNotice([]), ''); assert.ok(tourNotice(['a', '', 'b']).startsWith(TOUR_NOTICE_PREFIX)); ok('aviso do tour')
console.log(`${n} grupos ok`)
