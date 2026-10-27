/**
 * telegram-webhook — recebe as mensagens do bot de Telegram (marketing)
 * diretamente do Telegram, substituindo o Cloudflare Worker `marketing-bot`
 * nesse papel. Isso tira uma camada que não dava pra debugar (não tínhamos
 * acesso aos logs do Worker) e deixa tudo visível nos logs do Supabase.
 *
 * O Worker `marketing-bot` continua existindo só para servir o site — este
 * endpoint é quem passa a receber o webhook do Telegram de verdade. Depois de
 * publicar, é preciso repontar o webhook do bot pra esta URL (ver instruções).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseButton, verifyButton, pendingKeyboard, confirmKeyboard, tg } from '../_shared/telegramButtons.ts'
import { plannedPublishAt, publishWhenLabel } from '../_shared/publishSlot.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BOT_USERNAME = 'luansoaresribeirobot'
type SupaClient = ReturnType<typeof createClient>

interface TelegramChat { id: number; type: string }
interface TelegramAudio { file_id: string; duration?: number; file_size?: number }
interface TelegramMessage { message_id?: number; chat: TelegramChat; text?: string; voice?: TelegramAudio; audio?: TelegramAudio }
interface TelegramCallback { id: string; from: { id: number }; data?: string; message?: TelegramMessage }
interface TelegramUpdate { message?: TelegramMessage; edited_message?: TelegramMessage; callback_query?: TelegramCallback }

async function sendMessage(token: string, chatId: number, text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!res.ok) console.error('Telegram sendMessage failed:', res.status, await res.text().catch(() => ''))
}

async function logEvent(admin: SupaClient, eventType: string, message: string, chatId: number, companyId?: string | null): Promise<void> {
  await admin.from('bot_notifications').insert({
    bot_name: 'marketing', event_type: eventType, message, telegram_chat_id: chatId, company_id: companyId ?? null,
  }).then(({ error }) => { if (error) console.error('logEvent error:', error.message) })
}

async function handleConectar(admin: SupaClient, token: string, chatId: number, code: string, supabaseUrl: string, webhookSecret: string): Promise<void> {
  if (!code) {
    await sendMessage(token, chatId, '⚠️ Use: /conectar CÓDIGO\n\nGere seu código em: Dashboard → Configurações → Telegram')
    return
  }
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/telegram-connect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-webhook-secret': webhookSecret },
      body: JSON.stringify({ code, chat_id: chatId, bot_type: 'marketing' }),
    })
    const data = await res.json() as { ok?: boolean; error?: string }
    if (data.ok) {
      await sendMessage(token, chatId, '✅ Conta conectada com sucesso!\n\nVocê vai receber os avisos e sugestões aqui mesmo, direto nesta conversa. Use /start para ver os comandos disponíveis.')
      await logEvent(admin, 'conectar_ok', '✅ Conta conectada ao Telegram via código', chatId)
    } else {
      await sendMessage(token, chatId, `❌ ${data.error ?? 'Código inválido ou já utilizado.'}\n\nGere um novo código no dashboard.`)
    }
  } catch (err) {
    await sendMessage(token, chatId, `❌ Falha ao conectar: ${err instanceof Error ? err.message : 'erro desconhecido'}`)
  }
}

async function handleStart(admin: SupaClient, token: string, chatId: number, args: string, supabaseUrl: string, webhookSecret: string): Promise<void> {
  const codeMatch = args.trim().match(/^[A-Z2-9]{8}$/i)
  if (codeMatch) {
    await handleConectar(admin, token, chatId, args.trim(), supabaseUrl, webhookSecret)
    return
  }
  await sendMessage(token, chatId,
    'Olá! Eu sou o assistente Sales Boost 🚀\n\n' +
    'Comandos disponíveis:\n' +
    '/diagnostico — diagnóstico do site\n' +
    '/concorrentes — análise de concorrentes\n' +
    '/relatorio — relatório mensal\n\n' +
    'Para conectar sua conta, acesse o dashboard e clique em "Conectar Telegram".')
  await logEvent(admin, 'start', '👋 Novo usuário iniciou o bot de marketing', chatId)
}

async function handleFreeText(admin: SupaClient, token: string, chatId: number, text: string, supabaseUrl: string, webhookSecret: string): Promise<void> {
  try {
    // Volta pro telegram-chat (Claude direto) — o Hermes (hermes-proxy) está
    // instável no momento (a VPS que hospeda o HERMES_URL vem falhando), e o
    // Telegram é o canal principal com clientes reais, então não pode ficar
    // refém disso. Reavaliar a troca pro Hermes quando ele estiver estável.
    const res = await fetch(`${supabaseUrl}/functions/v1/telegram-chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-webhook-secret': webhookSecret },
      body: JSON.stringify({ chat_id: chatId, message: text, bot_type: 'marketing' }),
    })
    const data = await res.json() as { reply?: string; error?: string; ok?: boolean }
    // telegram-chat já envia a resposta pro Telegram sozinho quando dá certo —
    // só precisamos tratar o caso de erro explícito aqui.
    if (!res.ok || data.error) {
      await sendMessage(token, chatId, `❌ Erro ao processar mensagem: ${data.error ?? res.status}`)
      return
    }
    if (data.reply) await logEvent(admin, 'chat_response', `💬 Resposta automática enviada: ${text.slice(0, 50)}`, chatId)
  } catch (err) {
    await sendMessage(token, chatId, `❌ Falha ao processar: ${err instanceof Error ? err.message : 'erro desconhecido'}`)
  }
}

// Áudio no chat privado: o Claude não recebe áudio, então a OpenAI só converte a fala em texto
// (whisper-1, ~US$ 0,006/min) e o texto segue pro telegram-chat como se tivesse sido digitado.
// Só transcreve chat ligado a exatamente 1 empresa (não gasta com quem não conectou) e até 2 min.
const AUDIO_MAX_SECONDS = 120
const WHISPER_USD_PER_MIN = 0.006

async function openAiKey(admin: SupaClient): Promise<string | null> {
  const env = Deno.env.get('OPENAI_API_KEY')
  if (env) return env
  const { data } = await admin.from('_app_config').select('value').eq('key', 'openai_api_key').maybeSingle()
  return (data as { value?: string } | null)?.value ?? null
}

async function handleVoice(admin: SupaClient, token: string, chatId: number, audio: TelegramAudio, supabaseUrl: string, webhookSecret: string): Promise<void> {
  const { data: companies } = await admin.from('companies').select('id').eq('telegram_chat_id', chatId).limit(2)
  if (companies?.length !== 1) {
    // Sem gastar com transcrição: o telegram-chat já explica como conectar (ou o conflito de 2 empresas).
    await handleFreeText(admin, token, chatId, '(áudio)', supabaseUrl, webhookSecret)
    return
  }
  const companyId = (companies[0] as { id: string }).id
  if ((audio.duration ?? 0) > AUDIO_MAX_SECONDS) {
    await sendMessage(token, chatId, '🎤 Esse áudio passou de 2 minutos. Manda um mais curto (ou escreve) que eu respondo.')
    return
  }
  const fail = (why: string) => sendMessage(token, chatId, `🎤 Não consegui entender o áudio (${why}). Tenta de novo ou escreve a mensagem.`)
  const key = await openAiKey(admin)
  if (!key) { console.error('telegram-webhook: OPENAI_API_KEY ausente'); await fail('transcrição indisponível agora'); return }

  let text = ''
  try {
    const info = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(audio.file_id)}`).then(r => r.json()) as { ok?: boolean; result?: { file_path?: string } }
    const path = info.result?.file_path
    if (!info.ok || !path) { await fail('não consegui baixar'); return }
    const file = await fetch(`https://api.telegram.org/file/bot${token}/${path}`)
    if (!file.ok) { await fail('não consegui baixar'); return }
    const form = new FormData()
    form.append('file', new Blob([await file.arrayBuffer()], { type: 'audio/ogg' }), path.split('/').pop() || 'audio.ogg')
    form.append('model', 'whisper-1')
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) { console.error('telegram-webhook: transcrição falhou', res.status, await res.text().catch(() => '')); await fail('erro na transcrição'); return }
    text = String(((await res.json()) as { text?: string }).text ?? '').trim()
  } catch (err) {
    console.error('telegram-webhook: áudio falhou', err)
    await fail('erro na transcrição')
    return
  }

  // Custo no mesmo diário dos outros gastos de IA (teto de custo, regra 7).
  await admin.from('agent_performance').insert({
    company_id: companyId, agent_role: 'telegram', task_key: 'audio_transcription',
    task_description: 'Transcrição de áudio do Telegram (OpenAI whisper-1)', success: !!text,
    cost_usd: Math.round(Math.max(1, audio.duration ?? 1) / 60 * WHISPER_USD_PER_MIN * 10000) / 10000, latency_ms: 0,
  }).then(({ error }) => { if (error) console.error('telegram-webhook: custo não gravado', error.message) })

  if (!text) { await fail('não ouvi nada'); return }
  await sendMessage(token, chatId, `🎤 Entendi: “${text.length > 300 ? `${text.slice(0, 299)}…` : text}”`)
  await handleFreeText(admin, token, chatId, text, supabaseUrl, webhookSecret)
}

// Toque num botão de aprovação (mensagens do telegram-buddy). Fluxo:
// "Aprovar" → troca os botões por "Tem certeza?" → "Sim" → agent-actions
// (que confere a assinatura de novo e só então publica/envia). Só vale em
// conversa privada e só pra quem recebeu o botão (assinatura presa ao chat).
// "dia 28/10 às 18h" quando a peça do Vault está planejada pra um dia futuro (aprovar agenda); senão null.
async function vaultWhen(admin: SupaClient, kind: string, id: string): Promise<string | null> {
  if (kind !== 'v') return null
  try {
    const { data } = await admin.from('marketing_ai_test_content').select('planned_for').eq('id', id).maybeSingle()
    const plan = plannedPublishAt((data as { planned_for?: unknown } | null)?.planned_for)
    return plan ? publishWhenLabel(plan) : null
  } catch { return null }
}

async function handleCallback(cb: TelegramCallback, supabaseUrl: string, admin: SupaClient): Promise<void> {
  const answer = (text: string) => tg('answerCallbackQuery', { callback_query_id: cb.id, text, show_alert: false })
  const chat = cb.message?.chat
  const btn = parseButton(cb.data ?? '')
  if (!btn || !chat || chat.type !== 'private' || cb.from?.id !== chat.id || !cb.message?.message_id) { await answer('Botão inválido.'); return }
  if (!(await verifyButton(btn.kind, btn.op, btn.id, chat.id, btn.sig))) { await answer('Botão inválido.'); return }
  const where = { chat_id: chat.id, message_id: cb.message.message_id }

  if (btn.op === 'A') {
    const when = await vaultWhen(admin, btn.kind, btn.id)
    await tg('editMessageReplyMarkup', { ...where, reply_markup: await confirmKeyboard(btn.kind, btn.id, chat.id, when) })
    await answer(btn.kind === 'v' ? (when ? `Tem certeza? Vai sair no Instagram ${when}.` : 'Tem certeza? Vai pro Instagram de verdade.') : 'Tem certeza? Vai ser enviado de verdade.')
    return
  }
  if (btn.op === 'B') {
    await tg('editMessageReplyMarkup', { ...where, reply_markup: await pendingKeyboard(btn.kind, btn.id, chat.id, await vaultWhen(admin, btn.kind, btn.id)) })
    await answer('Ok, nada foi feito.')
    return
  }

  // 'Y' (confirmado) ou 'R' (recusar): quem decide é o agent-actions.
  // Tira os botões antes, pra ninguém tocar duas vezes enquanto processa.
  await tg('editMessageReplyMarkup', { ...where, reply_markup: { inline_keyboard: [] } })
  await answer(btn.op === 'Y' ? 'Processando…' : 'Ok!')
  let message = '⚠️ Não consegui falar com o servidor agora. Tente pelo painel.'
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/agent-actions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'telegram_decide', kind: btn.kind, op: btn.op, id: btn.id, chat_id: chat.id, sig: btn.sig }),
    })
    const data = await res.json().catch(() => ({})) as { message?: string }
    if (data.message) message = data.message
  } catch (e) { console.error('telegram-webhook: agent-actions falhou', e) }
  await tg('sendMessage', { chat_id: chat.id, text: message, reply_to_message_id: cb.message.message_id })
}

const COMMANDS = new Set(['/start', '/conectar', '/diagnostico', '/diagnostico_site', '/concorrentes', '/relatorio', 'report'])

async function routeMessage(admin: SupaClient, token: string, chatId: number, chatType: string, text: string, supabaseUrl: string, webhookSecret: string): Promise<void> {
  const [rawCommand, ...rest] = text.trim().split(/\s+/)
  const args = rest.join(' ')

  // Em grupos, só responde a comandos ou quando mencionado — igual ao comportamento anterior.
  let command = rawCommand.toLowerCase()
  if (chatType === 'group' || chatType === 'supergroup') {
    const mentioned = text.includes(`@${BOT_USERNAME}`)
    if (!mentioned && !command.startsWith('/')) return
    command = command.replace(new RegExp(`@${BOT_USERNAME}$`, 'i'), '')
  }

  if (!COMMANDS.has(command)) {
    if (command.startsWith('/')) {
      await sendMessage(token, chatId, 'Comando não reconhecido. Use /start para ver os comandos disponíveis.')
      return
    }
    await handleFreeText(admin, token, chatId, text, supabaseUrl, webhookSecret)
    return
  }

  if (command === '/start') return handleStart(admin, token, chatId, args, supabaseUrl, webhookSecret)
  if (command === '/conectar') return handleConectar(admin, token, chatId, args.trim(), supabaseUrl, webhookSecret)

  if (command === '/diagnostico' || command === '/diagnostico_site') {
    await sendMessage(token, chatId, '🔍 Gerando diagnóstico do seu site... isso pode levar até 1 minuto.')
    await logEvent(admin, 'diagnostico', '🔍 Diagnóstico de site solicitado via Telegram', chatId)
    await sendMessage(token, chatId, 'Esse comando ainda depende de estar logado no site — acesse o dashboard para gerar o diagnóstico por enquanto.')
    return
  }

  if (command === '/concorrentes') {
    await logEvent(admin, 'concorrentes', '🗺 Mapeamento de concorrentes solicitado via Telegram', chatId)
    await sendMessage(token, chatId, 'Esse comando ainda depende de estar logado no site — acesse o dashboard → Concorrentes por enquanto.')
    return
  }

  if (command === '/relatorio' || command === 'report') {
    await logEvent(admin, 'relatorio', '📊 Relatório mensal solicitado via Telegram', chatId)
    await sendMessage(token, chatId, 'Esse comando ainda depende de estar logado no site — acesse o dashboard → Relatório por enquanto.')
    return
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? ''
    if (!token) return json({ error: 'TELEGRAM_BOT_TOKEN nao configurado' }, 500)

    const admin = createClient(supabaseUrl, serviceKey)
    const update = await req.json().catch(() => ({})) as TelegramUpdate
    if (update.callback_query) {
      // Responde ao Telegram na hora e processa em segundo plano: publicar
      // pode levar ~30s e, sem resposta, o Telegram reenvia o mesmo toque.
      const work = handleCallback(update.callback_query, supabaseUrl, admin).catch(e => console.error('telegram-webhook callback:', e))
      // deno-lint-ignore no-explicit-any
      const rt = (globalThis as any).EdgeRuntime
      if (rt?.waitUntil) rt.waitUntil(work); else await work
      return json({ ok: true })
    }
    const message = update.message ?? update.edited_message
    if (message && !message.text && message.chat.type === 'private') {
      const audio = message.voice ?? message.audio
      if (audio?.file_id && update.message) {
        // Baixar + transcrever + responder pode passar de 10s: responde ao Telegram já (senão ele reenvia).
        const work = handleVoice(admin, token, message.chat.id, audio, supabaseUrl, webhookSecret).catch(e => console.error('telegram-webhook voz:', e))
        // deno-lint-ignore no-explicit-any
        const rt = (globalThis as any).EdgeRuntime
        if (rt?.waitUntil) rt.waitUntil(work); else await work
      } else if (update.message) {
        await sendMessage(token, message.chat.id, 'Por enquanto eu entendo mensagem escrita e áudio. Foto, vídeo e arquivo ainda não — manda por texto que eu respondo.')
      }
      return json({ ok: true })
    }
    if (!message?.text) return json({ ok: true })

    await routeMessage(admin, token, message.chat.id, message.chat.type, message.text, supabaseUrl, webhookSecret)
    return json({ ok: true })
  } catch (err) {
    console.error('telegram-webhook error:', err)
    return json({ ok: false, error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
