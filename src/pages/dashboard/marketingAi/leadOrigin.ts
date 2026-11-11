// Origem do lead no funil (Pacote B1) — só mostra o que as colunas do lead registram, nada inferido:
//  - imóvel (`item_id`) e, se houver `link_id`, o canal do link da página pública (legenda/DM/bio);
//  - oportunidade só quando `opportunity_id` está gravado;
//  - nada disso → "Origem não registrada".
// NÃO há peça de origem: `tracked_links` é único por (imóvel, oportunidade, canal) e `content_id` guarda só a
// primeira peça que criou o link, então o link não identifica uma peça (docs/ARCHITECTURE.md). Não inferir.
// Consulta auxiliar que falhou → `unverified` ("Não foi possível verificar"), nunca "não registrada".

export interface OriginIds { item_id: string | null; link_id: string | null; opportunity_id: string | null }
export interface OriginLookups {
  itemTitles: Record<string, string>; linkChannels: Record<string, string>; oppTitles: Record<string, string>
  failed: { columns: boolean; items: boolean; links: boolean; opps: boolean } // columns: o select com link_id/opportunity_id caiu no fallback (as colunas não foram lidas)
}
export interface Origin { lines: string[]; unverified: boolean; registered: boolean }

const CHANNEL = {
  pt: { caption: 'legenda', dm: 'DM', bio: 'bio', manual: 'link manual' } as Record<string, string>,
  en: { caption: 'caption', dm: 'DM', bio: 'bio', manual: 'manual link' } as Record<string, string>,
}
const W = {
  pt: { item: 'Imóvel', page: 'página pública', opp: 'Oportunidade', gone: 'não encontrado' },
  en: { item: 'Listing', page: 'public page', opp: 'Opportunity', gone: 'not found' },
}

export function leadOrigin(ids: OriginIds, lk: OriginLookups, lang: 'pt' | 'en'): Origin {
  const w = W[lang]
  const lines: string[] = []
  // Colunas não lidas (fallback): os ids vêm nulos por falta de leitura, não por ausência — nunca "não registrada".
  if (lk.failed.columns) return { lines, unverified: true, registered: false }
  let unverified = false
  let title: string | null = null
  if (ids.item_id) {
    if (lk.failed.items) unverified = true
    else title = lk.itemTitles[ids.item_id] ?? w.gone
  }
  let via: string | null = null
  if (ids.link_id) {
    if (lk.failed.links) unverified = true
    else {
      const ch = lk.linkChannels[ids.link_id]
      via = ch ? `${w.page} (${CHANNEL[lang][ch] ?? ch})` : w.page
    }
  }
  if (title && via) lines.push(`${w.item}: ${title} · ${via}`)
  else if (title) lines.push(`${w.item}: ${title}`)
  else if (via) lines.push(via.charAt(0).toUpperCase() + via.slice(1))
  if (ids.opportunity_id) {
    if (lk.failed.opps) unverified = true
    else lines.push(`${w.opp}: ${lk.oppTitles[ids.opportunity_id] ?? w.gone}`)
  }
  const registered = !!(ids.item_id || ids.link_id || ids.opportunity_id)
  return { lines, unverified, registered }
}
