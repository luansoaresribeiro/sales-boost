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
