import { useEffect, useState, type ReactNode } from 'react'
import { apiRequest, getStoredAuthToken } from '../../lib/api-client'

type AuthState = 'checking' | 'authenticated'

function loginUrl() {
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
  return `/portal/login.html?return=${encodeURIComponent(returnTo)}`
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>('checking')

  useEffect(() => {
    let active = true
    const token = getStoredAuthToken()
    if (!token) {
      window.location.replace(loginUrl())
      return () => { active = false }
    }

    apiRequest<{ user: unknown }>('/api/auth/me')
      .then(() => { if (active) setState('authenticated') })
      .catch(() => {
        window.localStorage.removeItem('inx-social-cloud-token')
        window.localStorage.removeItem('inxToken')
        window.location.replace(loginUrl())
      })

    return () => { active = false }
  }, [])

  if (state !== 'authenticated') {
    return <div className="grid min-h-dvh place-items-center bg-bg px-6 text-center text-text-main"><div><div className="mx-auto size-9 animate-spin rounded-full border-2 border-brand-cyan/20 border-t-brand-cyan" /><p className="mt-4 text-sm text-text-muted">Checking your secure INXSocial session…</p></div></div>
  }

  return <>{children}</>
}
