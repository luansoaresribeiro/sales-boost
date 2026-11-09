// Registro profissional (no piloto, o CRECI) — leitura na TELA. Espelho de
// supabase/functions/_shared/compliance.ts (licenseRule / parseLicense / licenseStatus):
// tela e servidor nunca podem discordar (scripts/test-compliance.mjs confere).
// Arquivo puro (sem supabase) para o teste rodar no Node.

export type Bi = { pt: string; en?: string }
export interface LicenseRule {
  answer_key: string
  name: Bi
  pattern: string
  types: Record<string, Bi>
  footer?: Bi
  verify_url?: string
  block_publish_without?: boolean
}
export interface License { number: string; type: string; canonical: string }
export type LicenseReason = 'missing' | 'invalid' | 'no_type'
export type LicenseStatus = { ok: true; license: License } | { ok: false; reason: LicenseReason }

const isBi = (v: unknown): v is Bi => !!v && typeof v === 'object' && typeof (v as Bi).pt === 'string' && (v as Bi).pt.trim() !== ''

export function licenseRule(config: unknown): LicenseRule | null {
  const r = (config as { compliance?: { license?: Record<string, unknown> } } | null)?.compliance?.license
  if (!r || typeof r !== 'object' || typeof r.answer_key !== 'string' || !r.answer_key || !isBi(r.name) || typeof r.pattern !== 'string') return null
  try { new RegExp(r.pattern) } catch { return null }
  const types: Record<string, Bi> = {}
  for (const [k, v] of Object.entries((r.types as Record<string, unknown>) ?? {})) if (/^[A-Z]$/.test(k) && isBi(v)) types[k] = v
  if (!Object.keys(types).length) return null
  return {
    answer_key: r.answer_key, name: r.name, pattern: r.pattern, types,
    footer: isBi(r.footer) && r.footer.pt.includes('{license}') ? r.footer : undefined,
    verify_url: typeof r.verify_url === 'string' && /^https:\/\//i.test(r.verify_url) ? r.verify_url : undefined,
    block_publish_without: r.block_publish_without === true,
  }
}

export function parseLicense(raw: unknown, rule: LicenseRule): License | null {
  const s = String(raw ?? '').toUpperCase().replace(/\./g, '').trim()
  if (!s) return null
  const m = new RegExp(rule.pattern).exec(s)
  const number = m?.groups?.number
  if (!number) return null
  const t = m?.groups?.type ?? ''
  const type = t && rule.types[t] ? t : ''
  if (t && !type) return null
  return { number, type, canonical: type ? `${number}-${type}` : number }
}

export function licenseStatus(answers: Record<string, unknown> | null | undefined, rule: LicenseRule): LicenseStatus {
  const raw = answers?.[rule.answer_key]
  if (raw === null || raw === undefined || String(raw).trim() === '') return { ok: false, reason: 'missing' }
  const lic = parseLicense(raw, rule)
  if (!lic) return { ok: false, reason: 'invalid' }
  if (!lic.type) return { ok: false, reason: 'no_type' }
  return { ok: true, license: lic }
}

/** Troca só o tipo (PF/PJ) mantendo o número digitado. Sem número reconhecível, devolve o texto como está. */
export function withLicenseType(raw: unknown, type: string, rule: LicenseRule): string {
  const lic = parseLicense(raw, rule)
  return lic ? `${lic.number}-${type}` : String(raw ?? '')
}

export const biText = (v: Bi, lang: 'pt' | 'en') => (lang === 'en' && v.en ? v.en : v.pt)

/** Mesmo texto que o servidor acrescenta na legenda (compliance.ts → licenseFooter). */
export function licenseFooter(rule: LicenseRule, lic: License, lang: 'pt' | 'en'): string {
  const tpl = rule.footer ? biText(rule.footer, lang) : `${biText(rule.name, lang)} {license}`
  return tpl.replace('{license}', lic.canonical)
}
