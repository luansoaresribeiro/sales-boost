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
  const suggestion = urls.length >= 2 ? await askClaude(anthropicKey, urls) : null

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

  return { ok: true, based_on: urls.length, suggestion: suggestion ?? undefined, logo_set: logoSet }
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

    // Modo cron: decide sozinho, uma vez por semana, só pra quem ainda não
    // teve o kit editado manualmente (auto_generated=true ou nunca gerado).
    if (isCron) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: companies } = await admin.from('companies').select('id').eq('active', true)
      let generated = 0, skipped = 0
      for (const c of companies ?? []) {
        try {
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
