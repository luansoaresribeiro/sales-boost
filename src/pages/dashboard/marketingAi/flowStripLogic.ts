// Regras puras da faixa de fluxo (sem React/Supabase, para o teste em node). Espelham o código real dos agentes:
// opportunityCron.ts → shouldRunOpportunities (nova rodada: > 7 dias, ou sinal de mercado novo e já passaram 24 h; falha há < 6 h não tenta).
export const RERUN_AFTER_MS = 7 * 24 * 3600_000
export const MIN_BETWEEN_RUNS_MS = 24 * 3600_000
export const RETRY_AFTER_FAIL_MS = 6 * 3600_000

export type NextRound =
  | { kind: 'first'; atMs: number | null }      // nunca rodou: na próxima verificação (a cada 6 h), a não ser que tenha falhado há pouco
  | { kind: 'signal'; atMs: number }            // há sinal novo desde a última rodada: roda na 1ª verificação depois de atMs
  | { kind: 'weekly'; atMs: number }            // sem sinal novo: 7 dias depois da última rodada (ou antes, se entrar sinal — depois de 24 h)

const ok = (n: number | null): n is number => n != null && Number.isFinite(n)

/** Quando a próxima rodada de oportunidades pode acontecer — "depois de atMs", na próxima verificação do cron. */
export function nextOpportunityRound(lastRunMs: number | null, latestSignalMs: number | null, lastFailMs: number | null = null): NextRound {
  const failBlock = ok(lastFailMs) && (!ok(lastRunMs) || lastFailMs > lastRunMs) ? lastFailMs + RETRY_AFTER_FAIL_MS : null
  const late = (t: number): number => (failBlock != null && failBlock > t ? failBlock : t)
  if (!ok(lastRunMs)) return { kind: 'first', atMs: failBlock }
  if (ok(latestSignalMs) && latestSignalMs > lastRunMs) return { kind: 'signal', atMs: late(lastRunMs + MIN_BETWEEN_RUNS_MS) }
  return { kind: 'weekly', atMs: late(lastRunMs + RERUN_AFTER_MS) }
}

/** Texto curto de erro: uma linha, no máximo n caracteres. */
export function shortError(s: string | null | undefined, n = 110): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

/** "dd/mm hh:mm" no fuso do navegador; null se a data não existe ou é inválida. */
export function fmtStamp(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return null
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Dinheiro em US$ com 2 casas; null se não for número. */
export function usd(v: unknown): string | null {
  const n = Number(v)
  return v == null || !Number.isFinite(n) ? null : `US$ ${n.toFixed(2)}`
}
