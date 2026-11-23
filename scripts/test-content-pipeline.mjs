import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-content-pipeline.mjs
// Etapa B (23/11): dashboard honesto — gerado → aprovado → publicado → alcance → leads → visitas, com fonte e "não medido".
import { buildPipeline } from '../src/lib/contentPipeline.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }
const base = { generated: 12, archived: 2, approved: 5, published: 3, reach: 840, reachRows: 3, instagramConnected: true, leads: 4, visits: 1 }

const s = buildPipeline(base)
assert.deepEqual(s.map(x => x.key), ['generated', 'approved', 'published', 'reach', 'leads', 'visits'])
assert.ok(s.every(x => x.source && x.label)); ok('6 etapas na ordem, todas com fonte')
assert.equal(s[3].value, 840); assert.equal(s[3].state, 'medido'); assert.match(s[0].hint, /2 arquivados/)
ok('alcance medido quando o Instagram mandou; arquivados à parte')

const noIg = buildPipeline({ ...base, instagramConnected: false })
assert.equal(noIg[3].value, null); assert.equal(noIg[3].state, 'nao_medido'); assert.match(noIg[3].hint, /não conectado/)
ok('sem Instagram: alcance "não medido", nunca 0')
const noIns = buildPipeline({ ...base, reach: 0, reachRows: 0 })
assert.equal(noIns[3].state, 'nao_medido'); assert.match(noIns[3].hint, /ainda não mandou/)
assert.equal(buildPipeline({ ...base, published: 0, reach: 0, reachRows: 0 })[3].state, 'nao_medido')
assert.match(buildPipeline({ ...base, reachRows: 2 })[3].hint, /2 de 3/)
ok('publicado sem coleta = não medido; coleta parcial avisada')

const nulls = buildPipeline({ generated: null, archived: null, approved: null, published: null, reach: null, reachRows: null, instagramConnected: true, leads: null, visits: null })
assert.ok(nulls.every(x => x.value === null && x.state !== 'medido')); ok('consulta que falhou = sem dado, nunca 0')
assert.equal(buildPipeline({ ...base, approved: 0 })[1].value, 0); ok('zero real continua zero')
assert.equal(buildPipeline(base, 'en')[3].label, 'Reach'); ok('inglês')

const hook = readFileSync(new URL('../src/pages/dashboard/marketingAi/useContentPipeline.ts', import.meta.url), 'utf8')
assert.match(hook, /not\('approved_by', 'is', null\)/); assert.match(hook, /\['archived', 'rejected'\]\.includes/)
assert.doesNotMatch(hook, /channel\(|useRealtime/); ok('aprovado = uma pessoa aprovou e a peça não foi arquivada; sem canal em tempo real')
const hub = readFileSync(new URL('../src/pages/dashboard/MarketingAiHubPage.tsx', import.meta.url), 'utf8')
assert.match(hub, /\{!demoMode && <ContentPipeline/); ok('fora do modo demonstração')
console.log(`\n${n} ok`)
