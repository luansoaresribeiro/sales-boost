/**
 * telegram-buddy — o "Telegram amigo".
 *
 * A cada 10 min (pg_cron, cron_secret no corpo) olha, pra cada empresa que
 * LIGOU "Telegram amigo" em Configurações → Notificações
 * (notification_prefs.telegram_buddy = true), o que aconteceu de importante
 * e avisa o dono num tom de conversa:
 *   - pedido de aprovação pendente (ex.: DM pronta pra responder um
 *     comentário) → botões ✅ Aprovar / ❌ Recusar / 👀 Ver no painel;
 *   - post novo no Vault (passou no controle de qualidade) → foto + legenda
 *     + ✅ Publicar / 👀 Ver no painel;
 *   - contato novo no funil (lead).
 * Aprovar sempre pede um 2º toque ("Tem certeza?") — ver telegram-webhook.
 *
 * Regras: nada fora do horário (22h–8h de Brasília, fica pra manhã), no
 * máximo 3 mensagens por empresa a cada rodada, cada item avisado uma vez
 * só (tabela telegram_buddy_sent), interruptor geral em
 * feature_flags.telegram_buddy e mestre do Telegram em report_config.
 *
 * Outras ações:
 *   - { action:'hello' } com JWT do dono → mensagem de boas-vindas (a tela
 *     chama ao ligar a opção, pra confirmar que está funcionando);
 *   - { action:'webhook_info', cron_secret } → diagnóstico do webhook do bot
 *     (sem token), pra conferir que os toques nos botões chegam.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { pendingKeyboard, PANEL_LINKS, tg, brazilHour } from '../_shared/telegramButtons.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
type Supa = ReturnType<typeof createClient>
type Company = { id: string; business_name: string | null; telegram_chat_id: number; notification_prefs: Record<string, unknown> | null }

const MAX_PER_RUN = 3
const LOOKBACK_MS = 48 * 3600_000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>

    if (body.action === 'hello') return await hello(req, admin, supabaseUrl)

    const cronSecret = Deno.env.get('CRON_SECRET')
    if (!cronSecret || body.cron_secret !== cronSecret) return json({ error: 'Unauthorized' }, 401)

    if (body.action === 'webhook_info') {
      const info = await tg('getWebhookInfo', {})
      const r = (info.result ?? {}) as Record<string, unknown>
      return json({ ok: info.ok, url: r.url, allowed_updates: r.allowed_updates ?? 'padrão (todos menos chat_member)', pending_update_count: r.pending_update_count, last_error_message: r.last_error_message ?? null, has_secret_token: 'não informado pelo Telegram' })
    }

    return await run(admin, body.company_id ? String(body.company_id) : null, body.ignore_quiet === true)
  } catch (err) {
    console.error('telegram-buddy error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})


async function run(admin: Supa, onlyCompany: string | null, ignoreQuiet: boolean) {
  const { data: flag } = await admin.from('feature_flags').select('enabled').eq('key', 'telegram_buddy').maybeSingle()
  if (flag && flag.enabled === false) return json({ ok: true, skipped: 'desligado (feature_flags.telegram_buddy)' })
  const { data: cfg } = await admin.from('report_config').select('telegram_enabled').eq('id', true).maybeSingle()
  if (cfg && (cfg as { telegram_enabled?: boolean }).telegram_enabled === false) return json({ ok: true, skipped: 'Telegram desligado na plataforma' })
  const hour = brazilHour()
  if (!ignoreQuiet && (hour >= 22 || hour < 8)) return json({ ok: true, skipped: 'horário de descanso (22h–8h)' })

  let q = admin.from('companies').select('id, business_name, telegram_chat_id, notification_prefs')
    .not('telegram_chat_id', 'is', null).eq('notification_prefs->>telegram_buddy', 'true')
  if (onlyCompany) q = q.eq('id', onlyCompany)
  const { data: companies, error } = await q
  if (error) return json({ error: error.message }, 500)

  let sent = 0
  for (const c of (companies ?? []) as Company[]) {
    // Só conversa privada (id positivo): em grupo qualquer pessoa tocaria o botão.
    if (!(Number(c.telegram_chat_id) > 0)) continue
    try { sent += await runCompany(admin, c) } catch (e) { console.error('telegram-buddy empresa', c.id, e) }
  }
  return json({ ok: true, companies: (companies ?? []).length, sent })
}

async function runCompany(admin: Supa, c: Company): Promise<number> {
  const chatId = Number(c.telegram_chat_id)
  // Só avisa o que aconteceu DEPOIS que o dono ligou a opção (nada de
  // despejar o passado), e nunca mais que 48h pra trás.
  const onSince = Date.parse(String(c.notification_prefs?.telegram_buddy_since ?? '')) || Date.now() - 24 * 3600_000
  const since = new Date(Math.max(onSince, Date.now() - LOOKBACK_MS)).toISOString()

  // Já avisados na janela saem da busca ANTES do limite — senão uma fila
  // de pendentes antigos esconderia os novos pra sempre.
  const { data: sentRows } = await admin.from('telegram_buddy_sent').select('ref_id').eq('company_id', c.id).gte('sent_at', since)
  const sentIds = ((sentRows ?? []) as { ref_id: string }[]).map(r => r.ref_id)
  const notSent = sentIds.length ? `(${sentIds.join(',')})` : null
  // deno-lint-ignore no-explicit-any
  const fresh = (q: any) => notSent ? q.not('id', 'in', notSent) : q
  const [{ data: actions }, { data: vault }, { data: leads }] = await Promise.all([
    fresh(admin.from('agent_actions').select('id, title, description, target, payload, agent_interpretation, created_at')
      .eq('company_id', c.id).eq('approval_status', 'PENDING').gte('created_at', since)).order('created_at', { ascending: false }).limit(10),
    fresh(admin.from('marketing_ai_test_content').select('id, idea, caption, image_url, media, quality_score, created_at')
      .eq('company_id', c.id).eq('status', 'vault').gte('created_at', since)).order('created_at', { ascending: false }).limit(10),
    fresh(admin.from('leads').select('id, name, channel, created_at')
      .eq('company_id', c.id).gte('created_at', since)).order('created_at', { ascending: false }).limit(10),
  ])

  type Item = { kind: 'a' | 'v' | 'lead'; id: string; at: string; send: () => Promise<{ ok: boolean; text: string }> }
  const items: Item[] = [
    ...((actions ?? []) as Record<string, unknown>[]).map(a => ({ kind: 'a' as const, id: String(a.id), at: String(a.created_at), send: () => sendAction(chatId, a) })),
    ...((vault ?? []) as Record<string, unknown>[]).map(v => ({ kind: 'v' as const, id: String(v.id), at: String(v.created_at), send: () => sendVault(chatId, v) })),
    ...((leads ?? []) as Record<string, unknown>[]).map(l => ({ kind: 'lead' as const, id: String(l.id), at: String(l.created_at), send: () => sendLead(chatId, l) })),
  ].sort((x, y) => x.at.localeCompare(y.at))
  if (!items.length) return 0

  const { data: already } = await admin.from('telegram_buddy_sent').select('kind, ref_id').eq('company_id', c.id).in('ref_id', items.map(i => i.id))
  const seen = new Set(((already ?? []) as { kind: string; ref_id: string }[]).map(r => `${r.kind}:${r.ref_id}`))

  let sent = 0
  for (const it of items) {
    if (sent >= MAX_PER_RUN) break
    if (seen.has(`${it.kind}:${it.id}`)) continue
    // Reserva antes de enviar (chave única): duas rodadas ao mesmo tempo
    // nunca mandam o mesmo aviso duas vezes.
    const { error: claimErr } = await admin.from('telegram_buddy_sent').insert({ company_id: c.id, kind: it.kind, ref_id: it.id })
    if (claimErr) continue
    const r = await it.send()
    if (!r.ok) {
      await admin.from('telegram_buddy_sent').delete().eq('company_id', c.id).eq('kind', it.kind).eq('ref_id', it.id)
      continue
    }
    sent++
    await admin.from('bot_notifications').insert({ bot_name: 'marketing', event_type: `BUDDY_${it.kind.toUpperCase()}`, message: r.text, telegram_chat_id: chatId, company_id: c.id })
      .then(({ error }) => { if (error) console.error('bot_notifications:', error.message) })
  }
  return sent
}

const cut = (s: unknown, n: number) => { const t = String(s ?? '').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t }

async function sendAction(chatId: number, a: Record<string, unknown>) {
  const p = (a.payload ?? {}) as Record<string, unknown>
  const lines = ['Oi! 👋 Preciso de um ok seu.', '']
  if (p.comment_id && p.message) {
    // description vem do instagram-webhook como: Comentário "texto" de @user.
    const comment = String(a.description ?? '').match(/^Comentário "([\s\S]*)" de /)?.[1]
    lines.push(`${cut(a.target ?? p.ig_user ?? 'Alguém', 60)} comentou no seu Instagram${comment ? `: “${cut(comment, 300)}”` : '.'}`, '')
    lines.push('Preparei esta resposta pra mandar por DM:', `“${cut(p.message, 600)}”`, '', 'Posso enviar?')
  } else {
    lines.push(cut(a.title ?? 'Uma ação do agente', 200))
    if (a.description) lines.push(cut(a.description, 500))
    if (a.agent_interpretation) lines.push('', `Por quê: ${cut(a.agent_interpretation, 300)}`)
    lines.push('', 'Posso seguir?')
  }
  const text = lines.join('\n')
  const r = await tg('sendMessage', { chat_id: chatId, text, reply_markup: await pendingKeyboard('a', String(a.id), chatId) })
  return { ok: r.ok, text }
}

async function sendVault(chatId: number, v: Record<string, unknown>) {
  const media = Array.isArray(v.media) ? (v.media as { url?: string; type?: string }[]) : []
  const photo = media.find(m => m?.url && m.type !== 'video')?.url ?? (v.image_url ? String(v.image_url) : '')
  const score = typeof v.quality_score === 'number' ? ` (nota ${v.quality_score})` : ''
  const fotos = media.length > 1 ? `\n\nÉ um carrossel com ${media.length} fotos/vídeos — veja tudo no painel.` : ''
  const text = `Ficou pronto um post novo e ele passou no nosso controle de qualidade${score} ✨\n\n${cut(v.caption ?? v.idea, 650)}${fotos}\n\nQuer que eu publique no seu Instagram?`
  const reply_markup = await pendingKeyboard('v', String(v.id), chatId)
  if (photo) {
    const r = await tg('sendPhoto', { chat_id: chatId, photo, caption: cut(text, 1024), reply_markup })
    if (r.ok) return { ok: true, text }
  }
  // Sem foto (ou o Telegram não conseguiu baixar): manda só o texto.
  const r = await tg('sendMessage', { chat_id: chatId, text, reply_markup })
  return { ok: r.ok, text }
}

const CHANNEL_LABEL: Record<string, string> = { instagram: 'pelo Instagram', whatsapp: 'pelo WhatsApp', site: 'pelo site', manual: 'cadastrado à mão' }

async function sendLead(chatId: number, l: Record<string, unknown>) {
  const via = CHANNEL_LABEL[String(l.channel ?? '')] ? ` ${CHANNEL_LABEL[String(l.channel)]}` : ''
  const text = `📥 Chegou um contato novo${via}: ${cut(l.name ?? 'sem nome', 80)}.\n\nJá está no seu funil. Responder rápido faz diferença. 😉`
  const r = await tg('sendMessage', { chat_id: chatId, text, reply_markup: { inline_keyboard: [[{ text: '👀 Ver no funil', url: PANEL_LINKS.lead }]] } })
  return { ok: r.ok, text }
}

// Boas-vindas quando o dono liga a opção na tela — confirma que chega.
async function hello(req: Request, admin: Supa, supabaseUrl: string) {
  const bearer = req.headers.get('Authorization') ?? ''
  if (!bearer) return json({ error: 'Unauthorized' }, 401)
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: bearer } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)
  const { data: c } = await admin.from('companies').select('telegram_chat_id').eq('user_id', user.id).maybeSingle()
  const chatId = Number(c?.telegram_chat_id)
  if (!(chatId > 0)) return json({ ok: false, error: 'Conecte o Telegram numa conversa privada com o bot primeiro.' })
  const r = await tg('sendMessage', {
    chat_id: chatId,
    text: 'Oi! 🙌 A partir de agora eu te aviso por aqui quando acontecer algo importante:\n\n• quando algo precisar da sua aprovação (com botão pra aprovar aqui mesmo)\n• quando um post novo ficar pronto\n• quando chegar um contato novo\n\nNada vai ao ar sem você confirmar. E fico quietinho das 22h às 8h. 😴',
  })
  return json({ ok: r.ok })
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
