import { supabase } from './supabase'

// Tipos + busca + validação das perguntas extras de uma ficha de setor
// (vertical_playbooks.config.onboarding_questions). Usado tanto no
// onboarding (visitante anônimo, antes de existir conta) quanto em
// Configurações → Entendimento do negócio (cliente já logado).

export interface Bilingual { pt: string; en?: string }

export type PlaybookQuestionType = 'select' | 'multi_text' | 'text'

export interface PlaybookQuestion {
  key: string
  label: Bilingual
  type: PlaybookQuestionType
  options?: Bilingual[] // só pra 'select'
  max?: number // só pra 'multi_text'
}

// Resolve o texto no idioma pedido, caindo pro pt se o idioma não existir
// ainda na ficha (hoje só existe pt de verdade em produto).
export function bi(b: Bilingual | undefined | null, lang: 'pt' | 'en' = 'pt'): string {
  if (!b) return ''
  return (lang === 'en' ? b.en : undefined) ?? b.pt ?? ''
}

const MAX_TEXT_LEN = 200

// Busca o vertical_key do tipo de negócio escolhido (label exata em
// business_types). 'generico' se não achar ou o label vier vazio — nunca
// derruba a tela por causa de erro no banco.
export async function fetchVerticalKey(businessTypeLabel: string): Promise<string> {
  if (!businessTypeLabel.trim()) return 'generico'
  try {
    const { data } = await supabase.from('business_types').select('vertical_key').eq('label', businessTypeLabel).maybeSingle()
    return (data?.vertical_key as string | undefined) ?? 'generico'
  } catch { return 'generico' }
}

// Busca as perguntas extras da ficha (vazio pra 'generico' ou qualquer
// ficha sem perguntas configuradas). Nunca derruba a tela por causa de
// erro no banco.
export async function fetchOnboardingQuestions(verticalKey: string): Promise<{ name: string; questions: PlaybookQuestion[] }> {
  if (verticalKey === 'generico') return { name: '', questions: [] }
  try {
    const { data } = await supabase.from('vertical_playbooks').select('name, config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
    const questions = (data?.config as { onboarding_questions?: unknown } | undefined)?.onboarding_questions
    return { name: (data?.name as string | undefined) ?? '', questions: Array.isArray(questions) ? questions as PlaybookQuestion[] : [] }
  } catch { return { name: '', questions: [] } }
}

export type CatalogFieldType = 'text' | 'number' | 'select' | 'url' | 'photos'

export interface CatalogField {
  key: string
  type: CatalogFieldType
  label: Bilingual
  options?: Bilingual[] // só pra 'select'
  min?: number // só pra 'photos' (mínimo de fotos)
}

export interface CatalogSchema {
  itemLabel: string // vocabulary.item, ex: "Imóvel" — singular, pro título de cada card
  catalogLabel: string // vocabulary.catalog, ex: "Meus imóveis" — nome da aba/menu
  required: CatalogField[]
  optional: CatalogField[]
}

// Busca o schema do catálogo (campos + nomes) da ficha do setor. 'generico'
// ou ficha sem catalog_fields → null (esconde a tela de catálogo — o setor
// continua vendo só "Produtos", como sempre foi).
export async function fetchCatalogSchema(verticalKey: string): Promise<CatalogSchema | null> {
  if (verticalKey === 'generico') return null
  try {
    const { data } = await supabase.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
    const config = (data?.config ?? {}) as { catalog_fields?: { required?: CatalogField[]; optional?: CatalogField[] }; vocabulary?: { item?: string; catalog?: string } }
    const required = config.catalog_fields?.required ?? []
    const optional = config.catalog_fields?.optional ?? []
    if (required.length === 0 && optional.length === 0) return null
    return {
      itemLabel: config.vocabulary?.item ?? 'Item',
      catalogLabel: config.vocabulary?.catalog ?? 'Catálogo',
      required, optional,
    }
  } catch { return null }
}

// Limpa os valores de campo do catálogo contra o schema real antes de
// gravar — mesma lógica de sanitizePlaybookAnswers, mas pros campos do
// catálogo (tipos diferentes: number/url/photos além de text/select).
export function sanitizeCatalogValues(raw: unknown, schema: CatalogSchema): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {}
  const all = [...schema.required, ...schema.optional].filter(f => f.type !== 'photos')
  const byKey = new Map(all.map(f => [f.key, f]))
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const f = byKey.get(key)
    if (!f) continue
    if (f.type === 'number') {
      const n = Number(value)
      if (Number.isFinite(n)) out[key] = n
    } else if (f.type === 'select') {
      const s = String(value ?? '').trim()
      const allowed = (f.options ?? []).map(o => o.pt)
      if (s && allowed.includes(s)) out[key] = s
    } else {
      const s = String(value ?? '').trim().slice(0, MAX_TEXT_LEN)
      if (s) out[key] = s
    }
  }
  return out
}

// Limpa as respostas contra o schema real da ficha antes de gravar — só
// aceita chave que existe na ficha, respeita o tipo e o `max`, corta texto
// grande. Isso vai pro prompt da IA (fetchPlaybookBlock nas 6 functions),
// então não pode entrar lixo nem texto enorme. Mesma função usada no
// claim-diagnostic (Deno, cópia própria — convenção do projeto) e aqui no
// frontend (Configurações).
export function sanitizePlaybookAnswers(raw: unknown, questions: PlaybookQuestion[]): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {}
  const byKey = new Map(questions.map(q => [q.key, q]))
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const q = byKey.get(key)
    if (!q) continue // chave que não existe nessa ficha — descarta
    if (q.type === 'text') {
      const s = String(value ?? '').trim().slice(0, MAX_TEXT_LEN)
      if (s) out[key] = s
    } else if (q.type === 'select') {
      const s = String(value ?? '').trim()
      const allowed = (q.options ?? []).map(o => o.pt)
      if (s && allowed.includes(s)) out[key] = s
    } else if (q.type === 'multi_text') {
      if (!Array.isArray(value)) continue
      const max = q.max ?? 10
      const items = value.map(v => String(v ?? '').trim().slice(0, MAX_TEXT_LEN)).filter(Boolean).slice(0, max)
      if (items.length) out[key] = items
    }
  }
  return out
}
