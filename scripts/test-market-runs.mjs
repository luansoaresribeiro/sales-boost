import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-market-runs.mjs
// Inteligência de Mercado, Fase 2 (2026-11-04): reclassificação dos sinais já gravados, registro por rodada (market_intel_runs),
// "não reinterpretar sem mudança" (impressão digital), cron e a parte pura da tela ("o que mudou", ignorado pelo sistema x por você).
// As regras de qualidade são as REAIS da ficha (migration 20261104120000). Filtro/amostras em test-market-news.mjs.
globalThis.Deno = { env: { get: () => undefined } }
import { readFileSync } from 'node:fs'
import { parseQuality } from '../supabase/functions/_shared/marketIntel.ts'
import { recordRun, reclassifySignals, sameAsLastReclassify, needsReclassify, interpretFingerprint, fingerprintPayload } from '../supabase/functions/_shared/marketIntelRuns.ts'
import { cronMarketIntel } from '../supabase/functions/_shared/marketIntelCron.ts'
import { runOpportunities } from '../supabase/functions/_shared/opportunityRun.ts'
import { buildCandidates } from '../supabase/functions/_shared/opportunityEngine.ts'
import { OPP_PROMPT_VERSION, compareScored, score, MAX_CANDIDATES_TO_LLM } from '../supabase/functions/_shared/opportunityOutput.ts'
import { mergeIgnoredMeta, ignoredNote, ignoredBySystem, isIgnored, reasonLabel } from '../src/pages/dashboard/marketingAi/signalMeta.ts'
import { deriveChanges, describeChanges, ignoredLine, demoChanges, changesText } from '../src/pages/dashboard/marketingAi/marketChanges.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

const sql = readFileSync(new URL('../supabase/migrations/20261104120000_market_intel_quality.sql', import.meta.url), 'utf8')
const QJSON = JSON.parse(/\$json\$([\s\S]*?)\$json\$/.exec(sql)[1])
const QE = parseQuality({ ...QJSON, mode: 'enforce' }), QA = parseQuality(QJSON)

// ---------- banco falso genérico: qualquer encadeamento; guarda inserts/updates
function fake(tables = {}, opts = {}) {
  const inserts = {}, updates = []
  const from = (t) => {
    const st = { op: 'select', payload: null, id: null }
    const api = new Proxy({}, { get: (_o, k) => {
      if (k === 'then') return (res) => { if (st.op === 'insert') { if (opts.insertError?.[t]) return Promise.resolve({ error: { message: 'boom' } }).then(res); (inserts[t] ??= []).push(st.payload); return Promise.resolve({ error: null }).then(res) }
        if (st.op === 'update') { if (opts.updateError) return Promise.resolve({ error: { message: 'upd' } }).then(res); updates.push({ table: t, id: st.id, payload: st.payload }); return Promise.resolve({ error: null }).then(res) }
        return Promise.resolve({ data: tables[t] ?? [], error: opts.readError?.[t] ? { message: 'x' } : null }).then(res) }
      if (k === 'insert') return (p) => { st.op = 'insert'; st.payload = p; return api }
      if (k === 'update') return (p) => { st.op = 'update'; st.payload = p; return api }
      if (k === 'eq') return (c, v) => { if (c === 'id') st.id = v; return api }
      if (k === 'maybeSingle') return async () => { const d = tables[t]; return { data: Array.isArray(d) ? d[0] ?? null : d ?? null, error: opts.readError?.[t] ? { message: 'x' } : null } }
      return () => api
    } })
    return api
  }
  return { from, inserts, updates }
}

// ---------- recordRun: nunca derruba; nulo = não medido
{
  const a = fake()
  assert.equal(await recordRun(a, 'c1', 'collect', { searched: 3, collected: 12, filtered: 8, accepted: 4, cost_usd: 0.024, month_cost_usd: 0.5 }), true)
  const row = a.inserts.market_intel_runs[0]
  assert.deepEqual([row.company_id, row.phase, row.searched, row.collected, row.filtered, row.accepted, row.cost_usd, row.month_cost_usd, row.unchanged], ['c1', 'collect', 3, 12, 8, 4, 0.024, 0.5, false]); assert.equal(row.tokens, null); assert.equal(row.interpreted, null); assert.equal(row.fingerprint, null); ok('recordRun grava a linha; o que não foi medido fica null (nunca 0)')
  await recordRun(a, 'c1', 'collect', { collected: undefined, filtered: -1, accepted: NaN, cost_usd: Infinity }); const r2 = a.inserts.market_intel_runs[1]; assert.deepEqual([r2.collected, r2.filtered, r2.accepted, r2.cost_usd], [null, null, null, null]); ok('valor ausente, negativo, NaN ou infinito vira null')
  assert.equal(await recordRun(fake({}, { insertError: { market_intel_runs: 1 } }), 'c1', 'interpret', {}), false); assert.equal(await recordRun({ from: () => { throw new Error('tabela não existe') } }, 'c1', 'interpret', {}), false); ok('erro do banco ou exceção: devolve false, não lança')
}

// ---------- reclassificação
const sig = (id, title, url, meta = {}, over = {}) => ({ id, kind: 'launch', title, summary: 'Texto da fonte com mais de quarenta caracteres para passar o mínimo.', source_url: url, source_name: 'x', meta: { provider: 'tavily', ...meta }, ...over })
const AD = (id, meta) => sig(id, 'Flat para venda - Leblon - RJ', 'https://www.podiumimoveis.com.br/f' + id, meta)
const NEWS = (id, meta) => sig(id, 'Lançamento anunciado em Ipanema', 'https://www.blogxyz.com.br/n' + id, meta)
{
  assert.equal(needsReclassify({}, QE), true); assert.equal(needsReclassify({ quality_v: 0 }, QE), true); assert.equal(needsReclassify({ quality_v: 1, quality_ok: true }, QE), false); assert.equal(needsReclassify({ quality_v: 2, quality_ok: true }, parseQuality({ ...QJSON, mode: 'enforce', version: 3 })), true)
  assert.equal(needsReclassify({ quality_v: 1, quality_ok: false }, QE), true); assert.equal(needsReclassify({ quality_v: 1, quality_ok: false }, QA), false); assert.equal(needsReclassify({ owner_restored: true }, QE), false); assert.equal(needsReclassify({ owner_restored: true, quality_v: 0 }, QE), false); ok('quem precisa de nova avaliação: sem carimbo / versão menor / (enforce) marcado ruim no audit; nunca o que o dono restaurou')
  const a = fake({ market_signals: [AD('s1'), NEWS('s2'), AD('s3', { owner_restored: true }), AD('s4', { quality_v: 1, quality_ok: true })] })
  const r = await reclassifySignals(a, 'c1', QE)
  assert.deepEqual([r.examined, r.passed, r.failed, r.ignored], [2, 1, 1, 1]); assert.deepEqual(r.reasons, { block_title: 1 }); assert.equal(r.samples.length, 1)
  const bad = a.updates.find(u => u.id === 's1').payload.meta, good = a.updates.find(u => u.id === 's2').payload.meta
  assert.deepEqual([bad.ignored, bad.ignored_by, bad.ignored_reason, bad.quality_v, bad.quality_ok, bad.provider], [true, 'system', 'block_title', 1, false, 'tavily']); assert.ok(/^\d{4}-\d\d-\d\dT/.test(bad.ignored_at)); assert.deepEqual([good.quality_v, good.quality_ok, good.ignored], [1, true, undefined]); assert.equal(a.updates.length, 2); ok('enforce: reprovado ganha ignored/ignored_by:system/motivo/quality_v mesclado à meta (nada apagado); aprovado só é carimbado; restaurado pelo dono e já carimbado não são tocados')
  const au = fake({ market_signals: [AD('s1'), NEWS('s2')] }); const ra = await reclassifySignals(au, 'c1', QA)
  assert.deepEqual([ra.examined, ra.failed, ra.ignored, au.updates.length], [2, 1, 0, 0]); ok('audit: só conta e registra; não escreve nada no sinal')
  const off = fake({ market_signals: [AD('s1')] }); assert.equal((await reclassifySignals(off, 'c1', { ...QE, mode: 'off' })).examined, 0); assert.equal(off.updates.length, 0); ok('off: não olha nada')
  const many = fake({ market_signals: Array.from({ length: 400 }, (_, i) => NEWS('m' + i)) }); const rm = await reclassifySignals(many, 'c1', QE); assert.equal(rm.examined, 150); assert.equal(many.updates.length, 150); ok('no máx. 150 sinais por empresa por chamada')
  let t = 0; const slow = fake({ market_signals: Array.from({ length: 50 }, (_, i) => NEWS('t' + i)) }); const rs = await reclassifySignals(slow, 'c1', QE, { started: 0, untilMs: 40_000, now: () => (t += 4_000) }); assert.equal(rs.partial, true); assert.ok(rs.examined < 50 && rs.examined > 0); ok('guarda de 40 s: para no meio e avisa partial')
  assert.match((await reclassifySignals(fake({}, { readError: { market_signals: 1 } }), 'c1', QE)).error, /x/); const ru = await reclassifySignals(fake({ market_signals: [AD('s1'), AD('s2')] }, { updateError: true }), 'c1', QE); assert.ok(ru.error && ru.ignored === 0); ok('erro de leitura/escrita: devolve error, não lança, não conta como ignorado')
  assert.equal(await reclassifySignals(fake({ market_signals: [] }), 'c1', QE).then(x => x.examined), 0); ok('nada para avaliar: 0')
}

// ---------- cron: reclassifica antes de coletar; registra; falha de registro/reclassificação nunca derruba a coleta
{
  const mkCron = () => {
    const log = []
    const tbl = (t) => { const api = { select: () => api, eq: () => api, limit: () => api, maybeSingle: async () => ({ data: t === 'hermes_config' ? { auto_strategy_enabled: true } : t === 'vertical_playbooks' ? { config: CFG } : null }), then: (res) => Promise.resolve({ data: t === 'companies' ? [{ id: 'c1', vertical_key: 'imoveis_rio', language: 'pt' }] : [] }).then(res) }; return api }
    return { log, admin: { from: tbl } }
  }
  const CFG = { opportunity_fields: { location: 'bairro' }, market_intel: { news: { topics: [{ kind: 'launch', query: '{region} x' }], quality: { ...QJSON, mode: 'enforce' } } } }
  const order = [], recs = []
  const deps = { reclassify: async (_a, id, q) => { order.push('reclassify:' + q.mode); return { mode: q.mode, version: 1, examined: 7, passed: 4, failed: 3, ignored: 3, reasons: { block_title: 3 }, samples: [], partial: false } },
    collect: async () => { order.push('collect'); return { searched: 4, added: 2, spent_usd: 0.032, collected: 20, filtered: 9, month_spent_usd: 0.4, details: { quality_mode: 'enforce' } } },
    record: async (_a, id, phase, row) => { recs.push([phase, row]); return true } }
  const { admin } = mkCron()
  const sum = await cronMarketIntel(admin, Date.now(), deps)
  assert.deepEqual(order, ['reclassify:enforce', 'collect']); assert.equal(sum.reclassified, 7); assert.equal(sum.ignored_by_system, 3); ok('cron: reclassifica ANTES de coletar (antes dos limites de orçamento)')
  const rc = recs.find(r => r[0] === 'reclassify')[1], co = recs.find(r => r[0] === 'collect')[1]
  assert.deepEqual([rc.ignored_by_system, rc.filtered, rc.details.reasons.block_title], [3, 3, 3]); assert.deepEqual([co.searched, co.collected, co.filtered, co.accepted, co.cost_usd, co.month_cost_usd], [4, 20, 9, 2, 0.032, 0.4]); ok('cron registra uma linha de reclassify e uma de collect com os contadores da rodada')
  recs.length = 0; order.length = 0
  await cronMarketIntel(mkCron().admin, Date.now(), { ...deps, reclassify: async () => { throw new Error('boom') } }); assert.deepEqual(order, ['collect']); ok('reclassificação que falha não derruba a coleta')
  const none = []; await cronMarketIntel(mkCron().admin, Date.now(), { ...deps, collect: async () => ({ searched: 0, added: 0, spent_usd: 0, skipped: 'já coletou hoje' }), record: async (_a, _i, p) => { none.push(p); return true } }); assert.deepEqual(none, ['reclassify']); ok('quem já coletou hoje não gera linha de coleta')
  const off = []; const cOff = { ...CFG, market_intel: { news: { topics: CFG.market_intel.news.topics } } }
  const adminOff = { from: (t) => { const api = { select: () => api, eq: () => api, limit: () => api, maybeSingle: async () => ({ data: t === 'hermes_config' ? { auto_strategy_enabled: true } : t === 'vertical_playbooks' ? { config: cOff } : null }), then: (res) => Promise.resolve({ data: t === 'companies' ? [{ id: 'c1', vertical_key: 'k', language: 'pt' }] : [] }).then(res) }; return api } }
  await cronMarketIntel(adminOff, Date.now(), { ...deps, reclassify: async () => { off.push('x'); return {} } }); assert.equal(off.length, 0); ok('ficha sem quality (off): não reclassifica')
}

// ---------- audit: só grava reclassify quando o resultado muda
{
  const rc = { mode: 'audit', version: 1, examined: 7, passed: 4, failed: 3, ignored: 0, reasons: { block_title: 2, kind_mismatch: 1 }, samples: [], partial: false }
  const prev = { collected: 7, filtered: 3, accepted: 4, details: { reasons: { kind_mismatch: 1, block_title: 2 } } }
  assert.equal(await sameAsLastReclassify(fake({ market_intel_runs: [prev] }), 'c1', rc), true); assert.equal(await sameAsLastReclassify(fake({ market_intel_runs: [{ ...prev, filtered: 2 }] }), 'c1', rc), false); assert.equal(await sameAsLastReclassify(fake({ market_intel_runs: [] }), 'c1', rc), false); assert.equal(await sameAsLastReclassify(fake({}, { readError: { market_intel_runs: 1 } }), 'c1', rc), false); ok('sameAsLastReclassify: igual só se contagens e motivos batem; sem linha ou erro de leitura = grava')
  const CFGA = { opportunity_fields: { location: 'bairro' }, market_intel: { news: { topics: [{ kind: 'launch', query: '{region} x' }], quality: { ...QJSON, mode: 'audit' } } } }
  const adm = { from: (t) => { const api = { select: () => api, eq: () => api, limit: () => api, maybeSingle: async () => ({ data: t === 'hermes_config' ? { auto_strategy_enabled: true } : t === 'vertical_playbooks' ? { config: CFGA } : null }), then: (res) => Promise.resolve({ data: t === 'companies' ? [{ id: 'c1', vertical_key: 'k', language: 'pt' }] : [] }).then(res) }; return api } }
  const mk = (same) => { const phases = []; return { phases, deps: { reclassify: async () => rc, collect: async () => ({ searched: 0, added: 0, spent_usd: 0 }), sameAsLast: async () => same, record: async (_a, _i, p) => { phases.push(p); return true } } } }
  const a = mk(true); await cronMarketIntel(adm, Date.now(), a.deps); assert.deepEqual(a.phases, []); const b = mk(false); await cronMarketIntel(adm, Date.now(), b.deps); assert.deepEqual(b.phases, ['reclassify']); ok('cron em audit: resultado igual ao da última linha não grava de novo; mudou, grava')
}

// ---------- impressão digital
const NOW = new Date('2026-10-28T12:00:00Z')
const base = (over = {}) => ({
  lang: 'pt', now: NOW, windowDays: 60, fieldMap: { location: 'bairro', price: 'preco' }, labels: { bairro: 'Bairro', preco: 'Preço' }, itemLabel: 'Item',
  catalog: [{ id: 'i1', title: 'Item A', fields: { bairro: 'Ipanema', preco: '1.000.000' }, photoCount: 3 }, { id: 'i2', title: 'Item B', fields: { bairro: 'Leblon' }, photoCount: 0 }],
  posts: [], events: [], competitors: [], trends: [],
  signals: [{ id: 'sg1', kind: 'infrastructure', region: 'Ipanema', title: 'Metrô de Ipanema ganha obras', summary: 'Obras avançam.', source_name: 'oglobo.globo.com', source_url: 'https://oglobo.globo.com/a', observed_at: '2026-10-20' }],
  instagramConnected: true, ...over,
})
const fpOf = async (inp, over = {}) => {
  const { facts, candidates } = buildCandidates(inp)
  const top = candidates.map(c => score(c, facts)).sort(compareScored).slice(0, MAX_CANDIDATES_TO_LLM).map(s => s.c)
  const used = new Set(top.flatMap(c => c.fact_ids)); const sent = facts.filter(f => used.has(f.id))
  return interpretFingerprint({ lang: inp.lang, promptVersion: OPP_PROMPT_VERSION, businessName: 'Imobiliária X', itemLabel: inp.itemLabel, facts: sent, candidates: top, photoCounts: { i1: 3, i2: 0 }, ...over })
}
{
  const a = await fpOf(base()), b = await fpOf(base({ now: new Date(NOW.getTime() + 86400_000) })), c = await fpOf(base({ now: new Date(NOW.getTime() + 20 * 86400_000) }))
  assert.match(a, /^[0-9a-f]{64}$/); assert.equal(a, b); assert.equal(a, c); ok('mesmos dados, 1 e 20 dias depois (now diferente) = mesma impressão digital SHA-256')
  const r = buildCandidates(base()); assert.deepEqual(r.usedSignalIds, ['sg1']); assert.ok(r.facts.some(f => f.signal_id === 'sg1')); ok('o id do sinal chega até os fatos e buildCandidates devolve usedSignalIds')
  const changed = await fpOf(base({ signals: [{ ...base().signals[0], title: 'Metrô de Ipanema ganha estação nova' }] })); assert.notEqual(a, changed); ok('texto de um sinal mudou = impressão digital muda')
  const newSig = await fpOf(base({ signals: [...base().signals, { id: 'sg2', kind: 'tourism', region: 'Leblon', title: 'Eventos movimentam hotéis do Leblon', summary: 'x', source_name: 'riotur.rio', source_url: 'https://riotur.rio/b', observed_at: '2026-10-25' }] })); assert.notEqual(a, newSig); ok('sinal novo que entra na análise = muda')
  const otherId = await fpOf(base({ signals: [{ ...base().signals[0], id: 'outro-id', observed_at: '2026-10-27' }] })); assert.equal(a, otherId); ok('id do sinal e data não entram na impressão')
  assert.notEqual(a, await fpOf(base(), { promptVersion: OPP_PROMPT_VERSION + 1 })); assert.notEqual(a, await fpOf(base({ lang: 'en' }))); assert.notEqual(a, await fpOf(base(), { photoCounts: { i1: 9, i2: 0 } })); ok('versão do prompt, idioma e fotos dos itens entram na impressão')
  const payload = fingerprintPayload({ lang: 'pt', promptVersion: 1, businessName: 'X', itemLabel: 'I', facts: buildCandidates(base()).facts, candidates: buildCandidates(base()).candidates }); assert.ok(!/\bF\d+\b|\bC\d+\b|2026-10/.test(payload.replace(/Item [AB]/g, ''))); ok('texto canônico sem ids sequenciais (F1/C1) nem datas')
}

// ---------- runOpportunities: pula a IA quando nada mudou
{
  const PB = { config: { opportunity_fields: { location: 'bairro' } } }
  const mkRun = (signals, runs = []) => {
    const f = fake({ companies: { id: 'c1', business_name: 'Imob X', language: 'pt', vertical_key: 'imoveis_rio', instagram_user_id: null }, vertical_playbooks: PB,
      marketing_ai_knowledge: [{ id: 'i1', title: 'Item A', meta: { fields: { bairro: 'Ipanema' }, photos: [1] } }], market_signals: signals, market_intel_runs: runs })
    return f
  }
  const SIGS = [{ id: 'sg1', kind: 'infrastructure', region: 'Ipanema', title: 'Metrô de Ipanema ganha obras', summary: 'Obras avançam.', source_name: 'oglobo.globo.com', source_url: 'https://oglobo.globo.com/a', observed_at: '2026-10-20' }]
  let calls = 0; const llm = async () => { calls++; return { text: '{"opportunities":[]}', tokens: 321 } }
  const a = mkRun(SIGS)
  const r1 = await runOpportunities(a, 'c1', llm); assert.equal(r1.ok, true); assert.equal(calls, 1); assert.equal(r1.unchanged, undefined)
  const row1 = a.inserts.market_intel_runs.find(r => r.phase === 'interpret'); assert.match(row1.fingerprint, /^[0-9a-f]{64}$/); assert.deepEqual([row1.unchanged, row1.tokens, row1.interpreted, row1.accepted], [false, 321, 2, 0]); assert.deepEqual(row1.details.used_signal_ids, ['sg1']); ok('1ª análise: chama a IA e grava a impressão digital, tokens, sinais usados')
  const perf1 = a.inserts.agent_performance.find(p => p.task_key === 'run_opportunities'); assert.equal(perf1.success, true)
  const b = mkRun(SIGS, [{ fingerprint: row1.fingerprint, created_at: '2026-10-28T10:00:00Z' }])
  const r2 = await runOpportunities(b, 'c1', llm); assert.equal(calls, 1); assert.equal(r2.unchanged, true); assert.equal(r2.generated, 0); assert.equal(r2.ok, true)
  const rowU = b.inserts.market_intel_runs[0]; assert.deepEqual([rowU.unchanged, rowU.tokens, rowU.fingerprint], [true, 0, row1.fingerprint]); const perf2 = b.inserts.agent_performance[0]; assert.deepEqual([perf2.task_key, perf2.success, perf2.tokens_used], ['run_opportunities', true, 0]); assert.match(perf2.task_description, /sem mudança desde 2026-10-28/); ok('mesmo conteúdo: NÃO chama a IA, grava unchanged/tokens 0 e a linha run_opportunities de sucesso "sem mudança" (zera o relógio de 7 dias)')
  const c = mkRun([{ ...SIGS[0], title: 'Metrô de Ipanema ganha estação' }], [{ fingerprint: row1.fingerprint, created_at: '2026-10-28T10:00:00Z' }]); await runOpportunities(c, 'c1', llm); assert.equal(calls, 2); ok('conteúdo mudou: chama a IA de novo')
  const d = mkRun(SIGS, [{ fingerprint: row1.fingerprint, created_at: '2026-10-28T10:00:00Z' }]); const failing = async () => { throw new Error('IA fora') }
  const dd = mkRun([{ ...SIGS[0], title: 'Outro título em Ipanema' }], [{ fingerprint: row1.fingerprint, created_at: '2026-10-28T10:00:00Z' }])
  const rf = await runOpportunities(dd, 'c1', failing); assert.equal(rf.ok, false); const rowF = dd.inserts.market_intel_runs[0]; assert.equal(rowF.fingerprint, null); assert.equal(rowF.details.error, 'ai_no_answer'); assert.equal(dd.inserts.agent_performance[0].success, false); void d; ok('falha da IA: registra a falha SEM impressão digital (a próxima rodada tenta de novo)')
  const e = mkRun(SIGS, []); e.from = ((orig) => (t) => (t === 'market_intel_runs' ? { select: () => { throw new Error('relation does not exist') }, insert: () => { throw new Error('relation does not exist') } } : orig(t)))(e.from); const before = calls; const re = await runOpportunities(e, 'c1', llm); assert.equal(re.ok, true); assert.equal(calls, before + 1); ok('tabela market_intel_runs ausente: interpreta normalmente, sem derrubar')
}

// ---------- parte pura da tela
{
  const m0 = mergeIgnoredMeta({ provider: 'tavily', ignored_reason: 'block_title', ignored_by: 'system' }, true, '2026-11-04T10:00:00Z')
  assert.deepEqual(m0, { provider: 'tavily', ignored: true, ignored_at: '2026-11-04T10:00:00Z', ignored_by: 'owner' }); ok('dono ignora: ignored_by:owner e o motivo do sistema some; meta mesclada')
  const m1 = mergeIgnoredMeta({ provider: 'tavily', ignored: true, ignored_at: 'x', ignored_by: 'system', ignored_reason: 'block_title', quality_v: 1 }, false)
  assert.deepEqual(m1, { provider: 'tavily', quality_v: 1, ignored: false, owner_restored: true }); ok('restaurar: limpa ignored_at/by/reason e grava owner_restored:true (o sistema não ignora de novo)')
  assert.equal(needsReclassify(m1, QE), false); ok('...e o backend respeita esse carimbo')
  assert.equal(ignoredNote({ ignored: true, ignored_by: 'system', ignored_reason: 'block_title' }, 'pt'), 'Ignorado pelo sistema: anúncio ou página sem notícia (pelo título)'); assert.equal(ignoredNote({ ignored: true, ignored_by: 'owner' }, 'pt'), 'Ignorado por você'); assert.equal(ignoredNote({ ignored: true }, 'pt'), 'Ignorado por você'); assert.match(ignoredNote({ ignored_by: 'system', ignored_reason: 'zzz' }, 'en'), /Ignored by the system: did not pass/); assert.ok(ignoredBySystem({ ignored: true, ignored_by: 'system' }) && !ignoredBySystem({ ignored: true, ignored_by: 'owner' }) && isIgnored({ ignored: true })); assert.ok(reasonLabel('kind_mismatch', 'pt')); ok('"Ignorado pelo sistema: <motivo>" x "Ignorado por você" (sinal antigo = dono); motivo desconhecido tem texto padrão')

  const T = (d) => `2026-11-${d}T12:00:00Z`
  const rows = [
    { phase: 'interpret', unchanged: true, tokens: 0, interpreted: 3, accepted: 0, created_at: T('04') },
    { phase: 'collect', searched: 4, collected: 20, filtered: 15, accepted: 5, cost_usd: '0.032', month_cost_usd: '0.5', created_at: T('04') },
    { phase: 'reclassify', ignored_by_system: 6, created_at: T('03') },
    { phase: 'interpret', unchanged: false, tokens: 1500, interpreted: 3, accepted: 2, created_at: T('02') },
  ].map(r => ({ searched: null, collected: null, filtered: null, accepted: null, interpreted: null, discarded: null, ignored_by_system: null, unchanged: false, cost_usd: null, month_cost_usd: null, tokens: null, fingerprint: r.phase === 'interpret' ? 'f'.repeat(64) : null, details: null, ...r }))
  const ch = deriveChanges(rows, Date.parse('2026-11-04T15:00:00Z'))
  assert.deepEqual([ch.collect.accepted, ch.collect.filtered, ch.collect.cost, ch.monthCost, ch.interpret.unchanged, ch.interpret.tokens], [5, 15, 0.032, 0.5, true, 0]); assert.equal(ch.interpret.changedAt, T('02')); ok('deriveChanges: última coleta, custo (numeric em texto), acumulado do mês, análise sem mudança e a data da última que mudou')
  const L = describeChanges(ch, 'pt'); assert.equal(L.length, 3)
  assert.ok(/Última coleta \(04\/11\).*guardadas: 5.*descartadas pelo filtro: 15/.test(L[0])); assert.ok(/nada mudou desde 02\/11/.test(L[1])); assert.ok(/US\$ 0,032 \(estimado\)/.test(L[2]) && /acumulado no mês: US\$ 0,50/.test(L[2]) && /tokens da análise: 0 \(sem chamada à IA\)/.test(L[2])); ok('frases: coleta guardada/descartada, "nada mudou desde dd/mm", custo da rodada, acumulado vs teto de US$ 5 e tokens')
  const nm = deriveChanges([{ ...rows[1], accepted: null, filtered: null, cost_usd: null, month_cost_usd: null }, { ...rows[3], tokens: null, interpreted: null, accepted: null }], Date.parse('2026-11-04T15:00:00Z'))
  const LN = describeChanges(nm, 'pt').join(' | '); assert.ok(/guardadas: não medido/.test(LN) && /descartadas pelo filtro: não medido/.test(LN) && /candidatos analisados: não medido/.test(LN) && /Custo da coleta: não medido/.test(LN) && /acumulado no mês: não medido/.test(LN) && /tokens da análise: não medido/.test(LN) && !/: 0\b/.test(LN)); ok('contador nulo = "não medido", nunca "0"')
  { // análise que falhou: não vira "rodou — 0 oportunidades" e não serve de referência para "nada mudou desde"
    const withFp = rows.map(r => (r.phase === 'interpret' ? { ...r, fingerprint: 'a'.repeat(64) } : r))
    const failedRow = { ...withFp[0], unchanged: false, tokens: 10, accepted: 0, fingerprint: null, details: { error: 'ai_no_answer' }, created_at: T('04') }
    const f = deriveChanges([failedRow, withFp[1], withFp[3]], Date.parse('2026-11-04T15:00:00Z'))
    assert.equal(f.interpret.failed, true); assert.equal(f.interpret.changedAt, T('02'))
    const FL = describeChanges(f, 'pt'); assert.equal(FL[1], 'A última análise falhou (04/11)'); assert.ok(/tokens da análise: não medido/.test(FL[2])); assert.ok(!/oportunidades geradas/.test(FL[1]) && !/nada mudou/.test(FL[1]))
    const onlyFail = deriveChanges([failedRow, { ...withFp[0], unchanged: true, fingerprint: null, created_at: T('03') }], Date.parse('2026-11-04T15:00:00Z')); assert.equal(onlyFail.interpret.changedAt, null)
    const ok2 = deriveChanges([{ ...withFp[0], created_at: T('04') }, { ...failedRow, created_at: T('03') }, withFp[3]], Date.parse('2026-11-04T15:00:00Z')); assert.equal(ok2.interpret.changedAt, T('02')); assert.match(describeChanges(ok2, 'pt')[1], /nada mudou desde 02\/11/)
    ok('análise que falhou: mostra "A última análise falhou (dd/mm)", sem "0 oportunidades"; "nada mudou desde" só usa rodada com impressão digital')
    const capped = deriveChanges([{ ...rows[1], details: { cap_usd: 3 } }], Date.parse('2026-11-04T15:00:00Z')); assert.equal(capped.capUsd, 3); assert.match(describeChanges(capped, 'pt')[2], /acumulado no mês: US\$ 0,50 de US\$ 3,00/)
    const nocap = deriveChanges([rows[1]], Date.parse('2026-11-04T15:00:00Z')); assert.equal(nocap.capUsd, null); assert.ok(!/ de US\$/.test(describeChanges(nocap, 'pt')[2])); ok('teto do mês vem da própria rodada (details.cap_usd); sem ele a tela não inventa teto')
  }
  assert.equal(deriveChanges([rows[1]], Date.parse('2026-12-02T10:00:00Z')).monthCost, null); ok('acumulado de mês anterior não aparece como o do mês atual')
  const e = describeChanges(deriveChanges([]), 'pt'); assert.ok(/nenhuma registrada/.test(e[0]) && /nenhuma registrada/.test(e[1])); assert.equal(ignoredLine(null, 'pt'), 'Ignoradas pelo sistema: não medido'); assert.equal(ignoredLine(1, 'pt'), 'O sistema ignorou 1 notícia por qualidade'); assert.equal(ignoredLine(4, 'en'), 'The system ignored 4 news items for quality'); assert.ok(changesText('pt').empty && changesText('pt').error && changesText('en').loading); ok('sem rodada, contagem de ignorados nula e textos de estado (vazio / erro / carregando)')
  const dm = demoChanges(Date.parse('2026-11-04T15:00:00Z')); assert.ok(describeChanges(dm.changes, 'pt').length === 3 && changesText('pt').example === 'exemplo'); ok('demo tem dados de exemplo e a etiqueta "exemplo"')
}
console.log(`\n${n} verificações ok`)
