import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { PipelineInput } from '../../../lib/contentPipeline'
import { FUNNEL_DAYS } from './useCommercialFunnel'

// Etapa B (23/11): os números de produção da faixa "Da produção ao resultado" (gerado, aprovado, publicado, alcance).
// Mesma janela do "Resultado comercial" (30 dias). Só leitura, sem canal em tempo real (PITFALLS: canal duplicado no hub).
// Consulta que falha ou estoura o limite = null ("sem dado"), nunca 0 fingido (regra 5). Leads e visitas vêm do funil.
const LIMIT = 1000
const DAY = 24 * 3600_000
type Production = Omit<PipelineInput, 'leads' | 'visits' | 'instagramConnected'>
const EMPTY: Production = { generated: null, archived: null, approved: null, published: null, reach: null, reachRows: null }

export function useContentPipeline(companyId?: string, enabled = true): { data: Production; loading: boolean } {
  const [state, setState] = useState<{ data: Production; loading: boolean }>({ data: EMPTY, loading: !!companyId && enabled })
  useEffect(() => {
    if (!companyId || !enabled) { setState({ data: EMPTY, loading: false }); return }
    let cancelled = false
    const since = new Date(Date.now() - FUNNEL_DAYS * DAY).toISOString()
    const head = { count: 'exact' as const, head: true }
    ;(async () => {
      const [gen, arch, acts, pubs] = await Promise.all([
        supabase.from('marketing_ai_test_content').select('id', head).eq('company_id', companyId).is('source_id', null).gte('created_at', since),
        supabase.from('marketing_ai_test_content').select('id', head).eq('company_id', companyId).is('source_id', null).gte('created_at', since).in('status', ['archived', 'rejected']),
        // Aprovado = uma pessoa aprovou (approved_by) a ação de uma peça. Automático sem pessoa não conta.
        supabase.from('agent_actions').select('ref_id').eq('company_id', companyId).eq('ref_type', 'marketing_ai_test_content').eq('approval_status', 'APPROVED').not('approved_by', 'is', null).gte('created_at', since).limit(LIMIT),
        supabase.from('posts').select('instagram_media_id').eq('company_id', companyId).not('instagram_media_id', 'is', null).gte('published_at', since).limit(LIMIT),
      ])
      const n = (r: { error: unknown; count: number | null }) => (r.error ? null : r.count ?? 0)
      // Aprovado: peças distintas, tirando as que depois foram arquivadas/recusadas.
      let approved: number | null = null
      if (!acts.error && (acts.data?.length ?? 0) < LIMIT) {
        const ids = [...new Set(((acts.data ?? []) as { ref_id: string | null }[]).map(a => a.ref_id).filter((x): x is string => !!x))]
        if (ids.length === 0) approved = 0
        else {
          const { data: ps, error } = await supabase.from('marketing_ai_test_content').select('id, status').eq('company_id', companyId).in('id', ids.slice(0, 500))
          if (!error && ids.length <= 500) approved = ((ps ?? []) as { status: string }[]).filter(p => !['archived', 'rejected'].includes(p.status)).length
        }
      }
      // Publicado e alcance: só as NOSSAS publicações (media_id dos posts), com o alcance que o Instagram mandou.
      let published: number | null = null, reach: number | null = null, reachRows: number | null = null
      if (!pubs.error && (pubs.data?.length ?? 0) < LIMIT) {
        const media = ((pubs.data ?? []) as { instagram_media_id: string }[]).map(p => p.instagram_media_id)
        published = media.length
        if (media.length === 0) { reach = 0; reachRows = 0 }
        else {
          const { data: perf, error } = await supabase.from('instagram_content_performance').select('media_id, reach').eq('company_id', companyId).in('media_id', media)
          if (!error) {
            const rows = ((perf ?? []) as { media_id: string; reach: number | null }[]).filter(r => r.reach != null)
            reachRows = new Set(rows.map(r => r.media_id)).size
            reach = rows.reduce((s, r) => s + Number(r.reach ?? 0), 0)
          }
        }
      }
      if (!cancelled) setState({ data: { generated: n(gen), archived: n(arch), approved, published, reach, reachRows }, loading: false })
    })().catch(() => { if (!cancelled) setState({ data: EMPTY, loading: false }) })
    return () => { cancelled = true }
  }, [companyId, enabled])
  return state
}
