// Opportunity Engine — rodadas AUTOMÁTICAS (princípio "Tudo automático", DECISIONS 2026-10-26: a única ação humana
// é aprovar/descartar). Chamado por marketing-ai → action 'cron_opportunities', autenticada por cron_secret no corpo
// (PITFALLS "verify_jwt × chamada de cron"). O AGENDAMENTO em si (cron.schedule) NÃO é criado por código/migration:
// é alteração arriscada, o dono aprova (ver docs/ARCHITECTURE.md).
//
// Por empresa elegível (mesmo critério do cron de estratégia: companies.auto_strategy=true — a Liga dos Sonhos fica
// de fora — + interruptor geral hermes_config.auto_strategy_enabled + hasPaidAccess; e empresa ativa):
//  (a) roda a busca de oportunidades se a última rodada tem > 7 dias OU há sinal de mercado novo desde ela;
//  (b) cria o plano das oportunidades APROVADAS que ainda não têm (rede de segurança do plano automático);
//      os freios (5 planos/dia, 2 falhas por oportunidade em 24 h) moram em createOpportunityPlan.
//  (c) Etapa 4B: pede as peças (rascunhos) dos planos APROVADOS que ainda não têm — só despacha ao creative-generate; os freios
//      (3 peças por plano, 6 por empresa por dia, idempotência) moram em opportunityPiecesRun/opportunityPieces.
// Busca que falhou há < 6 h não é tentada de novo (e não ocupa vaga das 3 empresas).
// Cabe nos 150 s: poucas empresas por chamada e nenhum trabalho de IA novo depois de 40 s (uma chamada à IA leva
// no máx. 100 s). O que sobrar fica para a próxima chamada do agendamento.
import { hasPaidAccess } from './access.ts'
import { runOpportunities, type Llm } from './opportunityRun.ts'
import { MAX_PLANS_PER_DAY } from './opportunityPlan.ts'
import { createOpportunityPlan } from './opportunityPlanRun.ts'
import { generateOpportunityPieces, type Dispatch } from './opportunityPiecesRun.ts'
import { STALE_DISPATCH_MS } from './opportunityPieces.ts'

type Admin = { from: (t: string) => any; rpc?: any } // eslint-disable-line @typescript-eslint/no-explicit-any
export const RERUN_AFTER_MS = 7 * 24 * 3600_000
export const RETRY_AFTER_FAIL_MS = 6 * 3600_000
export const COMPANIES_PER_CALL = 3
export const START_NEW_AI_UNTIL_MS = 40_000

/** Roda a busca? Sem rodada anterior, rodada com > 7 dias, ou sinal de mercado criado depois da última rodada. */
export function shouldRunOpportunities(lastRunMs: number | null, latestSignalMs: number | null, nowMs: number, lastFailMs: number | null = null): boolean {
  if (lastFailMs != null && Number.isFinite(lastFailMs) && nowMs - lastFailMs < RETRY_AFTER_FAIL_MS && (lastRunMs == null || lastFailMs > lastRunMs)) return false // falhou há pouco: não tenta a cada chamada
  if (lastRunMs == null || !Number.isFinite(lastRunMs)) return true
  if (nowMs - lastRunMs > RERUN_AFTER_MS) return true
  return latestSignalMs != null && Number.isFinite(latestSignalMs) && latestSignalMs > lastRunMs
}

/** Segundo plano do Supabase (EdgeRuntime.waitUntil); fora dele, só deixa a promessa seguir. */
export function runInBackground(p: Promise<unknown>): void {
  try {
    // @ts-ignore — EdgeRuntime é o global do Supabase Edge Functions pra background tasks
    EdgeRuntime.waitUntil(p)
  } catch { void p.catch(() => {}) }
}

const ms = (v: unknown): number | null => { const t = typeof v === 'string' ? Date.parse(v) : NaN; return Number.isFinite(t) ? t : null }

export interface CronSummary { ok: boolean; skipped_reason?: string; companies_checked: number; ran: number; plans: number; pieces: number }

export async function cronOpportunities(admin: Admin, llm: Llm, started = Date.now(), dispatch?: Dispatch): Promise<CronSummary> {
  const sum: CronSummary = { ok: true, companies_checked: 0, ran: 0, plans: 0, pieces: 0 }
  // Interruptor GERAL (painel Owner), o mesmo do cron de estratégia.
  const { data: cfg } = await admin.from('hermes_config').select('auto_strategy_enabled').eq('id', true).maybeSingle()
  if (cfg && cfg.auto_strategy_enabled === false) return { ...sum, skipped_reason: 'auto_strategy_enabled=false no painel Owner' }

  const { data: companies } = await admin.from('companies').select('id, business_name, vertical_key').eq('auto_strategy', true).eq('active', true).limit(200)
  const aiWindowOpen = () => Date.now() - started < START_NEW_AI_UNTIL_MS
  let worked = 0

  for (const c of (companies ?? []) as { id: string; vertical_key: string | null }[]) {
    if (worked >= COMPANIES_PER_CALL || !aiWindowOpen()) break
    try {
      if (!(await hasPaidAccess(admin, c.id))) continue // conta vitrine: cron não gasta IA
      const { data: pb } = await admin.from('vertical_playbooks').select('config').eq('key', c.vertical_key ?? '').eq('enabled', true).maybeSingle()
      if (!(pb?.config as { opportunity_fields?: { location?: string } } | null)?.opportunity_fields?.location) continue // setor sem o motor
      sum.companies_checked++

      const staleBefore = new Date(Date.now() - STALE_DISPATCH_MS).toISOString()
      const [{ data: lastRun }, { data: lastFail }, { data: lastSignal }, { data: pending }, { data: needPieces }] = await Promise.all([
        admin.from('agent_performance').select('created_at').eq('company_id', c.id).eq('task_key', 'run_opportunities').eq('success', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        admin.from('agent_performance').select('created_at').eq('company_id', c.id).eq('task_key', 'run_opportunities').eq('success', false).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        admin.from('market_signals').select('created_at').eq('company_id', c.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        admin.from('growth_opportunities').select('id').eq('company_id', c.id).eq('status', 'approved').is('plan', null).order('decided_at', { ascending: true }).limit(MAX_PLANS_PER_DAY),
        // Etapa 4B: plano aprovado pelo dono e ainda sem peças (nunca despachado, ou despachado há > 30 min). Quem confere de verdade é generateOpportunityPieces.
        admin.from('growth_opportunities').select('id').eq('company_id', c.id).eq('status', 'approved').not('plan', 'is', null).not('plan_approved_at', 'is', null).or(`pieces_generated_at.is.null,pieces_generated_at.lt.${staleBefore}`).order('plan_approved_at', { ascending: true }).limit(3),
      ])
      let did = false
      if (shouldRunOpportunities(ms(lastRun?.created_at), ms(lastSignal?.created_at), Date.now(), ms(lastFail?.created_at))) {
        const r = await runOpportunities(admin, c.id, llm)
        if (!r.ok) console.error(`[cron_opportunities] ${c.id} run: ${r.status} ${r.error}`)
        else sum.ran++
        did = true
      }
      for (const o of (pending ?? []) as { id: string }[]) {
        if (!aiWindowOpen()) break
        const r = await createOpportunityPlan(admin, c.id, o.id, llm)
        if (r.code !== 'failures' && r.code !== 'daily_limit') did = true // pular por falhas/limite não ocupa vaga das 3
        if (r.ok && !r.reused) sum.plans++
        if (r.code === 'daily_limit') break // limite do dia desta empresa: o resto fica pra amanhã
      }
      // Peças dos planos aprovados (rede de segurança): só despacha ao creative-generate, sem IA aqui — não ocupa vaga das 3 empresas.
      if (dispatch) {
        for (const o of (needPieces ?? []) as { id: string }[]) {
          const r = await generateOpportunityPieces(admin, c.id, o.id, dispatch)
          if (r.ok && !r.reused && (r.dispatched ?? 0) > 0) sum.pieces += r.dispatched ?? 0
          if (r.code === 'daily_limit' || r.code === 'migration_pending') break
        }
      }
      if (did) worked++
    } catch (e) {
      console.error(`[cron_opportunities] empresa ${c.id}:`, String(e))
    }
  }
  return sum
}
