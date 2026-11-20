// Frente 1, item 1.3 (20/11): COBERTURA do imóvel e FOTOS QUE FALTAM, a partir dos ambientes (1.1, meta.spaces) e do
// mapa de ligações (1.2, meta.space_links). Puro, sem IA, sem custo. Testado em scripts/test-tour-coverage.mjs.
// Regra do dono (19/11): "é melhor deixar uma passagem desconhecida do que criar uma conexão errada" — por isso só a
// ligação CONFIRMADA conta como coberta. A provável (que no teste incluiu um erro conhecido, terraço–salão) vira
// "confira" e gera o pedido de foto que a transformaria em confirmada.
// Os textos dos pedidos vêm da ficha (config.tour.coverage_hints, regra 6); o padrão daqui é genérico.

export type CoverStatus = 'linked' | 'probable' | 'none'
export interface CovSpace { key: string; label: string; area: string; photos: number[] }
export interface CovLink { a: string; b: string; cls: 'confirmed' | 'probable' | 'unknown'; missing?: string | null; photo?: number | null }
export interface CoverageHints { probable: string; isolated: string; stairs: string; outside: string }
export interface Todo { kind: 'probable' | 'isolated' | 'stairs'; area: string; spaces: string[]; text: string }
export interface Coverage {
  total: number; linked: number
  spaces: { key: string; label: string; area: string; status: CoverStatus; confirmed: string[]; probable: string[] }[]
  todo: Todo[]
}

export const DEFAULT_HINTS: Record<'pt' | 'en', CoverageHints> = {
  pt: {
    probable: 'Fique em {a}, na passagem que dá para {b}, e fotografe com a porta aberta: os dois ambientes precisam aparecer na mesma foto.',
    isolated: 'Da porta de {a}, pelo lado de fora, fotografe para dentro com a porta aberta: precisa aparecer o batente e o ambiente.',
    stairs: 'No meio da escada de {a}, aponte para onde ela chega: os degraus e o ambiente de cima (ou de baixo) na mesma foto.',
    outside: 'Para ligar {a} ao imóvel: fotografe o caminho até a porta de entrada (portaria, corredor do andar ou a porta aberta mostrando a sala).',
  },
  en: {
    probable: 'Stand in {a}, at the passage to {b}, and take the photo with the door open: both spaces must show in the same photo.',
    isolated: 'From the door of {a}, standing outside, shoot inwards with the door open: the door frame and the space must show.',
    stairs: 'Halfway up the stairs in {a}, point to where they lead: the steps and the space above (or below) in the same photo.',
    outside: 'To connect {a} to the property: photograph the way to the front door (lobby, hallway, or the open door showing the living room).',
  },
}

const AREA_ORDER = ['externa', 'social', 'intima', 'lazer', 'servico']
const fill = (t: string, a: string, b = '') => t.replace(/\{a\}/g, a).replace(/\{b\}/g, b)

/** Lê os modelos da ficha ({pt:{probable,isolated,stairs}, en:{…}}); o que faltar fica com o padrão. */
export function hintsFrom(cfg: unknown, lang: 'pt' | 'en'): CoverageHints {
  const raw = (cfg && typeof cfg === 'object' ? (cfg as Record<string, unknown>)[lang] : null) as Record<string, unknown> | null
  const d = DEFAULT_HINTS[lang]
  const pick = (k: keyof CoverageHints) => typeof raw?.[k] === 'string' && (raw[k] as string).includes('{a}') ? raw[k] as string : d[k]
  return { probable: pick('probable'), isolated: pick('isolated'), stairs: pick('stairs'), outside: pick('outside') }
}

export function computeCoverage(spaces: CovSpace[], links: CovLink[], hints: CoverageHints): Coverage {
  const byKey = new Map(spaces.map(s => [s.key, s]))
  const valid = links.filter(l => byKey.has(l.a) && byKey.has(l.b) && l.a !== l.b)
  const conf = new Map<string, Set<string>>(), prob = new Map<string, Set<string>>()
  const add = (m: Map<string, Set<string>>, x: string, y: string) => { if (!m.has(x)) m.set(x, new Set()); m.get(x)!.add(y) }
  for (const l of valid) {
    if (l.cls === 'confirmed') { add(conf, l.a, l.b); add(conf, l.b, l.a) }
    else if (l.cls === 'probable') { add(prob, l.a, l.b); add(prob, l.b, l.a) }
  }
  const status = (k: string): CoverStatus => conf.get(k)?.size ? 'linked' : prob.get(k)?.size ? 'probable' : 'none'
  const ordered = [...spaces].sort((x, y) => (AREA_ORDER.indexOf(x.area) + 99) % 99 - (AREA_ORDER.indexOf(y.area) + 99) % 99 || x.photos[0] - y.photos[0])
  const out: Coverage['spaces'] = ordered.map(s => ({
    key: s.key, label: s.label, area: s.area, status: status(s.key),
    confirmed: [...(conf.get(s.key) ?? [])], probable: [...(prob.get(s.key) ?? [])].filter(o => !conf.get(s.key)?.has(o)),
  }))
  const lab = (k: string) => byKey.get(k)!.label
  const todo: Todo[] = []
  const seen = new Set<string>()
  // 1) Prováveis que tocam um ambiente ainda não ligado: a foto que transformaria a passagem em confirmada.
  for (const l of valid) {
    if (l.cls !== 'probable' || (status(l.a) === 'linked' && status(l.b) === 'linked')) continue
    if (conf.get(l.a)?.has(l.b)) continue
    const pk = [l.a, l.b].sort().join('~')
    if (seen.has(pk)) continue
    seen.add(pk)
    // Fica no ambiente da foto que mostrou a passagem (se souber); senão, no que ainda não está ligado.
    const from = l.photo != null && byKey.get(l.b)?.photos.includes(l.photo) ? l.b : status(l.a) !== 'linked' ? l.a : l.b
    const to = from === l.a ? l.b : l.a
    todo.push({ kind: 'probable', area: byKey.get(from)!.area, spaces: [from, to], text: fill(hints.probable, lab(from), lab(to)) })
  }
  // 2) Escada que falta (a conferência disse "falta escada").
  for (const l of valid) {
    if (l.missing !== 'escada') continue
    const k = `stairs~${l.a}`
    if (seen.has(k)) continue
    seen.add(k)
    todo.push({ kind: 'stairs', area: byKey.get(l.a)!.area, spaces: [l.a, l.b], text: fill(hints.stairs, lab(l.a)) })
  }
  // 3) Ambiente sem nenhuma ligação (nem provável): a foto de porta para dentro.
  // Área externa (fachada, portaria) não tem "porta para dentro": o pedido é o caminho até a entrada (20/11, A3).
  for (const s of out) if (s.status === 'none') todo.push({ kind: 'isolated', area: s.area, spaces: [s.key], text: fill(s.area === 'externa' ? hints.outside : hints.isolated, s.label) })
  todo.sort((x, y) => (AREA_ORDER.indexOf(x.area) + 99) % 99 - (AREA_ORDER.indexOf(y.area) + 99) % 99)
  return { total: spaces.length, linked: out.filter(s => s.status === 'linked').length, spaces: out, todo }
}
