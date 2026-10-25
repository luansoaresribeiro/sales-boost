// Logo que vai pra um criativo (2026-10-25). MESMA lógica do `resolveLogo` do render-format (que NÃO foi
// movido pra cá de propósito: render-format está em produção e ficou intocado — se mudar a regra, mude
// nos dois e rode scripts/test-logo-png.mjs). Ordem: (1) logo_meta.kind 'foto' → NENHUM logo;
// (2) logo_meta.src === logo atual E png_url → o PNG transparente preparado; (3) senão o logo de sempre
// (logoUrl), idêntico a antes. A leitura é tolerante: sem a coluna/migration ou com erro cai no (3).
import { usableLogoMeta } from './logoPng.ts'

export interface ResolvedLogo { url: string | null; foto: boolean; prepared: boolean; luma: number | null; lo: number | null; hi: number | null; aspect: number | null }

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveLogo(admin: any, companyId: string, brand: { logoUrl?: string | null }): Promise<ResolvedLogo> {
  const legacy: ResolvedLogo = { url: brand.logoUrl ?? null, foto: false, prepared: false, luma: null, lo: null, hi: null, aspect: null }
  try {
    if (!brand.logoUrl) return legacy
    const { data, error } = await admin.from('brand_dna').select('logo_meta').eq('company_id', companyId).maybeSingle()
    if (error || !data) return legacy
    const m = usableLogoMeta((data as { logo_meta?: unknown }).logo_meta, brand.logoUrl)
    if (!m) return legacy
    if (m.kind === 'foto') return { url: null, foto: true, prepared: false, luma: null, lo: null, hi: null, aspect: null }
    if (m.png_url) return { url: m.png_url, foto: false, prepared: true, luma: m.luma, lo: m.luma_lo ?? null, hi: m.luma_hi ?? null, aspect: m.w && m.h ? m.w / m.h : null }
    return legacy
  } catch (e) { console.error('resolveLogo falhou, usando o logo de sempre', e); return legacy }
}
