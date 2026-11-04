import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-market-news.mjs
// Notícias automáticas v2 (2026-11-01): filtros em código, tópicos/kind da ficha, rotação, reserva de dólar no livro-caixa,
// 1 rodada por dia, lotes de 3 em paralelo, falha da Tavily, dedupe por URL normalizada/título. Cron da coleta em test-market-intel.mjs.
import { readFileSync } from 'node:fs'
import { filterHits, filterHitsReport, classifySignalQuality, hasTerm, pickRegions, buildQuery, sanitizeText } from '../supabase/functions/_shared/marketNews.ts'
import { parseIntelConfig, parseQuality } from '../supabase/functions/_shared/marketIntel.ts'
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
// --- Fase 2: filtro de qualidade da ficha (regras REAIS da migration 20261104120000, amostras medidas em 04/11/2026 na Tespon + Teste Zero)
const sql = readFileSync(new URL('../supabase/migrations/20261104120000_market_intel_quality.sql', import.meta.url), 'utf8')
const QJSON = JSON.parse(/\$json\$([\s\S]*?)\$json\$/.exec(sql)[1])
const QE = parseQuality({ ...QJSON, mode: 'enforce' }), QA = parseQuality(QJSON)
assert.equal(QA.mode, 'audit'); assert.equal(QA.version, 1); assert.equal(QE.trusted_domains.length, 6); assert.equal(QE.block_title_all.length, QJSON.block_title_all.length); assert.deepEqual(Object.keys(QE.kind_terms).sort(), ['economy', 'infrastructure', 'tourism']); ok('ficha da migration: JSON válido, modo inicial audit, parseQuality mantém todas as regras')
assert.ok(!/\bdrop\b/i.test(sql.split('\n').filter(l => !l.trimStart().startsWith('--')).join('\n'))); ok('migration da ficha sem "drop" fora de comentário')
const run = readFileSync(new URL('../supabase/migrations/20261104110000_market_intel_runs.sql', import.meta.url), 'utf8')
assert.ok(!/\bdrop\b/i.test(run.split('\n').filter(l => !l.trimStart().startsWith('--')).join('\n')) && /enable row level security/.test(run) && /if not exists \(select 1 from pg_policies/.test(run)); ok('migration da tabela: RLS ligada, policy em bloco condicional, sem "drop" fora de comentário')
assert.deepEqual(parseQuality(undefined), parseQuality({})); assert.equal(parseQuality({ mode: 'xxx' }).mode, 'off'); assert.equal(parseQuality({ mode: 'enforce', min_score: 7 }).min_score, null); assert.equal(parseQuality({ mode: 'enforce', trusted_domains: ['lixo', 'ok.com'] }).trusted_domains.length, 1); assert.deepEqual(parseQuality({ mode: 'audit', block_title_all: [['a'], ['a', 'b']] }).block_title_all, [['a', 'b']]); assert.equal(parseIntelConfig({ news: { topics: RAW.news.topics } }).news.quality.mode, 'off'); ok('parseQuality: lixo = desligado; nota fora de 0-1, domínio inválido e grupo de 1 termo são descartados')
assert.ok(hasTerm('m² privativos', 'm² privativos') && hasTerm('435m² com 4', 'm²') && !hasTerm('cada venda', 'a venda') && hasTerm('x a venda y', 'a venda') && !hasTerm('km2', 'm2') && hasTerm('ocupacao hoteleira', 'hotel', true) && !hasTerm('ocupacao hoteleira', 'hotel') && !hasTerm('chotel', 'hotel', true)); ok('termo: borda de palavra só nas letras (dígito colado casa; "cada venda" não casa "a venda"); termo de tipo casa o começo da palavra ("hotel" casa "hoteleira")')

const q = (kind, title, url, content = 'Texto da fonte com mais de quarenta caracteres para passar o mínimo do resumo.') => classifySignalQuality({ kind, title, summary: content, source_url: url }, QE)
const BAD = [ // [motivo esperado, tipo, título, url]
  ['block_title', 'launch', 'Apartamento para venda com 4 quartos em Ipanema com varanda', 'https://www.twoimoveis.com.br/ipanema-4q'],
  ['block_title', 'launch', 'Apartamento Ipanema 74m2 | totalmente reformado', 'https://www.kaselle.com.br/ipanema-74'],
  ['block_title', 'launch', 'Flat para venda - Leblon - RJ', 'https://www.podiumimoveis.com.br/flat-leblon'],
  ['block_title', 'launch', 'Apartamento com 112,00 m² privativos, 3 quartos', 'https://www.porta8.com.br/ap-112'],
  ['block_title', 'launch', 'Riserva Uno Barra da Tijuca - 435m² com 4 suítes', 'https://www.lancamentosrj.com.br/riserva'],
  ['block_title', 'launch', '8 Imóveis encontrados Ipanema', 'https://www.robertoalmeidaimoveis.com.br/busca'],
  ['block_title', 'launch', 'Imóveis encontrados - Casapē', 'https://www.casapeimoveis.com.br/busca'],
  ['block_title', 'launch', 'Imóveis em Barra da Tijuca | Lançamentos RJ', 'https://www.lancamentos-rj.com.br/barra'],
  ['block_title', 'launch', 'Arc Ipanema - Ipanema, Rio de Janeiro | Apto', 'https://www.novosimoveisrio.com.br/arc'],
  ['block_title', 'launch', 'Tudo sobre o Bairro Ipanema', 'https://www.vgimobiliaria.com.br/bairro'],
  ['block_title', 'infrastructure', 'Apartamento de 121 m² no Leblon à venda', 'https://www.evandroimoveisrj.com.br/ap-121'], // tipo errado + anúncio
  ['block_title', 'infrastructure', 'Como chegar até Ipanema', 'https://moovitapp.com/rio/ipanema'],
  ['block_title', 'economy', 'Vaga de Emprego em Ipanema', 'https://www.catho.com.br/vaga/1'],
  ['block_title', 'tourism', 'Termos de Uso', 'https://www.ladorio.com.br/institucional'],
  ['block_title', 'tourism', 'Descubra a magia do Rio de Janeiro', 'https://visitrio.com.br/'],
  ['block_url', 'launch', 'Cobertura Leblon vista mar', 'https://www.suacasadigital.com.br/imovel/cobertura-leblon-123'],
  ['block_url', 'launch', 'Condomínio Ipanema novidades', 'https://www.miguezimobiliaria.com.br/imoveis/rj/ipanema'],
  ['block_url', 'tourism', 'Regras do site', 'https://www.ladorio.com.br/termos-de-uso'],
]
for (const [why, kind, title, url] of BAD) assert.equal(q(kind, title, url), why, `${title} -> esperado ${why}`)
ok(`${BAD.length} amostras ruins medidas (anúncios avulsos, páginas sem valor, tipo errado) reprovam com o motivo certo`)
assert.equal(q('infrastructure', 'Passeio de domingo em Ipanema', 'https://www.blogxyz.com.br/passeio'), 'kind_mismatch'); ok('tipo incoerente com o texto: kind_mismatch')
assert.equal(q('economy', 'Mercado em Ipanema', 'https://www.blogxyz.com.br/a', 'curto'), 'short_summary'); ok('resumo curto: short_summary')
assert.equal(q('launch', 'Lançamento em Ipanema', 'https://www.blogxyz.com.br/a'), 'ok'); assert.equal(q('news', 'Qualquer coisa em Ipanema', 'https://www.blogxyz.com.br/b'), 'ok'); ok('tipo sem lista na ficha fica livre')
const GOOD = [ // [tipo, título, url] — títulos reais medidos onde houve; os demais são sintéticos, só para o domínio
  ['infrastructure', 'Metrô da Gávea tem obras retomadas', 'https://oglobo.globo.com/rio/metro-gavea'],
  ['economy', 'Aluguel sobe acima da inflação', 'https://www1.folha.uol.com.br/mercado/aluguel'],
  ['infrastructure', 'Nova estação do metrô avança em Ipanema', 'https://www.metrocptm.com.br/noticia/1'],
  ['tourism', 'Ocupação hoteleira cresce no Rio', 'https://www.abihrj.com.br/noticia/1'],
  ['tourism', 'Réveillon do Rio terá novo esquema de turismo', 'https://riotur.rio/noticia/1'],
  ['tourism', 'Panorama do turismo no Rio', 'https://www.panrotas.com.br/noticia/1'],
  ['tourism', 'Eventos movimentam hotéis do Rio', 'https://www.mercadoeeventos.com.br/noticia/1'],
  ['economy', 'Mercado imobiliário do Rio em ritmo de alta', 'https://monitormercantil.com.br/noticia/1'],
  ['tourism', 'Turismo no Rio: balanço do verão', 'https://vejario.abril.com.br/noticia/1'],
  ['infrastructure', 'Obras de transporte mudam o trânsito do Rio', 'https://www.terra.com.br/noticias/rio/obras'],
  ['economy', 'Carta ao mercado: juros e financiamento no Rio', 'https://www.maisvelozimoveis.com.br/carta-ao-mercado'],
  ['infrastructure', 'Bairros do Rio com Melhor Mobilidade', 'https://www.enjoyimoveis.com.br/blog/mobilidade'],
]
for (const [kind, title, url] of GOOD) assert.equal(q(kind, title, url), 'ok', title)
ok(`${GOOD.length} amostras boas (oglobo, folha, metrô CPTM, ABIH, Riotur, Panrotas, Mercado&Eventos, Monitor, Veja Rio, Terra, mais veloz, borderline enjoy) passam`)
assert.equal(q('launch', 'Apartamento para venda em Ipanema', 'https://oglobo.globo.com/imovel/x'), 'ok'); assert.equal(q('launch', 'Apartamento para venda em Ipanema', 'https://www1.folha.uol.com.br/imoveis/x', 'x'), 'ok'); ok('domínio de confiança (inclusive subdomínio www1) passa mesmo com termo/URL de bloqueio')
assert.equal(classifySignalQuality({ kind: 'launch', title: 'Flat para venda', summary: null, source_url: 'https://a.com/x' }, { ...QE, mode: 'off' }), 'ok'); ok('modo off nunca reprova')
assert.equal(classifySignalQuality({ kind: 'launch', title: 'Lançamento em Ipanema', summary: 'Texto da fonte com mais de quarenta caracteres para passar o mínimo.', source_url: 'https://a.com/x', score: 0.2 }, { ...QE, min_score: 0.5 }), 'low_score'); assert.equal(classifySignalQuality({ kind: 'launch', title: 'Lançamento em Ipanema', summary: 'Texto da fonte com mais de quarenta caracteres para passar o mínimo.', source_url: 'https://a.com/x', score: null }, { ...QE, min_score: 0.5 }), 'ok'); ok('min_score: nota baixa reprova; nota desconhecida não')

{ // filterHitsReport: enforce x audit x off, contagem por motivo, amostras, limite por site
  const long = 'Conteúdo da fonte sobre Ipanema com mais de quarenta caracteres para passar o mínimo do resumo.'
  const hits = [
    hit({ title: 'Metrô de Ipanema ganha obras', url: 'https://oglobo.globo.com/a', content: long, score: 0.91 }),
    hit({ title: 'Flat para venda - Ipanema - RJ', url: 'https://www.kaselle.com.br/f', content: long }),
    hit({ title: 'Como chegar até Ipanema', url: 'https://moovitapp.com/x', content: long }),
    hit({ title: 'Ipanema na Wikipédia', url: 'https://en.wikipedia.org/wiki/Ipanema', content: long }),
    hit({ title: 'Obras em Ipanema (sem data)', url: 'https://x.com/s', content: long, published_date: undefined }),
    hit({ title: 'Obras no Centro (sem região)', url: 'https://x.com/t', content: long.replace('Ipanema', 'Centro') }),
    hit({ title: 'Obras de drenagem em Ipanema', url: 'https://blog.com/1', content: long }),
    hit({ title: 'Obras de calçada em Ipanema', url: 'https://blog.com/2', content: long }),
    hit({ title: 'Obras de ciclovia em Ipanema', url: 'https://blog.com/3', content: long }),
  ]
  const base = { region: 'Ipanema', kind: 'infrastructure', days: 30, excludeDomains: [...cfg.exclude_domains, 'moovitapp.com', 'wikipedia.org'], nowMs: NOW }
  const enf = filterHitsReport(hits, { ...base, quality: QE })
  assert.deepEqual(enf.signals.map(x => x.source_url), ['https://oglobo.globo.com/a', 'https://blog.com/1', 'https://blog.com/2'])
  assert.deepEqual(enf.rejected, { excluded_domain: 2, no_date: 1, no_region: 1, block_title: 1, host_cap: 1 }); assert.deepEqual(enf.flagged, {}); assert.equal(enf.samples.length, 5); assert.ok(enf.samples.every(x => x.title && x.reason)); ok('enforce: reprova de verdade, conta por motivo (inclui os filtros antigos), ≤5 amostras, máx. 2 por site')
  assert.deepEqual([enf.signals[0].meta.quality_v, enf.signals[0].meta.quality_ok, enf.signals[0].meta.score], [1, true, 0.91]); assert.equal(enf.signals[1].meta.score, null); ok('novos sinais gravam meta.score, meta.quality_v e meta.quality_ok')
  const aud = filterHitsReport(hits, { ...base, quality: QA })
  assert.equal(aud.signals.length, 5); assert.deepEqual(aud.flagged, { block_title: 1, host_cap: 1 }); assert.deepEqual(aud.signals.filter(x => x.meta.quality_ok === false).map(x => x.title), ['Flat para venda - Ipanema - RJ', 'Obras de ciclovia em Ipanema']); ok('audit: nada some; o que reprovaria vai para flagged e quality_ok=false')
  const off = filterHitsReport(hits, { ...base, quality: undefined })
  assert.equal(off.signals.length, 5); assert.ok(off.signals.every(x => x.meta.quality_v === undefined && x.meta.quality_ok === undefined)); assert.deepEqual(filterHits(hits, base).map(x => x.title), off.signals.map(x => x.title)); ok('off / sem ficha: igual ao comportamento antigo (wrapper filterHits), sem carimbo de qualidade')
}
{ // coleta de verdade com qualidade: reprovados não são gravados e a rodada devolve a estatística
  const cfgQ = { ...RAW, news: { ...RAW.news, quality: { ...QJSON, mode: 'enforce' }, max_searches_per_day: 2 } }
  const a = fakeAdmin()
  const bad = async (_k, query) => [hit({ title: 'Flat para venda - ' + query, url: 'https://www.kaselle.com.br/' + encodeURIComponent(query), content: query + ' ' + 'x'.repeat(60) }), hit({ title: query + ' obra metrô', url: 'https://oglobo.globo.com/' + encodeURIComponent(query), content: query + ' ' + 'y'.repeat(60) })]
  const r = await collectMarketNews(a, mk({ rawConfig: cfgQ, search: bad }))
  assert.equal(r.searched, 2); assert.equal(r.collected, 4); assert.equal(r.filtered, 2); assert.equal(r.added, 2); assert.equal(r.details.rejected.block_title, 2); assert.equal(r.details.quality_mode, 'enforce'); assert.ok(a.db.signals.every(x => x.source_name === 'oglobo.globo.com' && x.meta.quality_ok === true)); assert.ok(Math.abs(r.month_spent_usd - 0.016) < 1e-9); ok('coleta em enforce: anúncio não é gravado; rodada devolve collected/filtered/accepted, motivos e acumulado do mês')
  const none = await collectMarketNews(fakeAdmin(), mk({ search: goodSearch, canStart: () => false })); assert.equal(none.collected, undefined); assert.equal(none.details, undefined); ok('rodada sem busca: nada medido (undefined, não 0)')
}

console.log(`\n${n} verificações ok`)
