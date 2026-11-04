import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type UserRole = 'owner' | 'client'

interface AuthContextType {
  user: User | null
  session: Session | null
  role: UserRole | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null; role: UserRole | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function fetchRole(email: string): Promise<UserRole> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('email', email)
    .maybeSingle()
  return (data?.role as UserRole) ?? 'client'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user?.email) {
        const r = await fetchRole(session.user.email)
        if (mounted) setRole(r)
      }
      setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      // Link de "Esqueceu a senha?": se o Supabase devolver a pessoa em outra página (URL fora da lista de
      // redirecionamento cai no Site URL), leva pra tela de nova senha em vez de entrar direto no painel.
      if (event === 'PASSWORD_RECOVERY' && window.location.pathname !== '/reset-password') {
        window.location.assign('/reset-password')
        return
      }
      setSession(session)
      // Keep the same `user` object reference when it's still the same account —
      // Supabase fires this on every silent token refresh (incl. on tab focus),
      // and a fresh reference here re-triggers every `useEffect(..., [user])`
      // across the app, silently re-fetching and blowing away unsaved edits.
      setUser(prev => (prev?.id === session?.user?.id ? prev : session?.user ?? null))
      if (session?.user?.email) {
        const r = await fetchRole(session.user.email)
        if (mounted) setRole(r)
      } else {
        setRole(null)
      }
    })

    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  const signIn = async (email: string, password: string): Promise<{ error: string | null; role: UserRole | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message, role: null }
    const r = await fetchRole(email)
    setRole(r)
    return { error: null, role: r }
  }

  const signUp = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }

  const signInWithMagicLink = async (email: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      // Login must never create an account. Magic link only signs IN existing
      // users; new users go through /signup. Keeps login and cadastro separate.
      options: { shouldCreateUser: false },
    })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setRole(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signIn, signUp, signInWithMagicLink, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
