import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { TestPost } from './TestingArea'

// "Atividade do imóvel" (Pacote B1): o que já existe ligado a UM imóvel, lido só quando o dono abre o painel
// (a grade do catálogo não dispara uma consulta por card). Nada é criado nem inferido: cada bloco lê a coluna
// que a própria relação grava — peças (`item_id` em marketing_ai_test_content e posts), oportunidades
// (`growth_opportunities.item_ids`) e leads (`leads.item_id`). Cada bloco tem o seu estado (regra 5):
// carregando / dado / ausência (lista vazia) / erro ("Não foi possível verificar"). Ausência nunca é erro.
// Peça aprovada: a linha de teste é apagada e vira `posts` (mesmo item_id) — por isso as duas fontes não se repetem.

export type Block<T> = { state: 'loading' } | { state: 'error' } | { state: 'ok'; rows: T[]; capped: boolean }
export type PieceTest = TestPost & { kind?: string; planned_for?: string | null; item_id?: string | null }
export interface PiecePost { id: string; content: string | null; status: string; created_at: string; published_at: string | null }
export interface ActivityOpp { id: string; title: string; status: string; created_at: string }
export interface ActivityLead { id: string; name: string | null; contact: string | null; stage: string | null; created_at: string }
export interface ItemActivityData { tests: Block<PieceTest>; posts: Block<PiecePost>; opps: Block<ActivityOpp>; leads: Block<ActivityLead> }

const LIMIT = 50
const loading = <T,>(): Block<T> => ({ state: 'loading' })
const INITIAL: ItemActivityData = { tests: loading(), posts: loading(), opps: loading(), leads: loading() }

function toBlock<T>(r: { data: unknown; error: unknown }): Block<T> {
  if (r.error) return { state: 'error' }
  const rows = (r.data ?? []) as T[]
  return { state: 'ok', rows, capped: rows.length >= LIMIT }
}

export function useItemActivity(companyId: string, itemId: string, enabled: boolean): ItemActivityData {
  const [data, setData] = useState<ItemActivityData>(INITIAL)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    setData(INITIAL)
    const settle = <K extends keyof ItemActivityData>(k: K, p: PromiseLike<{ data: unknown; error: unknown }>) =>
      p.then(r => toBlock(r), () => ({ state: 'error' as const })).then(b => { if (alive) setData(d => ({ ...d, [k]: b })) })
    void settle('tests', supabase.from('marketing_ai_test_content').select('*').eq('company_id', companyId).eq('item_id', itemId).is('source_id', null).order('created_at', { ascending: false }).limit(LIMIT))
    void settle('posts', supabase.from('posts').select('id, content, status, created_at, published_at').eq('company_id', companyId).eq('item_id', itemId).order('created_at', { ascending: false }).limit(LIMIT))
    void settle('opps', supabase.from('growth_opportunities').select('id, title, status, created_at').eq('company_id', companyId).contains('item_ids', [itemId]).order('created_at', { ascending: false }).limit(LIMIT))
    void settle('leads', supabase.from('leads').select('id, name, contact, stage, created_at').eq('company_id', companyId).eq('item_id', itemId).order('created_at', { ascending: false }).limit(LIMIT))
    return () => { alive = false }
  }, [companyId, itemId, enabled])
  return data
}
