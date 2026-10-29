// Opportunity Engine — Etapa 4B: plano aprovado → peças em RASCUNHO, automático (banco + despacho). A decisão de verdade
// (quantas, de que formato, limites, idempotência) está em opportunityPieces.ts; a montagem de cada peça, no
// creative-generate (plan_slot com opportunity_id → opportunityPieceJob.ts), o MESMO motor que o calendário usa.
//
// Disparo: (1) marketing-ai → 'approve_opportunity_plan' (dono aprovou o plano) e (2) rede de segurança do cron
// 'cron_opportunities'. Não há botão de gerar (princípio "Tudo automático"): a única ação humana é aprovar.
// Nada é publicado: cada peça nasce rascunho na Central de Aprovações (regra 1). Aprovar o plano de novo, o cron e o
// duplo clique não geram de novo: `pieces_generated_at` é reservado de forma atômica ANTES de despachar.
import type { Lang } from './opportunityEngine.ts'
import type { OpportunityPlan } from './opportunityPlan.ts'
import { CREATED_TASK_KEY, PIECES_TASK_KEY, RETRY_TASK_KEY, decidePieces, idempotency, type PieceSpec } from './opportunityPieces.ts'

// deno-lint-ignore no-explicit-any
type Admin = { from: (t: string) => any }
/** Despacha UMA peça ao creative-generate (plan_slot). true = aceita (o trabalho segue em segundo plano). */
export type Dispatch = (body: Record<string, unknown>) => Promise<boolean>
const DAY_MS = 24 * 3600_000
const isUuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s)
const tr = (lang: Lang, pt: string, en: string) => (lang === 'en' ? en : pt)

export interface PiecesRunResult { ok: boolean; status: number; error?: string; dispatched?: number; reused?: boolean; code?: 'daily_limit' | 'not_ready' | 'migration_pending' | 'dispatch_failed' }

export async function generateOpportunityPieces(admin: Admin, companyId: string, opportunityId: unknown, dispatch: Dispatch): Promise<PiecesRunResult> {
  const { data: co } = await admin.from('companies').select('language').eq('id', companyId).maybeSingle()
  const lang: Lang = co?.language === 'en' ? 'en' : 'pt'
  if (!isUuid(opportunityId)) return { ok: false, status: 400, error: 'opportunity_id é obrigatório.' }

  // Sempre filtrando por empresa. Erro aqui = migration das peças ainda não aplicada → não gera (sem idempotência não há segurança).
  const { data: row, error: rowErr } = await admin.from('growth_opportunities').select('id, status, plan, plan_approved_at, pieces_generated_at, item_ids').eq('id', opportunityId).eq('company_id', companyId).maybeSingle()
  if (rowErr) return { ok: false, status: 503, code: 'migration_pending', error: `growth_opportunities: ${rowErr.message}` }
  if (!row) return { ok: false, status: 404, error: tr(lang, 'Oportunidade não encontrada.', 'Opportunity not found.') }
  if (row.status !== 'approved' || !row.plan || !row.plan_approved_at) return { ok: false, status: 409, code: 'not_ready', error: tr(lang, 'O plano precisa estar aprovado.', 'The plan must be approved.') }
  const plan = row.plan as OpportunityPlan

  const since = new Date(Date.now() - DAY_MS).toISOString()
  const countOf = async (table: string, col: string): Promise<number | null> => {
    const { count, error } = await admin.from(table).select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq(col, opportunityId)
    return error ? null : (count ?? 0)
  }
  const [drafts, posts, { count: created }, { count: retriedRows }, { count: usedToday }] = await Promise.all([
    countOf('marketing_ai_test_content', 'opportunity_id'),
    countOf('posts', 'opportunity_id'),
    // Sem janela de tempo: peça que já existiu (mesmo com o rascunho excluído depois) nunca é regerada sozinha.
    admin.from('agent_performance').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('task_key', CREATED_TASK_KEY).like('task_description', `opp:${row.id}%`),
    admin.from('agent_performance').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('task_key', RETRY_TASK_KEY).like('task_description', `opp:${row.id}%`),
    admin.from('agent_performance').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('task_key', PIECES_TASK_KEY).eq('success', true).gte('created_at', since),
  ])
  if (drafts === null) return { ok: false, status: 503, code: 'migration_pending', error: 'marketing_ai_test_content.opportunity_id ausente (migration pendente).' }
  const existing = drafts + (posts ?? 0) // a peça aprovada vira post e some dos rascunhos: conta os dois
  const idem = idempotency({ generatedAt: row.pieces_generated_at ?? null, existingPieces: existing, everCreated: created ?? 0, retried: (retriedRows ?? 0) > 0, nowMs: Date.now() })
  if (idem === 'already') return { ok: true, status: 200, reused: true, dispatched: 0 }

  // Fotos reais dos itens do plano (regra 4): quantas cada um tem decide se vira peça de foto ou de texto.
  const itemIds = [...new Set([...(Array.isArray(plan.item_ids) ? plan.item_ids : []), ...((row.item_ids ?? []) as string[])])].filter(isUuid)
  const photoCounts: Record<string, number> = {}
  if (itemIds.length) {
    const { data } = await admin.from('marketing_ai_knowledge').select('id, meta').eq('company_id', companyId).eq('kind', 'product').in('id', itemIds).limit(50)
    for (const i of (data ?? []) as { id: string; meta: { photos?: unknown[] } | null }[]) photoCounts[i.id] = i.meta?.photos?.length ?? 0
  }
  const decision = decidePieces({ plan, photoCounts, usedToday: usedToday ?? 0, existingPieces: existing, lang })
  if (decision.skip === 'daily_limit') return { ok: true, status: 200, code: 'daily_limit', dispatched: 0 }
  if (decision.skip || decision.specs.length === 0) return { ok: true, status: 200, reused: true, dispatched: 0 }

  // Reserva atômica: só UMA chamada passa (aprovação + cron, ou duas abas). Em 'retry' só vale se o valor antigo ainda é o mesmo.
  const now = new Date().toISOString()
  let claim = admin.from('growth_opportunities').update({ pieces_generated_at: now }).eq('id', row.id).eq('company_id', companyId).eq('status', 'approved').not('plan_approved_at', 'is', null)
  claim = row.pieces_generated_at ? claim.eq('pieces_generated_at', row.pieces_generated_at) : claim.is('pieces_generated_at', null)
  const { data: claimed, error: claimErr } = await claim.select('id')
  if (claimErr) return { ok: false, status: 503, code: 'migration_pending', error: `growth_opportunities: ${claimErr.message}` }
  if (!claimed || claimed.length === 0) return { ok: true, status: 200, reused: true, dispatched: 0 }

  // Retentativa explícita e única: a linha é gravada logo após a reserva (quem perdeu a reserva não chega aqui).
  if (idem === 'retry') {
    try { await admin.from('agent_performance').insert({ company_id: companyId, agent_role: 'cmo', task_key: RETRY_TASK_KEY, task_description: `opp:${row.id} retentativa`, tokens_used: 0, success: true }) } catch { /* não-fatal */ }
  }

  // Despacho: cada peça é uma chamada própria (relógio próprio de 150 s no creative-generate); esperamos só o aceite.
  const results = await Promise.all(decision.specs.map(async (spec: PieceSpec) => {
    let ok = false
    try { ok = await dispatch({ company_id: companyId, opportunity_id: row.id, piece: spec }) } catch (e) { console.error('[opportunity-pieces] despacho falhou', row.id, String(e)) }
    try {
      await admin.from('agent_performance').insert({
        company_id: companyId, agent_role: 'cmo', task_key: PIECES_TASK_KEY, task_description: `opp:${row.id} ${spec.format}/${spec.mode}`.slice(0, 200),
        tokens_used: 0, success: ok, ...(ok ? {} : { error_message: 'creative-generate não aceitou a peça' }),
      })
    } catch { /* não-fatal */ }
    return ok
  }))
  const dispatched = results.filter(Boolean).length
  if (dispatched === 0) {
    // Nada aceito (sem plano pago, função fora do ar…): devolve a reserva para a rede de segurança tentar depois.
    await admin.from('growth_opportunities').update({ pieces_generated_at: row.pieces_generated_at ?? null }).eq('id', row.id).eq('company_id', companyId).eq('pieces_generated_at', now)
    return { ok: false, status: 502, code: 'dispatch_failed', dispatched: 0, error: tr(lang, 'Não consegui pedir as peças agora. O sistema tenta de novo sozinho.', 'Could not request the pieces right now. The system will retry on its own.') }
  }

  // Registra no plano o que aconteceu (vídeo adiado, peça de texto no lugar de foto, limite…). Tolerante.
  try {
    const info = { requested_format: plan.format_suggestion, used_format: decision.format, video_deferred: decision.videoDeferred, dispatched, notes: decision.notes, at: now }
    await admin.from('growth_opportunities').update({ plan: { ...plan, pieces_info: info } }).eq('id', row.id).eq('company_id', companyId)
  } catch (e) { console.error('[opportunity-pieces] pieces_info não gravado', String(e)) }
  return { ok: true, status: 200, dispatched }
}
