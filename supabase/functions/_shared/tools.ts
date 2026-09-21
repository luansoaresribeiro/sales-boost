import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type SupaClient = ReturnType<typeof createClient>

export interface Company {
  id: string; business_name: string; business_type: string | null
  city: string | null; instagram_url: string | null; goal: string | null
  plan?: string | null; social_data?: Record<string, unknown>
  agent_messages_used?: number; agent_messages_reset_at?: string
  google_rating?: number | null; google_review_count?: string | null
}

export const TOOLS_ALL = [
  { name: 'create_post', description: 'Cria um rascunho de post para aprovação. NUNCA publica diretamente.', input_schema: { type: 'object', properties: { content: { type: 'string' }, platform: { type: 'string', enum: ['instagram', 'whatsapp', 'email'] }, image_suggestion: { type: 'string' }, image_url: { type: 'string' }, best_time: { type: 'string' } }, required: ['content', 'platform'] } },
  { name: 'create_multiple_posts', description: 'Cria vários rascunhos de uma vez.', input_schema: { type: 'object', properties: { posts: { type: 'array', items: { type: 'object', properties: { content: { type: 'string' }, platform: { type: 'string', enum: ['instagram', 'whatsapp', 'email'] }, image_suggestion: { type: 'string' }, image_url: { type: 'string' }, best_time: { type: 'string' } }, required: ['content', 'platform'] } } }, required: ['posts'] } },
  { name: 'get_business_overview', description: 'Resumo completo do negócio.', input_schema: { type: 'object', properties: {} } },
  { name: 'list_posts', description: 'Lista posts com filtro opcional por status.', input_schema: { type: 'object', properties: { status: { type: 'string', enum: ['rascunho', 'aprovado', 'publicado'] }, limit: { type: 'number' } } } },
  { name: 'list_opportunities', description: 'Lista oportunidades de receita detectadas.', input_schema: { type: 'object', properties: { status: { type: 'string' } } } },
  { name: 'list_reviews', description: 'Lista avaliações do Google.', input_schema: { type: 'object', properties: { rating_max: { type: 'number' }, unanswered_only: { type: 'boolean' }, limit: { type: 'number' } } } },
  { name: 'get_latest_diagnostic', description: 'Diagnóstico mais recente do site.', input_schema: { type: 'object', properties: {} } },
  { name: 'list_competitors', description: 'Concorrentes mapeados no Google Maps.', input_schema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'generate_image', description: 'Gera uma imagem para o post.', input_schema: { type: 'object', properties: { prompt: { type: 'string' }, style: { type: 'string', enum: ['photo', 'illustration', 'minimal'] } }, required: ['prompt'] } },
  { name: 'save_memory', description: 'Salva informação na memória do agente.', input_schema: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' }, type: { type: 'string', enum: ['preference', 'fact', 'rule'] } }, required: ['key', 'value', 'type'] } },
  { name: 'load_memory', description: 'Carrega uma memória pelo nome da chave.', input_schema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] } },
  { name: 'list_memories', description: 'Lista memórias do agente.', input_schema: { type: 'object', properties: { type: { type: 'string', enum: ['preference', 'fact', 'rule'] } } } },
  { name: 'list_leads', description: 'Lista leads do CRM.', input_schema: { type: 'object', properties: { stage: { type: 'string', enum: ['novo', 'contatado', 'qualificado', 'ganho', 'perdido'] }, limit: { type: 'number' } } } },
  { name: 'create_lead', description: 'Cria um novo lead no CRM.', input_schema: { type: 'object', properties: { name: { type: 'string' }, contact: { type: 'string' }, channel: { type: 'string', enum: ['whatsapp', 'instagram', 'site', 'manual'] }, source: { type: 'string' }, stage: { type: 'string', enum: ['novo', 'contatado', 'qualificado', 'ganho', 'perdido'] }, value_estimate: { type: 'number' }, notes: { type: 'string' } }, required: ['name'] } },
  { name: 'update_lead_stage', description: 'Move lead para outra etapa do funil.', input_schema: { type: 'object', properties: { lead_id: { type: 'string' }, stage: { type: 'string', enum: ['novo', 'contatado', 'qualificado', 'ganho', 'perdido'] } }, required: ['lead_id', 'stage'] } },
  { name: 'draft_followup', description: 'Cria rascunho de follow-up para um lead.', input_schema: { type: 'object', properties: { lead_id: { type: 'string' }, content: { type: 'string' }, channel: { type: 'string', enum: ['whatsapp', 'instagram', 'email'] }, scheduled_for: { type: 'string' } }, required: ['lead_id', 'content'] } },
]

export const BASE_TOOLS = TOOLS_ALL
export const SALES_TOOLS = TOOLS_ALL.filter(t => ['get_business_overview','list_opportunities','list_reviews','list_competitors','list_leads','create_lead','update_lead_stage','draft_followup'].includes(t.name))
export const MARKETING_TOOLS = TOOLS_ALL.filter(t => ['get_business_overview','list_posts','create_post','create_multiple_posts','generate_image','get_latest_diagnostic','list_competitors'].includes(t.name))

export async function runTool(tu: { name: string; id: string; input: unknown }, companyId: string, agentRole: string, admin: SupaClient, _company: Company, _depth: number): Promise<{ result: string; posts: number }> {
  const inp = tu.input as Record<string, unknown>

  if (tu.name === 'generate_image') {
    const replicateKey = Deno.env.get('REPLICATE_API_KEY')
    if (!replicateKey) return { result: 'Geração de imagem não configurada.', posts: 0 }
    const stylePrefix: Record<string, string> = { photo: 'Professional high-quality photograph, ', illustration: 'Clean digital illustration, modern flat design, ', minimal: 'Minimal clean composition, white background, ' }
    const fullPrompt = (stylePrefix[inp.style as string] ?? 'Professional photograph, ') + inp.prompt
    try {
      const res = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', { method: 'POST', headers: { Authorization: `Bearer ${replicateKey}`, 'Content-Type': 'application/json', Prefer: 'wait' }, body: JSON.stringify({ input: { prompt: fullPrompt, num_outputs: 1, aspect_ratio: '1:1', output_format: 'webp', output_quality: 85 } }) })
      const pred = await res.json() as { status?: string; output?: string[]; error?: string }
      if (pred.status === 'succeeded' && pred.output?.[0]) return { result: `IMAGEM GERADA COM SUCESSO.\nimage_url="${pred.output[0]}"\nAgora chame create_post com este image_url.`, posts: 0 }
      return { result: `Erro ao gerar imagem: ${pred.error ?? 'sem output'}`, posts: 0 }
    } catch (e) { return { result: `Erro na geração de imagem: ${e}`, posts: 0 } }
  }

  if (tu.name === 'create_post') {
    await admin.from('posts').insert({ company_id: companyId, content: inp.content, platform: inp.platform ?? 'instagram', image_suggestion: inp.image_suggestion ?? null, image_url: inp.image_url ?? null, best_time: inp.best_time ?? null, status: 'rascunho' })
    return { result: 'Post criado como rascunho. Disponível na aba Posts para aprovação.', posts: 1 }
  }

  if (tu.name === 'create_multiple_posts') {
    let count = 0
    for (const p of (inp.posts as Record<string, unknown>[]) ?? []) { await admin.from('posts').insert({ company_id: companyId, content: p.content, platform: p.platform ?? 'instagram', image_suggestion: p.image_suggestion ?? null, image_url: p.image_url ?? null, best_time: p.best_time ?? null, status: 'rascunho' }); count++ }
    return { result: `${count} posts criados como rascunho.`, posts: count }
  }

  if (tu.name === 'get_business_overview') {
    const [coRes, postsRes, oppsRes, revRes] = await Promise.all([admin.from('companies').select('business_name,business_type,city,goal,plan,google_rating,google_review_count,instagram_url').eq('id', companyId).single(), admin.from('posts').select('status').eq('company_id', companyId), admin.from('opportunities').select('id').eq('company_id', companyId).eq('status', 'open'), admin.from('reviews').select('rating,owner_reply').eq('company_id', companyId)])
    const byStatus = (postsRes.data ?? []).reduce((acc: Record<string, number>, p: { status: string }) => { acc[p.status] = (acc[p.status] ?? 0) + 1; return acc }, {})
    const revs = revRes.data ?? []
    const avgRating = revs.length ? (revs.reduce((s: number, r: { rating: number }) => s + (r.rating ?? 0), 0) / revs.length).toFixed(1) : null
    const unanswered = revs.filter((r: { owner_reply: unknown }) => !r.owner_reply).length
    return { result: JSON.stringify({ profile: coRes.data, posts: { total: (postsRes.data ?? []).length, byStatus }, openOpportunities: (oppsRes.data ?? []).length, reviews: { total: revs.length, avgRating, unanswered } }), posts: 0 }
  }

  if (tu.name === 'list_posts') { let q = admin.from('posts').select('id,content,platform,status,best_time,created_at').eq('company_id', companyId); if (inp.status) q = q.eq('status', inp.status as string); const { data } = await q.order('created_at', { ascending: false }).limit(Number(inp.limit ?? 10)); return { result: JSON.stringify(data ?? []), posts: 0 } }
  if (tu.name === 'list_opportunities') { let q = admin.from('opportunities').select('type,title,description,value_estimate,status').eq('company_id', companyId); if (inp.status) q = q.eq('status', inp.status as string); const { data } = await q.order('created_at', { ascending: false }).limit(20); return { result: JSON.stringify(data ?? []), posts: 0 } }
  if (tu.name === 'list_reviews') { let q = admin.from('reviews').select('author,rating,text,sentiment,review_date,owner_reply').eq('company_id', companyId); if (inp.rating_max) q = q.lte('rating', Number(inp.rating_max)); if (inp.unanswered_only) q = q.is('owner_reply', null); const { data } = await q.order('review_date', { ascending: false }).limit(Number(inp.limit ?? 10)); return { result: JSON.stringify(data ?? []), posts: 0 } }

  if (tu.name === 'get_latest_diagnostic') {
    try { const { data } = await admin.from('diagnostics').select('website_url,status,created_at,pagespeed_mobile,pagespeed_desktop,frontend_review').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle(); if (!data) return { result: JSON.stringify({ message: 'Nenhum diagnóstico encontrado.' }), posts: 0 }; const ps_m = data.pagespeed_mobile as Record<string, unknown> | null; const ps_d = data.pagespeed_desktop as Record<string, unknown> | null; const fr = data.frontend_review as Record<string, unknown> | null; return { result: JSON.stringify({ website_url: data.website_url, mobile: { performance: ps_m?.performance, seo: ps_m?.seo }, desktop: { performance: ps_d?.performance, seo: ps_d?.seo }, ai_summary: fr?.summary }), posts: 0 } } catch { return { result: JSON.stringify({ message: 'Diagnóstico indisponível.' }), posts: 0 } }
  }

  if (tu.name === 'list_competitors') { try { const { data } = await admin.from('competitors').select('name,rating,review_count,distance_m,price_level').eq('company_id', companyId).order('distance_m', { ascending: true }).limit(Number(inp.limit ?? 10)); return { result: JSON.stringify(data ?? []), posts: 0 } } catch { return { result: JSON.stringify({ message: 'Dados indisponíveis.' }), posts: 0 } } }

  if (tu.name === 'save_memory') { await admin.from('agent_memory').upsert({ company_id: companyId, agent_role: agentRole, key: inp.key as string, value: inp.value as string, type: inp.type as string, updated_at: new Date().toISOString() }, { onConflict: 'company_id,agent_role,key' }); return { result: `Memória salva: ${inp.key}`, posts: 0 } }
  if (tu.name === 'load_memory') { const { data } = await admin.from('agent_memory').select('value,type,updated_at').eq('company_id', companyId).eq('agent_role', agentRole).eq('key', inp.key as string).maybeSingle(); return { result: data ? JSON.stringify(data) : `Memória não encontrada: ${inp.key}`, posts: 0 } }
  if (tu.name === 'list_memories') { let q = admin.from('agent_memory').select('key,value,type,updated_at').eq('company_id', companyId).eq('agent_role', agentRole); if (inp.type) q = q.eq('type', inp.type as string); const { data } = await q.order('updated_at', { ascending: false }); return { result: JSON.stringify(data ?? []), posts: 0 } }

  if (tu.name === 'list_leads') { let q = admin.from('leads').select('id,name,contact,channel,stage,value_estimate,last_contact_at,notes,created_at').eq('company_id', companyId).eq('status', 'open'); if (inp.stage) q = q.eq('stage', inp.stage as string); const { data } = await q.order('created_at', { ascending: false }).limit(Number(inp.limit ?? 50)); return { result: JSON.stringify(data ?? []), posts: 0 } }

  if (tu.name === 'create_lead') {
    const { data: lead, error } = await admin.from('leads').insert({ company_id: companyId, name: inp.name as string, contact: (inp.contact as string) ?? null, channel: (inp.channel as string) ?? 'manual', source: (inp.source as string) ?? null, stage: (inp.stage as string) ?? 'novo', value_estimate: inp.value_estimate ? Number(inp.value_estimate) : null, notes: (inp.notes as string) ?? null }).select('id').single()
    if (error) return { result: `Erro ao criar lead: ${error.message}`, posts: 0 }
    return { result: `Lead "${inp.name}" criado (ID: ${lead?.id}).`, posts: 0 }
  }

  if (tu.name === 'update_lead_stage') { const { error } = await admin.from('leads').update({ stage: inp.stage as string, last_contact_at: new Date().toISOString() }).eq('id', inp.lead_id as string).eq('company_id', companyId); if (error) return { result: `Erro: ${error.message}`, posts: 0 }; return { result: `Lead movido para "${inp.stage}".`, posts: 0 } }

  if (tu.name === 'draft_followup') {
    const { data: msg, error } = await admin.from('lead_messages').insert({ lead_id: inp.lead_id as string, company_id: companyId, direction: 'out', channel: (inp.channel as string) ?? 'whatsapp', content: inp.content as string, status: 'rascunho', scheduled_for: (inp.scheduled_for as string) ?? null }).select('id').single()
    if (error) return { result: `Erro: ${error.message}`, posts: 0 }
    await admin.from('leads').update({ last_contact_at: new Date().toISOString() }).eq('id', inp.lead_id as string)
    return { result: `Follow-up criado como rascunho (ID: ${msg?.id}).`, posts: 0 }
  }

  return { result: `Ferramenta desconhecida: ${tu.name}`, posts: 0 }
}
