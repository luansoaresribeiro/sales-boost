// Trava da legenda do tour (pura, testada em scripts/test-caption-guard.mjs).
// O vídeo do tour é uma ANIMAÇÃO por IA feita a partir de uma foto real — a
// legenda não pode dizer que foi "filmado", "sem edição" etc., nem prometer
// duração ("5 segundos"), e não deve abrir sempre do mesmo jeito. A lista de
// frases proibidas vem da ficha (config.tour.forbidden_claims); o padrão de
// duração é geral (não é de setor).

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// "5 s", "5 seg", "cinco segundos", "em segundos"… (não pega "segundo quarto": singular sem número).
const NUM_WORDS = 'um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|quinze|vinte|trinta'
const DURATION_RE = new RegExp(`(?:\\b\\d+(?:[.,]\\d+)?\\s*(?:s|seg|segs|segundos?)\\b|\\b(?:${NUM_WORDS})\\s+segundos?\\b|\\bsegundos\\b)`, 'i')

/** Frases proibidas achadas no texto (as da lista + qualquer menção a duração em segundos). */
export function findForbidden(text: string, forbidden: string[]): string[] {
  const t = norm(text), out: string[] = []
  for (const f of forbidden) {
    const n = norm(f).trim()
    if (n && new RegExp(`(?<![a-z0-9])${escRe(n)}`, 'i').test(t)) out.push(f)
  }
  const d = DURATION_RE.exec(t)
  if (d) out.push(`duração (“${d[0]}”)`)
  return out
}

/** Primeiras N palavras (sem acento/pontuação) — a "abertura" da legenda. */
export function openingOf(text: string, n = 4): string {
  return norm(text).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0, n).join(' ')
}

/** true se a abertura repete a de alguma legenda anterior do mesmo imóvel. */
export function repeatsOpening(caption: string, previous: string[], n = 4): boolean {
  const o = openingOf(caption, n)
  return !!o && o.split(' ').length >= Math.min(n, 2) && previous.some(p => openingOf(p, n) === o)
}

export interface GuardResult { ok: boolean; forbidden: string[]; repeated: boolean }
export function checkCaption(caption: string, forbidden: string[], previous: string[]): GuardResult {
  const f = findForbidden(caption, forbidden)
  const r = repeatsOpening(caption, previous)
  return { ok: f.length === 0 && !r, forbidden: f, repeated: r }
}

/** Tira as frases que ainda têm algo proibido (reserva depois da reescrita). `changed` = algo saiu. */
export function stripForbidden(caption: string, forbidden: string[]): { text: string; changed: boolean } {
  const parts = caption.match(/[^.!?\n]+[.!?]*\s*|\n+/g) ?? [caption]
  const kept = parts.filter(p => !p.trim() || findForbidden(p, forbidden).length === 0)
  const text = kept.join('').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  return { text, changed: text !== caption.trim() }
}

/** Instruções prontas pro prompt: o que o vídeo É, o que não dizer, como não abrir. */
export function promptRules(forbidden: string[], previous: string[], n = 4): string {
  const openings = [...new Set(previous.map(p => openingOf(p, n)).filter(Boolean))].slice(0, 6)
  return [
    'O vídeo é uma ANIMAÇÃO por IA feita a partir de uma foto real do imóvel (o movimento de câmera é criado por IA). Nunca diga nem sugira que foi filmado ou gravado no local.',
    `Nunca use estas expressões (nem variações): ${forbidden.join(', ')}. Nunca cite a duração do vídeo nem “segundos”.`,
    openings.length ? `Não comece a legenda com nenhuma destas aberturas (já usadas neste imóvel): ${openings.map(o => `“${o}…”`).join(' · ')}.` : '',
  ].filter(Boolean).join('\n')
}

/** Pedido de reescrita (1 vez) quando a trava reprova. */
export function rewriteRequest(r: GuardResult, previous: string[], n = 4): string {
  const bits: string[] = []
  if (r.forbidden.length) bits.push(`remova/troque: ${r.forbidden.join(', ')}`)
  if (r.repeated) bits.push(`mude a abertura (não pode começar como: ${[...new Set(previous.map(p => openingOf(p, n)))].slice(0, 6).map(o => `“${o}…”`).join(', ')})`)
  return `Reescreva a legenda: ${bits.join('; ')}. Mantenha o resto, sem acrescentar fato novo.`
}
