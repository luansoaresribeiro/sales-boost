// Página pública do imóvel (Etapa 5) — I/O (banco). A lógica pura está em publicPage.ts. Chamado pelo marketing-ai.
//
// SUPERFÍCIE PÚBLICA (sem login): tudo passa pela service role aqui dentro; a página nunca fala com o banco. As 3 ações públicas
// (public_page_get / public_page_event / public_page_lead) respondem 404 IDÊNTICO a qualquer falha de leitura (código inválido,
// página desligada, empresa sem plano pago, imóvel apagado) — quem tenta adivinhar códigos não aprende nada. Nunca devolve campo
// fora da lista branca da ficha, nem foto mobiliada (staged), nem telefone/Instagram que o dono não aprovou. Nada é enviado ao
// visitante e nenhum IP é guardado (visitor_hash = SHA-256 com sal).
import { hasPaidAccess } from './access.ts'
import {
  LEAD_SOURCE, LEAD_STAGE_NEW, NOT_FOUND_BODY, appendLinkOnce, clientIp, consentText, generateCode, instagramHandle, instagramUrl, isBot,
  isUuid, isValidCode, leadLimit, leadNotes, linkLine, lng, parsePublicPageConfig, publicFields, publicLink, publicPhotos,
  validateLead, visitorHash, whatsappNumber, whatsappUrl, LIMITS, type Lang, type PublicPageConfig,
} from './publicPage.ts'

type Admin = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any
export interface Reply { status: number; body: Record<string, unknown> }
const NOT_FOUND: Reply = { status: 404, body: { ...NOT_FOUND_BODY } }
const UNAVAILABLE: Reply = { status: 503, body: { error: 'unavailable' } }
const DAY_MS = 24 * 3600_000
const HOUR_MS = 3600_000
const isoAgo = (ms: number) => new Date(Date.now() - ms).toISOString()

export type LinkChannel = 'caption' | 'dm' | 'bio' | 'manual'
interface LinkRow { id: string; code: string; company_id: string; item_id: string; opportunity_id: string | null; channel: string }

// ── link rastreável ──
/** Acha ou cria o link de (imóvel, oportunidade, canal). A unicidade é do banco; colisão de código sorteia outro. Nunca lança. */
export async function ensureTrackedLink(admin: Admin, o: { companyId: string; itemId: string; opportunityId?: string | null; contentId?: string | null; channel: LinkChannel }): Promise<{ id: string; code: string } | null> {
  const find = async () => {
    let q = admin.from('tracked_links').select('id, code').eq('company_id', o.companyId).eq('item_id', o.itemId).eq('channel', o.channel)
    q = o.opportunityId ? q.eq('opportunity_id', o.opportunityId) : q.is('opportunity_id', null)
    const { data, error } = await q.limit(1).maybeSingle()
    return error ? { error } : { row: (data ?? null) as { id: string; code: string } | null }
  }
  try {
    const first = await find()
    if ('error' in first) { console.error('[public_page] tracked_links leitura:', first.error.message); return null }
    if (first.row) return first.row
    for (let i = 0; i < 5; i++) {
      const { data, error } = await admin.from('tracked_links').insert({
        company_id: o.companyId, code: generateCode(), item_id: o.itemId, opportunity_id: o.opportunityId ?? null, content_id: o.contentId ?? null, channel: o.channel,
      }).select('id, code').single()
      if (!error && data) return data as { id: string; code: string }
      if (error?.code !== '23505') { console.error('[public_page] tracked_links insert:', error?.message); return null }
      const again = await find() // alguém criou o mesmo (imóvel, oportunidade, canal) agora → usa esse; senão foi colisão de código
      if ('row' in again && again.row) return again.row
    }
  } catch (e) { console.error('[public_page] tracked_links:', String(e)) }
  return null
}

// ── leitura pública ──
interface Live {
  link: LinkRow; lang: Lang; cfg: PublicPageConfig; title: string
  page: { contact_phone: string | null; contact_ig: string | null }
  company: { id: string; name: string; logo: string | null }
  fields: ReturnType<typeof publicFields>; photos: string[]
}
/** Carrega a página no ar. null = qualquer motivo para não existir (a camada de cima responde o mesmo 404). */
async function loadLive(admin: Admin, code: unknown): Promise<Live | null> {
  if (!isValidCode(code)) return null
  try {
    const { data: link } = await admin.from('tracked_links').select('id, code, company_id, item_id, opportunity_id, channel').eq('code', code).maybeSingle()
    if (!link) return null
    const { data: page } = await admin.from('public_pages').select('enabled, contact_phone, contact_ig').eq('item_id', link.item_id).eq('company_id', link.company_id).maybeSingle()
    if (!page || page.enabled !== true) return null
    const { data: item } = await admin.from('marketing_ai_knowledge').select('id, title, meta').eq('id', link.item_id).eq('company_id', link.company_id).eq('kind', 'product').maybeSingle()
    if (!item) return null
    const { data: co } = await admin.from('companies').select('id, business_name, language, vertical_key').eq('id', link.company_id).maybeSingle()
    if (!co) return null
    if (!(await hasPaidAccess(admin, co.id))) return null // conta sem plano pago: a página sai do ar
    const { data: pb } = await admin.from('vertical_playbooks').select('config').eq('key', co.vertical_key ?? '').eq('enabled', true).maybeSingle()
    const cfg = parsePublicPageConfig(pb?.config?.public_page)
    if (!cfg) return null
    const photos = publicPhotos(item.meta)
    if (photos.length < cfg.min_photos) return null // dono apagou fotos depois de publicar: sai do ar até repor
    const lang = lng(co.language)
    const { data: dna } = await admin.from('brand_dna').select('logo_url').eq('company_id', co.id).maybeSingle()
    const logo = typeof dna?.logo_url === 'string' && /^https:\/\//i.test(dna.logo_url) ? dna.logo_url : null
    return {
      link: link as LinkRow, lang, cfg, title: String(item.title ?? '').slice(0, 160),
      page: { contact_phone: page.contact_phone ?? null, contact_ig: page.contact_ig ?? null },
      company: { id: co.id, name: String(co.business_name ?? ''), logo },
      fields: publicFields(pb?.config?.catalog_fields, cfg, item.meta?.fields, lang), photos,
    }
  } catch (e) { console.error('[public_page] loadLive:', String(e)); return null }
}

export interface PublicCtx { salt: string; ip: string; ua: string }
export const publicCtxFrom = (req: Request, salt: string): PublicCtx => ({ salt, ip: clientIp(req.headers), ua: req.headers.get('user-agent') ?? '' })
const hashFor = (ctx: PublicCtx) => visitorHash(ctx.ip, ctx.ua, new Date().toISOString().slice(0, 10), ctx.salt)

async function logEvent(admin: Admin, live: Live, event: string, hash: string, leadId?: string): Promise<void> {
  const { error } = await admin.from('link_events').insert({ company_id: live.company.id, link_id: live.link.id, event, visitor_hash: hash, ...(leadId ? { lead_id: leadId } : {}) })
  if (error) console.error(`[public_page] link_events ${event}:`, error.message)
}

export const PUBLIC_ACTIONS = ['public_page_get', 'public_page_event', 'public_page_lead'] as const

export async function handlePublicPage(admin: Admin, action: string, body: Record<string, unknown>, ctx: PublicCtx): Promise<Reply> {
  const live = await loadLive(admin, body.code)
  if (!live) return NOT_FOUND
  try {
    const hash = await hashFor(ctx)
    if (action === 'public_page_get') {
      if (!isBot(ctx.ua)) {
        // 1 visita por visitante, por link, por dia (o hash já muda a cada dia).
        const { count, error } = await admin.from('link_events').select('id', { count: 'exact', head: true }).eq('link_id', live.link.id).eq('event', 'view').eq('visitor_hash', hash)
        if (error) console.error('[public_page] view leitura:', error.message)
        else if ((count ?? 0) === 0) await logEvent(admin, live, 'view', hash)
      }
      const cc = live.cfg.country_code
      return { status: 200, body: {
        ok: true, lang: live.lang, title: live.title, company: { name: live.company.name, logo_url: live.company.logo },
        fields: live.fields, photos: live.photos,
        buttons: { whatsapp: whatsappNumber(live.page.contact_phone, cc) !== null, dm: instagramUrl(live.page.contact_ig) !== null },
        consent_text: consentText(live.lang, live.company.name),
      } }
    }

    if (action === 'public_page_event') {
      const ev = body.event
      if (ev !== 'click_whatsapp' && ev !== 'click_dm') return { status: 400, body: { error: 'invalid_event' } }
      const url = ev === 'click_whatsapp' ? whatsappUrl(live.page.contact_phone, live.title, live.lang, live.cfg.country_code) : instagramUrl(live.page.contact_ig)
      if (!url) return NOT_FOUND // botão que a página não oferece
      const { count } = await admin.from('link_events').select('id', { count: 'exact', head: true }).eq('link_id', live.link.id).eq('visitor_hash', hash).in('event', ['click_whatsapp', 'click_dm']).gte('created_at', isoAgo(HOUR_MS))
      if ((count ?? 0) < 30) await logEvent(admin, live, ev, hash) // acima disso o visitante ainda é redirecionado, só não enche o banco
      return { status: 200, body: { ok: true, url } }
    }

    // public_page_lead
    const v = validateLead(body)
    if (!v.ok) {
      if (v.error === 'honeypot') return { status: 200, body: { ok: true } } // robô: finge sucesso, não grava nada
      return { status: 400, body: { error: 'invalid', field: v.error } }
    }
    const [visitor, linkDay, dup] = await Promise.all([
      admin.from('link_events').select('id', { count: 'exact', head: true }).eq('event', 'lead').eq('visitor_hash', hash).gte('created_at', isoAgo(HOUR_MS)),
      admin.from('link_events').select('id', { count: 'exact', head: true }).eq('event', 'lead').eq('link_id', live.link.id).gte('created_at', isoAgo(DAY_MS)),
      admin.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', live.company.id).eq('item_id', live.link.item_id).eq('contact', v.value.contact).gte('created_at', isoAgo(LIMITS.dedupeHours * HOUR_MS)),
    ])
    if (visitor.error || linkDay.error || dup.error) { console.error('[public_page] limites:', visitor.error?.message ?? linkDay.error?.message ?? dup.error?.message); return UNAVAILABLE }
    const limited = leadLimit({ visitorLastHour: visitor.count ?? 0, linkLast24h: linkDay.count ?? 0, duplicate24h: (dup.count ?? 0) > 0 })
    if (limited === 'duplicate') return { status: 200, body: { ok: true } } // mesmo contato e imóvel em 24 h: já recebemos
    if (limited) return { status: 429, body: { error: 'rate_limited' } }

    const { data: lead, error } = await admin.from('leads').insert({
      company_id: live.company.id, name: v.value.name, contact: v.value.contact,
      // 'manual' e 'new' são valores que o sistema já grava hoje (hermes-proxy / instagram-webhook): não batem em constraint.
      channel: 'manual', source: LEAD_SOURCE, stage: LEAD_STAGE_NEW,
      notes: leadNotes(live.lang, live.title, v.value.message),
      item_id: live.link.item_id, opportunity_id: live.link.opportunity_id, link_id: live.link.id,
      consent_at: new Date().toISOString(), consent_text: consentText(live.lang, live.company.name),
    }).select('id').single()
    if (error || !lead) { console.error('[public_page] lead insert:', error?.message); return UNAVAILABLE }
    await logEvent(admin, live, 'lead', hash, lead.id as string)
    return { status: 200, body: { ok: true } }
  } catch (e) { console.error('[public_page]', action, String(e)); return UNAVAILABLE }
}

// ── dono (com login) ──
async function loadOwnerContext(admin: Admin, companyId: string, itemId: unknown) {
  if (!isUuid(itemId)) return { error: { status: 400, body: { error: 'item_id inválido.' } } as Reply }
  const { data: item } = await admin.from('marketing_ai_knowledge').select('id, title, meta').eq('id', itemId).eq('company_id', companyId).eq('kind', 'product').maybeSingle()
  if (!item) return { error: { status: 404, body: { error: 'Imóvel não encontrado.' } } as Reply }
  const { data: co } = await admin.from('companies').select('id, language, vertical_key, phone, instagram_username, instagram_url').eq('id', companyId).maybeSingle()
  if (!co) return { error: { status: 404, body: { error: 'Empresa não encontrada.' } } as Reply }
  const { data: pb } = await admin.from('vertical_playbooks').select('config').eq('key', co.vertical_key ?? '').eq('enabled', true).maybeSingle()
  const cfg = parsePublicPageConfig(pb?.config?.public_page)
  if (!cfg) return { error: { status: 400, body: { error: 'Este setor ainda não tem página pública na ficha.' } } as Reply }
  return { item, co, cfg, catalog: pb?.config?.catalog_fields }
}

/** O que o modal do card mostra: estado atual + prévia exata do que a página vai exibir. */
export async function getPublicPageState(admin: Admin, companyId: string, itemId: unknown): Promise<Reply> {
  const ctx = await loadOwnerContext(admin, companyId, itemId)
  if (ctx.error) return ctx.error
  const { item, co, cfg, catalog } = ctx
  const lang = lng(co.language)
  const { data: page } = await admin.from('public_pages').select('enabled, contact_phone, contact_ig, approved_at').eq('item_id', item.id).eq('company_id', companyId).maybeSingle()
  const enabled = page?.enabled === true
  // No ar: mostra o que está publicado. Desligada: mostra o que iria aparecer se o dono aprovar agora.
  const phone = enabled ? page.contact_phone : (co.phone ?? null)
  const ig = enabled ? page.contact_ig : instagramHandle(co.instagram_username, co.instagram_url)
  let link: string | null = null
  if (enabled) { const l = await ensureTrackedLink(admin, { companyId, itemId: item.id, channel: 'manual' }); link = l ? publicLink(l.code) : null }
  const photos = publicPhotos(item.meta)
  return { status: 200, body: {
    ok: true, enabled, approved_at: page?.approved_at ?? null, link, title: item.title, lang,
    fields: publicFields(catalog, cfg, item.meta?.fields, lang), photos: photos.slice(0, 4), photos_count: photos.length, min_photos: cfg.min_photos,
    contact: { phone: whatsappNumber(phone, cfg.country_code) ? phone : null, ig: instagramUrl(ig) ? ig : null },
  } }
}

/** Aprovação do dono: liga/desliga a página. Ligar exige o mínimo de fotos reais; cria (ou reaproveita) o link 'manual'. */
export async function setPublicPage(admin: Admin, companyId: string, userId: string, itemId: unknown, enabled: unknown): Promise<Reply> {
  if (typeof enabled !== 'boolean') return { status: 400, body: { error: 'enabled deve ser true ou false.' } }
  const ctx = await loadOwnerContext(admin, companyId, itemId)
  if (ctx.error) return ctx.error
  const { item, co, cfg } = ctx
  if (!enabled) {
    const { error } = await admin.from('public_pages').update({ enabled: false }).eq('item_id', item.id).eq('company_id', companyId)
    if (error) return { status: 500, body: { error: error.message } }
    return { status: 200, body: { ok: true, enabled: false } }
  }
  const photos = publicPhotos(item.meta).length
  if (photos < cfg.min_photos) return { status: 400, body: { error: `Precisa de pelo menos ${cfg.min_photos} fotos reais para publicar (tem ${photos}).`, code: 'min_photos', min_photos: cfg.min_photos, photos_count: photos } }
  const phone = whatsappNumber(co.phone, cfg.country_code) ? String(co.phone).trim().slice(0, 40) : null
  const ig = instagramHandle(co.instagram_username, co.instagram_url)
  const { error } = await admin.from('public_pages').upsert({
    item_id: item.id, company_id: companyId, enabled: true, approved_at: new Date().toISOString(), approved_by: userId, contact_phone: phone, contact_ig: ig,
  }, { onConflict: 'item_id' })
  if (error) return { status: 500, body: { error: error.message } }
  const link = await ensureTrackedLink(admin, { companyId, itemId: item.id, channel: 'manual' })
  if (!link) return { status: 500, body: { error: 'Não consegui criar o link da página.' } }
  return { status: 200, body: { ok: true, enabled: true, link: publicLink(link.code), contact: { phone, ig } } }
}

// ── link nas peças (cron) e na mensagem do QUERO ──
export const CAPTION_LINK_BATCH = 20
/**
 * Rascunhos de oportunidade cujo imóvel tem página no ar ganham, UMA vez, a frase da ficha com o link (canal 'caption').
 * Nunca mexe em peça já aprovada (ação APPROVED), agendada ou publicada: só `draft`/`vault` sem aprovação. Um link por
 * (imóvel, oportunidade): as peças da mesma oportunidade compartilham o código. Nunca lança; devolve quantas legendas mudou.
 */
export async function attachTrackedLinks(admin: Admin, companyId: string, rawPublicPage: unknown): Promise<number> {
  try {
    const cfg = parsePublicPageConfig(rawPublicPage)
    if (!cfg) return 0
    const { data: pages, error: pErr } = await admin.from('public_pages').select('item_id').eq('company_id', companyId).eq('enabled', true)
    if (pErr) { console.error('[public_page] attach pages:', pErr.message); return 0 }
    const itemIds = ((pages ?? []) as { item_id: string }[]).map(p => p.item_id)
    if (!itemIds.length) return 0
    const { data: co } = await admin.from('companies').select('language').eq('id', companyId).maybeSingle()
    const lang = lng(co?.language)
    const { data: drafts, error: dErr } = await admin.from('marketing_ai_test_content').select('id, item_id, opportunity_id, caption, status')
      .eq('company_id', companyId).in('status', ['draft', 'vault']).not('opportunity_id', 'is', null).in('item_id', itemIds).order('created_at', { ascending: false }).limit(CAPTION_LINK_BATCH)
    if (dErr) { console.error('[public_page] attach rascunhos:', dErr.message); return 0 }
    const rows = ((drafts ?? []) as { id: string; item_id: string; opportunity_id: string; caption: string | null; status: string }[]).filter(r => typeof r.caption === 'string' && r.caption.trim())
    if (!rows.length) return 0
    // Peça já aprovada pelo dono (ação APPROVED, inclusive agendada): fica exatamente como ele aprovou. Erro na consulta = não mexe em nada.
    const { data: approved, error: aErr } = await admin.from('agent_actions').select('ref_id').eq('company_id', companyId).eq('ref_type', 'marketing_ai_test_content').eq('approval_status', 'APPROVED').in('ref_id', rows.map(r => r.id))
    if (aErr) { console.error('[public_page] attach aprovadas:', aErr.message); return 0 }
    const locked = new Set(((approved ?? []) as { ref_id: string }[]).map(a => a.ref_id))
    let changed = 0
    for (const r of rows) {
      if (locked.has(r.id)) continue
      const l = await ensureTrackedLink(admin, { companyId, itemId: r.item_id, opportunityId: r.opportunity_id, contentId: r.id, channel: 'caption' })
      if (!l) continue
      const link = publicLink(l.code)
      const next = appendLinkOnce(r.caption as string, linkLine(cfg, lang, link), link)
      if (!next.changed) continue
      // Troca condicional: se o dono editou a legenda nesse meio-tempo, não sobrescreve.
      const { data: up, error } = await admin.from('marketing_ai_test_content').update({ caption: next.text }).eq('id', r.id).eq('company_id', companyId).eq('caption', r.caption).in('status', ['draft', 'vault']).select('id')
      if (error) console.error('[public_page] attach legenda:', r.id, error.message)
      else if ((up ?? []).length) changed++
    }
    return changed
  } catch (e) { console.error('[public_page] attachTrackedLinks:', String(e)); return 0 }
}

/** Mensagem NOVA do "Comente QUERO": se o imóvel tem página no ar, acrescenta a frase com o link (canal 'dm'). Sem página: devolve a mesma. */
export async function withDmLink(admin: Admin, companyId: string, itemId: string, lang: Lang, rawPublicPage: unknown, message: string): Promise<string> {
  try {
    const cfg = parsePublicPageConfig(rawPublicPage)
    if (!cfg) return message
    const { data: page } = await admin.from('public_pages').select('enabled').eq('item_id', itemId).eq('company_id', companyId).maybeSingle()
    if (page?.enabled !== true) return message
    const l = await ensureTrackedLink(admin, { companyId, itemId, channel: 'dm' })
    if (!l) return message
    const link = publicLink(l.code)
    return appendLinkOnce(message, linkLine(cfg, lang, link), link).text
  } catch (e) { console.error('[public_page] withDmLink:', String(e)); return message }
}
