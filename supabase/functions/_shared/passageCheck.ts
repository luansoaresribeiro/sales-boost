// Fotos de LIGAÇÃO do tour (dono, 2026-11-11). O teste do imóvel inteiro mostrou que a caminhada só fica fiel quando
// as duas fotos mostram uma ligação real (porta, abertura, escada). Sem ela, a IA de vídeo inventa o caminho (regra 4).
// Antes de gerar, uma IA de visão olha cada par de fotos vizinhas e diz se a ligação aparece. Se não aparecer, a tela
// diz qual foto falta ("falta foto da escada") e só gera com o "gerar mesmo assim" do dono.
//
// A parte de texto é PURA (testada em Node: scripts/test-tour-order.mjs). O resultado fica guardado no meta do imóvel
// (`meta.passage_checks[chave do par]`), então cada par só é conferido uma vez (~US$ 0,005 por par, Haiku 4.5).

export type Linked = 'yes' | 'no' | 'unsure'
export type Missing = 'escada' | 'porta' | 'abertura' | null
export interface PassageCheck { linked: Linked; missing: Missing; checked_at?: string }

const MODEL = 'claude-haiku-4-5-20251001'
export const MAX_PAIRS_PER_CALL = 15

/** Chave do par, curta e estável (a ordem importa: A → B). */
export function pairKey(a: string, b: string): string {
  const tail = (u: string) => u.split('?')[0].split('/').pop() ?? u
  return `${tail(a)}>${tail(b)}`.slice(0, 200)
}

export function parsePassageCheck(raw: string): PassageCheck | null {
  let o: Record<string, unknown> | null = null
  try { o = JSON.parse(raw) } catch { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { o = JSON.parse(m[0]) } catch { /* */ } } }
  if (!o || typeof o !== 'object') return null
  const l = String(o.linked ?? '').toLowerCase()
  const linked: Linked = l === 'yes' || l === 'sim' ? 'yes' : l === 'no' || l === 'nao' || l === 'não' ? 'no' : 'unsure'
  const m = String(o.missing ?? '').toLowerCase()
  const missing: Missing = linked === 'yes' ? null : m.includes('escad') || m.includes('stair') ? 'escada' : m.includes('porta') || m.includes('door') ? 'porta' : m ? 'abertura' : null
  return { linked, missing }
}

/** Passagem bloqueada = a IA de visão disse que a ligação NÃO aparece nas fotos. "Incerto" não bloqueia (fica em amarelo). */
export const blocks = (c: PassageCheck | undefined | null) => c?.linked === 'no'

export const MISSING_LABEL: Record<NonNullable<Missing>, string> = {
  escada: 'falta foto da escada',
  porta: 'falta foto da porta de entrada',
  abertura: 'falta foto da passagem entre os dois ambientes',
}

const PROMPT = `São duas fotos REAIS do mesmo imóvel. Um vídeo vai levar a câmera da FOTO 1 até a FOTO 2 numa caminhada contínua, sem corte.
Diga se a FOTO 1 mostra de forma visível o caminho até o ambiente da FOTO 2: uma porta aberta, um vão, uma passagem, uma porta de vidro ou uma escada que levaria até lá.
Se os dois ambientes parecem estar em andares diferentes e não aparece escada, a resposta é "no" com missing "escada".
Se a FOTO 1 é de fora (área externa, varanda, piscina) e não aparece a porta para entrar, a resposta é "no" com missing "porta".
Responda SÓ em JSON: {"linked":"yes|no|unsure","missing":"escada|porta|abertura|"}`

// deno-lint-ignore no-explicit-any
type Admin = any

async function askPair(anthropicKey: string, a: string, b: string): Promise<PassageCheck | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 120, messages: [{ role: 'user', content: [
        { type: 'text', text: 'FOTO 1:' }, { type: 'image', source: { type: 'url', url: a } },
        { type: 'text', text: 'FOTO 2:' }, { type: 'image', source: { type: 'url', url: b } },
        { type: 'text', text: PROMPT },
      ] }] }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) { console.error('passageCheck: IA recusou', res.status); await res.body?.cancel(); return null }
    const data = await res.json()
    return parsePassageCheck(String(data.content?.[0]?.text ?? ''))
  } catch (e) { console.error('passageCheck: falhou', String(e).slice(0, 200)); return null }
}

/**
 * Confere cada par vizinho da ordem (A→B) e devolve a lista, usando o que já está guardado no imóvel. Pares novos
 * são perguntados à IA de visão (no máximo MAX_PAIRS_PER_CALL) e gravados. Falha da IA = 'unsure' (não bloqueia, mas
 * também não diz "ligação visível").
 */
export async function checkPassages(admin: Admin, anthropicKey: string, companyId: string, itemId: string, photos: string[]): Promise<PassageCheck[]> {
  const pairs = photos.slice(0, -1).map((a, i) => [a, photos[i + 1]] as const)
  const { data: item } = await admin.from('marketing_ai_knowledge').select('meta').eq('id', itemId).eq('company_id', companyId).maybeSingle()
  const cache = ((item?.meta?.passage_checks ?? {}) as Record<string, PassageCheck>)
  const out: PassageCheck[] = pairs.map(([a, b]) => cache[pairKey(a, b)] ?? null) as PassageCheck[]
  const todo = pairs.map((p, i) => ({ p, i })).filter(x => !out[x.i]).slice(0, MAX_PAIRS_PER_CALL)
  if (todo.length && anthropicKey) {
    const fresh = await Promise.all(todo.map(x => askPair(anthropicKey, x.p[0], x.p[1])))
    const stamp = new Date().toISOString()
    const add: Record<string, PassageCheck> = {}
    todo.forEach((x, k) => { const r = fresh[k]; if (r) { const v = { ...r, checked_at: stamp }; out[x.i] = v; add[pairKey(x.p[0], x.p[1])] = v } })
    if (Object.keys(add).length) {
      try {
        const { data: cur } = await admin.from('marketing_ai_knowledge').select('meta').eq('id', itemId).eq('company_id', companyId).maybeSingle()
        const meta = (cur?.meta ?? {}) as Record<string, unknown>
        await admin.from('marketing_ai_knowledge').update({ meta: { ...meta, passage_checks: { ...((meta.passage_checks ?? {}) as object), ...add } } }).eq('id', itemId).eq('company_id', companyId)
      } catch (e) { console.error('passageCheck: gravar falhou (vale só nesta rodada)', String(e).slice(0, 200)) }
    }
  }
  return out.map(c => c ?? { linked: 'unsure', missing: null })
}
