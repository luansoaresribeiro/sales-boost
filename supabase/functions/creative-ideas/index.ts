/**
 * creative-ideas — Creative Agent: gera IDEIAS de post (não o post final).
 *
 * Olha a marca, os insights abertos, a biblioteca, os formatos disponíveis,
 * a PERFORMANCE REAL dos próprios posts (instagram_content_performance — o
 * que já funcionou de verdade) e posts virais reais do segmento (Apify, por
 * hashtag) e devolve ~6 conceitos
 * de post (gancho + ângulo + formato + módulo sugerido). Cada ideia vira card
 * no dashboard; o dono manda a que quiser pro creative-generate (idea seed)
 * pra virar um post de teste. Nada publica.
 *
 * Roda sozinho (cron semanal, `cron_secret`) além do refresh manual — o
 * cliente não precisa clicar em nada pra ideias novas aparecerem.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Company { id: string; business_name: string; business_type: string | null; city: string | null; goal: string | null; business_description: string | null; ideal_customer: string | null }

const HASHTAG_BY_TYPE: Record<string, string> = {
  'Restaurante / Food': 'restaurante', 'Bar & Pub': 'barpub', 'Varejo / E-commerce': 'lojavirtual',
  'Beleza & Estética': 'estetica', 'Barbearia': 'barbearia', 'Saúde & Bem-estar': 'bemestar',
  'Clínica / Consultório': 'clinica', 'Academia / Fitness': 'academia', 'Serviços': 'empreendedorismo',
  'Serviços Gerais': 'empreendedorismo',
}
const PT_CONNECTORS = /\b(e|de|do|da|dos|das|em)\b/g

// business_type é texto livre (cadastro dinâmico, "Outro" aceita qualquer
// segmento) — pra tipos fora da lista curada acima, deriva o hashtag do
// próprio texto digitado (ex: "Logística" -> "logistica") em vez de cair
// sempre no genérico "empreendedorismo". Funciona pra qualquer segmento
// novo sem precisar cadastrar um por um.
function hashtagFor(businessType: string | null): string {
  const known = HASHTAG_BY_TYPE[businessType ?? '']
  if (known) return known
  if (!businessType) return 'empreendedorismo'
  const slug = businessType
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(PT_CONNECTORS, '').replace(/[^a-z0-9]+/g, '')
  return slug || 'empreendedorismo'
}

interface ViralPost { caption: string; likesCount: number; commentsCount: number; ownerUsername: string }

async function fetchViralPosts(apifyToken: string, businessType: string | null): Promise<ViralPost[]> {
  const tag = hashtagFor(businessType)
  try {
    const url = `https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=45&memory=256`
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hashtags: [tag], resultsType: 'posts', resultsLimit: 8 }),
    })
    if (!res.ok) return []
    const items = await res.json() as Array<{ caption?: string; likesCount?: number; commentsCount?: number; ownerUsername?: string }>
    return items
      .filter(i => i.caption)
      .map(i => ({ caption: String(i.caption).slice(0, 200), likesCount: i.likesCount ?? 0, commentsCount: i.commentsCount ?? 0, ownerUsername: i.ownerUsername ?? 'perfil' }))
      .sort((a, b) => b.likesCount - a.likesCount)
      .slice(0, 6)
  } catch {
    return []
  }
}

// Trend Agent: grava as tendências REAIS (grounded nos posts virais que
// acabamos de escanear) na marketing_ai_trends já existente — mesma tabela
// que a IA usa pra raciocínio puro (source=null), aqui marcada como
// source='instagram_scan'. Sem post real pra ler, não grava nada (fica sem
// dado em vez de inventar).
async function saveRealTrends(admin: ReturnType<typeof createClient>, anthropicKey: string, companyId: string, businessType: string | null, viral: ViralPost[]): Promise<number> {
  if (viral.length === 0) return 0
  const prompt = `Você é um analista de tendências de marketing digital (segmento: ${businessType ?? 'negócio local'}).
Abaixo estão legendas reais de posts que estão viralizando agora nesse segmento no Instagram.

${viral.map((v, i) => `[${i + 1}] (${v.likesCount} curtidas, ${v.commentsCount} comentários) "${v.caption}"`).join('\n')}

Com base SOMENTE nessas legendas (não invente nada fora do que está nelas), identifique até 3 tendências reais (formato, tema ou abordagem que se repete). Retorne APENAS um JSON array:
[{"title":"título curto","description":"o que é essa tendência, citando o padrão real observado","category":"formato"|"tema"|"sazonal","relevance":"high"|"medium"|"low"}]`

  const raw = await callClaude(anthropicKey, prompt, 600)
  const trends = parseArr(raw).slice(0, 3)
  if (trends.length === 0) return 0

  await admin.from('marketing_ai_trends').delete().eq('company_id', companyId).eq('source', 'instagram_scan')
  const rows = trends.map(t => ({
    company_id: companyId, title: String(t.title ?? '').slice(0, 160), description: t.description ? String(t.description) : null,
    category: t.category ? String(t.category) : null, relevance: t.relevance ? String(t.relevance) : null, source: 'instagram_scan',
  })).filter(r => r.title)
  if (rows.length === 0) return 0
  const { error } = await admin.from('marketing_ai_trends').insert(rows)
  return error ? 0 : rows.length
}

interface OwnPost { pillar: string | null; media_type: string | null; caption: string | null; engagement_rate: number | null; likes: number | null; comments: number | null }

// Fecha o loop: lê a performance REAL dos próprios posts (instagram_content_performance,
// alimentada por instagram-performance) pra saber o que já funcionou de
// verdade — não só o que está viralizando lá fora (fetchViralPosts). Sem post
// medido ainda, volta vazio (nunca inventa "o que funciona").
async function fetchOwnTopPerformers(admin: ReturnType<typeof createClient>, companyId: string): Promise<OwnPost[]> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await admin.from('instagram_content_performance')
    .select('pillar, media_type, caption, engagement_rate, likes, comments')
    .eq('company_id', companyId).gte('posted_at', ninetyDaysAgo).not('engagement_rate', 'is', null)
    .order('engagement_rate', { ascending: false }).limit(8)
  return (data ?? []) as OwnPost[]
}

async function notifyMarketing(chatId: number | null | undefined, companyId: string, event: string, data?: Record<string, unknown>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('BOT_WEBHOOK_SECRET')
  if (!supabaseUrl) return
  fetch(`${supabaseUrl}/functions/v1/log-bot-event`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: secret ?? '', bot_name: 'marketing', event_type: event, company_id: companyId, telegram_chat_id: chatId ?? null, data }),
  }).catch(() => {})
}

async function callClaude(anthropicKey: string, prompt: string, maxTokens = 1600): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`)
  const data = await res.json()
  return (data.content?.[0]?.text ?? '').replace(/```(?:json)?\n?/g, '').trim()
}

function parseArr(raw: string): Record<string, unknown>[] {
  const tryParse = (s: string): unknown => { try { return JSON.parse(s) } catch { return null } }
  let v: unknown = tryParse(raw)
  if (!v) { const a = raw.match(/\[[\s\S]*\]/); if (a) v = tryParse(a[0]) }
  if (Array.isArray(v)) return v as Record<string, unknown>[]
  if (v && typeof v === 'object') return [v as Record<string, unknown>]
  return []
}

async function generateForCompany(
  admin: ReturnType<typeof createClient>,
  anthropicKey: string,
  apifyToken: string | undefined,
  company: Company,
  focus: string | null,
): Promise<number> {
  const [{ data: cfgRow }, { data: insRows }, { data: libRows }, { data: fmtRows }] = await Promise.all([
    admin.from('marketing_ai_config').select('brand_voice, tone, target_audience, content_pillars, marketing_goals').eq('company_id', company.id).maybeSingle(),
    admin.from('marketing_ai_insights').select('pillar, title, description').eq('company_id', company.id).eq('status', 'open').order('created_at', { ascending: false }).limit(8),
    admin.from('marketing_ai_knowledge').select('kind, title').or(`company_id.is.null,company_id.eq.${company.id}`).in('module', ['core', 'organico', 'stories', 'campanhas']).limit(40),
    admin.from('marketing_ai_knowledge').select('title, content').eq('company_id', company.id).eq('module', 'formato').limit(12),
  ])
  const cfg = (cfgRow ?? {}) as { brand_voice?: string; tone?: string; target_audience?: string; content_pillars?: string[]; marketing_goals?: string }
  const insights = (insRows ?? []) as { pillar: string; title: string; description: string }[]
  const lib = (libRows ?? []) as { kind: string; title: string }[]
  const formats = (fmtRows ?? []) as { title: string; content: string | null }[]
  const viral = apifyToken ? await fetchViralPosts(apifyToken, company.business_type) : []
  const ownTop = await fetchOwnTopPerformers(admin, company.id)
  // Trend Agent: grava as tendências reais separado das ideias — mesmo sem
  // gerar nenhuma ideia nova, a tela de tendências fica atualizada.
  if (viral.length > 0) await saveRealTrends(admin, anthropicKey, company.id, company.business_type, viral).catch(() => 0)

  const prompt = `Você é o CREATIVE AGENT (diretor de ideias) da agência de "${company.business_name}" (${company.business_type ?? 'negócio'} em ${company.city ?? 'Brasil'}).
${company.business_description ? `O que o negócio faz de verdade: ${company.business_description}.` : ''}
Voz da marca: ${cfg.brand_voice ?? 'não definida'}. Tom: ${cfg.tone ?? 'não definido'}. Público: ${cfg.target_audience ?? company.ideal_customer ?? 'não definido'}.
Pilares: ${(cfg.content_pillars ?? []).join(', ') || 'não definidos'}. Objetivo: ${cfg.marketing_goals ?? company.goal ?? 'crescer e engajar'}.
${insights.length ? `\nInsights reais abertos (use-os como gatilho das ideias):\n${insights.map(i => `- [${i.pillar}] ${i.title}: ${i.description}`).join('\n')}` : ''}
${ownTop.length ? `\nO que JÁ FUNCIONOU DE VERDADE no seu próprio Instagram (dados reais de performance dos últimos 90 dias, do melhor pro pior — priorize pilar/formato parecido com o que engaja mais aqui):\n${ownTop.map(o => `- [${o.pillar ?? 'sem pilar'} · ${o.media_type ?? '—'}] engajamento ${o.engagement_rate ?? 0}% (${o.likes ?? 0} curtidas, ${o.comments ?? 0} comentários): "${(o.caption ?? '').slice(0, 120)}"`).join('\n')}` : ''}
${viral.length ? `\nPosts reais que estão viralizando agora no seu segmento (use como referência de formato/gancho que está funcionando, NUNCA copie o conteúdo, adapte pro negócio):\n${viral.map(v => `- (${v.likesCount} curtidas, ${v.commentsCount} comentários) "${v.caption}"`).join('\n')}` : ''}
${formats.length ? `\nFormatos disponíveis (prefira sugerir um destes quando encaixar):\n${formats.map(f => `- ${f.title}${f.content ? `: ${f.content}` : ''}`).join('\n')}` : ''}
${lib.length ? `\nRecursos na biblioteca (hooks/frameworks já cadastrados): ${lib.map(l => l.title).slice(0, 20).join(', ')}` : ''}

Gere 6 IDEIAS de post FORTES e específicas desse negócio (nada genérico). Cada ideia deve poder virar um post real.
Varie os formatos entre as 6 ideias — nem toda ideia precisa de carrossel; uma foto única bem pensada costuma performar tão bem quanto, e é mais rápida de aprovar.
${focus ? `IMPORTANTE: gere TODAS as 6 ideias para o formato "${focus}".` : ''}
"module" é onde a ideia se encaixa: "organico" (feed), "stories" ou "campanhas" (mídia paga).
"format" é o formato sugerido — use EXATAMENTE um destes rótulos, nunca invente outro nem combine dois: "foto", "carrossel", "reel", "story".
Retorne APENAS um JSON array, sem texto antes ou depois:
[{"title":"título curto da ideia","hook":"o gancho/primeira frase que prende","angle":"o ângulo em 1 frase","format":"foto"|"carrossel"|"reel"|"story","module":"organico","rationale":"por que essa ideia faz sentido agora, citando o insight/pilar/tendência/performance real"}]`

  const ideas = parseArr(await callClaude(anthropicKey, prompt)).slice(0, 6)
  if (ideas.length === 0) return 0

  const MODS = ['organico', 'stories', 'campanhas']
  const FORMATS = ['foto', 'carrossel', 'reel', 'story']
  // Rede de segurança: mesmo pedindo só esses 4 rótulos, garante que nunca
  // sobra um formato livre/misto que o creative-generate não saiba honrar —
  // o Diretor Criativo lá na frente precisa confiar nesse valor.
  const normalizeFormat = (f: unknown): string | null => {
    const s = String(f ?? '').toLowerCase().trim()
    if (FORMATS.includes(s)) return s
    if (s.includes('carrossel')) return 'carrossel'
    if (s.includes('reel') || s.includes('vídeo') || s.includes('video')) return 'reel'
    if (s.includes('story') || s.includes('stories')) return 'story'
    if (s.includes('foto') || s.includes('post') || s.includes('imagem')) return 'foto'
    return null
  }
  const rows = ideas.map(i => ({
    company_id: company.id,
    title: String(i.title ?? 'Ideia').slice(0, 160),
    hook: i.hook ? String(i.hook) : null,
    angle: i.angle ? String(i.angle) : null,
    format: normalizeFormat(i.format),
    module: focus ?? (MODS.includes(String(i.module)) ? String(i.module) : 'organico'),
    rationale: i.rationale ? String(i.rationale) : null,
    status: 'new',
  }))
  const { error } = await admin.from('marketing_ai_ideas').insert(rows)
  return error ? 0 : rows.length
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const apifyToken = Deno.env.get('APIFY_TOKEN')
    const cronSecretEnv = Deno.env.get('CRON_SECRET')
    if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY não configurada.' }, 503)

    const admin = createClient(supabaseUrl, serviceKey)
    const rawBody = await req.json().catch(() => ({})) as Record<string, unknown>
    const isCron = cronSecretEnv && rawBody.cron_secret === cronSecretEnv

    if (isCron) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: companies } = await admin.from('companies')
        .select('id, business_name, business_type, city, goal, business_description, ideal_customer, telegram_chat_id, notification_prefs')
        .eq('active', true)

      let generated = 0, skipped = 0
      for (const company of (companies ?? []) as (Company & { telegram_chat_id: number | null; notification_prefs: Record<string, boolean> | null })[]) {
        try {
          const { data: recent } = await admin.from('marketing_ai_ideas')
            .select('created_at').eq('company_id', company.id)
            .order('created_at', { ascending: false }).limit(1).maybeSingle()
          if (recent?.created_at && recent.created_at > sevenDaysAgo) { skipped++; continue }

          const count = await generateForCompany(admin, anthropicKey, apifyToken, company, null)
          if (count > 0) {
            generated++
            const prefs = company.notification_prefs ?? {}
            if (prefs.agent_actions !== false) {
              notifyMarketing(company.telegram_chat_id, company.id, 'AGENT_ACTION', {
                action: 'creative_ideas_generated', count,
                reason: 'Geração semanal automática de ideias (Creative Agent, com base em tendências reais do segmento)',
              })
            }
          }
        } catch (e) {
          console.error(`creative-ideas cron: company ${company.id} error:`, e)
        }
      }
      return json({ ok: true, cron: true, generated, skipped })
    }

    const bearer = req.headers.get('Authorization') ?? ''
    if (!bearer) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { data: companyRow } = await admin.from('companies').select('id, business_name, business_type, city, goal, business_description, ideal_customer').eq('user_id', user.id).maybeSingle()
    const company = companyRow as Company | null
    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)

    const focus = ['organico', 'stories', 'campanhas'].includes(String(rawBody.focus_module)) ? String(rawBody.focus_module) : null
    const count = await generateForCompany(admin, anthropicKey, apifyToken, company, focus)
    if (count === 0) return json({ error: 'A IA não retornou ideias. Tente de novo.' }, 502)

    return json({ ok: true, count })
  } catch (err) {
    console.error('creative-ideas error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
