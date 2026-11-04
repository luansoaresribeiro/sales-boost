// Cópia mínima, pra TELA, das partes puras de supabase/functions/_shared/itemService.ts (o servidor decide de verdade;
// aqui só mostramos). scripts/test-item-service.mjs confere que as duas copias dão o mesmo resultado.
// Nada de setor aqui (regra 6): a lista de status, quais bloqueiam e os rótulos vêm da ficha (config.availability).

export interface AvailabilityCfg {
  statuses: string[]; blocking: string[]; default: string; removed: string | null
  labels: { pt: Record<string, string>; en: Record<string, string> }
}
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const strList = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.map(str).filter(Boolean))] : [])

export function parseAvailabilityCfg(raw: unknown): AvailabilityCfg | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const statuses = strList(r.statuses)
  if (!statuses.length) return null
  const blocking = strList(r.blocking).filter(s => statuses.includes(s))
  const def = statuses.includes(str(r.default)) ? str(r.default) : statuses[0]
  const removed = statuses.includes(str(r.removed)) ? str(r.removed) : null
  const lab = (l: unknown): Record<string, string> => {
    const o: Record<string, string> = {}
    if (l && typeof l === 'object') for (const [k, v] of Object.entries(l as Record<string, unknown>)) if (str(v)) o[k] = str(v)
    return o
  }
  const labels = (r.labels && typeof r.labels === 'object' ? r.labels : {}) as Record<string, unknown>
  return { statuses, blocking, default: def, removed, labels: { pt: lab(labels.pt), en: lab(labels.en) } }
}

export interface Availability {
  status: string | null; blocking: boolean; source: 'manual' | 'portal_feed' | null; checked_at: string | null; never_checked: boolean
}
export interface ItemLike { meta?: { availability?: { status?: unknown; source?: unknown; checked_at?: unknown } | null } | null }

export function availabilityOf(item: ItemLike | null | undefined, cfg: AvailabilityCfg | null): Availability {
  if (!cfg) return { status: null, blocking: false, source: null, checked_at: null, never_checked: false }
  const a = item?.meta?.availability
  const status = a && typeof a === 'object' ? str(a.status) : ''
  if (!status) return { status: cfg.default, blocking: false, source: null, checked_at: null, never_checked: true }
  const source = a!.source === 'portal_feed' ? 'portal_feed' : 'manual'
  const checked = typeof a!.checked_at === 'string' && Number.isFinite(Date.parse(a!.checked_at)) ? a!.checked_at : null
  return { status, blocking: cfg.blocking.includes(status) || !cfg.statuses.includes(status), source, checked_at: checked, never_checked: false }
}

export function statusLabel(cfg: AvailabilityCfg | null, status: string | null, lang: 'pt' | 'en' = 'pt'): string {
  if (!status) return ''
  return cfg?.labels[lang]?.[status] ?? cfg?.labels.pt?.[status] ?? status
}

/** O que foi gravado em marketing_ai_test_content.item_pick / posts.item_pick (formato do servidor). */
export interface ItemPick {
  rule: 'least_used' | 'opportunity' | 'owner_choice'
  candidates: number; usage_21d: number | null; cooldown_ok: boolean | null; photos: number; min_photos: number
  attributes: { key: string; value: string | number; path: string }[]
  availability: { status: string | null; checked_at: string | null }
  picked_at: string
}

export function parseItemPick(raw: unknown): ItemPick | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { rule?: unknown }
  return r.rule === 'least_used' || r.rule === 'opportunity' || r.rule === 'owner_choice' ? raw as ItemPick : null
}

const date = (iso: string | null, lang: 'pt' | 'en'): string => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? new Date(t).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR') : ''
}

/** Frases do "Por que este imóvel": só o que foi gravado na hora da escolha, sem nenhuma justificativa inventada. */
export function pickReasonLines(p: ItemPick, lang: 'pt' | 'en' = 'pt', cfg: AvailabilityCfg | null = null): string[] {
  const pt = lang === 'pt'
  const out: string[] = []
  if (p.rule === 'owner_choice') out.push(pt ? 'Você escolheu este imóvel.' : 'You chose this listing.')
  else if (p.rule === 'opportunity') out.push(pt ? 'Imóvel ligado à oportunidade que você aprovou.' : 'Listing tied to the opportunity you approved.')
  else {
    const used = p.usage_21d ?? 0
    out.push(pt
      ? `Escolhido entre ${p.candidates} imóvel(is) disponível(is) com fotos suficientes: o menos usado nos últimos 21 dias (${used} ${used === 1 ? 'vez' : 'vezes'}).`
      : `Picked among ${p.candidates} available listing(s) with enough photos: the least used in the last 21 days (${used} time${used === 1 ? '' : 's'}).`)
    if (p.cooldown_ok === false) out.push(pt ? 'Todos já tinham sido usados nesta janela, então repeti o menos usado.' : 'All had already been used in this window, so the least used was repeated.')
  }
  out.push(pt ? `${p.photos} fotos reais (mínimo ${p.min_photos}).` : `${p.photos} real photos (minimum ${p.min_photos}).`)
  const s = p.availability?.status
  if (s) {
    const when = date(p.availability.checked_at, lang)
    out.push(pt ? `Disponibilidade: ${statusLabel(cfg, s, lang)}${when ? ` (conferida em ${when})` : ''}.` : `Availability: ${statusLabel(cfg, s, lang)}${when ? ` (checked on ${when})` : ''}.`)
  } else out.push(pt ? 'Disponibilidade: nunca conferida (tratado como disponível).' : 'Availability: never checked (treated as available).')
  return out
}

export const pickReasonText = (p: ItemPick, lang: 'pt' | 'en' = 'pt', cfg: AvailabilityCfg | null = null): string => pickReasonLines(p, lang, cfg).join(' ')
