// Fotos de LIGAÇÃO do tour (dono, 2026-11-11). O teste do imóvel inteiro mostrou que a caminhada só fica fiel quando
// as duas fotos mostram uma ligação real (porta, abertura, escada). Sem ela, a IA de vídeo inventa o caminho (regra 4).
// Antes de gerar, uma IA de visão olha cada par de fotos vizinhas e diz se a ligação aparece. Se não aparecer, a tela
// diz qual foto falta ("falta foto da escada") e só gera com o "gerar mesmo assim" do dono.
//
// A parte de texto é PURA (testada em Node: scripts/test-tour-order.mjs). O resultado fica guardado no meta do imóvel
// (`meta.passage_checks[chave do par]`), então cada par só é conferido uma vez (~US$ 0,01 por par, Sonnet 5.5).
//
// v3: ver decidePassage. v2 (2026-11-11, depois do 1º uso real na Tespon): a v1 (Haiku 4.5, pergunta direta) errou o caso que importa — disse
// "ligação visível" de um salão de jogos no andar de cima para a sala de baixo (a escada só aparece na foto de destino),
// e disse "falta porta" num terraço com a porta de vidro aparecendo. A v2 pede para DESCREVER as duas fotos antes de
// decidir (andar, piso, aberturas), aceita a abertura visível em qualquer uma das fotos no mesmo andar, e só aceita troca
// de andar com a escada visível na FOTO 1. Resultado guardado com `v` — checagem de versão antiga é refeita.

export type Linked = 'yes' | 'no' | 'unsure'
export type Missing = 'escada' | 'porta' | 'abertura' | null
export interface PassageCheck { linked: Linked; missing: Missing; checked_at?: string; v?: number }

const MODEL = 'claude-sonnet-5-5'
/** Versão da pergunta. Resultado guardado com outra versão (ou sem) é perguntado de novo. */
export const CHECK_VERSION = 3
export const isCurrent = (c: PassageCheck | null | undefined): c is PassageCheck => !!c && c.v === CHECK_VERSION
export const MAX_PAIRS_PER_CALL = 15

/** Chave do par, curta e estável (a ordem importa: A → B). */
export function pairKey(a: string, b: string): string {
  const tail = (u: string) => u.split('?')[0].split('/').pop() ?? u
  return `${tail(a)}>${tail(b)}`.slice(0, 200)
}

export function parsePassageCheck(raw: string): PassageCheck | null {
  let o: Record<string, unknown> | null = null
  try { o = JSON.parse(raw) } catch {
    // A resposta pode trazer a descrição antes; vale o ÚLTIMO objeto que tenha "linked".
    const all = raw.match(/\{[^{}]*"linked"[^{}]*\}/g)
    const m = all?.[all.length - 1] ?? raw.match(/\{[\s\S]*\}/)?.[0]
    if (m) { try { o = JSON.parse(m) } catch { /* */ } }
  }
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

// v3 (2026-11-11): a IA só relata FATOS das duas fotos; quem decide é a regra abaixo (pura, testada). Motivo: na v2 a IA
// decidindo sozinha ficou rígida demais (bloqueou hall → quarto e quarto → banheiro, que saíram ✅ no vídeo real, e
// nunca disse "ligação visível"). O vídeo real da Tespon mostrou que só dois tipos de passagem dão errado: troca de
// andar sem a escada na foto de saída, e de fora para dentro sem a porta aparecer. Dentro de casa, no mesmo andar, a
// caminhada saiu fiel em 5 de 5 — então essa passa.
export type Tri = 'yes' | 'no' | 'unsure'
export interface PassageFacts { outside1: Tri; outside2: Tri; sameFloor: Tri; stairsInPhoto1: Tri; doorBetweenVisible: Tri }

const tri = (v: unknown): Tri => { const s = String(v ?? '').toLowerCase(); return s === 'yes' || s === 'sim' || s === 'true' ? 'yes' : s === 'no' || s === 'nao' || s === 'não' || s === 'false' ? 'no' : 'unsure' }

export function parseFacts(raw: string): PassageFacts | null {
  const all = raw.match(/\{[^{}]*"same_floor"[^{}]*\}/g)
  const m = all?.[all.length - 1]
  if (!m) return null
  try {
    const o = JSON.parse(m) as Record<string, unknown>
    return { outside1: tri(o.photo1_outside), outside2: tri(o.photo2_outside), sameFloor: tri(o.same_floor), stairsInPhoto1: tri(o.stairs_in_photo1), doorBetweenVisible: tri(o.door_between_visible) }
  } catch { return null }
}

/** A regra que decide a passagem a partir dos fatos. */
export function decidePassage(f: PassageFacts): Omit<PassageCheck, 'checked_at' | 'v'> {
  const out1 = f.outside1 === 'yes', out2 = f.outside2 === 'yes'
  // De fora para dentro (ou o contrário): a porta/vão entre os dois precisa aparecer numa das fotos.
  if (out1 !== out2 && (f.outside1 !== 'unsure' && f.outside2 !== 'unsure')) {
    return f.doorBetweenVisible === 'yes' ? { linked: 'yes', missing: null } : f.doorBetweenVisible === 'no' ? { linked: 'no', missing: 'porta' } : { linked: 'unsure', missing: 'porta' }
  }
  // Troca de andar: só com a escada visível na foto de onde a câmera sai.
  if (f.sameFloor === 'no') return f.stairsInPhoto1 === 'yes' ? { linked: 'yes', missing: null } : { linked: 'no', missing: 'escada' }
  if (f.sameFloor === 'unsure') return { linked: 'unsure', missing: f.stairsInPhoto1 === 'yes' ? null : 'escada' }
  // Mesmo andar, os dois dentro (ou os dois fora): a caminhada saiu fiel no teste real.
  if (out1 && out2) return { linked: 'unsure', missing: 'abertura' }
  return { linked: 'yes', missing: null }
}

const PROMPT = `São duas fotos REAIS do mesmo imóvel. Responda só sobre o que se VÊ nelas.
Primeiro descreva em poucas linhas cada foto: o ambiente, se é dentro ou fora (área externa, piscina, terraço e varanda descoberta são "fora"), e as portas, vãos, portas de vidro e escadas que aparecem.
Depois responda:
- photo1_outside / photo2_outside: a foto é de fora?
- same_floor: os dois ambientes estão no mesmo andar? Piso de material diferente NÃO basta para dizer "no" (casas misturam piso). Diga "no" só com sinal claro: uma escada que sobe ou desce entre eles, vista de outra altura, ou um ambiente claramente de outro andar. Sem sinal claro, "yes".
- stairs_in_photo1: a FOTO 1 mostra uma escada?
- door_between_visible: quando uma foto é de fora e a outra de dentro, alguma das duas mostra a porta, porta de vidro ou vão que liga os dois? (senão, "unsure")
Termine com UMA linha só com o JSON: {"photo1_outside":"yes|no","photo2_outside":"yes|no","same_floor":"yes|no|unsure","stairs_in_photo1":"yes|no","door_between_visible":"yes|no|unsure"}`

// deno-lint-ignore no-explicit-any
type Admin = any

async function askPair(anthropicKey: string, a: string, b: string): Promise<PassageCheck | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, output_config: { effort: 'medium' }, messages: [{ role: 'user', content: [
        { type: 'text', text: 'FOTO 1:' }, { type: 'image', source: { type: 'url', url: a } },
        { type: 'text', text: 'FOTO 2:' }, { type: 'image', source: { type: 'url', url: b } },
        { type: 'text', text: PROMPT },
      ] }] }),
      signal: AbortSignal.timeout(90_000),
    })
    if (!res.ok) { console.error('passageCheck: IA recusou', res.status); await res.body?.cancel(); return null }
    const data = await res.json()
    if (data.stop_reason === 'refusal') return null
    // Com o raciocínio ligado, o 1º bloco pode ser de "thinking": junta só os blocos de texto.
    const text = (Array.isArray(data.content) ? data.content : []).filter((b: { type?: string }) => b?.type === 'text').map((b: { text?: string }) => b.text ?? '').join('\n')
    const facts = parseFacts(text)
    return facts ? decidePassage(facts) : parsePassageCheck(text)
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
  const out: (PassageCheck | null)[] = pairs.map(([a, b]) => { const c = cache[pairKey(a, b)]; return isCurrent(c) ? c : null })
  const todo = pairs.map((p, i) => ({ p, i })).filter(x => !out[x.i]).slice(0, MAX_PAIRS_PER_CALL)
  if (todo.length && anthropicKey) {
    const fresh = await Promise.all(todo.map(x => askPair(anthropicKey, x.p[0], x.p[1])))
    const stamp = new Date().toISOString()
    const add: Record<string, PassageCheck> = {}
    todo.forEach((x, k) => { const r = fresh[k]; if (r) { const v = { ...r, checked_at: stamp, v: CHECK_VERSION }; out[x.i] = v; add[pairKey(x.p[0], x.p[1])] = v } })
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
