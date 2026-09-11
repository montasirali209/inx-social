import { useEffect, useState, type ReactNode } from 'react'
import { apiRequest } from '../../lib/api-client'
import {
  getStoredAuthToken,
  invalidateAuthSession,
  loginUrl,
  setCurrentAuthUserId,
  subscribeToAuthSession,
} from '../../lib/auth-session'

type AuthState = 'checking' | 'authenticated'
type MeResponse = { user: { id?: string } }

export function RequireAuth({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>('checking')

  useEffect(() => {
    let active = true
    let redirecting = false

    function redirectToLogin() {
      if (redirecting) return
      redirecting = true
      setState('checking')
      window.location.replace(loginUrl())
    }

    const unsubscribe = subscribeToAuthSession((event) => {
      if (!active) return
      if (event.type === 'logout' || event.type === 'expired') redirectToLogin()
    })

    if (!getStoredAuthToken()) {
      redirectToLogin()
      return () => { active = false; unsubscribe() }
    }

    apiRequest<MeResponse>('/api/auth/me')
      .then((payload) => {
        if (!active) return
        setCurrentAuthUserId(payload.user?.id)
        setState('authenticated')
      })
      .catch(() => {
        if (!active) return
        invalidateAuthSession('expired', 'require-auth')
        redirectToLogin()
      })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  if (state !== 'authenticated') {
    return <div className="grid min-h-dvh place-items-center bg-bg px-6 text-center text-text-main"><div><div className="mx-auto size-9 animate-spin rounded-full border-2 border-brand-cyan/20 border-t-brand-cyan" /><p className="mt-4 text-sm text-text-muted">Checking your secure INXSocial session…</p></div></div>
  }

  return <>{children}</>
}
