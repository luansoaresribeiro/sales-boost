// Notícias de mercado automáticas (Etapa 3) — banco + Tavily. A lógica de filtro/limites está em marketNews.ts.
// Chamado por opportunityCron.ts ANTES de decidir a rodada de oportunidades: sinal novo já dispara nova rodada pela
// regra de sempre e a oportunidade `market_change` aparece sozinha. Só ESCREVE em market_signals (collected_by='system')
// e agent_performance; nada é publicado. O dono vê o selo "Automático" e pode apagar; a aprovação humana fica na oportunidade.
// Falha da Tavily / 429 / sem chave: registra e PARA (nenhuma nova tentativa em laço).
import { getTavilyKey } from './faqCheck.ts'
import {
  SEARCH_TIMEOUT_MS, TASK_KEY, WEEK_MS, MONTH_MS, buildQuery, filterHits, monthlyCapFrom, newAllowed, parseNewsConfig, pickRegions, searchesAllowed,
  type MarketNewsConfig, type NewsSignal, type TavilyHit,
} from './marketNews.ts'

type Admin = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any
export type NewsSearch = (key: string, query: string, cfg: MarketNewsConfig, timeoutMs: number) => Promise<TavilyHit[]>

export interface NewsResult { searched: number; added: number; skipped?: string }
export interface NewsOpts {
  companyId: string
  lang: 'pt' | 'en'
  rawConfig: unknown            // vertical_playbooks.config.market_news
  locationKey: string | undefined // vertical_playbooks.config.opportunity_fields.location
  search?: NewsSearch
  getKey?: () => Promise<string | undefined>
  canStart?: () => boolean      // orçamento de tempo do cron: só começa uma busca se sobrar tempo
  monthlyCap?: number
  nowMs?: number
}

export const tavilyNews: NewsSearch = async (key, query, cfg, timeoutMs) => {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ api_key: key, query, topic: 'news', days: cfg.days, search_depth: 'basic', max_results: cfg.max_results, include_answer: false, exclude_domains: cfg.exclude_domains }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`Tavily ${res.status}`)
  const data = await res.json() as { results?: TavilyHit[] }
  return Array.isArray(data.results) ? data.results : []
}

const log = (companyId: string, msg: string) => console.error(`[market_news] ${companyId}: ${msg}`)

export async function collectMarketNews(admin: Admin, o: NewsOpts): Promise<NewsResult> {
  const out: NewsResult = { searched: 0, added: 0 }
  const cfg = parseNewsConfig(o.rawConfig)
  const template = cfg ? (o.lang === 'en' ? cfg.queries.en : cfg.queries.pt) ?? cfg.queries.pt ?? cfg.queries.en : undefined
  if (!cfg || !template || !o.locationKey) return { ...out, skipped: 'setor sem market_news na ficha' }
  const now = o.nowMs ?? Date.now()

  // Interruptor das fontes (painel Owner): se existe a linha 'tavily' e está desligada, não busca.
  const { data: sw, error: swErr } = await admin.from('insight_sources').select('enabled').eq('type', 'tavily').maybeSingle()
  if (swErr) { log(o.companyId, `interruptor: ${swErr.message}`); return { ...out, skipped: 'erro ao ler o interruptor' } }
  if (sw && sw.enabled === false) return { ...out, skipped: 'fonte Tavily desligada' }

  // Limites: contagem com erro = não busca (falha fechada, é gasto).
  const sinceWeek = new Date(now - WEEK_MS).toISOString(), sinceMonth = new Date(now - MONTH_MS).toISOString()
  const [week, month, newWeek] = await Promise.all([
    admin.from('agent_performance').select('id', { count: 'exact', head: true }).eq('company_id', o.companyId).eq('task_key', TASK_KEY).gte('created_at', sinceWeek),
    admin.from('agent_performance').select('id', { count: 'exact', head: true }).eq('task_key', TASK_KEY).gte('created_at', sinceMonth),
    admin.from('market_signals').select('id', { count: 'exact', head: true }).eq('company_id', o.companyId).eq('collected_by', 'system').gte('created_at', sinceWeek),
  ])
  if (week.error || month.error || newWeek.error) { log(o.companyId, `contagem: ${(week.error ?? month.error ?? newWeek.error).message}`); return { ...out, skipped: 'erro ao contar limites' } }
  const monthlyCap = o.monthlyCap ?? monthlyCapFrom(typeof Deno !== 'undefined' ? Deno.env.get('MARKET_NEWS_MONTHLY_CAP') : undefined)
  let searchesLeft = searchesAllowed({ usedWeek: week.count ?? 0, maxRegions: cfg.max_regions, monthUsed: month.count ?? 0, monthlyCap })
  let newLeft = newAllowed(newWeek.count ?? 0, cfg.max_new_per_week)
  if (searchesLeft <= 0 || newLeft <= 0) return { ...out, skipped: 'limite semanal/mensal atingido' }

  const key = await (o.getKey ?? (() => getTavilyKey(admin)))()
  if (!key) { log(o.companyId, 'sem chave da Tavily'); return { ...out, skipped: 'sem chave da Tavily' } }

  // Regiões do catálogo com mais itens (papel `location` da ficha).
  const { data: items, error: itErr } = await admin.from('marketing_ai_knowledge').select('meta').eq('company_id', o.companyId).eq('kind', 'product').limit(200)
  if (itErr) { log(o.companyId, `catálogo: ${itErr.message}`); return { ...out, skipped: 'erro ao ler o catálogo' } }
  const regions = pickRegions(((items ?? []) as { meta: { fields?: Record<string, unknown> } | null }[]).map(r => r.meta?.fields?.[o.locationKey!]), searchesLeft)
  if (!regions.length) return { ...out, skipped: 'catálogo sem região' }

  const search = o.search ?? tavilyNews
  const seen = new Set<string>()
  for (const region of regions) {
    if (searchesLeft <= 0 || newLeft <= 0) break
    if (o.canStart && !o.canStart()) { out.skipped = 'sem tempo no cron'; break }
    searchesLeft--
    const t0 = Date.now()
    let hits: TavilyHit[] = [], errMsg = ''
    try { hits = await search(key, buildQuery(template, region), cfg, SEARCH_TIMEOUT_MS) } catch (e) { errMsg = String(e instanceof Error ? e.message : e).slice(0, 300) }
    out.searched++
    // Cada busca (inclusive a que falhou) vira uma linha: é o contador dos limites. Sem a linha, para (nunca busca sem contar).
    const { error: perfErr } = await admin.from('agent_performance').insert({
      company_id: o.companyId, agent_role: 'cmo', task_key: TASK_KEY, task_description: `Notícias: ${region}`.slice(0, 200),
      latency_ms: Date.now() - t0, tokens_used: 0, success: !errMsg, ...(errMsg ? { error_message: errMsg } : {}),
    })
    if (perfErr) { log(o.companyId, `agent_performance: ${perfErr.message}`); out.skipped = 'não consegui registrar a busca'; break }
    if (errMsg) { log(o.companyId, `${region}: ${errMsg}`); out.skipped = 'falha na busca'; break }

    const cands = filterHits(hits, { region, days: cfg.days, excludeDomains: cfg.exclude_domains, nowMs: now, seen })
    if (!cands.length) continue
    const { data: have, error: haveErr } = await admin.from('market_signals').select('source_url').eq('company_id', o.companyId).in('source_url', cands.map(c => c.source_url))
    if (haveErr) { log(o.companyId, `duplicadas: ${haveErr.message}`); out.skipped = 'erro ao conferir duplicadas'; break }
    const known = new Set(((have ?? []) as { source_url: string }[]).map(r => r.source_url))
    for (const s of cands as NewsSignal[]) {
      if (newLeft <= 0) break
      if (known.has(s.source_url)) continue
      const { error } = await admin.from('market_signals').insert({ company_id: o.companyId, ...s })
      if (error) {
        if ((error as { code?: string }).code === '23505') continue // já existe (índice único): ok
        log(o.companyId, `insert: ${error.message}`); out.skipped = 'erro ao gravar sinal'; return out
      }
      out.added++; newLeft--
    }
  }
  return out
}
