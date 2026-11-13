// Roda: node --experimental-strip-types scripts/test-telegram-switch.mjs
// Interruptor único do Telegram (dono, 13/11 noite): nenhuma função chama api.telegram.org sem passar por tgFetch.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
globalThis.Deno = { env: { get: () => undefined } }
const { isTelegramOn } = await import('../supabase/functions/_shared/telegramSwitch.ts')
assert.equal(isTelegramOn([]), true)                       // sem a linha = ligado (como sempre foi)
assert.equal(isTelegramOn([{ enabled: true }]), true)
assert.equal(isTelegramOn([{ enabled: false }]), false)
assert.equal(isTelegramOn(null), true)
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [] })
const raw = walk('supabase/functions').filter(p => !p.endsWith('telegramSwitch.ts')).filter(p => /\bfetch\(`https:\/\/api\.telegram\.org/.test(readFileSync(p, 'utf8')))
assert.deepEqual(raw, [], 'chamada ao Telegram fora do interruptor: ' + raw.join(', '))
const wh = readFileSync('supabase/functions/telegram-webhook/index.ts', 'utf8')
assert.match(wh, /if \(!\(await telegramOn\(\)\)\) return json\(\{ ok: true, telegram_off: true \}\)/)
const pm = readFileSync('supabase/functions/platform-monitor/index.ts', 'utf8')
assert.match(pm, /api\.resend\.com\/emails/); assert.ok(!/await sendTelegram\(env\.TELEGRAM_BOT_TOKEN, cfg\.admin_telegram_chat_id, `/.test(pm))
console.log('ok — Telegram passa todo pelo interruptor; webhook para; alerta da plataforma vai por e-mail com o Telegram desligado')
