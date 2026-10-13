/**
 * adapt-plan — Creative Agent decide COMO adaptar um post aprovado a um novo
 * formato. NÃO recria a campanha nem muda a mensagem: ajusta o texto/ênfase pro
 * aspect ratio e placement (ex: Story 9:16 pede headline mais curto e vertical;
 * banner largo pede menos texto). Só TEXTO — custo de imagem = 0.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requirePaidAccess } from '../_shared/access.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

async function callClaude(key: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`)
  const d = await res.json()
  return (d.content?.[0]?.text ?? '').replace(/```(?:json)?\n?/g, '').trim()
}
function parseObj(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw) } catch { /* */ }
  const m = raw.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]) } catch { /* */ } }
  return {}
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!, anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY não configurada.' }, 503)
    const bearer = req.headers.get('Authorization') ?? ''
    if (!bearer) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey)
    const { data: comp } = await admin.from('companies').select('id').eq('user_id', user.id).maybeSingle()
    const noPlan = await requirePaidAccess(admin, comp?.id as string | undefined)
    if (noPlan) return noPlan

    const body = await req.json().catch(() => ({})) as { fields?: Record<string, string>; caption?: string; format?: { name?: string; ratio?: string; placement?: string; w?: number; h?: number } }
    const fields = body.fields ?? {}
    const fmt = body.format ?? {}

    const prompt = `Você é o Creative Agent adaptando um post APROVADO para um novo formato. NÃO mude a mensagem nem crie campanha nova — mantenha a MESMA ideia e identidade, só ajuste o texto pro novo espaço.

Formato de destino: ${fmt.name ?? 'formato'} (${fmt.ratio ?? ''}, placement ${fmt.placement ?? '—'}, ${fmt.w ?? '?'}x${fmt.h ?? '?'}).
Regras de adaptação:
- Vertical/Story/Reel (9:16): headline mais CURTO e impactante (cabe pouco texto na largura), pode quebrar em 2-3 palavras por linha.
- Quadrado (1:1) / Retrato (4:5): equilibrado.
- Largo/baixo (banner 1.91:1): pouquíssimo texto, headline curtíssimo.
- Mantenha oferta e CTA se existirem; encurte se necessário. Não invente informação nova.

Conteúdo atual:
- eyebrow: ${fields.eyebrow ?? ''}
- headline: ${fields.headline ?? ''}
- offer: ${fields.offer ?? ''}
- cta: ${fields.cta ?? ''}
${body.caption ? `- legenda (contexto, não vai na imagem): ${body.caption}` : ''}

Retorne APENAS um JSON com os campos ajustados pro formato: {"eyebrow":"...","headline":"...","offer":"...","cta":"..."}`

    const adjusted = parseObj(await callClaude(anthropicKey, prompt))
    const out: Record<string, string> = {}
    for (const k of ['eyebrow', 'headline', 'offer', 'cta']) if (adjusted[k] != null) out[k] = String(adjusted[k])
    return json({ ok: true, fields: out })
  } catch (err) {
    console.error('adapt-plan error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
