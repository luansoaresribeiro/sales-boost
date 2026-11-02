// Escolha da foto (e do tipo) do tour automático. Funções PURAS — testadas em
// Node (scripts/test-tour-pick.mjs). Nada de setor aqui (regra 6): a lista de
// cômodos, quais são vizinhos, quais evitar e os pisos de qualidade vêm da
// ficha (vertical_playbooks.config.tour). Sem ficha = sem cômodo conhecido, então
// só sai `room` (e pelo melhor quality), nunca `pair`/`opening`.
//
// Decisões do dono (2026-11-02): foto boa primeiro, variar o cômodo, `opening`
// só com foto real de fora/vista, `pair` só com cômodos que a ficha diz serem
// vizinhos (e a peça avisa que a passagem não foi confirmada por planta).

export type TourKind = 'room' | 'pair' | 'opening'

export interface TourPhoto { url: string; room?: string | null; room_conf?: number | null; quality?: number | null }

export interface TourCfg {
  /** Cômodos que a IA de visão pode devolver (key + rótulo pro prompt). */
  rooms: { key: string; label: string }[]
  /** Pares de cômodos vizinhos (a ordem do par é a ordem da caminhada). */
  adjacent_rooms: [string, string][]
  /** Cômodos aceitos pra abertura de fora (fachada, vista…). */
  opening_rooms: string[]
  /** Ordem de preferência (o que não está na lista vem depois). */
  room_priority: string[]
  /** Só entram se não houver alternativa. */
  avoid_rooms: string[]
  min_quality: number
  min_room_conf: number
  /** Quantos tours recentes do mesmo imóvel têm o cômodo evitado. */
  recent_exclude: number
  forbidden_claims: string[]
  endcard_seconds: number
  /** Campos do cadastro do item que entram no encerramento (lugar e preço; preço só se preenchido). Vazio = não aparece. */
  endcard_place_field: string
  endcard_price_field: string
  /** Formato do catálogo → tipo de tour. */
  format_kinds: Record<string, TourKind>
}

export const DEFAULT_FORMAT_KINDS: Record<string, TourKind> = { video_comodo: 'room', video_dois_comodos: 'pair', video_abertura_vista: 'opening' }
export const DEFAULT_FORBIDDEN = ['filmado', 'filmada', 'filmagem', 'gravado', 'gravada', 'sem edição', 'sem filtro', 'sem encenação', 'sem retoque']
export const DEFAULT_ENDCARD_SECONDS = 2.5
/** Prefixo dos avisos do tour em `reasoning` (o item-videos preserva — ver videoCta.keepQueroNotice). */
export const TOUR_NOTICE_PREFIX = 'Aviso do tour:'
export const PAIR_NOTICE = 'passagem entre cômodos não confirmada por planta (os cômodos são vizinhos só pelo tipo de cada um) — confira o vídeo antes de aprovar.'

const slug = (s: unknown) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
const strList = (v: unknown, max = 40): string[] => (Array.isArray(v) ? v : []).map(x => String(x ?? '').trim()).filter(Boolean).slice(0, max)
const num = (v: unknown, def: number, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : def }

/** Lê config.tour de forma tolerante (qualquer erro = padrão seguro, sem setor). */
export function tourCfgFrom(config: unknown): TourCfg {
  const raw = ((config ?? {}) as { tour?: Record<string, unknown> }).tour
  const t = raw && typeof raw === 'object' ? raw : {}
  const rooms = (Array.isArray(t.rooms) ? t.rooms : []).map(r => {
    const o = (typeof r === 'string' ? { key: r, label: r } : r) as { key?: unknown; label?: unknown }
    const key = slug(o?.key)
    return key ? { key, label: String(o?.label ?? o?.key).slice(0, 60) } : null
  }).filter((r): r is { key: string; label: string } => !!r).slice(0, 30)
  const adjacent = (Array.isArray(t.adjacent_rooms) ? t.adjacent_rooms : []).map(p => (Array.isArray(p) && p.length === 2 ? [slug(p[0]), slug(p[1])] as [string, string] : null))
    .filter((p): p is [string, string] => !!p && !!p[0] && !!p[1] && p[0] !== p[1]).slice(0, 60)
  const fk: Record<string, TourKind> = { ...DEFAULT_FORMAT_KINDS }
  if (t.format_kinds && typeof t.format_kinds === 'object') for (const [k, v] of Object.entries(t.format_kinds as Record<string, unknown>)) if (v === 'room' || v === 'pair' || v === 'opening') fk[k] = v
  return {
    rooms, adjacent_rooms: adjacent,
    opening_rooms: strList(t.opening_rooms).map(slug).filter(Boolean),
    room_priority: strList(t.room_priority).map(slug).filter(Boolean),
    avoid_rooms: strList(t.avoid_rooms).map(slug).filter(Boolean),
    min_quality: num(t.min_quality, 50, 0, 100),
    min_room_conf: num(t.min_room_conf, 0.6, 0, 1),
    recent_exclude: Math.round(num(t.recent_exclude, 2, 0, 10)),
    forbidden_claims: strList(t.forbidden_claims, 80).length ? strList(t.forbidden_claims, 80) : DEFAULT_FORBIDDEN,
    endcard_seconds: num(t.endcard_seconds, DEFAULT_ENDCARD_SECONDS, 1, 6),
    endcard_place_field: /^[a-z0-9_]{1,40}$/i.test(String(t.endcard_place_field ?? '')) ? String(t.endcard_place_field) : '',
    endcard_price_field: /^[a-z0-9_]{1,40}$/i.test(String(t.endcard_price_field ?? '')) ? String(t.endcard_price_field) : '',
    format_kinds: fk,
  }
}

export function kindForFormat(format: string | null | undefined, cfg: Pick<TourCfg, 'format_kinds'>): TourKind | null {
  return (format && cfg.format_kinds[format]) || null
}

/** Rodízio da semana: vaga sem tipo vira `room`; se NENHUMA pediu pair/opening, a 2ª vira um dos dois (alterna por semana). */
export function weekKinds(requested: (TourKind | null)[], weekNo: number): TourKind[] {
  const kinds: TourKind[] = requested.map(k => k ?? 'room')
  if (kinds.length >= 2 && !kinds.some(k => k !== 'room')) kinds[1] = weekNo % 2 === 0 ? 'pair' : 'opening'
  return kinds
}

/** Número da semana do ano (ISO simplificado) a partir de AAAA-MM-DD — só pra alternar o rodízio. */
export function weekNumber(date: string): number {
  const d = new Date(`${date}T12:00:00Z`)
  if (isNaN(d.getTime())) return 0
  const start = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.floor((d.getTime() - start) / (7 * 86400000))
}

/** Normaliza a resposta da IA de visão. null = JSON inválido → foto fica SEM nota (nunca inventa nota). */
export function parsePhotoScore(raw: string, rooms: { key: string }[]): { room: string | null; room_conf: number; quality: number } | null {
  let o: Record<string, unknown> | null = null
  try { o = JSON.parse(raw) } catch { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { o = JSON.parse(m[0]) } catch { /* */ } } }
  if (!o || typeof o !== 'object') return null
  const clamp = (v: unknown, lo: number, hi: number): number | null => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null }
  let quality = clamp(o.quality, 0, 100)
  if (quality === null) {
    const parts = [o.light, o.sharp, o.framing].map(v => clamp(v, 0, 100)).filter((v): v is number => v !== null)
    if (parts.length === 3) quality = parts.reduce((a, b) => a + b, 0) / 3
  }
  if (quality === null) return null
  const key = slug(o.room)
  const known = rooms.some(r => r.key === key)
  const conf = known ? (clamp(o.room_conf, 0, 1) ?? 0) : 0
  return { room: known ? key : null, room_conf: Math.round(conf * 100) / 100, quality: Math.round(quality) }
}

export interface PickCtx {
  cfg: TourCfg
  /** Cômodos dos últimos tours do mesmo imóvel (mais recente primeiro). */
  recentRooms?: string[]
  /** Fotos já usadas em vídeo deste imóvel (preferimos as novas). */
  usedPhotos?: Set<string>
  /** Cômodos/fotos já escolhidos nas outras vagas desta semana (corrida das vagas). */
  takenRooms?: Set<string>
  takenPhotos?: Set<string>
}
export interface TourChoice { kind: TourKind; photos: string[]; rooms: (string | null)[]; notes: string[] }

// 0 = foto boa; 1 = cômodo "evitar"; 2 = qualidade abaixo do piso; 3 = sem nota (último recurso).
function tierOf(p: TourPhoto, cfg: TourCfg): number {
  if (typeof p.quality !== 'number') return 3
  if (p.quality < cfg.min_quality) return 2
  if (p.room && cfg.avoid_rooms.includes(p.room)) return 1
  return 0
}
const roomKnown = (p: TourPhoto, cfg: TourCfg) => !!p.room && (p.room_conf ?? 0) >= cfg.min_room_conf

function rank(photos: TourPhoto[], ctx: PickCtx): TourPhoto[] {
  const { cfg } = ctx
  const recent = new Set((ctx.recentRooms ?? []).slice(0, cfg.recent_exclude))
  const key = (p: TourPhoto) => {
    const r = roomKnown(p, cfg) ? p.room! : null
    const pri = r ? cfg.room_priority.indexOf(r) : -1
    return [
      tierOf(p, cfg),
      r && ctx.takenRooms?.has(r) ? 1 : 0,
      ctx.usedPhotos?.has(p.url) ? 1 : 0,
      r && recent.has(r) ? 1 : 0,
      pri >= 0 ? pri : cfg.room_priority.length,
      -(p.quality ?? -1),
    ]
  }
  return photos.filter(p => p && p.url && !ctx.takenPhotos?.has(p.url)).map((p, i) => ({ p, k: key(p), i }))
    .sort((a, b) => { for (let j = 0; j < a.k.length; j++) if (a.k[j] !== b.k[j]) return a.k[j] - b.k[j]; return a.i - b.i })
    .map(x => x.p)
}

const adjacentOrder = (a: string, b: string, cfg: TourCfg): [string, string] | null => {
  for (const [x, y] of cfg.adjacent_rooms) { if (x === a && y === b) return [a, b]; if (x === b && y === a) return [b, a] }
  return null
}

function pickRoom(photos: TourPhoto[], ctx: PickCtx): TourChoice | null {
  const best = rank(photos, ctx)[0]
  if (!best) return null
  const notes: string[] = []
  const t = tierOf(best, ctx.cfg)
  if (t === 3) notes.push('foto sem nota de qualidade (a análise da foto não rodou) — escolhida sem critério.')
  else if (t === 2) notes.push('nenhuma foto boa o bastante: usei a melhor disponível.')
  return { kind: 'room', photos: [best.url], rooms: [roomKnown(best, ctx.cfg) ? best.room! : null], notes }
}

function pickOpening(photos: TourPhoto[], ctx: PickCtx): TourChoice | null {
  const { cfg } = ctx
  const ok = rank(photos, ctx).filter(p => roomKnown(p, cfg) && cfg.opening_rooms.includes(p.room!) && tierOf(p, cfg) === 0)
  return ok[0] ? { kind: 'opening', photos: [ok[0].url], rooms: [ok[0].room!], notes: [] } : null
}

function pickPair(photos: TourPhoto[], ctx: PickCtx): TourChoice | null {
  const { cfg } = ctx
  if (!cfg.adjacent_rooms.length) return null
  const ranked = rank(photos, ctx).filter(p => roomKnown(p, cfg) && tierOf(p, cfg) <= 1)
  for (const a of ranked) {
    if (tierOf(a, cfg) !== 0) continue
    for (const b of ranked) {
      if (a === b || a.room === b.room) continue
      const order = adjacentOrder(a.room!, b.room!, cfg)
      if (!order) continue
      const [first, second] = order[0] === a.room ? [a, b] : [b, a]
      return { kind: 'pair', photos: [first.url, second.url], rooms: [first.room!, second.room!], notes: [PAIR_NOTICE] }
    }
  }
  return null
}

/** Escolhe a(s) foto(s) do tour. Se o tipo pedido não é possível, cai (pair → opening → room) e diz por quê em `notes`. */
export function pickTour(photos: TourPhoto[], wanted: TourKind, ctx: PickCtx): TourChoice | null {
  const chain: TourKind[] = wanted === 'pair' ? ['pair', 'opening', 'room'] : wanted === 'opening' ? ['opening', 'room'] : ['room']
  const why: Record<string, string> = { pair: 'sem dois cômodos vizinhos com foto boa', opening: 'sem foto de fora/vista confiável' }
  for (const k of chain) {
    const c = k === 'pair' ? pickPair(photos, ctx) : k === 'opening' ? pickOpening(photos, ctx) : pickRoom(photos, ctx)
    if (c) {
      return k === wanted ? c : { ...c, notes: [`pedido era ${wanted}, mas ${why[wanted]} — saiu ${k}.`, ...c.notes] }
    }
  }
  return null
}

/** Texto único dos avisos do tour pro `reasoning` (vazio se não há aviso). */
export function tourNotice(notes: string[]): string {
  const n = notes.filter(Boolean)
  return n.length ? `${TOUR_NOTICE_PREFIX} ${n.join(' ')}` : ''
}
