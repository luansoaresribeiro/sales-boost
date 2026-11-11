import { supabase } from '../../../lib/supabase'
import { mergeIgnoredMeta, type SignalMeta } from './signalMeta'

// "Ignorar sinal" (Pacote B2, item 8). Grava em market_signals.meta { ignored, ignored_at } — sem migration; a
// evidência (título, fonte, link, data) fica toda lá, só sai da lista ativa e do motor de oportunidades.
//
// SEMPRE mesclar com a meta que já existe: meta já guarda outras chaves (ex.: provider) e um update com `{ ignored }`
// sozinho apagaria elas. E o filtro de "não ignorado" TEM que ser o .or abaixo: `.neq('meta->>ignored','true')` sozinho
// descarta as linhas em que a chave não existe (NULL != 'true' dá NULL), ou seja, esconderia TODOS os sinais normais.
// A parte pura (meta, motivo, frase) vive em signalMeta.ts. Fase 2: dono grava ignored_by:'owner'; restaurar grava owner_restored:true (o sistema não ignora de novo).
export const NOT_IGNORED_OR = 'meta->>ignored.is.null,meta->>ignored.neq.true'

export { isIgnored, mergeIgnoredMeta, type SignalMeta } from './signalMeta'

/** Lê a meta atual e grava a mesclada. Devolve true se gravou. */
export async function setSignalIgnored(signalId: string, companyId: string, ignored: boolean): Promise<boolean> {
  const cur = await supabase.from('market_signals').select('meta').eq('id', signalId).eq('company_id', companyId).maybeSingle()
  if (cur.error || !cur.data) return false
  const meta = mergeIgnoredMeta(cur.data.meta as SignalMeta | null, ignored)
  const { error } = await supabase.from('market_signals').update({ meta }).eq('id', signalId).eq('company_id', companyId)
  return !error
}
