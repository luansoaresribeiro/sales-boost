/**
 * content-engine — orquestrador do Content Engine.
 *
 * Escolhe UM tipo de conteúdo (rotacionando objetivo ATTRACT/EDUCATE/BUILD_TRUST
 * e evitando repetir os últimos), preenche os campos do renderizador — com DADO
 * REAL nos tipos de dado (pula o tipo se não houver; nunca inventa número) ou com
 * copy da IA nos demais — e chama o render-format (imagem de IA só no tipo
 * "livre"/Attraction). Grava 1 rascunho na Área de Testes (marketing_ai_test_content).
 * Nada publica. Sem botão manual.
 *
 * Auth/modos:
 *   - { cron_secret } (sem company_id) → roda pra TODAS as empresas ativas (cron semanal).
 *   - { cron_secret, company_id }      → roda pra uma empresa.
 *   - Authorization: JWT do dono        → roda pra empresa do dono (teste).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
type Supa = ReturnType<typeof createClient>
type Fields = Record<string, string>
type Objective = 'attract' | 'educate' | 'build_trust'
type DataSource = 'none' | 'engagement' | 'competitors' | 'reviews'

interface ContentType { key: string; label: string; objective: Objective; template: string; dataSource: DataSource; usesImage: boolean; guide: string }

// REGRA (mesma de formatTemplates.tsx/render-format's buildSvg): todo
// `template` abaixo precisa ser uma das chaves reais que render-format sabe
// desenhar hoje (tweet/product/photo/problem/faq/trend/market_watch/review)
// — nunca um formato descontinuado (announcement/stat/quote não existem
// mais). Removendo/renomeando um template em render-format, espelhar aqui.
// Registro dos 10 tipos (1 renderizador cada — fase 1).
const TYPES: ContentType[] = [
  { key: 'educational', label: 'Educacional', objective: 'educate', template: 'photo', dataSource: 'none', usesImage: false, guide: 'Ensine 1 coisa útil e específica do segmento. eyebrow curto ("APRENDA"), headline = a lição em 1 frase clara, cta = próximo passo curto.' },
  { key: 'faq', label: 'FAQ / Objeção', objective: 'educate', template: 'faq', dataSource: 'none', usesImage: false, guide: 'Uma dúvida/objeção real do cliente e a resposta que quebra a objeção. eyebrow = "VOCÊ PERGUNTOU", question = a pergunta entre aspas, answer = resposta curta e direta.' },
  { key: 'data_insight', label: 'Dado / Insight', objective: 'educate', template: 'market_watch', dataSource: 'engagement', usesImage: false, guide: 'Contextualize o número real. eyebrow = "DADO REAL", headline = pergunta ou contexto curto, insight = o que o número significa pro dono em 1 frase. NÃO invente o número (o campo "value" é passado pronto).' },
  { key: 'problem', label: 'Problema → Virada', objective: 'attract', template: 'problem', dataSource: 'none', usesImage: false, guide: 'Uma dor comum do público (fala do cliente entre aspas em "problem"), a virada de perspectiva em "reframe", e o insight em "insight". eyebrow = "UM PROBLEMA COMUM".' },
  { key: 'trend', label: 'Tendência do setor', objective: 'attract', template: 'trend', dataSource: 'none', usesImage: false, guide: 'eyebrow = "TENDÊNCIA DO SETOR", title = o tema, items = 3 mudanças/itens curtos separados por QUEBRA DE LINHA (\n).' },
  { key: 'market_intel', label: 'Inteligência de mercado', objective: 'attract', template: 'market_watch', dataSource: 'competitors', usesImage: false, guide: 'eyebrow = "MARKET WATCH", headline = pergunta sobre o mercado, insight = o que o número real significa. NÃO invente o número (passado pronto).' },
  { key: 'opinion', label: 'Opinião', objective: 'attract', template: 'tweet', dataSource: 'none', usesImage: false, guide: 'Uma opinião forte e memorável da marca sobre o segmento, no campo "text" (1-2 frases, estilo tweet). name = nome da empresa; handle = @ curto (sem espaço).' },
  { key: 'social_proof', label: 'Prova social', objective: 'build_trust', template: 'review', dataSource: 'reviews', usesImage: false, guide: 'eyebrow = "O QUE DIZEM DE NÓS". Os campos text/author/stars/source são passados prontos do review real — só ajuste eyebrow.' },
  { key: 'product', label: 'Produto / Solução', objective: 'build_trust', template: 'photo', dataSource: 'none', usesImage: false, guide: 'Apresente o produto/serviço resolvendo uma dor. eyebrow curto, headline = a promessa clara, offer = valor/benefício curto (opcional), cta.' },
  { key: 'attraction', label: 'Atração', objective: 'attract', template: 'photo', dataSource: 'none', usesImage: true, guide: 'Post de alcance/identificação. eyebrow curto, headline = frase de forte identificação (1 linha), cta opcional.' },
]
const OBJECTIVES: Objective[] = ['attract', 'educate', 'build_trust']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY não configurada.' }, 503)
    const admin = createClient(supabaseUrl, serviceKey)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const cronSecret = Deno.env.get('CRON_SECRET')
    const isCron = !!cronSecret && body.cron_secret === cronSecret

    // Resolve as empresas-alvo.
    let companyIds: string[] = []
    if (isCron && body.company_id) {
      companyIds = [String(body.company_id)]
    } else if (isCron) {
      const { data } = await admin.from('companies').select('id').eq('active', true)
      companyIds = (data ?? []).map((r: { id: string }) => r.id)
    } else {
      const bearer = req.headers.get('Authorization') ?? ''
      if (!bearer) return json({ error: 'Unauthorized' }, 401)
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
      const { data: { user } } = await userClient.auth.getUser()
      if (!user) return json({ error: 'Unauthorized' }, 401)
      const { data: comp } = await admin.from('companies').select('id').eq('user_id', user.id).maybeSingle()
      if (!comp) return json({ error: 'Empresa não encontrada.' }, 404)
      companyIds = [comp.id as string]
    }

    const ctx = { admin, anthropicKey, supabaseUrl, serviceKey, cronSecret: cronSecret ?? '' }
    if (companyIds.length === 1) {
      return json(await runForCompany(ctx, companyIds[0]))
    }
    // Cron multi-empresa: processa cada uma, best-effort.
    let generated = 0, skipped = 0, failed = 0
    for (const id of companyIds) {
      try { const r = await runForCompany(ctx, id); if (r.ok && r.content_type) generated++; else skipped++ }
      catch (e) { failed++; console.error('content-engine company error:', id, e) }
    }
    return json({ ok: true, cron: true, companies: companyIds.length, generated, skipped, failed })
  } catch (err) {
    console.error('content-engine error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

interface Ctx { admin: Supa; anthropicKey: string; supabaseUrl: string; serviceKey: string; cronSecret: string }

async function runForCompany(ctx: Ctx, companyId: string): Promise<Record<string, unknown>> {
  const { admin, anthropicKey, supabaseUrl, serviceKey, cronSecret } = ctx

  // Guarda de backlog: não empilha rascunho se já tem pilha esperando revisão.
  const { count: pending } = await admin.from('marketing_ai_test_content').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('origin', 'content-engine').in('status', ['draft', 'adapt'])
  if ((pending ?? 0) >= 12) return { ok: true, skipped: 'backlog', pending }

  // Contexto: empresa, config (voz/tom) e marca (brand_dna → Brand do render).
  const [{ data: companyRow }, { data: cfgRow }, { data: bdRow }] = await Promise.all([
    admin.from('companies').select('id, business_name, business_type, city, goal, instagram_url').eq('id', companyId).maybeSingle(),
    admin.from('marketing_ai_config').select('brand_voice, tone, target_audience, content_pillars, marketing_goals').eq('company_id', companyId).maybeSingle(),
    admin.from('brand_dna').select('kit, logo_url').eq('company_id', companyId).maybeSingle(),
  ])
  const company = companyRow as { business_name: string; business_type: string | null; city: string | null; goal: string | null; instagram_url: string | null } | null
  if (!company) return { ok: false, error: 'Empresa não encontrada.' }
  const cfg = (cfgRow ?? {}) as { brand_voice?: string; tone?: string; target_audience?: string; content_pillars?: string[]; marketing_goals?: string }
  const kit = (bdRow?.kit as { colors?: { primary?: string[]; accent?: string[]; text?: string; bg?: string }; typography?: { heading?: string; body?: string } } | null) ?? null
  const c = kit?.colors ?? {}
  const brand = {
    name: company.business_name || 'Marca', primary: c.primary?.[0] || '#FF6D29', primary2: c.primary?.[1],
    accent: c.accent?.[0], accent2: c.accent?.[1], text: c.text, bg: c.bg,
    logoUrl: (bdRow?.logo_url as string | null) ?? undefined, heading: kit?.typography?.heading, body: kit?.typography?.body,
  }

  // Diversidade: o que saiu nos últimos 15 posts do motor.
  const { data: recentRows } = await admin.from('marketing_ai_test_content')
    .select('concept').eq('company_id', companyId).eq('origin', 'content-engine').order('created_at', { ascending: false }).limit(15)
  const recentTypes = (recentRows ?? []).map(r => (r.concept as { content_type?: string } | null)?.content_type).filter(Boolean) as string[]
  const recentObjectives = (recentRows ?? []).map(r => (r.concept as { objective?: string } | null)?.objective).filter(Boolean) as string[]
  const lastType = recentTypes[0]
  const usedTypesRecent = new Set(recentTypes.slice(0, 4))

  // Rotaciona objetivo: escolhe o objetivo menos usado nos últimos 3.
  const recent3 = recentObjectives.slice(0, 3)
  const objScore = OBJECTIVES.map(o => ({ o, n: recent3.filter(x => x === o).length }))
  objScore.sort((a, b) => a.n - b.n)
  const orderedObjectives = objScore.map(x => x.o)

  // Candidatos por objetivo (do menos usado), evitando tipos recém-usados, e —
  // pros tipos de dado — só se houver dado real. Primeiro que passar, vence.
  let chosen: ContentType | null = null
  let fields: Fields = {}
  let subject = ''
  for (const obj of orderedObjectives) {
    const cands = shuffle(TYPES.filter(t => t.objective === obj && t.key !== lastType && !usedTypesRecent.has(t.key)))
    const pool = cands.length ? cands : shuffle(TYPES.filter(t => t.objective === obj && t.key !== lastType))
    for (const t of pool) {
      const data = await fetchData(admin, companyId, t.dataSource)
      if (t.dataSource !== 'none' && !data) continue // sem dado real → pula (nunca inventa)
      const gen = await generateFields(anthropicKey, t, company, cfg, data)
      if (!gen) continue
      chosen = t; fields = gen.fields; subject = gen.subject
      break
    }
    if (chosen) break
  }
  if (!chosen) return { ok: true, skipped: 'sem_tipo_disponivel' }

  // Renderiza (render-format grava o rascunho na Área de Testes). Imagem de IA só
  // no tipo "livre" (Attraction) — os demais são montagem, custo 0.
  const tall = ['problem', 'faq', 'trend', 'photo'].includes(chosen.template)
  const renderBody: Record<string, unknown> = {
    cron_secret: cronSecret, company_id: companyId,
    template: chosen.template, fields, brand, kind: 'organico',
    caption: fields.caption ?? subject, subject, format: chosen.template,
    width: 1080, height: tall ? 1350 : 1080, origin: 'content-engine', status: 'draft',
    content_type: chosen.key, objective: chosen.objective,
    generate_bg: chosen.usesImage, bg_prompt: subject,
  }
  const r = await fetch(`${supabaseUrl}/functions/v1/render-format`, {
    method: 'POST', headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(renderBody),
  })
  const rd = await r.json().catch(() => ({})) as { ok?: boolean; id?: string; url?: string; error?: string }
  if (!r.ok || !rd.ok) return { ok: false, error: `render-format falhou: ${rd.error ?? r.status}` }
  return { ok: true, content_type: chosen.key, objective: chosen.objective, template: chosen.template, id: rd.id, url: rd.url }
}

// ── Dado real por fonte (retorna null quando não há → o tipo é pulado) ───────────
async function fetchData(admin: Supa, companyId: string, source: DataSource): Promise<Record<string, string> | null> {
  if (source === 'none') return {}
  if (source === 'engagement') {
    const { data } = await admin.from('marketing_ai_tracking_snapshots').select('followers, engagement_rate, avg_reach').eq('company_id', companyId).order('collected_at', { ascending: false }).limit(1).maybeSingle()
    if (!data) return null
    const d = data as { followers: number | null; engagement_rate: number | null; avg_reach: number | null }
    if (d.engagement_rate != null && d.engagement_rate > 0) return { value: `${round1(d.engagement_rate)}%`, label: 'Taxa de engajamento' }
    if (d.followers != null && d.followers > 0) return { value: fmtNum(d.followers), label: 'Seguidores' }
    if (d.avg_reach != null && d.avg_reach > 0) return { value: fmtNum(d.avg_reach), label: 'Alcance médio' }
    return null
  }
  if (source === 'competitors') {
    const { data } = await admin.from('marketing_ai_competitors').select('avg_engagement, followers, name').eq('company_id', companyId).order('last_analyzed_at', { ascending: false }).limit(10)
    const rows = (data ?? []) as { avg_engagement: number | null; followers: number | null; name: string | null }[]
    const engs = rows.map(r => r.avg_engagement).filter((v): v is number => v != null && v > 0)
    if (engs.length) { let avg = engs.reduce((a, b) => a + b, 0) / engs.length; if (avg <= 1) avg *= 100; return { value: `${round1(avg)}%`, count: String(rows.length) } }
    if (rows.length) return { value: String(rows.length), count: String(rows.length), is_count: '1' }
    return null
  }
  if (source === 'reviews') {
    const { data } = await admin.from('reviews').select('author, rating, text, source').eq('company_id', companyId).gte('rating', 4).not('text', 'is', null).order('review_date', { ascending: false }).limit(1).maybeSingle()
    if (!data) return null
    const d = data as { author: string | null; rating: number | null; text: string | null; source: string | null }
    if (!d.text) return null
    return { text: d.text.slice(0, 240), author: d.author || 'Cliente', stars: String(d.rating ?? 5), source: d.source ? sourceLabel(d.source) : '' }
  }
  return null
}

// ── Gera os campos do template (dado real + copy da IA; nunca inventa número) ──
async function generateFields(key: string, t: ContentType, company: { business_name: string; business_type: string | null; city: string | null; goal: string | null }, cfg: { brand_voice?: string; tone?: string; target_audience?: string; marketing_goals?: string }, data: Record<string, string> | null): Promise<{ fields: Fields; subject: string } | null> {
  const preamble = `Negócio: "${company.business_name}" (${company.business_type ?? 'negócio'} em ${company.city ?? 'Brasil'}). Voz: ${cfg.brand_voice ?? 'natural'}. Tom: ${cfg.tone ?? 'próximo'}. Público: ${cfg.target_audience ?? 'clientes locais'}. Objetivo: ${cfg.marketing_goals ?? company.goal ?? 'crescer'}.`
  const dataBlock = data && Object.keys(data).length ? `\nDADO REAL a usar (NÃO altere números): ${JSON.stringify(data)}` : ''
  const prompt = `${preamble}
Você monta um post do tipo "${t.label}". ${t.guide}${dataBlock}
Regras: pt-BR, texto pronto pra tela (sem markdown, sem aspas sobrando). NUNCA invente estatística/número — só use os do DADO REAL acima (se houver). "caption" = legenda do Instagram (pode ter emojis, 1-3 frases) e "hashtags" = 3-5 hashtags.
Retorne APENAS um JSON: {"fields": { ...campos do template... }, "caption": "...", "hashtags": "#a #b #c", "subject": "resumo curto do post"}`
  try {
    const parsed = parseObj(await callClaude(key, prompt, 800))
    const f = (parsed.fields ?? {}) as Fields
    if (data) for (const [k, v] of Object.entries(data)) { if (k !== 'count' && k !== 'is_count') f[k] = v } // dado real prevalece
    if (parsed.caption) f.caption = String(parsed.caption)
    if (parsed.hashtags) f.hashtags = String(parsed.hashtags)
    const hasText = Object.entries(f).some(([k, v]) => k !== 'caption' && k !== 'hashtags' && String(v).trim())
    if (!hasText) return null
    return { fields: f, subject: String(parsed.subject ?? t.label) }
  } catch (e) { console.error('generateFields error:', e); return null }
}

async function callClaude(key: string, prompt: string, maxTokens = 700): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`Claude: ${await res.text()}`)
  const d = await res.json()
  return (d.content?.[0]?.text ?? '').replace(/```(?:json)?\n?/g, '').trim()
}
function parseObj(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw) } catch { /* */ }
  const m = raw.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]) } catch { /* */ } }
  return {}
}
function shuffle<T>(a: T[]): T[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[b[i], b[j]] = [b[j], b[i]] } return b }
function round1(n: number): string { return (Math.round(n * 10) / 10).toLocaleString('pt-BR') }
function fmtNum(n: number): string { return Math.round(n).toLocaleString('pt-BR') }
function sourceLabel(s: string): string { const l = s.toLowerCase(); if (l.includes('google')) return 'Google'; if (l.includes('insta')) return 'Instagram'; if (l.includes('face')) return 'Facebook'; return s }
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }
