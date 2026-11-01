// Inteligência de Mercado — coleta DIÁRIA automática. Chamado por marketing-ai → action 'cron_market_intel', autenticada por
// cron_secret no corpo (PITFALLS "verify_jwt × chamada de cron"). O agendamento vive no banco (SQL em docs/ARCHITECTURE.md),
// não em código/migration. É o ÚNICO dono da coleta de notícias (o opportunityCron só lê os sinais).
// Elegibilidade igual à do opportunityCron: companies.auto_strategy=true (Liga dos Sonhos fica de fora) + empresa ativa +
// interruptor geral hermes_config.auto_strategy_enabled + hasPaidAccess + ficha com market_intel e opportunity_fields.location.
// O interruptor "tavily" de insight_sources é checado dentro de collectMarketNews. Até 2 empresas COM trabalho por chamada e
// nenhuma coleta nova depois de 40 s (responde em segundo plano; a chamada do agendamento é curta).
import { hasPaidAccess } from './access.ts'
import { collectMarketNews, type NewsOpts, type NewsResult } from './marketNewsRun.ts'

type Admin = { from: (t: string) => any; rpc?: any } // eslint-disable-line @typescript-eslint/no-explicit-any
export const MI_COMPANIES_PER_CALL = 2
export const MI_START_UNTIL_MS = 40_000

export interface MarketIntelSummary { ok: boolean; skipped_reason?: string; companies_checked: number; collected: number; searched: number; added: number; spent_usd: number }

export async function cronMarketIntel(
  admin: Admin, started = Date.now(),
  deps: { collect?: (a: Admin, o: NewsOpts) => Promise<NewsResult>; fitsCap?: (companyId: string, estimate: number) => Promise<boolean> } = {},
): Promise<MarketIntelSummary> {
  const sum: MarketIntelSummary = { ok: true, companies_checked: 0, collected: 0, searched: 0, added: 0, spent_usd: 0 }
  const collect = deps.collect ?? collectMarketNews
  const { data: cfg } = await admin.from('hermes_config').select('auto_strategy_enabled').eq('id', true).maybeSingle()
  if (cfg && cfg.auto_strategy_enabled === false) return { ...sum, skipped_reason: 'auto_strategy_enabled=false no painel Owner' }

  const { data: companies } = await admin.from('companies').select('id, vertical_key, language').eq('auto_strategy', true).eq('active', true).limit(200)
  const windowOpen = () => Date.now() - started < MI_START_UNTIL_MS
  let worked = 0
  for (const c of (companies ?? []) as { id: string; vertical_key: string | null; language: string | null }[]) {
    if (worked >= MI_COMPANIES_PER_CALL || !windowOpen()) break
    try {
      if (!(await hasPaidAccess(admin, c.id))) continue // conta vitrine: cron não gasta
      const { data: pb } = await admin.from('vertical_playbooks').select('config').eq('key', c.vertical_key ?? '').eq('enabled', true).maybeSingle()
      const pbCfg = pb?.config as { opportunity_fields?: { location?: string }; market_intel?: unknown } | null
      if (!pbCfg?.opportunity_fields?.location || !pbCfg.market_intel) continue // setor sem o motor / sem coleta
      sum.companies_checked++
      const r = await collect(admin, {
        companyId: c.id, lang: c.language === 'en' ? 'en' : 'pt', rawConfig: pbCfg.market_intel, locationKey: pbCfg.opportunity_fields.location, canStart: windowOpen,
        fitsTotalCap: deps.fitsCap ? (est) => deps.fitsCap!(c.id, est) : undefined,
      })
      sum.searched += r.searched; sum.added += r.added; sum.spent_usd += r.spent_usd
      if (r.searched > 0) { worked++; sum.collected++ } // quem já coletou hoje / sem orçamento não ocupa vaga
    } catch (e) {
      console.error(`[cron_market_intel] empresa ${c.id}:`, String(e))
    }
  }
  return sum
}
