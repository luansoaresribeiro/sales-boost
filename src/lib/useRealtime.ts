import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

// Sincronização ao vivo: escuta mudanças de uma tabela (filtradas por empresa)
// e chama `onChange` na hora que algo entra/muda — sem precisar recarregar.
// A RLS do Supabase garante que só chegam mudanças das linhas da própria
// empresa. Passe um `onChange` estável (useCallback) pra não re-assinar à toa.
export function useRealtime(table: string, companyId: string | undefined | null, onChange: () => void) {
  const cb = useRef(onChange)
  cb.current = onChange
  useEffect(() => {
    if (!companyId) return
    const channel = supabase
      .channel(`rt:${table}:${companyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `company_id=eq.${companyId}` },
        () => cb.current(),
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [table, companyId])
}
