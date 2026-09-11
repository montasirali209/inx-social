import { apiRequest } from './api-client'
import { fetchStudioOverview } from './dashboard-api'
import type { ConnectedPage, StudioOverview } from '../types/dashboard'
import type { SocialConnectionSummary } from '../types/settings'

export type ProviderState = Record<'instagram' | 'linkedin' | 'youtube' | 'x', { configured: boolean; method: string }>
export type ConnectionsWorkspace = {
  overview: StudioOverview
  connections: SocialConnectionSummary[]
  providers: ProviderState
}

type OAuthMessage = { type?: string; ok?: boolean; platform?: string; error?: string; state?: string; notice?: string }

export async function fetchConnectionsWorkspace(): Promise<ConnectionsWorkspace> {
  const [overview, social] = await Promise.all([
    fetchStudioOverview(),
    apiRequest<{ connections: SocialConnectionSummary[]; providers: ProviderState }>('/api/social-connections'),
  ])
  return { overview, connections: social.connections || [], providers: social.providers }
}

function popupPosition(width = 620, height = 760) {
  return {
    width,
    height,
    left: Math.max(0, Math.round((window.screenX || 0) + (window.outerWidth - width) / 2)),
    top: Math.max(0, Math.round((window.screenY || 0) + (window.outerHeight - height) / 2)),
  }
}

function waitForOAuthPopup(popup: Window, matcher: (message: OAuthMessage) => boolean, storageKey: string) {
  return new Promise<OAuthMessage>((resolve, reject) => {
    let settled = false
    let providerNavigationStarted = false
    let returnedFocusCheck = 0
    const cleanup = () => {
      window.removeEventListener('message', receive)
      window.removeEventListener('storage', receiveStored)
      window.removeEventListener('focus', checkAfterReturn)
      document.removeEventListener('visibilitychange', receiveVisibility)
      window.clearTimeout(returnedFocusCheck)
      window.clearInterval(closedCheck)
      window.clearTimeout(timeout)
      window.localStorage.removeItem(storageKey)
    }
    const finish = (message: OAuthMessage) => {
      if (settled) return
      settled = true
      cleanup()
      try { popup.close() } catch { /* popup may already be closed */ }
      if (!message.ok) reject(new Error(message.error || 'The social account could not be connected.'))
      else resolve(message)
    }
    const consume = (raw: string | null) => {
      if (!raw) return false
      try {
        const message = JSON.parse(raw) as OAuthMessage
        if (!matcher(message)) return false
        finish(message)
        return true
      } catch { return false }
    }
    const receive = (event: MessageEvent<OAuthMessage>) => {
      if (event.origin === window.location.origin && matcher(event.data || {})) finish(event.data)
    }
    const receiveStored = (event: StorageEvent) => {
      if (event.key === storageKey) consume(event.newValue)
    }
    const checkAfterReturn = () => {
      window.clearTimeout(returnedFocusCheck)
      returnedFocusCheck = window.setTimeout(() => {
        if (settled || consume(window.localStorage.getItem(storageKey))) return
        if (popup.closed) {
          finish({ ok: false, error: 'Connection cancelled.' })
          return
        }
        // Instagram can send a cancelled Business Login flow to its own
        // Apps & Websites screen instead of our redirect URI. If focus returns
        // to INXSocial while the provider window is still cross-origin and no
        // callback result exists, treat the abandoned attempt as cancelled and
        // close the provider popup rather than leaving the UI loading for five minutes.
        if (providerNavigationStarted) {
          finish({ ok: false, error: 'Connection cancelled.' })
        }
      }, 650)
    }
    const receiveVisibility = () => {
      if (document.visibilityState === 'visible') checkAfterReturn()
    }
    window.addEventListener('message', receive)
    window.addEventListener('storage', receiveStored)
    window.addEventListener('focus', checkAfterReturn)
    document.addEventListener('visibilitychange', receiveVisibility)
    const closedCheck = window.setInterval(() => {
      if (settled || consume(window.localStorage.getItem(storageKey))) return
      try {
        void popup.location.href
      } catch {
        providerNavigationStarted = true
      }
      if (popup.closed) finish({ ok: false, error: 'Connection cancelled.' })
    }, 400)
    const timeout = window.setTimeout(() => finish({ ok: false, error: 'The connection timed out. Please try again.' }), 5 * 60 * 1000)
  })
}

export async function connectOAuthPlatform(platform: 'instagram' | 'linkedin' | 'youtube' | 'x') {
  if (platform === 'x') throw new Error('X / Twitter is not offered by INXSocial.')
  const storageKey = 'inx-social-oauth-result'
  window.localStorage.removeItem(storageKey)
  const start = await apiRequest<{ authorizationUrl: string }>(`/api/social-connections/oauth/${platform}/start`, { method: 'POST', body: '{}' })
  const position = popupPosition()
  const popupName = platform === 'instagram'
    ? `inxSocialConnect-instagram-${window.crypto.randomUUID()}`
    : `inxSocialConnect-${platform}`
  let authorizationUrl = start.authorizationUrl
  if (platform === 'instagram') {
    // Normal Connect should let Instagram reuse an existing authorised session.
    // Forced re-authentication is reserved for an explicit account-switch flow.
    const url = new URL(start.authorizationUrl)
    url.searchParams.delete('force_authentication')
    authorizationUrl = url.toString()
  }
  const popup = window.open(authorizationUrl, popupName, `popup=yes,width=${position.width},height=${position.height},left=${position.left},top=${position.top},resizable=yes,scrollbars=yes`)
  if (!popup) throw new Error('The connection popup was blocked. Allow popups for INXSocial and try again.')
  popup.focus()
  return waitForOAuthPopup(popup, (message) => message.type === 'inx-social-oauth-result' && message.platform === platform, storageKey)
}

export async function connectFacebook() {
  const start = await apiRequest<{ authorizationUrl: string; state: string }>(
    '/api/social-connections/facebook/start',
    { method: 'POST', body: '{}' },
  )
  const state = start.state
  const storageKey = `inx-facebook-oauth-result:${state}`
  window.sessionStorage.setItem('inx-facebook-oauth-state', state)
  window.localStorage.removeItem(storageKey)
  const position = popupPosition()
  const popup = window.open(start.authorizationUrl, 'inxFacebookConnect', `popup=yes,width=${position.width},height=${position.height},left=${position.left},top=${position.top},resizable=yes,scrollbars=yes`)
  if (!popup) throw new Error('The Facebook popup was blocked. Allow popups for INXSocial and try again.')
  popup.focus()
  return waitForOAuthPopup(popup, (message) => message.type === 'inx-facebook-oauth-result' && message.state === state, storageKey)
}

export function syncInstagram() {
  return apiRequest('/api/social-connections/instagram/sync', { method: 'POST', body: '{}' })
}

export async function connectInstagram() {
  return connectOAuthPlatform('instagram')
}

export function disconnectSocialConnection(connectionId: string) {
  return apiRequest(`/api/social-connections/${encodeURIComponent(connectionId)}`, { method: 'DELETE' })
}

export function disconnectFacebookPage(pageId: string) {
  return apiRequest(`/api/pages/${encodeURIComponent(pageId)}`, { method: 'DELETE' })
}

export async function disconnectAllConnections(workspace: ConnectionsWorkspace) {
  const connectionIds = [...new Set(workspace.connections.map((connection) => connection.id).filter(Boolean))]
  const pageIds = workspace.overview.pages.filter((page) => page.status === 'ACTIVE').map((page) => page.id)
  const tasks = [
    ...connectionIds.map((connectionId) => disconnectSocialConnection(connectionId)),
    ...pageIds.map((pageId) => disconnectFacebookPage(pageId)),
  ]
  if (!tasks.length) return { disconnected: 0 }
  const results = await Promise.allSettled(tasks)
  const failed = results.filter((result) => result.status === 'rejected')
  if (failed.length) {
    throw new Error(`Disconnected ${results.length - failed.length} of ${results.length} connections. Refresh and review the remaining accounts.`)
  }
  return { disconnected: results.length }
}

export type ConnectedIdentity = {
  id: string
  connectionId: string | null
  platform: 'facebook' | 'instagram' | 'linkedin' | 'youtube'
  displayName: string
  username: string | null
  avatarUrl: string | null
  detail: string
  status: 'connected' | 'attention'
  connectedAt: string
  lastSyncedAt: string | null
  page?: ConnectedPage
}

const visibleConnectedPlatforms = new Set(['instagram', 'linkedin', 'youtube'])

export function flattenConnectedIdentities(workspace: ConnectionsWorkspace): ConnectedIdentity[] {
  const pages: ConnectedIdentity[] = workspace.overview.pages.filter((page) => page.status === 'ACTIVE').map((page) => ({
    id: page.id,
    connectionId: null,
    platform: 'facebook',
    displayName: page.facebookPageName,
    username: page.facebookPageUsername,
    avatarUrl: page.facebookPagePicture,
    detail: 'Publishing and analytics live',
    status: page.lastError ? 'attention' : 'connected',
    connectedAt: page.connectedAt,
    lastSyncedAt: page.lastSyncAt,
    page,
  }))
  const social = workspace.connections
    .filter((connection) => visibleConnectedPlatforms.has(connection.platform))
    .flatMap((connection) => {
      const profiles = connection.profiles.filter((profile) => profile.status === 'ACTIVE')
      return (profiles.length ? profiles : [{ id: connection.id, displayName: connection.displayName, username: null, avatarUrl: null, status: 'ACTIVE' }]).map((profile) => ({
        id: profile.id,
        connectionId: connection.id,
        platform: connection.platform as 'instagram' | 'linkedin' | 'youtube',
        displayName: profile.displayName || connection.displayName || `${connection.platform} account`,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
        detail: connection.platform === 'instagram'
          ? profile.capabilities?.publish ? 'Professional profile · Publishing permission granted' : 'Identity and insights linked'
          : connection.platform === 'linkedin' ? 'Identity linked' : 'Read-only connection',
        status: connection.lastError ? 'attention' as const : 'connected' as const,
        connectedAt: connection.connectedAt,
        lastSyncedAt: connection.lastSyncedAt,
      }))
    })
  return [...pages, ...social]
}
