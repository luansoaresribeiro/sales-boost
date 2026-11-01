// Opportunity Engine — Etapa 4B: monta a "vaga" de UMA peça de oportunidade para o motor de criação que o
// calendário já usa (creative-generate → runPlanSlot → generateForCompany / catalog-package). Assim a peça herda
// todas as travas de sempre (intentBlock, trava do QUERO, recados internos, tema do carrossel, render-format, fotos
// reais, nada de texto em imagem de IA).
//
// SEGURANÇA: o `opportunity_id` e a escolha da peça chegam de uma chamada interna autenticada (cron_secret), mas NADA do
// corpo é confiado: o plano é recarregado do banco filtrando por empresa e precisa estar APROVADO (status e plano).
// O item precisa fazer parte do plano e ter fotos reais suficientes; senão a peça vira texto.
import { familyOf, fetchFormatAliases, fetchFormatCatalog, type ContentFormat } from './formatCatalog.ts'
import { resolveAlias } from './deckTopic.ts'
import { buildOpportunityIntent, type SlotIntent } from './slotIntent.ts'
import { MAX_PIECES_PER_PLAN } from './opportunityPlan.ts'
import { itemUsable, resolveFormatKey, videoFree, type PieceMode } from './opportunityPieces.ts'

// deno-lint-ignore no-explicit-any
type Admin = { from: (t: string) => any }

export interface OppJob {
  date: ''; producer: 'post' | 'item_package'; name: string; pillar: string; purpose: string
  recipe?: string; item_id?: string; format?: string; familia?: string; tema?: string
  intent: SlotIntent | null; opportunity_id: string
}
export type OppJobResult = { ok: true; job: OppJob; mode: PieceMode } | { ok: false; status: number; error: string }

const isUuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s)
const fail = (status: number, error: string): OppJobResult => ({ ok: false, status, error })

/** `deckFallbackKey`: o carrossel de slides genérico do creative-generate (DECK_FORMAT), para setor sem mapa na ficha. */
export async function buildOpportunityJob(admin: Admin, company: { id: string; vertical_key: string | null }, opportunityId: unknown, piece: unknown, deckFallbackKey: string): Promise<OppJobResult> {
  if (!isUuid(opportunityId)) return fail(400, 'opportunity_id inválido')
  const p = (piece && typeof piece === 'object' ? piece : {}) as { format?: unknown; mode?: unknown; item_id?: unknown }
  // Sempre filtrando por empresa e exigindo plano aprovado: o id vem do corpo, a verdade vem do banco.
  const { data: row } = await admin.from('growth_opportunities').select('id, title, status, plan, plan_approved_at, item_ids').eq('id', opportunityId).eq('company_id', company.id).maybeSingle()
  if (!row) return fail(404, 'oportunidade não encontrada')
  if (row.status !== 'approved' || !row.plan || !row.plan_approved_at) return fail(409, 'plano não aprovado')

  // Limite do plano também aqui (cinto e suspensório): nunca mais de 3 peças por oportunidade.
  const { count: have, error: cerr } = await admin.from('marketing_ai_test_content').select('id', { count: 'exact', head: true }).eq('company_id', company.id).eq('opportunity_id', opportunityId)
  if (!cerr && (have ?? 0) >= MAX_PIECES_PER_PLAN) return fail(409, 'limite de peças do plano')

  const { format } = videoFree(p.format) // vídeo nunca: custa à parte
  let mode: PieceMode = p.mode === 'item' ? 'item' : 'text'
  let itemId: string | undefined
  if (mode === 'item') {
    const planItems = [...((row.plan as { item_ids?: unknown }).item_ids as unknown[] ?? []), ...((row.item_ids as unknown[]) ?? [])]
    const { data: it } = isUuid(p.item_id) ? await admin.from('marketing_ai_knowledge').select('id, meta').eq('id', p.item_id).eq('company_id', company.id).eq('kind', 'product').maybeSingle() : { data: null }
    const photos = (it?.meta as { photos?: unknown[] } | null)?.photos?.length ?? 0
    if (it && itemUsable(p.item_id, planItems, photos)) itemId = it.id as string
    else mode = 'text' // sem foto real suficiente: nunca inventa imagem de imóvel (regra 4)
  }

  const [formats, aliases, { data: pb }] = await Promise.all([
    fetchFormatCatalog(admin, company.vertical_key ?? 'generico', company.id),
    fetchFormatAliases(admin, company.vertical_key ?? 'generico'),
    admin.from('vertical_playbooks').select('config').eq('key', company.vertical_key ?? 'generico').eq('enabled', true).maybeSingle(),
  ])
  const cfg = (pb?.config as { opportunity_pieces?: unknown } | null)?.opportunity_pieces
  let target = resolveFormatKey(cfg, format, mode, formats)
  if (!target && mode === 'item') { mode = 'text'; itemId = undefined; target = resolveFormatKey(cfg, format, mode, formats) } // setor sem mapa de foto
  const f: ContentFormat | undefined = target?.key ? formats.find(x => x.key === target!.key) : undefined

  const plan = row.plan as { objective?: string; key_message?: string }
  const purpose = [plan.objective, plan.key_message].filter(Boolean).join(' — ').slice(0, 240)
  const base = { date: '' as const, purpose, intent: buildOpportunityIntent(row.title, row.plan), opportunity_id: opportunityId }
  if (mode === 'item' && f && itemId) {
    return { ok: true, mode, job: { ...base, producer: 'item_package', name: f.name, pillar: f.pillar, recipe: f.recipe, item_id: itemId, format: f.key, familia: familyOf(f), tema: f.pillar } }
  }
  // Texto: o formato de post mapeado na ficha ou o carrossel de slides genérico (apelido da ficha resolvido).
  const key = f?.key ?? resolveAlias(deckFallbackKey, aliases)
  const tf = formats.find(x => x.key === key)
  return { ok: true, mode: 'text', job: { ...base, producer: 'post', name: tf?.name ?? 'Carrossel de slides', pillar: tf?.pillar ?? 'qualquer', format: key, familia: tf ? familyOf(tf) : 'educativo', tema: tf?.pillar ?? 'qualquer' } }
}
