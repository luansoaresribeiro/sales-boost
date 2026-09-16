/**
 * format-fill — preenche os CAMPOS de um formato visual com a voz da marca.
 *
 * Recebe o template (label + campos) e um assunto curto; devolve um JSON com o
 * valor de cada campo, em pt-BR, no tom da marca. Quem desenha a imagem é o
 * cliente (html-to-image) — aqui só entra o texto. Nada publica.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function callClaude(anthropicKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 900, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`)
  const data = await res.json()
  return (data.content?.[0]?.text ?? '').replace(/```(?:json)?\n?/g, '').trim()
}

function parseObj(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw) } catch { /* */ }
  const m = raw.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch { /* */ } }
  return {}
}

// Cada card gráfico tem espaço FIXO (render-format desenha num canvas de
// tamanho fixo, sem rolagem) — texto longo demais empurrava o resto pra
// fora do quadro, parecendo "cortado no meio da frase". render-format já
// tem uma rede de segurança (corta linha inteira, nunca no meio), mas o
// texto sai melhor quando a IA já escreve do tamanho certo, em vez de
// contar com o corte de emergência.
const FIELD_HINT: Record<string, string> = {
  text: 'máx. 140 caracteres — frase curta e COMPLETA, nunca cortada no meio',
  headline: 'máx. 8 palavras — frase de impacto COMPLETA',
  subtext: 'máx. 18 palavras',
  context: 'máx. 16 palavras',
  caption: 'máx. 12 palavras',
  cta: 'máx. 4 palavras (ex: "Agende agora")',
  offer: 'máx. 6 palavras',
  eyebrow: 'máx. 4 palavras',
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
    const { data: companyRow } = await admin.from('companies').select('id, business_name, business_type, city, goal, business_dna, instagram_url').eq('user_id', user.id).maybeSingle()
    const company = companyRow as { id: string; business_name: string; business_type: string | null; city: string | null; goal: string | null; business_dna: { brand_voice?: string; target_audience?: string } | null; instagram_url: string | null } | null
    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)

    const body = await req.json().catch(() => ({})) as { template?: string; fields?: { key: string; label: string }[]; subject?: string }
    const template = String(body.template ?? 'formato')
    const fields = Array.isArray(body.fields) ? body.fields : []
    const subject = String(body.subject ?? '').slice(0, 500)
    if (fields.length === 0) return json({ error: 'Sem campos para preencher.' }, 400)

    const { data: cfgRow } = await admin.from('marketing_ai_config').select('brand_voice, tone, content_pillars, marketing_goals').eq('company_id', company.id).maybeSingle()
    const cfg = (cfgRow ?? {}) as { brand_voice?: string; tone?: string; content_pillars?: string[]; marketing_goals?: string }
    const voice = cfg.brand_voice ?? company.business_dna?.brand_voice ?? 'não definida'

    const prompt = `Você é o redator de "${company.business_name}" (${company.business_type ?? 'negócio'} em ${company.city ?? 'Brasil'}).
Voz da marca: ${voice}. Tom: ${cfg.tone ?? 'não definido'}. Objetivo: ${cfg.marketing_goals ?? company.goal ?? 'engajar'}.
Handle do Instagram: ${company.instagram_url ?? '—'}.

Você vai preencher os campos de um formato visual do tipo "${template}".
${subject ? `Assunto do post: ${subject}` : 'Escolha um assunto forte e relevante pro negócio.'}

Campos a preencher (retorne um valor curto e pronto pra tela em cada um, em pt-BR, no tom da marca):
${fields.map(f => `- ${f.key}: ${f.label}${FIELD_HINT[f.key] ? ` (${FIELD_HINT[f.key]})` : ''}`).join('\n')}

Regras:
- Texto pronto pra aparecer na imagem, sem aspas extras, sem markdown.
- CADA CAMPO TEM ESPAÇO FIXO no card — respeite o limite indicado entre parênteses à risca. Nunca escreva um parágrafo onde só cabe uma frase curta; é melhor uma frase completa e curta do que uma longa que fica cortada.
- Se um campo for número de curtidas/retuítes/estatística, use um número plausível e honesto (é uma peça de design, não um dado real de analytics) — curto.
- Se um campo for "tema", responda "dark" ou "light".
Retorne APENAS um JSON com uma chave por campo: {${fields.map(f => `"${f.key}":"..."`).join(',')}}`

    const filled = parseObj(await callClaude(anthropicKey, prompt))
    const out: Record<string, string> = {}
    for (const f of fields) if (filled[f.key] != null) out[f.key] = String(filled[f.key])

    return json({ ok: true, values: out })
  } catch (err) {
    console.error('format-fill error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
