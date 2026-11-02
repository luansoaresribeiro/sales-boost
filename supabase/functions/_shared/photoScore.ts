// Nota das fotos do imóvel para o tour: cômodo + qualidade, por IA de visão
// (Haiku 4.5, mesma ANTHROPIC_API_KEY — ~US$ 0,003 por foto, UMA vez só).
// Fica em marketing_ai_knowledge.meta.photos[i] (room, room_conf, quality,
// scored_at, model), casando pela `url`; sem migration. Foto sem nota (IA
// falhou / JSON inválido) continua sem nota — nunca inventa (tourPick trata como
// último recurso). Os cômodos possíveis vêm da ficha (config.tour.rooms), regra 6.
import { parsePhotoScore, type TourCfg, type TourPhoto } from './tourPick.ts'

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_PER_CALL = 12 // limite por vaga: um imóvel tem poucas fotos; evita lote grande por engano
const URL_OK = /^https:\/\//

// deno-lint-ignore no-explicit-any
type Admin = any
interface MetaPhoto { url: string; path?: string; room?: string | null; room_conf?: number; quality?: number; scored_at?: string; model?: string; [k: string]: unknown }

function promptFor(cfg: TourCfg): string {
  const rooms = cfg.rooms.length ? cfg.rooms.map(r => `"${r.key}" (${r.label})`).join(', ') : ''
  return `Esta é uma foto REAL de um imóvel que será usada como primeiro quadro de um vídeo curto de câmera em movimento. Avalie só o que aparece na imagem; não invente nada.
${rooms ? `1) "room": qual cômodo/ambiente é, escolhendo UMA chave desta lista: ${rooms}. Se não tiver certeza, use "outro" com "room_conf" baixo. "room_conf" = sua confiança de 0 a 1.` : '1) "room": use "outro" e "room_conf": 0.'}
2) "light" (0-100): boa luz natural/equilíbrio, sem estourar nem escurecer.
3) "sharp" (0-100): nitidez, sem tremido nem desfoque.
4) "framing" (0-100): enquadramento bom pra câmera se mover (ambiente legível, sem corte estranho, sem objeto em cima da lente).
5) "quality" (0-100): nota geral da foto pra virar vídeo.
Responda SÓ com JSON: {"room":"...","room_conf":0.0,"light":0,"sharp":0,"framing":0,"quality":0}`
}

async function scoreOne(anthropicKey: string, url: string, cfg: TourCfg): Promise<{ room: string | null; room_conf: number; quality: number } | null> {
  if (!URL_OK.test(url)) return null
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 200, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'url', url } }, { type: 'text', text: promptFor(cfg) }] }] }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) { console.error('photoScore: IA recusou', res.status); await res.body?.cancel(); return null }
    const data = await res.json()
    return parsePhotoScore(String(data.content?.[0]?.text ?? ''), cfg.rooms)
  } catch (e) { console.error('photoScore: falhou', String(e).slice(0, 200)); return null }
}

export const RETRY_AFTER_FAIL_MS = 7 * 86_400_000 // IA falhou numa foto: não tenta de novo por 7 dias (não gasta à toa)
export const hasScore = (p: { quality?: unknown; scored_at?: unknown }) => typeof p.quality === 'number' && !!p.scored_at
/** Precisa pontuar? Sem nota e sem tentativa que falhou nos últimos 7 dias. */
export const needsScore = (p: { quality?: unknown; scored_at?: unknown; score_failed_at?: unknown }, nowMs = Date.now()): boolean => {
  if (hasScore(p)) return false
  const t = typeof p.score_failed_at === 'string' ? Date.parse(p.score_failed_at) : NaN
  return !(Number.isFinite(t) && nowMs - t < RETRY_AFTER_FAIL_MS)
}

/**
 * Devolve as fotos do imóvel com a nota; pontua (uma vez) as que ainda não têm.
 * Gravação: relê a linha logo antes e faz merge por url, só preenchendo foto sem
 * nota (CatalogItems regrava o meta inteiro; isso evita pisar numa edição recente).
 */
export async function ensurePhotoScores(admin: Admin, anthropicKey: string, companyId: string, itemId: string, cfg: TourCfg): Promise<TourPhoto[]> {
  const { data: item } = await admin.from('marketing_ai_knowledge').select('id, meta').eq('id', itemId).eq('company_id', companyId).eq('kind', 'product').maybeSingle()
  const photos = ((item?.meta?.photos ?? []) as MetaPhoto[]).filter(p => p && typeof p.url === 'string' && p.url)
  const todo = photos.filter(p => needsScore(p)).slice(0, MAX_PER_CALL)
  const fresh = new Map<string, { room: string | null; room_conf: number; quality: number }>()
  const failed = new Set<string>()
  if (todo.length) {
    const results = await Promise.all(todo.map(p => scoreOne(anthropicKey, p.url, cfg)))
    todo.forEach((p, i) => { const r = results[i]; if (r) fresh.set(p.url, r); else failed.add(p.url) })
    if (fresh.size || failed.size) {
      try {
        const { data: cur } = await admin.from('marketing_ai_knowledge').select('meta').eq('id', itemId).eq('company_id', companyId).maybeSingle()
        const meta = (cur?.meta ?? {}) as { photos?: MetaPhoto[] }
        const stamp = new Date().toISOString()
        // Falha também é gravada (score_failed_at, sem nota): a mesma foto só é tentada de novo depois de 7 dias.
        const merged = (meta.photos ?? []).map(p => {
          if (!p || hasScore(p)) return p
          if (fresh.has(p.url)) { const { score_failed_at: _f, ...rest } = p; return { ...rest, ...fresh.get(p.url)!, scored_at: stamp, model: MODEL } }
          if (failed.has(p.url)) return { ...p, score_failed_at: stamp, score_error: 'IA não devolveu nota válida', model: MODEL }
          return p
        })
        await admin.from('marketing_ai_knowledge').update({ meta: { ...meta, photos: merged } }).eq('id', itemId).eq('company_id', companyId)
      } catch (e) { console.error('photoScore: gravar nota falhou (usa só nesta rodada)', String(e).slice(0, 200)) }
    }
  }
  return photos.map(p => {
    const f = fresh.get(p.url)
    const src = f ?? (hasScore(p) ? p : null)
    return src ? { url: p.url, room: src.room ?? null, room_conf: src.room_conf ?? 0, quality: src.quality } : { url: p.url }
  })
}
