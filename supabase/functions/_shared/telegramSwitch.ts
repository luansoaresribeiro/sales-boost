// Interruptor único do Telegram (dono, 2026-11-13 noite: "desligar o Telegram hoje", sem apagar nada).
// feature_flags.telegram_enabled = false → nenhuma mensagem sai pro Telegram e o bot não responde quem escreve. Sem a
// linha (ou se a leitura falhar) = ligado, como sempre foi. Religar: UPDATE feature_flags SET enabled = true WHERE
// key = 'telegram_enabled'. O que as funções fazem além de mandar mensagem (relatório, varredura, registro na Atividade)
// continua igual: com o Telegram desligado, `tgFetch` não chama a API e devolve uma resposta de sucesso vazia.

let cache: { at: number; on: boolean } | null = null
const TTL_MS = 60_000

export function isTelegramOn(rows: unknown): boolean {
  return !(Array.isArray(rows) && rows.length > 0 && (rows[0] as { enabled?: unknown }).enabled === false)
}

export async function telegramOn(): Promise<boolean> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.on
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return true
  try {
    const r = await fetch(`${url}/rest/v1/feature_flags?key=eq.telegram_enabled&select=enabled`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
    const on = r.ok ? isTelegramOn(await r.json()) : true
    cache = { at: Date.now(), on }
    return on
  } catch { return true }
}

/** Use no lugar de fetch() em toda chamada a api.telegram.org. */
export async function tgFetch(input: string, init?: RequestInit): Promise<Response> {
  if (await telegramOn()) return fetch(input, init)
  console.log('[telegram desligado] não enviado:', input.replace(/bot[^/]+\//, 'bot***/').slice(0, 80))
  return new Response(JSON.stringify({ ok: true, result: { message_id: 0, telegram_off: true } }), { status: 200, headers: { 'content-type': 'application/json' } })
}
