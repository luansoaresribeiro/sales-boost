// Catálogo de formatos de conteúdo que a estratégia (Hermes) pode escolher.
// Fonte: ficha do setor (vertical_playbooks.config.content_formats) + os
// formatos que a própria empresa cadastrou na aba Formatos. Nada de setor
// aqui no código (regra 6) — só os formatos genéricos que qualquer negócio
// já produz pelo creative-generate.

// deno-lint-ignore no-explicit-any
type SupaClient = any

export type FormatProducer = 'post' | 'item_package' | 'item_video' | 'dm'
export type FormatStatus = 'live' | 'needs_material' | 'planned'
export type FormatSurface = 'feed' | 'stories' | 'reels' | 'dm'
// Família = "o que é" a peça (rótulo único, PLANO-CRIATIVOS decisão A).
export type FormatFamily = 'tour' | 'oferta' | 'educativo' | 'bairro' | 'eventual'
export const FAMILIES: FormatFamily[] = ['tour', 'oferta', 'educativo', 'bairro', 'eventual']

export interface ContentFormat {
  key: string
  name: string
  pillar: string
  producer: FormatProducer
  status: FormatStatus
  media?: string
  cost?: string
  notes?: string
  // Onde aparece no Instagram e qual receita do catalog-package produz o
  // formato a partir de um item (os dois vêm da ficha — nada de setor aqui).
  surface?: FormatSurface
  recipe?: string
  // Família do formato (vem da ficha; sem ela: item_video = tour, resto = eventual).
  family?: FormatFamily
}

// `pillar` (legado) = `tema` = pilar de conteúdo da ficha; `pilar_ss` = pra que
// serve (chave do pilar de Social Selling); `familia` = o que é. Os 3 novos são
// opcionais: estratégia antiga sem eles continua valendo.
export interface WeeklyMixItem { format: string; name: string; producer: FormatProducer; per_week: number; pillar: string; purpose: string; familia?: FormatFamily; pilar_ss?: string; tema?: string }
// Como a estratégia trabalha cada pilar de Social Selling (ficha:
// onboarding_v2.social_selling). `today` = como o pilar está hoje (nível do
// diagnóstico, quando há); `plan` = o que a estratégia faz por ele.
export interface PillarPlan { key: string; name: string; level: string | null; today: string; plan: string }
export interface ContentPlan { central_line: string; hero_formats: { key: string; name: string }[]; why: string; weekly_mix: WeeklyMixItem[]; pillars?: PillarPlan[]; updated_at: string }

const PRODUCERS: FormatProducer[] = ['post', 'item_package', 'item_video', 'dm']
const STATUSES: FormatStatus[] = ['live', 'needs_material', 'planned']
const SURFACES: FormatSurface[] = ['feed', 'stories', 'reels', 'dm']

// Genérico: o que o creative-generate produz pra qualquer negócio. Sem
// Stories separado de propósito (regra do dono, 2026-09: o calendário só tem
// post orgânico; o Copywriter marca se o post também vale pros Stories).
const GENERIC: ContentFormat[] = [
  { key: 'post_card', name: 'Post de foto/card com template da marca', pillar: 'qualquer', producer: 'post', status: 'live', family: 'eventual', media: 'imagem gerada + template da marca', cost: 'centavos' },
  // Pedido do dono 2026-10-14: post do zero, tipo apresentação, a partir de
  // uma ideia/trend (não do item do catálogo). Slides de texto da marca.
  { key: 'carrossel_slides', name: 'Carrossel de slides (tipo apresentação) a partir de uma ideia ou trend', pillar: 'qualquer', producer: 'post', status: 'live', family: 'educativo', media: 'slides de texto com a marca (sem foto)', cost: 'centavos' },
]

const PRODUCER_LABEL: Record<FormatProducer, string> = {
  post: 'gerado sozinho no calendário',
  item_package: 'criado sozinho no calendário a partir de um item do catálogo com fotos reais',
  item_video: 'vídeo curto a partir de 1 foto real de um item (criado sozinho no calendário)',   // sem preço: custo interno do Sales Boost não vai pro texto do cliente (A.6)
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
  const surface = SURFACES.includes(f.surface as FormatSurface) ? f.surface as FormatSurface : undefined
  const recipe = typeof f.recipe === 'string' && /^[a-z0-9_]{2,60}$/.test(f.recipe) ? f.recipe : undefined
  const family = FAMILIES.includes(f.family as FormatFamily) ? f.family as FormatFamily : undefined
  return { key, name: name.slice(0, 120), pillar: String(f.pillar ?? 'qualquer').slice(0, 60), producer, status, media: opt(f.media), cost: opt(f.cost), notes: opt(f.notes), surface, recipe, family }
}

// Família efetiva do formato (sempre do catálogo, nunca da IA).
export function familyOf(f: Pick<ContentFormat, 'family' | 'producer'> | undefined | null): FormatFamily {
  return f?.family ?? (f?.producer === 'item_video' ? 'tour' : 'eventual')
}

export async function fetchFormatCatalog(admin: SupaClient, verticalKey: string, companyId: string): Promise<ContentFormat[]> {
  const out: ContentFormat[] = [...GENERIC]
  try {
    // Formatos "próprios" da empresa (aba Formatos antiga, module='formato')
    // saíram em 2026-10-15: geravam pelo caminho antigo (imagem genérica/tweet).
    void companyId
    const { data: pb } = await admin.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
    const cfg = pb?.config as { content_formats?: unknown[]; content_rules?: { disabled_formats?: unknown } } | null
    const list = cfg?.content_formats
    for (const raw of Array.isArray(list) ? list : []) {
      const f = clean(raw)
      if (f && !out.some(o => o.key === f.key)) out.push(f)
    }
    // Formatos desligados pela ficha (regra 6): ex. imóveis tirou o card
    // "tipo tweet" genérico (dono, 2026-10-14) — a estratégia nem vê.
    const off = Array.isArray(cfg?.content_rules?.disabled_formats) ? (cfg!.content_rules!.disabled_formats as unknown[]).map(String) : []
    if (off.length) out.splice(0, out.length, ...out.filter(f => !off.includes(f.key)))
  } catch (e) { console.error('fetchFormatCatalog falhou (só genéricos):', e) }
  return out
}

// Apelidos de formato da ficha (config.content_rules.format_aliases): formato antigo → formato novo
// (ex.: carrossel_slides → carrossel_educativo). Só vale se o destino existe na ficha, está `live` e
// não foi desligado; qualquer erro = sem apelidos (tolerante). Regra 6: o mapa vive na ficha.
export async function fetchFormatAliases(admin: SupaClient, verticalKey: string): Promise<Record<string, string>> {
  try {
    const { data } = await admin.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
    const cfg = data?.config as { content_formats?: unknown[]; content_rules?: { format_aliases?: unknown; disabled_formats?: unknown } } | null
    const raw = cfg?.content_rules?.format_aliases
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const off = Array.isArray(cfg?.content_rules?.disabled_formats) ? (cfg!.content_rules!.disabled_formats as unknown[]).map(String) : []
    const live = new Set((Array.isArray(cfg?.content_formats) ? cfg!.content_formats! : []).map(clean).filter((f): f is ContentFormat => !!f && f.status === 'live' && !off.includes(f.key)).map(f => f.key))
    const out: Record<string, string> = {}
    for (const [from, to] of Object.entries(raw as Record<string, unknown>)) if (/^[a-z0-9_]{2,60}$/.test(from) && typeof to === 'string' && live.has(to) && from !== to) out[from] = to
    return out
  } catch { return {} }
}

// Regras de conteúdo da ficha (regra 6): config.content_rules. Hoje só o
// mínimo de vídeos por semana (decisão do dono 2026-10-14: "pelo menos uns 3
// vídeos na semana e a estratégia, dependendo, pode jogar pra cima").
export interface ContentRules { minVideosPerWeek: number }

// Tour virtual SAIU do plano da semana (decisão do dono, 2026-11-10): agora tem menu próprio ("Tour virtual"),
// onde o dono escolhe o imóvel e gera o tour completo. O plano da semana (estratégia + calendário de domingo +
// "resto da semana") fica com os outros formatos. Vale pra qualquer setor: é o produtor, não um formato de setor.
// A cópia da tela (src/lib/weekSlots.ts) tem a mesma lista — scripts/test-tour-order.mjs confere.
export const OUT_OF_WEEKLY_PLAN: FormatProducer[] = ['item_video']
export const inWeeklyPlan = (producer: unknown): boolean => !(OUT_OF_WEEKLY_PLAN as string[]).includes(String(producer))
/** Formatos que a estratégia pode pôr no plano da semana. */
export const planningFormats = (formats: ContentFormat[]): ContentFormat[] => formats.filter(f => inWeeklyPlan(f.producer))
export async function fetchContentRules(admin: SupaClient, verticalKey: string): Promise<ContentRules> {
  try {
    const { data } = await admin.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
    const n = Number((data?.config as { content_rules?: { min_videos_per_week?: unknown } } | null)?.content_rules?.min_videos_per_week)
    // O mínimo era de vídeo do imóvel (item_video); fora do plano da semana desde 2026-11-10, ele vale 0.
    return { minVideosPerWeek: inWeeklyPlan('item_video') && Number.isInteger(n) && n >= 0 && n <= 7 ? n : 0 }
  } catch { return { minVideosPerWeek: 0 } }
}

// Garante o mínimo de vídeos no mix: se a estratégia pediu menos, completa no
// primeiro formato de vídeo que já está no mix (ou no primeiro que funciona
// hoje no catálogo). Mais que o mínimo fica como a estratégia pediu.
export function ensureMinVideos(mixRaw: WeeklyMixItem[], formats: ContentFormat[], min: number): WeeklyMixItem[] {
  // Plano antigo com tour (antes de 2026-11-10) perde o tour aqui; e o mínimo de vídeo não volta a pôr tour.
  const mix = mixRaw.filter(m => inWeeklyPlan(m.producer))
  if (min <= 0 || !inWeeklyPlan('item_video')) return mix
  const have = mix.filter(m => m.producer === 'item_video').reduce((s, m) => s + (m.per_week | 0), 0)
  if (have >= min) return mix
  const out = mix.map(m => ({ ...m }))
  const cur = out.find(m => m.producer === 'item_video')
  if (cur) { cur.per_week = Math.min(7, cur.per_week + (min - have)); return out }
  const f = formats.find(x => x.producer === 'item_video' && x.status === 'live')
  if (!f) return out
  out.push({ format: f.key, name: f.name, producer: 'item_video', per_week: Math.min(7, min - have), pillar: f.pillar, familia: familyOf(f), tema: f.pillar, purpose: 'Vídeo curto de uma foto real do imóvel, pra ter vídeo toda semana no calendário.' })
  return out
}

// Custo interno do Sales Boost (preço por vídeo/imagem, teto mensal, débito) e a diretriz de vídeos NÃO vão pro texto que o cliente lê
// (A.6, 2026-11-07: a estratégia dizia "cada vídeo custa ~US$ 0,42… debitado do teto mensal contratado" e "mínimo de 3 vídeos por semana").
// O prompt já proíbe; isto é a trava em código: tira a FRASE inteira que cita isso (nunca troca por outro texto).
const INTERNAL_COST_RE = /US\$|\bUSD\b|teto\s+(?:mensal|do\s+plano|contratado|de\s+gasto)|d[eé]bit|custo\s+(?:interno|por\s+(?:v[ií]deo|imagem|pe[cç]a)|do\s+sales\s*boost)|sales\s*boost\s+(?:paga|gasta|custeia|arca)|regra\s+do\s+setor|m[ií]nimo\s+de\s+\d+\s+v[ií]deos/i
export const hasInternalCost = (text: string): boolean => INTERNAL_COST_RE.test(String(text ?? ''))
export function stripInternalCost(text: string): string {
  return String(text ?? '').split('\n').map(line => line.split(/(?<=[.!?])\s+/).filter(sent => !INTERNAL_COST_RE.test(sent)).join(' ')).join('\n').trim()
}
/** Orçamento da estratégia (allocation[].reason e budget_reasoning) sem custo interno. Outros campos ficam como a IA mandou. */
export function cleanBudgetText(budget: unknown): Record<string, unknown> {
  const b = (budget && typeof budget === 'object' ? { ...(budget as Record<string, unknown>) } : {})
  if (typeof b.budget_reasoning === 'string') b.budget_reasoning = stripInternalCost(b.budget_reasoning)
  if (Array.isArray(b.allocation)) b.allocation = b.allocation.map(a => (a && typeof a === 'object' && typeof (a as { reason?: unknown }).reason === 'string' ? { ...(a as object), reason: stripInternalCost((a as { reason: string }).reason) } : a))
  return b
}

export function formatCatalogBlock(formats: ContentFormat[]): string {
  const line = (f: ContentFormat) => `- ${f.key} — ${f.name} [pilar: ${f.pillar}; ${STATUS_LABEL[f.status]}; ${PRODUCER_LABEL[f.producer]}]${f.notes ? ` (${f.notes})` : ''}`
  // Só o que pode entrar no plano da semana (o tour virtual tem menu próprio desde 2026-11-10).
  return `\n\nCATÁLOGO DE FORMATOS DE CONTEÚDO (tudo o que o Sales Boost sabe produzir pra esta empresa — escolha SÓ por estas chaves):\n${planningFormats(formats).map(line).join('\n')}`
}

// Valida a escolha da IA contra o catálogo: só chaves que existem e que
// funcionam hoje; no máximo 14 peças/semana (regra do calendário: 1-2/dia).
// `opts` (fase 3): chaves dos pilares de Social Selling da ficha, etapas do
// funil e nível de cada pilar no diagnóstico. Sem `ssKeys` (setor sem social
// selling) o plano sai como sempre, sem pilar_ss.
export interface PlanOpts { ssKeys?: string[]; funnel?: unknown; levels?: Record<string, string> }
export function sanitizeContentPlan(raw: unknown, formats: ContentFormat[], prev?: Partial<ContentPlan> | null, minVideos = 0, opts?: PlanOpts): ContentPlan | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const byKey = new Map(formats.map(f => [f.key, f]))
  const live = (k: unknown) => { const f = byKey.get(String(k ?? '')); return f && f.status === 'live' ? f : null }
  const hero = (Array.isArray(r.hero_formats) ? r.hero_formats : prev?.hero_formats?.map(h => h.key) ?? [])
    .map(k => byKey.get(String(typeof k === 'object' && k ? (k as { key?: string }).key : k)))
    .filter((f): f is ContentFormat => !!f).slice(0, 4).map(f => ({ key: f.key, name: f.name }))
  const ssKeys = (opts?.ssKeys ?? []).filter(k => typeof k === 'string' && k)
  const validSS = (v: unknown) => { const k = String(v ?? '').trim(); return ssKeys.includes(k) ? k : undefined }
  const mix: WeeklyMixItem[] = []
  let total = 0
  for (const m of Array.isArray(r.weekly_mix) ? r.weekly_mix : []) {
    const item = m as Record<string, unknown>
    const f = live(item.format)
    const ss = validSS(item.pilar_ss)
    if (!f || mix.some(x => x.format === f.key && x.pilar_ss === ss)) continue
    const n = Math.max(0, Math.min(7, Math.round(Number(item.per_week) || 0), 14 - total))
    if (!n) continue
    total += n
    mix.push({ format: f.key, name: f.name, producer: f.producer, per_week: n, pillar: String(item.pillar ?? f.pillar).slice(0, 60), purpose: stripInternalCost(String(item.purpose ?? '')).slice(0, 240), ...(ss ? { pilar_ss: ss } : {}) })
  }
  const central = String(r.central_line ?? prev?.central_line ?? '').trim().slice(0, 600)
  if (!central && !mix.length) return null
  const weekly = labelMix(ensureMinVideos(mix.length ? mix : (prev?.weekly_mix ?? []), formats, minVideos), byKey, ssKeys, opts)
  const pillars = Array.isArray(r.pillars) ? cleanPillars(r.pillars) : (prev?.pillars ?? [])
  return { central_line: central, hero_formats: hero, why: stripInternalCost(String(r.why ?? prev?.why ?? '')).slice(0, 600), weekly_mix: weekly, ...(pillars.length ? { pillars } : {}), updated_at: new Date().toISOString() }
}

// Rótulos de cada item do mix (decisão A). Roda DEPOIS do ensureMinVideos pra
// o vídeo de mínimo também sair com pilar. familia/tema vêm SEMPRE do catálogo
// (nunca da IA). pilar_ss: o da IA se existir na ficha; senão, em ordem: o
// pilar da etapa do funil com o mesmo formato → rodízio entre os pilares
// ausentes/parciais (ou todos, se nenhum está fraco) → o 1º da ficha.
export function labelMix(mix: WeeklyMixItem[], byKey: Map<string, ContentFormat>, ssKeys: string[], opts?: PlanOpts): WeeklyMixItem[] {
  const funnel = (Array.isArray(opts?.funnel) ? opts!.funnel as Record<string, unknown>[] : []).filter(x => x && typeof x === 'object')
  const weak = ssKeys.filter(k => { const l = opts?.levels?.[k]; return !l || l === 'ausente' || l === 'parcial' })
  const rot = weak.length ? weak : ssKeys
  let turn = 0
  const out: WeeklyMixItem[] = []
  for (const m of mix) {
    const f = byKey.get(m.format)
    let ss = ssKeys.includes(String(m.pilar_ss ?? '')) ? m.pilar_ss : undefined
    if (!ss && ssKeys.length) {
      const st = funnel.find(x => String(x.format ?? '') === m.format && ssKeys.includes(String(x.pillar ?? '')))
      ss = st ? String(st.pillar) : (rot[turn++ % rot.length] ?? ssKeys[0])
    }
    const lab: WeeklyMixItem = { ...m, familia: f ? familyOf(f) : m.familia, tema: f?.pillar ?? m.tema ?? m.pillar }
    if (ss) lab.pilar_ss = ss; else delete lab.pilar_ss
    const same = out.find(o => o.format === lab.format && o.pilar_ss === lab.pilar_ss)
    if (same) same.per_week = Math.min(7, same.per_week + lab.per_week); else out.push(lab)
  }
  return out
}

// Pilares já resolvidos pelo strategy-generate (chave e nome vindos da ficha).
function cleanPillars(raw: unknown[]): PillarPlan[] {
  const out: PillarPlan[] = []
  for (const x of raw) {
    const p = (x ?? {}) as Record<string, unknown>
    const key = String(p.key ?? '')
    if (!/^[a-z0-9_]{2,60}$/.test(key) || out.some(o => o.key === key)) continue
    const plan = String(p.plan ?? '').trim().slice(0, 400)
    if (!plan) continue
    out.push({ key, name: String(p.name ?? key).slice(0, 60), level: typeof p.level === 'string' ? p.level.slice(0, 20) : null, today: String(p.today ?? '').trim().slice(0, 300), plan })
  }
  return out.slice(0, 8)
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
  const todo = mix.filter(m => m.producer !== 'post' && inWeeklyPlan(m.producer))
    .map(m => ({ format: m.format, name: m.name, per_week: m.per_week, purpose: m.purpose }))
  return { auto, autoTotal: auto.length, todo }
}

// Calendário da semana a partir do mix da estratégia (pedido do dono,
// 2026-10-14: "não é gerado, já vem da estratégia"). Espalha TODAS as peças
// do mix (menos DM, que é automação e não peça do dia) pelos 7 dias de forma
// determinística: a peça k de N cai no dia floor(k*7/N). A MESMA conta roda
// na tela (src/lib/weekSlots.ts — duplicada de propósito, convenção do
// projeto) pra o dono ver o plano antes de qualquer peça ser gerada, e as
// peças geradas caírem exatamente nos dias mostrados.
export interface WeekSlot { date: string; format: string; name: string; producer: FormatProducer; pillar: string; purpose: string; familia?: FormatFamily; pilar_ss?: string; tema?: string }
// EXATAMENTE 1 post por dia, 7 por semana (dono, 2026-11-13 — substitui o "espalhar N peças pelos 7 dias", que deixava dia
// vazio com menos de 7 peças): DM e stories não contam (`excludeFormats` = formatos de stories da ficha). Mais de 7 peças →
// as 7 primeiras da fila intercalada (cada formato aparece antes de repetir). Menos de 7 → completa girando a fila (mantém
// a variedade). O mesmo formato não cai em dias seguidos quando dá. Vaga de imóvel sem material na hora de gerar vira post
// que não depende de imóvel (planWeekFromStrategy → pushFiller). Peça repetida é barrada na geração (temas reservados +
// trava de imóvel/receita).
export function dailySeven<T extends { format: string; producer: string }>(queue: T[]): T[] {
  if (!queue.length) return []
  const pick = queue.slice(0, 7)
  for (let i = 0; pick.length < 7; i++) pick.push(queue[i % queue.length])
  // Ordena sem repetir formato em dias seguidos: a cada dia, o formato que mais sobra (≠ do dia anterior); empate = ordem da fila.
  const rest = [...pick], out: T[] = []
  while (rest.length) {
    const prev = out.length ? out[out.length - 1].format : null
    const left = (f: string) => rest.filter(m => m.format === f).length
    let best = -1
    for (let i = 0; i < rest.length; i++) if (rest[i].format !== prev && (best < 0 || left(rest[i].format) > left(rest[best].format))) best = i
    out.push(rest.splice(best < 0 ? 0 : best, 1)[0])
  }
  return out
}
export function weekSlots(plan: ContentPlan | null, dates: string[], opts: { excludeFormats?: string[] } = {}): WeekSlot[] {
  const exclude = new Set(opts.excludeFormats ?? [])
  const mix = (Array.isArray(plan?.weekly_mix) ? plan!.weekly_mix : []).filter(m => m.producer !== 'dm' && inWeeklyPlan(m.producer) && !exclude.has(m.format))
  const left = mix.map(m => ({ m, n: Math.max(0, m.per_week | 0) }))
  const queue: WeeklyMixItem[] = []
  while (left.some(x => x.n > 0)) for (const x of left) if (x.n > 0) { queue.push(x.m); x.n-- }
  if (!queue.length || dates.length !== 7) return []
  return dailySeven(queue).map((m, k) => ({ date: dates[k], format: m.format, name: m.name, producer: m.producer, pillar: m.pillar, purpose: m.purpose, familia: m.familia, pilar_ss: m.pilar_ss, tema: m.tema }))
}
