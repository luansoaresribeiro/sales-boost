// Página pública do imóvel (Etapa 5) — lógica PURA (sem banco, sem rede), testada em scripts/test-public-page.mjs.
// O I/O vive em publicPageRun.ts. A página é SÓ destino de link (sem listagem/busca, noindex) e só vai ao ar com a
// aprovação do dono. Tudo que aparece nela sai daqui: lista BRANCA de campos da ficha (nunca `private`), só fotos
// reais (`meta.photos`, nunca `staged_photos`), e nada de número inventado (só o que o dono cadastrou).

export type Lang = 'pt' | 'en'
export const SITE_ORIGIN = 'https://getsaleboost.com'
export const CODE_LENGTH = 8
// Sem 0/o, 1/l/i (ambíguos ao ler/digitar): 23 letras + 8 dígitos = 31 símbolos.
export const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export const MAX_PUBLIC_PHOTOS = 10
export const DEFAULT_MIN_PHOTOS = 3
export const LIMITS = { visitorPerHour: 3, linkPerDay: 20, dedupeHours: 24, viewPerLinkHour: 300, clickPerLinkHour: 60 } as const
export const NAME_MIN = 2
export const NAME_MAX = 80
export const MESSAGE_MAX = 500
export const LEAD_SOURCE = 'link_page'
// Estágio inicial de lead novo = o que o sistema já grava hoje (instagram-webhook/agent-actions: 'new'; STAGE_TO_DB em salesReal.ts).
export const LEAD_STAGE_NEW = 'new'

/** Resposta única para QUALQUER falha de leitura (código inválido, página desligada, sem plano, item apagado): idêntica de propósito. */
export const NOT_FOUND_BODY = { error: 'not_found' } as const

export const lng = (v: unknown): Lang => (v === 'en' ? 'en' : 'pt')
export const tr = (lang: Lang, pt: string, en: string): string => (lang === 'en' ? en : pt)

// ── código do link ──
export function generateCode(random: (n: number) => Uint8Array = n => crypto.getRandomValues(new Uint8Array(n))): string {
  const n = CODE_ALPHABET.length // 31 → aceita só bytes < 248 (múltiplo de 31) para não enviesar o sorteio
  const limit = 256 - (256 % n)
  let out = ''
  while (out.length < CODE_LENGTH) {
    for (const b of random(16)) {
      if (b < limit && out.length < CODE_LENGTH) out += CODE_ALPHABET[b % n]
    }
  }
  return out
}
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`)
export const isValidCode = (c: unknown): c is string => typeof c === 'string' && CODE_RE.test(c)
export const publicLink = (code: string): string => `${SITE_ORIGIN}/p/${code}`
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

// ── configuração (ficha) ──
export interface PublicPageConfig { fields: string[]; min_photos: number; country_code: string; caption_line: { pt: string; en: string } }
const DEFAULT_LINE = { pt: 'Mais fotos e detalhes: {link}', en: 'More photos and details: {link}' }
/** Lê `vertical_playbooks.config.public_page`. Setor sem a chave → null (a página não existe para esse setor). */
export function parsePublicPageConfig(raw: unknown): PublicPageConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const fields = Array.isArray(r.fields) ? [...new Set(r.fields.filter((k): k is string => typeof k === 'string' && /^[a-z0-9_]{1,40}$/.test(k)))].slice(0, 40) : []
  const min = Number(r.min_photos)
  const cc = String(r.country_code ?? '').replace(/\D/g, '')
  const line = (r.caption_line ?? {}) as Record<string, unknown>
  const pick = (k: Lang): string => { const v = typeof line[k] === 'string' ? (line[k] as string).trim() : ''; return v.includes('{link}') && v.length <= 200 ? v : DEFAULT_LINE[k] }
  return {
    fields,
    min_photos: Number.isFinite(min) && min >= 1 && min <= MAX_PUBLIC_PHOTOS ? Math.floor(min) : DEFAULT_MIN_PHOTOS,
    country_code: cc.length >= 1 && cc.length <= 3 ? cc : '55',
    caption_line: { pt: pick('pt'), en: pick('en') },
  }
}

// ── campos públicos ──
interface CatalogFieldDef { key: string; type?: string; label?: { pt?: string; en?: string }; options?: { pt?: string; en?: string }[]; private?: boolean }
export interface PublicField { key: string; label: string; value: string }
const bi = (l: { pt?: string; en?: string } | undefined, lang: Lang, fallback: string): string => (l?.[lang] || l?.pt || fallback)

/** Rótulo "Preço (R$)" → rótulo "Preço" + unidade "R$"; "Metragem (m²)" → "Metragem" + "m²". Genérico: sem nome de campo de setor. */
function splitUnit(label: string): { text: string; unit: string | null } {
  const m = label.match(/^(.*?)\s*\(([^()]{1,6})\)\s*$/)
  return m ? { text: m[1].trim(), unit: m[2].trim() } : { text: label, unit: null }
}
function fmtNumber(n: number, lang: Lang): string { return n.toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR') }

/**
 * Campos que a página mostra: só chaves da lista branca da ficha, que existam no catálogo, não sejam `private`/foto,
 * e tenham valor cadastrado (campo vazio some — nunca "—" nem número inventado).
 */
export function publicFields(catalog: { required?: unknown; optional?: unknown } | null | undefined, cfg: PublicPageConfig, itemFields: Record<string, unknown> | null | undefined, lang: Lang): PublicField[] {
  const defs = [...(Array.isArray(catalog?.required) ? catalog!.required as CatalogFieldDef[] : []), ...(Array.isArray(catalog?.optional) ? catalog!.optional as CatalogFieldDef[] : [])]
  const byKey = new Map(defs.filter(d => d && typeof d.key === 'string').map(d => [d.key, d]))
  const values = itemFields ?? {}
  const out: PublicField[] = []
  for (const key of cfg.fields) {
    const def = byKey.get(key)
    if (!def || def.private === true || def.type === 'photos') continue
    const raw = values[key]
    if (raw === undefined || raw === null || String(raw).trim() === '') continue
    const { text, unit } = splitUnit(bi(def.label, lang, key))
    let value: string
    if (def.type === 'number') {
      const n = Number(raw)
      if (!Number.isFinite(n)) continue
      value = unit === 'R$' ? `R$ ${fmtNumber(n, lang)}` : unit ? `${fmtNumber(n, lang)} ${unit}` : fmtNumber(n, lang)
    } else if (def.type === 'select') {
      const opt = (def.options ?? []).find(o => o.pt === String(raw))
      if (!opt) continue // valor que não é uma opção da ficha: não mostra
      value = lang === 'en' ? (opt.en || opt.pt || '') : (opt.pt || '')
    } else {
      value = String(raw).trim().slice(0, 1500)
    }
    if (value) out.push({ key, label: text, value })
  }
  return out
}

/** Fotos da página: só `meta.photos` (reais), https, até 10. `staged_photos` (mobiliado por IA) NUNCA entra. */
export function publicPhotos(meta: unknown): string[] {
  const photos = (meta as { photos?: unknown } | null | undefined)?.photos
  if (!Array.isArray(photos)) return []
  const urls: string[] = []
  for (const p of photos) {
    const u = (p as { url?: unknown } | null)?.url
    if (typeof u === 'string' && /^https:\/\//i.test(u) && u.length <= 800 && !urls.includes(u)) urls.push(u)
  }
  return urls.slice(0, MAX_PUBLIC_PHOTOS)
}

// ── contatos e URLs montadas no servidor ──
export const phoneDigits = (v: unknown): string => String(v ?? '').replace(/\D/g, '')
/** Telefone da empresa → dígitos com DDI (10–11 dígitos = número nacional; recebe o DDI da ficha). null se inválido. */
export function whatsappNumber(phone: unknown, countryCode: string): string | null {
  let d = phoneDigits(phone)
  if (d.length === 10 || d.length === 11) d = countryCode + d
  return d.length >= 11 && d.length <= 15 ? d : null
}
/** @usuario do Instagram: aceita "@x", "x" ou a URL do perfil. null se não for um usuário válido. */
export function instagramHandle(username: unknown, url?: unknown): string | null {
  const ok = (s: string) => (/^[A-Za-z0-9._]{1,30}$/.test(s) ? s : null)
  const direct = String(username ?? '').trim().replace(/^@/, '')
  if (direct && ok(direct)) return direct
  const m = String(url ?? '').trim().match(/instagram\.com\/([A-Za-z0-9._]{1,30})(?:[/?#]|$)/i)
  return m && !['p', 'reel', 'reels', 'explore', 'stories'].includes(m[1].toLowerCase()) ? m[1] : null
}
export function whatsappUrl(phone: unknown, title: string, lang: Lang, countryCode: string): string | null {
  const n = whatsappNumber(phone, countryCode)
  if (!n) return null
  const t = title.replace(/\s+/g, ' ').trim().slice(0, 120)
  const msg = t ? tr(lang, `Olá! Vi o imóvel "${t}" e quero saber mais.`, `Hi! I saw the property "${t}" and I'd like to know more.`) : tr(lang, 'Olá! Vi um imóvel e quero saber mais.', "Hi! I saw a property and I'd like to know more.")
  return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`
}
export function instagramUrl(handle: unknown): string | null {
  const h = typeof handle === 'string' ? handle.trim().replace(/^@/, '') : ''
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? `https://ig.me/m/${h}` : null
}

// ── lead ──
export const CONSENT_VERSION = 1
export function consentText(lang: Lang, businessName: string): string {
  const co = businessName.replace(/\s+/g, ' ').trim().slice(0, 80) || tr(lang, 'a imobiliária', 'the agency')
  return tr(lang,
    `Concordo em enviar meu nome, contato e mensagem para ${co}, só para que respondam sobre este imóvel. Posso pedir a exclusão a qualquer momento.`,
    `I agree to send my name, contact and message to ${co}, only so they can reply about this property. I can ask for deletion at any time.`)
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/
// eslint-disable-next-line no-control-regex
const CTRL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g
const clean = (v: unknown): string => String(v ?? '').replace(CTRL_RE, '').trim()

export type LeadError = 'name' | 'contact' | 'message' | 'consent'
export interface LeadInput { name: string; contact: string; contactKind: 'phone' | 'email'; message: string }
export type LeadCheck = { ok: true; value: LeadInput } | { ok: false; error: LeadError } | { ok: false; error: 'honeypot' }

/** Valida o formulário da página. Honeypot preenchido = robô (a camada de cima finge sucesso e não grava). */
export function validateLead(body: unknown): LeadCheck {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  if (clean(b.website) !== '') return { ok: false, error: 'honeypot' }
  const name = clean(b.name).replace(/\s+/g, ' ')
  if (name.length < NAME_MIN || name.length > NAME_MAX) return { ok: false, error: 'name' }
  const raw = clean(b.contact)
  let contact = ''; let kind: 'phone' | 'email' = 'phone'
  if (raw.includes('@')) {
    if (raw.length > 120 || !EMAIL_RE.test(raw)) return { ok: false, error: 'contact' }
    contact = raw.toLowerCase(); kind = 'email'
  } else {
    if (!/^[+\d\s().-]{8,30}$/.test(raw)) return { ok: false, error: 'contact' }
    const d = phoneDigits(raw)
    if (d.length < 10 || d.length > 15) return { ok: false, error: 'contact' }
    contact = d
  }
  const message = clean(b.message)
  if (message.length > MESSAGE_MAX) return { ok: false, error: 'message' }
  if (b.consent !== true) return { ok: false, error: 'consent' }
  return { ok: true, value: { name, contact, contactKind: kind, message } }
}

/** Limites do formulário. Contagens vêm do banco (link_events 'lead' e leads). null = pode gravar. */
export function leadLimit(c: { visitorLastHour: number; linkLast24h: number; duplicate24h: boolean }): 'visitor_hour' | 'link_day' | 'duplicate' | null {
  if (c.duplicate24h) return 'duplicate'
  if (c.visitorLastHour >= LIMITS.visitorPerHour) return 'visitor_hour'
  if (c.linkLast24h >= LIMITS.linkPerDay) return 'link_day'
  return null
}

export function leadNotes(lang: Lang, title: string, message: string): string {
  const head = tr(lang, `Pediu informações pela página do imóvel "${title}".`, `Asked for information on the property page "${title}".`)
  return message ? `${head}\n${tr(lang, 'Mensagem', 'Message')}: ${message}` : head
}

// ── visitante (sem guardar IP) ──
export async function visitorHash(ip: string, ua: string, dayIso: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode([ip, ua, dayIso, salt].join('|'))
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|facebot|whatsapp|telegram|preview|headless|python-requests|curl\/|wget|httpclient|monitor|lighthouse|pingdom|uptime/i
export const isBot = (ua: string | null | undefined): boolean => !ua || ua.length < 10 || BOT_RE.test(ua)
// IP só para o hash (nunca guardado). Prefere `cf-connecting-ip` (a Cloudflare define e o cliente não consegue forjar);
// `x-forwarded-for` (primeiro item, que o cliente pode forjar) e `x-real-ip` são só reserva quando o primeiro não vem.
export const clientIp = (h: { get: (k: string) => string | null }): string => (h.get('cf-connecting-ip') || (h.get('x-forwarded-for') ?? '').split(',')[0] || h.get('x-real-ip') || '').trim()

// ── link na legenda / DM ──
/** Frase da ficha com {link} preenchido. */
export const linkLine = (cfg: PublicPageConfig, lang: Lang, link: string): string => cfg.caption_line[lang].split('{link}').join(link)
/**
 * Acrescenta a frase com o link UMA vez só: se a legenda já tem o link (ou qualquer /p/<código> deste código), não muda.
 * A própria legenda é a marca de "já feito" — não precisa de coluna nova.
 */
export function appendLinkOnce(text: string, line: string, link: string): { text: string; changed: boolean } {
  const base = String(text ?? '')
  if (base.includes(link) || base.includes(link.replace(/^https?:\/\//, ''))) return { text: base, changed: false }
  return { text: base.trimEnd() ? `${base.trimEnd()}\n\n${line}` : line, changed: true }
}
