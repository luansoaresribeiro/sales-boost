/**
 * instagram-webhook — Engagement: recebe comentários do Instagram e transforma
 * em AÇÃO inteligente. O cérebro fica aqui (SalesBoost): acha a automação pelo
 * Post/Campanha, interpreta a intenção (IA ou palavra-chave) e cria uma proposta
 * na Central de Approvals (agent_actions). Auto vs manual vem da própria
 * automação (execution_mode + allowed_auto_actions). Nada é enviado sem passar
 * pelo controle — e o executor real (enviar DM / criar lead) roda na aprovação.
 *
 * GET  — verificação do webhook da Meta (hub.challenge).
 * POST — evento de comentário. Idempotente por comment id.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const FB = 'https://graph.facebook.com/v21.0'
// deno-lint-ignore no-explicit-any
type Any = any

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = new URL(req.url)

  // 1) Verificação (Meta chama uma vez ao cadastrar o webhook).
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    const expected = Deno.env.get('INSTAGRAM_WEBHOOK_VERIFY_TOKEN') ?? Deno.env.get('WHATSAPP_VERIFY_TOKEN')
    if (mode === 'subscribe' && expected && token === expected && challenge) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }
    return new Response('Forbidden', { status: 403 })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const admin = createClient(supabaseUrl, serviceKey)

    const body = await req.json().catch(() => ({})) as Any
    for (const entry of body.entry ?? []) {
      const igUserId = String(entry.id ?? '') // conta de IG que recebeu o comentário
      for (const change of entry.changes ?? []) {
        if (change.field !== 'comments') continue
        const v = change.value ?? {}
        const commentId = v.id
        const text = v.text ?? ''
        const fromUser = v.from?.username ? `@${v.from.username}` : (v.from?.id ?? null)
        const mediaId = v.media?.id ?? null
        if (!commentId || !text) continue

        // Empresa dona dessa conta de Instagram.
        const { data: company } = await admin.from('companies')
          .select('id, instagram_access_token, agent_automatic_mode')
          .eq('instagram_user_id', igUserId).maybeSingle()
        if (!company) continue

        // Idempotência: já processou esse comentário?
        const { data: existing } = await admin.from('engagement_events').select('id').eq('company_id', company.id).eq('comment_text', text).eq('ig_user', fromUser).gte('created_at', new Date(Date.now() - 6 * 3600000).toISOString()).maybeSingle()
        if (existing) continue

        // Automações ativas dessa empresa que se aplicam a esse post.
        const { data: autos } = await admin.from('engagement_automations')
          .select('*').eq('company_id', company.id).eq('active', true).eq('trigger_type', 'ig_comment')
        const candidates = (autos ?? []).filter((a: Any) => !a.media_ref || a.media_ref === mediaId)
        if (candidates.length === 0) continue

        // Escolhe a automação e detecta a intenção.
        let chosen: Any = null
        let intentLabel = ''
        let interpretation = ''
        for (const a of candidates) {
          const match = await detectIntent(a, text, anthropicKey)
          if (match.hit) { chosen = a; intentLabel = match.intent; interpretation = match.interpretation; break }
        }
        if (!chosen) continue

        const actionType = chosen.action_type as string
        const message = chosen.message as string | null

        // Registra o evento (Conversations/Activity).
        const { data: ev } = await admin.from('engagement_events').insert({
          company_id: company.id, automation_id: chosen.id, channel: 'instagram',
          ig_user: fromUser, ig_user_id: v.from?.id ?? null, comment_text: text, media_ref: mediaId,
          intent_detected: intentLabel, ai_interpretation: interpretation,
          action_type: actionType, action_message: message, status: 'awaiting_approval',
        }).select('id').single()

        // Decisão auto vs manual: a AUTOMAÇÃO manda (granular), não um ON/OFF global.
        const auto = chosen.execution_mode === 'automatic' && (chosen.allowed_auto_actions ?? []).includes(actionType)

        // Proposta na Central de Approvals (mesmo shape de agent_actions).
        const { data: act } = await admin.from('agent_actions').insert({
          company_id: company.id, agent_key: 'marketing', agent_name: 'Agente de Marketing',
          action_type: actionType, channel: 'instagram', integration: 'instagram_engagement',
          target: fromUser, title: `${chosen.name}: ${actionType === 'send_dm' ? 'enviar DM' : actionType}`,
          description: `Comentário "${text}" de ${fromUser}.`,
          agent_interpretation: interpretation, reason: `Automação "${chosen.name}" (${intentLabel}).`,
          expected_outcome: chosen.create_lead ? 'Entregar o recurso e capturar o lead.' : 'Entregar o recurso pedido.',
          payload: { comment_id: commentId, ig_user_id: v.from?.id ?? null, ig_user: fromUser, media_ref: mediaId, message, create_lead: chosen.create_lead, event_id: ev?.id, action_type: actionType },
          risk_level: 'low', priority: 'normal', source: 'engagement',
          ref_type: 'engagement_event', ref_id: ev?.id ?? null,
          automation_enabled: auto,
          approval_status: auto ? 'AUTO_APPROVED' : 'PENDING',
          execution_status: auto ? 'QUEUED' : 'NOT_READY',
          approved_at: auto ? new Date().toISOString() : null,
        }).select('*').single()

        if (ev?.id && act?.id) await admin.from('engagement_events').update({ agent_action_id: act.id }).eq('id', ev.id)

        // Auto-aprovada → executa já (senão espera o dono aprovar em Aprovações).
        if (auto && act) await executeAction(admin, company, act, ev?.id)
      }
    }
    return json({ ok: true })
  } catch (err) {
    console.error('instagram-webhook error:', err)
    return json({ ok: true }) // sempre 200 pro Meta não reenviar em loop
  }
})

// Detecção de intenção: palavra-chave (rápido) ou IA (interpreta o sentido).
async function detectIntent(a: Any, text: string, anthropicKey?: string): Promise<{ hit: boolean; intent: string; interpretation: string }> {
  const low = text.toLowerCase()
  if (a.intent_type === 'any') return { hit: true, intent: 'Qualquer comentário', interpretation: 'Comentário no post com automação de captura ligada.' }
  if (a.intent_type === 'keyword') {
    const hit = (a.keywords ?? []).some((k: string) => low.includes(String(k).toLowerCase()))
    return { hit, intent: 'Palavra-chave', interpretation: hit ? 'A pessoa usou uma das palavras que disparam esta automação.' : '' }
  }
  // Intenções que pedem interpretação (IA). Sem chave → heurística simples.
  if (!anthropicKey) {
    const hit = low.length > 0
    return { hit, intent: 'Intenção (heurística)', interpretation: 'A pessoa comentou algo que parece pedir o recurso.' }
  }
  const goal = ({
    ai_intent: 'a pessoa está pedindo o recurso/material prometido no post',
    question: 'o comentário é uma pergunta',
    purchase_intent: 'a pessoa demonstra intenção de compra ou pergunta preço',
    positive: 'o comentário é positivo/elogioso',
  } as Any)[a.intent_type] ?? 'a pessoa está pedindo o recurso'
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 200, system: `Você classifica comentários de Instagram. Responda só JSON: {"match": true/false, "interpretation": "uma frase curta em pt-BR"}. match=true quando ${goal}.`, messages: [{ role: 'user', content: `Comentário: "${text}"` }] }),
    })
    const data = await res.json()
    const raw = data.content?.[0]?.text ?? '{}'
    const parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
    return { hit: !!parsed.match, intent: INTENT_LABEL(a.intent_type), interpretation: parsed.interpretation ?? '' }
  } catch {
    return { hit: low.length > 0, intent: INTENT_LABEL(a.intent_type), interpretation: 'A pessoa parece pedir o recurso prometido.' }
  }
}
function INTENT_LABEL(t: string): string {
  return ({ ai_intent: 'Pedido de recurso', question: 'Pergunta', purchase_intent: 'Intenção de compra', positive: 'Sentimento positivo' } as Any)[t] ?? 'Intenção'
}

// Executor: envia o DM (private reply ao comentário) e/ou cria o lead.
// Falha de forma honesta se o Instagram não estiver conectado.
async function executeAction(admin: Any, company: Any, act: Any, eventId?: string) {
  const p = act.payload ?? {}
  const set = (evStatus: string, actStatus: string, extra: Any = {}) => Promise.all([
    eventId ? admin.from('engagement_events').update({ status: evStatus, error: extra.execution_error ?? null }).eq('id', eventId) : Promise.resolve(),
    admin.from('agent_actions').update({ execution_status: actStatus, executed_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...extra }).eq('id', act.id),
  ])
  try {
    let dmOk = true, leadOk = true, err = ''
    // 1) DM (resposta privada ao comentário).
    if ((p.action_type === 'send_dm' || p.action_type === 'answer_question') && p.message) {
      if (!company.instagram_access_token) { dmOk = false; err = 'Instagram não conectado — não foi possível enviar o DM.' }
      else {
        const r = await fetch(`${FB}/${company.instagram_user_id ?? 'me'}/messages`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${company.instagram_access_token}` },
          body: JSON.stringify({ recipient: { comment_id: p.comment_id }, message: { text: p.message } }),
        })
        if (!r.ok) { dmOk = false; err = `Falha ao enviar DM: ${await r.text()}` }
      }
    }
    // 2) Lead.
    if (p.create_lead || p.action_type === 'create_lead') {
      const { error } = await admin.from('leads').insert({
        company_id: company.id, name: p.ig_user ?? 'Lead do Instagram', contact: p.ig_user ?? null,
        channel: 'instagram', stage: 'new', notes: `Comentário: "${act.description}". ${act.agent_interpretation ?? ''}`,
      })
      if (error) leadOk = false
    }
    if (dmOk && leadOk) return await set(p.create_lead ? 'lead_created' : 'sent', 'EXECUTED', { execution_result: { dm: dmOk, lead: leadOk } })
    return await set('failed', 'FAILED', { execution_error: err || 'Falha parcial na execução.' })
  } catch (e) {
    return await set('failed', 'FAILED', { execution_error: e instanceof Error ? e.message : String(e) })
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
