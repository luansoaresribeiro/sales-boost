// Notícias de mercado automáticas (v2, 2026-11-01) — banco + Tavily. Filtros em marketNews.ts; dólar/rotação em marketIntel.ts.
// Chamado só por marketIntelCron.ts (action `cron_market_intel` do marketing-ai) — dono ÚNICO da coleta; o opportunityCron
// não coleta mais, só lê os sinais (sinal novo dispara nova rodada, com 24 h de intervalo mínimo).
// No máx. 1 rodada de coleta por empresa por dia. Antes de cada busca paga grava a RESERVA do custo em `agent_performance`
// (task_key 'market_news_search', cost_usd) e ajusta depois; se a reserva não grava, NÃO busca. Só ESCREVE em market_signals
// (collected_by='system') e agent_performance; nada é publicado. O dono vê o selo "Automático" e pode apagar.
// Falha da Tavily / 429 / sem chave: registra e PARA (nenhuma nova tentativa em laço).
import { getTavilyKey } from './faqCheck.ts'
import {
  ALL_MARKET_TASK_KEYS, MARKET_TASK_KEYS, PARALLEL_SEARCHES, SEARCH_TIMEOUT_MS, buildUnits, capFromEnv, dayNumber, dayStartIso, daysLeftInMonth, envGet,
  capUsdOf, monthStartIso, normalizeUrl, normalizeTitle, parseIntelConfig, remainingFor, rotate, searchesToday, spentBySource, tavilyCostFromEnv,
  type IntelNewsConfig, type SearchUnit,
} from './marketIntel.ts'
import { filterHitsReport, pickRegions, type TavilyHit } from './marketNews.ts'

type Admin = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any
export type NewsSearch = (key: string, query: string, cfg: IntelNewsConfig, timeoutMs: number) => Promise<TavilyHit[]>

export interface NewsResult {
  searched: number; added: number; spent_usd: number; skipped?: string
  // Fase 2 (registro por rodada): ausente = não medido.
  collected?: number; filtered?: number; month_spent_usd?: number
  details?: { quality_mode: string; quality_version: number; rejected: Record<string, number>; flagged: Record<string, number>; samples: { title: string; host: string; reason: string }[]; skipped?: string }
}
export interface NewsOpts {
  companyId: string
  lang: 'pt' | 'en'
  rawConfig: unknown              // vertical_playbooks.config.market_intel
  locationKey: string | undefined // vertical_playbooks.config.opportunity_fields.location
  search?: NewsSearch
  getKey?: () => Promise<string | undefined>
  canStart?: () => boolean        // orçamento de tempo do cron: só começa um lote se sobrar tempo
  capUsd?: number                 // teto mensal Apify+Tavily (padrão: env MARKET_INTEL_CAP_USD ou ficha ou 5)
  costUsd?: number                // custo estimado de 1 busca (padrão: env TAVILY_COST_USD ou 0.008)
  fitsTotalCap?: (estimateUsd: number) => Promise<boolean> // teto geral de US$ 40 (spendCap.fitsCap); erro/false = não busca
  nowMs?: number
}

export const tavilyNews: NewsSearch = async (key, query, cfg, timeoutMs) => {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ api_key: key, query, topic: 'news', days: cfg.days, search_depth: 'basic', max_results: cfg.max_results, include_answer: false, exclude_domains: cfg.exclude_domains }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  // Resposta de erro HTTP não é cobrada; timeout/queda de rede pode ter sido (fica a reserva inteira).
  if (!res.ok) throw Object.assign(new Error(`Tavily ${res.status}`), { uncharged: true })
  const data = await res.json() as { results?: TavilyHit[] }
  return Array.isArray(data.results) ? data.results : []
}

const log = (companyId: string, msg: string) => console.error(`[market_news] ${companyId}: ${msg}`)
const DEDUPE_DAYS = 90

export async function collectMarketNews(admin: Admin, o: NewsOpts): Promise<NewsResult> {
  const out: NewsResult = { searched: 0, added: 0, spent_usd: 0 }
  const intel = parseIntelConfig(o.rawConfig)
  const cfg = intel?.news
  if (!intel || !cfg || !o.locationKey) return { ...out, skipped: 'setor sem market_intel.news na ficha' }
  const now = o.nowMs ?? Date.now()
  const capUsd = capUsdOf(o.capUsd ?? (envGet('MARKET_INTEL_CAP_USD') ? capFromEnv(envGet('MARKET_INTEL_CAP_USD')) : intel.cap_usd ?? capFromEnv(undefined)))
  const costUsd = o.costUsd ?? tavilyCostFromEnv(envGet('TAVILY_COST_USD'))

  // Interruptor das fontes (painel Owner): se existe a linha 'tavily' e está desligada, não busca.
  const { data: sw, error: swErr } = await admin.from('insight_sources').select('enabled').eq('type', 'tavily').maybeSingle()
  if (swErr) { log(o.companyId, `interruptor: ${swErr.message}`); return { ...out, skipped: 'erro ao ler o interruptor' } }
  if (sw && sw.enabled === false) return { ...out, skipped: 'fonte Tavily desligada' }

  // Livro-caixa do mês e limites: leitura com erro = não busca (falha fechada, é gasto).
  const dayStart = dayStartIso(now)
  const [led, newToday, known] = await Promise.all([
    admin.from('agent_performance').select('task_key, cost_usd, created_at').eq('company_id', o.companyId).in('task_key', ALL_MARKET_TASK_KEYS).gte('created_at', monthStartIso(now)),
    admin.from('market_signals').select('id', { count: 'exact', head: true }).eq('company_id', o.companyId).eq('collected_by', 'system').gte('created_at', dayStart),
    admin.from('market_signals').select('source_url, title').eq('company_id', o.companyId).gte('created_at', new Date(now - DEDUPE_DAYS * 86400_000).toISOString()).order('created_at', { ascending: false }).limit(500),
  ])
  if (led.error || newToday.error || known.error) { log(o.companyId, `leitura: ${(led.error ?? newToday.error ?? known.error).message}`); return { ...out, skipped: 'erro ao ler limites' } }
  const rows = (led.data ?? []) as { task_key: string; cost_usd: number | string | null; created_at?: string }[]
  const newsRows = rows.filter(r => r.task_key === MARKET_TASK_KEYS.news)
  if (newsRows.some(r => (r.created_at ?? '') >= dayStart)) return { ...out, skipped: 'já coletou hoje' }

  const spent = spentBySource(rows)
  // Estatística da rodada (só é lida se houve busca): quantos resultados vieram, quantos o filtro barrou e por quê.
  const quality = cfg.quality
  const stats = { hits: 0, rejected: {} as Record<string, number>, flagged: {} as Record<string, number>, samples: [] as { title: string; host: string; reason: string }[] }
  const hostCounts = new Map<string, number>()
  const done = (): NewsResult => {
    if (out.searched > 0) {
      out.collected = stats.hits; out.filtered = Object.values(stats.rejected).reduce((a, b) => a + b, 0); out.month_spent_usd = spent.total + out.spent_usd
      out.details = { quality_mode: quality.mode, quality_version: quality.version, rejected: stats.rejected, flagged: stats.flagged, samples: stats.samples, ...(out.skipped ? { skipped: out.skipped } : {}) }
    }
    return out
  }
  let remaining = remainingFor('news', { split: intel.split, capUsd, spent })
  const monthLeft = cfg.max_searches_per_month - newsRows.length
  let newLeft = cfg.max_new_per_day - (newToday.count ?? 0)
  const n = Math.min(searchesToday({ remainingUsd: remaining, daysLeft: daysLeftInMonth(now), costUsd }), cfg.max_searches_per_day, monthLeft)
  if (n <= 0 || newLeft <= 0) return { ...out, skipped: 'sem orçamento (dólar/mês/dia) para buscar hoje' }

  const key = await (o.getKey ?? (() => getTavilyKey(admin)))()
  if (!key) { log(o.companyId, 'sem chave da Tavily'); return { ...out, skipped: 'sem chave da Tavily' } }

  // Regiões do catálogo com mais itens (papel `location` da ficha) + tópicos da ficha, em rotação diária.
  const { data: items, error: itErr } = await admin.from('marketing_ai_knowledge').select('meta').eq('company_id', o.companyId).eq('kind', 'product').limit(200)
  if (itErr) { log(o.companyId, `catálogo: ${itErr.message}`); return { ...out, skipped: 'erro ao ler o catálogo' } }
  const regions = pickRegions(((items ?? []) as { meta: { fields?: Record<string, unknown> } | null }[]).map(r => r.meta?.fields?.[o.locationKey!]), cfg.max_regions)
  if (!regions.length) return { ...out, skipped: 'catálogo sem região' }
  const units = rotate(buildUnits(cfg.topics, regions, cfg.city, o.lang), n, dayNumber(now))
  if (!units.length) return { ...out, skipped: 'ficha sem tópico utilizável' }

  const knownRows = (known.data ?? []) as { source_url: string | null; title: string | null }[]
  const seen = new Set<string>(knownRows.map(r => normalizeUrl(r.source_url)).filter((u): u is string => !!u))
  const seenTitles = new Set<string>(knownRows.map(r => normalizeTitle(r.title)).filter(Boolean))
  const search = o.search ?? tavilyNews

  for (let i = 0; i < units.length; i += PARALLEL_SEARCHES) {
    if (o.canStart && !o.canStart()) { out.skipped = 'sem tempo no cron'; break }
    // 1) Reserva do custo (sequencial) — sem a linha gravada, não busca.
    const batch: { u: SearchUnit & { query: string }; id: string | null; t0: number }[] = []
    let stop = ''
    for (const u of units.slice(i, i + PARALLEL_SEARCHES)) {
      if (remaining + 1e-9 < costUsd) { stop = 'orçamento em dólar acabou'; break }
      // Relê o gasto do mês antes de cada reserva (QA 2026-11-01): duas chamadas ao mesmo tempo não passam do teto.
      const fresh = await admin.from('agent_performance').select('task_key, cost_usd, created_at').eq('company_id', o.companyId).in('task_key', ALL_MARKET_TASK_KEYS).gte('created_at', monthStartIso(now))
      if (fresh.error) { log(o.companyId, `releitura: ${fresh.error.message}`); stop = 'erro ao reler o gasto'; break }
      const freshRows = (fresh.data ?? []) as { task_key: string; cost_usd: number | string | null; created_at?: string }[]
      if (!batch.length && i === 0 && freshRows.some(r => r.task_key === MARKET_TASK_KEYS.news && (r.created_at ?? '') >= dayStart)) { stop = 'já coletou hoje'; break }
      remaining = Math.min(remaining, remainingFor('news', { split: intel.split, capUsd, spent: spentBySource(freshRows) }))
      if (remaining + 1e-9 < costUsd) { stop = 'orçamento em dólar acabou'; break }
      let fits = true
      if (o.fitsTotalCap) { try { fits = await o.fitsTotalCap(costUsd) } catch (e) { log(o.companyId, `teto geral: ${String(e)}`); fits = false } }
      if (!fits) { stop = 'teto geral de gasto do mês'; break }
      const { data: ins, error: perfErr } = await admin.from('agent_performance').insert({
        company_id: o.companyId, agent_role: 'cmo', task_key: MARKET_TASK_KEYS.news, task_description: `Notícias (${u.topic.kind}): ${u.region}`.slice(0, 200),
        latency_ms: 0, tokens_used: 0, success: true, cost_usd: costUsd,
      }).select('id').single()
      if (perfErr || !ins?.id) { log(o.companyId, `agent_performance: ${perfErr?.message ?? 'sem id'}`); stop = 'não consegui registrar a busca'; break }
      remaining -= costUsd
      batch.push({ u, id: String(ins.id), t0: Date.now() })
    }
    if (stop) out.skipped = stop

    // 2) Buscas do lote em paralelo (12 s cada).
    const results = await Promise.all(batch.map(async b => {
      try { return { hits: await search(key, b.u.query, cfg, SEARCH_TIMEOUT_MS), err: '', uncharged: false } }
      catch (e) { return { hits: [] as TavilyHit[], err: String(e instanceof Error ? e.message : e).slice(0, 300), uncharged: !!(e as { uncharged?: boolean })?.uncharged } }
    }))

    // 3) Ajusta a reserva com o resultado real.
    let failed = false
    for (let j = 0; j < batch.length; j++) {
      const r = results[j], b = batch[j]
      out.searched++
      const cost = r.err && r.uncharged ? 0 : costUsd
      out.spent_usd += cost
      const { error: upErr } = await admin.from('agent_performance').update({ cost_usd: cost, latency_ms: Date.now() - b.t0, success: !r.err, ...(r.err ? { error_message: r.err } : {}) }).eq('id', b.id)
      if (upErr) log(o.companyId, `ajuste da reserva: ${upErr.message}`) // a reserva inteira fica (conservador)
      if (r.err) { failed = true; log(o.companyId, `${b.u.region}: ${r.err}`) }
    }

    // 4) Filtra, dedupe e grava os sinais.
    for (let j = 0; j < batch.length; j++) {
      const r = results[j], b = batch[j]
      if (r.err || newLeft <= 0) continue
      const rep = filterHitsReport(r.hits, { region: b.u.region, kind: b.u.topic.kind, days: cfg.days, excludeDomains: cfg.exclude_domains, nowMs: now, seen, seenTitles, quality, hostCounts })
      stats.hits += r.hits.length
      for (const [k, v] of Object.entries(rep.rejected)) stats.rejected[k] = (stats.rejected[k] ?? 0) + v
      for (const [k, v] of Object.entries(rep.flagged)) stats.flagged[k] = (stats.flagged[k] ?? 0) + v
      for (const x of rep.samples) if (stats.samples.length < 5) stats.samples.push(x)
      for (const s of rep.signals) {
        if (newLeft <= 0) break
        const { error } = await admin.from('market_signals').insert({ company_id: o.companyId, ...s })
        if (error) {
          if ((error as { code?: string }).code === '23505') continue // já existe (índice único): ok
          log(o.companyId, `insert: ${error.message}`); out.skipped = 'erro ao gravar sinal'; return done()
        }
        out.added++; newLeft--
      }
    }
    if (failed) { out.skipped = 'falha na busca'; break }
    if (stop) break
  }
  return done()
}
