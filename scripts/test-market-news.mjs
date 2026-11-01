import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-market-news.mjs
// Notícias automáticas v2 (2026-11-01): filtros em código, tópicos/kind da ficha, rotação, reserva de dólar no livro-caixa,
// 1 rodada por dia, lotes de 3 em paralelo, falha da Tavily, dedupe por URL normalizada/título. Cron da coleta em test-market-intel.mjs.
import { filterHits, pickRegions, buildQuery, sanitizeText } from '../supabase/functions/_shared/marketNews.ts'
import { parseIntelConfig } from '../supabase/functions/_shared/marketIntel.ts'
import { collectMarketNews } from '../supabase/functions/_shared/marketNewsRun.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

const NOW = Date.parse('2026-11-10T12:00:00Z') // dia 10: restam 21 dias no mês
const RAW = {
  cap_usd: 5, split: { instagram: 3, news: 2 },
  news: {
    city: 'Rio de Janeiro',
    topics: [
      { kind: 'launch', query: { pt: '{region} lançamento', en: '{region} launch' } },
      { kind: 'infrastructure', query: { pt: '{region} obra', en: '{region} works' } },
      { kind: 'economy', query: { pt: 'mercado imobiliário {city}', en: '{city} market' } },
      { kind: 'tourism', query: { pt: 'turismo {city}', en: '{city} tourism' } },
      { kind: 'rental', query: 'sem variável' }, // sem {region}/{city}: ignorado
      { kind: 'inventado', query: { pt: '{region} x' } }, // kind fora do CHECK: ignorado
    ],
    exclude_domains: ['zapimoveis.com.br', 'zillow.com'], days: 30, max_regions: 3, max_results: 5, max_searches_per_day: 8, max_searches_per_month: 250, max_new_per_day: 10,
  },
}
const intel = parseIntelConfig(RAW), cfg = intel.news
const hit = (o = {}) => ({ title: 'Metrô chega a Ipanema', url: 'https://www.oglobo.globo.com/a1', content: 'Obra em Ipanema avança.', published_date: '2026-11-05T10:00:00Z', ...o })
const f = (hits, region = 'Ipanema', kind = 'infrastructure') => filterHits(hits, { region, kind, days: 30, excludeDomains: cfg.exclude_domains, nowMs: NOW })

// --- filtros
assert.equal(f([hit()]).length, 1); ok('notícia válida passa')
const s = f([hit()])[0]
assert.deepEqual([s.kind, s.region, s.source_name, s.observed_at, s.collected_by, s.meta.provider, s.meta.topic], ['infrastructure', 'Ipanema', 'oglobo.globo.com', '2026-11-05', 'system', 'tavily', 'infrastructure']); ok('campos gravados (kind do tópico, domínio, data da fonte, system)')
assert.equal(f([hit({ published_date: undefined })]).length, 0); ok('sem data: descarta')
assert.equal(f([hit({ published_date: 'ontem' })]).length, 0); ok('data inválida: descarta')
assert.equal(f([hit({ published_date: '2026-11-12T00:00:00Z' })]).length, 0); ok('data futura: descarta')
assert.equal(f([hit({ published_date: '2026-09-01T00:00:00Z' })]).length, 0); ok('data > days: descarta')
assert.equal(f([hit({ title: 'Metrô chega ao Centro', content: 'Obra no Centro.' })]).length, 0); ok('região ausente: descarta')
assert.equal(f([hit({ title: 'Obra', content: 'Em IPÂNEMA a obra avança' })], 'Ipanema').length, 1); ok('região no conteúdo, sem acento/caixa: passa')
assert.equal(f([hit({ title: 'Obra', content: 'Ipanemaville' })], 'Ipanema').length, 0); ok('região só como pedaço de outra palavra: descarta')
assert.equal(f([hit({ url: 'https://www.zapimoveis.com.br/x' })]).length, 0); ok('portal excluído: descarta')
assert.equal(f([hit({ url: 'https://sub.zillow.com/x' })]).length, 0); ok('subdomínio de portal: descarta')
assert.equal(f([hit({ url: 'http://oglobo.com/x' })]).length, 0); ok('http: descarta')
assert.equal(f([hit({ url: 'ftp://x' }), hit({ url: 'lixo' })]).length, 0); ok('url inválida: descarta')
assert.equal(f([hit(), hit()]).length, 1); ok('duplicata no mesmo lote: uma só')
assert.equal(f([hit({ url: 'https://a.com/n?utm_source=x' }), hit({ url: 'https://www.a.com/n/?utm_medium=y#top' })]).length, 1); assert.equal(f([hit({ url: 'https://a.com/n/?utm_source=x&id=3#t' })])[0].source_url, 'https://a.com/n?id=3'); ok('URL com utm_/fragmento/barra final conta como a mesma e é gravada limpa')
assert.equal(f([hit({ url: 'https://a.com/1', title: 'Metrô chega a Ipanema!' }), hit({ url: 'https://b.com/2', title: 'metro chega a ipanema' })]).length, 1); ok('mesmo título em outro portal: uma só')
const long = f([hit({ title: 'Ipanema ' + 'x'.repeat(400), content: '<b>Ipanema</b> ' + 'y'.repeat(600) + ' http://a.com' })])[0]
assert.ok(long.title.length <= 200 && long.summary.length <= 300 && !long.summary.includes('<')); ok('título ≤200, resumo ≤300 e saneado')
assert.equal(sanitizeText('a\n\tb  <i>c</i>', 50), 'a b c'); ok('sanitizeText')
assert.deepEqual(pickRegions(['Leblon', 'leblon', 'Ipanema', 'Ipanema', 'Ipanema', 'Barra', 'Méier', null, ''], 3), ['Ipanema', 'Leblon', 'Barra']); ok('regiões com mais itens, grafia exata')
assert.equal(buildQuery('{region} x {region}', 'Leblon'), 'Leblon x Leblon'); ok('buildQuery')

// --- ficha
assert.equal(parseIntelConfig({}).news, null); assert.equal(parseIntelConfig(null), null); ok('ficha sem news: sem coleta')
assert.deepEqual(cfg.topics.map(t => t.kind), ['launch', 'infrastructure', 'economy', 'tourism']); ok('tópicos: só kind permitido e com {region}/{city}')
assert.equal(parseIntelConfig({ news: { topics: RAW.news.topics, max_searches_per_day: 999, max_results: 99 } }).news.max_searches_per_day, 20); assert.equal(parseIntelConfig({ news: { topics: RAW.news.topics, max_results: 99 } }).news.max_results, 10); ok('ficha não passa dos tetos do código')

// --- I/O com banco falso
function fakeAdmin(init = {}) {
  const db = { perf: init.perf ?? [], signals: init.signals ?? [], items: init.items ?? ['Ipanema', 'Ipanema', 'Leblon', 'Barra'].map(b => ({ meta: { fields: { bairro: b } } })), source: init.source, errors: init.errors ?? {}, seq: 0 }
  const q = (table) => {
    const st = { filters: [], head: false, op: 'select', payload: null }
    const exec = () => {
      if (st.op === 'insert') {
        const row = { ...st.payload }
        if (db.errors[table + '.insert']) return { error: { message: 'boom', code: db.errors[table + '.insert'] } }
        if (table === 'agent_performance') { if (row.latency_ms == null) return { error: { message: 'null latency' } }; row.id = 'p' + (++db.seq); row.created_at = new Date(NOW).toISOString(); db.perf.push(row); return { data: { id: row.id }, error: null } }
        if (table === 'market_signals') { if (db.signals.some(s => s.company_id === row.company_id && s.source_url === row.source_url && s.collected_by === 'system')) return { error: { message: 'dup', code: '23505' } }; row.created_at = new Date(NOW).toISOString(); db.signals.push(row) }
        return { error: null }
      }
      if (st.op === 'update') {
        if (db.errors[table + '.update']) return { error: { message: 'upd' } }
        for (const r of db.perf.filter(r => st.filters.every(fn => fn(r)))) Object.assign(r, st.payload)
        return { error: null }
      }
      const rows = table === 'agent_performance' ? db.perf : table === 'market_signals' ? db.signals : table === 'marketing_ai_knowledge' ? db.items : []
      const m = table === 'marketing_ai_knowledge' ? rows : rows.filter(r => st.filters.every(fn => fn(r)))
      return st.head ? { count: m.length, error: db.errors[table + '.count'] ? { message: 'x' } : null } : { data: m, error: db.errors[table + '.read'] ? { message: 'r' } : null }
    }
    const api = {
      select: (_c, o) => { st.head = !!o?.head; return api },
      eq: (c, v) => { st.filters.push((r) => r[c] === v); return api },
      gte: (c, v) => { st.filters.push((r) => r[c] === undefined || r[c] >= v); return api },
      in: (c, v) => { st.filters.push((r) => v.includes(r[c])); return api },
      limit: () => api,
      order: () => api,
      maybeSingle: async () => ({ data: table === 'insight_sources' ? db.source ?? null : null, error: null }),
      insert: (row) => { st.op = 'insert'; st.payload = row; return api },
      update: (row) => { st.op = 'update'; st.payload = row; return api },
      single: async () => exec(),
      then: (res) => Promise.resolve(exec()).then(res),
    }
    return api
  }
  return { from: q, db }
}
const mk = (o) => ({ companyId: 'c1', lang: 'pt', rawConfig: RAW, locationKey: 'bairro', getKey: async () => 'k', nowMs: NOW, capUsd: 5, costUsd: 0.008, ...o })
const goodSearch = async (_k, query) => [hit({ title: query, url: `https://news.com/${encodeURIComponent(query)}?utm_source=t`, content: query })]

{ // caminho feliz: orçamento 2 ÷ 21 dias ÷ 0,008 = 11 → teto da ficha 8; 8 unidades (2 tópicos × 3 regiões + 2 de cidade)
  let live = 0, peak = 0; const queries = []
  const a = fakeAdmin()
  const r = await collectMarketNews(a, mk({ search: async (k, q, c, t) => { queries.push(q); assert.equal(t, 12_000); live++; peak = Math.max(peak, live); await new Promise(r => setTimeout(r, 5)); live--; return goodSearch(k, q) } }))
  assert.equal(r.searched, 8); assert.equal(r.added, 8); assert.equal(peak, 3); ok('8 buscas em lotes de 3 em paralelo, 8 sinais')
  assert.ok(a.db.perf.every(p => p.task_key === 'market_news_search' && p.agent_role === 'cmo' && p.cost_usd === 0.008 && p.success === true && typeof p.latency_ms === 'number')); assert.equal(a.db.perf.length, 8); ok('cada busca = 1 linha no livro-caixa com cost_usd')
  assert.ok(Math.abs(r.spent_usd - 0.064) < 1e-9); ok('spent_usd da rodada')
  assert.deepEqual([...new Set(a.db.signals.map(s => s.kind))].sort(), ['economy', 'infrastructure', 'launch', 'tourism']); ok('kind do sinal vem do tópico')
  assert.ok(a.db.signals.every(s => s.collected_by === 'system' && !/utm_/.test(s.source_url))); ok('sinais system, URL sem utm_')
  assert.ok(queries.some(q => q === 'mercado imobiliário Rio de Janeiro') && queries.some(q => q === 'Ipanema lançamento')); ok('{city} e {region} substituídos')
  const again = await collectMarketNews(a, mk({ search: goodSearch })); assert.equal(again.searched, 0); assert.match(again.skipped, /hoje/); ok('segunda chamada no mesmo dia: nada')
  const tomorrow = await collectMarketNews(a, mk({ search: goodSearch, nowMs: NOW + 86400_000 })); assert.ok(tomorrow.searched > 0); ok('no dia seguinte coleta de novo')
}
{ // rotação: dia seguinte começa em outra unidade
  const first = [], second = []
  await collectMarketNews(fakeAdmin(), mk({ rawConfig: { ...RAW, news: { ...RAW.news, max_searches_per_day: 3 } }, search: async (_k, q) => { first.push(q); return [] } }))
  await collectMarketNews(fakeAdmin(), mk({ nowMs: NOW + 86400_000, rawConfig: { ...RAW, news: { ...RAW.news, max_searches_per_day: 3 } }, search: async (_k, q) => { second.push(q); return [] } }))
  assert.equal(first.length, 3); assert.notDeepEqual(first, second); ok('rotação: dias diferentes buscam unidades diferentes')
}
{ // dedupe contra o que já existe (URL normalizada e título)
  const a = fakeAdmin({ signals: [{ company_id: 'c1', source_url: 'https://news.com/x', title: 'Outra coisa', collected_by: 'manual', created_at: new Date(NOW).toISOString() }, { company_id: 'c1', source_url: 'https://z.com/z', title: 'Obra em Ipanema!', collected_by: 'system', created_at: new Date(NOW).toISOString() }] })
  const r = await collectMarketNews(a, mk({ rawConfig: { ...RAW, news: { ...RAW.news, max_searches_per_day: 1 } }, search: async () => [hit({ url: 'https://www.news.com/x/?utm_source=a', title: 'Ipanema nova', content: 'Ipanema' }), hit({ url: 'https://q.com/q', title: 'obra em ipanema', content: 'Ipanema' })] }))
  assert.equal(r.added, 0); ok('link já existente (normalizado) e título repetido: não duplica')
}
{ // teto de sinais novos por dia
  const signals = Array.from({ length: 10 }, (_, i) => ({ company_id: 'c1', source_url: 'https://x/' + i, title: 't' + i, collected_by: 'system', created_at: new Date(NOW).toISOString() }))
  assert.equal((await collectMarketNews(fakeAdmin({ signals }), mk({ search: goodSearch }))).searched, 0); ok('10 sinais hoje: não busca')
  const r = await collectMarketNews(fakeAdmin({ signals: signals.slice(0, 7) }), mk({ search: goodSearch })); assert.equal(r.added, 3); ok('7 de 10: só mais 3 entram')
}
{ // orçamento em dólar
  const old = (usd, key = 'market_news_search', c = 'c1') => ({ company_id: c, task_key: key, cost_usd: usd, created_at: '2026-11-03T10:00:00.000Z' })
  assert.match((await collectMarketNews(fakeAdmin({ perf: [old(1.99)] }), mk({ search: goodSearch }))).skipped, /orçamento/); ok('fatia de notícias quase toda gasta: não busca')
  const r1 = await collectMarketNews(fakeAdmin({ perf: [old(1.0)] }), mk({ search: goodSearch })); assert.equal(r1.searched, 5); ok('sobra US$ 1,00 ÷ 21 dias ÷ 0,008 = 5 buscas hoje')
  const r2 = await collectMarketNews(fakeAdmin({ perf: [old(4.5, 'market_intel_apify')] }), mk({ search: goodSearch })); assert.equal(r2.searched, 2); ok('Apify gastou 4,50 do teto de 5: notícias só ganha o que sobra (0,50 → 2 buscas)')
  const r3 = await collectMarketNews(fakeAdmin({ perf: [old(5, 'market_intel_apify')] }), mk({ search: goodSearch })); assert.equal(r3.searched, 0); ok('teto total gasto: não busca')
  const r4 = await collectMarketNews(fakeAdmin({ perf: [old(1.5, 'market_news_search', 'outra')] }), mk({ search: goodSearch })); assert.equal(r4.searched, 8); ok('gasto de outra empresa não conta')
  const r5 = await collectMarketNews(fakeAdmin({ perf: Array.from({ length: 250 }, () => old(0)) }), mk({ search: goodSearch })); assert.equal(r5.searched, 0); ok('contador mensal por empresa (ficha): 250 buscas = para')
  const r6 = await collectMarketNews(fakeAdmin(), mk({ search: goodSearch, capUsd: 0.01 })); assert.equal(r6.searched, 0); ok('teto menor que 1 busca: não busca')
}
{ // teto geral dos US$ 40
  let calls = 0
  const r = await collectMarketNews(fakeAdmin(), mk({ search: async () => { calls++; return [] }, fitsTotalCap: async () => false })); assert.equal(calls, 0); assert.match(r.skipped, /teto geral/); ok('teto geral cheio: não busca')
  const r2 = await collectMarketNews(fakeAdmin(), mk({ search: async () => { calls++; return [] }, fitsTotalCap: async () => { throw new Error('x') } })); assert.equal(calls, 0); ok('erro ao conferir o teto geral: não busca (falha fechada)')
}
{ // falha da Tavily: ajusta o custo, registra e para
  let calls = 0
  const a = fakeAdmin()
  const r = await collectMarketNews(a, mk({ search: async () => { calls++; throw Object.assign(new Error('Tavily 429'), { uncharged: true }) } }))
  assert.equal(calls, 3); assert.equal(r.added, 0); assert.equal(a.db.perf.length, 3); assert.ok(a.db.perf.every(p => p.success === false && /429/.test(p.error_message) && p.cost_usd === 0)); assert.match(r.skipped, /falha/); ok('Tavily 429: só o 1º lote (3), custo ajustado a 0, para')
  const b = fakeAdmin(); await collectMarketNews(b, mk({ search: async () => { throw new Error('timeout') } })); assert.ok(b.db.perf.every(p => p.cost_usd === 0.008 && p.success === false)); ok('timeout/queda: pode ter sido cobrado, reserva fica')
}
{ // sem chave, interruptor, ficha, sem região, erros de banco
  let calls = 0; const s = async () => { calls++; return [] }
  assert.match((await collectMarketNews(fakeAdmin(), mk({ search: s, getKey: async () => undefined }))).skipped, /chave/); ok('sem chave: para')
  assert.match((await collectMarketNews(fakeAdmin({ source: { enabled: false } }), mk({ search: s }))).skipped, /desligada/); ok('interruptor desligado respeitado')
  assert.equal((await collectMarketNews(fakeAdmin({ source: { enabled: true } }), mk({ search: s }))).searched, 8); ok('interruptor ligado busca')
  assert.match((await collectMarketNews(fakeAdmin(), mk({ search: s, rawConfig: undefined }))).skipped, /ficha/); ok('setor sem market_intel: não roda')
  assert.match((await collectMarketNews(fakeAdmin({ items: [] }), mk({ search: s }))).skipped, /região/); ok('catálogo sem região: não busca')
  const c0 = calls
  const e = fakeAdmin({ errors: { 'agent_performance.insert': 'XX' } }); const re = await collectMarketNews(e, mk({ search: s }))
  assert.equal(calls, c0); assert.match(re.skipped, /registrar/); ok('reserva recusada pelo banco: NÃO busca')
  assert.match((await collectMarketNews(fakeAdmin({ errors: { 'agent_performance.read': 1 } }), mk({ search: s }))).skipped, /ler limites/); ok('erro ao ler o livro-caixa: não busca')
  const up = fakeAdmin({ errors: { 'agent_performance.update': 1 } }); const ru = await collectMarketNews(up, mk({ search: s })); assert.equal(ru.searched, 8); assert.ok(up.db.perf.every(p => p.cost_usd === 0.008)); ok('ajuste falhou: a reserva inteira continua contando')
  const es = fakeAdmin({ errors: { 'market_signals.insert': '42501' } }); const rs = await collectMarketNews(es, mk({ search: goodSearch })); assert.equal(rs.added, 0); assert.match(rs.skipped, /gravar/); ok('erro de insert do sinal: loga e para')
}
{ // sem tempo no cron
  const r = await collectMarketNews(fakeAdmin(), mk({ search: goodSearch, canStart: () => false })); assert.equal(r.searched, 0); assert.match(r.skipped, /tempo/); ok('sem tempo no cron: não começa lote')
}
console.log(`\n${n} verificações ok`)
