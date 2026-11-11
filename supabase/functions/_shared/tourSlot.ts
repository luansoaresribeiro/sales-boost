// Cola entre o banco e as funções puras do tour (tourPick/captionGuard): lê a
// ficha (config.tour), junta nota das fotos + histórico do imóvel e planeja a
// semana (corrida entre vagas paralelas: cada vaga já sai com foto/tipo
// decididos). Usado pelo creative-generate (planWeekFromStrategy / runVideoSlot).
import { ensurePhotoScores } from './photoScore.ts'
import { kindForFormat, pickTour, tourCfgFrom, weekKinds, weekNumber, type TourCfg, type TourChoice, type TourKind, type TourPhoto } from './tourPick.ts'

// deno-lint-ignore no-explicit-any
type Admin = any

/** Escolha já feita para uma vaga (viaja dentro do SlotJob). */
export type TourPlan = TourChoice

export async function fetchTourCfg(admin: Admin, verticalKey: string | null): Promise<TourCfg> {
  try {
    const { data } = await admin.from('vertical_playbooks').select('config').eq('key', verticalKey ?? 'generico').eq('enabled', true).maybeSingle()
    return tourCfgFrom(data?.config)
  } catch { return tourCfgFrom(null) }
}

export interface TourContext { photos: TourPhoto[]; recentRooms: string[]; usedPhotos: Set<string> }

/** Fotos com nota (pontua as que faltam) + cômodos dos últimos tours + fotos já usadas em vídeo deste imóvel. */
export async function loadTourContext(admin: Admin, anthropicKey: string, companyId: string, itemId: string, cfg: TourCfg): Promise<TourContext> {
  const [photos, { data: tours }] = await Promise.all([
    ensurePhotoScores(admin, anthropicKey, companyId, itemId, cfg),
    admin.from('video_tours').select('photos, status, created_at').eq('company_id', companyId).eq('item_id', itemId).eq('kind', 'plan').neq('status', 'failed').order('created_at', { ascending: false }).limit(30),
  ])
  const roomOf = new Map(photos.map(p => [p.url, p.room ?? null]))
  const list = (tours ?? []) as { photos: string[] | null }[]
  const usedPhotos = new Set(list.flatMap(t => t.photos ?? []))
  const recentRooms = list.slice(0, Math.max(1, cfg.recent_exclude)).flatMap(t => (t.photos ?? []).map(u => roomOf.get(u) ?? null)).filter((r): r is string => !!r)
  return { photos, recentRooms, usedPhotos }
}

/** Decide foto(s)+tipo de UMA vaga (peça avulsa ou vaga sem plano prévio). */
export async function chooseTour(admin: Admin, anthropicKey: string, companyId: string, itemId: string, format: string | undefined, cfg: TourCfg): Promise<TourPlan | null> {
  const ctx = await loadTourContext(admin, anthropicKey, companyId, itemId, cfg)
  return pickTour(ctx.photos, kindForFormat(format, cfg) ?? 'room', { cfg, recentRooms: ctx.recentRooms, usedPhotos: ctx.usedPhotos })
}

/**
 * Planeja os tours da semana de uma vez: tipo por vaga (formato da vaga; rodízio se nenhuma pediu pair/opening)
 * e foto por vaga SEM repetir foto nem cômodo entre as vagas do mesmo imóvel. Vaga sem escolha fica sem `tour`
 * (o runVideoSlot escolhe sozinho). Erros nunca derrubam o planejamento.
 */
export async function planTours(admin: Admin, anthropicKey: string, companyId: string, verticalKey: string | null,
  jobs: { item_id?: string; format?: string }[], weekDate: string): Promise<(TourPlan | undefined)[]> {
  const out: (TourPlan | undefined)[] = jobs.map(() => undefined)
  if (!jobs.length) return out
  try {
    const cfg = await fetchTourCfg(admin, verticalKey)
    const kinds = weekKinds(jobs.map(j => kindForFormat(j.format, cfg)), weekNumber(weekDate))
    const itemIds = [...new Set(jobs.map(j => j.item_id).filter((x): x is string => !!x))]
    const ctxs = new Map<string, TourContext>()
    await Promise.all(itemIds.map(async id => { try { ctxs.set(id, await loadTourContext(admin, anthropicKey, companyId, id, cfg)) } catch (e) { console.error('planTours: contexto falhou', id, String(e).slice(0, 200)) } }))
    const takenRooms = new Map<string, Set<string>>(), takenPhotos = new Map<string, Set<string>>()
    jobs.forEach((j, i) => {
      const ctx = j.item_id ? ctxs.get(j.item_id) : undefined
      if (!j.item_id || !ctx) return
      const tr = takenRooms.get(j.item_id) ?? new Set<string>(), tp = takenPhotos.get(j.item_id) ?? new Set<string>()
      const c = pickTour(ctx.photos, kinds[i] as TourKind, { cfg, recentRooms: ctx.recentRooms, usedPhotos: ctx.usedPhotos, takenRooms: tr, takenPhotos: tp })
      if (!c) return
      c.rooms.forEach(r => { if (r) tr.add(r) }); c.photos.forEach(u => tp.add(u))
      takenRooms.set(j.item_id, tr); takenPhotos.set(j.item_id, tp)
      out[i] = c
    })
  } catch (e) { console.error('planTours falhou (cada vaga escolhe sozinha)', String(e).slice(0, 200)) }
  return out
}

/** Últimas legendas dos vídeos do mesmo imóvel (pra não repetir a abertura). */
export async function previousCaptions(admin: Admin, companyId: string, itemId: string, recipe: string, limit = 6): Promise<string[]> {
  try {
    const { data } = await admin.from('marketing_ai_test_content').select('caption').eq('company_id', companyId).eq('item_id', itemId).eq('recipe', recipe)
      .not('caption', 'is', null).order('created_at', { ascending: false }).limit(limit)
    return ((data ?? []) as { caption: string | null }[]).map(r => String(r.caption ?? '').trim()).filter(Boolean)
  } catch { return [] }
}
