/**
 * content-test — Área de Testes (QC) da seção Conteúdo.
 *
 * Gera posts de teste com o MESMO motor de geração que o ciclo automático do
 * marketing-ai usa em produção (mesmo modelo claude-sonnet-4-6, mesmo formato
 * de prompt de Content Intelligence, mesma função de imagem generate-image),
 * mas grava numa tabela isolada (marketing_ai_test_content) — nunca na fila
 * principal (marketing_ai_content). Assim a automação nunca enxerga os testes.
 *
 * Só entram no fluxo real quando o dono aprova — isso acontece na Central de
 * Approvals (agent_actions): o Vault propõe a ação, aprovar publica de
 * verdade no Instagram e vira um post na aba Posts; o rascunho de teste é
 * removido. Nada aqui publica sozinho — segue a regra human-in-the-loop.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
type SupaClient = ReturnType<typeof createClient>

interface Company { id: string; business_name: string; business_type: string | null; city: string | null; goal: string | null }
interface Config {
  agent_name: string; brand_voice: string | null; tone: string | null
  target_audience: string | null; content_pillars: string[]
  marketing_goals: string | null; business_objectives: string | null
}

// Mesmo preâmbulo de identidade do agente usado no marketing-ai, pra o teste
// soar exatamente como o conteúdo real vai soar.
function preamble(config: Config, company: Company): string {
  const name = config.agent_name?.trim() || 'Agente de Marketing'
  return `Você é ${name}, o agente de marketing dedicado de "${company.business_name}" (${company.business_type ?? 'negócio'} em ${company.city ?? 'Brasil'}).
Voz da marca: ${config.brand_voice ?? 'não definida ainda'}. Tom: ${config.tone ?? 'não definido ainda'}.
Público-alvo: ${config.target_audience ?? 'não definido ainda'}.
Pilares de conteúdo: ${config.content_pillars.join(', ') || 'não definidos ainda'}.
Objetivos: ${config.marketing_goals ?? config.business_objectives ?? 'crescer e engajar mais'}.

Regra permanente: você nunca publica nada sozinho — todo conteúdo fica como rascunho esperando aprovação. Nunca invente número que não veio de uma coleta real.`
}

function defaultConfig(company: Company): Config {
  return {
    agent_name: 'Agente de Conteúdo', brand_voice: null, tone: null, target_audience: null,
    content_pillars: ['bastidores', 'novidades', 'depoimentos'],
    marketing_goals: company.goal ?? null, business_objectives: company.goal ?? null,
  }
}

async function callClaude(anthropicKey: string, prompt: string, maxTokens = 1500): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`)
  const data = await res.json()
  return (data.content?.[0]?.text ?? '').replace(/```(?:json)?\n?/g, '').trim()
}

function parseJsonArray<T>(raw: string): T[] {
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [] } catch { /* fall through */ }
  const match = raw.match(/\[[\s\S]*\]/)
  if (match) { try { return JSON.parse(match[0]) } catch { /* give up */ } }
  return []
}

// Mesma função central de imagem do resto da plataforma (OpenAI, com fallback
// de chave no _app_config). Defensivo: sem imagem nunca quebra o teste.
async function generateImage(businessType: string | null, idea: string): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey) return null
  try {
    const prompt = `Professional social media photo for a Brazilian small business (${businessType ?? 'negócio'}). Commercial photography, warm natural lighting, polished and inviting, no people, no text, no logos, no watermark. Evokes: ${idea}`
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-image`, {
      method: 'POST', headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, size: '1024x1024' }),
    })
    const data = await res.json().catch(() => ({})) as { url?: string }
    return res.ok && data.url ? data.url : null
  } catch (e) { console.error('generateImage error:', e); return null }
}

async function loadConfig(admin: SupaClient, company: Company): Promise<Config> {
  const { data } = await admin.from('marketing_ai_config')
    .select('agent_name, brand_voice, tone, target_audience, content_pillars, marketing_goals, business_objectives')
    .eq('company_id', company.id).maybeSingle()
  return (data as Config | null) ?? defaultConfig(company)
}

// ── Testing Pipeline: júri de revisores ────────────────────────────────────
// Cada dimensão recebe nota 0-100 + comentário. A nota final é PONDERADA pelos
// pesos abaixo (somam 100%). readability é avaliada e mostrada, mas não pesa.
const SCORE_WEIGHTS: Record<string, number> = {
  creative: 0.20, novelty: 0.15, brand: 0.15, hook: 0.15, cta: 0.10, visual: 0.10, engagement: 0.10, conversion: 0.05,
}
const SCORE_CATS = ['creative', 'novelty', 'brand', 'hook', 'cta', 'visual', 'engagement', 'conversion', 'readability']

interface CatScore { score: number; comment: string }
type Scores = Record<string, CatScore>
interface PostShape { idea: string | null; caption: string | null; hashtags: string | null; cta: string | null; format: string | null; hasImage: boolean }

function parseJsonObject(raw: string): Record<string, { score?: number; comment?: string }> {
  try { return JSON.parse(raw) } catch { /* fall through */ }
  const m = raw.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch { /* give up */ } }
  return {}
}

async function scoreContent(anthropicKey: string, config: Config, company: Company, post: PostShape): Promise<{ scores: Scores; quality: number }> {
  const prompt = `${preamble(config, company)}

Agora você é o CONTROLE DE QUALIDADE de uma agência criativa — um júri rigoroso e honesto. Avalie o post abaixo com nota de 0 a 100 em cada dimensão, com um comentário curto e específico (o que está bom ou o que melhorar). Seja criterioso: 90+ só pra conteúdo realmente excelente.

Post:
- Formato: ${post.format ?? '—'}
- Ideia: ${post.idea ?? '—'}
- Legenda: ${post.caption ?? '—'}
- Hashtags: ${post.hashtags ?? '—'}
- CTA: ${post.cta ?? '—'}
- Imagem: ${post.hasImage ? 'tem imagem gerada por IA evocando a ideia' : 'sem imagem'}

Dimensões: creative (força criativa geral), novelty (originalidade vs clichê), brand (consistência com voz/público), hook (força da primeira linha), cta (clareza/persuasão da chamada), visual (adequação do conceito visual), engagement (potencial de curtidas/comentários/salvamentos), conversion (potencial de gerar lead/venda), readability (clareza/facilidade de leitura).

Retorne APENAS um JSON: {"creative":{"score":0,"comment":""},"novelty":{"score":0,"comment":""},"brand":{"score":0,"comment":""},"hook":{"score":0,"comment":""},"cta":{"score":0,"comment":""},"visual":{"score":0,"comment":""},"engagement":{"score":0,"comment":""},"conversion":{"score":0,"comment":""},"readability":{"score":0,"comment":""}}`

  const raw = await callClaude(anthropicKey, prompt, 1200)
  const parsed = parseJsonObject(raw)
  const scores: Scores = {}
  for (const cat of SCORE_CATS) {
    const s = Math.max(0, Math.min(100, Math.round(Number(parsed[cat]?.score ?? 0))))
    scores[cat] = { score: s, comment: String(parsed[cat]?.comment ?? '') }
  }
  let quality = 0
  for (const [cat, w] of Object.entries(SCORE_WEIGHTS)) quality += (scores[cat]?.score ?? 0) * w
  return { scores, quality: Math.round(quality) }
}

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

    const bearer = req.headers.get('Authorization') ?? ''
    if (!bearer) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { data: companyRow } = await admin.from('companies').select('id, business_name, business_type, city, goal').eq('user_id', user.id).maybeSingle()
    const company = companyRow as Company | null
    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)

    const action = String(body.action ?? '')

    // ── Gerar post de teste ──────────────────────────────────────────────
    if (action === 'generate') {
      const kind = ['organico', 'stories', 'campanhas'].includes(String(body.kind)) ? String(body.kind) : 'organico'
      const { data: cfgRow } = await admin.from('marketing_ai_config')
        .select('agent_name, brand_voice, tone, target_audience, content_pillars, marketing_goals, business_objectives')
        .eq('company_id', company.id).maybeSingle()
      const config = (cfgRow as Config | null) ?? defaultConfig(company)

      const { data: recentInsights } = await admin.from('marketing_ai_insights')
        .select('pillar, title, description').eq('company_id', company.id).eq('status', 'open')
        .order('created_at', { ascending: false }).limit(6)

      const prompt = `${preamble(config, company)}

Agora você está atuando como Content Intelligence — sua tarefa é gerar uma ideia de conteúdo.
${recentInsights?.length ? `\nInsights recentes pra considerar:\n${recentInsights.map(i => `- [${i.pillar}] ${i.title}: ${i.description}`).join('\n')}` : ''}

Gere 1 ideia de conteúdo alinhada com a estratégia acima. Retorne APENAS um JSON array:
[{"idea": "resumo curto", "caption": "legenda completa pronta pra publicar", "hashtags": "#tag1 #tag2 #tag3", "cta": "chamada pra ação curta (ex: Agende agora, Chama no WhatsApp)", "format": "reel"|"carrossel"|"story"|"foto", "reasoning": "por que essa ideia faz sentido agora"}]`

      const raw = await callClaude(anthropicKey, prompt, 1500)
      const ideas = parseJsonArray<{ idea: string; caption: string; hashtags: string; cta?: string; format: string; reasoning: string }>(raw)
      const idea = ideas[0]
      if (!idea) return json({ error: 'A IA não retornou uma ideia válida. Tente de novo.' }, 502)

      const { data: inserted, error: insErr } = await admin.from('marketing_ai_test_content').insert({
        company_id: company.id, kind, idea: idea.idea, caption: idea.caption, hashtags: idea.hashtags,
        cta: idea.cta ?? null, format: idea.format, reasoning: idea.reasoning,
      }).select('id').single()
      if (insErr) return json({ error: insErr.message }, 500)

      const url = await generateImage(company.business_type, idea.idea)
      if (url) await admin.from('marketing_ai_test_content').update({ image_url: url }).eq('id', inserted.id)

      return json({ ok: true, id: inserted.id, image_generated: !!url })
    }

    // ── Avaliar (Testing Pipeline → Quality Score) ──────────────────────
    if (action === 'score') {
      const testId = String(body.test_id ?? '')
      if (!testId) return json({ error: 'test_id é obrigatório' }, 400)
      const { data: tRow } = await admin.from('marketing_ai_test_content')
        .select('id, idea, caption, hashtags, cta, format, image_url').eq('id', testId).eq('company_id', company.id).maybeSingle()
      const t = tRow as (PostShape & { id: string; image_url: string | null }) | null
      if (!t) return json({ error: 'Post de teste não encontrado' }, 404)
      const config = await loadConfig(admin, company)
      const { scores, quality } = await scoreContent(anthropicKey, config, company, { idea: t.idea, caption: t.caption, hashtags: t.hashtags, cta: t.cta, format: t.format, hasImage: !!t.image_url })
      await admin.from('marketing_ai_test_content').update({ scores, quality_score: quality }).eq('id', testId)
      return json({ ok: true, scores, quality_score: quality })
    }

    // ── Regenerar só o componente fraco (Auto Feedback Loop) ────────────
    if (action === 'regenerate') {
      const testId = String(body.test_id ?? '')
      if (!testId) return json({ error: 'test_id é obrigatório' }, 400)
      const { data: tRow } = await admin.from('marketing_ai_test_content')
        .select('id, idea, caption, hashtags, cta, format, image_url, scores').eq('id', testId).eq('company_id', company.id).maybeSingle()
      const t = tRow as { id: string; idea: string | null; caption: string | null; hashtags: string | null; cta: string | null; format: string | null; image_url: string | null; scores: Scores | null } | null
      if (!t) return json({ error: 'Post de teste não encontrado' }, 404)
      const config = await loadConfig(admin, company)
      const scores = t.scores ?? {}

      // acha a categoria PONDERADA mais fraca (só as que entram na nota final)
      let weakest = 'creative'; let min = 101
      for (const cat of Object.keys(SCORE_WEIGHTS)) { const s = scores[cat]?.score ?? 100; if (s < min) { min = s; weakest = cat } }

      if (weakest === 'visual') {
        // ponto fraco é o visual → regenera SÓ a imagem, mantém o texto
        const url = await generateImage(company.business_type, t.idea ?? t.caption ?? '')
        if (url) await admin.from('marketing_ai_test_content').update({ image_url: url }).eq('id', testId)
      } else {
        // ponto fraco é texto → reescreve legenda/hook/CTA guiado pelo feedback, mantém a imagem
        const weak = Object.entries(scores).filter(([, v]) => (v as CatScore).score < 75).map(([k, v]) => `- ${k}: ${(v as CatScore).comment}`).join('\n')
        const prompt = `${preamble(config, company)}

Você é o Copywriter da agência. Reescreva/melhore o post mantendo a MESMA ideia central e formato, corrigindo especificamente estes pontos fracos apontados pelo controle de qualidade:
${weak || `- ${weakest}: melhore este aspecto`}

Post atual:
- Ideia: ${t.idea ?? ''}
- Legenda: ${t.caption ?? ''}
- Hashtags: ${t.hashtags ?? ''}
- CTA: ${t.cta ?? ''}

Retorne APENAS um JSON: {"idea":"...","caption":"...","hashtags":"#...","cta":"..."}`
        const up = parseJsonObject(await callClaude(anthropicKey, prompt, 1200)) as Record<string, string>
        await admin.from('marketing_ai_test_content').update({
          idea: up.idea ?? t.idea, caption: up.caption ?? t.caption, hashtags: up.hashtags ?? t.hashtags, cta: up.cta ?? t.cta,
        }).eq('id', testId)
      }

      // re-avalia depois de regenerar
      const { data: fresh } = await admin.from('marketing_ai_test_content')
        .select('idea, caption, hashtags, cta, format, image_url').eq('id', testId).single()
      const f = fresh as PostShape & { image_url: string | null }
      const { scores: ns, quality } = await scoreContent(anthropicKey, config, company, { idea: f.idea, caption: f.caption, hashtags: f.hashtags, cta: f.cta, format: f.format, hasImage: !!f.image_url })
      await admin.from('marketing_ai_test_content').update({ scores: ns, quality_score: quality }).eq('id', testId)
      return json({ ok: true, regenerated: weakest, scores: ns, quality_score: quality })
    }

    // ── Enviar pro Vault (aprovado pelo QC, aguardando publicação) ──────
    if (action === 'to_vault') {
      const testId = String(body.test_id ?? '')
      if (!testId) return json({ error: 'test_id é obrigatório' }, 400)
      const { data: tRow } = await admin.from('marketing_ai_test_content').select('id, quality_score').eq('id', testId).eq('company_id', company.id).maybeSingle()
      const t = tRow as { id: string; quality_score: number | null } | null
      if (!t) return json({ error: 'Post de teste não encontrado' }, 404)
      if ((t.quality_score ?? 0) < 90) return json({ error: 'Nota abaixo de 90 — regenere os pontos fracos antes de mandar pro Vault.' }, 400)
      await admin.from('marketing_ai_test_content').update({ status: 'vault' }).eq('id', testId)
      return json({ ok: true })
    }

    return json({ error: 'action inválida. Use generate, score, regenerate ou to_vault.' }, 400)
  } catch (err) {
    console.error('content-test error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
