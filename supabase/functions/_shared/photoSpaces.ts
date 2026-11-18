// Frente 1, item 1.1 (17/11): AMBIENTES FÍSICOS do imóvel — agrupa as fotos do MESMO ambiente ("Quarto 2" ≠ "Quarto 3").
// Hoje o tour pensa em TIPO de cômodo (photoScore: "quarto", "sala"…): 4 quartos viram "quarto" e ambientes inteiros somem
// do tour sem aviso (PLANO-TOUR-COMPLETO §1, problema 1). Aqui a IA de visão vê TODAS as fotos de uma vez e devolve os
// ambientes. Uma vez por conjunto de fotos (guardado em meta.spaces); muda a lista de fotos → refaz. Nada é inventado:
// foto que a IA não pôs em lugar nenhum vira um ambiente próprio marcado "incerto".
// Parte pura (prompt, leitura da resposta, comparação) testada em scripts/test-photo-spaces.mjs.
import { anthropicCostUsd, breakdownOf, logAiCost, totalTokens, type Usage } from './aiCost.ts'

export const SPACES_MODEL = 'claude-sonnet-5-5'
export const SPACES_VERSION = 1
export const MAX_SPACE_PHOTOS = 60 // um imóvel grande tem ~50; acima disso não manda (custo e limite de imagens por chamada)
const AREAS = ['social', 'intima', 'lazer', 'servico', 'externa'] as const
export type Area = typeof AREAS[number]

export interface PhotoSpace {
  key: string            // "s1", "s2"… (estável dentro de uma rodada)
  label: string          // "Quarto 2 (cabeceira cinza)"
  room: string           // tipo da ficha (config.tour.rooms) ou "outro"
  area: Area
  photos: number[]       // índices em meta.photos
  uncertain: boolean     // a IA não tem certeza de que é um ambiente separado / que as fotos são do mesmo ambiente
}
export interface SpacesResult { v: number; sig: string; spaces: PhotoSpace[]; at: string; model: string; cost_usd?: number }

/** Assinatura do conjunto de fotos (ordem importa: os índices apontam para meta.photos). */
export function photosSig(urls: string[]): string {
  let h = 2166136261
  for (const ch of urls.join('\n')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0 }
  return `${urls.length}:${h.toString(16)}`
}

export function spacesPrompt(n: number, rooms: { key: string; label: string }[]): string {
  const roomList = rooms.length ? rooms.map(r => `"${r.key}" (${r.label})`).join(', ') : '"outro"'
  return `Acima estão ${n} fotos REAIS de UM imóvel, numeradas de 0 a ${n - 1}. Agrupe as fotos por AMBIENTE FÍSICO: fotos do mesmo cômodo (mesmo quarto, mesmo banheiro, mesma sala), mesmo que de ângulos diferentes, ficam juntas; cômodos diferentes do mesmo tipo (quarto 2 e quarto 3) ficam SEPARADOS.
Compare móveis, revestimentos, janelas, cores, objetos e o que se vê pela janela para decidir. Não invente ambiente que não aparece.
Para cada ambiente:
- "label": nome curto em português com o detalhe que o diferencia (ex.: "Quarto 2 (cabeceira cinza)", "Banheiro da suíte"). NUNCA use nome de pessoa, mesmo que apareça escrito na foto (ex.: nome na parede ou na porta): diga "Quarto 2", "Quarto 3";
- "room": o tipo, uma chave desta lista: ${roomList}; se nenhuma servir, "outro";
- "area": "social", "intima", "lazer", "servico" ou "externa";
- "photos": os números das fotos;
- "uncertain": true se você não tem certeza de que é um ambiente separado de outro ou de que todas essas fotos são dele.
Toda foto entra em exatamente um ambiente.
Pense primeiro, em poucas linhas. Termine com UMA linha só com o JSON: {"spaces":[{"label":"...","room":"...","area":"...","photos":[0,1],"uncertain":false}]}`
}

/** Lê a resposta da IA. Índice fora do intervalo/repetido é ignorado; foto sem ambiente vira ambiente "incerto" próprio. */
export function parseSpaces(text: string, n: number, roomKeys: string[]): PhotoSpace[] | null {
  const lines = String(text ?? '').split('\n').map(l => l.trim()).filter(l => l.startsWith('{') && l.includes('"spaces"'))
  const raw = lines.length ? lines[lines.length - 1] : (/\{[\s\S]*"spaces"[\s\S]*\}/.exec(String(text ?? ''))?.[0] ?? '')
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return null }
  const list = (parsed as { spaces?: unknown })?.spaces
  if (!Array.isArray(list)) return null
  const keys = new Set(roomKeys)
  const used = new Set<number>()
  const out: PhotoSpace[] = []
  for (const s of list) {
    if (!s || typeof s !== 'object') continue
    const o = s as Record<string, unknown>
    const photos = (Array.isArray(o.photos) ? o.photos : []).map(Number).filter(i => Number.isInteger(i) && i >= 0 && i < n && !used.has(i))
    if (!photos.length) continue
    photos.forEach(i => used.add(i))
    const room = typeof o.room === 'string' && keys.has(o.room) ? o.room : 'outro'
    const area = (AREAS as readonly string[]).includes(String(o.area)) ? String(o.area) as Area : 'social'
    const label = String(o.label ?? '').replace(/\s+/g, ' ').trim().slice(0, 60) || room
    out.push({ key: '', label, room, area, photos: [...new Set(photos)].sort((a, b) => a - b), uncertain: o.uncertain === true })
  }
  for (let i = 0; i < n; i++) if (!used.has(i)) out.push({ key: '', label: `Foto ${i} (sem ambiente)`, room: 'outro', area: 'social', photos: [i], uncertain: true })
  out.sort((a, b) => AREAS.indexOf(a.area) - AREAS.indexOf(b.area) || a.photos[0] - b.photos[0])
  return out.map((s, k) => ({ ...s, key: `s${k + 1}` }))
}

/**
 * Concordância entre dois agrupamentos (para conferir com a tabela feita à mão): para cada PAR de fotos, os dois dizem
 * "mesmo ambiente" ou "ambientes diferentes"? precision = dos pares que a IA juntou, quantos estão juntos na tabela;
 * recall = dos pares juntos na tabela, quantos a IA juntou. Fotos fora da tabela não contam.
 */
export function compareSpaces(got: number[][], expected: number[][]): { precision: number; recall: number; pairsGot: number; pairsExpected: number } {
  const groupOf = (gs: number[][]) => { const m = new Map<number, number>(); gs.forEach((g, k) => g.forEach(i => m.set(i, k))); return m }
  const G = groupOf(got), E = groupOf(expected)
  const ids = [...E.keys()].filter(i => G.has(i)).sort((a, b) => a - b)
  let tp = 0, gotPairs = 0, expPairs = 0
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
    const sg = G.get(ids[a]) === G.get(ids[b]), se = E.get(ids[a]) === E.get(ids[b])
    if (sg) gotPairs++
    if (se) expPairs++
    if (sg && se) tp++
  }
  return { precision: gotPairs ? tp / gotPairs : 1, recall: expPairs ? tp / expPairs : 1, pairsGot: gotPairs, pairsExpected: expPairs }
}

// deno-lint-ignore no-explicit-any
type Admin = any

/**
 * Ambientes do imóvel: devolve o que está guardado (mesmas fotos, mesma versão) ou pergunta à IA uma vez e grava em
 * meta.spaces. Sem chave, sem fotos ou falha da IA → null (quem chama segue com os tipos de cômodo, como antes).
 */
export async function ensureSpaces(admin: Admin, anthropicKey: string, companyId: string, itemId: string, rooms: { key: string; label: string }[], opts: { force?: boolean } = {}): Promise<SpacesResult | null> {
  const { data: item } = await admin.from('marketing_ai_knowledge').select('meta').eq('id', itemId).eq('company_id', companyId).eq('kind', 'product').maybeSingle()
  // Os números das fotos são os índices de meta.photos: se alguma foto não tem URL válida, não arrisca desalinhar.
  const all = ((item?.meta?.photos ?? []) as { url?: string }[]).map(p => String(p?.url ?? ''))
  const urls = all.filter(u => /^https:\/\//.test(u))
  if (urls.length !== all.length || urls.length < 2 || urls.length > MAX_SPACE_PHOTOS || !anthropicKey) return null
  const sig = photosSig(urls)
  const cached = item?.meta?.spaces as SpacesResult | undefined
  if (!opts.force && cached?.v === SPACES_VERSION && cached.sig === sig && Array.isArray(cached.spaces)) return cached
  const t0 = Date.now()
  const content: unknown[] = []
  urls.forEach((u, i) => { content.push({ type: 'text', text: `FOTO ${i}:` }, { type: 'image', source: { type: 'url', url: u } }) })
  content.push({ type: 'text', text: spacesPrompt(urls.length, rooms) })
  let usage: Usage | null = null, text = '', error: string | null = null
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: SPACES_MODEL, max_tokens: 6000, output_config: { effort: 'medium' }, messages: [{ role: 'user', content }] }),
      signal: AbortSignal.timeout(140_000),
    })
    if (!res.ok) { error = `IA recusou (${res.status}): ${(await res.text()).slice(0, 200)}` }
    else {
      const data = await res.json()
      usage = data.usage ?? null
      text = (Array.isArray(data.content) ? data.content : []).filter((b: { type?: string }) => b?.type === 'text').map((b: { text?: string }) => b.text ?? '').join('\n')
    }
  } catch (e) { error = String(e).slice(0, 200) }
  const costUsd = anthropicCostUsd(SPACES_MODEL, usage)
  const spaces = text ? parseSpaces(text, urls.length, rooms.map(r => r.key)) : null
  await logAiCost(admin, { companyId, role: 'tour', taskKey: 'ai_vision_spaces', description: `Ambientes do imóvel (${urls.length} fotos)`, tokens: totalTokens(breakdownOf(usage)), costUsd, latencyMs: Date.now() - t0, success: !!spaces, error: spaces ? null : (error ?? 'resposta sem JSON válido'), breakdown: breakdownOf(usage), trigger: 'manual' }).catch(() => {})
  if (!spaces) { console.error('photoSpaces: sem ambientes', error ?? text.slice(-300)); return null }
  const result: SpacesResult = { v: SPACES_VERSION, sig, spaces, at: new Date().toISOString(), model: SPACES_MODEL, cost_usd: Math.round(costUsd * 10000) / 10000 }
  try {
    const { data: cur } = await admin.from('marketing_ai_knowledge').select('meta').eq('id', itemId).eq('company_id', companyId).maybeSingle()
    const meta = (cur?.meta ?? {}) as Record<string, unknown>
    // Só grava se as fotos não mudaram enquanto a IA pensava (senão os índices não valem mais).
    const now = ((meta.photos ?? []) as { url?: string }[]).map(p => String(p?.url ?? '')).filter(u => /^https:\/\//.test(u))
    if (photosSig(now) === sig) await admin.from('marketing_ai_knowledge').update({ meta: { ...meta, spaces: result } }).eq('id', itemId).eq('company_id', companyId)
  } catch (e) { console.error('photoSpaces: gravar falhou (usa só nesta rodada)', String(e).slice(0, 200)) }
  return result
}
