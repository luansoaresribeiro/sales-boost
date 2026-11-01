// Botões assinados do Telegram ("Aprovar" direto na conversa).
//
// O telegram-webhook NÃO tem como provar que uma chamada veio mesmo do
// Telegram (o webhook foi registrado sem secret_token). Por isso cada botão
// carrega uma assinatura HMAC que só o nosso servidor sabe fazer, presa ao
// item E ao chat do dono: alguém que forje uma chamada não consegue
// aprovar nada sem ter recebido o botão de verdade naquele chat.
//
// Formato do callback_data (limite do Telegram: 64 bytes):
//   <kind>|<op>|<uuid>|<sig22>   → 1+1+1+1+36+1+22 = 63 bytes
//   kind: 'a' = agent_actions pendente · 'v' = post do Vault
//   op:   'A' = pedir confirmação · 'Y' = confirmado · 'R' = recusar · 'B' = voltar

export type ButtonKind = 'a' | 'v'
export type ButtonOp = 'A' | 'Y' | 'R' | 'B'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function hmac(message: string): Promise<string> {
  // Chave derivada da service role (sempre presente em toda function e
  // nunca sai do servidor) com um rótulo próprio — não é a chave em si.
  const base = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!base) throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente')
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(`tg-buttons:v1:${base}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
  let bin = ''
  for (const b of sig) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 22)
}

export async function signButton(kind: ButtonKind, op: ButtonOp, id: string, chatId: number | string): Promise<string> {
  return `${kind}|${op}|${id}|${await hmac(`${kind}|${op}|${id}|${chatId}`)}`
}

export function parseButton(data: string): { kind: ButtonKind; op: ButtonOp; id: string; sig: string } | null {
  const [kind, op, id, sig, ...rest] = String(data ?? '').split('|')
  if (rest.length || !sig) return null
  if (kind !== 'a' && kind !== 'v') return null
  if (!['A', 'Y', 'R', 'B'].includes(op)) return null
  if (!UUID_RE.test(id)) return null
  return { kind, op: op as ButtonOp, id, sig }
}

// Comparação em tempo constante (não vaza quantos caracteres bateram).
export async function verifyButton(kind: ButtonKind, op: ButtonOp, id: string, chatId: number | string, sig: string): Promise<boolean> {
  const expected = await hmac(`${kind}|${op}|${id}|${chatId}`)
  if (expected.length !== sig.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0
}

export const SITE = 'https://getsaleboost.com'
export const PANEL_LINKS: Record<ButtonKind | 'lead', string> = {
  a: `${SITE}/dashboard/aprovacoes`,
  v: `${SITE}/dashboard/marketing-ai/content?tab=biblioteca`,
  lead: `${SITE}/dashboard/marketing-ai/conversao`,
}

// Teclado padrão de um item pendente. A aprovação SEMPRE passa por um
// segundo toque ("Tem certeza?") antes de ir ao público.
// `when` ("dia 28/10 às 18h"): peça do Vault planejada pra um dia futuro — aprovar AGENDA em vez de publicar já.
export async function pendingKeyboard(kind: ButtonKind, id: string, chatId: number | string, when?: string | null) {
  const approveLabel = kind === 'v' ? (when ? `✅ Aprovar (sai ${when})` : '✅ Publicar') : '✅ Aprovar'
  const row1 = [{ text: approveLabel, callback_data: await signButton(kind, 'A', id, chatId) }]
  if (kind === 'a') row1.push({ text: '❌ Recusar', callback_data: await signButton(kind, 'R', id, chatId) })
  return { inline_keyboard: [row1, [{ text: '👀 Ver no painel', url: PANEL_LINKS[kind] }]] }
}

export async function confirmKeyboard(kind: ButtonKind, id: string, chatId: number | string, when?: string | null) {
  const yes = kind === 'v' ? (when ? `✅ Sim, agendar pro ${when}` : '✅ Sim, publicar agora') : '✅ Sim, pode enviar'
  return {
    inline_keyboard: [[
      { text: yes, callback_data: await signButton(kind, 'Y', id, chatId) },
      { text: '↩️ Voltar', callback_data: await signButton(kind, 'B', id, chatId) },
    ]],
  }
}

export async function tg(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; result?: unknown; description?: string }> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!token) return { ok: false, description: 'TELEGRAM_BOT_TOKEN ausente' }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({})) as { ok?: boolean; result?: unknown; description?: string }
    if (!data.ok) console.error(`Telegram ${method} falhou:`, res.status, data.description)
    return { ok: !!data.ok, result: data.result, description: data.description }
  } catch (e) {
    console.error(`Telegram ${method} erro:`, e)
    return { ok: false, description: String(e) }
  }
}

export function brazilHour(): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hourCycle: 'h23' }).format(new Date()))
}

// O telegram-buddy vai avisar esta empresa AGORA? (opt-in, conversa
// privada, interruptores ligados e fora do silêncio 22h–8h). O
// hermes-lead-alert usa isso pra não deixar lead sem aviso nem avisar 2x.
// deno-lint-ignore no-explicit-any
export async function buddyDeliversNow(admin: any, prefs: Record<string, unknown> | null | undefined, chatId: unknown): Promise<boolean> {
  if (prefs?.telegram_buddy !== true || !(Number(chatId) > 0)) return false
  const h = brazilHour()
  if (h >= 22 || h < 8) return false
  const [{ data: flag }, { data: cfg }] = await Promise.all([
    admin.from('feature_flags').select('enabled').eq('key', 'telegram_buddy').maybeSingle(),
    admin.from('report_config').select('telegram_enabled').eq('id', true).maybeSingle(),
  ])
  return !(flag && flag.enabled === false) && !(cfg && cfg.telegram_enabled === false)
}
