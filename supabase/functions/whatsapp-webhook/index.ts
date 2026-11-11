/**
 * whatsapp-webhook — recebe o webhook oficial do WhatsApp Cloud API (Meta)
 * e responde pelo Agente, usando o número específico de cada empresa
 * (Embedded Signup — ver whatsapp-embedded-signup).
 *
 * Papéis, exigidos pelo próprio Meta:
 *   GET  — desafio de verificação (obrigatório pra cadastrar o endereço no
 *          painel do app: confere hub.verify_token e devolve hub.challenge).
 *   POST — mensagem real chegando. O phone_number_id no payload diz de qual
 *          empresa é (cada uma tem o próprio número, conectado via Embedded
 *          Signup) — sem empresa encontrada, só loga e não responde.
 *
 * Regra: responde direto (igual o telegram-chat), sem fila de aprovação —
 * é conversa ao vivo com um cliente, não conteúdo público. Nunca inventa
 * dado que não esteja no contexto real da empresa.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { loadPublicTextRules, safeAutoReply } from '../_shared/compliance.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const FB_VERSION = 'v21.0'
type SupaClient = ReturnType<typeof createClient>

interface WhatsAppMessage {
  from?: string
  id?: string
  type?: string
  text?: { body?: string }
  [key: string]: unknown
}
interface WhatsAppContact { profile?: { name?: string }; wa_id?: string }
interface WhatsAppChangeValue {
  metadata?: { phone_number_id?: string }
  contacts?: WhatsAppContact[]
  messages?: WhatsAppMessage[]
}
interface WhatsAppWebhookBody {
  entry?: { changes?: { value?: WhatsAppChangeValue; field?: string }[] }[]
}
interface Company {
  id: string; business_name: string; business_type: string | null; city: string | null; goal: string | null
  whatsapp_access_token: string | null; whatsapp_auto_reply: boolean
}

async function sendWhatsAppMessage(phoneNumberId: string, accessToken: string, to: string, body: string): Promise<void> {
  const res = await fetch(`https://graph.facebook.com/${FB_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
  })
  if (!res.ok) console.error('sendWhatsAppMessage failed:', res.status, await res.text().catch(() => ''))
}

async function generateReply(admin: SupaClient, company: Company, conversationId: string, from: string, message: string, anthropicKey: string): Promise<string> {
  const { data: history } = await admin.from('whatsapp_conversation_messages')
    .select('role, content').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(10)
  const recentHistory = (history ?? []).slice().reverse()

  const systemPrompt = `Você é o assistente de atendimento via WhatsApp de "${company.business_name}" (${company.business_type ?? 'negócio'} em ${company.city ?? 'Brasil'}).
Objetivo do negócio: ${company.goal ?? 'crescer e atender bem os clientes'}.
Responda como quem atende esse negócio de verdade — direto, educado, em português do Brasil, sem markdown (sem **, ##, listas). Seja breve (poucas frases). Nunca invente preço, horário, endereço ou disponibilidade que você não tenha — se não souber, diga que vai confirmar e retornar.`

  const messages = [...recentHistory.map(h => ({ role: h.role, content: h.content })), { role: 'user', content: message }]
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 500, system: systemPrompt, messages }),
  })
  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`)
  const data = await res.json()
  return data.content?.[0]?.text ?? 'Recebi sua mensagem, já te retorno.'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = new URL(req.url)

  // Desafio de verificação do Meta (GET) — obrigatório antes do painel deles
  // deixar salvar esse endereço como Callback URL.
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    const expectedToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN')

    if (mode === 'subscribe' && expectedToken && token === expectedToken && challenge) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }
    return new Response('Forbidden', { status: 403 })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const admin = createClient(supabaseUrl, serviceKey)

    const body = await req.json().catch(() => ({})) as WhatsAppWebhookBody

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value
        if (!value?.messages?.length) continue
        const phoneNumberId = value.metadata?.phone_number_id ?? null
        const contact = value.contacts?.[0]

        for (const msg of value.messages) {
          const fromNumber = msg.from ?? contact?.wa_id ?? null
          const messageText = msg.text?.body ?? null

          await admin.from('whatsapp_messages').insert({
            phone_number_id: phoneNumberId, from_number: fromNumber, contact_name: contact?.profile?.name ?? null,
            message_type: msg.type ?? 'unknown', content: messageText, raw: msg,
          })

          if (!phoneNumberId || !fromNumber || !messageText || !anthropicKey) continue

          const { data: company } = await admin.from('companies')
            .select('id, business_name, business_type, city, goal, whatsapp_access_token, whatsapp_auto_reply')
            .eq('whatsapp_phone_number_id', phoneNumberId).maybeSingle()
          if (!company || !company.whatsapp_auto_reply || !company.whatsapp_access_token) continue

          const { data: conv } = await admin.from('whatsapp_conversations')
            .upsert({ company_id: company.id, wa_contact_id: fromNumber, contact_name: contact?.profile?.name ?? null }, { onConflict: 'company_id,wa_contact_id' })
            .select('id').single()
          if (!conv) continue

          await admin.from('whatsapp_conversation_messages').insert({ conversation_id: conv.id, role: 'user', content: messageText })

          try {
            const raw = await generateReply(admin, company as Company, conv.id, fromNumber, messageText, anthropicKey)
            // Etapa 1B: resposta que rotula quem pode comprar/alugar ou promete resultado não é enviada — vai a resposta neutra da ficha.
            const pub = await loadPublicTextRules(admin, company.id)
            const safe = safeAutoReply(raw, pub?.rules ?? null)
            if (safe.replaced) console.warn('whatsapp-webhook: resposta trocada pela neutra (conformidade)', company.id)
            const reply = safe.text
            if (!reply.trim()) continue
            await admin.from('whatsapp_conversation_messages').insert({ conversation_id: conv.id, role: 'assistant', content: reply })
            await sendWhatsAppMessage(phoneNumberId, company.whatsapp_access_token, fromNumber, reply)
          } catch (e) {
            console.error('whatsapp-webhook reply error:', e)
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('whatsapp-webhook error:', err)
    // Sempre responde 200 pro Meta não ficar reenviando o mesmo evento em loop.
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
