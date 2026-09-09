import { apiRequest } from './api-client'
import { fetchFacebookDashboardAnalytics, fetchStudioOverview } from './dashboard-api'
import type { PlatformAnalytics, StudioOverview } from '../types/dashboard'
import type { SocialConnectionSummary } from '../types/settings'

export type AnalyticsSourceAccount = {
  analyticsKey: string
  id: string
  platform: 'facebook' | 'instagram' | 'linkedin' | 'youtube'
  displayName: string
  username: string | null
  avatarUrl: string | null
  detail: string
  status: 'connected' | 'attention'
  connectedAt: string
  lastSyncedAt: string | null
  connectionId: string | null
}

type ConnectionsResponse = { connections: SocialConnectionSummary[] }

export async function fetchAnalyticsSources(): Promise<{ overview: StudioOverview; accounts: AnalyticsSourceAccount[] }> {
  const [overview, social] = await Promise.all([
    fetchStudioOverview(),
    apiRequest<ConnectionsResponse>('/api/social-connections'),
  ])
  const facebook: AnalyticsSourceAccount[] = (overview.pages || [])
    .filter(page => page.status !== 'REVOKED')
    .map(page => ({
      analyticsKey: `facebook:${page.id}`,
      id: page.id,
      platform: 'facebook',
      displayName: page.facebookPageName,
      username: page.facebookPageUsername,
      avatarUrl: page.facebookPagePicture,
      detail: page.facebookCategory || 'Facebook Page',
      status: page.lastError ? 'attention' : 'connected',
      connectedAt: page.connectedAt,
      lastSyncedAt: page.lastSyncAt,
      connectionId: null,
    }))
  const socialAccounts: AnalyticsSourceAccount[] = (social.connections || [])
    .filter(connection => ['instagram', 'linkedin', 'youtube'].includes(connection.platform) && connection.status === 'ACTIVE')
    .flatMap(connection => connection.profiles
      .filter(profile => profile.status === 'ACTIVE')
      .map(profile => ({
        analyticsKey: `${connection.platform}:${profile.id}`,
        id: profile.id,
        platform: connection.platform as 'instagram' | 'linkedin' | 'youtube',
        displayName: profile.displayName || connection.displayName || `${connection.platform} account`,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
        detail: profile.profileType || 'Profile',
        status: connection.lastError ? 'attention' as const : 'connected' as const,
        connectedAt: connection.connectedAt,
        lastSyncedAt: connection.lastSyncedAt,
        connectionId: connection.id,
      })))
  return { overview, accounts: [...facebook, ...socialAccounts] }
}

export async function fetchAnalyticsForSource(account: AnalyticsSourceAccount, days = 30, force = false): Promise<PlatformAnalytics> {
  if (account.platform === 'facebook') return fetchFacebookDashboardAnalytics(account.id, days, force)
  const result = await apiRequest<{ analytics: PlatformAnalytics }>(
    `/api/studio/analytics/source?platform=${encodeURIComponent(account.platform)}&profileId=${encodeURIComponent(account.id)}&days=${days}${force ? '&force=true' : ''}`,
  )
  return result.analytics
}
