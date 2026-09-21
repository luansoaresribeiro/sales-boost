import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { runTool, SALES_TOOLS, MARKETING_TOOLS } from '../_shared/tools.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const secret = req.headers.get('x-agent-secret')
  const expectedSecret = Deno.env.get('AGENT_TOOLS_SECRET')
  if (!expectedSecret || !secret || secret !== expectedSecret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  const url = new URL(req.url)
  const isSchema = url.searchParams.get('schema') === '1'
  const areaParam = url.searchParams.get('area')

  if (req.method === 'GET' && isSchema) {
    const area = areaParam ?? 'vendas'
    const tools = area === 'marketing' ? MARKETING_TOOLS : SALES_TOOLS
    return json({ area, tools })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }

  const { area, company_id, telegram_chat_id, tool, input } = body as {
    area?: string; company_id?: string; telegram_chat_id?: string
    tool?: string; input?: unknown
  }

  if (!tool) return json({ error: '"tool" é obrigatório' }, 400)

  let companyData = null
  if (company_id) {
    const { data } = await admin.from('companies').select('id,business_name,business_type,city,instagram_url,goal,plan,google_rating,google_review_count').eq('id', company_id).maybeSingle()
    companyData = data
  } else if (telegram_chat_id) {
    const { data } = await admin.from('companies').select('id,business_name,business_type,city,instagram_url,goal,plan,google_rating,google_review_count').eq('telegram_chat_id', String(telegram_chat_id)).maybeSingle()
    companyData = data
  } else {
    return json({ error: 'Forneça company_id ou telegram_chat_id' }, 400)
  }

  if (!companyData) return json({ error: 'Empresa não encontrada' }, 404)

  const activeArea = area ?? 'vendas'
  const allowedTools = activeArea === 'marketing' ? MARKETING_TOOLS : SALES_TOOLS
  if (!allowedTools.find((t: { name: string }) => t.name === tool)) {
    return json({ error: `Ferramenta '${tool}' não disponível para área '${activeArea}'` }, 403)
  }

  try {
    const { result, posts } = await runTool(
      { name: tool, id: 'hermes', input: input ?? {} },
      companyData.id,
      activeArea,
      admin,
      companyData,
      0,
    )
    return json({ ok: true, result, posts })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
