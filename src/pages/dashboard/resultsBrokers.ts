// Lógica pura das Etapas 6 e 7 (resultados por oportunidade + encaminhamento ao corretor). Sem imports de propósito:
// roda no navegador e no teste (scripts/test-results-brokers.mjs). O rodízio de verdade vive no banco (assign_next_broker).

export type StageKey = 'novo' | 'contato' | 'qualificado' | 'proposta' | 'venda'
export interface LeadDates { visit_at: string | null; proposal_at: string | null; closed_at: string | null }

/**
 * O funil real (STAGE_MAP / STAGE_ORDER) não tem etapa "visita": novo → contato → qualificado → proposta → venda.
 * Mapeamento adotado: Qualificado = visita agendada, Proposta = proposta, Venda realizada = fechado.
 * Carimba só o que está vazio (nunca sobrescreve uma data que já existe) e nunca preenche etapas puladas.
 */
export function stampsForStage(stage: StageKey, existing: Partial<LeadDates>, nowIso: string): Partial<LeadDates> {
  const col: Partial<Record<StageKey, keyof LeadDates>> = { qualificado: 'visit_at', proposta: 'proposal_at', venda: 'closed_at' }
  const k = col[stage]
  return k && !existing[k] ? { [k]: nowIso } : {}
}
/** Etapas que oferecem o campo opcional de valor (proposta → proposal_value, venda → closed_value). */
export const valueColumnFor = (stage: StageKey): 'proposal_value' | 'closed_value' | null => (stage === 'proposta' ? 'proposal_value' : stage === 'venda' ? 'closed_value' : null)

/** Valor digitado ("1.250.000,50" ou "1250000.5") → número ≥ 0, ou null se vazio/inválido (= "valor não informado"). */
export function parseMoney(raw: string): number | null {
  if (raw.includes('-')) return null
  const s = raw.replace(/[^\d.,]/g, '').trim()
  if (!s) return null
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.')
  let norm: string
  if (lastComma > -1 && lastDot > -1) norm = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (lastComma > -1) norm = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else norm = /\.\d{1,2}$/.test(s) && (s.match(/\./g) ?? []).length === 1 ? s : s.replace(/\./g, '')
  const n = Number(norm)
  return Number.isFinite(n) && n >= 0 && n < 1e12 ? Math.round(n * 100) / 100 : null
}

// ── WhatsApp do corretor ──
export const phoneDigits = (p: unknown) => String(p ?? '').replace(/\D/g, '')
/** Cadastro do corretor: ≥ 10 dígitos (DDD + número). */
export const isValidBrokerPhone = (p: unknown) => { const n = phoneDigits(p).length; return n >= 10 && n <= 15 }
/**
 * Número para o wa.me. O DDI vem da ficha (config.public_page.country_code — regra 6); nada de DDI fixo aqui.
 * - Digitado com "+": usa como está (11 a 15 dígitos).
 * - Já começa com o DDI e tem o tamanho de número completo (DDI + ≥ 10): usa como está.
 * - 10 ou 11 dígitos sem DDI: ganha o DDI da ficha.
 * - Sem DDI conhecido e sem "+": null (melhor não ter botão do que mandar o lead para o número errado).
 */
export function waNumber(phone: unknown, countryCode: string | null | undefined): string | null {
  const raw = String(phone ?? '').trim()
  let d = phoneDigits(raw)
  const cc = String(countryCode ?? '').replace(/\D/g, '')
  if (!raw.startsWith('+')) {
    if (!cc || cc.length > 3) return null
    if (!(d.startsWith(cc) && d.length >= cc.length + 10)) {
      if (d.length !== 10 && d.length !== 11) return null
      d = cc + d
    }
  }
  return d.length >= 11 && d.length <= 15 ? d : null
}
export interface ForwardLead { name: string; contact: string | null; item: string | null; message: string | null }
/** Texto do encaminhamento (só dado do lead; nada inventado). Linha vazia some. */
export function forwardText(l: ForwardLead, lang: 'pt' | 'en'): string {
  const t = (pt: string, en: string) => (lang === 'en' ? en : pt)
  const line = (label: string, v: string | null) => { const s = (v ?? '').replace(/\s+/g, ' ').trim(); return s ? `${label}: ${s.slice(0, 400)}` : null }
  return [
    t('Novo lead para você', 'New lead for you'),
    line(t('Nome', 'Name'), l.name), line(t('Contato', 'Contact'), l.contact),
    line(t('Imóvel', 'Property'), l.item), line(t('Mensagem', 'Message'), l.message),
  ].filter(Boolean).join('\n')
}
/** wa.me do corretor com o resumo do lead. Nada é enviado por nós: o dono toca em "enviar" no próprio WhatsApp. */
export function forwardUrl(brokerPhone: unknown, l: ForwardLead, lang: 'pt' | 'en', countryCode: string | null | undefined): string | null {
  const n = waNumber(brokerPhone, countryCode)
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(forwardText(l, lang))}` : null
}

// ── resultados ──
export interface OppResultRow {
  opportunity_id: string; links: number; pecas_aprovadas: number; visitas: number; cliques: number; leads: number
  visitas_agendadas: number; propostas: number; vendas: number; valor_vendas: number | string | null; vendas_com_valor: number
}
/** "sem dado" (null) quando a oportunidade não tem link rastreável — diferente de 0, que é "medimos e não houve". */
export const metric = (hasLink: boolean, n: number | null | undefined): number | null => (hasLink ? Number(n ?? 0) : null)
/** Soma só dos valores informados (null/vazio/NaN ficam de fora); `of` = quantas vendas existem. */
export function sumInformed(values: (number | string | null | undefined)[]): { total: number; informed: number; of: number } {
  let total = 0, informed = 0
  for (const v of values) {
    if (v === null || v === undefined || v === '') continue
    const n = Number(v)
    if (Number.isFinite(n)) { total += n; informed++ }
  }
  return { total: Math.round(total * 100) / 100, informed, of: values.length }
}
/** Linha de atribuição: só quando houve evento (visita, clique ou lead) e existe link. */
export function attributionCodes(codes: string[], r: Pick<OppResultRow, 'visitas' | 'cliques' | 'leads'>): string[] {
  return codes.length > 0 && (r.visitas > 0 || r.cliques > 0 || r.leads > 0) ? codes.map(c => `/p/${c}`) : []
}
