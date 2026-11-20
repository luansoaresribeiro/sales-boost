// Frente 1, item 1.4 (20/11): TOUR EM PARTES. D3 do dono: partes social, íntima e lazer, até ~8 passagens (~50 s) cada,
// "respeitando a arquitetura e a organização real de cada imóvel". Regra 0 do plano: juntas, as partes cobrem o imóvel
// inteiro — todo ambiente aparece em alguma parte OU fica na lista de pendentes com o motivo. Nunca some calado.
// Cada parte é um CAMINHO do mapa de ligações (1.2): só anda por ligação confirmada (a provável só entra se o dono pedir,
// e fica marcada). Puro, sem IA, sem custo. Testado em scripts/test-tour-parts.mjs.

export interface PSpace { key: string; label: string; area: string; photos: number[] }
export interface PLink { a: string; b: string; cls: 'confirmed' | 'probable' | 'unknown'; photo: number | null; other_photo: number | null }
export interface Passage { from: number; to: number; cls: 'confirmed' | 'probable' | 'same_room' }
export interface Part { area: string; index: number; total: number; spaces: string[]; photos: number[]; passages: Passage[] }
export interface Pending { key: string; label: string; area: string; reason: 'sem_passagem' | 'so_provavel' }
export interface PartsPlan { parts: Part[]; pending: Pending[]; covered: number; total: number }

export const PART_AREAS = ['social', 'intima', 'lazer'] as const
export const MAX_PASSAGES = 8

/** Externa e serviço não são partes próprias: vão para a parte da área com que têm ligação (a arquitetura manda). */
function partAreaOf(s: PSpace, links: PLink[], byKey: Map<string, PSpace>, ok: (l: PLink) => boolean): string | null {
  if ((PART_AREAS as readonly string[]).includes(s.area)) return s.area
  for (const l of links) {
    if (!ok(l)) continue
    const other = l.a === s.key ? l.b : l.b === s.key ? l.a : null
    const o = other ? byKey.get(other) : null
    if (o && (PART_AREAS as readonly string[]).includes(o.area)) return o.area
  }
  return null
}

/** Foto do ambiente `k` usada na ligação `l` (a que mostra a passagem ou a do outro lado). */
function photoIn(l: PLink, k: string, byKey: Map<string, PSpace>): number | null {
  const ph = byKey.get(k)?.photos ?? []
  if (l.photo != null && ph.includes(l.photo)) return l.photo
  if (l.other_photo != null && ph.includes(l.other_photo)) return l.other_photo
  return ph[0] ?? null
}

export function planParts(spaces: PSpace[], links: PLink[], opts: { maxPassages?: number; allowProbable?: boolean } = {}): PartsPlan {
  const max = Math.max(1, opts.maxPassages ?? MAX_PASSAGES)
  const byKey = new Map(spaces.map(s => [s.key, s]))
  const ok = (l: PLink) => l.cls === 'confirmed' || (opts.allowProbable === true && l.cls === 'probable')
  const valid = links.filter(l => byKey.has(l.a) && byKey.has(l.b) && l.a !== l.b && ok(l))
  const area = new Map(spaces.map(s => [s.key, partAreaOf(s, valid, byKey, () => true)]))
  const adj = new Map<string, PLink[]>()
  for (const l of valid) {
    if (area.get(l.a) == null || area.get(l.a) !== area.get(l.b)) continue // uma parte não atravessa áreas
    for (const k of [l.a, l.b]) { if (!adj.has(k)) adj.set(k, []); adj.get(k)!.push(l) }
  }
  const other = (l: PLink, k: string) => (l.a === k ? l.b : l.a)

  const parts: Omit<Part, 'index' | 'total'>[] = []
  const used = new Set<string>()
  for (const ar of PART_AREAS) {
    const inArea = spaces.filter(s => area.get(s.key) === ar && adj.get(s.key)?.length)
    // Caminhos: começa pelo ambiente com menos ligações (ponta do corredor), anda sempre para o vizinho não visitado
    // que tem menos saídas restantes (mantém o caminho comprido, sem "teletransporte").
    while (inArea.some(s => !used.has(s.key))) {
      const start = inArea.filter(s => !used.has(s.key)).sort((x, y) => (adj.get(x.key)!.length - adj.get(y.key)!.length) || x.photos[0] - y.photos[0])[0]
      const chain: { key: string; via?: PLink }[] = [{ key: start.key }]
      used.add(start.key)
      for (;;) {
        const cur = chain[chain.length - 1].key
        const next = (adj.get(cur) ?? []).filter(l => !used.has(other(l, cur)))
          .sort((x, y) => (adj.get(other(x, cur))!.filter(z => !used.has(other(z, other(x, cur)))).length - adj.get(other(y, cur))!.filter(z => !used.has(other(z, other(y, cur)))).length))[0]
        if (!next) break
        used.add(other(next, cur))
        chain.push({ key: other(next, cur), via: next })
      }
      if (chain.length < 2) { used.delete(start.key); inArea.splice(inArea.indexOf(start), 1); continue }
      // Fotos: ao passar de X para Y pela ligação L, a câmera sai da foto de L em X e chega na foto de L em Y.
      let photos: number[] = [], passages: Passage[] = [], spacesIn: string[] = []
      const flush = () => { if (photos.length >= 2) parts.push({ area: ar, spaces: spacesIn, photos, passages }); photos = []; passages = []; spacesIn = [] }
      for (let i = 1; i < chain.length; i++) {
        const l = chain[i].via!, x = chain[i - 1].key, y = chain[i].key
        const px = photoIn(l, x, byKey)!, py = photoIn(l, y, byKey)!
        const needSame = photos.length > 0 && photos[photos.length - 1] !== px
        const cost = (needSame ? 1 : 0) + 1
        if (photos.length && passages.length + cost > max) { // não cabe: fecha a parte e a próxima reabre em X
          flush()
        }
        if (!photos.length) { photos.push(px); spacesIn.push(x) }
        else if (photos[photos.length - 1] !== px) { passages.push({ from: photos[photos.length - 1], to: px, cls: 'same_room' }); photos.push(px) }
        passages.push({ from: px, to: py, cls: l.cls === 'confirmed' ? 'confirmed' : 'probable' })
        photos.push(py); spacesIn.push(y)
      }
      flush()
    }
  }
  const inPart = new Set(parts.flatMap(p => p.spaces))
  const anyProbable = new Set(links.filter(l => l.cls === 'probable').flatMap(l => [l.a, l.b]))
  const pending: Pending[] = spaces.filter(s => !inPart.has(s.key)).map(s => ({ key: s.key, label: s.label, area: s.area, reason: anyProbable.has(s.key) ? 'so_provavel' : 'sem_passagem' }))
  // Numeração "Parte i de N" por área (social → íntima → lazer).
  const total = parts.length
  return { parts: parts.map((p, i) => ({ ...p, index: i + 1, total })), pending, covered: inPart.size, total: spaces.length }
}
