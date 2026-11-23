import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-guided-visit.mjs
// C8 (auditoria do conteúdo, etapa 2 — dono 23/11): carrossel "Visita guiada" e "Custo de morar".
import { buildGuidedVisitSlides, buildLivingCostSlides, costLines, guidedCfgFrom, visitPhotos, GUIDED_MAX_SLIDES } from '../supabase/functions/_shared/guidedVisit.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

// A ficha como a migration deixa (lida do próprio arquivo, para o teste não divergir dela).
const sql = readFileSync(new URL('../supabase/migrations/20261124100000_c8_visita_guiada.sql', import.meta.url), 'utf8')
const blocks = [...sql.matchAll(/\$json\$([\s\S]*?)\$json\$/g)].map(m => JSON.parse(m[1]))
const offerGuided = blocks[0]
const walk = ['fachada', 'vista', 'hall', 'sala', 'sala_jantar', 'varanda', 'cozinha', 'area_servico', 'corredor', 'quarto', 'banheiro']
const ficha = { offer_guided: offerGuided, tour: { walk_order: walk } }
const cfg = guidedCfgFrom(ficha, 'pt')
assert.ok(cfg); assert.equal(cfg.texts.invite_title, 'Quer ver de perto?'); assert.equal(cfg.walkOrder[0], 'fachada'); ok('ficha do Rio lida da migration')
assert.equal(guidedCfgFrom({}, 'pt'), null); assert.equal(guidedCfgFrom({ offer_guided: { ...offerGuided, enabled: false } }, 'pt'), null); ok('sem ficha ou desligada = carrossel antigo')
assert.equal(guidedCfgFrom(ficha, 'en').texts.cost_condo, 'HOA'); ok('EUA em inglês')
const fmt = blocks[1][0]
assert.equal(fmt.recipe, 'carrossel_custo_de_morar'); assert.equal(fmt.producer, 'item_package'); ok('formato "Custo de morar" na ficha')

const P = (room, q, i) => ({ url: `https://x/${room}-${i}.jpg`, room, quality: q, score: q })
// Fotos fora de ordem e com 2 da cozinha: a visita segue a ordem da ficha e usa a melhor foto de cada cômodo.
const photos = [P('quarto', 80, 1), P('cozinha', 60, 2), P('cozinha', 90, 3), P('sala', 85, 4), P('varanda', 95, 5), P('banheiro', 70, 6), P('desconhecido', 99, 7)]
const fields = { tipo: 'Apartamento', bairro: 'Leblon', preco: 2500000, quartos: 3, m2: 120, vagas: 1, condominio: 2400, iptu: 600, lazer: 'piscina, academia, salão de festas' }
const strength = { label: 'Varanda com vista para o mar', photo: photos[4] }

const v = visitPhotos(photos, strength.photo, cfg)
assert.deepEqual(v.map(x => x.line), ['A sala', 'A cozinha', 'O quarto', 'O banheiro']); ok('ambientes na ordem da visita, 1 linha por foto, sem a capa')
assert.equal(v[1].photo.url, 'https://x/cozinha-3.jpg'); ok('a melhor foto de cada cômodo')
assert.ok(!v.some(x => x.photo.url.includes('desconhecido'))); ok('cômodo sem título na ficha não ganha linha inventada')

const places = ['Praia · Leblon · 400 m em linha reta', 'Metrô · Antero de Quental · 300 m em linha reta']
const s = buildGuidedVisitSlides({ photos, fields, cta: 'Me chama no direct', cfg, strength, places })
assert.equal(s[0].kind, 'capa'); assert.equal(s[0].fields.title, 'Varanda com vista para o mar'); assert.equal(s[0].photo, strength.photo.url); ok('capa = foto e frase do ponto forte')
const coverText = JSON.stringify(s[0].fields)
assert.ok(!/R\$|2\.500\.000|2500000|Preço/.test(coverText)); ok('capa sem preço')
assert.deepEqual(s.filter(x => x.kind === 'foto').map(x => x.fields.text), ['A sala', 'A cozinha', 'O quarto', 'O banheiro']); ok('slides de foto com a linha do cômodo')
const lists = s.filter(x => x.fields.layout === 'lista')
assert.equal(lists[0].fields.title, 'Lá fora'); assert.ok(lists[0].fields.items.includes('em linha reta')); ok('lugares perto com distância')
const nums = lists.find(x => x.fields.title === 'Os números').fields.items
assert.ok(/Condomínio/.test(nums) && /IPTU/.test(nums) && /Preço/.test(nums)); ok('números com condomínio e IPTU')
const all = JSON.stringify(s)
assert.equal((all.match(/Preço:/g) ?? []).length, 1); assert.equal((all.match(/Quartos:/g) ?? []).length, 1); ok('cada número aparece uma vez só')
const last = s.at(-1)
assert.equal(last.kind, 'fecho'); assert.equal(last.fields.title, 'Quer ver de perto?'); assert.equal(last.fields.cta, 'Me chama no direct'); ok('fecho com convite concreto e CTA')
assert.ok(s.length <= GUIDED_MAX_SLIDES); ok('cabe no limite do Instagram')

const one = buildGuidedVisitSlides({ photos, fields, cta: 'x', cfg, strength, places: [places[0]] })
assert.ok(!one.some(x => x.fields.title === 'Lá fora')); ok('1 lugar só = sem slide "Lá fora"')
const noStr = buildGuidedVisitSlides({ photos, fields, cta: 'x', cfg })
assert.equal(noStr[0].fields.title, 'Apartamento Leblon'); assert.ok(!/R\$/.test(JSON.stringify(noStr[0]))); ok('sem ponto forte marcado: tipo + bairro, ainda sem preço')
assert.deepEqual(buildGuidedVisitSlides({ photos: [], fields, cta: 'x', cfg }), []); ok('sem foto = vazio (cai no carrossel antigo)')

// B. Custo de morar
const c = costLines(fields, cfg)
assert.ok(c.condo.startsWith('Condomínio: ') && c.iptu.startsWith('IPTU: ')); ok('linhas de custo do cadastro')
const cost = buildLivingCostSlides({ photos, fields, cta: 'Me chama no direct', cfg, strength, everyday: fields.lazer })
assert.equal(cost[0].fields.cover_style, 'pergunta'); assert.equal(cost[0].fields.title, 'Quanto custa por mês morar aqui?'); ok('custo: capa em pergunta')
assert.ok(/Condomínio/.test(cost[1].fields.items) && /IPTU/.test(cost[1].fields.items)); ok('custo: condomínio e IPTU')
assert.ok(!/total|soma/i.test(JSON.stringify(cost))); ok('custo: nenhuma soma estimada')
assert.ok(cost.some(x => x.fields.title === 'O que o condomínio tem' && /piscina/.test(x.fields.items))); ok('custo: dia a dia só com o lazer do cadastro')
assert.deepEqual(buildLivingCostSlides({ photos, fields: { ...fields, iptu: null }, cta: 'x', cfg }), []); ok('custo: sem IPTU não sai')
assert.deepEqual(buildLivingCostSlides({ photos, fields: { ...fields, condominio: '' }, cta: 'x', cfg }), []); ok('custo: sem condomínio não sai')

// Capa do educativo pela arquitetura (creative-generate): o código escolhe "pergunta" para formato educativo da ficha.
const cg = readFileSync(new URL('../supabase/functions/creative-generate/index.ts', import.meta.url), 'utf8')
assert.ok(/educationalFormats\.includes\(opts\.slotFormat\) \? 'pergunta'/.test(cg)); ok('capa do educativo pela arquitetura, não pelo rodízio')

console.log(`\n${n} testes ok`)
