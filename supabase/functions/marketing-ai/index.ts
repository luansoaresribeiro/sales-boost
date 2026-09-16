/**
 * marketing-ai (V2 — Marketing Brain)
 * Dados, tabelas, dashboard e tools são 100% próprios — não compartilha
 * nenhuma tabela com generate-posts / content-intelligence / map-competitors
 * / hermes-proxy. Isso continua igual.
 *
 * O que MUDOU (decisão explícita do dono, revertendo a decisão anterior):
 * Strategy Intelligence não decide mais sozinha — ela empacota tudo que as
 * outras inteligências e o Marketing Brain sabem e manda pro Hermes (a
 * mesma VPS externa que decide pelo módulo Agentes) via
 * report_marketing_decision. "Hermes decide, Marketing AI executa." Essa
 * VPS é documentada como instável (502/timeout); quando ela falha, o ciclo
 * simplesmente não decide nada nessa rodada — nunca inventa decisão.
 *
 * Quatro pilares:
 *   - Tracking Intelligence   → runTracking()
 *   - Content Intelligence    → runContent()   (só roda se Hermes decidir)
 *   - Competitor Intelligence → runCompetitors()
 *   - Strategy Intelligence   → runStrategy()   (empacota e pergunta ao Hermes)
 *
 * Marketing Brain: cada pilar grava conhecimento destilado em
 * marketing_ai_brain_nodes (ver logBrainNode) — nenhuma memória isolada.
 *
 * Regra que NÃO muda: nunca publica sozinho. marketing_ai_content nunca sai
 * do status 'draft'/'approved' por conta própria — publicar de verdade no
 * Instagram é uma integração que ainda não existe de forma segura na
 * plataforma (ver auditoria do Executor). Isso vale mesmo quando o Hermes
 * decide "generate_content" — o resultado é sempre rascunho.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// REGRA CRÍTICA (arquitetural): o gerador de imagem só desenha a CENA
// VISUAL — nunca escreve/soletra texto. O prompt abaixo só usa `idea.idea`
// (conceito visual curto), nunca a legenda/copy de verdade.
const NO_TEXT_RULE = 'CRITICAL: this image must contain ONLY the visual scene — environment, people, products, objects, lighting, composition. Absolutely NO text of any kind anywhere in the image: no headlines, captions, CTAs, logos with text, signs, banners, posters, screens, labels, packaging text, watermarks, or simulated/gibberish lettering. If the scene naturally includes an object that would normally carry text (a sign, menu, screen, clipboard, label), render it completely blank — a clean empty surface. Never attempt to write, spell, or render any character.'

type SupaClient = ReturnType<typeof createClient>

interface Company {
  id: string; business_name: string; business_type: string | null; city: string | null
  instagram_url: string | null; goal: string | null
  // Memória estratégica que o dono ensina (tabela business_context). Anexada
  // ao carregar a empresa; entra no preâmbulo de todo prompt do agente.
  businessContext?: string
}

// Lê o que o dono ensinou (business_context) e formata pro prompt do agente.
// Só notas ativas e vigentes hoje, mais importantes primeiro, limitado pra
// não estourar tokens. É o "cérebro do negócio": entender quem é a empresa.
async function loadBusinessContext(admin: SupaClient, companyId: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)
  const [notesRes, dnaRes] = await Promise.all([
    admin.from('business_context').select('text, category, importance, effective_date, expiration_date').eq('company_id', companyId).eq('archived', false).order('created_at', { ascending: false }).limit(30),
    admin.from('brand_dna').select('voice, tone, avoid, colors, fonts, design_notes').eq('company_id', companyId).maybeSingle(),
  ])
  const parts: string[] = []

  // DNA da marca (voz/tom/design) — como a marca soa e se apresenta.
  const d = dnaRes.data as { voice?: string; tone?: string; avoid?: string; colors?: string[]; fonts?: string; design_notes?: string } | null
  if (d) {
    const dna: string[] = []
    if (d.voice) dna.push(`Voz: ${d.voice}`)
    if (d.tone) dna.push(`Tom: ${d.tone}`)
    if (d.avoid) dna.push(`Nunca faz/diz: ${d.avoid}`)
    if (d.colors?.length) dna.push(`Cores da marca: ${d.colors.join(', ')}`)
    if (d.fonts) dna.push(`Fontes: ${d.fonts}`)
    if (d.design_notes) dna.push(`Direção de arte: ${d.design_notes}`)
    if (dna.length) parts.push(`DNA da marca (respeite em toda peça):\n${dna.map(x => `- ${x}`).join('\n')}`)
  }

  // Notas estratégicas ativas e vigentes hoje, mais importantes primeiro.
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 }
  const active = (notesRes.data as { text: string; category: string; importance: string; effective_date: string | null; expiration_date: string | null }[] | null ?? [])
    .filter(n => (!n.effective_date || n.effective_date <= today) && (!n.expiration_date || n.expiration_date >= today))
    .sort((a, b) => (order[a.importance] ?? 1) - (order[b.importance] ?? 1))
    .slice(0, 15)
  if (active.length) parts.push(active.map(n => `- [${n.category}${n.importance === 'high' ? ' · prioridade alta' : ''}] ${n.text}`).join('\n'))

  return parts.join('\n\n')
}

interface MarketingAiConfig {
  business_objectives: string | null; brand_voice: string | null; tone: string | null
  posting_frequency: string; preferred_content_types: string[]
  automatic_publishing: boolean; approval_workflow: string
  competitors: string[]; brand_colors: string[]; brand_assets: Record<string, unknown>
  target_audience: string | null; content_pillars: string[]; marketing_goals: string | null
  agent_name: string
}

async function getConfig(admin: SupaClient, companyId: string): Promise<MarketingAiConfig | null> {
  const { data } = await admin.from('marketing_ai_config').select('*').eq('company_id', companyId).maybeSingle()
  return data as MarketingAiConfig | null
}

// Identidade única do agente — usada tanto pelos quatro pilares (cron) quanto
// pelo chat interativo, pra sempre soar como o mesmo "alguém", não quatro
// scripts desconectados.
function composeMarketingAgentPreamble(config: MarketingAiConfig, company: Company): string {
  const name = config.agent_name?.trim() || 'Agente de Marketing'
  return `Você é ${name}, o agente de marketing dedicado de "${company.business_name}" (${company.business_type ?? 'negócio'} em ${company.city ?? 'Brasil'}).
Voz da marca: ${config.brand_voice ?? 'não definida ainda'}. Tom: ${config.tone ?? 'não definido ainda'}.
Público-alvo: ${config.target_audience ?? 'não definido ainda'}.
Pilares de conteúdo: ${config.content_pillars.join(', ') || 'não definidos ainda'}.
Objetivos: ${config.marketing_goals ?? config.business_objectives ?? 'crescer e engajar mais'}.
${company.businessContext ? `\nO que o dono ensinou sobre o negócio (respeite SEMPRE em toda decisão, conteúdo e campanha):\n${company.businessContext}\n` : ''}
Seus dados são 100% próprios — não compartilha tabelas, posts nem histórico com o "Agente Geral" do dashboard. Você enxerga só o que suas próprias quatro inteligências coletaram: Tracking (métricas reais do Instagram), Content (ideias e legendas), Competitor (concorrentes configurados) e Strategy (o que o Hermes decidiu, com o porquê).
Regra permanente: você nunca publica nada sozinho — todo conteúdo que você cria fica como rascunho esperando aprovação. Nunca invente número que não veio de uma coleta real.`
}

async function logActivity(admin: SupaClient, companyId: string, pillar: string, action: string, reasoning?: string) {
  await admin.from('marketing_ai_activity_log').insert({ company_id: companyId, pillar, action, reasoning: reasoning ?? null })
}

// Parte A: avisa o dono no Telegram quando o agente PRINCIPAL (Growth OS) faz
// algo que precisa de aprovação. Mesmo caminho do sistema antigo
// (log-bot-event → worker), mas atribuído ao Marketing AI. Respeita a
// preferência de notificação do dono e falha em silêncio (é um bônus).
async function notifyTelegram(admin: SupaClient, companyId: string, count: number, reason: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('BOT_WEBHOOK_SECRET')
  if (!supabaseUrl) return
  const { data: co } = await admin.from('companies').select('telegram_chat_id, notification_prefs').eq('id', companyId).maybeSingle()
  const prefs = (co?.notification_prefs ?? {}) as Record<string, unknown>
  if (prefs.agent_actions === false) return
  fetch(`${supabaseUrl}/functions/v1/log-bot-event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: secret ?? '', bot_name: 'marketing', event_type: 'AGENT_ACTION', company_id: companyId, telegram_chat_id: co?.telegram_chat_id ?? null, data: { action: 'posts_created', count, reason: reason.slice(0, 200), agent: 'Marketing AI' } }),
  }).catch(() => {})
}

// Marketing Brain — conhecimento permanente e unificado. Cada pilar grava
// aqui, além da própria tabela de detalhe, pra nunca existir memória
// isolada (ver doc "Marketing Brain Updates").
type BrainNodeType = 'pattern' | 'learned_behavior' | 'recommendation' | 'successful_strategy' | 'failed_strategy' | 'experiment_result' | 'competitor_observation' | 'brand_fact'
type BrainPillar = 'tracking' | 'content' | 'competitor' | 'strategy' | 'experiment'

async function logBrainNode(admin: SupaClient, companyId: string, nodeType: BrainNodeType, sourcePillar: BrainPillar, title: string, body: string, confidence?: string, data?: Record<string, unknown>) {
  await admin.from('marketing_ai_brain_nodes').insert({
    company_id: companyId, node_type: nodeType, source_pillar: sourcePillar,
    title, body, confidence: confidence ?? null, data: data ?? {},
  })
}

async function callClaude(anthropicKey: string, prompt: string, maxTokens = 1200): Promise<string> {
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

async function runApifyActor(token: string, actorId: string, input: Record<string, unknown>, timeoutSecs = 90): Promise<unknown[]> {
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSecs}&memory=256`
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
  if (!res.ok) throw new Error(`Apify error (${actorId}): ${await res.text()}`)
  return res.json()
}

// ── 1. Tracking Intelligence ───────────────────────────────────────────────
// Coleta métricas reais do Instagram (própria chamada Apify — não usa
// apify-sync) e detecta padrões comparando com o histórico já coletado.
// Nunca inventa número que não veio do Apify.
interface ApifyIgPost { likesCount?: number; commentsCount?: number; timestamp?: string }
interface ApifyIgProfile { followersCount?: number; postsCount?: number; latestPosts?: ApifyIgPost[] }

async function runTracking(admin: SupaClient, company: Company, config: MarketingAiConfig, apifyToken: string, anthropicKey: string): Promise<{ insights: number; error?: string }> {
  if (!company.instagram_url) return { insights: 0, error: 'Instagram não configurado pra esta empresa.' }

  const items = await runApifyActor(apifyToken, 'apify~instagram-scraper', {
    directUrls: [company.instagram_url.replace(/\/$/, '')], resultsType: 'details', resultsLimit: 12,
  }) as ApifyIgProfile[]
  const profile = items[0]
  if (!profile) return { insights: 0, error: 'Perfil do Instagram não encontrado.' }

  const posts = profile.latestPosts ?? []
  const avgLikes = posts.length ? posts.reduce((s, p) => s + (p.likesCount ?? 0), 0) / posts.length : null
  const avgComments = posts.length ? posts.reduce((s, p) => s + (p.commentsCount ?? 0), 0) / posts.length : null
  const engagementRate = (avgLikes != null && avgComments != null && profile.followersCount)
    ? Number((((avgLikes + avgComments) / profile.followersCount) * 100).toFixed(2)) : null
  const hours = posts.map(p => p.timestamp ? new Date(p.timestamp).getUTCHours() : null).filter((h): h is number => h !== null)
  const bestHour = hours.length ? hours.sort((a, b) => hours.filter(h => h === a).length - hours.filter(h => h === b).length).pop() ?? null : null

  await admin.from('marketing_ai_tracking_snapshots').insert({
    company_id: company.id, source: 'instagram',
    followers: profile.followersCount ?? null, posts_count: profile.postsCount ?? null,
    avg_likes: avgLikes, avg_comments: avgComments, engagement_rate: engagementRate, best_posting_hour: bestHour,
    raw: profile,
  })

  const { data: history } = await admin.from('marketing_ai_tracking_snapshots')
    .select('followers, avg_likes, avg_comments, engagement_rate, best_posting_hour, collected_at')
    .eq('company_id', company.id).order('collected_at', { ascending: false }).limit(10)

  if (!history || history.length < 2) {
    return { insights: 0 } // primeira coleta — nada pra comparar ainda, não inventa tendência
  }

  const prompt = `${composeMarketingAgentPreamble(config, company)}

Agora você está atuando como Tracking Intelligence. Analise SÓ os dados reais abaixo (nunca invente número que não está aqui) e identifique padrões reais no histórico de métricas — mais recente primeiro:

${JSON.stringify(history, null, 2)}

Retorne APENAS um JSON array de até 3 insights, cada um: {"title": "frase curta", "description": "explicação com o dado real que sustenta", "impact": "high"|"medium"|"low"}. Se não houver padrão claro nos dados, retorne um array vazio [] — não force um insight.`

  const raw = await callClaude(anthropicKey, prompt, 800)
  const insights = parseJsonArray<{ title: string; description: string; impact: string }>(raw)
  for (const ins of insights) {
    await admin.from('marketing_ai_insights').insert({ company_id: company.id, pillar: 'tracking', title: ins.title, description: ins.description, impact: ins.impact })
    await logBrainNode(admin, company.id, 'pattern', 'tracking', ins.title, ins.description, ins.impact)
  }
  if (insights.length > 0) await logActivity(admin, company.id, 'tracking', `${insights.length} padrão(ões) detectado(s)`, insights[0]?.description)
  return { insights: insights.length }
}

// ── 2. Competitor Intelligence ─────────────────────────────────────────────
// Os concorrentes são configurados pelo dono (marketing_ai_config.competitors
// — lista de URLs de Instagram), não descobertos automaticamente — evita
// duplicar a busca do Google Places que já existe no módulo Agentes.
async function runCompetitors(admin: SupaClient, company: Company, config: MarketingAiConfig, apifyToken: string, anthropicKey: string): Promise<{ insights: number; scanned: number }> {
  const urls = (config.competitors ?? []).filter(u => u.trim())
  if (urls.length === 0) return { insights: 0, scanned: 0 }

  let scanned = 0
  const summaries: Record<string, unknown>[] = []

  for (const url of urls.slice(0, 8)) {
    try {
      const items = await runApifyActor(apifyToken, 'apify~instagram-scraper', { directUrls: [url.replace(/\/$/, '')], resultsType: 'details', resultsLimit: 12 }) as ApifyIgProfile[]
      const profile = items[0]
      if (!profile) continue
      const posts = profile.latestPosts ?? []
      const avgEngagement = posts.length ? posts.reduce((s, p) => s + (p.likesCount ?? 0) + (p.commentsCount ?? 0), 0) / posts.length : null
      const dates = posts.map(p => p.timestamp ? new Date(p.timestamp).getTime() : null).filter((t): t is number => t !== null).sort((a, b) => b - a)
      const freqDays = dates.length >= 2 ? Number((((dates[0] - dates[dates.length - 1]) / (1000 * 60 * 60 * 24)) / (dates.length - 1)).toFixed(1)) : null

      const { data: existing } = await admin.from('marketing_ai_competitors').select('id').eq('company_id', company.id).eq('instagram_url', url).maybeSingle()
      const row = { company_id: company.id, name: profile.followersCount ? url.split('/').filter(Boolean).pop() ?? url : url, instagram_url: url, posting_frequency_days: freqDays, avg_engagement: avgEngagement, followers: profile.followersCount ?? null, last_analyzed_at: new Date().toISOString() }
      let competitorId: string
      if (existing) {
        await admin.from('marketing_ai_competitors').update(row).eq('id', existing.id)
        competitorId = existing.id as string
      } else {
        const { data: inserted } = await admin.from('marketing_ai_competitors').insert(row).select('id').single()
        competitorId = inserted!.id as string
      }
      await admin.from('marketing_ai_competitor_snapshots').insert({ competitor_id: competitorId, followers: profile.followersCount ?? null, posts_count: profile.postsCount ?? null, avg_engagement: avgEngagement })
      summaries.push({ url, followers: profile.followersCount, avg_engagement: avgEngagement, posting_frequency_days: freqDays })
      scanned++
    } catch (e) {
      console.error(`runCompetitors: ${url} error:`, e)
    }
  }

  if (summaries.length === 0) return { insights: 0, scanned: 0 }

  const prompt = `${composeMarketingAgentPreamble(config, company)}

Agora você está atuando como Competitor Intelligence. Dados reais coletados agora dos concorrentes configurados:

${JSON.stringify(summaries, null, 2)}

O objetivo NÃO é copiar concorrente, é achar oportunidade real. Retorne APENAS um JSON array de até 3 insights: {"title": "...", "description": "...", "impact": "high"|"medium"|"low"}. Baseie-se só nos dados acima.`

  const raw = await callClaude(anthropicKey, prompt, 800)
  const insights = parseJsonArray<{ title: string; description: string; impact: string }>(raw)
  for (const ins of insights) {
    await admin.from('marketing_ai_insights').insert({ company_id: company.id, pillar: 'competitor', title: ins.title, description: ins.description, impact: ins.impact })
    await logBrainNode(admin, company.id, 'competitor_observation', 'competitor', ins.title, ins.description, ins.impact)
  }
  if (scanned > 0) await logActivity(admin, company.id, 'competitor', `${scanned} concorrente(s) analisado(s)`, insights[0]?.description)
  return { insights: insights.length, scanned }
}

// ── Trend Discovery ─────────────────────────────────────────────────────
// Raciocínio da IA sobre o segmento — não é uma API de tendências em tempo
// real (o Tool Registry marca essa ferramenta como "partial" por isso).
async function runTrends(admin: SupaClient, company: Company, config: MarketingAiConfig, anthropicKey: string): Promise<{ created: number }> {
  const prompt = `${composeMarketingAgentPreamble(config, company)}

Agora você está atuando como Trend Discovery. Com base no segmento do negócio e nos pilares de conteúdo configurados, sugira até 3 tendências relevantes pra esse tipo de negócio agora (formatos em alta, temas sazonais, ângulos de conteúdo). Seja honesto: isso é raciocínio, não dado de tendência em tempo real — nunca cite números de alcance ou volume que você não tem.

Retorne APENAS um JSON array: [{"title": "...", "description": "por que essa tendência importa pra esse negócio", "category": "formato"|"tema"|"sazonal", "relevance": "high"|"medium"|"low"}]`

  const raw = await callClaude(anthropicKey, prompt, 800)
  const trends = parseJsonArray<{ title: string; description: string; category: string; relevance: string }>(raw)
  for (const t of trends) {
    await admin.from('marketing_ai_trends').insert({ company_id: company.id, title: t.title, description: t.description, category: t.category, relevance: t.relevance })
  }
  if (trends.length > 0) await logActivity(admin, company.id, 'content', `${trends.length} tendência(s) sugerida(s)`, trends[0]?.description)
  return { created: trends.length }
}

// ── 3. Content Intelligence ────────────────────────────────────────────────
// Gera ideias/legendas com base no config + insights recentes das outras
// duas inteligências. Sempre entra como 'draft' — nunca publica sozinho.
async function runContent(admin: SupaClient, company: Company, config: MarketingAiConfig, anthropicKey: string, replicateKey: string | null): Promise<{ created: number }> {
  const { count: pendingCount } = await admin.from('marketing_ai_content').select('id', { count: 'exact', head: true }).eq('company_id', company.id).in('status', ['idea', 'draft'])
  if ((pendingCount ?? 0) >= 10) return { created: 0 } // já tem ideia parada esperando revisão — não empilha mais

  const { data: recentInsights } = await admin.from('marketing_ai_insights').select('pillar, title, description').eq('company_id', company.id).eq('status', 'open').order('created_at', { ascending: false }).limit(6)

  const prompt = `${composeMarketingAgentPreamble(config, company)}

Agora você está atuando como Content Intelligence — sua tarefa é gerar ideias de conteúdo.
${recentInsights?.length ? `\nInsights recentes de Tracking/Competitor pra considerar:\n${recentInsights.map(i => `- [${i.pillar}] ${i.title}: ${i.description}`).join('\n')}` : ''}

Gere 2 ideias de conteúdo alinhadas com a estratégia acima. Retorne APENAS um JSON array:
[{"idea": "resumo curto", "caption": "legenda completa pronta pra publicar", "hashtags": "#tag1 #tag2 #tag3", "format": "reel"|"carrossel"|"story"|"foto", "reasoning": "por que essa ideia faz sentido agora, citando os insights se houver"}]`

  const raw = await callClaude(anthropicKey, prompt, 1500)
  const ideas = parseJsonArray<{ idea: string; caption: string; hashtags: string; format: string; reasoning: string }>(raw)
  let created = 0
  for (const idea of ideas) {
    const { data: row } = await admin.from('marketing_ai_content').insert({
      company_id: company.id, idea: idea.idea, caption: idea.caption, hashtags: idea.hashtags,
      format: idea.format, reasoning: idea.reasoning, status: 'draft',
    }).select('id').single()
    created++

    if (replicateKey && row) {
      try {
        const imgPrompt = `Professional social media photo for a Brazilian small business (${company.business_type ?? 'negócio'}). Commercial photography, warm lighting, no people. ${NO_TEXT_RULE} Visual concept: ${idea.idea}`
        const repRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
          method: 'POST', headers: { Authorization: `Bearer ${replicateKey}`, 'Content-Type': 'application/json', Prefer: 'wait' },
          body: JSON.stringify({ input: { prompt: imgPrompt, num_outputs: 1, aspect_ratio: '1:1', output_format: 'webp', output_quality: 85 } }),
        })
        if (repRes.ok) {
          const pred = await repRes.json() as { status?: string; output?: string[] }
          const url = pred.status === 'succeeded' ? pred.output?.[0] : null
          if (url) await admin.from('marketing_ai_content').update({ image_url: url }).eq('id', row.id)
        }
      } catch (e) { console.error('runContent image error:', e) }
    }
  }
  if (created > 0) {
    await logActivity(admin, company.id, 'content', `${created} ideia(s) de conteúdo criada(s)`, ideas[0]?.reasoning)
    await notifyTelegram(admin, company.id, created, ideas[0]?.reasoning ?? 'Novo conteúdo criado, esperando sua aprovação.')
  }
  return { created }
}

// ── 4. Strategy Intelligence ───────────────────────────────────────────────
// "Hermes decide. Marketing AI executa." — Strategy não decide mais sozinha
// com uma chamada direta à Claude: ela empacota tudo que as outras
// inteligências descobriram (+ Marketing Brain + experimentos) e manda pro
// Hermes (a mesma VPS externa que decide pelo módulo Agentes) via
// report_marketing_decision. Hermes decide; esta função só executa e
// registra. Decisão explícita do dono — ver docstring do arquivo.
//
// Fail-safe: se a VPS do Hermes estiver fora do ar (já documentado como
// instável), não inventamos decisão nenhuma — só registramos que a rodada
// falhou e seguimos em frente, igual ao orquestrador do hermes-proxy.
const MARKETING_STRATEGY_TOOL = [{
  type: 'function',
  function: {
    name: 'report_marketing_decision',
    description: 'ÚNICA forma de terminar. Decide o que o Marketing AI deve fazer a seguir pra esta empresa.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['generate_content', 'run_tracking', 'run_competitors', 'propose_experiment', 'no_action'], description: 'A próxima ação concreta que o Marketing AI deve executar.' },
        findings: {
          type: 'array',
          description: 'Conhecimento novo pra gravar no Marketing Brain — só o que for real, baseado nos dados fornecidos.',
          items: {
            type: 'object',
            properties: {
              node_type: { type: 'string', enum: ['pattern', 'learned_behavior', 'recommendation', 'successful_strategy', 'failed_strategy', 'brand_fact'] },
              title: { type: 'string' },
              body: { type: 'string' },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            },
            required: ['node_type', 'title', 'body'],
          },
        },
        experiment: {
          type: 'object',
          description: 'Preencha só se action = propose_experiment.',
          properties: {
            hypothesis: { type: 'string' }, variable: { type: 'string' },
            variant_a: { type: 'string' }, variant_b: { type: 'string' },
          },
        },
        reasoning: { type: 'string', description: 'Por que essa decisão, citando os dados reais fornecidos — nunca invente evidência.' },
      },
      required: ['action', 'reasoning'],
    },
  },
}]

interface MarketingDecision {
  action: string; findings: { node_type: BrainNodeType; title: string; body: string; confidence?: string }[]
  experiment?: { hypothesis: string; variable: string; variant_a: string; variant_b: string }
  reasoning: string
}

async function askHermesForMarketingDecision(hermesUrl: string, hermesApiKey: string, systemPrompt: string): Promise<MarketingDecision | null> {
  const messages: unknown[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Analise os dados reais fornecidos e decida o que o Marketing AI deve fazer agora. Chame report_marketing_decision pra concluir.' },
  ]
  for (let i = 0; i < 3; i++) {
    const res = await fetch(`${hermesUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hermesApiKey}` },
      body: JSON.stringify({ model: 'hermes', messages, tools: MARKETING_STRATEGY_TOOL, tool_choice: 'auto' }),
    })
    if (!res.ok) throw new Error(`Hermes retornou erro ${res.status}`)
    const data = await res.json() as { choices?: { message?: { content?: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[] }
    const msg = data.choices?.[0]?.message
    const call = msg?.tool_calls?.find(tc => tc.function.name === 'report_marketing_decision')
    if (call) {
      try { return JSON.parse(call.function.arguments ?? '{}') as MarketingDecision } catch { return null }
    }
    if (!msg?.tool_calls?.length) return null // respondeu em texto livre — falha, não adivinha
    messages.push({ role: 'assistant', content: null, tool_calls: msg.tool_calls })
    for (const tc of msg.tool_calls) messages.push({ role: 'tool', tool_call_id: tc.id, content: 'ferramenta não reconhecida, use report_marketing_decision' })
  }
  return null
}

async function runStrategy(admin: SupaClient, company: Company, config: MarketingAiConfig, hermesUrl: string | null, hermesApiKey: string | null): Promise<{ recommendations: number; hermesUnavailable?: boolean; action?: string }> {
  const [{ data: insights }, { data: memory }, { data: recentContent }, { data: brainNodes }, { data: openExperiments }] = await Promise.all([
    admin.from('marketing_ai_insights').select('pillar, title, description, impact').eq('company_id', company.id).eq('status', 'open').order('created_at', { ascending: false }).limit(10),
    admin.from('marketing_ai_memory').select('key, learning, confidence').eq('company_id', company.id),
    admin.from('marketing_ai_content').select('status, format, performance').eq('company_id', company.id).order('created_at', { ascending: false }).limit(10),
    admin.from('marketing_ai_brain_nodes').select('node_type, title, body, confidence').eq('company_id', company.id).order('created_at', { ascending: false }).limit(15),
    admin.from('marketing_ai_experiments').select('hypothesis, status').eq('company_id', company.id).in('status', ['proposed', 'running']),
  ])

  const systemPrompt = `${composeMarketingAgentPreamble(config, company)}

Você está atuando como Strategy Intelligence, mas a decisão final é sempre do Hermes — você (Hermes) é quem decide o que o Marketing AI faz a seguir. Frequência de postagem configurada: ${config.posting_frequency}.

Marketing Brain (conhecimento acumulado desta empresa):
${brainNodes?.length ? brainNodes.map(n => `- [${n.node_type}] ${n.title}: ${n.body}`).join('\n') : 'ainda vazio — sistema recém-começou.'}

Insights abertos (Tracking + Competitor):
${insights?.length ? insights.map(i => `- [${i.pillar}/${i.impact}] ${i.title}: ${i.description}`).join('\n') : 'nenhum ainda.'}

Aprendizados acumulados (memória):
${memory?.length ? memory.map(m => `- ${m.learning} (confiança: ${m.confidence})`).join('\n') : 'nenhum ainda.'}

Conteúdo recente (status/formato):
${recentContent?.length ? recentContent.map(c => `- ${c.status} · ${c.format ?? '?'}`).join('\n') : 'nenhum ainda.'}

Experimentos em aberto:
${openExperiments?.length ? openExperiments.map(e => `- ${e.hypothesis} (${e.status})`).join('\n') : 'nenhum.'}

Nunca invente dado que não esteja acima. Se não houver evidência suficiente pra uma decisão forte, escolha action="no_action" e explique o motivo.`

  if (!hermesUrl || !hermesApiKey) {
    await logActivity(admin, company.id, 'strategy', 'Ciclo de estratégia pulado — HERMES_URL/HERMES_API_KEY não configurados.', undefined)
    return { recommendations: 0, hermesUnavailable: true }
  }

  let decision: MarketingDecision | null
  try {
    decision = await askHermesForMarketingDecision(hermesUrl, hermesApiKey, systemPrompt)
  } catch (err) {
    console.error('runStrategy: Hermes unavailable:', err)
    await logActivity(admin, company.id, 'strategy', 'Ciclo de estratégia falhou — Hermes (VPS externa) não respondeu.', String(err))
    return { recommendations: 0, hermesUnavailable: true }
  }
  if (!decision) {
    await logActivity(admin, company.id, 'strategy', 'Hermes não retornou uma decisão estruturada desta vez.', undefined)
    return { recommendations: 0 }
  }

  await admin.from('marketing_ai_strategy_log').insert({ company_id: company.id, recommendation: `[${decision.action}] ${decision.reasoning}`, reasoning: decision.reasoning })

  for (const f of decision.findings ?? []) {
    await logBrainNode(admin, company.id, f.node_type, 'strategy', f.title, f.body, f.confidence)
  }

  if (decision.action === 'propose_experiment' && decision.experiment) {
    await admin.from('marketing_ai_experiments').insert({
      company_id: company.id, hypothesis: decision.experiment.hypothesis, variable: decision.experiment.variable,
      variant_a: decision.experiment.variant_a, variant_b: decision.experiment.variant_b, reasoning: decision.reasoning, status: 'proposed',
    })
  }

  await logActivity(admin, company.id, 'strategy', `Hermes decidiu: ${decision.action}`, decision.reasoning)
  return { recommendations: 1, action: decision.action }
}

// ── Analytics Tool — relatórios armazenados ────────────────────────────────
// Antes só existia agregação na hora (ReportsTab lendo insights direto).
// Agora fica um registro permanente, gerado sob demanda, sempre citando os
// dados reais que embasaram o resumo — nunca invade número.
const REPORT_WINDOW_DAYS: Record<string, number> = { weekly: 7, monthly: 30, campaign: 30, executive: 30, growth: 30, audience: 30 }

async function runReport(admin: SupaClient, company: Company, config: MarketingAiConfig, anthropicKey: string, reportType: string): Promise<{ report_id: string }> {
  const windowDays = REPORT_WINDOW_DAYS[reportType] ?? 7
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: snapshots }, { data: insights }, { data: content }, { data: competitors }, { data: strategyLog }, { data: experiments }] = await Promise.all([
    admin.from('marketing_ai_tracking_snapshots').select('followers, avg_likes, avg_comments, engagement_rate, collected_at').eq('company_id', company.id).order('collected_at', { ascending: false }).limit(20),
    admin.from('marketing_ai_insights').select('pillar, title, description, impact').eq('company_id', company.id).gte('created_at', since),
    admin.from('marketing_ai_content').select('status, format').eq('company_id', company.id).gte('created_at', since),
    admin.from('marketing_ai_competitors').select('name, followers, avg_engagement').eq('company_id', company.id),
    admin.from('marketing_ai_strategy_log').select('recommendation, created_at').eq('company_id', company.id).gte('created_at', since),
    admin.from('marketing_ai_experiments').select('hypothesis, status, winner').eq('company_id', company.id),
  ])

  const prompt = `${composeMarketingAgentPreamble(config, company)}

Agora você está atuando como Analytics Tool, gerando um relatório do tipo "${reportType}" (últimos ${windowDays} dias). Use SÓ os dados reais abaixo — nunca invente número.

Histórico de métricas: ${JSON.stringify(snapshots ?? [])}
Insights do período: ${JSON.stringify(insights ?? [])}
Conteúdo do período (status/formato): ${JSON.stringify(content ?? [])}
Concorrentes: ${JSON.stringify(competitors ?? [])}
Decisões do Hermes no período: ${JSON.stringify(strategyLog ?? [])}
Experimentos: ${JSON.stringify(experiments ?? [])}

Escreva um resumo executivo curto (3-5 parágrafos), sempre explicando conclusões, nunca só listando números. Se não houver dado suficiente pra alguma seção, diga isso honestamente. Responda em texto corrido, sem markdown.`

  const summary = await callClaude(anthropicKey, prompt, 1200)
  const title = `Relatório ${reportType} — ${new Date().toLocaleDateString('pt-BR')}`
  const { data: row, error } = await admin.from('marketing_ai_reports').insert({
    company_id: company.id, report_type: reportType, title, summary,
    data: { snapshots, insights, content, competitors, strategyLog, experiments },
    period_start: new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    period_end: new Date().toISOString().slice(0, 10),
  }).select('id').single()
  if (error) throw new Error(error.message)

  await logActivity(admin, company.id, 'content', `Relatório ${reportType} gerado.`)
  return { report_id: row.id as string }
}

// ── Chat (o agente conversando de verdade) ─────────────────────────────────
// Primeira versão: uma chamada só (sem tool-calling ainda) — o contexto das
// quatro inteligências é injetado direto no prompt. Escopo 100% próprio:
// nunca lê agent_messages/posts do módulo Agentes, só as tabelas
// marketing_ai_*. Histórico persistido em marketing_ai_messages.
async function runChat(admin: SupaClient, company: Company, config: MarketingAiConfig, anthropicKey: string, message: string): Promise<{ reply: string }> {
  const [{ data: history }, { data: insights }, { data: content }, { data: competitors }, { data: strategyLog }] = await Promise.all([
    admin.from('marketing_ai_messages').select('role, content').eq('company_id', company.id).order('created_at', { ascending: false }).limit(20),
    admin.from('marketing_ai_insights').select('pillar, title, description, impact, status').eq('company_id', company.id).order('created_at', { ascending: false }).limit(10),
    admin.from('marketing_ai_content').select('idea, status, format').eq('company_id', company.id).order('created_at', { ascending: false }).limit(10),
    admin.from('marketing_ai_competitors').select('name, followers, avg_engagement').eq('company_id', company.id),
    admin.from('marketing_ai_strategy_log').select('recommendation, status').eq('company_id', company.id).order('created_at', { ascending: false }).limit(5),
  ])

  await admin.from('marketing_ai_messages').insert({ company_id: company.id, role: 'user', content: message })

  const contextBlock = `Insights recentes: ${insights?.length ? insights.map(i => `[${i.pillar}/${i.status}] ${i.title}`).join('; ') : 'nenhum ainda'}.
Conteúdo recente: ${content?.length ? content.map(c => `${c.idea ?? '(sem título)'} (${c.status})`).join('; ') : 'nenhum ainda'}.
Concorrentes monitorados: ${competitors?.length ? competitors.map(c => `${c.name} (${c.followers ?? '?'} seguidores)`).join('; ') : 'nenhum ainda'}.
Recomendações recentes: ${strategyLog?.length ? strategyLog.map(s => `${s.recommendation} (${s.status})`).join('; ') : 'nenhuma ainda'}.`

  const systemPrompt = `${composeMarketingAgentPreamble(config, company)}

Você está conversando diretamente com o dono do negócio. Responda em texto corrido, sem markdown (sem **, ##, listas com marcadores). Seja direto e específico, citando os dados reais abaixo quando fizer sentido — nunca invente número que não esteja neles.

Dados reais que você tem agora:
${contextBlock}`

  const recentHistory = (history ?? []).slice().reverse().slice(-10)
  const messages = [...recentHistory.map(h => ({ role: h.role, content: h.content })), { role: 'user', content: message }]

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 800, system: systemPrompt, messages }),
  })
  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`)
  const data = await res.json()
  const reply = data.content?.[0]?.text ?? ''

  await admin.from('marketing_ai_messages').insert({ company_id: company.id, role: 'assistant', content: reply })
  return { reply }
}

// ── Enforcement de ferramentas (Camada 2) ──────────────────────────────────
// Cada ação do Growth OS mapeia pra uma linha do capability_registry. O owner
// liga/desliga essas linhas no Agents Control Center; aqui a gente respeita
// isso de verdade — se a ferramenta está desligada, a ação não roda (nem no
// chat, nem no ciclo automático). Estratégia e chat são núcleo (não gateados).
const ACTION_TOOL_ID: Record<string, string> = {
  run_tracking: 'mai_tracking',
  run_competitors: 'mai_competitors',
  run_content: 'mai_content',
  run_trends: 'mai_trends',
  generate_report: 'mai_reports',
  run_experiment: 'mai_experiments',
  conclude_experiment: 'mai_experiments',
}

async function getDisabledMarketingAiTools(admin: SupaClient): Promise<Set<string>> {
  const disabled = new Set<string>()
  const { data } = await admin.from('capability_registry').select('id, enabled').contains('used_by', ['marketing_ai'])
  for (const r of (data ?? []) as { id: string; enabled: boolean }[]) {
    if (!r.enabled) disabled.add(r.id)
  }
  return disabled
}

// ── Decision Pipeline (modo cron) ──────────────────────────────────────────
// 1 Tracking → 2 Competitors → 3 Strategy → 4 Content (só se fizer sentido).
// Só roda pra empresas que têm marketing_ai_config (opt-in explícito nas
// Configurações do Marketing AI — nunca liga sozinho pra ninguém).
async function runPipelineForCompany(admin: SupaClient, company: Company, apifyToken: string | null, anthropicKey: string, replicateKey: string | null, hermesUrl: string | null, hermesApiKey: string | null, disabled: Set<string>): Promise<void> {
  const config = await getConfig(admin, company.id)
  if (!config) return // não fez onboarding do Marketing AI ainda

  if (apifyToken) {
    if (!disabled.has('mai_tracking')) await runTracking(admin, company, config, apifyToken, anthropicKey).catch(e => console.error('pipeline tracking error:', e))
    if (!disabled.has('mai_competitors')) await runCompetitors(admin, company, config, apifyToken, anthropicKey).catch(e => console.error('pipeline competitor error:', e))
  }
  // "Hermes decide. Marketing AI executa." — só gera conteúdo se o Hermes
  // decidiu isso agora, não mais por conta própria toda rodada.
  const strategyResult = await runStrategy(admin, company, config, hermesUrl, hermesApiKey).catch(e => { console.error('pipeline strategy error:', e); return null })
  if (strategyResult?.action === 'generate_content' && config.content_pillars.length > 0 && !disabled.has('mai_content')) {
    await runContent(admin, company, config, anthropicKey, replicateKey).catch(e => console.error('pipeline content error:', e))
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const apifyToken = Deno.env.get('APIFY_TOKEN') ?? null
    const replicateKey = Deno.env.get('REPLICATE_API_KEY') ?? null
    const cronSecretEnv = Deno.env.get('CRON_SECRET')
    // Mesma VPS externa do módulo Agentes (hermes-proxy) — Strategy Intelligence
    // decide através dela agora, por decisão explícita do dono.
    const hermesUrl = Deno.env.get('HERMES_URL') ?? null
    const hermesApiKey = Deno.env.get('HERMES_API_KEY') ?? null
    if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY não configurada.' }, 503)

    const admin = createClient(supabaseUrl, serviceKey)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const isCron = cronSecretEnv && body.cron_secret === cronSecretEnv

    if (isCron) {
      const disabled = await getDisabledMarketingAiTools(admin)
      const { data: companies } = await admin.from('companies').select('id, business_name, business_type, city, instagram_url, goal').eq('active', true)
      let processed = 0
      for (const company of (companies ?? []) as Company[]) {
        try {
          company.businessContext = await loadBusinessContext(admin, company.id)
          await runPipelineForCompany(admin, company, apifyToken, anthropicKey, replicateKey, hermesUrl, hermesApiKey, disabled)
          processed++
        } catch (e) {
          console.error(`marketing-ai cron: company ${company.id} error:`, e)
        }
      }
      return json({ ok: true, cron: true, processed })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: company } = await admin.from('companies').select('id, business_name, business_type, city, instagram_url, goal').eq('user_id', user.id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)
    ;(company as Company).businessContext = await loadBusinessContext(admin, company.id)

    const action = body.action as string
    const config = await getConfig(admin, company.id)
    if (!config) return json({ error: 'Configure o Marketing AI primeiro (aba Configurações).' }, 400)

    // Camada 2: respeita o liga/desliga de ferramentas do Agents Control Center.
    // Estratégia e chat são núcleo e não entram no mapa — nunca são bloqueados.
    const toolId = ACTION_TOOL_ID[action]
    if (toolId) {
      const disabled = await getDisabledMarketingAiTools(admin)
      if (disabled.has(toolId)) return json({ error: 'Esta ferramenta foi desativada pelo administrador no Agents Control Center.' }, 403)
    }

    if (action === 'run_tracking') {
      if (!apifyToken) return json({ error: 'APIFY_TOKEN não configurado.' }, 503)
      const r = await runTracking(admin, company as Company, config, apifyToken, anthropicKey)
      return json({ ok: true, ...r })
    }
    if (action === 'run_competitors') {
      if (!apifyToken) return json({ error: 'APIFY_TOKEN não configurado.' }, 503)
      const r = await runCompetitors(admin, company as Company, config, apifyToken, anthropicKey)
      return json({ ok: true, ...r })
    }
    if (action === 'run_content') {
      const r = await runContent(admin, company as Company, config, anthropicKey, replicateKey)
      return json({ ok: true, ...r })
    }
    if (action === 'run_trends') {
      const r = await runTrends(admin, company as Company, config, anthropicKey)
      return json({ ok: true, ...r })
    }
    if (action === 'generate_report') {
      const reportType = String(body.report_type ?? 'weekly')
      const r = await runReport(admin, company as Company, config, anthropicKey, reportType)
      return json({ ok: true, ...r })
    }
    if (action === 'run_strategy') {
      const r = await runStrategy(admin, company as Company, config, hermesUrl, hermesApiKey)
      return json({ ok: true, ...r })
    }
    if (action === 'chat') {
      const message = String(body.message ?? '').trim()
      if (!message) return json({ error: 'message é obrigatório' }, 400)
      const r = await runChat(admin, company as Company, config, anthropicKey, message)
      return json({ ok: true, ...r })
    }

    // Experiment Tool — o experimento em si é sempre PROPOSTO pelo Hermes
    // (via report_marketing_decision, dentro de runStrategy). Essas duas
    // ações só cobrem o ciclo de vida depois de proposto: o dono decide
    // começar a rodar, e quando termina, registra o resultado real —
    // nunca inventamos qual variante "ganhou".
    if (action === 'run_experiment') {
      const experimentId = String(body.experiment_id ?? '')
      if (!experimentId) return json({ error: 'experiment_id é obrigatório' }, 400)
      const { error } = await admin.from('marketing_ai_experiments').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', experimentId).eq('company_id', company.id)
      if (error) return json({ error: error.message }, 500)
      await logActivity(admin, company.id, 'experiment', 'Experimento iniciado.')
      return json({ ok: true })
    }
    if (action === 'conclude_experiment') {
      const experimentId = String(body.experiment_id ?? '')
      const winner = body.winner as string | undefined
      const results = (body.results ?? {}) as Record<string, unknown>
      if (!experimentId || !winner) return json({ error: 'experiment_id e winner são obrigatórios' }, 400)
      const { data: exp, error } = await admin.from('marketing_ai_experiments')
        .update({ status: 'completed', winner, results, ended_at: new Date().toISOString() })
        .eq('id', experimentId).eq('company_id', company.id).select('hypothesis, variable, variant_a, variant_b').single()
      if (error) return json({ error: error.message }, 500)
      await logBrainNode(admin, company.id, 'experiment_result', 'experiment',
        `Experimento concluído: ${exp.hypothesis}`,
        `Variável testada: ${exp.variable}. Vencedor: ${winner === 'a' ? exp.variant_a : winner === 'b' ? exp.variant_b : 'inconclusivo'}.`,
        'high', results)
      await logActivity(admin, company.id, 'experiment', `Experimento concluído — vencedor: ${winner}`)
      return json({ ok: true })
    }

    return json({ error: 'action inválida. Use run_tracking, run_competitors, run_content, run_trends, run_strategy, chat, run_experiment, conclude_experiment ou generate_report.' }, 400)
  } catch (err) {
    console.error('marketing-ai error:', err)
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
