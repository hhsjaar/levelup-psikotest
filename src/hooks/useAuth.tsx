import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthCtx {
  session: Session | null
  loading: boolean
  isAdmin: boolean
  refreshAdmin: () => Promise<boolean>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({} as AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  async function checkAdmin(s: Session | null) {
    if (!s) { setIsAdmin(false); return false }
    const { data } = await supabase.from('admins').select('user_id').eq('user_id', s.user.id).maybeSingle()
    const ok = Boolean(data)
    setIsAdmin(ok)
    return ok
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await checkAdmin(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      // jangan await di dalam callback (hindari deadlock supabase-js)
      setTimeout(() => checkAdmin(s), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <Ctx.Provider
      value={{
        session,
        loading,
        isAdmin,
        refreshAdmin: async () => {
          const { data } = await supabase.auth.getSession()
          setSession(data.session)
          return checkAdmin(data.session)
        },
        signOut: async () => { await supabase.auth.signOut(); setIsAdmin(false) },
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
