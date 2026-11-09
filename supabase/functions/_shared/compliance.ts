// Etapa 1 (2026-11-07, decisão do dono): registro profissional (no piloto, o CRECI) obrigatório para
// publicar, e acrescentado sozinho na legenda. Tudo de setor vem da ficha (config.compliance.license —
// regra 6); sem esse bloco na ficha, nada aqui muda o comportamento.
//  - Formato: a ficha dá o padrão (regex com os grupos "number" e "type") e os tipos (ex.: F = pessoa
//    física, J = pessoa jurídica). O tipo fica como sufixo da própria resposta ("12345-F").
//  - Publicação comercial sem registro válido é recusada no servidor (agent-actions → execute).
//    A geração de peças e os testes internos (A.6) NÃO são bloqueados.
//  - O rodapé ("CRECI-RJ 12345-F") entra na hora de publicar, uma vez só.
// Espelho da leitura na tela: src/lib/license.ts (tela e servidor nunca podem discordar).
//
// deno-lint-ignore-file no-explicit-any

export type Bi = { pt: string; en?: string }
export interface LicenseRule {
  answer_key: string            // pergunta da ficha onde a resposta fica (companies.playbook_answers)
  name: Bi                      // "CRECI"
  pattern: string               // regex aplicado à resposta em maiúsculas, sem pontos; grupos "number" e "type"
  types: Record<string, Bi>     // { F: "pessoa física", J: "pessoa jurídica" }
  footer?: Bi                   // "CRECI-RJ {license}"
  verify_url?: string           // onde conferir no conselho (só https)
  block_publish_without?: boolean
}
export interface License { number: string; type: string; canonical: string }
export type LicenseStatus = { ok: true; license: License } | { ok: false; reason: 'missing' | 'invalid' | 'no_type' }

const bi = (v: Bi | undefined, lang: string) => (v ? (lang === 'en' && v.en ? v.en : v.pt) : '')
const isBi = (v: any): v is Bi => !!v && typeof v === 'object' && typeof v.pt === 'string' && v.pt.trim() !== ''

/** Lê e valida config.compliance.license. Qualquer coisa estranha = null (sem regra, nada muda). */
export function licenseRule(config: any): LicenseRule | null {
  const r = config?.compliance?.license
  if (!r || typeof r !== 'object' || typeof r.answer_key !== 'string' || !r.answer_key || !isBi(r.name) || typeof r.pattern !== 'string') return null
  try { new RegExp(r.pattern) } catch { return null }
  const types: Record<string, Bi> = {}
  for (const [k, v] of Object.entries(r.types ?? {})) if (/^[A-Z]$/.test(k) && isBi(v)) types[k] = v as Bi
  if (!Object.keys(types).length) return null
  return {
    answer_key: r.answer_key, name: r.name, pattern: r.pattern, types,
    footer: isBi(r.footer) && r.footer.pt.includes('{license}') ? r.footer : undefined,
    verify_url: typeof r.verify_url === 'string' && /^https:\/\//i.test(r.verify_url) ? r.verify_url : undefined,
    block_publish_without: r.block_publish_without === true,
  }
}

/** "CRECI-RJ 12.345-F" → { number: "12345", type: "F", canonical: "12345-F" }. Tipo ausente → type "". null = formato não reconhecido. */
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

export function licenseFooter(rule: LicenseRule, lic: License, lang = 'pt'): string {
  const tpl = bi(rule.footer, lang) || `${bi(rule.name, lang)} {license}`
  return tpl.replace('{license}', lic.canonical)
}

/** A legenda já cita o registro (nome + número)? Então não repete. */
export function hasFooter(caption: string, rule: LicenseRule, lic: License): boolean {
  const c = caption.toUpperCase().replace(/\./g, '')
  return c.includes(rule.name.pt.toUpperCase()) && new RegExp(`(^|\\D)${lic.number}(\\D|$)`).test(c)
}

/** Acrescenta o rodapé uma vez só, cabendo no limite do Instagram (corta a legenda, nunca o rodapé). */
export function ensureFooter(caption: string, footer: string, rule: LicenseRule, lic: License, max = 2200): string {
  const base = String(caption ?? '').trim()
  if (hasFooter(base, rule, lic)) return base
  const room = max - footer.length - 2
  const body = base.length > room ? base.slice(0, Math.max(0, room - 1)).trimEnd() + '…' : base
  return body ? `${body}\n\n${footer}` : footer
}

export function licenseBlockMessage(rule: LicenseRule, reason: 'missing' | 'invalid' | 'no_type', lang = 'pt'): string {
  const n = bi(rule.name, lang)
  const types = Object.values(rule.types).map(t => bi(t, lang)).join(lang === 'en' ? ' or ' : ' ou ')
  if (lang === 'en') return reason === 'missing' ? `To publish, add your ${n} in Settings → Business understanding. Action not executed.`
    : reason === 'no_type' ? `To publish, say whether your ${n} is ${types} in Settings. Action not executed.`
    : `Your ${n} format was not recognized. Fix it in Settings to publish. Action not executed.`
  return reason === 'missing' ? `Para publicar, informe seu ${n} em Configurações → Entendimento do negócio. Ação não executada.`
    : reason === 'no_type' ? `Para publicar, diga se o seu ${n} é de ${types} em Configurações. Ação não executada.`
    : `O formato do seu ${n} não foi reconhecido. Corrija em Configurações para publicar. Ação não executada.`
}

export const LICENSE_CHECK_FAILED = 'Não foi possível conferir o registro profissional agora. Nada foi publicado — tente de novo em alguns minutos.'

/**
 * Para a hora de publicar: lê a ficha e a resposta da empresa.
 * { block } = motivo para recusar; { footer, rule, license } = publicar com o rodapé; tudo null = a ficha não exige registro.
 * Falha FECHADA: publicar é irreversível, então erro de banco recusa (diferente do setupReady).
 */
export async function publishLicense(admin: any, companyId: string): Promise<{ block: string | null; footer: string | null; rule: LicenseRule | null; license: License | null }> {
  const none = { block: null, footer: null, rule: null, license: null }
  try {
    const { data: c, error } = await admin.from('companies').select('vertical_key, playbook_answers').eq('id', companyId).maybeSingle()
    if (error || !c) return { ...none, block: LICENSE_CHECK_FAILED }
    const key = (c.vertical_key as string | null) ?? 'generico'
    if (key === 'generico') return none
    const { data: pb, error: pErr } = await admin.from('vertical_playbooks').select('config').eq('key', key).eq('enabled', true).maybeSingle()
    if (pErr) return { ...none, block: LICENSE_CHECK_FAILED }
    const rule = licenseRule(pb?.config)
    if (!rule) return none
    const lang = String(pb?.config?.default_language ?? 'pt')
    const st = licenseStatus(c.playbook_answers, rule)
    if (!st.ok) return rule.block_publish_without ? { ...none, rule, block: licenseBlockMessage(rule, st.reason, lang) } : { ...none, rule }
    return { block: null, footer: rule.footer ? licenseFooter(rule, st.license, lang) : null, rule, license: st.license }
  } catch (e) {
    console.error('[compliance] conferência do registro falhou — publicação recusada', String(e))
    return { ...none, block: LICENSE_CHECK_FAILED }
  }
}

// ── Etapa 1 · PR 1B (2026-11-09): texto que vai ao público (legenda, DM, WhatsApp, resposta automática) ─────────────
// Na ficha: config.compliance.public_text = { pt: { discrimination, promises, allow }, en: {...}, safe_reply: {pt,en} }.
// Os termos são FRASES COM CONTEXTO ("ideal para famílias", "não aceita crianças", "valorização garantida") — nunca
// palavras soltas, para não pegar "sala ampla para receber a família" ou "600 m da praia". `allow` libera afirmação
// comercial comprovável ("garantia locatícia", "seguro fiança"). Sem o bloco na ficha, nada muda.

export type PublicIssue = 'discrimination' | 'promise'
export interface PublicTextRules { discrimination: RegExp | null; promise: RegExp | null; allow: RegExp | null; safeReply: string }

export const normText = (s: string) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function phraseRe(list: unknown): RegExp | null {
  const terms = (Array.isArray(list) ? list : []).filter((t): t is string => typeof t === 'string' && t.trim() !== '')
    .filter(t => { try { new RegExp(t); return true } catch { return false } })
  return terms.length ? new RegExp('(?:^|[^a-z0-9])(?:' + terms.join('|') + ')(?:$|[^a-z0-9])') : null
}

export function publicTextRules(config: any, lang = 'pt'): PublicTextRules | null {
  const b = config?.compliance?.public_text
  if (!b || typeof b !== 'object') return null
  const l = (lang === 'en' && b.en) ? b.en : b.pt
  if (!l || typeof l !== 'object') return null
  const r = { discrimination: phraseRe(l.discrimination), promise: phraseRe(l.promises), allow: phraseRe(l.allow), safeReply: bi(isBi(b.safe_reply) ? b.safe_reply : undefined, lang) }
  return r.discrimination || r.promise ? r : null
}

export function publicIssues(sentence: string, rules: PublicTextRules): PublicIssue[] {
  const s = normText(sentence)
  const out: PublicIssue[] = []
  if (rules.discrimination?.test(s)) out.push('discrimination')
  if (rules.promise?.test(s) && !(rules.allow?.test(s))) out.push('promise')
  return out
}

const SENTENCES = /(?<=[.!?…])\s+/
/** Corta só as frases com problema (linha por linha), devolvendo o que saiu. Nunca descarta a peça. */
export function cutPublicText(text: string, rules: PublicTextRules | null): { text: string; removed: { sentence: string; issues: PublicIssue[] }[] } {
  const removed: { sentence: string; issues: PublicIssue[] }[] = []
  if (!rules || !text) return { text: String(text ?? ''), removed }
  const lines = String(text).split('\n').map(line => line.split(SENTENCES).filter(p => {
    if (!p.trim()) return false
    const iss = publicIssues(p, rules)
    if (iss.length) { removed.push({ sentence: p.trim(), issues: iss }); return false }
    return true
  }).join(' '))
  const kept = lines.filter((l, i) => l || (i > 0 && lines[i - 1] && lines.slice(i + 1).some(Boolean)))
  return { text: kept.join('\n').trim(), removed }
}

const ISSUE_PT: Record<PublicIssue, string> = { discrimination: 'rotula quem pode comprar/alugar', promise: 'promete resultado' }
export function complianceNotice(removed: { sentence: string; issues: PublicIssue[] }[]): string | null {
  if (!removed.length) return null
  const shown = removed.slice(0, 3).map(r => `“${r.sentence.length > 90 ? `${r.sentence.slice(0, 89).trimEnd()}…` : r.sentence}” (${r.issues.map(i => ISSUE_PT[i]).join(', ')})`).join('; ')
  return `Ajuste de conformidade: tirei ${shown}${removed.length > 3 ? ` (+${removed.length - 3})` : ''}.`
}

/** Ao publicar: sobrou frase proibida? Então recusa com motivo claro (não edita o texto que o dono aprovou). */
export function publishTextBlock(caption: string, rules: PublicTextRules | null): string | null {
  const { removed } = cutPublicText(caption, rules)
  if (!removed.length) return null
  const r = removed[0]
  return `A legenda tem um trecho que não pode ir ao público (${r.issues.map(i => ISSUE_PT[i]).join(', ')}): “${r.sentence.slice(0, 120)}”. Edite a legenda e aprove de novo. Nada foi publicado.`
}

/** Resposta automática (WhatsApp, DM): se tiver problema, troca pela resposta neutra da ficha. Sem regra, devolve igual. */
export function safeAutoReply(reply: string, rules: PublicTextRules | null): { text: string; replaced: boolean } {
  if (!rules) return { text: reply, replaced: false }
  const { text, removed } = cutPublicText(reply, rules)
  if (!removed.length) return { text: reply, replaced: false }
  return { text: rules.safeReply || text, replaced: true }
}

/** Regra para o prompt da legenda (vem da ficha; vazio sem bloco). */
export function publicTextPromptRule(config: any, lang = 'pt'): string {
  const p = config?.compliance?.public_text?.prompt_rule
  return isBi(p) ? `- ${bi(p, lang)}\n` : ''
}

/** Carrega as regras da empresa (ficha do setor). Erro → null (quem chama decide; a publicação tem a trava do registro). */
export async function loadPublicTextRules(admin: any, companyId: string): Promise<{ rules: PublicTextRules | null; config: any } | null> {
  try {
    const { data: c } = await admin.from('companies').select('vertical_key').eq('id', companyId).maybeSingle()
    const key = (c?.vertical_key as string | null) ?? 'generico'
    if (key === 'generico') return { rules: null, config: {} }
    const { data: pb } = await admin.from('vertical_playbooks').select('config').eq('key', key).eq('enabled', true).maybeSingle()
    const config = pb?.config ?? {}
    return { rules: publicTextRules(config, String(config.default_language ?? 'pt')), config }
  } catch (e) { console.error('[compliance] regras de texto público não carregadas', String(e)); return null }
}
