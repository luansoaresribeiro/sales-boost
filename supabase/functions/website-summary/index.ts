/**
 * website-summary — a IA lê o site real da empresa (website_url) e escreve um
 * resumo estruturado, pra servir de REPERTÓRIO real pros outros agentes (em
 * vez de só o que o dono digitou no cadastro). Salva em
 * companies.website_summary + website_summary_updated_at.
 *
 * Interativo só: JWT do dono, botão manual em Infos da Empresa (Agente de
 * Dados). Sem cron — o dono decide quando reler o site.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

// Extração crua de texto do HTML — sem parser de verdade, só o bastante pra
// dar contexto real pra IA (tira script/style/tags, decodifica entidades comuns).
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function fetchSiteText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SalesBoostBot/1.0)' } })
    clearTimeout(timeout)
    if (!res.ok) return null
    const html = await res.text()
    const text = htmlToText(html)
    return text.slice(0, 9000) || null
  } catch (e) { console.error('website-summary: fetch falhou', e); return null }
}

async function callClaude(anthropicKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 900, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`Claude: ${await res.text()}`)
  const data = await res.json()
  return (data.content?.[0]?.text ?? '').trim()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY não configurada.' }, 503)

    const bearer = req.headers.get('Authorization') ?? ''
    if (!bearer) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: company } = await admin.from('companies').select('id, business_name, business_type, website_url').eq('user_id', user.id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)
    if (!company.website_url) return json({ error: 'Cadastre o site da empresa primeiro (campo Site em Infos da Empresa).' }, 400)

    const siteText = await fetchSiteText(company.website_url)
    if (!siteText) return json({ error: 'Não consegui acessar o site — confira se a URL está certa e o site está no ar.' }, 502)

    const prompt = `Você está lendo o conteúdo real extraído do site de "${company.business_name}" (${company.business_type ?? 'negócio'}). Monte um RESUMO estruturado e objetivo (não é propaganda, é repertório real pra outra IA usar depois) cobrindo, quando o site der essa informação:
- O que o negócio realmente oferece (produtos/serviços concretos, não genérico)
- Diferenciais/posicionamento que o próprio site destaca
- Sinais de público-alvo (linguagem, preços, exemplos citados)
- Localização/atendimento (se mencionado)
- Qualquer prova social citada (números, depoimentos, prêmios)

Regras: só use o que está no texto abaixo — NUNCA invente produto, preço ou dado que não apareça. Se o site tiver pouco conteúdo útil, diga isso claramente em vez de inventar. Português, direto, sem markdown, no máximo 8 frases.

Conteúdo extraído do site:
"""
${siteText}
"""`

    const summary = await callClaude(anthropicKey, prompt)
    if (!summary) return json({ error: 'A IA não conseguiu gerar o resumo. Tente de novo.' }, 500)

    await admin.from('companies').update({ website_summary: summary, website_summary_updated_at: new Date().toISOString() }).eq('id', company.id)
    return json({ ok: true, summary })
  } catch (err) {
    console.error('website-summary error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
