import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../contexts/AuthContext'

// O kit grátis (2 vídeos + 1 criativo) é PRESENTE de quem veio do diagnóstico
// grátis (decisão do dono 2026-10-13, docs/DECISIONS.md). Quem criou a conta
// direto não tem direito.
//
// Fonte da verdade do "veio do diagnóstico": o diagnóstico ligado à empresa
// (diagnostics.company_id, gravado pelo claim-diagnostic) foi criado ANTES da
// conta existir. Na conta direta o diagnóstico nasce depois — o onboarding é
// quem o cria — então não conta. (O trial-video liga o kit ao mesmo vínculo.)
//
// "Kit já criado" = o trial-video responde algo diferente de 'none' (kit em
// andamento, pronto ou limite do mês). Chamada leve de leitura; liga o kit do
// diagnóstico à empresa na primeira consulta, como a página /gratis já faz.
export interface KitStatus { loading: boolean; entitled: boolean; created: boolean }

export function useKitStatus(companyId: string | null | undefined, enabled: boolean): KitStatus {
  const { user, session } = useAuth()
  const [st, setSt] = useState<KitStatus>({ loading: true, entitled: false, created: false })
  const userCreatedAt = user?.created_at ?? null
  const token = session?.access_token ?? null

  useEffect(() => {
    if (!enabled || !companyId || !userCreatedAt || !token) return
    let alive = true
    ;(async () => {
      try {
        const { data, error } = await supabase.from('diagnostics').select('id, created_at').eq('company_id', companyId).limit(20)
        const since = new Date(userCreatedAt).getTime()
        const entitled = !error && (data ?? []).some(d => d.created_at && new Date(d.created_at as string).getTime() < since)
        if (!entitled) { if (alive) setSt({ loading: false, entitled: false, created: false }); return }
        let created = true // na dúvida (erro), não incomoda com o pop-up
        try {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/trial-video`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status' }),
          })
          if (res.ok) created = ((await res.json().catch(() => ({}))) as { status?: string }).status !== 'none'
        } catch { /* mantém created = true */ }
        if (alive) setSt({ loading: false, entitled: true, created })
      } catch {
        if (alive) setSt({ loading: false, entitled: false, created: false })
      }
    })()
    return () => { alive = false }
  }, [companyId, enabled, userCreatedAt, token])

  // Fora do modo vitrine nada a descobrir (sem consulta nenhuma).
  return enabled ? st : { loading: false, entitled: false, created: false }
}
