// Limite de chamadas entre funções do Supabase (achado de 16/11, C1).
// Quando muitas chamadas de uma mesma rodada (mesmo "trace") batem em outra função ao mesmo tempo, o runtime
// recusa com `RateLimitError: Rate limit exceeded for trace … Retry after N ms`. No plano de domingo 15/11 isso
// derrubou o desenho dos slides e 10 de 14 posts das contas de teste foram descartados "sem imagem".
// Aqui: ler o tempo pedido, esperar só quando cabe no relógio da invocação (teto ~150 s) e limitar o paralelismo.
// Parte pura (testada em scripts/test-rate-limit-retry.mjs) + um fetch com nova tentativa.

export type RetryOpts = { maxAttempts?: number; maxWaitMs?: number; budgetMs?: number }
const DEFAULTS = { maxAttempts: 3, maxWaitMs: 12_000, budgetMs: 25_000 }

/** "Retry after 8223ms." → 8223. Sem número (ou não é limite) → null. */
export function parseRetryAfterMs(message: string): number | null {
  if (!/rate limit exceeded/i.test(message)) return null
  const m = /retry after\s+(\d+)\s*ms/i.exec(message)
  return m ? Number(m[1]) : null
}

export function isRateLimit(e: unknown): boolean {
  const name = (e as { name?: string } | null)?.name ?? ''
  const msg = e instanceof Error ? e.message : String(e ?? '')
  return name === 'RateLimitError' || /rate limit exceeded/i.test(msg)
}

/** Espera de novo? Só se ainda há tentativa, o tempo pedido é curto e a soma das esperas cabe no orçamento. */
export function shouldRetry(retryAfterMs: number | null, attempt: number, waitedMs: number, opts: RetryOpts = {}): number | null {
  const o = { ...DEFAULTS, ...opts }
  if (attempt + 1 >= o.maxAttempts) return null
  const wait = Math.max(500, Math.min(retryAfterMs ?? 3_000, o.maxWaitMs))
  if (retryAfterMs !== null && retryAfterMs > o.maxWaitMs) return null
  if (waitedMs + wait > o.budgetMs) return null
  return wait + Math.floor(Math.random() * 400) // um pouco de folga aleatória, pra as vagas não voltarem juntas
}

/** fetch que, recusado pelo limite de chamadas, espera o tempo pedido e tenta de novo (dentro de `opts`). */
export async function fetchRetry(url: string, init: RequestInit, opts: RetryOpts = {}): Promise<Response> {
  let waited = 0
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, init)
      if (res.status !== 429) return res
      const wait = shouldRetry(Number(res.headers.get('retry-after') ?? '') * 1000 || null, attempt, waited, opts)
      if (wait === null) return res
      await res.body?.cancel()
      await new Promise(r => setTimeout(r, wait)); waited += wait
    } catch (e) {
      if (!isRateLimit(e)) throw e
      const wait = shouldRetry(parseRetryAfterMs(e instanceof Error ? e.message : String(e)), attempt, waited, opts)
      if (wait === null) throw e
      await new Promise(r => setTimeout(r, wait)); waited += wait
    }
  }
}

/** Como Promise.all(items.map(fn)), mas com no máximo `limit` ao mesmo tempo; mantém a ordem do resultado. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i) } }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
  return out
}
