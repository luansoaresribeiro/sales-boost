import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

// Sincronização ao vivo: escuta mudanças de uma tabela (filtradas por empresa)
// e chama `onChange` na hora que algo entra/muda — sem precisar recarregar.
// A RLS do Supabase garante que só chegam mudanças das linhas da própria
// empresa. Passe um `onChange` estável (useCallback) pra não re-assinar à toa.
//
// `opts.key` evita colisão de canal quando dois componentes escutam a mesma
// tabela ao mesmo tempo (ex.: sino de pendências + ApprovalsPage). `opts.column`
// é a coluna que liga a linha à empresa (padrão company_id; em `companies` é `id`).
export function useRealtime(table: string, companyId: string | undefined | null, onChange: () => void, opts?: { key?: string; column?: string }) {
  const cb = useRef(onChange)
  cb.current = onChange
  const suffix = opts?.key ? `:${opts.key}` : ''
  const column = opts?.column ?? 'company_id'
  useEffect(() => {
    if (!companyId) return
    const channel = supabase
      .channel(`rt:${table}:${companyId}${suffix}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `${column}=eq.${companyId}` },
        () => cb.current(),
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [table, companyId, suffix, column])
}
