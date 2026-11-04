import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { parseAvailabilityCfg, type AvailabilityCfg } from '../../../lib/itemAvailability'

// Lista de status de disponibilidade da ficha do setor (vertical_playbooks.config.availability).
// cfg: undefined = carregando; null = ficha sem a chave (nada bloqueado). failed = a consulta deu erro (a tela diz "Não foi possível verificar").
const cache = new Map<string, AvailabilityCfg | null>()
export function useAvailabilityState(verticalKey: string | null | undefined): { cfg: AvailabilityCfg | null | undefined; failed: boolean } {
  const key = verticalKey ?? 'generico'
  const [st, setSt] = useState<{ cfg: AvailabilityCfg | null | undefined; failed: boolean }>({ cfg: cache.has(key) ? cache.get(key) : undefined, failed: false })
  useEffect(() => {
    if (cache.has(key)) { setSt({ cfg: cache.get(key), failed: false }); return }
    let alive = true
    supabase.from('vertical_playbooks').select('config').eq('key', key).eq('enabled', true).maybeSingle().then(({ data, error }) => {
      if (error) { if (alive) setSt({ cfg: null, failed: true }); return }
      const v = parseAvailabilityCfg((data?.config as { availability?: unknown } | null)?.availability)
      cache.set(key, v)
      if (alive) setSt({ cfg: v, failed: false })
    })
    return () => { alive = false }
  }, [key])
  return st
}
export const useAvailabilityCfg = (verticalKey: string | null | undefined) => useAvailabilityState(verticalKey).cfg
