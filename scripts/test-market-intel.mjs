import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-market-intel.mjs
// Inteligência de Mercado — contador de dólar e teto (estágio 1), cron da coleta e encaixe no teto de US$ 40 (estágios 1-2).
// Sem dependência externa; spendCap.ts usa o global Deno (aqui simulado).
globalThis.Deno = { env: { get: () => undefined } }
import {
  capFromEnv, tavilyCostFromEnv, sourceBudget, daysLeftInMonth, searchesToday, spentBySource, remainingFor, rotate, buildUnits, dayNumber,
  normalizeUrl, normalizeTitle, parseIntelConfig, MARKET_INTEL_CAP_DEFAULT_USD, TAVILY_COST_DEFAULT_USD, monthStartIso, dayStartIso,
} from '../supabase/functions/_shared/marketIntel.ts'
import { capUsdOf, HARD_MAX_CAP_USD } from '../supabase/functions/_shared/marketIntel.ts'
import { cronMarketIntel } from '../supabase/functions/_shared/marketIntelCron.ts'
import { cronOpportunities } from '../supabase/functions/_shared/opportunityCron.ts'
const { monthSpend } = await import('../supabase/functions/_shared/spendCap.ts')
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

// --- teto e preço (env)
assert.equal(MARKET_INTEL_CAP_DEFAULT_USD, 5); assert.equal(capFromEnv(undefined), 5); assert.equal(capFromEnv('7.5'), 7.5); assert.equal(capFromEnv('abc'), 5); assert.equal(capFromEnv('0'), 5); assert.equal(capFromEnv('-1'), 5); ok('MARKET_INTEL_CAP_USD: padrão 5; lixo/zero/negativo volta ao padrão')
assert.equal(TAVILY_COST_DEFAULT_USD, 0.008); assert.equal(tavilyCostFromEnv(undefined), 0.008); assert.equal(tavilyCostFromEnv('0.01'), 0.01); assert.equal(tavilyCostFromEnv('x'), 0.008); ok('TAVILY_COST_USD: padrão conservador 0,008 (a confirmar)')

// --- divisão por fonte
assert.equal(sourceBudget({ instagram: 3, news: 2 }, 5, 'news'), 2); assert.equal(sourceBudget({ instagram: 3, news: 2 }, 5, 'instagram'), 3); ok('fatias da ficha (3 + 2 = 5)')
assert.equal(sourceBudget({ instagram: 3, news: 2 }, 2.5, 'news'), 1); assert.equal(sourceBudget({ instagram: 3, news: 2 }, 2.5, 'instagram'), 1.5); ok('soma passa do teto: reduz proporcionalmente (nunca soma > teto)')
assert.equal(sourceBudget({ instagram: 3, news: 2 }, 10, 'news'), 2); assert.equal(sourceBudget({ instagram: 0, news: 0 }, 5, 'news'), 0); assert.equal(sourceBudget({ instagram: 3, news: 2 }, 0, 'news'), 0); ok('teto maior não aumenta a fatia; zero = zero')
const split = { instagram: 3, news: 2 }
const spent = spentBySource([{ task_key: 'market_news_search', cost_usd: '0.008' }, { task_key: 'market_news_search', cost_usd: 0.008 }, { task_key: 'market_intel_apify', cost_usd: 1.2 }, { task_key: 'image_generation', cost_usd: 9 }, { task_key: 'market_news_search', cost_usd: null }])
assert.ok(Math.abs(spent.news - 0.016) < 1e-9 && spent.instagram === 1.2 && Math.abs(spent.total - 1.216) < 1e-9); ok('gasto por fonte soma só as chaves do mercado (cost_usd texto/nulo ok)')
assert.equal(remainingFor('news', { split, capUsd: 5, spent: { instagram: 0, news: 0.5, total: 0.5 } }), 1.5); assert.equal(remainingFor('news', { split, capUsd: 5, spent: { instagram: 4.5, news: 0, total: 4.5 } }), 0.5); assert.equal(remainingFor('news', { split, capUsd: 5, spent: { instagram: 0, news: 2.5, total: 2.5 } }), 0); ok('sobra = menor entre a fatia e o teto total; nunca negativa')

// --- plano de gasto
assert.equal(daysLeftInMonth(Date.parse('2026-11-01T00:00:00Z')), 30); assert.equal(daysLeftInMonth(Date.parse('2026-11-30T23:00:00Z')), 1); assert.equal(daysLeftInMonth(Date.parse('2028-02-10T00:00:00Z')), 20); ok('dias que faltam no mês (inclui hoje; bissexto)')
assert.equal(searchesToday({ remainingUsd: 2, daysLeft: 30, costUsd: 0.008 }), 8); assert.equal(searchesToday({ remainingUsd: 2, daysLeft: 1, costUsd: 0.008 }), 250); ok('buscas de hoje = dólares ÷ dias ÷ custo')
assert.equal(searchesToday({ remainingUsd: 0, daysLeft: 5, costUsd: 0.008 }), 0); assert.equal(searchesToday({ remainingUsd: 0.007, daysLeft: 1, costUsd: 0.008 }), 0); assert.equal(searchesToday({ remainingUsd: 1, daysLeft: 5, costUsd: 0 }), 0); assert.equal(searchesToday({ remainingUsd: 0.016, daysLeft: 30, costUsd: 0.008 }), 0); ok('sem orçamento / custo inválido: zero')
assert.equal(monthStartIso(Date.parse('2026-11-17T10:00:00Z')), '2026-11-01T00:00:00.000Z'); assert.equal(dayStartIso(Date.parse('2026-11-17T10:00:00Z')), '2026-11-17T00:00:00.000Z'); ok('início do mês/dia (UTC)')

// --- rotação
const U = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
assert.deepEqual(rotate(U, 3, 0), ['a', 'b', 'c']); assert.deepEqual(rotate(U, 3, 1), ['d', 'e', 'f']); assert.deepEqual(rotate(U, 3, 2), ['g', 'a', 'b']); ok('rotação: cada dia pega os próximos, dá a volta')
assert.equal(rotate(U, 99, 5).length, 7); assert.deepEqual(rotate([], 3, 1), []); assert.deepEqual(rotate(U, 0, 1), []); ok('rotação: n maior que a lista = tudo; vazio/zero = nada')
const covered = new Set(); for (let d = 0; d < 3; d++) rotate(U, 3, d).forEach(x => covered.add(x)); assert.equal(covered.size, 7); ok('em 3 dias cobre as 7 unidades')
const topics = [{ kind: 'launch', query: { pt: '{region} lanç', en: '{region} launch' } }, { kind: 'economy', query: { pt: 'mercado {city}' } }]
const us = buildUnits(topics, ['Ipanema', 'Leblon'], 'Rio', 'en'); assert.deepEqual(us.map(u => u.query), ['Ipanema launch', 'Leblon launch', 'mercado Rio']); assert.equal(us[2].cityLevel, true); assert.equal(us[2].region, 'Rio'); ok('unidades: {region} por bairro, {city} uma vez; idioma com fallback')
assert.equal(buildUnits([topics[1]], ['Ipanema'], '', 'pt').length, 0); ok('tópico de cidade sem cidade na ficha: ignorado')
assert.equal(dayNumber(Date.parse('1970-01-02T05:00:00Z')), 1); ok('dayNumber')

// --- dedupe
assert.equal(normalizeUrl('https://WWW.Site.com/a/b/?utm_source=x&utm_campaign=y&id=2&fbclid=z#frag'), 'https://site.com/a/b?id=2'); assert.equal(normalizeUrl('https://site.com/'), 'https://site.com/'); assert.equal(normalizeUrl('http://site.com/a'), null); assert.equal(normalizeUrl('lixo'), null); assert.equal(normalizeUrl('https://s.com/a?b=2&a=1'), 'https://s.com/a?a=1&b=2'); ok('normalizeUrl: sem utm_/fbclid/#, sem www, sem "/" final, só https')
assert.equal(normalizeTitle('Metrô chega à Gávea!'), normalizeTitle('  METRO chega a gavea')); assert.notEqual(normalizeTitle('Obra A'), normalizeTitle('Obra B')); assert.equal(normalizeTitle(null), ''); ok('normalizeTitle: sem acento/caixa/pontuação')

// --- ficha: teto e fatias
assert.deepEqual(parseIntelConfig({}).split, { instagram: 3, news: 2 }); assert.equal(parseIntelConfig({ cap_usd: 'x' }).cap_usd, undefined); assert.equal(parseIntelConfig({ cap_usd: 4 }).cap_usd, 4); ok('ficha: split padrão 3/2; cap_usd inválido ignorado')

// --- spendCap: market_usd entra no total dos US$ 40
{
  const rows = { video_tours: [{ cost_usd: 2 }], virtual_staging: [{ attempts: 1 }], agent_performance: [
    { task_key: 'image_generation', cost_usd: 0.5 }, { task_key: 'photo_retouch', cost_usd: 0.08 },
    { task_key: 'market_news_search', cost_usd: 0.008 }, { task_key: 'market_news_search', cost_usd: 0.008 }, { task_key: 'market_intel_apify', cost_usd: 0.4 }] }
  const admin = { from: (t) => { const api = { select: () => api, eq: () => api, in: () => api, not: () => api, gte: () => api, then: (res) => Promise.resolve({ data: rows[t] ?? [] }).then(res) }; return api } }
  const s = await monthSpend(admin, 'c1')
  assert.ok(Math.abs(s.market_usd - 0.416) < 1e-9); assert.ok(Math.abs(s.total_usd - (2 + 0.5 + 0.08 * 2 + 0.416)) < 1e-9); assert.equal(s.images_usd, 0.5); assert.equal(s.edits, 2); ok('spendCap: Tavily/Apify somam em market_usd e dentro do total (teto de US$ 40); não viram edição de foto')
}

// --- cron da coleta
const table = (data) => { const api = { select: () => api, eq: () => api, is: () => api, not: () => api, or: () => api, order: () => api, gte: () => api, limit: () => api, maybeSingle: async () => ({ data: Array.isArray(data) ? null : data }), then: (res) => Promise.resolve({ data }).then(res) }; return api }
const CFG = { opportunity_fields: { location: 'bairro' }, market_intel: { news: { topics: [] } } }
function cronAdmin(companies, pbCfg = CFG, hermes = { auto_strategy_enabled: true }) {
  const log = []
  return { log, from: (t) => {
    const rec = { select: () => rec, eq: (c, v) => { log.push([t, c, v]); return rec }, limit: () => rec, maybeSingle: async () => ({ data: t === 'hermes_config' ? hermes : t === 'vertical_playbooks' ? { config: pbCfg } : null }), then: (res) => Promise.resolve({ data: t === 'companies' ? companies : [] }).then(res) }
    return rec } }
}
{
  const calls = []
  const a = cronAdmin([{ id: 'c1', vertical_key: 'imoveis_rio', language: 'pt' }, { id: 'c2', vertical_key: 'imoveis_rio', language: 'en' }, { id: 'c3', vertical_key: 'imoveis_rio', language: 'pt' }, { id: 'c4', vertical_key: 'imoveis_rio', language: 'pt' }])
  const r = await cronMarketIntel(a, Date.now(), { collect: async (_a, o) => { calls.push(o); return o.companyId === 'c1' ? { searched: 0, added: 0, spent_usd: 0, skipped: 'já coletou hoje' } : { searched: 4, added: 2, spent_usd: 0.032 } } })
  assert.deepEqual(calls.map(c => c.companyId), ['c1', 'c2', 'c3']); assert.equal(r.collected, 2); assert.equal(r.added, 4); assert.ok(Math.abs(r.spent_usd - 0.064) < 1e-9); ok('cron: no máx. 2 empresas COM trabalho por chamada; quem já coletou hoje não ocupa vaga')
  assert.equal(calls[1].lang, 'en'); assert.equal(calls[0].locationKey, 'bairro'); assert.equal(typeof calls[0].canStart, 'function'); assert.deepEqual(calls[0].rawConfig, CFG.market_intel); ok('cron: idioma, campo de região e ficha repassados')
  assert.ok(a.log.some(([t, c, v]) => t === 'companies' && c === 'auto_strategy' && v === true) && a.log.some(([t, c, v]) => t === 'companies' && c === 'active' && v === true)); ok('cron: só empresas auto_strategy=true e ativas (Liga dos Sonhos fica de fora)')
}
{
  const off = cronAdmin([{ id: 'c1' }], CFG, { auto_strategy_enabled: false }); let called = 0
  const r = await cronMarketIntel(off, Date.now(), { collect: async () => { called++; return { searched: 0, added: 0, spent_usd: 0 } } }); assert.ok(r.skipped_reason); assert.equal(called, 0); ok('cron: interruptor geral desligado = nada')
  const semFicha = cronAdmin([{ id: 'c1', vertical_key: 'x' }], { opportunity_fields: { location: 'bairro' } }); await cronMarketIntel(semFicha, Date.now(), { collect: async () => { called++; return { searched: 0, added: 0, spent_usd: 0 } } }); assert.equal(called, 0); ok('cron: ficha sem market_intel = setor sem coleta')
  const late = cronAdmin([{ id: 'c1', vertical_key: 'x' }]); await cronMarketIntel(late, Date.now() - 41_000, { collect: async () => { called++; return { searched: 0, added: 0, spent_usd: 0 } } }); assert.equal(called, 0); ok('cron: depois de 40 s não começa empresa nova')
  const boom = cronAdmin([{ id: 'c1', vertical_key: 'x' }, { id: 'c2', vertical_key: 'x' }]); const quiet = console.error; console.error = () => {}
  const rb = await cronMarketIntel(boom, Date.now(), { collect: async (_a, o) => { if (o.companyId === 'c1') throw new Error('x'); return { searched: 1, added: 0, spent_usd: 0 } } }); console.error = quiet
  assert.equal(rb.collected, 1); ok('cron: falha de uma empresa não derruba as outras')
  const withCap = cronAdmin([{ id: 'c1', vertical_key: 'x' }]); let fits
  await cronMarketIntel(withCap, Date.now(), { fitsCap: async (id, est) => { fits = [id, est]; return true }, collect: async (_a, o) => { await o.fitsTotalCap(0.008); return { searched: 0, added: 0, spent_usd: 0 } } }); assert.deepEqual(fits, ['c1', 0.008]); ok('cron: teto geral (spendCap.fitsCap) é repassado por empresa')
}

// --- opportunityCron não coleta mais (dono único = cron_market_intel)
{
  const order = []
  const admin = { from: (t) => {
    if (t === 'hermes_config') return table({ auto_strategy_enabled: true })
    if (t === 'companies') return table([{ id: 'c1', vertical_key: 'imoveis_rio', language: 'pt' }])
    if (t === 'vertical_playbooks') return table({ config: { opportunity_fields: { location: 'bairro' }, market_intel: CFG.market_intel } })
    order.push(t); return table(t === 'market_signals' || t === 'agent_performance' ? null : [])
  } }
  const r = await cronOpportunities(admin, async () => ({ text: '[]', tokens: 0 }), Date.now())
  assert.equal(r.companies_checked, 1); assert.ok(!('news_added' in r)); assert.ok(order.includes('market_signals')); ok('opportunityCron: só lê sinais, não coleta')
}
{ // teto aprovado pelo dono: ficha/env só apertam
  assert.equal(HARD_MAX_CAP_USD, 5); assert.equal(capUsdOf(500), 5); assert.equal(capUsdOf(2), 2); assert.equal(capUsdOf(NaN), 5); assert.equal(capUsdOf(0), 5)
  ok('teto em dólar nunca passa de US$ 5')
}
console.log(`\n${n} verificações ok`)
