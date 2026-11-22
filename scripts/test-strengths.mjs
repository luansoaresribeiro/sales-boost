import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-strengths.mjs
// Pontos fortes, item 4 (22/11): as marcas do imóvel decidem a foto de abertura e a primeira frase; sem marca = como antes.
import { strengthsCfgFrom, itemMarks, coverRoomsWithMarks, hookLine, markedPhoto } from '../supabase/functions/_shared/strengths.ts'
import { pickCoverPhoto } from '../supabase/functions/_shared/carouselOffer.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

const mig = readFileSync(new URL('../supabase/migrations/20261122150000_pontos_fortes_capa_gancho.sql', import.meta.url), 'utf8')
const cfg = strengthsCfgFrom({ strengths: JSON.parse(mig.match(/\$json\$(\{[\s\S]*?\})\$json\$/)[1]) })
assert.deepEqual(cfg.fields, ['pontos_imovel', 'pontos_localizacao']); ok('ficha: marcas de imóvel antes das de localização; "para quem é" fora')
const approved = JSON.parse(readFileSync(new URL('../supabase/migrations/20261122130000_pontos_fortes_marcas.sql', import.meta.url), 'utf8').match(/\$json\$(\[[\s\S]*?\])\$json\$/)[1])[1].options.map(o => o.pt)
assert.ok(Object.keys(cfg.rooms).every(m => approved.includes(m))); ok('só marcas aprovadas puxam cômodo')

const marks = itemMarks({ pontos_localizacao: ['Perto da praia'], pontos_imovel: ['Varanda', 'Lazer completo'], pontos_para_quem: ['Morar'] }, cfg)
assert.deepEqual(marks, ['Varanda', 'Lazer completo', 'Perto da praia']); ok('marcas na ordem da ficha; "para quem é" nunca entra')
assert.deepEqual(itemMarks({}, cfg), []); assert.deepEqual(itemMarks({ pontos_imovel: 'Varanda' }, cfg), []); assert.deepEqual(itemMarks({ pontos_imovel: ['Varanda'] }, null), []); ok('sem marca, valor estranho ou ficha sem regra: nada')

const base = { priority: ['fachada', 'vista', 'sala', 'varanda'], avoid: ['banheiro'] }
const photos = [{ url: 'https://x/sala.jpg', room: 'sala', quality: 90 }, { url: 'https://x/varanda.jpg', room: 'varanda', quality: 70 }, { url: 'https://x/ban.jpg', room: 'banheiro', quality: 99 }]
assert.equal(pickCoverPhoto(photos, base).url, 'https://x/sala.jpg'); ok('sem marca: capa como antes (sala)')
const mc = coverRoomsWithMarks(base, marks, cfg)
assert.equal(pickCoverPhoto(photos, mc.rooms).url, 'https://x/varanda.jpg'); assert.equal(mc.why, 'Varanda'); ok('"Varanda" marcada: a varanda abre o post, com o motivo anotado')
assert.equal(coverRoomsWithMarks(base, ['Lazer completo'], cfg).why, null); ok('marca sem cômodo na ficha: capa como antes')
assert.deepEqual(coverRoomsWithMarks({ priority: [], avoid: ['varanda'] }, ['Varanda'], cfg).rooms.priority, ['vista']); ok('cômodo "a evitar" da ficha continua evitado')
const noRoom = [{ url: 'https://x/sala.jpg', room: 'sala', quality: 90 }]
assert.equal(pickCoverPhoto(noRoom, mc.rooms).url, 'https://x/sala.jpg'); ok('sem foto do cômodo marcado: usa a melhor que existe (nada inventado)')

assert.equal(hookLine([]), ''); assert.match(hookLine(marks), /Abra a legenda pelo primeiro \("Varanda"\)[\s\S]*sem acrescentar/); ok('gancho: primeira frase pela marca mais forte, sem acrescentar')
const src = readFileSync(new URL('../supabase/functions/catalog-package/index.ts', import.meta.url), 'utf8')
assert.ok(/\$\{hookLine\(marks\)\}/.test(src) && (src.match(/markCover\.rooms/g) ?? []).length >= 4 && !/pickCoverPhoto\(photos, ficha\.coverRooms\)/.test(src)); ok('catalog-package usa capa e gancho das marcas em todas as receitas')
assert.ok(/markPick \? `Foto de abertura escolhida pelo ponto forte marcado/.test(src)); ok('o motivo só é anotado quando a foto da marca foi mesmo usada')
// Caso real 22/11 (Teste Zero, Apartamento Leblon): "detalhe" usava a ÚLTIMA foto (quarto) e a legenda falava da varanda.
const apto = [{ url: 'https://x/1.jpg', room: 'sala_jantar' }, { url: 'https://x/2.jpg', room: 'sala' }, { url: 'https://x/3.jpg', room: 'varanda' }, { url: 'https://x/4.jpg', room: 'sala_jantar' }, { url: 'https://x/5.jpg', room: 'quarto' }]
assert.deepEqual(markedPhoto(apto, ['Varanda'], cfg), { photo: apto[2], mark: 'Varanda' }); ok('"Varanda" marcada: a foto da varanda é a escolhida')
assert.equal(markedPhoto(apto, ['Lazer completo'], cfg), null); assert.equal(markedPhoto(photos.slice(0, 1), ['Varanda'], cfg), null); assert.equal(markedPhoto(apto, ['Varanda'], null), null); ok('sem foto do cômodo da marca (ou sem regra): nada é anotado como escolhido pela marca')
assert.ok(/media = \[\{ url: \(markPick\?\.photo \?\? photos\[photos\.length - 1\]\)\.url/.test(src)); ok('receita "detalhe" usa a foto da marca (antes: sempre a última foto)')
console.log(`\n${n} ok`)
