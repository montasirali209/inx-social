const TOKEN_KEYS = ['inx-social-cloud-token', 'inxToken'] as const
const AUTH_EVENT_KEY = 'inx-social-auth-event-v1'
const AUTH_USER_KEY = 'inx-social-auth-user-id'
const AUTH_CHANNEL = 'inx-social-auth-v1'

export type AuthSessionEvent = {
  type: 'logout' | 'expired' | 'login'
  at: number
  source?: string
}

export function getStoredAuthToken() {
  for (const key of TOKEN_KEYS) {
    const value = window.localStorage.getItem(key)
    if (value) return value
  }
  return ''
}

export function getCurrentAuthUserId() {
  return window.localStorage.getItem(AUTH_USER_KEY) || ''
}

export function setCurrentAuthUserId(userId: string | null | undefined) {
  if (userId) window.localStorage.setItem(AUTH_USER_KEY, String(userId))
}

export function loginUrl() {
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
  return `/portal/login.html?return=${encodeURIComponent(returnTo)}`
}

function publish(event: AuthSessionEvent) {
  try { window.localStorage.setItem(AUTH_EVENT_KEY, JSON.stringify(event)) } catch { /* storage can be unavailable */ }
  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(AUTH_CHANNEL)
      channel.postMessage(event)
      channel.close()
    }
  } catch { /* storage event remains the fallback */ }
  window.dispatchEvent(new CustomEvent<AuthSessionEvent>('inxsocial:auth-session', { detail: event }))
}

export function clearAuthTokens() {
  TOKEN_KEYS.forEach((key) => window.localStorage.removeItem(key))
}

export function invalidateAuthSession(type: 'logout' | 'expired' = 'logout', source = 'app') {
  clearAuthTokens()
  publish({ type, at: Date.now(), source })
}

export function announceLogin(userId?: string | null, source = 'login') {
  setCurrentAuthUserId(userId)
  publish({ type: 'login', at: Date.now(), source })
}

export function subscribeToAuthSession(listener: (event: AuthSessionEvent) => void) {
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<AuthSessionEvent>).detail
    if (detail) listener(detail)
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === AUTH_EVENT_KEY && event.newValue) {
      try { listener(JSON.parse(event.newValue) as AuthSessionEvent) } catch { /* ignore malformed storage */ }
      return
    }
    if ((TOKEN_KEYS as readonly string[]).includes(event.key || '') && !getStoredAuthToken()) {
      listener({ type: 'logout', at: Date.now(), source: 'storage' })
    }
  }
  let channel: BroadcastChannel | null = null
  const onBroadcast = (event: MessageEvent<AuthSessionEvent>) => { if (event.data) listener(event.data) }
  window.addEventListener('inxsocial:auth-session', onCustom)
  window.addEventListener('storage', onStorage)
  try {
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(AUTH_CHANNEL)
      channel.addEventListener('message', onBroadcast)
    }
  } catch { channel = null }
  return () => {
    window.removeEventListener('inxsocial:auth-session', onCustom)
    window.removeEventListener('storage', onStorage)
    channel?.removeEventListener('message', onBroadcast)
    channel?.close()
  }
}
