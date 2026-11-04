// Fase 4 (2026-11-04) — UM serviço de imóveis para todo o backend: "quais imóveis posso usar agora", "este imóvel
// está disponível?" e "por que escolhi este?". Antes cada função repetia a própria consulta (5 fotos fixas, nenhuma
// noção de vendido/alugado). Regras do dono (docs/DECISIONS.md, 2026-11-04 — Fase 4):
//  1. Disponibilidade = status manual no Catálogo + conferência no link do portal na hora de publicar (item com
//     meta.source.listing_id que não está mais no link = "removido"). Sem link do portal: só o status manual.
//  2. Não deu pra conferir na hora de publicar → NÃO publica: a ação fica na fila, o cron tenta de novo a cada 5 min e,
//     depois de 2 h, vira "Não foi possível verificar a disponibilidade". Item só manual nunca cai aqui.
//  3. A lista de status e quais bloqueiam vem da FICHA (vertical_playbooks.config.availability) — regra 6.
//     Ficha sem a chave = nada bloqueado (compatível com o que já existia).
// Partes PURAS no topo (testadas em scripts/test-item-service.mjs com `node --experimental-strip-types`, sem relógio
// nem rede implícitos); partes com I/O embaixo. A tela tem uma cópia mínima em src/lib/itemAvailability.ts.

import { isSafeUrl } from './safeUrl.ts'

// deno-lint-ignore no-explicit-any
type Admin = { from: (t: string) => any }

export const DEFAULT_MIN_PHOTOS = 5
export const FEED_TIMEOUT_MS = 8_000
export const FEED_CACHE_MS = 60 * 60_000       // conferência no portal vale 1 h
export const UNVERIFIABLE_MAX_MS = 2 * 60 * 60_000 // depois de 2 h sem conseguir conferir: falha
const FEED_MAX_BYTES = 25 * 1024 * 1024

// ── ficha ──
export interface AvailabilityCfg {
  statuses: string[]
  blocking: string[]
  default: string                 // status de quem ainda não foi conferido ("disponível")
  removed: string | null          // status que o link do portal grava quando o imóvel some (precisa estar em `statuses`)
  labels: { pt: Record<string, string>; en: Record<string, string> }
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const strList = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.map(str).filter(Boolean))] : [])

/** vertical_playbooks.config.availability → configuração válida, ou null (ficha sem a chave = nada bloqueado). */
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

export interface ItemCfg { minPhotos: number; availability: AvailabilityCfg | null }

/** Mínimo de fotos: campo type:'photos' do catálogo da ficha (mesma regra de catalogMinPhotos da tela). */
export function minPhotosFrom(catalogFields: unknown): number {
  const cf = (catalogFields && typeof catalogFields === 'object' ? catalogFields : {}) as { required?: unknown; optional?: unknown }
  const all = [...(Array.isArray(cf.required) ? cf.required : []), ...(Array.isArray(cf.optional) ? cf.optional : [])] as { type?: unknown; min?: unknown }[]
  const f = all.find(x => x && x.type === 'photos')
  return typeof f?.min === 'number' && f.min > 0 ? f.min : DEFAULT_MIN_PHOTOS
}

export function itemCfgFrom(config: unknown): ItemCfg {
  const c = (config && typeof config === 'object' ? config : {}) as { catalog_fields?: unknown; availability?: unknown }
  return { minPhotos: minPhotosFrom(c.catalog_fields), availability: parseAvailabilityCfg(c.availability) }
}

/** Como fetchItemCfg, mas erro de leitura = null (ficha SEM a chave continua sendo um ItemCfg válido). Usada pela trava de publicação. */
export async function fetchItemCfgStrict(admin: Admin, verticalKey: string | null): Promise<ItemCfg | null> {
  try {
    const { data, error } = await admin.from('vertical_playbooks').select('config').eq('key', verticalKey ?? 'generico').eq('enabled', true).maybeSingle()
    if (error) return null
    return itemCfgFrom(data?.config)
  } catch { return null }
}

export async function fetchItemCfg(admin: Admin, verticalKey: string | null): Promise<ItemCfg> {
  try {
    const { data } = await admin.from('vertical_playbooks').select('config').eq('key', verticalKey ?? 'generico').eq('enabled', true).maybeSingle()
    return itemCfgFrom(data?.config)
  } catch { return itemCfgFrom(null) }
}

export function statusLabel(cfg: AvailabilityCfg | null, status: string | null, lang: 'pt' | 'en' = 'pt'): string {
  if (!status) return ''
  return cfg?.labels[lang]?.[status] ?? cfg?.labels.pt?.[status] ?? status
}

// ── disponibilidade de um item ──
export interface StoredAvailability { status?: unknown; source?: unknown; checked_at?: unknown; note?: unknown }
export interface ItemLike { id?: string; title?: string | null; meta?: { photos?: unknown[]; fields?: Record<string, unknown>; availability?: StoredAvailability | null; source?: { listing_id?: unknown } | null } | null }
export interface Availability {
  status: string | null          // null = ficha sem disponibilidade
  blocking: boolean
  source: 'manual' | 'portal_feed' | null
  checked_at: string | null
  never_checked: boolean         // sem meta.availability: "disponível, nunca conferido"
}

export function availabilityOf(item: ItemLike | null | undefined, cfg: AvailabilityCfg | null): Availability {
  if (!cfg) return { status: null, blocking: false, source: null, checked_at: null, never_checked: false }
  const a = item?.meta?.availability
  const status = a && typeof a === 'object' ? str(a.status) : ''
  if (!status) return { status: cfg.default, blocking: false, source: null, checked_at: null, never_checked: true }
  const source = a!.source === 'portal_feed' ? 'portal_feed' : 'manual'
  const checked = typeof a!.checked_at === 'string' && Number.isFinite(Date.parse(a!.checked_at)) ? a!.checked_at : null
  // Status que a ficha não conhece mais: na dúvida, BLOQUEIA (nunca publicar imóvel que pode estar indisponível).
  const blocking = cfg.blocking.includes(status) || !cfg.statuses.includes(status)
  return { status, blocking, source, checked_at: checked, never_checked: false }
}

// ── lista de imóveis usáveis ──
export interface PickItem { id: string; title: string; photos: number; fields: Record<string, unknown>; availability: Availability }
export interface Excluded { id: string; reason: 'availability' | 'photos'; status?: string | null }

/** Puro: filtra por fotos reais (mínimo da ficha) e disponibilidade. Quem sai por indisponível vai em `excluded`. */
export function filterPickable(rows: ItemLike[], cfg: ItemCfg): { items: PickItem[]; excluded: Excluded[] } {
  const items: PickItem[] = [], excluded: Excluded[] = []
  for (const r of rows) {
    if (!r.id) continue
    const photos = Array.isArray(r.meta?.photos) ? r.meta!.photos!.length : 0
    if (photos < cfg.minPhotos) { excluded.push({ id: r.id, reason: 'photos' }); continue }
    const availability = availabilityOf(r, cfg.availability)
    if (availability.blocking) { excluded.push({ id: r.id, reason: 'availability', status: availability.status }); continue }
    items.push({ id: r.id, title: String(r.title ?? ''), photos, fields: r.meta?.fields ?? {}, availability })
  }
  return { items, excluded }
}

export async function listPickableItems(admin: Admin, companyId: string, cfg: ItemCfg, opts: { newestFirst?: boolean } = {}): Promise<{ items: PickItem[]; excluded: Excluded[] }> {
  let q = admin.from('marketing_ai_knowledge').select('id, title, meta').eq('company_id', companyId).eq('kind', 'product')
  if (opts.newestFirst) q = q.order('created_at', { ascending: false })
  const { data } = await q
  return filterPickable((data ?? []) as ItemLike[], cfg)
}

/** Lê o imóvel distinguindo "não existe" (item null) de "falhou a leitura" (failed). */
export async function getItemChecked(admin: Admin, companyId: string, itemId: string): Promise<{ item: ItemLike | null; failed: boolean }> {
  try {
    const { data, error } = await admin.from('marketing_ai_knowledge').select('id, title, meta').eq('id', itemId).eq('company_id', companyId).eq('kind', 'product').maybeSingle()
    if (error) return { item: null, failed: true }
    return { item: (data ?? null) as ItemLike | null, failed: false }
  } catch { return { item: null, failed: true } }
}

export async function getItem(admin: Admin, companyId: string, itemId: string): Promise<ItemLike | null> {
  const { data } = await admin.from('marketing_ai_knowledge').select('id, title, meta').eq('id', itemId).eq('company_id', companyId).eq('kind', 'product').maybeSingle()
  return (data ?? null) as ItemLike | null
}

/** Mensagem clara (PT) para os caminhos em que o dono escolheu o imóvel. null = pode seguir. */
export function ownerBlockMessage(item: ItemLike | null, cfg: ItemCfg): string | null {
  if (!item) return 'Esse imóvel não foi encontrado.'
  const photos = Array.isArray(item.meta?.photos) ? item.meta!.photos!.length : 0
  if (photos < cfg.minPhotos) return `Esse imóvel tem menos de ${cfg.minPhotos} fotos reais.`
  const av = availabilityOf(item, cfg.availability)
  if (av.blocking) return `Esse imóvel está marcado como "${statusLabel(cfg.availability, av.status).toLowerCase()}" no Catálogo — não dá pra criar peça dele. Mude o status no Catálogo se ele voltou a estar disponível.`
  return null
}

// ── rotação (mesma de antes: o menos usado nos últimos 21 dias; devolve o motivo) ──
export interface ItemPick {
  rule: 'least_used' | 'opportunity' | 'owner_choice'
  candidates: number
  usage_21d: number | null
  cooldown_ok: boolean | null
  photos: number
  min_photos: number
  attributes: { key: string; value: string | number; path: string }[]
  availability: { status: string | null; checked_at: string | null }
  picked_at: string
}

export interface RankResult { id: string; candidates: number; usage_21d: number; cooldown_ok: boolean }

/**
 * Mesma rotação de antes: dos imóveis fora de `avoid` (o que já foi usado na janela da ficha/semana), o menos usado nos
 * últimos 21 dias (empate = ordem da lista). `strict` e nada livre = null (a vaga vira "pra fazer"); sem `strict` e nada
 * livre, repete o menos usado (cooldown_ok=false). `usage` é incrementado pelo chamador (vagas da mesma semana se enxergam).
 */
export function rankItems(items: { id: string }[], usage: Map<string, number>, opts: { avoid?: Set<string>; strict?: boolean } = {}): RankResult | null {
  if (!items.length) return null
  const free = opts.avoid ? items.filter(i => !opts.avoid!.has(i.id)) : items
  if (opts.strict && !free.length) return null
  const pool = free.length ? free : items
  const best = [...pool].sort((a, b) => (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0))[0]
  return { id: best.id, candidates: pool.length, usage_21d: usage.get(best.id) ?? 0, cooldown_ok: free.length > 0 }
}

/**
 * O motivo gravado na peça. `attributes` = SÓ campos reais que entraram na decisão (hoje: fotos e disponibilidade), cada um com
 * o caminho de onde veio. Nenhuma justificativa livre de IA (regra 5).
 */
export function buildPickReason(o: { rule: ItemPick['rule']; item: PickItem; cfg: ItemCfg; rank?: RankResult | null; candidates?: number; now?: string }): ItemPick {
  const av = o.item.availability
  const attributes: ItemPick['attributes'] = [{ key: 'photos', value: o.item.photos, path: 'meta.photos' }]
  if (av.status && !av.never_checked) attributes.push({ key: 'availability', value: av.status, path: 'meta.availability.status' })
  return {
    rule: o.rule, candidates: o.rank?.candidates ?? o.candidates ?? 1, usage_21d: o.rank?.usage_21d ?? null, cooldown_ok: o.rank?.cooldown_ok ?? null,
    photos: o.item.photos, min_photos: o.cfg.minPhotos, attributes,
    availability: { status: av.never_checked ? null : av.status, checked_at: av.checked_at },
    picked_at: o.now ?? new Date().toISOString(),
  }
}

/** Corpo recebido de outra function (nunca confiado): só os campos conhecidos, tipos e tamanhos fixos. */
export function cleanItemPick(raw: unknown): ItemPick | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.rule !== 'least_used' && r.rule !== 'opportunity' && r.rule !== 'owner_choice') return null
  const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null)
  const av = (r.availability && typeof r.availability === 'object' ? r.availability : {}) as Record<string, unknown>
  const attrs = (Array.isArray(r.attributes) ? r.attributes : []).slice(0, 10).flatMap((a): ItemPick['attributes'] => {
    const x = a as Record<string, unknown>
    const key = str(x?.key).slice(0, 40), path = str(x?.path).slice(0, 80)
    const value = typeof x?.value === 'number' && Number.isFinite(x.value) ? x.value : str(x?.value).slice(0, 80)
    return key && path && value !== '' ? [{ key, value, path }] : []
  })
  const at = str(r.picked_at)
  return {
    rule: r.rule, candidates: n(r.candidates) ?? 1, usage_21d: n(r.usage_21d), cooldown_ok: typeof r.cooldown_ok === 'boolean' ? r.cooldown_ok : null,
    photos: n(r.photos) ?? 0, min_photos: n(r.min_photos) ?? DEFAULT_MIN_PHOTOS, attributes: attrs,
    availability: { status: str(av.status).slice(0, 40) || null, checked_at: str(av.checked_at).slice(0, 40) || null },
    picked_at: Number.isFinite(Date.parse(at)) ? at : new Date().toISOString(),
  }
}

/** UPDATE separado e tolerante, NUNCA no insert (PITFALLS): sem a coluna item_pick a peça nasce do mesmo jeito. */
export async function saveItemPick(admin: Admin, pieceId: string, pick: ItemPick | null | undefined): Promise<void> {
  if (!pick) return
  try {
    const { error } = await admin.from('marketing_ai_test_content').update({ item_pick: pick }).eq('id', pieceId)
    if (error) console.error('saveItemPick: item_pick não gravado (migration aplicada?)', pieceId, error.message)
  } catch (e) { console.error('saveItemPick falhou', pieceId, e) }
}

/** Quantas vezes cada imóvel entrou em peça nos últimos `days` dias (a rotação "menos usado"). */
export async function usageLastDays(admin: Admin, companyId: string, days = 21, itemIds?: string[]): Promise<Map<string, number>> {
  const since = new Date(Date.now() - days * 86400000).toISOString()
  let q = admin.from('marketing_ai_test_content').select('item_id').eq('company_id', companyId).not('item_id', 'is', null).gte('created_at', since)
  if (itemIds) q = q.in('item_id', itemIds)
  const { data } = await q
  const m = new Map<string, number>()
  for (const r of (data ?? []) as { item_id: string }[]) m.set(r.item_id, (m.get(r.item_id) ?? 0) + 1)
  return m
}

// ── conferência na hora de publicar ──
export type Revalidation =
  | { state: 'ok' }
  | { state: 'blocked'; status: string | null; label: string; reason: string }
  | { state: 'unverifiable'; reason: string }

/** IDs do XML do portal (VRSync). Só os ListingID — o resto do parser fica no portal-import. */
export function extractListingIds(xml: string): Set<string> {
  const ids = new Set<string>()
  const re = /<ListingID\b[^>]*>\s*(?:<!\[CDATA\[)?\s*([^<\]]*?)\s*(?:\]\]>)?\s*<\/ListingID>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) { const id = m[1].trim().slice(0, 80); if (id) ids.add(id) }
  return ids
}

export type FeedResult = { ok: true; ids: Set<string> } | { ok: false; error: string }
export type FeedFetcher = (url: string) => Promise<FeedResult>

const safeFeedUrl = (raw: string): boolean => isSafeUrl(raw) !== null

/** Baixa o link do portal com prazo de 8 s. Qualquer falha (rede, prazo, status, XML sem anúncios) = "não deu pra conferir". */
export async function fetchFeedIds(url: string, timeoutMs = FEED_TIMEOUT_MS, fetchFn: typeof fetch = fetch): Promise<FeedResult> {
  if (!safeFeedUrl(url)) return { ok: false, error: 'link do portal inválido' }
  try {
    // Redirecionamentos seguidos à mão (até 3), cada destino validado — mesma proteção do portal-import.
    const signal = AbortSignal.timeout(timeoutMs)
    let target = url
    let res = await fetchFn(target, { signal, redirect: 'manual', headers: { 'User-Agent': 'SalesBoost-availability/1.0' } })
    for (let hop = 0; hop < 3 && res.status >= 300 && res.status < 400; hop++) {
      const loc = res.headers.get('location')
      await res.body?.cancel()
      const next = loc ? new URL(loc, target).toString() : ''
      if (!next || !safeFeedUrl(next)) return { ok: false, error: 'o link do portal redirecionou para um endereço inválido' }
      target = next
      res = await fetchFn(target, { signal, redirect: 'manual', headers: { 'User-Agent': 'SalesBoost-availability/1.0' } })
    }
    if (!res.ok) { await res.body?.cancel(); return { ok: false, error: `o link do portal respondeu ${res.status}` } }
    const reader = res.body?.getReader()
    let text = ''
    if (reader) {
      const dec = new TextDecoder(); let total = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > FEED_MAX_BYTES) { await reader.cancel(); return { ok: false, error: 'o link do portal é grande demais' } }
        text += dec.decode(value, { stream: true })
      }
    } else text = await res.text()
    const ids = extractListingIds(text)
    // XML sem nenhum anúncio = link quebrado/página de erro: NUNCA tratar como "todos removidos".
    return ids.size ? { ok: true, ids } : { ok: false, error: 'o link do portal não trouxe anúncios' }
  } catch (e) {
    return { ok: false, error: /timed? ?out|abort/i.test(String(e)) ? 'o link do portal demorou demais' : 'não consegui abrir o link do portal' }
  }
}

export interface RevalidateDeps {
  item: ItemLike | null
  cfg: ItemCfg
  feedUrl: string | null
  fetchFeed: FeedFetcher
  save: (a: { status: string; source: 'portal_feed'; checked_at: string; note?: string }) => Promise<void>
  now: number
}

const blockedOf = (status: string | null, cfg: AvailabilityCfg | null, note?: string): Revalidation => {
  const label = statusLabel(cfg, status)
  return { state: 'blocked', status, label, reason: `Imóvel indisponível (${label.toLowerCase() || 'sem status'}).${note ? ` ${note}` : ''}` }
}

/** Núcleo da conferência (sem banco): status manual + link do portal. Ver o cabeçalho do arquivo para as regras. */
export async function revalidateWith(d: RevalidateDeps): Promise<Revalidation> {
  const av = d.cfg.availability
  if (!av) return { state: 'ok' }                                  // ficha sem disponibilidade: nada bloqueado
  if (!d.item) return blockedOf(av.removed, av, 'Ele não está mais no Catálogo.')
  const cur = availabilityOf(d.item, av)
  const fresh = cur.source === 'portal_feed' && !!cur.checked_at && d.now - Date.parse(cur.checked_at) < FEED_CACHE_MS
  if (cur.blocking && cur.source !== 'portal_feed') return blockedOf(cur.status, av)   // status manual vence: nem consulta o portal
  if (fresh) return cur.blocking ? blockedOf(cur.status, av) : { state: 'ok' }         // conferido há menos de 1 h

  const raw = d.item.meta?.source?.listing_id
  const listingId = (typeof raw === 'string' || typeof raw === 'number') ? String(raw).trim().slice(0, 80) : ''
  // Só manual: sem anúncio de origem, sem link do portal configurado ou ficha sem status "removido" → nunca "não verificável".
  if (!listingId || !d.feedUrl || !av.removed) return cur.blocking ? blockedOf(cur.status, av) : { state: 'ok' }

  const feed = await d.fetchFeed(d.feedUrl)
  if (!feed.ok) return { state: 'unverifiable', reason: feed.error }
  const checked_at = new Date(d.now).toISOString()
  if (!feed.ids.has(listingId)) {
    await d.save({ status: av.removed, source: 'portal_feed', checked_at, note: 'Não está mais no link do portal.' })
    return blockedOf(av.removed, av, 'Ele não está mais no link do portal.')
  }
  // Está no link. Só reescreve o que o próprio portal gravou ou quem nunca foi conferido (status manual não-bloqueante e diferente do padrão fica como o dono pôs).
  if (cur.source === 'portal_feed' || cur.never_checked || cur.status === av.default) await d.save({ status: av.default, source: 'portal_feed', checked_at })
  return { state: 'ok' }
}

/** Depois de quanto tempo "não deu pra conferir" vira falha: 2 h a partir do horário em que a ação deveria sair. */
export function unverifiableOutcome(sinceIso: string | null | undefined, nowMs: number): 'retry' | 'fail' {
  const since = sinceIso ? Date.parse(sinceIso) : NaN
  if (!Number.isFinite(since)) return 'retry'                      // sem relógio ainda: o chamador começa a contar agora
  return nowMs - since >= UNVERIFIABLE_MAX_MS ? 'fail' : 'retry'
}

export const UNVERIFIABLE_FAIL_MESSAGE = 'Não foi possível verificar a disponibilidade'

// Memória por feed_url (60 s): uma rodada do cron com N ações do mesmo link baixa o XML uma vez só (8 s × N estouraria os 150 s).
const feedMemo = new Map<string, { at: number; p: Promise<FeedResult> }>()
const FEED_MEMO_MS = 60_000
export const memoFeed = (url: string, fn: FeedFetcher = u => fetchFeedIds(u), now = Date.now()): Promise<FeedResult> => {
  const hit = feedMemo.get(url)
  if (hit && now - hit.at < FEED_MEMO_MS) return hit.p
  const p = fn(url)
  feedMemo.set(url, { at: now, p })
  return p
}
export const clearFeedMemo = () => feedMemo.clear()

/** Confere o imóvel agora (banco + link do portal). Nunca lança. Erro de leitura (ficha, empresa, imóvel, integração) = unverifiable, NUNCA "ok". */
export async function revalidate(admin: Admin, companyId: string, itemId: string, opts: { cfg?: ItemCfg; verticalKey?: string | null; fetchFeed?: FeedFetcher; now?: number } = {}): Promise<Revalidation> {
  const unread = (what: string): Revalidation => ({ state: 'unverifiable', reason: `não consegui ler ${what}` })
  try {
    let cfg: ItemCfg | null | undefined = opts.cfg
    if (!cfg) {
      let vk = opts.verticalKey
      if (vk === undefined) {
        const { data: co, error } = await admin.from('companies').select('vertical_key').eq('id', companyId).maybeSingle()
        if (error || !co) return unread('a empresa')
        vk = co.vertical_key ?? null
      }
      cfg = await fetchItemCfgStrict(admin, vk ?? null)
      if (!cfg) return unread('a ficha do setor')
    }
    if (!cfg.availability) return { state: 'ok' }
    const { item, failed } = await getItemChecked(admin, companyId, itemId)
    if (failed) return unread('o catálogo')
    let feedUrl: string | null = null
    if (item?.meta?.source?.listing_id !== undefined) {
      const { data: integ, error } = await admin.from('company_integrations').select('metadata').eq('company_id', companyId).eq('type', 'portal_feed').maybeSingle()
      if (error) return unread('a integração do portal')
      const u = (integ?.metadata as { feed_url?: unknown } | null)?.feed_url
      feedUrl = typeof u === 'string' && u.trim() ? u.trim() : null
    }
    const base = opts.fetchFeed ?? (url => fetchFeedIds(url))
    return await revalidateWith({
      item, cfg, feedUrl, now: opts.now ?? Date.now(), fetchFeed: url => memoFeed(url, base, opts.now ?? Date.now()),
      save: a => saveAvailability(admin, companyId, itemId, a),
    })
  } catch (e) {
    console.error('itemService.revalidate falhou', itemId, String(e).slice(0, 200))
    return { state: 'unverifiable', reason: 'erro ao consultar o catálogo' }
  }
}

/** Grava meta.availability relendo o meta logo antes (não atropela foto/campo editado há pouco). */
export async function saveAvailability(admin: Admin, companyId: string, itemId: string, a: { status: string; source: 'manual' | 'portal_feed'; checked_at: string; note?: string }): Promise<void> {
  const { data } = await admin.from('marketing_ai_knowledge').select('meta').eq('id', itemId).eq('company_id', companyId).eq('kind', 'product').maybeSingle()
  if (!data) return
  const meta = { ...((data.meta ?? {}) as Record<string, unknown>), availability: { status: a.status, source: a.source, checked_at: a.checked_at, ...(a.note ? { note: a.note.slice(0, 200) } : {}) } }
  const { error } = await admin.from('marketing_ai_knowledge').update({ meta }).eq('id', itemId).eq('company_id', companyId)
  if (error) console.error('itemService.saveAvailability falhou', itemId, error.message)
}
