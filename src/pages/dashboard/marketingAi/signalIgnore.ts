import { supabase } from '../../../lib/supabase'

// "Ignorar sinal" (Pacote B2, item 8). Grava em market_signals.meta { ignored, ignored_at } — sem migration; a
// evidência (título, fonte, link, data) fica toda lá, só sai da lista ativa e do motor de oportunidades.
//
// SEMPRE mesclar com a meta que já existe: meta já guarda outras chaves (ex.: provider) e um update com `{ ignored }`
// sozinho apagaria elas. E o filtro de "não ignorado" TEM que ser o .or abaixo: `.neq('meta->>ignored','true')` sozinho
// descarta as linhas em que a chave não existe (NULL != 'true' dá NULL), ou seja, esconderia TODOS os sinais normais.
export const NOT_IGNORED_OR = 'meta->>ignored.is.null,meta->>ignored.neq.true'

export interface SignalMeta { ignored?: boolean; ignored_at?: string; [k: string]: unknown }
export const isIgnored = (meta: SignalMeta | null | undefined) => meta?.ignored === true

/** Meta nova ao ignorar/restaurar (pura, testável). Restaurar = ignored:false e tira ignored_at. */
export function mergeIgnoredMeta(meta: SignalMeta | null | undefined, ignored: boolean, now: string = new Date().toISOString()): SignalMeta {
  const { ignored_at: _drop, ...rest } = meta ?? {}
  void _drop
  return ignored ? { ...rest, ignored: true, ignored_at: now } : { ...rest, ignored: false }
}

/** Lê a meta atual e grava a mesclada. Devolve true se gravou. */
export async function setSignalIgnored(signalId: string, companyId: string, ignored: boolean): Promise<boolean> {
  const cur = await supabase.from('market_signals').select('meta').eq('id', signalId).eq('company_id', companyId).maybeSingle()
  if (cur.error || !cur.data) return false
  const meta = mergeIgnoredMeta(cur.data.meta as SignalMeta | null, ignored)
  const { error } = await supabase.from('market_signals').update({ meta }).eq('id', signalId).eq('company_id', companyId)
  return !error
}
