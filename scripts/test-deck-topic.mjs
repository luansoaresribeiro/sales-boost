import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-deck-topic.mjs
// Carrossel educativo com fonte (decisão C). Teste das regras puras (deckTopic.ts), do guarda com IA falsa
// (deckGuard.ts) e dos pontos de ficha (faqCheck/formatCatalog). Os termos vêm da MIGRATION de verdade.
import {
  classifyByTerms, cutAtSentence, generalFallbackCaption, generalFallbackDeck, hasTerm, parseTopicAnswer, pickTips, resolveAlias, tipFallbackCaption, tipFallbackDeck, tipNumbers,
  tipSources, topicCfgOf, topicText, validateGeneral, validateLight, validateRegulated, withSource,
} from '../supabase/functions/_shared/deckTopic.ts'
import { decideTopic, guardDeck, topicBlock } from '../supabase/functions/_shared/deckGuard.ts'
import { deckPromptRules, rewritePrompt } from '../supabase/functions/_shared/deckSlides.ts'
import { fetchFaqConfig, isPublishable, isOfficiallyReleased, isUsableTip } from '../supabase/functions/_shared/faqCheck.ts'
import { fetchFormatAliases } from '../supabase/functions/_shared/formatCatalog.ts'

let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

// Ficha real = o JSON da migration.
const sql = readFileSync(new URL('../supabase/migrations/20261026120000_carrossel_educativo_unico.sql', import.meta.url), 'utf8')
const faqJson = JSON.parse(sql.split('$json$')[1])
const CATS = [['juridico', 'Jurídico'], ['financiamento', 'Financiamento'], ['documentacao', 'Documentação'], ['impostos', 'Impostos e taxas'], ['aluguel', 'Aluguel'], ['geral', 'Dica geral']].map(([key, label]) => ({ key, label }))
const rawFaq = { ...faqJson, categories: CATS, official_domains: ['gov.br', 'planalto.gov.br'], recheck_days: 60 }
const chain = (result) => { const c = { select: () => c, eq: () => c, update: () => c, maybeSingle: async () => ({ data: result }), then: (res, rej) => Promise.resolve({ data: result }).then(res, rej) }; return c }
const fichaAdmin = (config) => ({ from: () => chain({ config }) })
const cfg = await fetchFaqConfig(fichaAdmin({ faq: rawFaq }), 'imoveis_rio')
const tcfg = topicCfgOf(cfg)
assert.ok(cfg && tcfg); ok('ficha lida (regulated_categories, category_terms, regulated_terms)')
assert.deepEqual(tcfg.regulated_categories, ['juridico', 'financiamento', 'documentacao', 'impostos'])
const RT = tcfg.regulated_terms

// ── classificação ────────────────────────────────────────────────────────────────────────
assert.equal(classifyByTerms('Como funciona o ITBI e o IPTU na compra', tcfg).category, 'impostos')
assert.equal(classifyByTerms('Quais documentos e certidões pedir ao vendedor', tcfg).category, 'documentacao')
assert.equal(classifyByTerms('Financiamento: simulação, juros e entrada', tcfg).category, 'financiamento')
assert.equal(classifyByTerms('Como usar o FGTS no financiamento', tcfg).category, 'financiamento')
assert.equal(classifyByTerms('Dicas de decoração pra mudança', tcfg).category, 'geral')
assert.equal(classifyByTerms('Dicas de decoração pra mudança', tcfg).regulated, false)
assert.equal(classifyByTerms('Bairro charmoso com praia e padaria boa', tcfg).category, null)
ok('classificação por termos (nada acerta → null)')
assert.equal(classifyByTerms('contrato de locação e fiador', tcfg).category, 'aluguel') // aluguel 2 acertos > juridico 1
assert.equal(classifyByTerms('contrato de locação e fiador', tcfg).regulated, false)
// ficha com aluguel regulado (migration 20261026130000): o mesmo tema vira regulado
assert.equal(classifyByTerms('contrato de locação e fiador', { ...tcfg, regulated_categories: [...tcfg.regulated_categories, 'aluguel'] }).regulated, true)
// empate entre regulada e leve → regulada (lado seguro)
{ const r = classifyByTerms('decoração e financiamento', tcfg); assert.equal(r.category, 'financiamento'); assert.equal(r.regulated, true) }
ok('mais acertos vence; empate fica com a regulada')
assert.equal(classifyByTerms('CERTIDÃO NEGATIVA', tcfg).category, 'documentacao') // sem acento/maiúscula
assert.equal(classifyByTerms('certidao negativa', tcfg).category, 'documentacao')
assert.equal(hasTerm('sfh e sfi', 'SFH'), true); assert.equal(hasTerm('concerto', 'CET'), false)
ok('termo sem acento/maiúscula e só palavra inteira')
assert.equal(parseTopicAnswer('impostos', tcfg), 'impostos')
assert.equal(parseTopicAnswer(' "Documentação" ', tcfg), 'documentacao')
assert.equal(parseTopicAnswer('leve', tcfg), 'leve'); assert.equal(parseTopicAnswer('culinária', tcfg), 'leve'); assert.equal(parseTopicAnswer('', tcfg), 'leve')
ok('resposta da IA fora da lista = leve')

// ── dicas liberadas ──────────────────────────────────────────────────────────────────────
const NOW = Date.parse('2026-10-26T12:00:00Z'), FUT = '2026-12-01T00:00:00Z', PAST = '2026-09-01T00:00:00Z'
const mk = (id, title, content, category, check, used = 0) => ({ id, title, content, meta: { category, used_count: used, ...(check ? { check } : {}) } })
const chk = (status, next = FUT, url = 'https://www.gov.br/receitafederal/pt-br') => ({ status, has_facts: status !== 'geral', checked_at: '2026-10-01T00:00:00Z', next_check_at: status === 'geral' || status === 'aprovada_dono' ? null : next, ...(status === 'conferida' || status === 'corrigida' ? { source_url: url } : {}) })
const T1 = mk('t1', 'Quanto é o ITBI no Rio?', 'O ITBI no Rio de Janeiro é de 3% sobre o valor do imóvel. Ele é pago antes da escritura.', 'impostos', chk('conferida'), 2)
const T2 = mk('t2', 'Quem paga o IPTU atrasado?', 'A dívida de IPTU acompanha o imóvel; confira a certidão antes de fechar.', 'impostos', chk('corrigida'), 0)
const T3 = mk('t3', 'Dica sobre custos', 'Some todos os custos antes de decidir.', 'impostos', chk('geral'), 1)
const T4 = mk('t4', 'Vencida', 'Texto 10 dias', 'impostos', chk('conferida', PAST))
const T5 = mk('t5', 'Revisar', 'Texto', 'impostos', chk('revisar'))
const T6 = mk('t6', 'Outra categoria', 'Texto', 'documentacao', chk('conferida'))
const T7 = mk('t7', 'Sem check', 'Texto', 'impostos', null)
const T8 = mk('t8', 'Dono', 'Texto aprovado pelo dono', 'impostos', chk('aprovada_dono'), 5)
assert.equal(isPublishable(T1.meta, NOW), true); assert.equal(isPublishable(T3.meta, NOW), true); assert.equal(isPublishable(T8.meta, NOW), true)
assert.equal(isPublishable(T4.meta, NOW), false); assert.equal(isPublishable(T5.meta, NOW), false); assert.equal(isPublishable(T7.meta, NOW), false)
ok('isPublishable: conferida/geral/dono sim; vencida, revisar e sem check não')
const picked = pickTips([T1, T2, T3, T4, T5, T6, T7, T8], 'impostos', ['gov.br'], NOW, 4)
assert.deepEqual(picked.map(t => t.id), ['t2', 't1']) // opção A: só conferida em fonte oficial (geral e dono saem), menos usadas primeiro
assert.deepEqual(pickTips([T1, T2, T3, T8], 'impostos', ['gov.br'], NOW, 1).map(t => t.id), ['t2'])
assert.deepEqual(pickTips([T6], 'impostos', ['gov.br'], NOW), [])
assert.deepEqual(pickTips([T1, T2], 'impostos', ['rj.gov.br'], NOW), []) // fonte fora de official_domains
assert.deepEqual(pickTips([mk('x', 'Q', 'A', 'impostos', { ...chk('conferida'), source_url: undefined })], 'impostos', ['gov.br'], NOW), []) // sem source_url
assert.deepEqual(pickTips([T4], 'impostos', ['gov.br'], NOW), []) // vencida
ok('pickTips (opção A): só conferida/corrigida com fonte oficial e no prazo; geral, dono, revisar e vencida não')
assert.equal(isOfficiallyReleased(T1.meta, ['gov.br'], NOW), true); assert.equal(isOfficiallyReleased(T3.meta, ['gov.br'], NOW), false); assert.equal(isOfficiallyReleased(T8.meta, ['gov.br'], NOW), false)
const cfgR = { official_domains: ['gov.br'], regulated_categories: ['impostos'] }
assert.equal(isUsableTip(T3.meta, cfgR, NOW), false)  // geral em categoria regulada: não
assert.equal(isUsableTip(T1.meta, cfgR, NOW), true)
assert.equal(isUsableTip(mk('g', 'Q', 'A', 'geral', chk('geral')).meta, cfgR, NOW), true)  // categoria leve: como sempre
assert.equal(isUsableTip(T3.meta, { official_domains: ['gov.br'] }, NOW), true) // ficha sem regulated_categories: fluxo antigo
ok('isUsableTip: regulada exige fonte oficial; leve e ficha sem regulated_categories seguem como antes')
assert.deepEqual(tipSources([T1, T2, T3], ['gov.br']), ['gov.br']) // geral não tem fonte; repetida some
assert.deepEqual(tipSources([T1], ['rj.gov.br']), []) // site fora da lista oficial
ok('fontes: só site oficial de dica conferida')

// ── regulado: número/termo da dica passa, de fora falha ─────────────────────────────────
const tips = [T1, T2]
assert.ok(tipNumbers(tips).has('3|%'))
assert.deepEqual(validateRegulated(['O ITBI no Rio é de 3% sobre o valor do imóvel'], tips, RT), [])
assert.deepEqual(validateRegulated(['Confira a certidão de IPTU antes de fechar'], tips, RT), [])
{ const v = validateRegulated(['A alíquota é 3,5%'], tips, RT); assert.ok(v.includes('número 3,5') && v.includes('aliquota')) }
assert.ok(validateRegulated(['O prazo é de 15 dias'], tips, RT).includes('número 15'))
assert.ok(validateRegulated(['Vale o FGTS na compra'], tips, RT).includes('FGTS'))
assert.ok(validateRegulated(['A Lei do Inquilinato manda'], tips, RT).length > 0)
assert.ok(validateRegulated(['Pague em trinta dias'], tips, RT).length > 0)
assert.ok(validateRegulated(['Serão dois por cento'], tips, RT).length > 0)
assert.deepEqual(validateRegulated(['Conselho geral: visite em horários diferentes'], tips, RT), [])
// termo da dica em maiúscula/sem acento
assert.deepEqual(validateRegulated(['o itbi é pago antes da escritura'], tips, RT), [])
ok('regulado: número e termo da dica passam; de fora falham (incl. por extenso, FGTS, lei)')
// por extenso que a dica também diz → passa
assert.deepEqual(validateRegulated(['Dívida de trinta dias fica com o imóvel'], [mk('x', 'q', 'A dívida de trinta dias fica com o imóvel.', 'impostos', chk('conferida'))], RT), [])
ok('regulado: por extenso presente na dica passa')

// ── geral ────────────────────────────────────────────────────────────────────────────────
for (const bad of ['15', 'Em 15 dias', '3%', 'R$ 500', 'Custa R$500', 'Lei 8.245', 'A Lei do Inquilinato', 'a lei do inquilinato manda', 'Lei Geral do Turismo', 'ITBI', 'IPTU atrasado', 'trinta dias', 'vinte e cinco dias', 'dois por cento', 'uns cinco mil reais', 'cem reais', 'seis meses', 'dois anos', 'a alíquota', 'a aliquota', 'ALIQUOTA', 'conforme o art. 5', 'segundo o artigo da lei', 'use o FGTS', 'em três semanas']) {
  assert.ok(validateGeneral([bad], RT).length > 0, 'ESCAPOU no geral: ' + bad)
}
ok('geral barra 15, 3%, R$, lei, ITBI, por extenso + unidade, alíquota (com/sem acento), art./artigo, FGTS')
for (const good of ['Visite em horários diferentes', 'três erros comuns', 'Dois pontos importantes', 'Peça tudo por escrito', 'Compare com calma antes de decidir', 'Um dia você terá a chave', 'A lei exige cuidado', 'Fale com a gente']) {
  assert.deepEqual(validateGeneral([good], RT), [], 'FALSO POSITIVO no geral: ' + good)
}
ok('geral deixa passar conselho sem fato ("três erros comuns")')


// ── pós-QA 1: o tema vem do assunto, nunca do NOME do formato nem de rótulo do catálogo ──────────
{
  const FORMAT_NAME = 'Carrossel educativo (dicas conferidas; tema leve livre)' // nome real do formato na migration
  assert.ok(sql.includes(FORMAT_NAME))
  assert.ok(!faqJson.category_terms.geral.some(t => ['dica', 'dicas'].includes(t.toLowerCase()))) // genérico demais
  const cls = (angle, hookAngle = '', offer = '') => classifyByTerms(topicText({ title: FORMAT_NAME, titleIsFormat: true, angle, hookAngle, offer }), tcfg)
  for (const [angle, cat] of [['Pilar educacao: explicar o ITBI', 'impostos'], ['Pilar educacao: como usar o FGTS', 'financiamento'], ['Pilar educacao: pedir a matrícula atualizada', 'documentacao']]) {
    const r = cls(angle); assert.equal(r.category, cat, angle); assert.equal(r.regulated, true, angle)
  }
  // o nome do formato sozinho não decide nada
  assert.equal(cls('Pilar educacao: serve a estratégia ativa').category, null)
  // ... e, mesmo se alguém passar o título por engano como texto, "dicas" não vira tema geral
  assert.notEqual(classifyByTerms(`${FORMAT_NAME} ITBI`, tcfg).category, 'geral')
  assert.equal(classifyByTerms(FORMAT_NAME, tcfg).category, null)
  // ideia do dono: o título é assunto de verdade
  assert.equal(classifyByTerms(topicText({ title: 'Como funciona o ITBI', angle: 'x' }), tcfg).category, 'impostos')
  assert.equal(classifyByTerms('Dicas de decoração pra mudança', tcfg).category, 'geral')
}
ok('tema: nome do formato fora da classificação; ITBI/FGTS/matrícula = regulado; "dica(s)" não é termo de geral')

// ── pós-QA 3: números por valor + unidade ────────────────────────────────────────────────
{
  const dica = [mk('n', 'Quanto custa?', 'A taxa é de 3% e vale por 30 dias. A entrada mínima é R$ 1.500,00.', 'impostos', chk('conferida'))]
  const v = (t) => validateRegulated([t], dica, RT)
  for (const good of ['Taxa de 3%', 'Taxa de 3,0%', 'Taxa de 3 por cento', 'Vale por 30 dias', 'Entrada de R$ 1500', 'Entrada de R$1.500', 'Entrada de R$ 1500,00', 'Entrada de 1.500 reais']) assert.deepEqual(v(good), [], 'deveria passar: ' + good)
  for (const bad of ['Taxa de 30%', 'Taxa de 3,5%', 'Vale por 3 dias', 'Vale por 30 meses', 'Entrada de R$ 150.000', 'Entrada de R$ 150', 'Entrada de 1500', 'Entrada de R$ 15.000,00', 'Taxa de 30 por cento']) assert.ok(v(bad).length > 0, 'deveria barrar: ' + bad)
  // colisões de dígitos que antes passavam
  const d2 = [mk('m', 'q', 'Taxa de 3% em 30 dias.', 'impostos', chk('conferida'))]
  assert.ok(validateRegulated(['Taxa de 30%'], d2, RT).length > 0); assert.ok(validateRegulated(['Taxa de 3,0 dias'], d2, RT).length > 0); assert.ok(validateRegulated(['Prazo de 3 dias'], d2, RT).length > 0)
  assert.ok(validateRegulated(['Entrada de R$ 150.000'], [mk('k', 'q', 'Entrada de R$ 1.500,00', 'impostos', chk('conferida'))], RT).length > 0)
  assert.deepEqual(validateRegulated(['Entrada de R$ 150 mil'], [mk('k', 'q', 'Entrada de R$ 150.000', 'impostos', chk('conferida'))], RT), [])
  assert.deepEqual(validateRegulated(['Prazo de 12 meses'], [mk('k', 'q', 'Prazo de 12 meses', 'impostos', chk('conferida'))], RT), [])
  assert.ok(validateRegulated(['Prazo de 12 anos'], [mk('k', 'q', 'Prazo de 12 meses', 'impostos', chk('conferida'))], RT).length > 0)
  assert.ok(tipNumbers(dica).has('3|%') && tipNumbers(dica).has('1500|R$') && tipNumbers(dica).has('30|dia'))
}
ok('regulado compara valor BR + unidade: 1500 = 1.500,00; 3,0% = 3%; 30% ≠ 3%; 150.000 ≠ 1.500')

// ── pós-QA 4: modo geral, falsos negativos ───────────────────────────────────────────────
for (const bad of ['Pague metade do valor', 'o dobro da entrada', 'Dê um terço do preço', 'dois terços da renda', 'o triplo do valor', 'três quartos do valor', 'Metade da entrada', 'dois porcento', 'dois por cento', 'veja a Lei Federal', 'lei estadual', 'Lei Municipal', 'Pague o I.T.B.I.', 'saque o F.G.T.S.', 'o I P T U atrasado', 'ITBI', 'i. t. b. i.', 'F G T S', 'a S.F.H.']) {
  assert.ok(validateGeneral([bad], RT).length > 0, 'ESCAPOU no geral: ' + bad)
}
for (const good of ['Peça a matrícula atualizada', 'três erros comuns', 'Peça a segunda via', 'O primeiro passo é visitar', 'Peça a certidão e a matrícula', 'Ele é a Pessoa e o Fiador', 'Compare o valor com calma', 'Metade da graça é visitar de dia']) {
  assert.deepEqual(validateGeneral([good], RT), [], 'FALSO POSITIVO no geral: ' + good)
}
assert.ok(validateLight(['pague o I.T.B.I. antes'], RT).includes('ITBI'))
assert.ok(validateRegulated(['paga-se o I.T.B.I.'], [mk('z', 'q', 'Sem imposto citado.', 'impostos', chk('conferida'))], RT).includes('ITBI'))
assert.deepEqual(validateRegulated(['Paga-se o I.T.B.I.'], tips, RT), []) // a dica fala ITBI
ok('geral barra fração de valor, porcento, siglas pontuadas/espaçadas, lei federal/estadual/municipal; não quebra "matrícula", "segunda via"')

// ── leve: rede de segurança ─────────────────────────────────────────────────────────────
assert.deepEqual(validateLight(['Como usar o FGTS na compra do primeiro imóvel'], RT), ['FGTS'])
assert.deepEqual(validateLight(['Bairro lindo, praia e padaria'], RT), [])
assert.ok(validateLight(['a aliquota sobe'], RT).includes('alíquota'))
ok('leve: FGTS detectado; sem termo regulado nada')

// ── fallbacks ────────────────────────────────────────────────────────────────────────────
assert.equal(cutAtSentence('Primeira frase curta. Segunda frase também. ' + 'x'.repeat(200), 60), 'Primeira frase curta. Segunda frase também.')
assert.equal(cutAtSentence('Curta.', 150), 'Curta.')
assert.ok(cutAtSentence('palavra '.repeat(80), 100, 120).endsWith('.') && cutAtSentence('palavra '.repeat(80), 100, 120).length <= 125)
const fbd = tipFallbackDeck(tips, 'Impostos e taxas', ['gov.br'], 'Me chama no direct')
assert.deepEqual(fbd.map(s => s.layout), ['capa', 'destaque', 'destaque', 'fecho'])
assert.ok(fbd[1].text.startsWith('O ITBI no Rio de Janeiro é de 3%')) // resposta da dica, cortada em fim de frase
assert.ok(fbd[3].text.includes('Fonte: gov.br') && fbd[3].cta === 'Me chama no direct')
for (const s of fbd) assert.deepEqual(validateRegulated([[s.title, s.text, s.items].join('\n')], tips, RT), [], 'fallback regulado tem que passar no próprio validador')
assert.deepEqual(validateRegulated([tipFallbackCaption(tips, ['gov.br'])], tips, RT), [])
ok('fallback regulado: texto da dica cortado em fim de frase + Fonte, passa no validador')
const gfd = generalFallbackDeck('Impostos e taxas', 'Me chama no direct')
for (const s of gfd) assert.deepEqual(validateGeneral([[s.title, s.text].join('\n')], RT), [], 'fallback geral: ' + JSON.stringify(s))
assert.deepEqual(validateGeneral([generalFallbackCaption('Impostos e taxas')], RT), [])
assert.deepEqual(validateGeneral(generalFallbackDeck('', 'x', 'en').map(s => s.title + ' ' + s.text), RT), [])
ok('fallback geral: texto fixo sem fato')
assert.ok(withSource([{ layout: 'fecho', title: 'a', text: 'Fale com a gente.', items: '', highlight: '', cta: 'x' }], ['gov.br'])[0].text.includes('Fonte: gov.br'))
assert.equal(withSource([{ layout: 'fecho', title: 'a', text: 'Fonte: gov.br', items: '', highlight: '', cta: 'x' }], ['gov.br'])[0].text, 'Fonte: gov.br')
ok('Fonte no fecho (sem duplicar)')

// ── alias ───────────────────────────────────────────────────────────────────────────────
assert.equal(resolveAlias('carrossel_slides', { carrossel_slides: 'carrossel_educativo' }), 'carrossel_educativo')
assert.equal(resolveAlias('post_card', { carrossel_slides: 'carrossel_educativo' }), 'post_card')
assert.equal(resolveAlias('carrossel_slides', null), 'carrossel_slides'); assert.equal(resolveAlias('constructor', {}), 'constructor')
const fmts = [{ key: 'carrossel_educativo', name: 'x', status: 'live' }, { key: 'planejado', name: 'y', status: 'planned' }]
const aliasCfg = (aliases, off = []) => fichaAdmin({ content_formats: fmts, content_rules: { format_aliases: aliases, disabled_formats: off } })
assert.deepEqual(await fetchFormatAliases(aliasCfg({ carrossel_slides: 'carrossel_educativo' }), 'v'), { carrossel_slides: 'carrossel_educativo' })
assert.deepEqual(await fetchFormatAliases(aliasCfg({ carrossel_slides: 'planejado' }), 'v'), {}) // destino não está live
assert.deepEqual(await fetchFormatAliases(aliasCfg({ carrossel_slides: 'nao_existe' }), 'v'), {})
assert.deepEqual(await fetchFormatAliases(aliasCfg({ carrossel_slides: 'carrossel_educativo' }, ['carrossel_educativo']), 'v'), {}) // destino desligado
assert.deepEqual(await fetchFormatAliases(aliasCfg('lixo'), 'v'), {})
assert.deepEqual(await fetchFormatAliases({ from: () => { throw new Error('banco fora') } }, 'v'), {})
ok('alias: só vale com destino live na ficha; tolerante a lixo e erro')

// ── setor sem faq = antigo ──────────────────────────────────────────────────────────────
assert.equal(await fetchFaqConfig(fichaAdmin({}), 'padaria'), null)
assert.equal(await fetchFaqConfig(fichaAdmin({ faq: rawFaq }), 'generico'), null)
assert.equal(topicCfgOf(null), null)
{ // ficha antiga: tem faq mas ainda sem os campos novos → tolerante: sem categorias reguladas nem termos → guarda desligado
  const old = await fetchFaqConfig(fichaAdmin({ faq: { recheck_days: 60, categories: CATS, official_domains: ['gov.br'] } }), 'imoveis_rio')
  assert.ok(old); assert.deepEqual(old.regulated_categories, []); assert.equal(topicCfgOf(old), null)
}
ok('setor sem faq / ficha antiga sem campos novos = fluxo antigo (guarda desligado)')
assert.match(deckPromptRules('gancho', 'Me chama'), /NÚMEROS: só use número/); assert.match(deckPromptRules('gancho', 'Me chama'), /4 a 7 itens/)
assert.match(deckPromptRules('gancho', 'x', { mode: 'leve' }), /NÚMEROS: só use número/)
assert.match(deckPromptRules('gancho', 'x', { mode: 'regulado', tipCount: 2 }), /SÓ o que as DICAS CONFERIDAS[^]*sem acrescentar fato/)
assert.match(deckPromptRules('gancho', 'x', { mode: 'regulado', tipCount: 2 }), /4 itens \(capa \+ 2 slides/)
assert.match(deckPromptRules('gancho', 'x', { mode: 'geral' }), /sem número, prazo, taxa, valor, percentual nem nome de lei/)
assert.ok(!/extra/.test(rewritePrompt('M', { layout: 'destaque', title: '', text: 'a', items: '', highlight: '', cta: '' }, { tooLong: true, numbers: [] })))
assert.ok(rewritePrompt('M', { layout: 'destaque', title: '', text: 'a', items: '', highlight: '', cta: '' }, { tooLong: false, numbers: [], extra: ['sem fato'] }).includes('Motivo: sem fato'))
ok('prompt: modo regulado/geral/leve; rewritePrompt aceita motivo extra')

// ── decideTopic (IA e banco falsos) ─────────────────────────────────────────────────────
const kAdmin = (rows) => ({ from: () => chain(rows) })
let asked = 0
const askFn = (answer) => async () => { asked++; return answer }
const base = { cfg, tcfg, company: { id: 'c1', city: 'Rio' }, anthropicKey: 'k' }
{
  const d = await decideTopic({ ...base, admin: kAdmin([T1, T2, T3, T6]), text: 'Quanto custa o ITBI?', ask: askFn('leve') })
  assert.equal(d.mode, 'regulado'); assert.equal(d.category, 'impostos'); assert.equal(asked, 0); assert.deepEqual(d.tips.map(t => t.id).sort(), ['t1', 't2']) // t3 (geral) não vale no regulado
  assert.deepEqual(d.hosts, ['gov.br'])
  const g = await decideTopic({ ...base, admin: kAdmin([T6]), text: 'Quanto custa o ITBI?', ask: askFn('leve') })
  assert.equal(g.mode, 'geral'); assert.equal(g.category, 'impostos'); assert.deepEqual(g.tips, [])
  const soGeral = await decideTopic({ ...base, admin: kAdmin([T3, T8, T5]), text: 'Quanto custa o ITBI?', ask: askFn('leve') })
  assert.equal(soGeral.mode, 'geral'); assert.deepEqual(soGeral.tips, []) // só geral/dono/revisar: carrossel sai no modo geral
  const l = await decideTopic({ ...base, admin: kAdmin([T1]), text: 'Bairro charmoso', ask: askFn('leve') })
  assert.equal(l.mode, 'leve'); assert.equal(asked, 1)
  const viaIa = await decideTopic({ ...base, admin: kAdmin([T6]), text: 'Bairro charmoso', ask: askFn('documentacao') })
  assert.equal(viaIa.mode, 'regulado'); assert.equal(viaIa.category, 'documentacao')
  const lixo = await decideTopic({ ...base, admin: kAdmin([T6]), text: 'Bairro charmoso', ask: askFn('astrologia') })
  assert.equal(lixo.mode, 'leve')
  const quebra = await decideTopic({ ...base, admin: kAdmin([T6]), text: 'Bairro charmoso', ask: async () => { throw new Error('rede') } })
  assert.equal(quebra.mode, 'leve')
  const forced = await decideTopic({ ...base, admin: kAdmin([T1]), text: 'ITBI', forceGeneral: true, ask: askFn('x') })
  assert.equal(forced.mode, 'geral')
  assert.match(topicBlock(d), /ÚNICA fonte de fatos/); assert.match(topicBlock(g), /NENHUM número/); assert.equal(topicBlock(l), '')
}
ok('decideTopic: termos → IA barata (validada) → dicas; sem dica = geral; IA fora do ar = leve')

// ── guardDeck (IA falsa) ────────────────────────────────────────────────────────────────
const S = (layout, title, text, items = '', cta = '') => ({ layout, title, text, items, highlight: '', cta })
const lockSlide = (s) => (s.layout === 'fecho' ? { ...s, cta: 'Me chama no direct' } : { ...s, cta: '' })
const lockCaption = (c) => c
const tipsDecision = { mode: 'regulado', category: 'impostos', label: 'Impostos e taxas', tips: [T1, T2], hosts: ['gov.br'] }
const run = (topic, slides, caption, ask) => guardDeck({ topic, tcfg, slides, caption, expectDeck: true, ctaText: 'Me chama no direct', brand: 'Marca', ask, lockSlide, lockCaption })
{ // regulado: tudo certo (e o verificador não acha nada)
  const slides = [S('capa', 'O que saber sobre ITBI?', ''), S('destaque', '', 'O ITBI no Rio é de 3% sobre o valor do imóvel.'), S('destaque', '', 'A dívida de IPTU acompanha o imóvel.'), S('fecho', 'Dúvidas?', 'Fonte: gov.br', '', 'x')]
  const r = await run(tipsDecision, slides, 'O ITBI é de 3%. Fonte: gov.br', async () => '{"unsupported":[]}')
  assert.deepEqual(r.slides.map(s => s.text), slides.map(s => s.text)); assert.equal(r.caption, 'O ITBI é de 3%. Fonte: gov.br'); assert.deepEqual(r.notes, [])
}
ok('guarda regulado: texto fiel às dicas passa sem mexer')
{ // regulado: IA inventou 15 dias; a reescrita também → texto da dica (fallback), nota pro dono
  const slides = [S('capa', 'ITBI', ''), S('destaque', '', 'Pague em 15 dias.'), S('destaque', '', 'A dívida de IPTU acompanha o imóvel.'), S('fecho', 'Dúvidas?', '', '', 'x')]
  const ask = async (p) => (/"unsupported"/.test(p) ? '{"unsupported":[]}' : '{"title":"","text":"Pague em 15 dias.","items":"","highlight":"","cta":""}')
  const r = await run(tipsDecision, slides, 'Pague em 15 dias. Fonte: gov.br', ask)
  assert.ok(r.slides[1].text.startsWith('O ITBI no Rio de Janeiro é de 3%'), r.slides[1].text)
  assert.ok(r.slides.every(s => !validateRegulated([s.title + ' ' + s.text], tips, RT).length))
  assert.ok(r.caption.includes('3%') && !r.caption.includes('15'))
  assert.ok(r.notes.length >= 2); assert.ok(r.slides[3].text.includes('Fonte: gov.br'))
}
ok('guarda regulado: número de fora → reescrita 1x → texto da dica')
{ // regulado: reescrita boa resolve
  const slides = [S('capa', 'ITBI', ''), S('destaque', '', 'Pague em 15 dias.'), S('fecho', 'Dúvidas?', 'Fonte: gov.br', '', 'x')]
  const ask = async (p) => (/"unsupported"/.test(p) ? '{"unsupported":[]}' : '{"title":"","text":"O ITBI é de 3%.","items":"","highlight":"","cta":""}')
  const r = await run({ ...tipsDecision, tips: [T1] }, slides, 'O ITBI é de 3%.', ask)
  assert.equal(r.slides[1].text, 'O ITBI é de 3%.'); assert.deepEqual(r.notes, [])
}
ok('guarda regulado: reescrita limpa é aceita')
{ // regulado: verificador acha afirmação sem número → reescrita → verifica de novo → ainda ruim → fallback
  let verifications = 0
  const slides = [S('capa', 'ITBI', ''), S('destaque', '', 'O ITBI é de 3% e vale pra qualquer imóvel sem exceção.'), S('fecho', 'Dúvidas?', 'Fonte: gov.br', '', 'x')]
  const ask = async (p) => { if (/"unsupported"/.test(p)) { verifications++; return '{"unsupported":[{"unit":"slide 2","claim":"vale pra qualquer imóvel"}]}' } return '{"title":"","text":"Vale pra qualquer imóvel.","items":"","highlight":"","cta":""}' }
  const r = await run({ ...tipsDecision, tips: [T1] }, slides, '', ask)
  assert.equal(verifications, 2); assert.ok(r.slides[1].text.startsWith('O ITBI no Rio de Janeiro é de 3%')); assert.ok(r.notes.some(x => /verificador/.test(x)))
}
ok('guarda regulado: verificador de afirmações → reescrita 1x → fallback')
{ // regulado: verificador fora do ar → aviso, mantém
  const slides = [S('capa', 'ITBI', ''), S('destaque', '', 'O ITBI é de 3%.'), S('fecho', 'Dúvidas?', 'Fonte: gov.br', '', 'x')]
  const r = await run({ ...tipsDecision, tips: [T1] }, slides, '', async () => { throw new Error('rede') })
  assert.equal(r.slides[1].text, 'O ITBI é de 3%.'); assert.ok(r.notes.some(x => /não rodou/.test(x)))
}
ok('guarda regulado: verificador indisponível avisa o dono')
{ // regulado sem slides da IA → deck das dicas
  const r = await run(tipsDecision, [], '', async () => '{"unsupported":[]}')
  assert.deepEqual(r.slides.map(s => s.layout), ['capa', 'destaque', 'destaque', 'fecho'])
}
ok('guarda regulado: IA sem slides → carrossel das dicas')
{ // geral
  const geral = { mode: 'geral', category: 'impostos', label: 'Impostos e taxas', tips: [], hosts: [] }
  const slides = [S('capa', '5 erros com o ITBI', ''), S('destaque', '', 'Visite em horários diferentes.'), S('destaque', '', 'O prazo é de 30 dias.'), S('fecho', 'Dúvidas?', '', '', 'Me chama no direct')]
  const ask = async () => '{"title":"","text":"Pague até 30 dias.","items":"","highlight":"","cta":""}'
  const r = await run(geral, slides, 'Segundo a Lei 8.245, são 30 dias.', ask)
  for (const s of r.slides) assert.deepEqual(validateGeneral([s.title + ' ' + s.text], RT), [], JSON.stringify(s))
  assert.deepEqual(validateGeneral([r.caption], RT), []); assert.equal(r.slides[1].text, 'Visite em horários diferentes.')
  assert.equal(r.slides[0].layout, 'capa'); assert.equal(r.slides[3].cta, 'Me chama no direct')
}
ok('guarda geral: dígito, lei e prazo caem; slide bom fica; sempre sem fato')
{ // leve: reescreve 1x; se continuar, só avisa
  const slides = [S('capa', 'Primeiro imóvel', ''), S('destaque', '', 'Use o FGTS na entrada.'), S('destaque', '', 'Compare bairros com calma.'), S('fecho', 'Fale com a gente', '', '', 'x')]
  const leve = { mode: 'leve', category: null, label: '', tips: [], hosts: [] }
  const ok1 = await run(leve, slides, 'Use o FGTS.', async (p) => (/Motivo:[^]*FGTS/.test(p) && /Slide atual/.test(p) ? '{"title":"","text":"Planeje a entrada com calma.","items":"","highlight":"","cta":""}' : '{"caption":"Planeje com calma."}'))
  assert.equal(ok1.slides[1].text, 'Planeje a entrada com calma.'); assert.equal(ok1.caption, 'Planeje com calma.'); assert.deepEqual(ok1.notes, [])
  const bad = await run(leve, slides, 'Use o FGTS.', async () => '{"title":"","text":"Use o FGTS.","items":"","highlight":"","cta":""}')
  assert.equal(bad.slides[1].text, 'Use o FGTS na entrada.'); assert.ok(bad.notes.some(x => /slide 2/.test(x) && /FGTS/.test(x))); assert.ok(bad.notes.some(x => /legenda/.test(x)))
  assert.equal(bad.slides[2].text, 'Compare bairros com calma.')
}
ok('guarda leve: FGTS → reescreve 1x, senão aviso (nunca troca o texto)')
{ // unitOk
  const r = await run(tipsDecision, [S('capa', 'a', ''), S('fecho', 'b', 'Fonte: gov.br', '', 'x')], '', async () => '{"unsupported":[]}')
  assert.equal(r.unitOk(1, S('destaque', '', 'Prazo de 15 dias')), false); assert.equal(r.unitOk(1, S('destaque', '', 'O ITBI é de 3%')), true)
  assert.equal(r.unitOk(1, S('fecho', 'x', 'Fale com a gente')), false) // fecho sem fonte
}
ok('unitOk (usado no retry de overflow) respeita o modo')

console.log(`\n${n} blocos de teste passaram`)
