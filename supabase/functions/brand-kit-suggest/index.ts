/**
 * brand-kit-suggest — o agente decide o Kit da Marca sozinho, a partir dos
 * arquivos reais (fotos publicadas no Instagram + fotos de produto), sem
 * exigir que o dono escolha cor por cor. Roda automaticamente (cron
 * semanal, `cron_secret`) além de um "atualizar agora" manual — os dois
 * caminhos SALVAM direto em `brand_dna`. Só para de sobrescrever depois
 * que o dono edita e salva manualmente o kit (brand_dna.auto_generated
 * vira false nesse momento — ver BrandKit.tsx).
 *
 * Nunca inventa cor fora do que está nas fotos reais; sem fotos reais
 * suficientes, não gera nada (fica com o que já existia).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hasPaidAccess, requirePaidAccess } from '../_shared/access.ts'
import { processLogoPixels, downscale, isSafeLogoUrl, type LogoMeta } from '../_shared/logoPng.ts'
import { decodeImage, encodePng, svgToPng, fetchLogoBytes, toBase64, probeLibs, MAX_SVG_BYTES } from '../_shared/logoCodec.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Suggestion {
  colors: { primary: string[]; accent: string[]; text: string; bg: string }
  composition: string
}

const IMG_RE = /\.(jpg|jpeg|png|webp)(\?|$)/i
const IG = 'https://graph.instagram.com/v21.0'

// Logo automático: se a empresa já tem Instagram conectado e ainda NÃO tem
// nenhum logo no Kit da Marca, pega a foto de perfil real (mesma API que já
// funciona em instagram-performance) e REHOSPEDA no nosso Storage — o link
// que a Meta devolve é temporário, salvar ele direto quebraria em poucos
// dias. Nunca sobrescreve um logo que já existe (manual ou já buscado antes).
async function fetchInstagramLogo(admin: ReturnType<typeof createClient>, companyId: string): Promise<string | null> {
  try {
    const { data: company } = await admin.from('companies').select('instagram_access_token, instagram_user_id').eq('id', companyId).maybeSingle()
    const token = company?.instagram_access_token as string | null, igUserId = company?.instagram_user_id as string | null
    if (!token || !igUserId) return null

    const profRes = await fetch(`${IG}/${igUserId}?fields=profile_picture_url&access_token=${token}`)
    if (!profRes.ok) return null
    const prof = await profRes.json().catch(() => ({})) as { profile_picture_url?: string }
    if (!prof.profile_picture_url) return null

    const imgRes = await fetch(prof.profile_picture_url)
    if (!imgRes.ok) return null
    const bytes = new Uint8Array(await imgRes.arrayBuffer())
    const path = `renders/${companyId}/logo-ig-${crypto.randomUUID()}.jpg`
    const { error } = await admin.storage.from('post-images').upload(path, bytes, { contentType: imgRes.headers.get('content-type') || 'image/jpeg', upsert: false })
    if (error) return null
    const { data: pub } = admin.storage.from('post-images').getPublicUrl(path)
    return pub.publicUrl
  } catch (e) { console.error('fetchInstagramLogo error:', e); return null }
}

async function gatherRealPhotoUrls(admin: ReturnType<typeof createClient>, companyId: string): Promise<string[]> {
  const [{ data: posts }, { data: products }] = await Promise.all([
    admin.from('instagram_content_performance').select('media_url, thumbnail_url').eq('company_id', companyId).order('posted_at', { ascending: false }).limit(20),
    admin.from('marketing_ai_knowledge').select('image_url').eq('company_id', companyId).eq('module', 'visual').eq('kind', 'product').order('created_at', { ascending: false }).limit(10),
  ])
  // thumbnail_url é a nossa cópia permanente (rehostada pelo instagram-performance);
  // media_url é o link original da Meta, que expira em poucos dias — sempre
  // preferir a cópia permanente, senão a IA recebe um link morto e falha
  // silenciosamente.
  const fromPosts = (posts ?? []).map(p => (p.thumbnail_url as string | null) ?? (p.media_url as string | null))
  const fromProducts = (products ?? []).map(p => p.image_url as string | null)
  return [...fromPosts, ...fromProducts].filter((u): u is string => !!u && IMG_RE.test(u)).slice(0, 8)
}

async function askClaude(anthropicKey: string, urls: string[]): Promise<Suggestion | null> {
  const prompt = `Você é um diretor de arte. Olhe estas ${urls.length} fotos reais (posts publicados + fotos de produto) desta empresa e identifique o sistema visual que elas já têm (não invente nada fora do que você vê nas imagens).

Retorne SOMENTE um JSON:
{"colors":{"primary":["#hex1","#hex2"],"accent":["#hex1","#hex2"],"text":"#hex","bg":"#hex"},"composition":"1-2 frases em português descrevendo o estilo visual recorrente (enquadramento, luz, densidade, onde fica o foco)"}

- "primary": as 2 cores que mais aparecem/definem a identidade nas fotos.
- "accent": 2 cores de destaque que aparecem com menos frequência (detalhes, produtos, texto).
- "text"/"bg": uma cor de texto e uma de fundo que teriam bom contraste com as cores principais.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: [...urls.map(url => ({ type: 'image', source: { type: 'url', url } })), { type: 'text', text: prompt }] }],
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  const raw = (data.content?.[0]?.text ?? '').replace(/```(?:json)?\n?/g, '').trim()
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.colors?.primary && parsed?.colors?.accent) return parsed as Suggestion
  } catch { /* falls through */ }
  return null
}

// Análise do LOGO numa chamada só (pedido do dono, 2026-10-15; ampliada 2026-10-23): a IA diz
// (1) se a imagem é mesmo um LOGO ou uma FOTO (rosto, fachada, produto…) e (2) o sistema de cores
// da marca. Foto não vira logo nos criativos (cai no nome em texto) e as cores dela NÃO são usadas.
// Falha da IA / link quebrado → null (o chamador trata como "logo", comportamento de antes).
type Colors = Suggestion['colors']
type LogoSource = { url: string } | { base64: string; media: 'image/png' | 'image/jpeg' }
interface LogoAnalysis { kind: 'logo' | 'foto'; colors: Colors | null }
const HEX = /^#[0-9a-fA-F]{6}$/
async function analyzeLogo(anthropicKey: string, src: LogoSource): Promise<LogoAnalysis | null> {
  if ('url' in src && (!/^https:\/\//.test(src.url) || /\.svg(\?|$)/i.test(src.url))) return null
  try {
    const image = 'url' in src ? { type: 'image', source: { type: 'url', url: src.url } } : { type: 'image', source: { type: 'base64', media_type: src.media, data: src.base64 } }
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 350,
        messages: [{ role: 'user', content: [image, { type: 'text', text: `Esta imagem foi enviada como o logo de uma empresa. Primeiro classifique:
- "logo": marca/símbolo/letreiro/ícone/assinatura em texto — arte gráfica de marca, mesmo simples ou só com letras.
- "foto": fotografia (pessoa/rosto, fachada, imóvel, produto, paisagem, selfie). Foto de perfil com o rosto de alguém é "foto".
Depois extraia o sistema de cores DA MARCA a partir dela (não invente cor que não está na imagem; ignore fundo branco/transparente, a não ser que o logo seja só preto e branco). Se for "foto", pode devolver as cores mesmo assim (não serão usadas).
Responda SÓ em JSON: {"kind":"logo"|"foto","primary":["#hex","#hex"],"accent":["#hex","#hex"],"text":"#hex","bg":"#hex"}
- "primary": as 2 cores principais (se só tiver 1, repita uma versão mais escura dela).
- "accent": 2 cores secundárias (se não houver, tons da principal).
- "text" e "bg": texto e fundo de post com bom contraste, combinando com a marca.` }] }],
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) { console.error('analyzeLogo: IA recusou', res.status); return null }
    const data = await res.json()
    const raw = String(data.content?.[0]?.text ?? '').replace(/```(?:json)?\n?/g, '').trim()
    const c = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as Partial<Colors> & { kind?: string }
    const kind: 'logo' | 'foto' = c.kind === 'foto' ? 'foto' : 'logo'
    const two = (a: unknown) => Array.isArray(a) ? a.map(String).filter(x => HEX.test(x)).slice(0, 2) : []
    const primary = two(c.primary), accent = two(c.accent)
    if (!primary.length || !HEX.test(String(c.text)) || !HEX.test(String(c.bg))) return { kind, colors: null }
    while (primary.length < 2) primary.push(primary[0])
    while (accent.length < 2) accent.push(accent[0] ?? primary[1])
    return { kind, colors: { primary, accent, text: String(c.text), bg: String(c.bg) } }
  } catch (e) { console.error('analyzeLogo falhou', e); return null }
}

// ── PNG transparente do logo (2026-10-23) ──────────────────────────────────────────────────
// Entrada: o logo_url atual, um link colado ou o TEXTO de um SVG. Saída: PNG ≤1024 px no bucket
// post-images (renders/<empresa>/logo-png-<uuid>.png — o bucket só aceita png/jpeg/webp ≤5 MB,
// por isso SVG nunca vai pro bucket como SVG) + logo_meta { src, png_url, kind, luma, bg_removed }.
// Foto → só {kind:'foto'}. Fundo não liso → {kind:'logo', png_url:null} (não mexe). WebP/formato
// que não decodifica → mantém o original, sem PNG, com aviso.
interface LogoRun { meta: LogoMeta; colors: Colors | null; warning?: 'foto' | 'fundo' | 'formato' | 'ia'; logo_url?: string; error?: string }

async function uploadPng(admin: ReturnType<typeof createClient>, companyId: string, png: Uint8Array): Promise<string | null> {
  const path = `renders/${companyId}/logo-png-${crypto.randomUUID()}.png`
  const { error } = await admin.storage.from('post-images').upload(path, png, { contentType: 'image/png', upsert: false })
  if (error) { console.error('uploadPng falhou:', error.message); return null }
  return admin.storage.from('post-images').getPublicUrl(path).data.publicUrl
}

async function processLogo(admin: ReturnType<typeof createClient>, anthropicKey: string, companyId: string, input: { url?: string; svg?: string }): Promise<LogoRun> {
  const none = (src: string, kind: 'logo' | 'foto' = 'logo'): LogoMeta => ({ src, png_url: null, kind, luma: null, bg_removed: false })
  const inUrl = input.url ?? ''
  let svgPng: Uint8Array | null = null, original: Uint8Array | null = null, originalMime = ''
  if (typeof input.svg === 'string') {
    if (input.svg.length > MAX_SVG_BYTES) return { meta: none(inUrl), colors: null, error: 'SVG grande demais (máximo 500 KB).' }
    svgPng = await svgToPng(input.svg)
    if (!svgPng) return { meta: none(inUrl), colors: null, error: 'Não consegui ler esse SVG. Exporte o logo em PNG com fundo transparente.' }
  } else {
    if (!input.url || !isSafeLogoUrl(input.url)) return { meta: none(inUrl), colors: null, error: 'Endereço do logo não permitido (use um link https público).' }
    const f = await fetchLogoBytes(input.url)
    if ('error' in f) return { meta: none(inUrl), colors: null, error: f.error }
    if (f.isSvg) { svgPng = await svgToPng(new TextDecoder().decode(f.bytes)); if (!svgPng) return { meta: none(inUrl), colors: null, warning: 'formato' } }
    else { original = f.bytes; originalMime = f.mime }
  }
  const bytes = svgPng ?? original!
  const img = await decodeImage(bytes)
  const url = input.url ?? ''
  // Classificação sobre a imagem inteira (reduzida), com o fundo original.
  let analysis: LogoAnalysis | null = null
  if (img) analysis = await analyzeLogo(anthropicKey, { base64: toBase64(await encodePng(downscale(img))), media: 'image/png' })
  else if (url && originalMime) analysis = await analyzeLogo(anthropicKey, { url })
  const kind = analysis?.kind ?? 'logo'
  const colors = analysis?.colors ?? null
  const iaWarn = analysis ? undefined : 'ia' as const

  if (!img) return { meta: none(url, kind), colors, warning: 'formato' }            // WebP etc.: o original fica, sem PNG
  if (kind === 'foto') return { meta: none(url, 'foto'), colors, warning: 'foto' }

  const r = processLogoPixels(img)
  // SVG sempre vira PNG (não existe SVG no bucket); PNG/JPEG só vira PNG novo se o fundo foi tratado.
  const pngBytes = r ? await encodePng(r.img) : svgPng ? await encodePng(downscale(img)) : null
  const pngUrl = pngBytes ? await uploadPng(admin, companyId, pngBytes) : null
  if (svgPng && !pngUrl) return { meta: none(url), colors, error: 'Não consegui guardar o PNG do logo. Tente de novo.' }
  const fromSvgText = !!svgPng && !input.url
  const src = fromSvgText ? pngUrl! : url
  const dims = r ? { w: r.img.width, h: r.img.height } : pngUrl ? { w: Math.min(img.width, 1024), h: Math.round(img.height * Math.min(1, 1024 / Math.max(img.width, img.height))) } : {}
  const meta: LogoMeta = { src, png_url: pngUrl, kind: 'logo', luma: r?.luma ?? null, luma_lo: r?.luma_lo ?? null, luma_hi: r?.luma_hi ?? null, bg_removed: !!r?.bg_removed, ...dims }
  return { meta, colors, logo_url: fromSvgText ? pngUrl! : undefined, warning: r ? iaWarn : 'fundo' }
}

// logo_meta num passo à parte e tolerante: sem a migration (coluna ausente) o logo segue como antes.
async function saveLogoMeta(admin: ReturnType<typeof createClient>, companyId: string, meta: LogoMeta): Promise<boolean> {
  try {
    const { error } = await admin.from('brand_dna').upsert({ company_id: companyId, logo_meta: meta }, { onConflict: 'company_id' })
    if (error) { console.error('brand-kit-suggest: logo_meta não gravado (migration aplicada?)', error.message); return false }
    return true
  } catch (e) { console.error('brand-kit-suggest: logo_meta falhou', e); return false }
}

// Roda o pipeline sem nunca derrubar quem chamou (cron/on_connect).
async function processLogoSafe(admin: ReturnType<typeof createClient>, anthropicKey: string, companyId: string, url: string): Promise<LogoRun | null> {
  try { return await processLogo(admin, anthropicKey, companyId, { url }) } catch (e) { console.error('processLogo falhou', e); return null }
}

// Salva só as cores no kit (preserva tipografia/composição) e devolve as
// anteriores, pra tela oferecer "desfazer".
async function saveColors(admin: ReturnType<typeof createClient>, companyId: string, colors: Colors, extra: Record<string, unknown> = {}): Promise<Colors | null> {
  const { data: bd } = await admin.from('brand_dna').select('kit').eq('company_id', companyId).maybeSingle()
  const prevKit = (bd?.kit ?? {}) as Record<string, unknown> & { colors?: Colors }
  const kit = { typography: { heading: 'Bricolage Grotesque', body: 'Bricolage Grotesque' }, composition: '', ...prevKit, colors }
  await admin.from('brand_dna').upsert({ company_id: companyId, kit, colors: [...colors.primary, ...colors.accent], updated_at: new Date().toISOString(), ...extra }, { onConflict: 'company_id' })
  return prevKit.colors ?? null
}

// Logo puxado do Instagram mora em renders/<empresa>/logo-ig-*; enviado à
// mão é logo-<uuid> (ou um link colado). Só o do Instagram pode ser trocado
// sozinho — o do dono nunca.
const isIgLogo = (url: string | null | undefined) => !url || /\/logo-ig-/.test(url)

// Decide e SALVA — o dono só revisa depois, não precisa clicar em nada pra
// o kit existir. Preserva tipografia/voz já definidas (a IA não vê isso em
// foto); mexe em cores + composição, e agora também no logo (busca sozinho
// do Instagram conectado quando ainda não existe nenhum). Logo e cores são
// passos INDEPENDENTES — dá pra achar um logo mesmo sem fotos suficientes
// pra decidir cor, e vice-versa.
async function generateAndSave(admin: ReturnType<typeof createClient>, anthropicKey: string, companyId: string): Promise<{ ok: boolean; based_on?: number; suggestion?: Suggestion; logo_set?: boolean; error?: string }> {
  const { data: existing } = await admin.from('brand_dna').select('kit, logo_url').eq('company_id', companyId).maybeSingle()
  const prevKit = (existing?.kit as { typography?: { heading?: string; body?: string } } | null) ?? null

  let logoSet = false
  let logoUrl: string | null = null
  if (!(existing?.logo_url as string | null)) {
    logoUrl = await fetchInstagramLogo(admin, companyId)
    if (logoUrl) logoSet = true
  }

  const urls = await gatherRealPhotoUrls(admin, companyId)
  let suggestion = urls.length >= 2 ? await askClaude(anthropicKey, urls) : null
  // Logo novo do Instagram: mesma chamada da IA classifica (logo × foto) e lê as cores — as cores
  // da marca saem do logo (fotos só dão a composição); se a imagem for uma FOTO, as cores não valem.
  const logoRun = logoSet && logoUrl ? await processLogoSafe(admin, anthropicKey, companyId, logoUrl) : null
  const logoColors = logoRun && logoRun.meta.kind === 'logo' ? logoRun.colors : null
  if (logoColors) suggestion = { colors: logoColors, composition: suggestion?.composition ?? '' }

  if (!suggestion && !logoSet) {
    return { ok: false, error: urls.length < 2 ? 'Ainda não há fotos reais suficientes (Instagram ou Produtos) pra decidir um kit.' : 'A IA não conseguiu ler as cores das fotos.' }
  }

  const payload: Record<string, unknown> = { company_id: companyId, auto_generated: true, updated_at: new Date().toISOString() }
  if (suggestion) {
    payload.kit = {
      colors: suggestion.colors,
      typography: prevKit?.typography ?? { heading: 'Bricolage Grotesque', body: 'Bricolage Grotesque' },
      composition: suggestion.composition,
    }
    payload.colors = [...suggestion.colors.primary, ...suggestion.colors.accent].filter(Boolean)
  }
  if (logoSet) payload.logo_url = logoUrl

  const { error } = await admin.from('brand_dna').upsert(payload, { onConflict: 'company_id' })
  if (error) return { ok: false, error: error.message }
  if (logoRun) await saveLogoMeta(admin, companyId, logoRun.meta)

  return { ok: true, based_on: urls.length, suggestion: suggestion ?? undefined, logo_set: logoSet }
}

// ── backfill_logos ─────────────────────────────────────────────────────────────────────────
const BACKFILL_DEADLINE_MS = 90_000
const EST_USD_PER_LOGO = 0.003   // 1 chamada Haiku com imagem pequena
const strList = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0) : []

async function backfillLogos(admin: ReturnType<typeof createClient>, anthropicKey: string, body: Record<string, unknown>) {
  const t0 = Date.now()
  const dryRun = body.dry_run !== false
  const limit = Math.min(10, Math.max(1, Math.floor(Number(body.limit ?? 5)) || 5))
  const only = strList(body.only_company_ids), exclude = new Set(strList(body.exclude_company_ids))
  const libs = await probeLibs()

  const { data: rows, error } = await admin.from('brand_dna').select('company_id, logo_url').not('logo_url', 'is', null).neq('logo_url', '').is('logo_meta', null).order('company_id')
  if (error) return { ok: false, error: `consulta falhou (migration do logo_meta aplicada?): ${error.message}`, libs }
  const candidates = (rows ?? []).filter(r => (only.length ? only.includes(r.company_id as string) : true) && !exclude.has(r.company_id as string))

  const results: { company_id: string; kind: string | null; png_url: string | null; bg_removed: boolean; decoded: boolean | null; warning: string | null; wrote: boolean }[] = []
  const skipped: { company_id: string; reason: string }[] = []
  let processed = 0, wrote = 0, visited = 0
  for (const row of candidates) {
    if (processed >= limit || Date.now() - t0 > BACKFILL_DEADLINE_MS) break
    visited++
    const companyId = row.company_id as string, logoUrl = row.logo_url as string
    try {
      // Sem acesso pago: não gasta IA — a não ser que o pedido nomeie a empresa de propósito (empresa de teste).
      if (!only.includes(companyId) && !(await hasPaidAccess(admin, companyId))) { skipped.push({ company_id: companyId, reason: 'sem acesso pago' }); continue }
      if (dryRun) { processed++; results.push({ company_id: companyId, kind: null, png_url: null, bg_removed: false, decoded: null, warning: null, wrote: false }); continue }
      processed++
      const run = await processLogo(admin, anthropicKey, companyId, { url: logoUrl })
      const decoded = run.warning === 'formato' ? false : true
      const res = { company_id: companyId, kind: run.meta.kind as string | null, png_url: run.meta.png_url, bg_removed: run.meta.bg_removed, decoded, warning: run.warning ?? null, wrote: false }
      results.push(res)
      if (run.error) { skipped.push({ company_id: companyId, reason: `erro: ${run.error}` }); continue }
      if (run.warning === 'ia') { skipped.push({ company_id: companyId, reason: 'IA falhou — não gravou' }); continue }
      if (run.warning === 'formato' && (!libs.imagescript || !libs.resvg)) { skipped.push({ company_id: companyId, reason: 'biblioteca de imagem não carregou — não gravou' }); continue }
      if (run.meta.kind === 'foto' && !isIgLogo(logoUrl)) { skipped.push({ company_id: companyId, reason: 'logo do dono parece foto — não gravou' }); continue }
      const meta = { ...run.meta, src: logoUrl, backfilled_at: new Date().toISOString() }   // logo_url nunca muda: src = o atual
      const { data: upd, error: upErr } = await admin.from('brand_dna').update({ logo_meta: meta }).eq('company_id', companyId).is('logo_meta', null).select('company_id')
      if (upErr) { skipped.push({ company_id: companyId, reason: `gravação falhou: ${upErr.message}` }); continue }
      if (upd?.length) { wrote++; res.wrote = true }
    } catch (e) {
      console.error('backfill_logos: empresa', companyId, e)
      skipped.push({ company_id: companyId, reason: `exceção: ${String(e).slice(0, 150)}` })
    }
  }
  return { ok: true, dry_run: dryRun, processed, wrote, skipped, remaining: candidates.length - visited, est_cost_usd: Number((processed * EST_USD_PER_LOGO).toFixed(4)), libs, results, elapsed_ms: Date.now() - t0 }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const cronSecretEnv = Deno.env.get('CRON_SECRET')
    if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY não configurada.' }, 503)

    const admin = createClient(supabaseUrl, serviceKey)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const isCron = cronSecretEnv && body.cron_secret === cronSecretEnv

    // Instagram acabou de conectar (instagram-oauth-callback): foto de perfil
    // vira o logo na hora — só se não há logo ou se o atual também veio do
    // Instagram. Cores saem do logo, a não ser que o dono já tenha salvo o
    // kit à mão (aí só o logo muda; ele pode puxar as cores pelo botão).
    if (isCron && body.action === 'on_connect' && typeof body.company_id === 'string') {
      const companyId = body.company_id
      const { data: bd } = await admin.from('brand_dna').select('logo_url, auto_generated').eq('company_id', companyId).maybeSingle()
      if (!isIgLogo(bd?.logo_url as string | null)) return json({ ok: true, skipped: 'logo do dono' })
      const logoUrl = await fetchInstagramLogo(admin, companyId)
      if (!logoUrl) return json({ ok: false, error: 'sem foto de perfil' })
      // A classificação (logo × foto) roda sempre; as cores só entram quando o dono ainda não assumiu o kit
      // e a imagem é de fato um logo.
      const run = await processLogoSafe(admin, anthropicKey, companyId, logoUrl)
      const colors = bd?.auto_generated === false || !run || run.meta.kind === 'foto' ? null : run.colors
      if (colors) await saveColors(admin, companyId, colors, { logo_url: logoUrl, auto_generated: true })
      else await admin.from('brand_dna').upsert({ company_id: companyId, logo_url: logoUrl, updated_at: new Date().toISOString() }, { onConflict: 'company_id' })
      if (run) await saveLogoMeta(admin, companyId, run.meta)
      return json({ ok: true, logo_set: true, colors_set: !!colors, kind: run?.meta.kind ?? null })
    }

    // Backfill do logo_meta (2026-10-25): empresas que já tinham logo ANTES da função de PNG transparente
    // ficam com logo_meta nulo. Só com cron_secret; sequencial; nunca muda logo_url nem cria linha.
    // dry_run (padrão true) NÃO chama IA nem grava: só lista quem seria processado e o custo estimado.
    if (body.action === 'backfill_logos') {
      if (!isCron) return json({ error: 'Unauthorized' }, 401)
      return json(await backfillLogos(admin, anthropicKey, body))
    }

    // Modo cron: decide sozinho, uma vez por semana, só pra quem ainda não
    // teve o kit editado manualmente (auto_generated=true ou nunca gerado).
    if (isCron) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: companies } = await admin.from('companies').select('id').eq('active', true)
      let generated = 0, skipped = 0
      for (const c of companies ?? []) {
        try {
          if (!(await hasPaidAccess(admin, c.id as string))) { skipped++; continue } // conta vitrine: cron não gasta IA
          const { data: bd } = await admin.from('brand_dna').select('auto_generated, updated_at').eq('company_id', c.id).maybeSingle()
          if (bd && bd.auto_generated === false) { skipped++; continue } // dono editou manualmente — não mexe mais
          if (bd?.updated_at && bd.updated_at > sevenDaysAgo) { skipped++; continue }
          const r = await generateAndSave(admin, anthropicKey, c.id)
          if (r.ok) generated++
        } catch (e) {
          console.error(`brand-kit-suggest cron: company ${c.id} error:`, e)
        }
      }
      return json({ ok: true, cron: true, generated, skipped })
    }

    const bearer = req.headers.get('Authorization') ?? ''
    if (!bearer) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { data: company } = await admin.from('companies').select('id').eq('user_id', user.id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)
    const noPlan = await requirePaidAccess(admin, company.id)
    if (noPlan) return noPlan

    // Logo novo (enviado à mão ou colado) → cores a partir dele. Devolve as
    // anteriores pra tela mostrar "desfazer".
    if (body.action === 'from_logo') {
      const { data: bd } = await admin.from('brand_dna').select('logo_url').eq('company_id', company.id).maybeSingle()
      const logoUrl = bd?.logo_url as string | null
      if (!logoUrl) return json({ error: 'Envie o logo primeiro.' }, 400)
      const a = await analyzeLogo(anthropicKey, { url: logoUrl })
      if (!a?.colors) return json({ error: 'Não consegui ler as cores desse logo (use PNG ou JPG).' }, 400)
      if (a.kind === 'foto') return json({ error: 'Essa imagem parece uma foto, não um logo — não usei as cores dela. Envie o logo em PNG com fundo transparente.', kind: 'foto' }, 400)
      const prev = await saveColors(admin, company.id, a.colors)
      return json({ ok: true, colors: a.colors, prev })
    }

    // Prepara o logo pros criativos (PNG transparente + logo_meta). Entrada: o logo atual do Kit, um link
    // colado (`url`, vira o logo do Kit) ou o texto de um SVG (`svg`, vira PNG no Kit). `colors:true` também
    // grava as cores lidas do logo (só se for logo, não foto) e devolve as anteriores pra "desfazer".
    if (body.action === 'process_logo') {
      const svg = typeof body.svg === 'string' ? body.svg : null
      const pasted = typeof body.url === 'string' && body.url.trim() ? body.url.trim() : null
      if (svg !== null && (svg.length > MAX_SVG_BYTES || !/<svg[\s>]/i.test(svg))) return json({ error: 'SVG inválido ou grande demais (máximo 500 KB).' }, 400)
      let url = pasted
      if (svg === null && !url) {
        const { data: bd } = await admin.from('brand_dna').select('logo_url').eq('company_id', company.id).maybeSingle()
        url = (bd?.logo_url as string | null) || null
        if (!url) return json({ error: 'Envie o logo primeiro.' }, 400)
      }
      if (url && !isSafeLogoUrl(url)) return json({ error: 'Endereço do logo não permitido (use um link https público).' }, 400)
      const run = await processLogo(admin, anthropicKey, company.id, svg !== null ? { svg } : { url: url! })
      if (run.error) return json({ error: run.error }, 400)
      const logoUrl = run.logo_url ?? (svg === null ? url : null)
      // Logo novo (SVG→PNG ou link colado) vira o logo do Kit; é do dono, então a empresa passa a ser "manual" no logo.
      if (logoUrl && (run.logo_url || pasted)) await admin.from('brand_dna').upsert({ company_id: company.id, logo_url: logoUrl }, { onConflict: 'company_id' })
      const metaSaved = await saveLogoMeta(admin, company.id, run.meta)
      let colors: Colors | null = null, prev: Colors | null = null
      if (body.colors === true && run.meta.kind === 'logo' && run.colors) { colors = run.colors; prev = await saveColors(admin, company.id, colors) }
      return json({ ok: true, kind: run.meta.kind, png_url: run.meta.png_url, bg_removed: run.meta.bg_removed, luma: run.meta.luma, warning: run.warning ?? null, logo_url: logoUrl, meta_saved: metaSaved, colors, prev })
    }

    const result = await generateAndSave(admin, anthropicKey, company.id)
    if (!result.ok) return json({ error: result.error }, 400)
    return json({ ok: true, suggestion: result.suggestion, based_on: result.based_on, logo_set: result.logo_set })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
