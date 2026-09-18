import { apiRequest } from './api-client'
import { fetchStudioOverview } from './dashboard-api'
import type { Platform, PlatformAnalytics, StudioOverview } from '../types/dashboard'
import type { SocialConnectionSummary, SocialPlatform } from '../types/settings'

export type AnalyticsSourceAccount = {
  analyticsKey: string
  id: string
  platform: SocialPlatform
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

const allAnalyticsPlatforms = new Set<SocialPlatform>([
  'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'threads', 'bluesky', 'x',
])

export async function fetchAnalyticsSources(): Promise<{ overview: StudioOverview; accounts: AnalyticsSourceAccount[] }> {
  const [overview, social] = await Promise.all([
    fetchStudioOverview(),
    apiRequest<ConnectionsResponse>('/api/social-connections'),
  ])

  const accounts: AnalyticsSourceAccount[] = (social.connections || [])
    .filter(connection => allAnalyticsPlatforms.has(connection.platform) && connection.status === 'ACTIVE')
    .flatMap(connection => connection.profiles
      .filter(profile => profile.status === 'ACTIVE')
      .map(profile => ({
        analyticsKey: `${connection.platform}:${profile.id}`,
        id: profile.id,
        platform: connection.platform,
        displayName: profile.displayName || connection.displayName || `${connection.platform} account`,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
        detail: profile.profileType || 'Connected profile',
        status: connection.lastError ? 'attention' as const : 'connected' as const,
        connectedAt: connection.connectedAt,
        lastSyncedAt: connection.lastSyncedAt,
        connectionId: connection.id,
      })))

  return { overview, accounts }
}

export async function fetchAnalyticsForSource(account: AnalyticsSourceAccount, days = 30): Promise<PlatformAnalytics> {
  const result = await apiRequest<{ analytics: PlatformAnalytics }>(
    `/api/studio/analytics/source?platform=${encodeURIComponent(account.platform)}&profileId=${encodeURIComponent(account.id)}&days=${days}`,
  )
  return result.analytics
}

function mergeSeries(results: PlatformAnalytics[], key: string) {
  const values = new Map<string, number>()
  results.forEach(result => (result.series?.[key] || []).forEach(point => values.set(point.date, (values.get(point.date) || 0) + Number(point.value || 0))))
  return [...values.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, value]) => ({ date, value }))
}

export function mergeAnalyticsResults(results: PlatformAnalytics[], accounts: AnalyticsSourceAccount[], days: number): PlatformAnalytics | null {
  if (!results.length) return null
  if (results.length === 1) return results[0]
  const first = results[0]
  const summary = results.reduce((acc, result) => ({
    followers: acc.followers + Number(result.summary.followers || 0),
    posts: acc.posts + Number(result.summary.posts || 0),
    reactions: acc.reactions + Number(result.summary.reactions || 0),
    comments: acc.comments + Number(result.summary.comments || 0),
    shares: acc.shares + Number(result.summary.shares || 0),
    engagements: acc.engagements + Number(result.summary.engagements || 0),
    totalInteractions: acc.totalInteractions + Number(result.summary.totalInteractions || 0),
    views: acc.views + Number(result.summary.views || result.summary.postViews || 0),
    postViews: acc.postViews + Number(result.summary.postViews || 0),
    uniqueViewers: acc.uniqueViewers + Number(result.summary.uniqueViewers || 0),
    clicks: acc.clicks + Number(result.summary.clicks || 0),
    follows: acc.follows + Number(result.summary.follows || 0),
    pageEngagements: acc.pageEngagements + Number(result.summary.pageEngagements || 0),
  }), { followers: 0, posts: 0, reactions: 0, comments: 0, shares: 0, engagements: 0, totalInteractions: 0, views: 0, postViews: 0, uniqueViewers: 0, clicks: 0, follows: 0, pageEngagements: 0 })
  const platforms = [...new Set(results.map(result => result.platform))] as Platform[]
  const content = results.flatMap((result, resultIndex) => result.content.map(item => ({ ...item, id: `${accounts[resultIndex]?.analyticsKey || result.platform}:${item.id}` })))
  const engagementRate = summary.views > 0 ? Number((summary.totalInteractions / summary.views * 100).toFixed(2)) : null
  const metricAvailable = results.some(result => result.capabilities?.pageInsights.available)
  const contentAvailable = results.some(result => result.capabilities?.publishedContent.available)
  const capability = (available: boolean, reason: string) => ({ state: available ? 'available' : 'no_data', available, reason, metaCode: null })

  return {
    ...first,
    platform: platforms[0] || first.platform,
    fetchedAt: new Date().toISOString(),
    period: { days, since: results.map(result => result.period?.since).filter(Boolean).sort()[0] || '', until: results.map(result => result.period?.until).filter(Boolean).sort().at(-1) || '' },
    page: { id: `combined:${accounts.map(account => account.id).join(',')}`, name: `${accounts.length} selected accounts`, username: null, followers: summary.followers, pictureUrl: null },
    capabilities: {
      basicEngagement: capability(metricAvailable, 'Aggregated live metrics from the selected accounts.'),
      publishedContent: capability(contentAvailable, 'Aggregated connected-account feeds from the selected accounts.'),
      pageInsights: capability(metricAvailable, 'Aggregated post-level analytics from the selected accounts.'),
      postInsights: capability(metricAvailable, 'Post-level metrics are combined across selected destinations.'),
      instagramDemographics: capability(false, 'Audience demographics are not available from the current connected-account data.'),
      metrics: {},
    },
    summary: {
      ...summary,
      views: metricAvailable ? summary.views : null,
      follows: summary.follows || null,
      pageEngagements: summary.pageEngagements,
      engagementRate,
      calculationNote: `Aggregated from ${accounts.length} selected connected accounts.`,
    },
    series: {
      views: mergeSeries(results, 'views'),
      engagements: mergeSeries(results, 'engagements'),
      follows: mergeSeries(results, 'follows'),
    },
    demographics: { instagram: null, facebookSnapshot: null },
    content,
    warnings: results.flatMap(result => result.warnings || []),
    scope: { accountCount: accounts.length, platforms, label: platforms.length === 1 ? `${accounts.length} ${platforms[0]} accounts` : `${accounts.length} selected accounts` },
  } as PlatformAnalytics
}
