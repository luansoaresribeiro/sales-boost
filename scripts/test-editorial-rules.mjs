import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-editorial-rules.mjs
// C7 (auditoria do conteúdo, etapa 1 — dono 23/11): casos reais da AUDITORIA-CONTEUDO.
import { allowedTemplates, chooseCta, editorialRulesFrom, educationalOverflow, pickUnregulatedAlternative, stripExperiential, swapCtaText } from '../supabase/functions/_shared/editorialRules.ts'
import { findRepeat, parseThemeCfg, pickAlternative } from '../supabase/functions/_shared/themeDedupe.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

// A ficha como a migration deixa (lida do próprio arquivo, para o teste não divergir dela).
const sql = readFileSync(new URL('../supabase/migrations/20261124090000_c7_regras_editoriais.sql', import.meta.url), 'utf8')
const blocks = [...sql.matchAll(/\$json\$([\s\S]*?)\$json\$/g)].map(m => JSON.parse(m[1]))
const rio = { content_rules: blocks[0], ctas: { sem_automacao: 'Me chama no direct', ...blocks[1] } }
const R = editorialRulesFrom(rio)
assert.equal(R.educationalMaxPerWeek, 2); assert.equal(R.ctaMaxPerWeek, 3); assert.ok(R.ctaByObjective.visita.length >= 2); ok('ficha do Rio lida da migration')
assert.equal(editorialRulesFrom(null).educationalMaxPerWeek, null); assert.equal(editorialRulesFrom({}).ctaMaxPerWeek, null); ok('sem ficha = regras desligadas')

// (e) cards trend/problem fora do setor
const tpl = allowedTemplates({ tweet: 1, slide: 1, trend: 1, problem: 1, faq: 1 }, R)
assert.deepEqual(Object.keys(tpl).sort(), ['faq', 'slide', 'tweet']); ok('(e) cards "trend" e "problem" fora de imóveis')
assert.deepEqual(Object.keys(allowedTemplates({ trend: 1 }, R)), ['trend']); ok('(e) nunca deixa a lista de modelos vazia')

// (b) teto de 2 educativos na semana (Teste Zero 23–29/11: 5 educativos em 7)
const week = ['carrossel_educativo', 'dica_faq', '', 'carrossel_educativo', 'carrossel_educativo', '', 'dica_faq']
assert.deepEqual(educationalOverflow(week, R), [3, 4, 6]); ok('(b) a partir do 3º educativo, as vagas viram outra coisa')
assert.deepEqual(educationalOverflow(['carrossel_educativo', ''], R), []); ok('(b) até 2 educativos, nada muda')

// (b) trava de ASSUNTO na janela de semanas (custos 23, 24 e 28/11; ITBI em semanas seguidas)
const tcfg = parseThemeCfg({ theme_cooldown_weeks: 4, theme_topic_window: true, theme_topics: [{ key: 'ITBI', terms: ['itbi', 'imposto de transmissão'] }, { key: 'custos da compra', terms: ['custos', 'taxas', 'escritura', 'cartório'] }] })
const rep = findRepeat('Quanto é o ITBI no Rio e quem paga?', ['ITBI e as taxas da compra explicadas'], [], tcfg)
assert.ok(rep && /mesmo assunto nas últimas 4 semanas/.test(rep.reason)); ok('(b) ITBI × ITBI em semanas diferentes: bloqueia pelo assunto')
assert.equal(findRepeat('Quanto é o ITBI no Rio e quem paga?', ['ITBI e as taxas da compra explicadas'], [], parseThemeCfg({ theme_topics: tcfg.topics })), null); ok('(b) sem theme_topic_window na ficha: regra de antes')
assert.equal(findRepeat('O que conferir na visita ao imóvel', ['Custos invisíveis além do preço'], [], tcfg), null); ok('(b) assunto diferente passa')
assert.equal(pickAlternative(['Como funciona a escritura e o cartório', 'O que conferir na visita ao imóvel'], ['Custos de compra além do preço'], tcfg), 'O que conferir na visita ao imóvel'); ok('(b) alternativa também respeita a trava de assunto')

// (a) sem dica liberada → outro assunto, nunca o texto fixo
const alts = ['Como funciona o financiamento imobiliário, passo a passo', 'ITBI e escritura: o que são', 'O que conferir na visita ao imóvel antes de decidir']
const isReg = t => /financiamento|itbi|escritura/i.test(t)
assert.equal(pickUnregulatedAlternative(alts, isReg, () => false), 'O que conferir na visita ao imóvel antes de decidir'); ok('(a) sem dica: troca para tema não regulado')
assert.equal(pickUnregulatedAlternative(alts.slice(0, 2), isReg, () => false), null); ok('(a) só regulados: a vaga não sai (nada de texto fixo)')
const gen = readFileSync(new URL('../supabase/functions/creative-generate/index.ts', import.meta.url), 'utf8')
assert.ok(/topic\?\.mode === 'geral'/.test(gen) && /NoReleasedTipError/.test(gen)); ok('(a) gerador troca de assunto antes de escrever e registra a vaga sem dica')

// (c) CTA pelo objetivo, o mesmo no máximo 3x na semana (~60% "Me chama no direct" na auditoria)
const wk = ['Me chama no direct', 'me chama no Direct!', 'Me chama no direct', 'Comente VISITA']
let c = chooseCta({ current: 'Me chama no direct', objective: 'decisao', weekCtas: wk, rules: R })
assert.equal(c.changed, true); assert.equal(c.cta, 'Comente a sua dúvida'); assert.match(c.reason, /3× nesta semana/); ok('(c) 4º "Me chama no direct" vira o próximo CTA do objetivo')
assert.equal(chooseCta({ current: 'Me chama no direct', objective: 'decisao', weekCtas: wk.slice(0, 2), rules: R }).changed, false); ok('(c) dentro do teto, mantém')
assert.equal(chooseCta({ current: 'Comente VISITA', objective: 'visita', weekCtas: ['Comente VISITA', 'Comente VISITA', 'Comente VISITA'], rules: R, locked: true }).changed, false); ok('(c) QUERO/VISITA com resposta aprovada não troca')
assert.equal(swapCtaText('Linda vista. Me chama no direct!', 'Me chama no direct', 'Salve para a visita'), 'Linda vista. Salve para a visita!'); ok('(c) a legenda leva o CTA novo')

// (d) honestidade ampliada (slide real de 22/11)
const s = stripExperiential('Na minha experiência, quem vem de fora fecha com muito mais tranquilidade. Confira a documentação antes.', R)
assert.equal(s.text, 'Confira a documentação antes.'); assert.equal(s.removed.length, 1); ok('(d) "Na minha experiência…" sai do texto')
assert.equal(stripExperiential('Quem vem de fora costuma pedir a planta.', R).removed.length, 0); ok('(d) frase geral continua')

const cat = readFileSync(new URL('../supabase/functions/catalog-package/index.ts', import.meta.url), 'utf8')
assert.ok(/chooseCta\(/.test(cat) && /stripExperiential\(/.test(cat)); ok('pacote do imóvel usa o teto de CTA e a honestidade ampliada')
console.log(`\n${n} testes ok`)
