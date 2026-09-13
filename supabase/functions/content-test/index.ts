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

interface Company { id: string; business_name: string; business_type: string | null; city: string | null; goal: string | null; business_description: string | null; ideal_customer: string | null; language: string | null }
interface Config {
  agent_name: string; brand_voice: string | null; tone: string | null
  target_audience: string | null; content_pillars: string[]
  marketing_goals: string | null; business_objectives: string | null
}

// Mesmo preâmbulo de identidade do agente usado no marketing-ai, pra o teste
// soar exatamente como o conteúdo real vai soar. business_description vem do
// onboarding, sempre real — nunca depende do Marketing AI estar configurado
// (marketing_ai_config fica vazio até alguém preencher; sem isso o agente
// não sabe o que o negócio realmente faz e gera conteúdo genérico).
function preamble(config: Config, company: Company): string {
  const name = config.agent_name?.trim() || 'Agente de Marketing'
  return `Você é ${name}, o agente de marketing dedicado de "${company.business_name}" (${company.business_type ?? 'negócio'} em ${company.city ?? 'Brasil'}).
${company.business_description ? `O que o negócio faz de verdade: ${company.business_description}.` : ''}
Voz da marca: ${config.brand_voice ?? 'não definida ainda'}. Tom: ${config.tone ?? 'não definido ainda'}.
Público-alvo: ${config.target_audience ?? company.ideal_customer ?? 'não definido ainda'}.
Pilares de conteúdo: ${config.content_pillars.join(', ') || 'não definidos ainda'}.
Objetivos: ${config.marketing_goals ?? config.business_objectives ?? 'crescer e engajar mais'}.
${company.language === 'en' ? 'IMPORTANTE: escreva TODO o conteúdo (legenda, hook, CTA, hashtags) em inglês — este negócio atende clientes que falam inglês.' : ''}

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

// Analista VISUAL usa a imagem de verdade (Claude com visão) — baixa e
// manda como base64 porque a API não aceita URL direto de qualquer host.
async function fetchImageBase64(url: string): Promise<{ data: string; mediaType: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = new Uint8Array(await res.arrayBuffer())
    const mediaType = res.headers.get('content-type')?.split(';')[0] || 'image/png'
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < buf.length; i += chunk) binary += String.fromCharCode(...buf.subarray(i, i + chunk))
    return { data: btoa(binary), mediaType }
  } catch { return null }
}

async function callClaudeVision(anthropicKey: string, prompt: string, image: { data: string; mediaType: string }, maxTokens = 300): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: maxTokens,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
        { type: 'text', text: prompt },
      ] }],
    }),
  })
  if (!res.ok) throw new Error(`Claude vision error: ${await res.text()}`)
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
// forceNew: usado pelo "regenerate" quando o QC aponta o visual como ponto
// fraco — a legenda não muda, então sem isso o cache devolveria a MESMA
// imagem (a que tirou nota baixa) em vez de uma nova.
async function generateImage(companyId: string, businessType: string | null, idea: string, businessDescription?: string | null, forceNew?: boolean): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey) return null
  try {
    const prompt = `Professional social media photo for a Brazilian small business${businessDescription ? ` (${businessDescription})` : businessType ? ` (${businessType})` : ''}. Commercial photography, warm natural lighting, polished and inviting, no text, no logos, no watermark. The photo must clearly and specifically depict this exact post concept, not a generic stock photo: ${idea}`
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-image`, {
      method: 'POST', headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, size: '1024x1024', company_id: companyId, force_new: forceNew }),
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

// ── Testing Pipeline: analista de coerência ─────────────────────────────────
// Única checagem que existe (os 9 classificadores antigos + a checagem de
// gramática separada foram removidos de propósito — eram inconsistentes e
// travavam o Vault sem necessidade real). Coerência pergunta uma coisa só:
// esse post FAZ SENTIDO como peça publicável, do início ao fim? Calibrado
// pra ser GENEROSO (a maioria dos posts bem escritos deve passar fácil) —
// só marca nota baixa o que estiver claramente quebrado ou sem nexo, nunca
// frescura de estilo. Nunca bloqueia o Vault sozinho (ver `to_vault` mais
// abaixo) — é só um sinal pro dono decidir, não um portão técnico.
const COHERENCE_BAD_THRESHOLD = 50

interface CatScore { score: number; comment: string }
type Scores = Record<string, CatScore>
interface PostShape { idea: string | null; caption: string | null; hashtags: string | null; cta: string | null; format: string | null; imageUrl: string | null }

function parseJsonLoose<T = Record<string, unknown>>(raw: string): T {
  try { return JSON.parse(raw) as T } catch { /* fall through */ }
  const m = raw.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) as T } catch { /* give up */ } }
  return {} as T
}

async function scoreContent(anthropicKey: string, config: Config, company: Company, post: PostShape): Promise<{ scores: Scores; quality: number }> {
  const prompt = `${preamble(config, company)}

Agora você é um ANALISTA DE COERÊNCIA — a ÚNICA coisa que você avalia é se este post FAZ SENTIDO como uma peça publicável, do início ao fim. Isso NÃO é revisão de estilo, criatividade, gramática fina ou identidade de marca (isso já é garantido em outras etapas) — é só: alguém lendo isso entenderia e acreditaria que é um post de verdade, coerente?

Post:
- Formato: ${post.format ?? '—'}
- Ideia: ${post.idea ?? '—'}
- Legenda: ${post.caption ?? '—'}
- Hashtags: ${post.hashtags ?? '—'}
- CTA: ${post.cta ?? '—'}
- Imagem: ${post.imageUrl ? 'tem imagem gerada' : 'sem imagem'}

Dê nota de 0 a 100. SEJA GENEROSO — a maioria dos posts bem escritos deve ficar acima de 70. Só dê nota abaixo de ${COHERENCE_BAD_THRESHOLD} em casos CLARAMENTE ruins:
- A legenda contradiz a ideia/hook, ou fala de algo completamente diferente.
- O hook promete uma coisa e o resto do texto entrega outra, sem nenhuma conexão.
- Frases quebradas, repetidas, cortadas ou sem sentido nenhum.
- CTA ou hashtags totalmente desconectados do assunto do post.

NÃO reduza a nota por: escolha de estilo, gíria, tom mais informal ou ousado, criatividade fora do padrão, ou pequenos deslizes de gramática — isso é normal e aceitável, nunca é incoerência.

Retorne APENAS um JSON: {"score":0,"comment":"1 frase curta — o que está bom, ou o que especificamente não fecha, se houver"}`

  const raw = await callClaude(anthropicKey, prompt, 400)
  const parsed = parseJsonLoose<{ score?: number; comment?: string }>(raw)
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score ?? 100))))
  const scores: Scores = { coherence: { score, comment: String(parsed.comment ?? '') } }

  // Analista VISUAL — a imagem de verdade, não o texto. Pega bug de layout
  // (texto cortado/sobreposto no card) que a checagem de texto não enxerga.
  // Mesma calibração generosa: só nota baixa em problema visual CLARO.
  if (post.imageUrl) {
    try {
      const img = await fetchImageBase64(post.imageUrl)
      if (img) {
        const visPrompt = `Você é um ANALISTA VISUAL — a ÚNICA coisa que você avalia é se esta imagem está PRONTA PRA PUBLICAR de verdade: todo texto legível e COMPLETO (nada cortado na borda, nada sobrepondo outro elemento ou saindo do card), composição sem nada quebrado ou fora do lugar. NÃO avalie o conteúdo criativo, a mensagem ou a marca — só a execução visual.

Dê nota de 0 a 100. SEJA GENEROSO — a maioria das imagens deve passar fácil. Só dê nota abaixo de ${COHERENCE_BAD_THRESHOLD} em problema visual CLARO: texto cortado/sobreposto/ilegível, elemento quebrado, faltando ou fora do lugar.

Retorne APENAS um JSON: {"score":0,"comment":"1 frase curta — o que está bom, ou o que especificamente está quebrado, se houver"}`
        const rawV = await callClaudeVision(anthropicKey, visPrompt, img, 300)
        const parsedV = parseJsonLoose<{ score?: number; comment?: string }>(rawV)
        const scoreV = Math.max(0, Math.min(100, Math.round(Number(parsedV.score ?? 100))))
        scores.visual_coherence = { score: scoreV, comment: String(parsedV.comment ?? '') }
      }
    } catch (e) { console.error('scoreContent: analista visual falhou (segue sem essa nota)', e) }
  }

  return { scores, quality: score }
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

    // Chamada server-a-server (ex: creative-generate avaliando um post logo
    // após criar, sem usuário logado no caso do lote automático diário) usa a
    // própria service role como bearer + manda o company_id direto no corpo.
    const bearer = req.headers.get('Authorization') ?? ''
    if (!bearer) return json({ error: 'Unauthorized' }, 401)
    const isService = bearer === `Bearer ${serviceKey}`

    let company: Company | null = null
    if (isService && body.company_id) {
      const { data: companyRow } = await admin.from('companies').select('id, business_name, business_type, city, goal, business_description, ideal_customer, language').eq('id', String(body.company_id)).maybeSingle()
      company = companyRow as Company | null
    } else {
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
      const { data: { user } } = await userClient.auth.getUser()
      if (!user) return json({ error: 'Unauthorized' }, 401)
      const { data: companyRow } = await admin.from('companies').select('id, business_name, business_type, city, goal, business_description, ideal_customer, language').eq('user_id', user.id).maybeSingle()
      company = companyRow as Company | null
    }
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

      const url = await generateImage(company.id, company.business_type, idea.idea, company.business_description)
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
      const { scores, quality } = await scoreContent(anthropicKey, config, company, { idea: t.idea, caption: t.caption, hashtags: t.hashtags, cta: t.cta, format: t.format, imageUrl: t.image_url })
      await admin.from('marketing_ai_test_content').update({ scores, quality_score: quality }).eq('id', testId)
      return json({ ok: true, scores, quality_score: quality })
    }

    // ── Regenerar por problema de coerência (Auto Feedback Loop) ────────
    if (action === 'regenerate') {
      const testId = String(body.test_id ?? '')
      if (!testId) return json({ error: 'test_id é obrigatório' }, 400)
      const { data: tRow } = await admin.from('marketing_ai_test_content')
        .select('id, idea, caption, hashtags, cta, format, image_url, scores, brief').eq('id', testId).eq('company_id', company.id).maybeSingle()
      const t = tRow as { id: string; idea: string | null; caption: string | null; hashtags: string | null; cta: string | null; format: string | null; image_url: string | null; scores: Scores | null; brief: { template?: string } | null } | null
      if (!t) return json({ error: 'Post de teste não encontrado' }, 404)
      const config = await loadConfig(admin, company)
      const coherence = t.scores?.coherence
      const visual = t.scores?.visual_coherence
      const coherenceBad = (coherence?.score ?? 100) < COHERENCE_BAD_THRESHOLD
      const template = t.brief?.template ?? 'livre'

      // Problema é só VISUAL (texto tá ok) e é uma foto de IA de verdade
      // ("livre" ou sem template, ex: posts antigos) — regenera só a
      // imagem, mantém o texto. Cards de texto (tweet/announcement/product)
      // não têm imagem de IA pra regenerar aqui — precisam ser refeitos do
      // zero (o texto do card já sai curto por design agora, ver
      // creative-generate), então só mostra o aviso, sem botão mágico que
      // trocaria o card por uma foto genérica sem querer.
      const visualBad = (visual?.score ?? 100) < COHERENCE_BAD_THRESHOLD
      if (!coherenceBad && visualBad && (template === 'livre' || !t.brief)) {
        const url = await generateImage(company.id, company.business_type, t.idea ?? t.caption ?? '', company.business_description, true)
        if (url) await admin.from('marketing_ai_test_content').update({ image_url: url }).eq('id', testId)
        const { scores: ns, quality } = await scoreContent(anthropicKey, config, company, { idea: t.idea, caption: t.caption, hashtags: t.hashtags, cta: t.cta, format: t.format, imageUrl: url ?? t.image_url })
        await admin.from('marketing_ai_test_content').update({ scores: ns, quality_score: quality }).eq('id', testId)
        return json({ ok: true, regenerated: 'visual', scores: ns, quality_score: quality })
      }
      // Visual ruim mas é um card de texto (tweet/announcement/product) —
      // não dá pra regenerar aqui sem risco de trocar o card por uma foto
      // genérica. Se a coerência de texto também tá ok, não tem o que
      // regenerar de verdade — avisa em vez de mexer em algo que já tá bom.
      if (!coherenceBad && visualBad) {
        return json({ error: 'Esse card tem um problema visual, mas não dá pra corrigir automaticamente aqui — descarte e gere um post novo.' }, 400)
      }

      const prompt = `${preamble(config, company)}

Você é o Copywriter da agência. Reescreva/melhore o post mantendo o MESMO formato, corrigindo o problema de COERÊNCIA apontado pelo controle de qualidade: "${coherence?.comment ?? 'o post não faz sentido como uma peça única'}". Repense a ideia/legenda pra ela fazer sentido do início ao fim, mesmo que precise mudar o ângulo (não é só trocar uma palavra).

Post atual:
- Ideia: ${t.idea ?? ''}
- Legenda: ${t.caption ?? ''}
- Hashtags: ${t.hashtags ?? ''}
- CTA: ${t.cta ?? ''}

Retorne APENAS um JSON: {"idea":"...","caption":"...","hashtags":"#...","cta":"..."}`
      const up = parseJsonLoose<Record<string, string>>(await callClaude(anthropicKey, prompt, 1200))
      await admin.from('marketing_ai_test_content').update({
        idea: up.idea ?? t.idea, caption: up.caption ?? t.caption, hashtags: up.hashtags ?? t.hashtags, cta: up.cta ?? t.cta,
      }).eq('id', testId)

      // re-avalia depois de regenerar
      const { data: fresh } = await admin.from('marketing_ai_test_content')
        .select('idea, caption, hashtags, cta, format, image_url').eq('id', testId).single()
      const f = fresh as PostShape & { image_url: string | null }
      const { scores: ns, quality } = await scoreContent(anthropicKey, config, company, { idea: f.idea, caption: f.caption, hashtags: f.hashtags, cta: f.cta, format: f.format, imageUrl: f.image_url })
      await admin.from('marketing_ai_test_content').update({ scores: ns, quality_score: quality }).eq('id', testId)
      return json({ ok: true, regenerated: 'coherence', scores: ns, quality_score: quality })
    }

    // ── Enviar pro Vault ─────────────────────────────────────────────────
    // Sem gate técnico — a coerência é só um SINAL pro dono, nunca um portão
    // que bloqueia. Todo post, independente da nota, pode ir pro Vault
    // quando o dono decidir (ele é quem manda, não a IA).
    if (action === 'to_vault') {
      const testId = String(body.test_id ?? '')
      if (!testId) return json({ error: 'test_id é obrigatório' }, 400)
      const { error } = await admin.from('marketing_ai_test_content').update({ status: 'vault' }).eq('id', testId).eq('company_id', company.id)
      if (error) return json({ error: error.message }, 500)
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
