import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-market-news.mjs
// Notícias automáticas (Etapa 3): filtros em código, limites semanal/mensal, falha da Tavily, encaixe no cron.
import { parseNewsConfig, pickRegions, filterHits, searchesAllowed, newAllowed, monthlyCapFrom, buildQuery, sanitizeText } from '../supabase/functions/_shared/marketNews.ts'
import { collectMarketNews } from '../supabase/functions/_shared/marketNewsRun.ts'
import { cronOpportunities } from '../supabase/functions/_shared/opportunityCron.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

const NOW = Date.parse('2026-10-30T12:00:00Z')
const RAW = { queries: { pt: '{region} Rio de Janeiro imóveis', en: '{region} real estate' }, exclude_domains: ['zapimoveis.com.br', 'zillow.com'], days: 30, max_regions: 3, max_results: 5, max_new_per_week: 5 }
const cfg = parseNewsConfig(RAW)
const hit = (o = {}) => ({ title: 'Metrô chega a Ipanema', url: 'https://www.oglobo.globo.com/a1', content: 'Obra em Ipanema avança.', published_date: '2026-10-25T10:00:00Z', ...o })
const f = (hits, region = 'Ipanema') => filterHits(hits, { region, days: 30, excludeDomains: cfg.exclude_domains, nowMs: NOW })

// --- filtros
assert.equal(f([hit()]).length, 1); ok('notícia válida passa')
const s = f([hit()])[0]
assert.deepEqual([s.kind, s.region, s.source_name, s.observed_at, s.collected_by, s.meta.provider], ['news', 'Ipanema', 'oglobo.globo.com', '2026-10-25', 'system', 'tavily']); ok('campos gravados (domínio, data da fonte, system)')
assert.equal(f([hit({ published_date: undefined })]).length, 0); ok('sem data: descarta')
assert.equal(f([hit({ published_date: 'ontem' })]).length, 0); ok('data inválida: descarta')
assert.equal(f([hit({ published_date: '2026-11-02T00:00:00Z' })]).length, 0); ok('data futura: descarta')
assert.equal(f([hit({ published_date: '2026-08-01T00:00:00Z' })]).length, 0); ok('data > days: descarta')
assert.equal(f([hit({ title: 'Metrô chega ao Centro', content: 'Obra no Centro.' })]).length, 0); ok('região ausente: descarta')
assert.equal(f([hit({ title: 'Obra', content: 'Em IPÂNEMA a obra avança' })], 'Ipanema').length, 1); ok('região no conteúdo, sem acento/caixa: passa')
assert.equal(f([hit({ title: 'Obra', content: 'Ipanemaville' })], 'Ipanema').length, 0); ok('região só como pedaço de outra palavra: descarta')
assert.equal(f([hit({ url: 'https://www.zapimoveis.com.br/x' })]).length, 0); ok('portal excluído: descarta')
assert.equal(f([hit({ url: 'https://sub.zillow.com/x' })]).length, 0); ok('subdomínio de portal: descarta')
assert.equal(f([hit({ url: 'http://oglobo.com/x' })]).length, 0); ok('http: descarta')
assert.equal(f([hit({ url: 'ftp://x' }), hit({ url: 'lixo' })]).length, 0); ok('url inválida: descarta')
assert.equal(f([hit(), hit()]).length, 1); ok('duplicata no mesmo lote: uma só')
const long = f([hit({ title: 'Ipanema ' + 'x'.repeat(400), content: '<b>Ipanema</b> ' + 'y'.repeat(600) + ' http://a.com' })])[0]
assert.ok(long.title.length <= 200 && long.summary.length <= 300 && !long.summary.includes('<')); ok('título ≤200, resumo ≤300 e saneado')
assert.equal(sanitizeText('a\n\tb  <i>c</i>', 50), 'a b c'); ok('sanitizeText')

// --- config, regiões, limites
assert.equal(parseNewsConfig({}), null); assert.equal(parseNewsConfig({ queries: { pt: 'sem marcador' } }), null); ok('ficha sem busca válida: null')
assert.equal(parseNewsConfig({ ...RAW, max_regions: 99, max_new_per_week: 99 }).max_regions, 3); assert.equal(parseNewsConfig({ ...RAW, max_new_per_week: 99 }).max_new_per_week, 5); ok('ficha não passa dos tetos')
assert.deepEqual(pickRegions(['Leblon', 'leblon', 'Ipanema', 'Ipanema', 'Ipanema', 'Barra', 'Méier', null, ''], 3), ['Ipanema', 'Leblon', 'Barra']); ok('regiões com mais itens, grafia exata')
assert.equal(buildQuery('{region} x {region}', 'Leblon'), 'Leblon x Leblon'); ok('buildQuery')
assert.equal(searchesAllowed({ usedWeek: 3, maxRegions: 3, monthUsed: 0, monthlyCap: 120 }), 0); ok('teto semanal de buscas')
assert.equal(searchesAllowed({ usedWeek: 1, maxRegions: 3, monthUsed: 0, monthlyCap: 120 }), 2)
assert.equal(searchesAllowed({ usedWeek: 0, maxRegions: 3, monthUsed: 119, monthlyCap: 120 }), 1); ok('teto mensal')
assert.equal(searchesAllowed({ usedWeek: 0, maxRegions: 3, monthUsed: 120, monthlyCap: 120 }), 0)
assert.equal(newAllowed(5, 5), 0); assert.equal(newAllowed(2, 9), 3); ok('teto de 5 sinais novos/semana')
assert.equal(monthlyCapFrom(undefined), 120); assert.equal(monthlyCapFrom('50'), 50); assert.equal(monthlyCapFrom('abc'), 120); ok('MARKET_NEWS_MONTHLY_CAP')

// --- I/O com banco falso
function fakeAdmin(init = {}) {
  const db = { perf: init.perf ?? [], signals: init.signals ?? [], items: init.items ?? ['Ipanema', 'Ipanema', 'Leblon', 'Barra'].map(b => ({ meta: { fields: { bairro: b } } })), source: init.source, errors: init.errors ?? {}, perfInserts: [] }
  const q = (table) => {
    const st = { table, filters: [], head: false }
    const api = {
      select: (_c, o) => { st.head = !!o?.head; return api },
      eq: (c, v) => { st.filters.push((r) => r[c] === v); return api },
      gte: () => api, limit: () => api, in: (c, v) => { st.filters.push((r) => v.includes(r[c])); return api },
      maybeSingle: async () => ({ data: table === 'insight_sources' ? db.source ?? null : null, error: null }),
      insert: async (row) => {
        if (db.errors[table + '.insert']) return { error: { message: 'boom', code: db.errors[table + '.insert'] } }
        if (table === 'agent_performance') { if (row.latency_ms == null) return { error: { message: 'null latency' } }; db.perf.push(row); db.perfInserts.push(row) }
        if (table === 'market_signals') { if (db.signals.some(s => s.company_id === row.company_id && s.source_url === row.source_url && s.collected_by === 'system')) return { error: { message: 'dup', code: '23505' } }; db.signals.push(row) }
        return { error: null }
      },
      then: (res) => {
        const rows = table === 'agent_performance' ? db.perf : table === 'market_signals' ? db.signals : table === 'marketing_ai_knowledge' ? db.items : []
        const m = table === 'marketing_ai_knowledge' ? rows : rows.filter(r => st.filters.every(fn => fn(r)))
        return Promise.resolve(st.head ? { count: m.length, error: db.errors[table + '.count'] ? { message: 'x' } : null } : { data: m, error: null }).then(res)
      },
    }
    return api
  }
  return { from: q, db }
}
const mk = (o) => ({ companyId: 'c1', lang: 'pt', rawConfig: RAW, locationKey: 'bairro', getKey: async () => 'k', nowMs: NOW, monthlyCap: 120, ...o })
const goodSearch = async (_k, query) => [hit({ title: `${query.split(' ')[0]} obra`, url: `https://news.com/${query.split(' ')[0]}`, content: query.split(' ')[0] })]

{ // caminho feliz
  const a = fakeAdmin(); const queries = []
  const r = await collectMarketNews(a, mk({ search: async (k, q, c) => { queries.push(q); assert.equal(c.days, 30); return goodSearch(k, q) } }))
  assert.equal(r.searched, 3); assert.equal(r.added, 3); assert.deepEqual(queries.map(q => q.split(' ')[0]), ['Ipanema', 'Barra', 'Leblon']); ok('3 buscas, 3 sinais, regiões mais cheias')
  assert.equal(a.db.perfInserts.length, 3); assert.ok(a.db.perfInserts.every(p => p.task_key === 'market_news_search' && p.agent_role === 'cmo' && p.tokens_used === 0 && p.success === true && typeof p.latency_ms === 'number')); ok('cada busca grava agent_performance com latency_ms')
  assert.ok(a.db.signals.every(s => s.collected_by === 'system')); ok('sinais system')
  const again = await collectMarketNews(a, mk({ search: goodSearch })); assert.equal(again.searched, 0); assert.match(again.skipped, /limite/); ok('segunda chamada na semana: nada (teto de 3 buscas)')
}
{ // duplicata já gravada
  const a = fakeAdmin({ signals: [{ company_id: 'c1', source_url: 'https://news.com/Ipanema', collected_by: 'manual' }] })
  const r = await collectMarketNews(a, mk({ search: goodSearch, rawConfig: { ...RAW, max_regions: 1 } })); assert.equal(r.added, 0); ok('link que a empresa já tem: não duplica')
  const b = fakeAdmin({ signals: [{ company_id: 'c1', source_url: 'https://news.com/Ipanema', collected_by: 'system', created_at: 'x' }] })
  const r2 = await collectMarketNews(b, mk({ search: goodSearch, rawConfig: { ...RAW, max_regions: 1 } })); assert.equal(r2.added, 0); ok('duplicata system: não duplica')
}
{ // teto de sinais novos
  const a = fakeAdmin({ signals: Array.from({ length: 5 }, (_, i) => ({ company_id: 'c1', source_url: 'https://x/' + i, collected_by: 'system' })) })
  const r = await collectMarketNews(a, mk({ search: goodSearch })); assert.equal(r.searched, 0); ok('5 sinais na semana: não busca')
  const b = fakeAdmin({ signals: Array.from({ length: 4 }, (_, i) => ({ company_id: 'c1', source_url: 'https://x/' + i, collected_by: 'system' })) })
  const r2 = await collectMarketNews(b, mk({ search: goodSearch })); assert.equal(r2.added, 1); ok('4 de 5: só mais 1 entra')
}
{ // teto mensal global (de outras empresas)
  const perf = Array.from({ length: 120 }, () => ({ company_id: 'outra', task_key: 'market_news_search' }))
  const r = await collectMarketNews(fakeAdmin({ perf }), mk({ search: goodSearch })); assert.equal(r.searched, 0); ok('teto mensal global: não busca')
  const r2 = await collectMarketNews(fakeAdmin({ perf: perf.slice(0, 119) }), mk({ search: goodSearch })); assert.equal(r2.searched, 1); ok('1 vaga no mês: 1 busca')
}
{ // falha da Tavily: registra e para
  let calls = 0
  const a = fakeAdmin()
  const r = await collectMarketNews(a, mk({ search: async () => { calls++; throw new Error('Tavily 429') } }))
  assert.equal(calls, 1); assert.equal(r.added, 0); assert.equal(a.db.perfInserts.length, 1); assert.equal(a.db.perfInserts[0].success, false); assert.match(a.db.perfInserts[0].error_message, /429/); ok('Tavily 429: 1 tentativa, registra erro, para')
}
{ // sem chave, interruptor, ficha, sem região, erro de insert
  let calls = 0; const s = async () => { calls++; return [] }
  assert.match((await collectMarketNews(fakeAdmin(), mk({ search: s, getKey: async () => undefined }))).skipped, /chave/); ok('sem chave: para')
  assert.match((await collectMarketNews(fakeAdmin({ source: { enabled: false } }), mk({ search: s }))).skipped, /desligada/); ok('interruptor desligado respeitado')
  assert.equal((await collectMarketNews(fakeAdmin({ source: { enabled: true } }), mk({ search: s }))).searched, 3); ok('interruptor ligado busca')
  assert.match((await collectMarketNews(fakeAdmin(), mk({ search: s, rawConfig: undefined }))).skipped, /ficha/); ok('setor sem market_news: não roda')
  assert.match((await collectMarketNews(fakeAdmin({ items: [] }), mk({ search: s }))).skipped, /região/); ok('catálogo sem região: não busca')
  const c0 = calls
  const e = fakeAdmin({ errors: { 'agent_performance.insert': 'XX' } }); const re = await collectMarketNews(e, mk({ search: s }))
  assert.equal(calls - c0, 1); assert.match(re.skipped, /registrar/); ok('insert de agent_performance recusado: para após 1 busca')
  const ec = fakeAdmin({ errors: { 'agent_performance.count': 1 } }); assert.match((await collectMarketNews(ec, mk({ search: s }))).skipped, /contar/); ok('erro ao contar limites: não busca')
  const es = fakeAdmin({ errors: { 'market_signals.insert': '42501' } }); const rs = await collectMarketNews(es, mk({ search: goodSearch })); assert.equal(rs.added, 0); assert.match(rs.skipped, /gravar/); ok('erro de insert do sinal: loga e para')
}
{ // sem tempo no cron
  const r = await collectMarketNews(fakeAdmin(), mk({ search: goodSearch, canStart: () => false })); assert.equal(r.searched, 0); assert.match(r.skipped, /tempo/); ok('sem tempo no cron: não começa busca')
}

// --- encaixe no cron: coleta roda antes da decisão da rodada
{
  const order = []
  const table = (name, data) => { const api = { select: () => api, eq: () => api, is: () => api, not: () => api, or: () => api, order: () => api, limit: () => api, gte: () => api, maybeSingle: async () => ({ data: Array.isArray(data) ? null : data }), then: (res) => Promise.resolve({ data: Array.isArray(data) ? data : data }).then(res) }; return api }
  const admin = { from: (t) => {
    if (t === 'hermes_config') return table(t, { auto_strategy_enabled: true })
    if (t === 'companies') return table(t, [{ id: 'c1', vertical_key: 'imoveis_rio', language: 'pt' }])
    if (t === 'vertical_playbooks') return table(t, { config: { opportunity_fields: { location: 'bairro' }, market_news: RAW } })
    if (t === 'agent_performance' || t === 'market_signals') { order.push('read:' + t); return table(t, null) }
    return table(t, [])
  } }
  const seen = []
  const r = await cronOpportunities(admin, async () => ({ text: '[]', tokens: 0 }), Date.now(), undefined, async (_a, o) => { seen.push(o); order.push('collect'); return { searched: 1, added: 2 } })
  assert.equal(seen.length, 1); assert.equal(seen[0].locationKey, 'bairro'); assert.equal(seen[0].lang, 'pt'); assert.equal(typeof seen[0].canStart, 'function'); assert.equal(r.news_added, 2)
  assert.ok(order.indexOf('collect') < order.indexOf('read:market_signals')); ok('cron: coleta antes de ler o último sinal / decidir a rodada')
  const r2 = await cronOpportunities(admin, async () => ({ text: '[]', tokens: 0 }), Date.now(), undefined, async () => { throw new Error('x') }); assert.equal(r2.companies_checked, 1); ok('cron: falha da coleta não derruba a empresa')
}
console.log(`\n${n} verificações ok`)
