// Aviso de foto MOBILIADA VIRTUALMENTE garantido na hora de publicar (Etapa 2 do Tour virtual, 2026-11-11).
// PURO na parte de texto (testado em Node: scripts/test-staging-disclosure.mjs); a leitura do banco fica em
// `stagingCheck`. O texto do aviso vem da ficha do setor (vertical_playbooks.config.virtual_staging.disclosure,
// regra 6). Regra de MEDIA-ENGINE.md: staging virtual só com o aviso + a foto original junto.
//
// Por que aqui: a peça já nasce com o aviso (catalog-package), mas a legenda pode ser editada antes de aprovar.
// O servidor confere de novo ao publicar — mesmo padrão do rodapé do CRECI (_shared/compliance.ts ensureFooter).

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/** O aviso já está na legenda (ignora maiúscula, acento e espaços)? */
export function hasDisclosure(caption: string, disclosure: string): boolean {
  const d = norm(disclosure)
  return !!d && norm(caption).includes(d)
}

/** Acrescenta o aviso uma vez só. Se passar do limite, corta o TEXTO da legenda, nunca o aviso. `reserve` = espaço pro rodapé do CRECI. */
export function ensureDisclosure(caption: string, disclosure: string, max = 2200, reserve = 80): string {
  const base = String(caption ?? '').trim()
  if (!disclosure.trim() || hasDisclosure(base, disclosure)) return base
  const room = max - reserve - disclosure.length - 2
  const body = base.length > room ? base.slice(0, Math.max(0, room - 1)).trimEnd() + '…' : base
  return body ? `${body}\n\n${disclosure}` : disclosure
}

/** Alguma mídia do post é foto mobiliada deste imóvel? */
export function usesStaged(mediaUrls: string[], stagedUrls: string[]): boolean {
  const s = new Set(stagedUrls.filter(Boolean))
  return mediaUrls.some(u => s.has(u))
}

export const STAGING_CHECK_FAILED = 'Não consegui conferir se este post usa foto mobiliada virtualmente. Nada foi publicado — tente de novo em alguns minutos.'
export const STAGING_NO_DISCLOSURE = 'Este post usa foto mobiliada virtualmente, mas a ficha do setor não tem o aviso "imagem ilustrativa". Nada foi publicado.'

/**
 * Na hora de publicar. { disclosure } = o post usa foto mobiliada → publicar com o aviso; { block } = recusar;
 * {} = não usa foto mobiliada. Falha FECHADA (publicar é irreversível): erro de banco recusa.
 */
// deno-lint-ignore no-explicit-any
export async function stagingCheck(admin: any, companyId: string, itemId: unknown, mediaUrls: string[]): Promise<{ disclosure?: string; block?: string }> {
  if (typeof itemId !== 'string' || !itemId || !mediaUrls.length) return {}
  try {
    const { data: item, error } = await admin.from('marketing_ai_knowledge').select('meta').eq('id', itemId).eq('company_id', companyId).maybeSingle()
    if (error) return { block: STAGING_CHECK_FAILED }
    const staged = ((item?.meta?.staged_photos ?? []) as { url?: string }[]).map(p => String(p?.url ?? ''))
    if (!usesStaged(mediaUrls, staged)) return {}
    const { data: co, error: e2 } = await admin.from('companies').select('vertical_key').eq('id', companyId).maybeSingle()
    if (e2) return { block: STAGING_CHECK_FAILED }
    const { data: pb, error: e3 } = await admin.from('vertical_playbooks').select('config').eq('key', co?.vertical_key ?? 'generico').maybeSingle()
    if (e3) return { block: STAGING_CHECK_FAILED }
    const disclosure = String(((pb?.config ?? {}) as { virtual_staging?: { disclosure?: unknown } }).virtual_staging?.disclosure ?? '').trim()
    return disclosure ? { disclosure } : { block: STAGING_NO_DISCLOSURE }
  } catch { return { block: STAGING_CHECK_FAILED } }
}
