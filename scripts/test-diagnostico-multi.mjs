import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import fs from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-diagnostico-multi.mjs
// Diagnóstico com mais de uma resposta (2026-11-06): limite de verdade, resposta antiga preservada, "E depois disso?" sem repetir a principal.
// supabase/idioma são trocados por módulos vazios (só a lógica pura de src/lib/onboardingV2.ts é testada).
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === './supabase' || spec.endsWith('/supabase')) return { url: 'data:text/javascript,export const supabase = {}', shortCircuit: true }
    if (spec.endsWith('LanguageContext')) return { url: 'data:text/javascript,export const getCurrentLang = () => "pt"', shortCircuit: true }
    if (spec.startsWith('./') && !/\.[a-z]+$/.test(spec)) return next(spec + '.ts', ctx)
    return next(spec, ctx)
  },
})
const { sanitizeV2, answerList, excludedOptions, answerText, isResolved } = await import('../src/lib/onboardingV2.ts')
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

const PRIOS = ['Atrair mais compradores qualificados', 'Gerar mais conversas e pedidos de informação', 'Aumentar visitas aos imóveis', 'Captar novos imóveis para a carteira', 'Fortalecer a marca']
const opt = (xs) => xs.map(pt => ({ pt }))
const faixa = { key: 'faixa_preco', step: 'mercado', type: 'multi_select', max: 3, label: { pt: 'Faixa' }, options: opt(['Até R$500 mil', 'R$500 mil–R$1,5 mi', 'Acima de R$1,5 mi']), allow: ['unknown', 'later'] }
const aluguel = { key: 'faixa_aluguel', step: 'mercado', type: 'multi_select', max: 3, label: { pt: 'Aluguel' }, options: opt(['Até R$ 2 mil', 'R$ 2 mil a R$ 5 mil', 'R$ 5 mil a R$ 10 mil', 'Acima de R$ 10 mil']) }
const principal = { key: 'prioridade_principal', step: 'prioridade', type: 'select', label: { pt: 'Primeiro' }, options: opt(PRIOS), allow: ['unknown'] }
const depois = { key: 'prioridades_secundarias', step: 'prioridade', type: 'multi_select', max: 3, exclude_from: 'prioridade_principal', label: { pt: 'Depois' }, options: opt(PRIOS), allow: ['na', 'later'] }
const v2 = { steps: [], questions: [faixa, aluguel, principal, depois] }

// 1) várias respostas + limite de verdade
let r = sanitizeV2(v2, { faixa_preco: ['Até R$500 mil', 'Acima de R$1,5 mi'] }, {})
assert.deepEqual(r.answers.faixa_preco, ['Até R$500 mil', 'Acima de R$1,5 mi']); ok('faixa de preço aceita 2 respostas')
r = sanitizeV2(v2, { faixa_aluguel: ['Até R$ 2 mil', 'R$ 2 mil a R$ 5 mil', 'R$ 5 mil a R$ 10 mil', 'Acima de R$ 10 mil'] }, {})
assert.equal(r.answers.faixa_aluguel.length, 3); ok('limite de 3 é cortado na gravação (4 marcadas -> ficam 3)')
r = sanitizeV2(v2, { faixa_preco: ['Até R$500 mil', 'inventada', 'Até R$500 mil'] }, {})
assert.deepEqual(r.answers.faixa_preco, ['Até R$500 mil']); ok('opção fora da ficha e repetida saem')
r = sanitizeV2(v2, { faixa_preco: [] }, { faixa_preco: 'unknown' })
assert.equal(r.answers.faixa_preco, undefined); assert.equal(r.status.faixa_preco, 'unknown'); ok('desmarcar tudo + "Não sei" continua valendo')

// 2) resposta antiga (texto, de quando era escolha única) NÃO é apagada nem convertida
r = sanitizeV2(v2, { faixa_preco: 'R$500 mil–R$1,5 mi' }, {})
assert.equal(r.answers.faixa_preco, 'R$500 mil–R$1,5 mi'); ok('resposta antiga em texto fica exatamente como estava')
assert.deepEqual(answerList('R$500 mil–R$1,5 mi'), ['R$500 mil–R$1,5 mi']); assert.deepEqual(answerList(['a', 'b']), ['a', 'b']); assert.deepEqual(answerList(''), []); ok('na tela a resposta antiga aparece marcada (lida como 1 item)')
assert.ok(isResolved(faixa, { faixa_preco: 'R$500 mil–R$1,5 mi' }, {})); ok('resposta antiga conta como respondida (não volta a cobrar)')
assert.equal(answerText(['Até R$500 mil', 'Acima de R$1,5 mi']), 'Até R$500 mil, Acima de R$1,5 mi'); ok('resumo pros agentes junta as respostas com vírgula')

// 3) "E depois disso?" não repete a principal
const a = { prioridade_principal: PRIOS[0], prioridades_secundarias: [PRIOS[0], PRIOS[1], PRIOS[2]] }
assert.deepEqual(excludedOptions(depois, a), [PRIOS[0]]); assert.deepEqual(excludedOptions(faixa, a), []); ok('opção escolhida como principal some do "E depois disso?"')
r = sanitizeV2(v2, a, {})
assert.equal(r.answers.prioridade_principal, PRIOS[0]); assert.deepEqual(r.answers.prioridades_secundarias, [PRIOS[1], PRIOS[2]]); ok('trocar a principal para uma que estava em "depois" tira ela de "depois" ao salvar')
r = sanitizeV2(v2, { prioridade_principal: PRIOS[4], prioridades_secundarias: [PRIOS[0], PRIOS[1], PRIOS[2]] }, {})
assert.deepEqual(r.answers.prioridades_secundarias, [PRIOS[0], PRIOS[1], PRIOS[2]]); ok('sem conflito, as 3 de "depois" ficam')
assert.ok(isResolved(depois, {}, { prioridades_secundarias: 'later' })); assert.ok(!isResolved(depois, {}, {})); ok('"E depois disso?" aceita "Preencher depois" (não trava o diagnóstico) mas não fica em branco')

// 4) ficha da migration
const sql = fs.readFileSync(new URL('../supabase/migrations/20261106130000_diagnostico_multipla.sql', import.meta.url), 'utf8')
const active = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
assert.match(active, /'faixa_preco' then q \|\| '\{"type":"multi_select","max":3,/); assert.match(active, /'faixa_aluguel' then q \|\| '\{"type":"multi_select","max":3,/)
assert.match(active, /"diagnostic":true,"exclude_from":"prioridade_principal"/); assert.match(active, /where v\.key = 'imoveis_rio'/)
assert.ok(!/perfil|gasto_aquisicao/.test(active)); assert.match(sql, /-- ROLLBACK/); ok('migration: só as 3 perguntas, só imoveis_rio, papel e gasto intocados, rollback comentado')

console.log(`\n${n} verificações ok`)
