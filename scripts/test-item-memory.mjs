import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-item-memory.mjs
// Etapa C (23/11): memória por imóvel — ângulo com dado real, nunca o mesmo da peça anterior; público só no tom.
import { itemAnglesCfgFrom, enabledAngles, pickAngle, angleLine, audienceOf, angleOfBrief } from '../supabase/functions/_shared/itemMemory.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

const mig = readFileSync(new URL('../supabase/migrations/20261123130000_memoria_imovel_angulos.sql', import.meta.url), 'utf8')
const [angles, recipes] = [...mig.matchAll(/\$json\$([\s\S]*?)\$json\$/g)].map(m => JSON.parse(m[1]))
const cfg = itemAnglesCfgFrom({ content_rules: { item_angles: angles, item_angle_recipes: recipes, item_angle_lookback: 4, item_audience_field: 'pontos_para_quem' } })
assert.equal(cfg.angles.length, 6); assert.equal(cfg.recipes.post_3_coisas_perto, 'localizacao'); ok('ficha: 6 ângulos e 3 receitas de ângulo fixo')
const approved = JSON.parse(readFileSync(new URL('../supabase/migrations/20261122130000_pontos_fortes_marcas.sql', import.meta.url), 'utf8').match(/\$json\$(\[[\s\S]*?\])\$json\$/)[1]).flatMap(f => (f.options ?? []).map(o => o.pt))
assert.ok(cfg.angles.every(a => a.marks.every(m => approved.includes(m)))); ok('só marcas aprovadas habilitam ângulo')

// Apartamento Leblon da Teste Zero: vista + varanda marcadas, metragem e quartos preenchidos.
const fields = { m2: 120, quartos: 3, vista: 'parcial para o mar', pontos_imovel: ['Varanda'], pontos_para_quem: ['Morar'] }
const marks = ['Varanda']
assert.deepEqual(enabledAngles(cfg, fields, marks).map(a => a.key), ['vista', 'rotina', 'espaco']); ok('só ângulos com dado real (sem detalhe nem investimento)')

const a1 = pickAngle(cfg, 'carrossel_tour', fields, marks, [])
const a2 = pickAngle(cfg, 'carrossel_tour', fields, marks, [a1.angle.key])
assert.notEqual(a1.angle.key, a2.angle.key); assert.match(a2.why, /peça anterior/); ok(`2 peças seguidas do mesmo imóvel: ângulos diferentes (${a1.angle.key} → ${a2.angle.key})`)
const a3 = pickAngle(cfg, 'carrossel_tour', fields, marks, ['rotina', 'vista'])
assert.equal(a3.angle.key, 'espaco'); ok('rodízio: o menos usado nas últimas peças')
assert.equal(pickAngle(cfg, 'post_3_coisas_perto', fields, marks, ['localizacao']).angle.key, 'localizacao'); ok('receita com ângulo fixo usa o dela')
assert.equal(pickAngle(cfg, 'carrossel_tour', { m2: 50 }, [], ['espaco']).angle.key, 'espaco'); ok('só um ângulo possível: repete em vez de inventar')
assert.equal(pickAngle(cfg, 'carrossel_tour', {}, [], []).source, 'sem_angulo'); assert.equal(pickAngle(null, 'x', fields, marks, []).angle, null); ok('sem dado ou sem ficha: comportamento de hoje')

const aud = audienceOf(cfg, fields)
assert.deepEqual(aud, ['Morar']); const line = angleLine(a1.angle, aud)
assert.match(line, /não rotule o público/); assert.match(line, /Use só fatos do cadastro/); ok('público entra só como tom, com a proibição de rotular')
assert.equal(angleOfBrief({ memory: { angle: 'vista' } }), 'vista'); assert.equal(angleOfBrief(null), null); ok('lê o ângulo gravado; peça antiga = sem ângulo')
assert.ok(!cfg.angles.find(a => a.key === 'investimento').prompt.match(/\d/)); ok('investimento sem número de retorno')

const cp = readFileSync(new URL('../supabase/functions/catalog-package/index.ts', import.meta.url), 'utf8')
assert.match(cp, /writeCopy\(anthropicKey, briefing \+ angleTxt/); assert.match(cp, /brief: \{ memory:/); assert.match(cp, /angleHistory\.unshift/)
ok('pacote do imóvel: ângulo no mesmo pedido, gravado em brief.memory, histórico atualizado a cada peça')
console.log(`\n${n} ok`)
