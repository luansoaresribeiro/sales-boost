// Refazer sozinho a peça com nota ruim — no máximo 1 vez (2026-10-26, "Tudo automático"). PURO (sem Deno,
// sem rede): roda no Deno (content-test) e no Node (scripts/test-auto-redo.mjs).
//
// Escopo CONSERVADOR de propósito ("na dúvida, só post/carrossel de texto"): refaz SÓ o texto (ideia, legenda,
// hashtags, CTA) quando a nota de COERÊNCIA DO TEXTO ficou ruim. Fica de fora: problema só visual (card/foto —
// regerar imagem custa e card de texto não se conserta aqui), peça de imóvel/pacote/vídeo (tem dado real do item
// e/ou custo Higgsfield), carrossel de tema regulado (texto vem de dica conferida em fonte oficial) e peça que
// já foi refeita uma vez. Sem custo de imagem e sem Higgsfield: só 1 reescrita + 1 nota (Haiku).

export interface RedoPiece {
  status?: string | null
  scores?: { coherence?: { score?: number } } | null
  brief?: Record<string, unknown> | null
  item_id?: string | null
  recipe?: string | null
  slides?: unknown
}

export function autoRedoEligible(p: RedoPiece, badBelow = 50): { ok: boolean; reason: string } {
  const brief = p.brief && typeof p.brief === 'object' ? p.brief : {}
  if (brief.auto_redo === true) return { ok: false, reason: 'já foi refeita 1 vez' }
  if (p.status === 'vault') return { ok: false, reason: 'já passou na análise' }
  const c = p.scores?.coherence?.score
  if (typeof c !== 'number' || c >= badBelow) return { ok: false, reason: 'o problema não é o texto' }
  if (p.item_id || p.recipe) return { ok: false, reason: 'peça de imóvel/pacote/vídeo (dado real ou custo pago)' }
  if (Array.isArray(p.slides) && p.slides.length) return { ok: false, reason: 'carrossel (slides já desenhados não mudam com o texto)' }
  const ds = brief.deck_source as { mode?: unknown } | undefined
  if (ds && ds.mode === 'regulado') return { ok: false, reason: 'carrossel de tema regulado (texto vem de dica conferida)' }
  return { ok: true, reason: 'ok' }
}

const numTokens = (t: string): string[] => (t.match(/\d+(?:[.,]\d+)*/g) ?? []).map(x => x.replace(/[.,]/g, ''))

/** Números que aparecem no texto novo e NÃO existiam no antigo (a reescrita não pode inventar número). */
export function newNumbers(before: string, after: string): string[] {
  const had = new Set(numTokens(before))
  return [...new Set(numTokens(after).filter(n => !had.has(n)))]
}
