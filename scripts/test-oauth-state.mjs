// Roda: node --experimental-strip-types scripts/test-oauth-state.mjs
// N1 (2026-11-11): segurança das conexões OAuth — state assinado, preso à empresa + dono + provedor, 15 min.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { signState, verifyState, STATE_TTL_MS, STATE_ERROR } from '../supabase/functions/_shared/oauthState.ts'

let n = 0
const t = async (name, fn) => { await fn(); n++; console.log('ok -', name) }
const SECRET = 'segredo-de-teste'
const A = { companyId: '277305ff-0dce-48c6-b7ef-69f40ae55d76', userId: 'aaaaaaaa-0000-4000-8000-000000000001', provider: 'instagram' }
const NOW = Date.parse('2026-11-11T15:00:00Z')

await t('assina e confere: volta a empresa, o dono e o provedor', async () => {
  const s = await signState(SECRET, A, NOW)
  assert.match(s, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)   // só caracteres seguros pra URL
  const r = await verifyState(SECRET, s, 'instagram', NOW + 60_000)
  assert.ok(r.ok); assert.equal(r.payload.c, A.companyId); assert.equal(r.payload.u, A.userId)
})
await t('ATAQUE: trocar a empresa dentro do state quebra a assinatura', async () => {
  const s = await signState(SECRET, A, NOW)
  const [body, sig] = s.split('.')
  const json = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
  json.c = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
  const forged = Buffer.from(JSON.stringify(json)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  assert.deepEqual(await verifyState(SECRET, `${forged}.${sig}`, 'instagram', NOW), { ok: false, reason: 'bad_signature' })
})
await t('ATAQUE: o state antigo sem assinatura (btoa({company_id})) é recusado', async () => {
  const old = Buffer.from(JSON.stringify({ company_id: A.companyId, ts: NOW })).toString('base64')
  assert.equal((await verifyState(SECRET, old, 'instagram', NOW)).ok, false)
})
await t('ATAQUE: assinado com outro segredo é recusado', async () => {
  const s = await signState('outro-segredo', A, NOW)
  assert.equal((await verifyState(SECRET, s, 'instagram', NOW)).reason, 'bad_signature')
})
await t('state de um provedor não serve pra outro (Instagram × WhatsApp × Anúncios)', async () => {
  const s = await signState(SECRET, A, NOW)
  assert.equal((await verifyState(SECRET, s, 'meta_ads', NOW)).reason, 'wrong_provider')
  assert.equal((await verifyState(SECRET, s, 'meta_business', NOW)).reason, 'wrong_provider')
})
await t('vale 15 minutos; vencido ou do futuro é recusado', async () => {
  const s = await signState(SECRET, A, NOW)
  assert.ok((await verifyState(SECRET, s, 'instagram', NOW + STATE_TTL_MS - 1)).ok)
  assert.equal((await verifyState(SECRET, s, 'instagram', NOW + STATE_TTL_MS + 1)).reason, 'expired')
  const future = await signState(SECRET, A, NOW + 10 * 60_000)
  assert.equal((await verifyState(SECRET, future, 'instagram', NOW)).reason, 'expired')
})
await t('lixo, vazio, pedaço a mais e segredo ausente são recusados', async () => {
  for (const bad of [null, '', 'a', 'a.b.c', 'x'.repeat(700), '%%%.###']) assert.equal((await verifyState(SECRET, bad, 'instagram', NOW)).ok, false, String(bad).slice(0, 20))
  assert.equal((await verifyState('', await signState(SECRET, A, NOW), 'instagram', NOW)).ok, false)
  await assert.rejects(() => signState('', A, NOW))
})
await t('dois links da mesma empresa nunca são iguais (nonce)', async () => {
  assert.notEqual(await signState(SECRET, A, NOW), await signState(SECRET, A, NOW))
})
await t('as 3 funções de início exigem login (POST) e assinam; o link antigo (GET ?company_id=) não funciona', async () => {
  for (const [fn, prov] of [['instagram-oauth-start', 'instagram'], ['meta-business-oauth-start', 'meta_business'], ['meta-ads-oauth-start', 'meta_ads']]) {
    const src = readFileSync(new URL(`../supabase/functions/${fn}/index.ts`, import.meta.url), 'utf8')
    assert.match(src, /if \(req\.method !== 'POST'\) return json/, fn)
    assert.match(src, /await ownerOfCompany\(req, createClient, body\.company_id\)/, fn)
    assert.match(src, new RegExp(`provider: '${prov}'`), fn)
    assert.doesNotMatch(src, /btoa\(JSON\.stringify\(\{ company_id/, fn)
    assert.doesNotMatch(src, /searchParams\.get\('company_id'\)/, fn)
  }
})
await t('as 3 voltas conferem assinatura, provedor, prazo e se a empresa ainda é do mesmo dono', async () => {
  for (const [fn, prov] of [['instagram-oauth-callback', 'instagram'], ['meta-business-oauth-callback', 'meta_business'], ['meta-ads-oauth-callback', 'meta_ads']]) {
    const src = readFileSync(new URL(`../supabase/functions/${fn}/index.ts`, import.meta.url), 'utf8')
    assert.match(src, new RegExp(`verifyState\\(stateSecret\\(\\), state, '${prov}'\\)`), fn)
    assert.match(src, /stillOwner\(/, fn)
    assert.doesNotMatch(src, /atob\(state\)/, fn)
  }
})
await t('Instagram: mesmo endereço de volta no início e na troca do código', async () => {
  const a = readFileSync(new URL('../supabase/functions/instagram-oauth-start/index.ts', import.meta.url), 'utf8')
  const b = readFileSync(new URL('../supabase/functions/instagram-oauth-callback/index.ts', import.meta.url), 'utf8')
  const expr = /Deno\.env\.get\('INSTAGRAM_REDIRECT_URI'\) \|\| `\$\{[^}]+\}\/functions\/v1\/instagram-oauth-callback`/
  assert.match(a, expr); assert.match(b, expr)
})
await t('Google (Meu Negócio e Search Console): só grava na empresa de quem está logado', async () => {
  for (const fn of ['gbp-oauth-callback', 'gsc-oauth-callback']) {
    const src = readFileSync(new URL(`../supabase/functions/${fn}/index.ts`, import.meta.url), 'utf8')
    assert.match(src, /\.eq\('id', company_id\)\.eq\('user_id', user\.id\)\.maybeSingle\(\)/, fn)
    assert.match(src, /if \(!owned\) return json\(\{ error: .* \}, 403\)/, fn)
  }
})
await t('tela: nenhum link direto de início de conexão sobrou', async () => {
  const src = readFileSync(new URL('../src/pages/dashboard/settings/IntegrationsTab.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /oauth-start\?company_id=/)
  assert.equal((src.match(/onClick=\{connectOAuth\('/g) ?? []).length, 4)
  assert.ok(STATE_ERROR.expired.includes('15 minutos'))
})
console.log(`\n${n} verificações ok`)
