import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { parseAvailabilityCfg, type AvailabilityCfg } from '../../../lib/itemAvailability'

// Lista de status de disponibilidade da ficha do setor (vertical_playbooks.config.availability). undefined = carregando;
// null = ficha sem a chave (nada bloqueado) ou consulta falhou (a tela então não afirma nada sobre disponibilidade).
const cache = new Map<string, AvailabilityCfg | null>()
export function useAvailabilityCfg(verticalKey: string | null | undefined): AvailabilityCfg | null | undefined {
  const key = verticalKey ?? 'generico'
  const [cfg, setCfg] = useState<AvailabilityCfg | null | undefined>(cache.has(key) ? cache.get(key) : undefined)
  useEffect(() => {
    if (cache.has(key)) { setCfg(cache.get(key)); return }
    let alive = true
    supabase.from('vertical_playbooks').select('config').eq('key', key).eq('enabled', true).maybeSingle().then(({ data, error }) => {
      const v = error ? null : parseAvailabilityCfg((data?.config as { availability?: unknown } | null)?.availability)
      if (!error) cache.set(key, v)
      if (alive) setCfg(v)
    })
    return () => { alive = false }
  }, [key])
  return cfg
}
