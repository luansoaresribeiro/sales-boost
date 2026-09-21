/**
 * tools.ts — Definições e executores das ferramentas MCP do SalesBoost.
 *
 * Tier 1: executa na hora (leituras + criação de rascunhos)
 * Tier 2: gated — cria pending_action, avisa Luan, ele aprova no painel
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Admin = ReturnType<typeof createClient>
type Args  = Record<string, unknown>

interface McpTool {
  name: string
  description: string
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] }
}

const CID = { company_id: { type: 'string', description: 'ID da empresa no SalesBoost (uuid)' } }

// ── Tier 1 — Autônomo ────────────────────────────────────────────────────
export const TIER1_TOOLS: McpTool[] = [
  {
    name: 'list_companies',
    description: 'Lista todas as empresas cadastradas no SalesBoost com plano e data de cadastro.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_business_overview',
    description: 'Resumo completo: perfil, contagem de posts por status, avaliações, oportunidades abertas.',
    inputSchema: { type: 'object', properties: CID, required: ['company_id'] },
  },
  {
    name: 'list_posts',
    description: 'Lista posts com filtro opcional por status (rascunho/aprovado/publicado).',
    inputSchema: {
      type: 'object',
      properties: { ...CID, status: { type: 'string', enum: ['rascunho', 'aprovado', 'publicado'] }, limit: { type: 'number' } },
      required: ['company_id'],
    },
  },
  {
    name: 'list_opportunities',
    description: 'Lista oportunidades de receita detectadas (leads, avaliações negativas, reservas).',
    inputSchema: { type: 'object', properties: { ...CID, status: { type: 'string', description: 'Ex: open' } }, required: ['company_id'] },
  },
  {
    name: 'list_reviews',
    description: 'Lista avaliações do Google. Use unanswered_only=true e rating_max=3 para focar em negativos sem resposta.',
    inputSchema: {
      type: 'object',
      properties: { ...CID, rating_max: { type: 'number' }, unanswered_only: { type: 'boolean' }, limit: { type: 'number' } },
      required: ['company_id'],
    },
  },
  {
    name: 'get_latest_diagnostic',
    description: 'Diagnóstico mais recente do site (performance, SEO mobile/desktop).',
    inputSchema: { type: 'object', properties: CID, required: ['company_id'] },
  },
  {
    name: 'list_competitors',
    description: 'Concorrentes mapeados no Google Maps próximos à empresa.',
    inputSchema: { type: 'object', properties: { ...CID, limit: { type: 'number' } }, required: ['company_id'] },
  },
  {
    name: 'create_post_draft',
    description: 'Cria rascunho de post para aprovação humana. Nunca publica diretamente.',
    inputSchema: {
      type: 'object',
      properties: {
        ...CID,
        content: { type: 'string', description: 'Texto completo do post' },
        platform: { type: 'string', enum: ['instagram', 'whatsapp', 'email'] },
        image_suggestion: { type: 'string', description: 'Descrição da imagem sugerida' },
        best_time: { type: 'string', description: 'Melhor horário para postar (ex: Segunda 09:00)' },
      },
      required: ['company_id', 'content', 'platform'],
    },
  },
  {
    name: 'create_multiple_post_drafts',
    description: 'Cria vários rascunhos de uma vez. Use para semana de conteúdo (5 posts variados).',
    inputSchema: {
      type: 'object',
      properties: {
        ...CID,
        posts: {
          type: 'array',
          description: 'Lista de posts a criar',
          items: {
            type: 'object',
            properties: {
              content: { type: 'string' }, platform: { type: 'string', enum: ['instagram', 'whatsapp', 'email'] },
              image_suggestion: { type: 'string' }, best_time: { type: 'string' },
            },
            required: ['content', 'platform'],
          },
        },
      },
      required: ['company_id', 'posts'],
    },
  },
  {
    name: 'list_pending_actions',
    description: 'Lista ações pendentes de aprovação do Luan (Tier 2 gated).',
    inputSchema: { type: 'object', properties: CID, required: ['company_id'] },
  },
]

// ── Tier 2 — Gated (requer aprovação) ───────────────────────────────────
export const TIER2_TOOLS: McpTool[] = [
  {
    name: 'publish_post',
    description: '⚠️ GATED: Solicita aprovação para publicar um post no Instagram. Não executa sozinho — cria pedido de aprovação.',
    inputSchema: {
      type: 'object',
      properties: { ...CID, post_id: { type: 'string', description: 'UUID do post a publicar' } },
      required: ['company_id', 'post_id'],
    },
  },
  {
    name: 'reply_google_review_public',
    description: '⚠️ GATED: Solicita aprovação para publicar resposta pública a uma avaliação do Google. Não executa sozinho.',
    inputSchema: {
      type: 'object',
      properties: {
        ...CID,
        review_id: { type: 'string', description: 'UUID da avaliação' },
        reply_text: { type: 'string', description: 'Texto da resposta a publicar' },
      },
      required: ['company_id', 'review_id', 'reply_text'],
    },
  },
  {
    name: 'delete_post',
    description: '⚠️ GATED: Solicita aprovação para apagar um post. Qualquer exclusão requer aprovação humana.',
    inputSchema: {
      type: 'object',
      properties: { ...CID, post_id: { type: 'string' } },
      required: ['company_id', 'post_id'],
    },
  },
]

// ── Tier 1 executor ───────────────────────────────────────────────────────
export async function executeTier1(name: string, args: Args, admin: Admin): Promise<string> {
  const cid = args.company_id as string

  if (name === 'list_companies') {
    const { data } = await admin.from('companies').select('id, business_name, business_type, city, plan, created_at').order('created_at', { ascending: false })
    return JSON.stringify(data ?? [])
  }

  if (name === 'get_business_overview') {
    const [coRes, postsRes, oppsRes, revRes] = await Promise.all([
      admin.from('companies').select('business_name, business_type, city, goal, plan, google_rating, telegram_chat_id').eq('id', cid).single(),
      admin.from('posts').select('status').eq('company_id', cid),
      admin.from('opportunities').select('id').eq('company_id', cid).eq('status', 'open'),
      admin.from('reviews').select('rating, owner_reply').eq('company_id', cid),
    ])
    const byStatus = (postsRes.data ?? []).reduce((a: Record<string, number>, p: { status: string }) => { a[p.status] = (a[p.status] ?? 0) + 1; return a }, {})
    const revs = revRes.data ?? []
    const avgRating = revs.length ? (revs.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / revs.length).toFixed(1) : null
    const unanswered = revs.filter((r: { owner_reply: unknown }) => !r.owner_reply).length
    return JSON.stringify({ profile: coRes.data, posts: byStatus, openOpportunities: (oppsRes.data ?? []).length, reviews: { total: revs.length, avgRating, unanswered } })
  }

  if (name === 'list_posts') {
    let q = admin.from('posts').select('id, content, platform, status, best_time, created_at').eq('company_id', cid)
    if (args.status) q = q.eq('status', args.status as string)
    const { data } = await q.order('created_at', { ascending: false }).limit(Number(args.limit ?? 10))
    return JSON.stringify(data ?? [])
  }

  if (name === 'list_opportunities') {
    let q = admin.from('opportunities').select('id, type, title, description, value_estimate, status').eq('company_id', cid)
    if (args.status) q = q.eq('status', args.status as string)
    const { data } = await q.order('created_at', { ascending: false }).limit(20)
    return JSON.stringify(data ?? [])
  }

  if (name === 'list_reviews') {
    let q = admin.from('reviews').select('id, author, rating, text, sentiment, review_date, owner_reply').eq('company_id', cid)
    if (args.rating_max) q = q.lte('rating', Number(args.rating_max))
    if (args.unanswered_only) q = q.is('owner_reply', null)
    const { data } = await q.order('review_date', { ascending: false }).limit(Number(args.limit ?? 10))
    return JSON.stringify(data ?? [])
  }

  if (name === 'get_latest_diagnostic') {
    const { data } = await admin.from('diagnostics').select('website_url, status, created_at, pagespeed_mobile, pagespeed_desktop').eq('company_id', cid).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!data) return JSON.stringify({ message: 'Nenhum diagnóstico encontrado.' })
    const m = data.pagespeed_mobile as Record<string, unknown> | null
    const d = data.pagespeed_desktop as Record<string, unknown> | null
    return JSON.stringify({ website_url: data.website_url, created_at: data.created_at, mobile: { performance: m?.performance, seo: m?.seo }, desktop: { performance: d?.performance, seo: d?.seo } })
  }

  if (name === 'list_competitors') {
    const { data } = await admin.from('competitors').select('name, rating, review_count, distance_m, price_level').eq('company_id', cid).order('distance_m', { ascending: true }).limit(Number(args.limit ?? 10))
    return JSON.stringify(data ?? [])
  }

  if (name === 'create_post_draft') {
    await admin.from('posts').insert({ company_id: cid, content: args.content, platform: args.platform ?? 'instagram', image_suggestion: args.image_suggestion ?? null, best_time: args.best_time ?? null, status: 'rascunho' })
    return 'Post criado como rascunho. Disponível na aba Posts para aprovação.'
  }

  if (name === 'create_multiple_post_drafts') {
    const posts = (args.posts as Record<string, unknown>[]) ?? []
    for (const p of posts) {
      await admin.from('posts').insert({ company_id: cid, content: p.content, platform: p.platform ?? 'instagram', image_suggestion: p.image_suggestion ?? null, best_time: p.best_time ?? null, status: 'rascunho' })
    }
    return `${posts.length} rascunho(s) criados. Disponíveis na aba Posts para aprovação.`
  }

  if (name === 'list_pending_actions') {
    const { data } = await admin.from('pending_actions').select('id, tool_name, description, status, created_at').eq('company_id', cid).eq('status', 'pending').order('created_at', { ascending: false })
    return JSON.stringify(data ?? [])
  }

  throw new Error(`Tool not implemented: ${name}`)
}

// ── Tier 2 executor — cria pedido de aprovação ───────────────────────────
export async function executeTier2(name: string, args: Args, admin: Admin): Promise<string> {
  const cid = args.company_id as string
  let description = ''

  if (name === 'publish_post') {
    const { data: post } = await admin.from('posts').select('content, platform').eq('id', args.post_id as string).eq('company_id', cid).maybeSingle()
    const preview = post ? `"${String(post.content).slice(0, 80)}..."` : `post ${args.post_id}`
    description = `Publicar no ${(post?.platform ?? 'instagram')}: ${preview}`
  } else if (name === 'reply_google_review_public') {
    description = `Resposta pública a avaliação Google: "${String(args.reply_text).slice(0, 80)}..."`
  } else if (name === 'delete_post') {
    description = `Apagar post ${args.post_id}`
  }

  await admin.from('pending_actions').insert({ company_id: cid, tool_name: name, payload: args, description, status: 'pending' })

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const ownerChat = Deno.env.get('OWNER_TELEGRAM_CHAT_ID')
  if (botToken && ownerChat) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: ownerChat, text: `🔐 Hermes pede aprovação:\n${description}\n\nAcesse o dashboard para aprovar ou rejeitar.` }),
    }).catch(() => {})
  }

  return `⏳ Pedido criado: ${description}\nAguardando aprovação no dashboard.`
}
