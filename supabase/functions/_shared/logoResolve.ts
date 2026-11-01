// Logo que vai pra um criativo (2026-10-25). MESMA lógica do `resolveLogo` do render-format (que NÃO foi
// movido pra cá de propósito: render-format está em produção e ficou intocado — se mudar a regra, mude
// nos dois e rode scripts/test-logo-png.mjs). Ordem: (1) logo_meta.kind 'foto' → NENHUM logo;
// (2) logo_meta.src === logo atual E png_url → o PNG transparente preparado; (3) senão o logo de sempre
// (logoUrl), idêntico a antes. A leitura é tolerante: sem a coluna/migration ou com erro cai no (3).
//
// 2026-10-26 ("Tudo automático"): quando o logo_meta falta ou é de OUTRO logo, `kickLogoPrepare` dispara em
// segundo plano (sem esperar, sem quebrar a peça de agora, que usa o logo de sempre) o brand-kit-suggest
// `prepare_logo`. Trava de repetição: marca de tentativa dentro do próprio logo_meta (shouldPrepareLogo).
import { usableLogoMeta, shouldPrepareLogo } from './logoPng.ts'

export interface ResolvedLogo { url: string | null; foto: boolean; prepared: boolean; luma: number | null; lo: number | null; hi: number | null; aspect: number | null }

/** Marca a tentativa e chama `prepare_logo` sem esperar. Nunca lança. Nunca troca o logo_url do dono. */
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function kickLogoPrepare(admin: any, companyId: string, logoUrl: string | null | undefined, rawMeta: unknown): Promise<boolean> {
  try {
    if (!logoUrl || !shouldPrepareLogo(rawMeta, logoUrl)) return false
    const supabaseUrl = Deno.env.get('SUPABASE_URL'), cron = Deno.env.get('CRON_SECRET')
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !cron || !key) return false
    const at = new Date().toISOString()
    const prev = rawMeta && typeof rawMeta === 'object' ? rawMeta as Record<string, unknown> : {}
    const marker = { ...prev, attempted_at: at, attempt_src: logoUrl, attempt_status: 'started' }
    // .eq('logo_url') = só marca se o logo ainda é este; linha não existe → não cria.
    const { data, error } = await admin.from('brand_dna').update({ logo_meta: marker }).eq('company_id', companyId).eq('logo_url', logoUrl).select('company_id')
    if (error || !data?.length) return false
    const p = fetch(`${supabaseUrl}/functions/v1/brand-kit-suggest`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'prepare_logo', company_id: companyId, cron_secret: cron, attempted_at: at }),
      signal: AbortSignal.timeout(120_000),
    }).then(r => r.text()).catch(e => console.error('kickLogoPrepare: chamada falhou', String(e)))
    // Deixa o servidor terminar a chamada mesmo depois que a peça respondeu.
    // deno-lint-ignore no-explicit-any
    try { (globalThis as any).EdgeRuntime?.waitUntil?.(p) } catch { /* sem waitUntil: a chamada segue enquanto a função viver */ }
    return true
  } catch (e) { console.error('kickLogoPrepare falhou (a peça segue com o logo de sempre)', e); return false }
}

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveLogo(admin: any, companyId: string, brand: { logoUrl?: string | null }): Promise<ResolvedLogo> {
  const legacy: ResolvedLogo = { url: brand.logoUrl ?? null, foto: false, prepared: false, luma: null, lo: null, hi: null, aspect: null }
  try {
    if (!brand.logoUrl) return legacy
    const { data, error } = await admin.from('brand_dna').select('logo_meta').eq('company_id', companyId).maybeSingle()
    if (error || !data) return legacy
    const raw = (data as { logo_meta?: unknown }).logo_meta
    const m = usableLogoMeta(raw, brand.logoUrl)
    if (!m) { void kickLogoPrepare(admin, companyId, brand.logoUrl, raw); return legacy }
    if (m.kind === 'foto') return { url: null, foto: true, prepared: false, luma: null, lo: null, hi: null, aspect: null }
    if (m.png_url) return { url: m.png_url, foto: false, prepared: true, luma: m.luma, lo: m.luma_lo ?? null, hi: m.luma_hi ?? null, aspect: m.w && m.h ? m.w / m.h : null }
    return legacy
  } catch (e) { console.error('resolveLogo falhou, usando o logo de sempre', e); return legacy }
}
