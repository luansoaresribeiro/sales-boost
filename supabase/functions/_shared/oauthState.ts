// Segurança das conexões OAuth (N1, autorizado pelo dono em 2026-11-11). Antes, o `state` era só
// btoa({company_id, ts}) — sem assinatura, sem dono, sem validade — e o início da conexão era um link sem login:
// quem soubesse o id de uma empresa ligava o PRÓPRIO Instagram/WhatsApp/Anúncios nela.
//
// Agora:
//  - o início exige o login do dono e confere que a empresa é dele (`ownerOfCompany`);
//  - o `state` é assinado pelo servidor (HMAC-SHA256), preso à empresa, ao usuário e ao provedor, e vale 15 min;
//  - a volta (callback) confere assinatura, provedor, prazo e se a empresa continua sendo do mesmo usuário.
// A parte de assinatura é PURA (testada em Node: scripts/test-oauth-state.mjs); a chave vem do segredo do servidor.

export type OAuthProvider = 'instagram' | 'meta_business' | 'meta_ads'
export interface StatePayload { c: string; u: string; p: OAuthProvider; t: number; n: string }

export const STATE_TTL_MS = 15 * 60_000
const enc = new TextEncoder()

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
  return Uint8Array.from(b, ch => ch.charCodeAt(0))
}

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(`oauth-state:v1:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
}

/** Comparação em tempo constante (não vaza quanto da assinatura bateu). */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]
  return d === 0
}

export async function signState(secret: string, p: { companyId: string; userId: string; provider: OAuthProvider }, now = Date.now()): Promise<string> {
  if (!secret) throw new Error('segredo do servidor ausente')
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(9)))
  const body = b64url(enc.encode(JSON.stringify({ c: p.companyId, u: p.userId, p: p.provider, t: now, n: nonce } satisfies StatePayload)))
  return `${body}.${b64url(await hmac(secret, body))}`
}

export type StateCheck = { ok: true; payload: StatePayload } | { ok: false; reason: 'malformed' | 'bad_signature' | 'wrong_provider' | 'expired' }

export async function verifyState(secret: string, state: unknown, provider: OAuthProvider, now = Date.now(), ttl = STATE_TTL_MS): Promise<StateCheck> {
  if (!secret || typeof state !== 'string' || state.length > 600) return { ok: false, reason: 'malformed' }
  const [body, sig, extra] = state.split('.')
  if (!body || !sig || extra !== undefined) return { ok: false, reason: 'malformed' }
  let given: Uint8Array
  try { given = fromB64url(sig) } catch { return { ok: false, reason: 'malformed' } }
  if (!sameBytes(given, await hmac(secret, body))) return { ok: false, reason: 'bad_signature' }
  let payload: StatePayload
  try { payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) } catch { return { ok: false, reason: 'malformed' } }
  if (!payload || typeof payload.c !== 'string' || typeof payload.u !== 'string' || typeof payload.t !== 'number') return { ok: false, reason: 'malformed' }
  if (payload.p !== provider) return { ok: false, reason: 'wrong_provider' }
  if (now - payload.t > ttl || payload.t - now > 60_000) return { ok: false, reason: 'expired' }
  return { ok: true, payload }
}

export const STATE_ERROR: Record<Exclude<StateCheck, { ok: true }>['reason'] | 'not_owner', string> = {
  malformed: 'Link de conexão inválido. Volte em Configurações → Conexões e clique em Conectar de novo.',
  bad_signature: 'Link de conexão inválido. Volte em Configurações → Conexões e clique em Conectar de novo.',
  wrong_provider: 'Link de conexão inválido. Volte em Configurações → Conexões e clique em Conectar de novo.',
  expired: 'O link de conexão expirou (vale 15 minutos). Clique em Conectar de novo.',
  not_owner: 'Esta empresa não é da sua conta. Nada foi conectado.',
}

/** Segredo do servidor usado na assinatura (só existe nas Edge Functions, nunca na tela). */
export const stateSecret = (): string => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

/**
 * Início da conexão: confere o login (JWT do dono) e que a empresa é dele. Devolve o usuário ou o erro pronto pra
 * responder. Usa a chave pública pra ler o usuário e a de serviço pra ler a empresa.
 */
// deno-lint-ignore no-explicit-any
export async function ownerOfCompany(req: Request, createClient: (...a: any[]) => any, companyId: unknown): Promise<{ userId: string; companyId: string } | { status: number; error: string }> {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return { status: 401, error: 'Entre na sua conta para conectar.' }
  if (typeof companyId !== 'string' || !/^[0-9a-f-]{36}$/i.test(companyId)) return { status: 400, error: 'company_id inválido.' }
  const url = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return { status: 401, error: 'Entre na sua conta para conectar.' }
  const admin = createClient(url, stateSecret())
  const { data: co } = await admin.from('companies').select('id, user_id').eq('id', companyId).maybeSingle()
  if (!co || co.user_id !== user.id) return { status: 403, error: STATE_ERROR.not_owner }
  return { userId: user.id, companyId }
}

/** Na volta: a empresa ainda é do mesmo usuário que pediu a conexão? */
// deno-lint-ignore no-explicit-any
export async function stillOwner(admin: any, payload: StatePayload): Promise<boolean> {
  const { data: co } = await admin.from('companies').select('user_id').eq('id', payload.c).maybeSingle()
  return !!co && co.user_id === payload.u
}
