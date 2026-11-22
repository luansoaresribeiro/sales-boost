import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-nearby-marks.mjs
// Pontos fortes, item 3 (22/11): a marca de localização do imóvel muda a ORDEM dos lugares perto; nunca inventa lugar.
import { topPlaces, priorityCategories, parseMarkCfg } from '../supabase/functions/_shared/nearbyPlaces.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

const keys = ['praia', 'metro', 'parque', 'escola', 'mercado', 'padaria', 'farmacia', 'academia', 'restaurante', 'saude', 'shopping', 'cultura']
const mig = readFileSync(new URL('../supabase/migrations/20261122140000_perto_pela_marca.sql', import.meta.url), 'utf8')
const markCats = JSON.parse(mig.match(/\$json\$(\{[\s\S]*?\})\$json\$/)[1])
const marks = JSON.parse(readFileSync(new URL('../supabase/migrations/20261122130000_pontos_fortes_marcas.sql', import.meta.url), 'utf8').match(/\$json\$(\[[\s\S]*?\])\$json\$/)[1])[0].options.map(o => o.pt)
assert.deepEqual(Object.keys(markCats).sort(), [...marks].sort()); ok('cada marca de localização aprovada tem categorias de lugar')
assert.ok(Object.values(markCats).flat().every(c => keys.includes(c))); ok('só categorias que já existem no mapa')

const cfg = { address_field: 'endereco', area_field: 'bairro', radius_m: 1500, max_per_category: 3, categories: keys.map(k => ({ key: k, label: k, emoji: '📍', osm: ['x=y'] })), ...parseMarkCfg({ mark_field: 'pontos_localizacao', mark_categories: { ...markCats, 'Marca fantasma': ['nao_existe'] } }, keys) }
assert.equal(cfg.mark_categories['Marca fantasma'], undefined); ok('categoria que não existe é ignorada')
const place = (cat, d) => ({ cat, name: `${cat} X`, distance_m: d, osm: 'n' })
const data = { source: 'openstreetmap', fetched_at: '', precision: 'endereco', query: '', places: [place('praia', 300), place('metro', 400), place('parque', 500), place('restaurante', 200), place('cultura', 600), place('escola', 250)] }

assert.deepEqual(topPlaces(data, cfg, 3).map(p => p.cat), ['praia', 'metro', 'parque']); ok('sem marca: ordem da ficha (como antes)')
const noite = priorityCategories(cfg, { pontos_localizacao: ['Vida noturna e restaurantes'] })
assert.deepEqual(noite, ['restaurante', 'cultura']); assert.deepEqual(topPlaces(data, cfg, 3, noite).map(p => p.cat), ['restaurante', 'cultura', 'praia']); ok('"Vida noturna e restaurantes": restaurante e cultura primeiro')
const duas = priorityCategories(cfg, { pontos_localizacao: ['Escolas perto', 'Rua tranquila / perto da natureza'] })
assert.deepEqual(duas, ['escola', 'parque', 'praia']); assert.deepEqual(topPlaces(data, cfg, 3, duas).map(p => p.cat), ['escola', 'parque', 'praia']); ok('duas marcas: na ordem das marcas, sem repetir')
const semLugar = priorityCategories(cfg, { pontos_localizacao: ['Tudo a pé (mercado, padaria, farmácia)'] })
assert.deepEqual(topPlaces(data, cfg, 3, semLugar).map(p => p.cat), ['praia', 'metro', 'parque']); ok('marca sem lugar perto no mapa: nada inventado, segue a ordem da ficha')
assert.deepEqual(priorityCategories(cfg, { pontos_localizacao: 'texto solto' }), []); assert.deepEqual(priorityCategories({ ...cfg, mark_field: undefined }, { pontos_localizacao: ['Perto do metrô'] }), []); ok('valor estranho ou ficha sem a regra: sem prioridade')
assert.deepEqual(parseMarkCfg({ mark_field: 'Bad Key!', mark_categories: markCats }, keys), {}); ok('chave de campo inválida na ficha: desligado')
const src = readFileSync(new URL('../supabase/functions/catalog-package/index.ts', import.meta.url), 'utf8')
assert.ok(/topPlaces\(data, cfg, 3, priorityCategories\(cfg, fields\)\)/.test(src)); ok('catalog-package usa a ordem das marcas')
console.log(`\n${n} ok`)
