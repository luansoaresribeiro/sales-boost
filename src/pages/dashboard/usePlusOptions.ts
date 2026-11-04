import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCatalogSchema, type CatalogSchema } from '../../lib/verticalPlaybook'
import { SUPABASE_URL } from './marketingAi/shared'
import type { MakeNowCheck, MakeNowFormat, MakeNowItem } from './plusOptions'

// Busca o que o menu do "+" precisa — SÓ quando o menu abre (não no carregamento do painel). Cache de ~60 s por
// empresa pra abrir/fechar não ficar chamando a function. Falha nunca é guardada (a próxima abertura tenta de novo).
const TTL_MS = 60_000
let checkCache: { companyId: string; at: number; value: MakeNowCheck } | null = null
let schemaCache: { verticalKey: string; at: number; value: CatalogSchema | null } | null = null

async function checkMakeNow(token: string): Promise<MakeNowCheck> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/creative-generate`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'make_now_options' }),
    })
    if (res.status === 402) return { status: 'plan' }
    if (res.status !== 200) return { status: 'failed' }
    const r = await res.json() as { formats?: MakeNowFormat[]; items?: MakeNowItem[] }
    if (!Array.isArray(r.formats)) return { status: 'failed' }
    return { status: 'ok', formats: r.formats, items: Array.isArray(r.items) ? r.items : [] }
  } catch { return { status: 'failed' } }
}

export function usePlusOptions(open: boolean, o: { companyId: string; verticalKey: string; token: string; readOnly: boolean }) {
  const { companyId, verticalKey, token, readOnly } = o
  const [schema, setSchema] = useState<CatalogSchema | null | undefined>(undefined)
  const [check, setCheck] = useState<MakeNowCheck>({ status: 'idle' })
  const seq = useRef(0)

  const refresh = useCallback(() => {
    const my = ++seq.current
    const now = Date.now()
    if (schemaCache && schemaCache.verticalKey === verticalKey && now - schemaCache.at < TTL_MS) setSchema(schemaCache.value)
    else {
      setSchema(undefined)
      void fetchCatalogSchema(verticalKey).then(v => { schemaCache = { verticalKey, at: Date.now(), value: v }; if (my === seq.current) setSchema(v) })
    }
    if (readOnly) { setCheck({ status: 'idle' }); return } // vitrine: nem chama (o guard abriria o modal de plano)
    if (checkCache && checkCache.companyId === companyId && now - checkCache.at < TTL_MS) { setCheck(checkCache.value); return }
    if (!token) { setCheck({ status: 'checking' }); return }
    setCheck({ status: 'checking' })
    void checkMakeNow(token).then(v => {
      if (v.status === 'ok' || v.status === 'plan') checkCache = { companyId, at: Date.now(), value: v }
      if (my === seq.current) setCheck(v)
    })
  }, [companyId, verticalKey, token, readOnly])

  useEffect(() => { if (open) refresh() }, [open, refresh])
  return { schema, check }
}

/** Depois de pedir uma peça, o cache de formatos/imóveis pode ter mudado. */
export function invalidatePlusCache() { checkCache = null }
