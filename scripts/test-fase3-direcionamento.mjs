import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-fase3-direcionamento.mjs
// Fase 3 (Direcionamento): (1) contexto de mercado nos temas da semana; (2) trava de aprovação da estratégia.
import { buildMarketItems, marketPromptBlock, pickAliases, buildMarketContext, cleanMarketContext } from '../supabase/functions/_shared/marketContext.ts'
import { themeAskPrompt, planWeekThemes } from '../supabase/functions/_shared/weekThemes.ts'
import { cleanIntent, withMarketContext, intentBlock } from '../supabase/functions/_shared/slotIntent.ts'
import { DEFAULT_THEME_CFG } from '../supabase/functions/_shared/themeDedupe.ts'
import { lockFunnel, refreshPatch, finishPlan, repeatsDiscarded, sameThesis, isPendingProposal, approvePatch, discardPatch, proposalOf } from '../supabase/functions/_shared/strategyLock.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

const NOW = Date.parse('2026-11-04T12:00:00Z')
const day = (d) => new Date(NOW - d * 86400000).toISOString().slice(0, 10)
const sig = (id, over = {}) => ({ id, title: `Título ${id}`, summary: 'Resumo curto', source_name: 'exemplo.com.br', source_url: `https://exemplo.com.br/${id}`, observed_at: day(2), meta: { quality_v: 2, quality_ok: true }, ...over })

// ── 1. prompt idêntico com zero sinais ───────────────────────────────────────────────────────────────────────────
// Texto de ANTES da Fase 3, copiado literalmente: se alguém mexer no pedido sem sinal, este teste quebra.
const legacy = (brand, slots, forbidden) =>
  `Você é o Diretor Criativo de "${brand}". Escolha UM tema de post para cada vaga abaixo, todos DIFERENTES entre si.
Vagas:
${slots.map(s => `- ${s.key} (${s.date}): ${s.hint}`).join('\n')}
${forbidden.length ? `TEMAS PROIBIDOS (já usados nas últimas semanas ou já reservados — nem a mesma comparação, os mesmos bairros ou o mesmo valor com outras palavras):\n${forbidden.slice(0, 40).map(t => `- ${t}`).join('\n')}\n` : ''}Regras: tema curto (até 12 palavras), sem inventar número, preço nem dado de mercado.
Responda SÓ em JSON: {"temas":[{"vaga":"<chave da vaga>","tema":""}]}`
const slots = [{ key: 'v1', date: '2026-11-05', hint: 'Educativo — pilar x' }, { key: 'v2', date: '2026-11-07', hint: 'Bairro — pilar y' }]
for (const forb of [[], ['Tema A', 'Tema B']]) {
  assert.equal(themeAskPrompt('Tespon', slots, forb), legacy('Tespon', slots, forb))
  assert.equal(themeAskPrompt('Tespon', slots, forb, []), legacy('Tespon', slots, forb))
}
ok('pedido de temas sem contexto é IDÊNTICO ao de antes (com e sem lista proibida)')
// todas as razões de "zero sinais" produzem lista vazia
assert.deepEqual(buildMarketItems([], [], NOW), []); assert.deepEqual(buildMarketItems(null, undefined, NOW), [])
assert.deepEqual(buildMarketItems([sig('a', { meta: { ignored: true } }), sig('b', { meta: { ignored: 'true' } }), sig('c', { meta: { quality_ok: false } }), sig('d', { observed_at: day(15) }), sig('e', { title: '' }), sig('f', { observed_at: 'lixo' })], [{ id: 't1', title: 'Ignorada', status: 'ignored' }], NOW), [])
ok('ignorado, qualidade reprovada, fora dos 14 dias, sem título, data inválida e tendência ignorada não entram')
assert.equal(marketPromptBlock([]), '')
// o plano inteiro (ask recebe o mesmo texto, resultado sem "market")
const seen = []
const out0 = await planWeekThemes({ slots, history: [], cfg: DEFAULT_THEME_CFG, brand: 'Tespon', market: [], ask: async (p) => { seen.push(p); return JSON.stringify({ temas: [{ vaga: 'v1', tema: 'Como funciona o financiamento passo a passo', fontes: ['S1'] }, { vaga: 'v2', tema: 'O que conferir na visita ao imóvel' }] }) } })
assert.equal(seen[0], legacy('Tespon', slots, [])); assert.ok([...out0.values()].every(a => a.market === undefined))
ok('planWeekThemes sem sinais: mesmo prompt e nenhuma fonte, mesmo que o modelo invente "fontes"')
const out00 = await planWeekThemes({ slots, history: [], cfg: DEFAULT_THEME_CFG, brand: 'Tespon', ask: async () => JSON.stringify({ temas: [{ vaga: 'v1', tema: 'Tema um sobre aluguel' }, { vaga: 'v2', tema: 'Tema dois sobre vistoria' }] }) })
assert.equal(out00.get('v1').idea, 'Tema um sobre aluguel'); ok('sem o parâmetro market, tudo funciona como antes')

// ── 2. montagem + limites ────────────────────────────────────────────────────────────────────────────────────────
const many = Array.from({ length: 9 }, (_, i) => sig(`s${i}`, { observed_at: day(i % 10) }))
const items = buildMarketItems([...many, sig('semqual', { meta: {} })], [{ id: 't1', title: 'Tendência 1', description: 'desc', detected_at: day(3), source: 'diagnostico', status: 'active' }, { id: 't2', title: 'Tendência 2' }, { id: 't3', title: 'T3' }, { id: 't4', title: 'T4' }], NOW)
assert.equal(items.filter(i => i.kind === 'signal').length, 5); assert.equal(items.filter(i => i.kind === 'trend').length, 3)
assert.deepEqual(items.map(i => i.alias), ['S1', 'S2', 'S3', 'S4', 'S5', 'T1', 'T2', 'T3'])
assert.ok(items.filter(i => i.kind === 'signal').every((i, k, a) => k === 0 || a[k - 1].observed_at >= i.observed_at)); ok('até 5 sinais (mais recentes primeiro) + até 3 tendências ativas')
assert.equal(buildMarketItems([sig('semqual', { meta: {} })], [], NOW).length, 1); ok('sinal antigo sem quality_ok (meta vazia) vale, desde que não ignorado')
assert.ok(items.every(i => /^[A-Za-z0-9_-]+$/.test(i.id)))

// prompt com contexto: traz a regra e os códigos, e pede "fontes"
const p1 = themeAskPrompt('Tespon', slots, [], items)
assert.ok(p1.includes('Contexto de mercado (opcional): use só se encaixar no pilar da vaga; nunca cite número que não esteja no sinal')); assert.ok(p1.includes('- S1 (sinal') && p1.includes('- T1 (tendência')); assert.ok(p1.includes('"fontes"'))
ok('prompt com contexto traz a regra "use só se encaixar… nunca cite número que não esteja no sinal"')

// ── 3. ids validados contra a lista ──────────────────────────────────────────────────────────────────────────────
assert.deepEqual(pickAliases(['s1', 'S9', 'T1', 'T1', 42, null, '../x'], items), ['S1', 'T1']); assert.deepEqual(pickAliases('S1', items), []); assert.deepEqual(pickAliases(undefined, items), [])
const two = items.slice(0, 2)
const out1 = await planWeekThemes({ slots, history: [], cfg: DEFAULT_THEME_CFG, brand: 'Tespon', market: two, ask: async () => JSON.stringify({ temas: [{ vaga: 'v1', tema: 'Tema ligado ao primeiro sinal', fontes: ['S2', 'S7', 'T1'] }, { vaga: 'v2', tema: 'Outro tema sem fonte nenhuma', fontes: ['XX'] }] }) })
assert.deepEqual(out1.get('v1').market, ['S2']); assert.equal(out1.get('v2').market, undefined); ok('o que o modelo devolve como fonte é conferido: código desconhecido (S7, T1 fora da lista, XX) é descartado')
const mc = buildMarketContext(out1.get('v1').market, two)
assert.deepEqual(mc.signal_ids, [two[1].id]); assert.deepEqual(mc.trend_ids, []); assert.equal(mc.evidence.length, 1)
assert.deepEqual(Object.keys(mc.evidence[0]).sort(), ['id', 'observed_at', 'quality_version', 'source_name', 'source_url', 'title']); assert.equal(mc.evidence[0].quality_version, 2); assert.equal(buildMarketContext([], two), null)
ok('market_context gravado = cópia da evidência (id, título, fonte, url, data, versão da qualidade)')
// tema trocado na 2ª rodada não herda a fonte da 1ª
let call = 0
const A = 'Comparativo do que R$ 1,5 mi compra na Barra da Tijuca vs. no Leblon'
const out2 = await planWeekThemes({ slots: slots.slice(0, 1), history: [A], cfg: DEFAULT_THEME_CFG, brand: 'T', market: two, ask: async () => (++call === 1 ? JSON.stringify({ temas: [{ vaga: 'v1', tema: A, fontes: ['S1'] }] }) : JSON.stringify({ temas: [{ vaga: 'v1', tema: 'Checklist para a visita ao imóvel' }] })) })
assert.equal(out2.get('v1').idea, 'Checklist para a visita ao imóvel'); assert.equal(out2.get('v1').market, undefined); ok('tema trocado na 2ª tentativa não herda a fonte do tema recusado')

// ── 4. cleanIntent / cleanMarketContext ──────────────────────────────────────────────────────────────────────────
const base = { pilar_ss: 'prova_social', pilar_ss_name: 'Prova social', pillar_plan: 'x', funnel: null, central_line: 'y' }
const ci = cleanIntent({ ...base, market_context: mc })
assert.deepEqual(ci.market_context, mc); ok('cleanIntent preserva market_context válido')
assert.equal(cleanIntent(base).market_context, undefined); assert.equal(cleanIntent({ ...base, market_context: 'texto' }).market_context, undefined); assert.equal(cleanIntent({ ...base, market_context: { evidence: [] } }).market_context, undefined)
const evil = cleanMarketContext({ signal_ids: ['a', 'zzz', 'a'], trend_ids: ['b', ...Array(20).fill('b')], evidence: [
  { id: 'a', title: 'T'.repeat(900), source_name: 'x'.repeat(500), source_url: 'javascript:alert(1)', observed_at: '2026-11-01', quality_version: 'abc' },
  { id: 'b', title: 'Tendência', source_url: 'https://ok.com/x', quality_version: 3 },
  { id: 'b', title: 'duplicada' }, { id: 'bad id!', title: 'x' }, { id: 'c' }, null, 7,
  ...Array(30).fill({ id: 'q', title: 'q' }) ] })
assert.equal(evil.evidence[0].title.length, 200); assert.equal(evil.evidence[0].source_name.length, 120); assert.equal(evil.evidence[0].source_url, null); assert.equal(evil.evidence[0].quality_version, null)
assert.equal(evil.evidence[1].source_url, 'https://ok.com/x'); assert.equal(evil.evidence[1].quality_version, 3)
assert.deepEqual(evil.signal_ids, ['a']); assert.deepEqual(evil.trend_ids, ['b']); assert.ok(evil.evidence.length <= 8); assert.equal(new Set(evil.evidence.map(e => e.id)).size, evil.evidence.length)
ok('cleanMarketContext limita tamanhos, derruba URL não-http(s), id inválido/duplicado e ids fora da evidência')
assert.equal(cleanMarketContext({ evidence: 'x' }), null); assert.equal(cleanMarketContext(null), null); ok('forma inválida = sem contexto')
// vaga SEM intenção (setor sem pilar): casca só com o contexto; o texto da peça não muda
const shell = withMarketContext(null, mc)
assert.equal(shell.pilar_ss, ''); assert.deepEqual(shell.market_context, mc); assert.equal(intentBlock(shell), ''); assert.equal(withMarketContext(null, undefined), null); assert.equal(withMarketContext(ci, undefined), ci)
assert.equal(intentBlock({ ...base, market_context: mc }), intentBlock(base)); ok('market_context não entra no texto que vai pra IA da peça (só no registro)')

// ── 5. trava de aprovação ────────────────────────────────────────────────────────────────────────────────────────
const cur = [{ stage: 'awareness', pillar: 'a', audience: 'Compradores de 1º imóvel', objective: 'Ser lembrado', message: 'm0', cta: 'c0' }, { stage: 'conversion', audience: 'Quem já visitou', objective: 'Agendar visita', message: 'm1' }]
const proposed = [{ stage: 'awareness', pillar: 'a', audience: 'Investidores', objective: 'Vender mais', message: 'NOVA', cta: 'c9' }, { stage: 'conversion', audience: 'Todo mundo', objective: 'Outra coisa', message: 'NOVA2' }, { stage: 'retention', audience: 'Público novo', objective: 'novo', message: 'x' }]
const lf = lockFunnel(cur, proposed)
assert.equal(lf.length, 2); assert.deepEqual(lf.map(f => [f.audience, f.objective]), [['Compradores de 1º imóvel', 'Ser lembrado'], ['Quem já visitou', 'Agendar visita']]); assert.deepEqual(lf.map(f => f.message), ['NOVA', 'NOVA2'])
assert.deepEqual(lockFunnel(cur, []), cur); assert.deepEqual(lockFunnel(cur, 'lixo'), cur); assert.deepEqual(lockFunnel(cur, [{ stage: 'retention', audience: 'x' }]), cur)
ok('refresh: público e objetivo de cada etapa vêm da estratégia atual; mensagem/CTA podem mudar; etapa nova (público novo) não entra')
const strategy = { thesis: 'T', strategic_focus: 'F', primary_business_objective: 'B', primary_marketing_objective: 'M', budget: { total: 100 }, funnel_plan: cur }
const patch = refreshPatch(strategy, proposed, { central_line: 'nova' }, '2026-11-04T00:00:00Z')
assert.deepEqual(Object.keys(patch).sort(), ['content_plan', 'funnel_plan', 'last_refreshed_at', 'updated_at'])
for (const k of ['thesis', 'strategic_focus', 'primary_business_objective', 'primary_marketing_objective', 'budget', 'exclusions', 'status']) assert.ok(!(k in patch), k)
ok('refresh: o UPDATE só tem plano de conteúdo, funil (travado) e carimbos — nada de tese, foco, objetivos ou orçamento')
// o código real usa refreshPatch e não escreve os campos travados
const src = readFileSync(new URL('../supabase/functions/strategy-generate/index.ts', import.meta.url), 'utf8')
const refreshBody = src.slice(src.indexOf('async function runRefresh'), src.indexOf('async function closeProposalLog'))
assert.ok(refreshBody.includes('refreshPatch(')); assert.ok(!/update\(\{[^}]*\b(thesis|strategic_focus|primary_business_objective|primary_marketing_objective|budget)\b/.test(refreshBody)); ok('runRefresh usa refreshPatch e não escreve campos travados')

// pivô → proposta
const pm = { from_strategy_id: 'old', decision: 'pivot', reason: 'r', reasoning: 'q' }
const f1 = finishPlan({ kind: 'main', data_provenance: { proposal: pm } })
assert.deepEqual(f1, { status: 'needs_review', pausePrevious: false, createCampaign: false, planRestOfWeek: false, supersedeProposals: false })
const f2 = finishPlan({ kind: 'main', data_provenance: {} }); assert.equal(f2.status, 'active'); assert.ok(f2.pausePrevious && f2.createCampaign && f2.planRestOfWeek && f2.supersedeProposals)
const f3 = finishPlan({ kind: 'initiative', data_provenance: null }); assert.equal(f3.status, 'active'); assert.equal(f3.pausePrevious, false)
ok('pivô automático termina em needs_review, sem pausar a ativa nem planejar a semana; geração do dono ativa como sempre')
const genBody = src.slice(src.indexOf("if (action === 'generate') {"), src.indexOf("if (action === 'reanalyze') {"))
assert.ok(/isCron && kind === 'main' && body\.as_proposal === true/.test(genBody)); ok('só chamada de cron pode pedir proposta (o botão do dono nunca)')
const reBody = src.slice(src.indexOf('async function runReanalyze'), src.indexOf('async function runRefresh'))
assert.ok(reBody.includes('as_proposal: true') && reBody.includes('isPendingProposal')); ok('reanalyze (pivot/terminate) pede PROPOSTA e não gera outra se já há uma aberta')
const ap = src.slice(src.indexOf("action === 'approve_proposal'"), src.indexOf("if (action === 'update_strategy')"))
assert.ok(/if \(isCron\) return json/.test(ap)); ok('approve/discard recusam cron (só JWT do dono)')

// aprovar / descartar
const row = { status: 'needs_review', data_provenance: { proposal: pm, source: 'x' } }
assert.ok(isPendingProposal(row)); assert.ok(!isPendingProposal({ status: 'active', data_provenance: { proposal: pm } })); assert.ok(!isPendingProposal({ status: 'needs_review', data_provenance: {} }))
const d = discardPatch(row.data_provenance, 'owner', '2026-11-05T10:00:00Z')
assert.equal(d.status, 'paused'); assert.equal(d.data_provenance.proposal.discarded_by, 'owner'); assert.equal(d.data_provenance.proposal.discarded_at, '2026-11-05T10:00:00Z'); assert.equal(d.data_provenance.source, 'x')
assert.ok(!isPendingProposal({ status: 'needs_review', data_provenance: d.data_provenance }))
const a = approvePatch(row.data_provenance, '2026-11-05T10:00:00Z'); assert.equal(a.status, 'active'); assert.equal(proposalOf(a.data_provenance).approved_at, '2026-11-05T10:00:00Z')
ok('descartar → fora da lista (pausada, com discarded_at/by); aprovar → ativa, carimbo approved_at; resto da proveniência preservado')

// proposta repetida de uma descartada
const T1 = 'Porque X, acreditamos Y. Por isso, vamos Z por 90 dias.'
const past = [{ thesis: 'Outra tese antiga', data_provenance: { proposal: { discarded_at: '2026-10-01T00:00:00Z' } } }, { thesis: T1, data_provenance: { proposal: { discarded_at: '2026-10-20T00:00:00Z' } } }, { thesis: 'Pausada normal', data_provenance: {} }]
assert.ok(repeatsDiscarded('  porque x, acreditamos y.  por isso vamos z por 90 DIAS ', past)); assert.ok(!repeatsDiscarded('Tese diferente', past)); assert.ok(!repeatsDiscarded(T1, [{ thesis: T1, data_provenance: {} }])); assert.ok(!repeatsDiscarded(T1, []))
assert.ok(!repeatsDiscarded('Outra tese antiga', past)); assert.ok(sameThesis('Á b', 'a  B')); assert.ok(!sameThesis('', ''))
ok('mesma tese da ÚLTIMA descartada (ignora acento/caixa/pontuação) não é proposta de novo; tese diferente ou pausada sem descarte é')
const s1 = src.slice(src.indexOf('async function runStep1'), src.indexOf('// ── PASSO 2'))
assert.ok(s1.includes('repeatsDiscarded(') && s1.includes("status: 'dismissed'")); ok('runStep1 para e registra no log quando a tese repete a descartada')

console.log(`\n${n} ok`)
