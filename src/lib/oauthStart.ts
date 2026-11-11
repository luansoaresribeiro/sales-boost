// Início seguro das conexões OAuth (N1, 2026-11-11): a tela pede o link ao servidor COM o login do dono; o servidor
// confere que a empresa é dele e devolve o link da Meta com um `state` assinado (vale 15 min). Só então abre.
// Antes era um link direto (?company_id=) sem login — quem soubesse o id ligava a própria conta na empresa de outro.
import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

export type OAuthStartFn = 'instagram-oauth-start' | 'meta-business-oauth-start' | 'meta-ads-oauth-start'

export async function startOAuth(fn: OAuthStartFn, companyId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ company_id: companyId }),
  })
  const data = await res.json().catch(() => ({})) as { url?: string; error?: string }
  if (!res.ok || !data.url) throw new Error(data.error ?? 'Não consegui abrir a conexão agora. Tente de novo em alguns minutos.')
  window.location.assign(data.url)
}
