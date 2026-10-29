// Opportunity Engine — Etapa 4, Parte A: plano da oportunidade (banco + IA). A lógica de verdade (prompt,
// conferência, formato, CTA) está em opportunityPlan.ts. Tudo AUTOMÁTICO (princípio "Tudo automático"): o plano
// é criado sozinho quando o dono aprova a oportunidade (marketing-ai → 'decide_opportunity') ou pela rede de
// segurança do cron ('cron_opportunities'). Não há botão de gerar/refazer; a única ação humana é aprovar/descartar
// (a oportunidade e, depois, o plano: 'approve_opportunity_plan').
//
// Só LÊ dados da empresa e só ESCREVE em growth_opportunities (plan*) e agent_performance. Nada é
// publicado nem enviado (regra 1). Uma chamada à IA, síncrona (AbortSignal de 100 s no cliente da IA,
// abaixo do teto de 150 s — PITFALLS "Limite de 150s").
import type { FieldMap, Lang } from './opportunityEngine.ts'
import { MAX_PLANS_PER_DAY, buildPlanPrompt, describePlanItem, finalizePlan, parsePlan, type OpportunityPlan, type PlanItem, type PlanOpp } from './opportunityPlan.ts'
import type { Llm } from './opportunityRun.ts'

type Admin = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any
export const TASK_KEY = 'create_opportunity_plan'
export const START_KEY = 'create_opportunity_plan_start' // linha gravada antes da IA (conta no limite diário)
const MAX_FAILS_PER_OPP_PER_DAY = 2
const DAY_MS = 24 * 3600_000

export interface PlanRunResult {
  ok: boolean; status: number; error?: string; plan?: OpportunityPlan | null; plan_generated_at?: string | null
  plan_approved_at?: string | null; reused?: boolean; plans_left_today?: number; code?: 'daily_limit' | 'failures'
}
type Bilingual = { pt?: string; en?: string } | string | undefined
const pick = (b: Bilingual, lang: Lang): string => (typeof b === 'string' ? b : b?.[lang] ?? b?.pt ?? '')
const tr = (lang: Lang, pt: string, en: string) => (lang === 'en' ? en : pt)
const isUuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s)

/** Usado só pelo caminho automático (aprovação da oportunidade / cron). Respeita 5 planos por empresa por dia. */
export async function createOpportunityPlan(admin: Admin, companyId: string, opportunityId: unknown, llm: Llm): Promise<PlanRunResult> {
  const started = Date.now()
  const { data: co } = await admin.from('companies').select('id, business_name, language, vertical_key').eq('id', companyId).maybeSingle()
  if (!co) return { ok: false, status: 404, error: 'Empresa não encontrada.' }
  const lang: Lang = co.language === 'en' ? 'en' : 'pt'
  if (!isUuid(opportunityId)) return { ok: false, status: 400, error: tr(lang, 'opportunity_id é obrigatório.', 'opportunity_id is required.') }

  // Sempre filtrando por empresa: o id vem do corpo, a empresa vem do login.
  const { data: row } = await admin.from('growth_opportunities')
    .select('id, status, title, commercial_problem, audience, suggested_action, how_to_measure, evidence, item_ids, plan, plan_generated_at, plan_approved_at')
    .eq('id', opportunityId).eq('company_id', companyId).maybeSingle()
  if (!row) return { ok: false, status: 404, error: tr(lang, 'Oportunidade não encontrada.', 'Opportunity not found.') }
  if (row.status !== 'approved') return { ok: false, status: 400, error: tr(lang, 'Aprove a oportunidade antes de criar o plano.', 'Approve the opportunity before creating its plan.') }

  // Plano já existe (duplo clique / cron concorrente): devolve o que está salvo. Não há "refazer".
  if (row.plan) return { ok: true, status: 200, plan: row.plan, plan_generated_at: row.plan_generated_at, plan_approved_at: row.plan_approved_at ?? null, reused: true }

  // Ficha do setor (regra 6): papéis dos campos, rótulos, vocabulário, ressalva, CTA alternativo.
  const { data: pb } = await admin.from('vertical_playbooks').select('config').eq('key', co.vertical_key ?? '').eq('enabled', true).maybeSingle()
  const cfg = (pb?.config ?? {}) as { opportunity_fields?: FieldMap; catalog_fields?: { required?: { key: string; label?: Bilingual }[]; optional?: { key: string; label?: Bilingual }[] }; vocabulary?: { item?: string }; ctas?: { sem_automacao?: unknown }; opportunity_texts?: { caveat?: Bilingual; audience_hint?: Bilingual } }
  const fieldMap = cfg.opportunity_fields
  if (!fieldMap?.location) return { ok: false, status: 400, error: tr(lang, 'Este setor ainda não tem os campos de oportunidades configurados na ficha.', 'This business type does not have opportunity fields set up yet.') }
  const labels: Record<string, string> = {}
  for (const f of [...(cfg.catalog_fields?.required ?? []), ...(cfg.catalog_fields?.optional ?? [])]) labels[f.key] = pick(f.label, lang).replace(/\s*\(.*\)\s*$/, '')

  const itemIds = ((row.item_ids ?? []) as unknown[]).filter(isUuid)
  let items: PlanItem[] = []
  if (itemIds.length) {
    const { data } = await admin.from('marketing_ai_knowledge').select('id, title, meta').eq('company_id', companyId).eq('kind', 'product').in('id', itemIds).limit(50)
    items = ((data ?? []) as { id: string; title: string; meta: { fields?: Record<string, unknown> } | null }[]).map(i => ({ id: i.id, title: i.title, fields: i.meta?.fields ?? {} }))
  }
  const opp: PlanOpp = {
    title: String(row.title ?? ''), commercial_problem: row.commercial_problem ?? null, audience: row.audience ?? null, suggested_action: row.suggested_action ?? null,
    how_to_measure: row.how_to_measure ?? null, evidence: Array.isArray(row.evidence) ? row.evidence : [], item_ids: items.map(i => i.id),
  }
  const ctas = lang === 'en' ? null : cfg.ctas
  const ctaAlt = lang === 'en' ? 'Send us a DM' : (typeof cfg.ctas?.sem_automacao === 'string' && cfg.ctas.sem_automacao.trim() ? cfg.ctas.sem_automacao.trim() : 'Me chama no direct')
  const prompt = buildPlanPrompt({
    lang, businessName: String(co.business_name ?? ''), itemLabel: cfg.vocabulary?.item ?? 'Item', opp,
    items: items.map(i => ({ id: i.id, text: describePlanItem(i, fieldMap, labels).text })),
    caveat: pick(cfg.opportunity_texts?.caveat, lang) || undefined, audienceHint: pick(cfg.opportunity_texts?.audience_hint, lang) || undefined, ctaAlt,
  })

  // Freios de custo, logo antes da IA (depois de todas as validações, pra um 400 não gastar vaga):
  // (a) no máx. 2 falhas por oportunidade em 24 h — aprovar/desfazer/aprovar com a IA falhando não gasta a cada clique;
  const since = new Date(Date.now() - DAY_MS).toISOString()
  const { count: fails } = await admin.from('agent_performance').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('task_key', TASK_KEY).eq('success', false)
    .like('task_description', `opp:${row.id}%`).gte('created_at', since)
  if ((fails ?? 0) >= MAX_FAILS_PER_OPP_PER_DAY) {
    return { ok: false, status: 429, code: 'failures', error: tr(lang, 'A IA falhou algumas vezes neste plano. O sistema tenta de novo mais tarde, sozinho.', 'The AI failed a few times on this plan. The system will retry later on its own.') }
  }
  // (b) no máx. 5 planos por empresa em 24 h. Cada tentativa grava uma linha "começou" ANTES da IA, então tentativas
  // em andamento já contam; falha devolve a vaga (a linha de falha desconta a de início).
  const [{ count: started24 }, { count: failed24 }] = await Promise.all([
    admin.from('agent_performance').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('task_key', START_KEY).gte('created_at', since),
    admin.from('agent_performance').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('task_key', TASK_KEY).eq('success', false).gte('created_at', since),
  ])
  const used = Math.max(0, (started24 ?? 0) - (failed24 ?? 0))
  if (used >= MAX_PLANS_PER_DAY) {
    return { ok: false, status: 429, code: 'daily_limit', plans_left_today: 0, error: tr(lang,
      `Limite de ${MAX_PLANS_PER_DAY} planos por dia atingido. O plano sai quando houver vaga, nas próximas 24 horas.`,
      `Daily limit of ${MAX_PLANS_PER_DAY} plans reached. The plan will be made when there is room, within the next 24 hours.`) }
  }
  try { await admin.from('agent_performance').insert({ company_id: companyId, agent_role: 'cmo', task_key: START_KEY, task_description: `opp:${row.id} começou`, success: true, tokens_used: 0 }) } catch { /* não-fatal */ }

  let answer: { text: string; tokens: number }
  try {
    answer = await llm(prompt, 2000)
  } catch (e) {
    await logCost(admin, companyId, row.id, started, 0, false, String(e))
    return { ok: false, status: 502, error: tr(lang, 'A IA não respondeu. Tente de novo em um minuto.', 'The AI did not answer. Try again in a minute.') }
  }
  const parsed = parsePlan(answer.text)
  if (!parsed) {
    await logCost(admin, companyId, row.id, started, answer.tokens, false, 'resposta da IA ilegível')
    return { ok: false, status: 502, error: tr(lang, 'Não consegui ler a resposta da IA. Tente de novo.', 'The AI answer could not be read. Try again.') }
  }
  const res = finalizePlan({ lang, opp, items, fieldMap, labels, llm: parsed, ctas })
  if (!res.ok) {
    await logCost(admin, companyId, row.id, started, answer.tokens, false, res.reason)
    return { ok: false, status: 502, error: `${res.reason} ${tr(lang, 'Tente de novo.', 'Try again.')}` }
  }

  // Refazer o plano zera a aprovação: o dono aprova o que está na tela, não um plano antigo.
  const now = new Date().toISOString()
  // Só grava se a oportunidade AINDA está aprovada (pode ter sido descartada enquanto a IA trabalhava).
  const { data: saved, error } = await admin.from('growth_opportunities').update({ plan: res.plan, plan_generated_at: now, plan_approved_at: null }).eq('id', row.id).eq('company_id', companyId).eq('status', 'approved').select('id')
  if (error) {
    await logCost(admin, companyId, row.id, started, answer.tokens, false, error.message)
    return { ok: false, status: 500, error: `growth_opportunities: ${error.message}` }
  }
  if (!saved || saved.length === 0) {
    await logCost(admin, companyId, row.id, started, answer.tokens, false, 'oportunidade deixou de estar aprovada')
    return { ok: false, status: 409, error: tr(lang, 'A oportunidade deixou de estar aprovada; o plano não foi salvo.', 'The opportunity is no longer approved; the plan was not saved.') }
  }
  await logCost(admin, companyId, row.id, started, answer.tokens, true, 'plano criado')
  return { ok: true, status: 200, plan: res.plan, plan_generated_at: now, plan_approved_at: null, plans_left_today: Math.max(0, MAX_PLANS_PER_DAY - used - 1) }
}

// Aprovar (ou desfazer) o PLANO. Só guarda a decisão: nada é publicado nem enviado.
export async function approveOpportunityPlan(admin: Admin, companyId: string, opportunityId: unknown, undo: boolean): Promise<PlanRunResult> {
  const { data: co } = await admin.from('companies').select('language').eq('id', companyId).maybeSingle()
  const lang: Lang = co?.language === 'en' ? 'en' : 'pt'
  if (!isUuid(opportunityId)) return { ok: false, status: 400, error: tr(lang, 'opportunity_id é obrigatório.', 'opportunity_id is required.') }
  const { data: row } = await admin.from('growth_opportunities').select('id, status, plan').eq('id', opportunityId).eq('company_id', companyId).maybeSingle()
  if (!row) return { ok: false, status: 404, error: tr(lang, 'Oportunidade não encontrada.', 'Opportunity not found.') }
  if (!row.plan) return { ok: false, status: 400, error: tr(lang, 'Crie o plano antes de aprová-lo.', 'Create the plan before approving it.') }
  if (!undo && row.status !== 'approved') return { ok: false, status: 400, error: tr(lang, 'A oportunidade precisa estar aprovada.', 'The opportunity must be approved.') }
  const at = undo ? null : new Date().toISOString()
  const { error } = await admin.from('growth_opportunities').update({ plan_approved_at: at }).eq('id', row.id).eq('company_id', companyId)
  if (error) return { ok: false, status: 500, error: `growth_opportunities: ${error.message}` }
  return { ok: true, status: 200, plan_approved_at: at }
}

// Custo da IA registrado como as outras actions (agent_performance); nunca derruba o fluxo. O id da oportunidade
// vai no começo de task_description (é por ele que o duplo clique é reconhecido).
async function logCost(admin: Admin, companyId: string, oppId: string, started: number, tokens: number, success: boolean, note: string) {
  try {
    await admin.from('agent_performance').insert({
      company_id: companyId, agent_role: 'cmo', task_key: TASK_KEY, task_description: `opp:${oppId} ${note}`.slice(0, 200),
      latency_ms: Date.now() - started, tokens_used: tokens, success, ...(success ? {} : { error_message: note.slice(0, 500) }),
    })
  } catch { /* não-fatal */ }
}

// Decisão do dono sobre a OPORTUNIDADE (aprovar / descartar / desfazer). Grava com a service role, sempre filtrando
// pela empresa do login. Ao aprovar uma oportunidade que ainda não tem plano, o plano nasce sozinho em segundo plano
// (`defer`): a resposta sai na hora. Estourou o limite do dia ou a IA falhou → fica sem plano e o cron gera depois.
export async function decideOpportunity(admin: Admin, companyId: string, userId: string, opportunityId: unknown, status: unknown, llm: Llm, defer: (p: Promise<unknown>) => void): Promise<PlanRunResult & { opportunity?: Record<string, unknown> }> {
  const { data: co } = await admin.from('companies').select('language').eq('id', companyId).maybeSingle()
  const lang: Lang = co?.language === 'en' ? 'en' : 'pt'
  if (!isUuid(opportunityId)) return { ok: false, status: 400, error: tr(lang, 'opportunity_id é obrigatório.', 'opportunity_id is required.') }
  if (status !== 'approved' && status !== 'dismissed' && status !== 'suggested') return { ok: false, status: 400, error: tr(lang, 'status inválido.', 'Invalid status.') }
  // Desfazer ou descartar zera a aprovação do plano (o plano em si fica guardado).
  const patch = status === 'suggested' ? { status, decided_at: null, decided_by: null, plan_approved_at: null } : status === 'dismissed' ? { status, decided_at: new Date().toISOString(), decided_by: userId, plan_approved_at: null } : { status, decided_at: new Date().toISOString(), decided_by: userId }
  const { data: row, error } = await admin.from('growth_opportunities').update(patch).eq('id', opportunityId).eq('company_id', companyId)
    .select('id, status, decided_at, decided_by, plan, plan_generated_at, plan_approved_at').maybeSingle()
  if (error) return { ok: false, status: 500, error: `growth_opportunities: ${error.message}` }
  if (!row) return { ok: false, status: 404, error: tr(lang, 'Oportunidade não encontrada.', 'Opportunity not found.') }
  if (status === 'approved' && !row.plan) {
    defer(createOpportunityPlan(admin, companyId, row.id, llm).then(r => { if (!r.ok) console.error(`[opportunity-plan] ${row.id}: ${r.status} ${r.error}`) }).catch(e => console.error('[opportunity-plan]', String(e))))
  }
  return { ok: true, status: 200, opportunity: row }
}
