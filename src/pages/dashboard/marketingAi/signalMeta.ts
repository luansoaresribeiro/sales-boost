// Parte PURA do "ignorar sinal" (sem banco; testada em scripts/test-market-runs.mjs). O gravar/ler do banco fica em signalIgnore.ts.
// Quem ignorou fica registrado: o dono grava ignored_by:'owner'; o filtro de qualidade grava ignored_by:'system' + ignored_reason (Fase 2).
// Restaurar limpa quem/motivo e grava owner_restored:true — a regra "o sistema nunca ignora de novo o que o dono restaurou" mora no backend.
export interface SignalMeta { ignored?: boolean; ignored_at?: string; ignored_by?: string; ignored_reason?: string; owner_restored?: boolean; [k: string]: unknown }
export const isIgnored = (meta: SignalMeta | null | undefined) => meta?.ignored === true
export const ignoredBySystem = (meta: SignalMeta | null | undefined) => meta?.ignored === true && meta.ignored_by === 'system'

/** Meta nova ao ignorar/restaurar. Sempre mescla com a meta que já existe. Restaurar = ignored:false, tira ignored_at/by/reason e marca owner_restored. */
export function mergeIgnoredMeta(meta: SignalMeta | null | undefined, ignored: boolean, now: string = new Date().toISOString()): SignalMeta {
  const { ignored_at: _a, ignored_by: _b, ignored_reason: _r, ...rest } = meta ?? {}
  void _a; void _b; void _r
  return ignored ? { ...rest, ignored: true, ignored_at: now, ignored_by: 'owner' } : { ...rest, ignored: false, owner_restored: true }
}

const REASONS = {
  pt: { block_url: 'página de anúncio ou de utilidade (pelo endereço)', block_title: 'anúncio ou página sem notícia (pelo título)', short_summary: 'quase sem texto', kind_mismatch: 'o assunto não combina com o tipo', host_cap: 'site repetido demais', low_score: 'pouca relevância', other: 'não passou no filtro de qualidade' },
  en: { block_url: 'listing or utility page (by address)', block_title: 'listing or page without news (by title)', short_summary: 'almost no text', kind_mismatch: 'the subject does not match the type', host_cap: 'too many from the same site', low_score: 'low relevance', other: 'did not pass the quality filter' },
} as const
export const reasonLabel = (code: unknown, lang: 'pt' | 'en'): string => (REASONS[lang] as Record<string, string>)[String(code ?? '')] ?? REASONS[lang].other

/** Frase do bloco Ignorados: "Ignorado pelo sistema: <motivo>" ou "Ignorado por você" (sinal antigo, sem ignored_by, foi sempre o dono). */
export function ignoredNote(meta: SignalMeta | null | undefined, lang: 'pt' | 'en'): string {
  if (meta?.ignored_by === 'system') return `${lang === 'en' ? 'Ignored by the system' : 'Ignorado pelo sistema'}: ${reasonLabel(meta.ignored_reason, lang)}`
  return lang === 'en' ? 'Ignored by you' : 'Ignorado por você'
}
