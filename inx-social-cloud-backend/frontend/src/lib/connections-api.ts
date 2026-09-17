import { apiRequest } from './api-client'
import { fetchStudioOverview } from './dashboard-api'
import type { ConnectedPage, StudioOverview } from '../types/dashboard'
import type { SocialConnectionSummary, SocialPlatform } from '../types/settings'

export type ProviderDescriptor = { configured: boolean; method: string; providerEngine?: string }
export type ProviderState = Record<SocialPlatform, ProviderDescriptor>
export type ConnectionsWorkspace = {
  overview: StudioOverview
  connections: SocialConnectionSummary[]
  providers: ProviderState
}

type OAuthMessage = { type?: string; ok?: boolean; platform?: string; error?: string; state?: string; notice?: string }
export type PostForMeConnectionInput = { handle?: string; appPassword?: string; connectionType?: 'instagram' | 'facebook' }

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
        if (providerNavigationStarted) finish({ ok: false, error: 'Connection cancelled.' })
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
      try { void popup.location.href } catch { providerNavigationStarted = true }
      if (popup.closed) finish({ ok: false, error: 'Connection cancelled.' })
    }, 400)
    const timeout = window.setTimeout(() => finish({ ok: false, error: 'The connection timed out. Please try again.' }), 5 * 60 * 1000)
  })
}

export async function connectPostForMePlatform(platform: SocialPlatform, input: PostForMeConnectionInput = {}) {
  const storageKey = 'inx-social-oauth-result'
  window.localStorage.removeItem(storageKey)
  const start = await apiRequest<{ authorizationUrl: string }>(`/api/social-connections/post-for-me/${platform}/start`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  const position = popupPosition()
  const popup = window.open(start.authorizationUrl, `inxSocialConnect-${platform}-${window.crypto.randomUUID()}`, `popup=yes,width=${position.width},height=${position.height},left=${position.left},top=${position.top},resizable=yes,scrollbars=yes`)
  if (!popup) throw new Error('The connection popup was blocked. Allow popups for INXSocial and try again.')
  popup.focus()
  return waitForOAuthPopup(popup, (message) => message.type === 'inx-social-oauth-result' && (!message.platform || message.platform === platform), storageKey)
}

// Compatibility wrappers used by existing screens while the migration is rolled out.
export function connectOAuthPlatform(platform: Exclude<SocialPlatform, 'facebook' | 'instagram'>) {
  return connectPostForMePlatform(platform)
}

export function connectFacebook() {
  return connectPostForMePlatform('facebook')
}

export function connectInstagram() {
  return connectPostForMePlatform('instagram')
}

export function syncInstagram() {
  return apiRequest('/api/social-connections/post-for-me/sync', { method: 'POST', body: '{}' })
}

export function syncPostForMeConnections() {
  return apiRequest('/api/social-connections/post-for-me/sync', { method: 'POST', body: '{}' })
}

export function disconnectSocialConnection(connectionId: string) {
  return apiRequest(`/api/social-connections/${encodeURIComponent(connectionId)}`, { method: 'DELETE' })
}

export function disconnectFacebookPage(pageId: string) {
  return apiRequest(`/api/pages/${encodeURIComponent(pageId)}`, { method: 'DELETE' })
}

function usesPostForMe(workspace: ConnectionsWorkspace) {
  return Object.values(workspace.providers || {}).some((provider) => provider?.providerEngine === 'POST_FOR_ME')
}

export async function disconnectAllConnections(workspace: ConnectionsWorkspace) {
  const connectionIds = [...new Set(workspace.connections.map((connection) => connection.id).filter(Boolean))]
  const pageIds = usesPostForMe(workspace) ? [] : workspace.overview.pages.filter((page) => page.status === 'ACTIVE').map((page) => page.id)
  const tasks = [
    ...connectionIds.map((connectionId) => disconnectSocialConnection(connectionId)),
    ...pageIds.map((pageId) => disconnectFacebookPage(pageId)),
  ]
  if (!tasks.length) return { disconnected: 0 }
  const results = await Promise.allSettled(tasks)
  const failed = results.filter((result) => result.status === 'rejected')
  if (failed.length) throw new Error(`Disconnected ${results.length - failed.length} of ${results.length} connections. Refresh and review the remaining accounts.`)
  return { disconnected: results.length }
}

export type ConnectedIdentity = {
  id: string
  connectionId: string | null
  platform: SocialPlatform
  displayName: string
  username: string | null
  avatarUrl: string | null
  detail: string
  status: 'connected' | 'attention'
  connectedAt: string
  lastSyncedAt: string | null
  page?: ConnectedPage
}

const visibleConnectedPlatforms = new Set<SocialPlatform>(['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'threads', 'bluesky', 'x'])

function identityDetail(platform: SocialPlatform, profileType?: string) {
  if (platform === 'youtube') return 'Channel · Publishing and analytics enabled'
  if (platform === 'facebook') return 'Facebook destination · Publishing and analytics enabled'
  if (platform === 'instagram') return 'Instagram destination · Publishing and analytics enabled'
  if (platform === 'linkedin') return 'LinkedIn destination · Publishing enabled'
  if (platform === 'pinterest') return 'Pinterest destination · Publishing and analytics enabled'
  if (platform === 'tiktok') return `${profileType === 'BUSINESS' ? 'Business account' : 'TikTok account'} · Publishing and analytics enabled`
  if (platform === 'threads') return 'Threads profile · Publishing and analytics enabled'
  if (platform === 'bluesky') return 'Bluesky profile · Publishing enabled'
  return 'X profile · Publishing and analytics enabled'
}

export function flattenConnectedIdentities(workspace: ConnectionsWorkspace): ConnectedIdentity[] {
  const legacyPages: ConnectedIdentity[] = usesPostForMe(workspace) ? [] : workspace.overview.pages.filter((page) => page.status === 'ACTIVE').map((page) => ({
    id: page.id,
    connectionId: null,
    platform: 'facebook',
    displayName: page.facebookPageName,
    username: page.facebookPageUsername,
    avatarUrl: `/api/studio/pages/${encodeURIComponent(page.id)}/picture`,
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
      return (profiles.length ? profiles : [{ id: connection.id, displayName: connection.displayName, username: null, avatarUrl: null, status: 'ACTIVE', profileType: 'PROFILE' }]).map((profile) => ({
        id: profile.id,
        connectionId: connection.id,
        platform: connection.platform,
        displayName: profile.displayName || connection.displayName || `${connection.platform} account`,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
        detail: identityDetail(connection.platform, profile.profileType),
        status: connection.lastError ? 'attention' as const : 'connected' as const,
        connectedAt: connection.connectedAt,
        lastSyncedAt: connection.lastSyncedAt,
      }))
    })
  return [...legacyPages, ...social]
}
