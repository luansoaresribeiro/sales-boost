import { lazy, type ComponentType } from 'react'

// Páginas carregadas sob demanda (dono, 2026-11-10: "o fluxo deve ser leve"). Antes o site baixava TODAS as páginas
// (~2,4 MB de JS) ao abrir; agora cada página vira um pedaço à parte e só baixa quando é usada.
//
// Armadilha (docs/PITFALLS.md): depois de um deploy, os pedaços antigos somem do servidor. Quem estava com o site aberto
// tenta baixar um nome que não existe mais → erro. Aqui: falhou o download → recarrega a página UMA vez (marca na sessão),
// o que traz a versão nova. Se falhar de novo, o erro sobe pro ErrorBoundary (mensagem + tentar de novo), sem laço.
const RELOAD_KEY = 'sb_chunk_reload_at'
type Loader<T> = () => Promise<{ default: T }>
const groups: Record<string, Loader<unknown>[]> = {}

function withReload<T>(loader: Loader<T>): Loader<T> {
  return () => loader().then(m => {
    try { sessionStorage.removeItem(RELOAD_KEY) } catch { /* sem sessionStorage */ }
    return m
  }, (err: unknown) => {
    let last = 0
    try { last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0) } catch { /* sem sessionStorage */ }
    if (Date.now() - last > 30_000) {
      try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())) } catch { /* sem sessionStorage */ }
      window.location.reload()
      return new Promise<never>(() => {}) // a página vai recarregar; não mostra erro nesse meio-tempo
    }
    throw err
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<T extends ComponentType<any>>(loader: Loader<T>, group?: string) {
  // O pré-download usa o carregador CRU: se falhar em segundo plano, não recarrega a página do nada.
  if (group) (groups[group] ??= []).push(loader as Loader<unknown>)
  return lazy(withReload(loader))
}

// Depois que o painel abre, baixa as outras páginas do grupo em segundo plano (quando o navegador estiver ocioso),
// pra trocar de aba ficar instantâneo. Economia de dados ligada → não pré-baixa.
export function prefetchGroup(group: string): () => void {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } }
  if (nav.connection?.saveData) return () => {}
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }
  const run = () => { for (const l of groups[group] ?? []) void l().catch(() => {}) }
  if (w.requestIdleCallback) { const id = w.requestIdleCallback(run, { timeout: 4000 }); return () => w.cancelIdleCallback?.(id) }
  const id = window.setTimeout(run, 2500)
  return () => window.clearTimeout(id)
}
