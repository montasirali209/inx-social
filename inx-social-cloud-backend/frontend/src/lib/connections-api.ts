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
    let closedAt = 0
    const cleanup = () => {
      window.removeEventListener('message', receive)
      window.removeEventListener('storage', receiveStored)
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
    window.addEventListener('message', receive)
    window.addEventListener('storage', receiveStored)
    const closedCheck = window.setInterval(() => {
      if (settled || consume(window.localStorage.getItem(storageKey))) return
      if (popup.closed) {
        closedAt ||= Date.now()
        if (Date.now() - closedAt > 2_500) finish({ ok: false, error: 'The connection window was closed before setup completed.' })
      } else closedAt = 0
    }, 400)
    const timeout = window.setTimeout(() => finish({ ok: false, error: 'The connection timed out. Please try again.' }), 5 * 60 * 1000)
  })
}

export async function connectOAuthPlatform(platform: 'linkedin' | 'youtube' | 'x') {
  const storageKey = 'inx-social-oauth-result'
  window.localStorage.removeItem(storageKey)
  const start = await apiRequest<{ authorizationUrl: string }>(`/api/social-connections/oauth/${platform}/start`, { method: 'POST', body: '{}' })
  const position = popupPosition()
  const popup = window.open(start.authorizationUrl, `inxSocialConnect-${platform}`, `popup=yes,width=${position.width},height=${position.height},left=${position.left},top=${position.top},resizable=yes,scrollbars=yes`)
  if (!popup) throw new Error('The connection popup was blocked. Allow popups for INXSocial and try again.')
  popup.focus()
  return waitForOAuthPopup(popup, (message) => message.type === 'inx-social-oauth-result' && message.platform === platform, storageKey)
}

export async function connectFacebook() {
  const state = window.crypto.randomUUID()
  const storageKey = `inx-facebook-oauth-result:${state}`
  const redirectUri = `${window.location.origin}/studio/facebook-callback.html`
  const url = new URL('https://www.facebook.com/v25.0/dialog/oauth')
  url.searchParams.set('client_id', '969283649323618')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'token')
  url.searchParams.set('scope', 'public_profile,pages_show_list,pages_read_engagement,pages_read_user_content,read_insights,pages_manage_posts,business_management,instagram_basic,instagram_manage_insights')
  url.searchParams.set('state', state)
  url.searchParams.set('auth_type', 'rerequest')
  url.searchParams.set('return_scopes', 'true')
  window.sessionStorage.setItem('inx-facebook-oauth-state', state)
  window.localStorage.removeItem(storageKey)
  const position = popupPosition()
  const popup = window.open(url.toString(), 'inxFacebookConnect', `popup=yes,width=${position.width},height=${position.height},left=${position.left},top=${position.top},resizable=yes,scrollbars=yes`)
  if (!popup) throw new Error('The Facebook popup was blocked. Allow popups for INXSocial and try again.')
  popup.focus()
  return waitForOAuthPopup(popup, (message) => message.type === 'inx-facebook-oauth-result' && message.state === state, storageKey)
}

export function syncInstagram() {
  return apiRequest('/api/social-connections/instagram/sync', { method: 'POST', body: '{}' })
}

export function disconnectSocialConnection(connectionId: string) {
  return apiRequest(`/api/social-connections/${encodeURIComponent(connectionId)}`, { method: 'DELETE' })
}

export function disconnectFacebookPage(pageId: string) {
  return apiRequest(`/api/pages/${encodeURIComponent(pageId)}`, { method: 'DELETE' })
}

export type ConnectedIdentity = {
  id: string
  connectionId: string | null
  platform: 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'x'
  displayName: string
  username: string | null
  avatarUrl: string | null
  detail: string
  status: 'connected' | 'attention'
  connectedAt: string
  lastSyncedAt: string | null
  page?: ConnectedPage
}

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
  const social = workspace.connections.flatMap((connection) => {
    const profiles = connection.profiles.filter((profile) => profile.status === 'ACTIVE')
    return (profiles.length ? profiles : [{ id: connection.id, displayName: connection.displayName, username: null, avatarUrl: null, status: 'ACTIVE' }]).map((profile) => ({
      id: profile.id,
      connectionId: connection.id,
      platform: connection.platform,
      displayName: profile.displayName || connection.displayName || `${connection.platform} account`,
      username: profile.username,
      avatarUrl: profile.avatarUrl,
      detail: connection.platform === 'instagram' ? 'Identity and insights linked' : connection.platform === 'linkedin' ? 'Identity linked' : 'Read-only connection',
      status: connection.lastError ? 'attention' as const : 'connected' as const,
      connectedAt: connection.connectedAt,
      lastSyncedAt: connection.lastSyncedAt,
    }))
  })
  return [...pages, ...social]
}
