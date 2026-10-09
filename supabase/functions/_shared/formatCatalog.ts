// Catálogo de formatos de conteúdo que a estratégia (Hermes) pode escolher.
// Fonte: ficha do setor (vertical_playbooks.config.content_formats) + os
// formatos que a própria empresa cadastrou na aba Formatos. Nada de setor
// aqui no código (regra 6) — só os formatos genéricos que qualquer negócio
// já produz pelo creative-generate.

// deno-lint-ignore no-explicit-any
type SupaClient = any

export type FormatProducer = 'post' | 'item_package' | 'item_video' | 'dm'
export type FormatStatus = 'live' | 'needs_material' | 'planned'

export interface ContentFormat {
  key: string
  name: string
  pillar: string
  producer: FormatProducer
  status: FormatStatus
  media?: string
  cost?: string
  notes?: string
}

export interface WeeklyMixItem { format: string; name: string; producer: FormatProducer; per_week: number; pillar: string; purpose: string }
export interface ContentPlan { central_line: string; hero_formats: { key: string; name: string }[]; why: string; weekly_mix: WeeklyMixItem[]; updated_at: string }

const PRODUCERS: FormatProducer[] = ['post', 'item_package', 'item_video', 'dm']
const STATUSES: FormatStatus[] = ['live', 'needs_material', 'planned']

// Genérico: o que o creative-generate produz pra qualquer negócio. Sem
// Stories separado de propósito (regra do dono, 2026-09: o calendário só tem
// post orgânico; o Copywriter marca se o post também vale pros Stories).
const GENERIC: ContentFormat[] = [
  { key: 'post_card', name: 'Post de foto/card com template da marca', pillar: 'qualquer', producer: 'post', status: 'live', media: 'imagem gerada + template da marca', cost: 'centavos' },
]

const PRODUCER_LABEL: Record<FormatProducer, string> = {
  post: 'gerado sozinho no calendário',
  item_package: 'sai do pacote de um item do catálogo (botão no item)',
  item_video: 'vídeo curto a partir das fotos reais de um item (custa — só com o dono pedindo)',
  dm: 'resposta automática na DM (dono aprova a mensagem uma vez)',
}
const STATUS_LABEL: Record<FormatStatus, string> = { live: 'funciona hoje', needs_material: 'precisa de material/autorização do dono', planned: 'em breve (não planeje ainda)' }

function clean(raw: unknown): ContentFormat | null {
  if (!raw || typeof raw !== 'object') return null
  const f = raw as Record<string, unknown>
  const key = String(f.key ?? '').trim()
  const name = String(f.name ?? '').trim()
  if (!/^[a-z0-9_]{2,60}$/.test(key) || !name) return null
  const producer = PRODUCERS.includes(f.producer as FormatProducer) ? f.producer as FormatProducer : 'post'
  const status = STATUSES.includes(f.status as FormatStatus) ? f.status as FormatStatus : 'planned'
  const opt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : undefined)
  return { key, name: name.slice(0, 120), pillar: String(f.pillar ?? 'qualquer').slice(0, 60), producer, status, media: opt(f.media), cost: opt(f.cost), notes: opt(f.notes) }
}

export async function fetchFormatCatalog(admin: SupaClient, verticalKey: string, companyId: string): Promise<ContentFormat[]> {
  const out: ContentFormat[] = [...GENERIC]
  try {
    const [{ data: pb }, { data: own }] = await Promise.all([
      admin.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle(),
      admin.from('marketing_ai_knowledge').select('title, content').eq('company_id', companyId).eq('module', 'formato').order('created_at', { ascending: false }).limit(10),
    ])
    const list = (pb?.config as { content_formats?: unknown[] } | null)?.content_formats
    for (const raw of Array.isArray(list) ? list : []) {
      const f = clean(raw)
      if (f && !out.some(o => o.key === f.key)) out.push(f)
    }
    for (const [i, row] of ((own ?? []) as { title: string | null; content: string | null }[]).entries()) {
      if (!row.title) continue
      out.push({ key: `proprio_${i + 1}`, name: `${row.title} (formato da própria empresa)`.slice(0, 120), pillar: 'qualquer', producer: 'post', status: 'live', notes: row.content?.slice(0, 200) ?? undefined })
    }
  } catch (e) { console.error('fetchFormatCatalog falhou (só genéricos):', e) }
  return out
}

export function formatCatalogBlock(formats: ContentFormat[]): string {
  const line = (f: ContentFormat) => `- ${f.key} — ${f.name} [pilar: ${f.pillar}; ${STATUS_LABEL[f.status]}; ${PRODUCER_LABEL[f.producer]}${f.cost ? `; custo: ${f.cost}` : ''}]${f.notes ? ` (${f.notes})` : ''}`
  return `\n\nCATÁLOGO DE FORMATOS DE CONTEÚDO (tudo o que o Sales Boost sabe produzir pra esta empresa — escolha SÓ por estas chaves):\n${formats.map(line).join('\n')}`
}

// Valida a escolha da IA contra o catálogo: só chaves que existem e que
// funcionam hoje; no máximo 14 peças/semana (regra do calendário: 1-2/dia).
export function sanitizeContentPlan(raw: unknown, formats: ContentFormat[], prev?: Partial<ContentPlan> | null): ContentPlan | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const byKey = new Map(formats.map(f => [f.key, f]))
  const live = (k: unknown) => { const f = byKey.get(String(k ?? '')); return f && f.status === 'live' ? f : null }
  const hero = (Array.isArray(r.hero_formats) ? r.hero_formats : prev?.hero_formats?.map(h => h.key) ?? [])
    .map(k => byKey.get(String(typeof k === 'object' && k ? (k as { key?: string }).key : k)))
    .filter((f): f is ContentFormat => !!f).slice(0, 4).map(f => ({ key: f.key, name: f.name }))
  const mix: WeeklyMixItem[] = []
  let total = 0
  for (const m of Array.isArray(r.weekly_mix) ? r.weekly_mix : []) {
    const item = m as Record<string, unknown>
    const f = live(item.format)
    if (!f || mix.some(x => x.format === f.key)) continue
    const n = Math.max(0, Math.min(7, Math.round(Number(item.per_week) || 0), 14 - total))
    if (!n) continue
    total += n
    mix.push({ format: f.key, name: f.name, producer: f.producer, per_week: n, pillar: String(item.pillar ?? f.pillar).slice(0, 60), purpose: String(item.purpose ?? '').slice(0, 240) })
  }
  const central = String(r.central_line ?? prev?.central_line ?? '').trim().slice(0, 600)
  if (!central && !mix.length) return null
  return { central_line: central, hero_formats: hero, why: String(r.why ?? prev?.why ?? '').slice(0, 600), weekly_mix: mix.length ? mix : (prev?.weekly_mix ?? []), updated_at: new Date().toISOString() }
}

// Do mix da estratégia pro calendário: `auto` é a fila intercalada (1 slot por
// peça) do que o creative-generate gera sozinho; `todo` é o que depende do dono
// (vídeo, pacote do item, DM) e só aparece como lista "pra fazer".
export function weeklyMixPlan(plan: ContentPlan | null): { auto: WeeklyMixItem[]; autoTotal: number; todo: { format: string; name: string; per_week: number; purpose: string }[] } {
  const mix = Array.isArray(plan?.weekly_mix) ? plan!.weekly_mix : []
  const autoItems = mix.filter(m => m.producer === 'post')
  const left = autoItems.map(m => ({ m, n: Math.max(0, m.per_week | 0) }))
  const auto: WeeklyMixItem[] = []
  while (left.some(x => x.n > 0)) for (const x of left) if (x.n > 0) { auto.push(x.m); x.n-- }
  const todo = mix.filter(m => m.producer !== 'post')
    .map(m => ({ format: m.format, name: m.name, per_week: m.per_week, purpose: m.purpose }))
  return { auto, autoTotal: auto.length, todo }
}
