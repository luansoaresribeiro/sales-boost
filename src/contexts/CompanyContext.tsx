import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { identifyCompany, resetAnalytics } from '../lib/analytics'

export interface CompanyData {
  id: string
  created_at: string | null
  business_name: string
  business_type: string | null
  city: string | null
  phone: string | null
  website_url: string | null
  instagram_url: string | null
  facebook_url: string | null
  google_place_id: string | null
  google_rating: number | null
  google_review_count: number | null
  instagram_user_id: string | null
  plan: string | null
  agent_enabled: boolean
  marketing_ai_enabled: boolean
  trial_started_at: string | null
  trial_expires_at: string | null
  trial_cancelled_at: string | null
  trial_intro_seen_at: string | null
  stripe_subscription_id: string | null
  access_blocked_reason: string | null
  language: string | null
  vertical_key: string | null
  playbook_answers: Record<string, unknown> | null
}

export type AccessSource = 'paid' | 'trial' | 'manual' | 'blocked' | 'none'
export type AccessStatusLabel = 'Active' | 'Trial' | 'Expired' | 'Suspended' | 'Cancelled'
export interface AccessInfo { granted: boolean; source: AccessSource; status_label: AccessStatusLabel }

interface CompanyContextType {
  company: CompanyData | null
  access: AccessInfo | null
  loading: boolean
  // A busca da empresa falhou (rede/Supabase) — NÃO é "não tem empresa".
  loadError: boolean
  refreshCompany: () => Promise<void>
}

const CompanyContext = createContext<CompanyContextType>({
  company: null,
  access: null,
  loading: true,
  loadError: false,
  refreshCompany: async () => {},
})

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [company, setCompany] = useState<CompanyData | null>(null)
  const [access, setAccess] = useState<AccessInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  // Pra qual usuário a empresa já foi buscada. Sem isso, a 1a busca (feita
  // antes do login terminar, com user=null) marcava "carregado, sem empresa"
  // e a rota mandava pro /onboarding no meio da busca de verdade (bug do
  // "recarreguei e caí no onboarding", 2026-10-02).
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined)

  const fetchCompany = useCallback(async () => {
    if (!user) { setCompany(null); setAccess(null); setLoadError(false); setLoadedFor(null); setLoading(false); resetAnalytics(); return }
    const { data, error } = await supabase
      .from('companies')
      .select('id, created_at, business_name, business_type, city, phone, website_url, instagram_url, facebook_url, google_place_id, google_rating, google_review_count, instagram_user_id, plan, agent_enabled, marketing_ai_enabled, trial_started_at, trial_expires_at, trial_cancelled_at, trial_intro_seen_at, stripe_subscription_id, access_blocked_reason, language, vertical_key, playbook_answers')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) {
      // Falha de rede/servidor: mantém o que já havia e avisa, em vez de
      // tratar como "conta sem empresa" (que mandaria pro onboarding).
      setLoadError(true)
      setLoadedFor(user.id)
      setLoading(false)
      return
    }
    setLoadError(false)
    const c = data as CompanyData | null
    setCompany(c)
    // Mesma função central usada pelo botão Liberar/Bloquear do Owner
    // (migration 049, company_access_status) — nunca duplicar essa lógica
    // aqui, senão o dashboard e a ficha do Owner podem discordar.
    if (c) {
      const { data: acc } = await supabase.rpc('company_access_status', { p_company_id: c.id }).maybeSingle()
      setAccess((acc as AccessInfo) ?? null)
    } else {
      setAccess(null)
    }
    setLoadedFor(user.id)
    setLoading(false)
    // Amarra o analytics à empresa deste cliente (owners não têm company → não
    // são identificados como empresa nenhuma).
    if (c) identifyCompany(c, user.id)
  }, [user])

  useEffect(() => { fetchCompany() }, [fetchCompany])

  return (
    <CompanyContext.Provider value={{ company, access, loading: loading || (!!user && loadedFor !== user.id), loadError, refreshCompany: fetchCompany }}>
      {children}
    </CompanyContext.Provider>
  )
}

export const useCompany = () => useContext(CompanyContext)
