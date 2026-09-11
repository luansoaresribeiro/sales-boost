import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { identifyCompany, resetAnalytics } from '../lib/analytics'

export interface CompanyData {
  id: string
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
}

interface CompanyContextType {
  company: CompanyData | null
  loading: boolean
  refreshCompany: () => Promise<void>
}

const CompanyContext = createContext<CompanyContextType>({
  company: null,
  loading: true,
  refreshCompany: async () => {},
})

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [company, setCompany] = useState<CompanyData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchCompany = useCallback(async () => {
    if (!user) { setCompany(null); setLoading(false); resetAnalytics(); return }
    const { data } = await supabase
      .from('companies')
      .select('id, business_name, business_type, city, phone, website_url, instagram_url, facebook_url, google_place_id, google_rating, google_review_count, instagram_user_id, plan, agent_enabled, marketing_ai_enabled, trial_started_at, trial_expires_at, trial_cancelled_at, trial_intro_seen_at, stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const c = data as CompanyData | null
    setCompany(c)
    setLoading(false)
    // Amarra o analytics à empresa deste cliente (owners não têm company → não
    // são identificados como empresa nenhuma).
    if (c) identifyCompany(c, user.id)
  }, [user])

  useEffect(() => { fetchCompany() }, [fetchCompany])

  return (
    <CompanyContext.Provider value={{ company, loading, refreshCompany: fetchCompany }}>
      {children}
    </CompanyContext.Provider>
  )
}

export const useCompany = () => useContext(CompanyContext)
