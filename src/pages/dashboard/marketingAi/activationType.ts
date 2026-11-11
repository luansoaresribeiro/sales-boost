// Tipo de ativação e objetivo de uma peça do calendário (Pacote A, 2026-11-03). Funções PURAS (testadas em scripts/test-activation-type.mjs).
// Regra decidida com SQL real (docs/DECISIONS.md, 2026-11-03 "Pacote A"). Nada de nome de receita ou de setor aqui (regra 6):
// só a família da peça, se tem imóvel ligado (item_id) e se tem oportunidade aprovada.
export type ActivationKind = 'opportunity' | 'property' | 'educational_with_property' | 'educational_without_property' | 'unknown'
export interface PieceFields { familia?: string | null; item_id?: string | null; opportunity_id?: string | null }
export interface OppRef { id: string; title: string; status: string }
/** Oportunidades da empresa por id. `null` = a consulta falhou (não dá pra afirmar nada sobre oportunidade). */
export type OppMap = Record<string, OppRef> | null

export interface ActivationResult { kind: ActivationKind; state: 'ok' | 'unverifiable' }

export function activationType(piece: PieceFields, oppById: OppMap): ActivationResult {
  const hasItem = !!piece.item_id
  if (piece.opportunity_id) {
    if (oppById === null) return { kind: 'unknown', state: 'unverifiable' }
    const o = oppById[piece.opportunity_id]
    return o && o.status === 'approved' ? { kind: 'opportunity', state: 'ok' } : { kind: 'unknown', state: 'ok' }
  }
  switch (piece.familia) {
    case 'tour': case 'oferta': case 'bairro': return { kind: hasItem ? 'property' : 'unknown', state: 'ok' }
    case 'educativo': return { kind: hasItem ? 'educational_with_property' : 'educational_without_property', state: 'ok' }
    default: return { kind: 'unknown', state: 'ok' } // null, 'eventual' ou fora da lista
  }
}

export interface PieceObjective { key: 'funnel' | 'opportunity'; label: string; text: string }
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Objetivo gravado na intenção da peça: o da etapa do funil; senão o da oportunidade; senão null ("Sem objetivo registrado"). */
export function pieceObjective(intent: unknown): PieceObjective | null {
  if (!intent || typeof intent !== 'object') return null
  const i = intent as { funnel?: { objective?: unknown } | null; opportunity?: { objective?: unknown } | null }
  const f = str(i.funnel?.objective)
  if (f) return { key: 'funnel', label: 'Objetivo da etapa do funil', text: f }
  const o = str(i.opportunity?.objective)
  if (o) return { key: 'opportunity', label: 'Objetivo da oportunidade', text: o }
  return null
}

export interface MarketEvidence { id: string; title: string; source_name: string | null; source_url: string | null; observed_at: string | null }
/** "Tema inspirado em": só devolve algo se a peça gravou evidência (intent.market_context.evidence). Nunca deduz nada. Link só http(s). */
export function marketEvidence(intent: unknown): MarketEvidence[] {
  const ev = (intent as { market_context?: { evidence?: unknown } } | null)?.market_context?.evidence
  if (!Array.isArray(ev)) return []
  return ev.slice(0, 8).flatMap(e => {
    const title = str((e as { title?: unknown })?.title)
    if (!title) return []
    const url = str((e as { source_url?: unknown }).source_url)
    return [{ id: str((e as { id?: unknown }).id) || title, title, source_name: str((e as { source_name?: unknown }).source_name) || null, source_url: url && /^https?:\/\//i.test(url) ? url : null, observed_at: str((e as { observed_at?: unknown }).observed_at) || null }]
  })
}
