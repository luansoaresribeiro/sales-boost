import { weekSlots, planWindow, type MixItem, type WeekSlot } from '../../../lib/weekSlots'

// Regra ÚNICA de "vaga aberta" do plano da estratégia — usada pelo Calendário (WeeklyCalendarTab) e pelo topo da Estratégia
// (StrategyTopBlocks), pra "próxima vaga" nunca divergir entre as duas telas (Pacote A, 2026-11-03).
export interface FormatMeta { surface?: string; recipe?: string; family?: string; pillar?: string }
interface FormatCfg { key: string; surface?: string; recipe?: string; family?: string; pillar?: string; producer?: string }

/** Formatos da ficha do setor (vertical_playbooks.config.content_formats) por chave. */
export function buildFormatMeta(config: unknown): Record<string, FormatMeta> {
  const fm: Record<string, FormatMeta> = {}
  for (const f of ((config as { content_formats?: FormatCfg[] } | null)?.content_formats ?? [])) fm[f.key] = { surface: f.surface, recipe: f.recipe, family: f.family ?? (f.producer === 'item_video' ? 'tour' : 'eventual'), pillar: f.pillar }
  return fm
}

/** Vagas do plano da PRÓXIMA janela (seg–dom), as que o domingo e o botão "Criar as peças" geram de fato, a partir de hoje, por dia. */
export function slotsByDay(mix: MixItem[], todayIso: string, today = new Date()): Record<string, WeekSlot[]> {
  const out: Record<string, WeekSlot[]> = {}
  for (const sl of weekSlots(mix, planWindow(1, today))) {
    if (sl.date < todayIso) continue
    ;(out[sl.date] ??= []).push(sl)
  }
  return out
}

/** Peça já criada ocupa a vaga do mesmo formato (receita) ou, se for post solto (sem item), a primeira vaga de post do dia. */
export function openSlotsForDay(daySlots: WeekSlot[] | undefined, dayItems: { recipe?: string | null; item_id?: string | null }[], formatMeta: Record<string, FormatMeta>): WeekSlot[] {
  const left = [...dayItems]
  return (daySlots ?? []).filter(sl => {
    // Vídeo do calendário: a peça nasce com a receita 'video_imovel' (creative-generate).
    const recipe = sl.producer === 'item_video' ? 'video_imovel' : formatMeta[sl.format]?.recipe
    const i = left.findIndex(it => (recipe && it.recipe === recipe) || (sl.producer === 'post' && !it.item_id))
    if (i >= 0) { left.splice(i, 1); return false }
    return true
  })
}
