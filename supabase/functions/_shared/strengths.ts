// Pontos fortes, item 4 (dono, 22/11 — docs/PONTOS-FORTES.md §1 e §3): as marcas do imóvel decidem a FOTO DE ABERTURA e a
// PRIMEIRA FRASE da legenda. Regras na ficha (config.strengths, regra 6): quais campos são marcas, que cômodo cada marca puxa
// para a capa e a ordem de força das marcas. Sem marca = como antes. Nunca afirma o que não foi marcado. Puro, testado em
// scripts/test-strengths.mjs.
import type { CoverRooms } from './carouselOffer.ts'

export interface StrengthsCfg { fields: string[]; rooms: Record<string, string[]> }

export function strengthsCfgFrom(config: unknown): StrengthsCfg | null {
  const s = ((config && typeof config === 'object' ? config : {}) as { strengths?: { fields?: unknown; rooms?: unknown } }).strengths
  if (!s) return null
  const fields = Array.isArray(s.fields) ? s.fields.filter((f): f is string => typeof f === 'string' && /^[a-z_]{1,40}$/.test(f)).slice(0, 6) : []
  const rooms: Record<string, string[]> = {}
  for (const [mark, list] of Object.entries(s.rooms && typeof s.rooms === 'object' ? s.rooms as Record<string, unknown> : {})) {
    const r = (Array.isArray(list) ? list : []).filter((x): x is string => typeof x === 'string' && /^[a-z_]{1,40}$/.test(x))
    if (mark.trim() && r.length) rooms[mark] = r
  }
  return fields.length ? { fields, rooms } : null
}

/** Marcas do imóvel na ordem dos campos da ficha (imóvel antes de localização), sem repetir. */
export function itemMarks(fields: Record<string, unknown> | null | undefined, cfg: StrengthsCfg | null): string[] {
  if (!cfg) return []
  const out: string[] = []
  for (const k of cfg.fields) for (const m of Array.isArray(fields?.[k]) ? fields![k] as unknown[] : []) if (typeof m === 'string' && m.trim() && !out.includes(m)) out.push(m)
  return out
}

/** Capa: os cômodos que as marcas puxam vêm antes da preferência da ficha (os "a evitar" continuam evitados). */
export function coverRoomsWithMarks(base: CoverRooms | null, marks: string[], cfg: StrengthsCfg | null): { rooms: CoverRooms | null; why: string | null } {
  if (!cfg || !marks.length) return { rooms: base, why: null }
  const front: string[] = []
  let why: string | null = null
  for (const m of marks) for (const r of cfg.rooms[m] ?? []) if (!front.includes(r) && !base?.avoid.includes(r)) { front.push(r); why ??= m }
  if (!front.length) return { rooms: base, why: null }
  return { rooms: { priority: [...front, ...(base?.priority ?? []).filter(r => !front.includes(r))], avoid: base?.avoid ?? [] }, why }
}

/** Linha do prompt: a primeira frase nasce do ponto forte mais forte marcado (texto da marca, sem acrescentar). */
export function hookLine(marks: string[]): string {
  if (!marks.length) return ''
  return `\nPONTOS FORTES MARCADOS PELO CORRETOR (fatos): ${marks.join(' · ')}. Abra a legenda pelo primeiro ("${marks[0]}"), com palavras suas, sem exagerar e sem acrescentar nada que não esteja aqui.`
}

/** A foto que a marca escolheu, SÓ se existir foto de um cômodo que a marca puxa (senão null: nada é anotado como "escolhido
 *  pela marca"). Caso de 22/11: a receita "detalhe" usava a última foto (quarto) e a legenda falava da varanda marcada. */
export function markedPhoto<P extends { url: string; room?: unknown }>(photos: P[], marks: string[], cfg: StrengthsCfg | null): { photo: P; mark: string } | null {
  if (!cfg) return null
  for (const m of marks) for (const r of cfg.rooms[m] ?? []) {
    const p = photos.find(x => typeof x?.url === 'string' && /^https?:\/\//.test(x.url) && x.room === r)
    if (p) return { photo: p, mark: m }
  }
  return null
}
