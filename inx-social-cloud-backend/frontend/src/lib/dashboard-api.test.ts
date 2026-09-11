import { describe, expect, it } from 'vitest'
import { buildActivitySeries, buildDashboardView, selectDashboardAnalyticsPage, videoStatus } from './dashboard-api'
import type { ConnectedPage, DashboardAnalyticsEntry, DashboardJob, FacebookAnalytics, PlatformAnalytics, StudioOverview } from '../types/dashboard'

const overview: StudioOverview = {
  user: { id: 'user-1', name: 'Ali', businessName: 'INX Social', email: 'ali@example.com' },
  license: {
    allowed: true,
    plan: 'PRO',
    subscriptionStatus: 'ACTIVE',
    trialEndsAt: null,
    limits: { pages: 50, batchPosts: null, devices: 3 },
  },
  pages: [],
  summary: {
    total: 6,
    draft: 0,
    awaitingUpload: 0,
    ready: 1,
    queued: 1,
    processing: 1,
    scheduled: 1,
    published: 1,
    failed: 1,
    cancelled: 0,
  },
}

function job(status: DashboardJob['status'], overrides: Partial<DashboardJob> = {}): DashboardJob {
  return {
    id: `${status}-${overrides.scheduledAt || overrides.completedAt || 'item'}`,
    status,
    uploadStatus: null,
    publishMode: 'SCHEDULED',
    contentType: 'VIDEO',
    title: status,
    caption: null,
    localFileName: `${status}.mp4`,
    mediaLibraryAssetId: null,
    scheduledAt: null,
    completedAt: null,
    errorMessage: null,
    createdAt: '2026-08-28T09:00:00.000Z',
    updatedAt: '2026-08-28T09:00:00.000Z',
    page: null,
    asset: null,
    ...overrides,
  }
}

function analytics(platform: PlatformAnalytics['platform'], id: string, interactions: number): PlatformAnalytics {
  return {
    platform,
    fetchedAt: '2026-08-29T10:00:00.000Z',
    period: { days: 30, since: '2026-07-31', until: '2026-08-29' },
    page: { id, name: `${platform} account` },
    summary: {
      followers: 100,
      posts: 1,
      reactions: interactions - 6,
      comments: 4,
      shares: 2,
      engagements: interactions,
      totalInteractions: interactions,
      views: 500,
      postViews: 450,
      uniqueViewers: 300,
      clicks: 5,
      engagementRate: 10.33,
      calculationNote: 'Verified provider data.',
    },
    content: [{
      id: `${id}_post-1`,
      message: `${platform} launch update`,
      createdTime: '2026-08-29T08:00:00.000Z',
      permalinkUrl: null,
      thumbnailUrl: 'https://example.test/post.jpg',
      contentType: 'post',
      reactions: interactions - 6,
      comments: 4,
      shares: 2,
      insights: { views: 450, uniqueViewers: 300, clicks: 5, engagement: interactions, totalInteractions: interactions, engagementRate: 10.33 },
    }],
  }
}

describe('dashboard data mapping', () => {
  it('derives operational KPI, queue and upcoming values from all workspace jobs', () => {
    const now = new Date('2026-08-29T10:00:00.000Z')
    const data = buildDashboardView(overview, [
      job('READY'),
      job('QUEUED'),
      job('PROCESSING'),
      job('SCHEDULED', { scheduledAt: '2026-08-29T16:00:00.000Z' }),
      job('PUBLISHED', { completedAt: '2026-08-28T11:00:00.000Z' }),
      job('FAILED'),
    ], now)

    expect(data.stats.map((item) => item.value)).toEqual([1, 1, 3, 1, '—', 0])
    expect(data.queue).toHaveLength(5)
    expect(data.upcoming).toHaveLength(1)
    expect(data.activeTransfer?.status).toBe('PROCESSING')
    expect(data.recentPosts).toHaveLength(5)
    expect(data.platformMetrics.find((item) => item.platform === 'facebook')?.posts).toBe(1)
    expect(data.platformMetrics.find((item) => item.platform === 'instagram')?.posts).toBe(0)
  })

  it('aggregates live content and engagement across connected platforms', () => {
    const facebook = analytics('facebook', 'fb-1', 31)
    const instagram = analytics('instagram', 'ig-1', 19)
    const entries: DashboardAnalyticsEntry[] = [
      { accountId: 'fb-1', platform: 'facebook', sourceName: 'Facebook Page', analytics: facebook },
      { accountId: 'ig-1', platform: 'instagram', sourceName: 'Instagram Profile', analytics: instagram },
    ]
    const data = buildDashboardView(overview, [job('PUBLISHED')], new Date('2026-08-29T10:00:00.000Z'), entries, 2)

    expect(data.stats.find((item) => item.label === 'Total Published')?.value).toBe(2)
    expect(data.stats.find((item) => item.label === 'Total Engagement')?.value).toBe(50)
    expect(data.stats.find((item) => item.label === 'Connected Accounts')?.value).toBe(2)
    expect(data.recentPosts.map((post) => post.platforms[0])).toEqual(expect.arrayContaining(['facebook', 'instagram']))
    expect(data.platformMetrics.find((item) => item.platform === 'facebook')?.engagement).toBe(31)
    expect(data.platformMetrics.find((item) => item.platform === 'instagram')?.engagement).toBe(19)
    expect(data.topContent[0].metrics?.views).toBe(450)
  })

  it('keeps the legacy Facebook page resolver available for dedicated analytics callers', () => {
    const connectedPage = (id: string, isSelected: boolean): ConnectedPage => ({
      id,
      facebookPageId: `meta-${id}`,
      facebookPageName: `Page ${id}`,
      facebookPageUsername: null,
      facebookPagePicture: null,
      facebookCategory: 'Business',
      status: 'ACTIVE',
      isSelected,
      connectedAt: '2026-08-01T10:00:00.000Z',
      lastCheckedAt: null,
      lastSyncAt: null,
      lastError: null,
    })
    const pages = [connectedPage('first', true), connectedPage('dashboard-choice', false)]

    expect(selectDashboardAnalyticsPage(pages, 'dashboard-choice')?.id).toBe('dashboard-choice')
    expect(selectDashboardAnalyticsPage(pages, 'missing')?.id).toBe('first')
  })

  it('maps every backend state to a customer-facing publishing state', () => {
    expect(videoStatus('PROCESSING')).toBe('publishing')
    expect(videoStatus('FAILED')).toBe('failed')
    expect(videoStatus('AWAITING_UPLOAD')).toBe('pending_review')
  })

  it('supports a legacy single Facebook analytics payload without mislabelling views as engagement', () => {
    const live = analytics('facebook', 'page-1', 31) as FacebookAnalytics
    const data = buildDashboardView(overview, [job('PUBLISHED')], new Date('2026-08-29T10:00:00.000Z'), live)

    expect(data.stats.find((item) => item.label === 'Total Engagement')?.value).toBe(31)
    expect(data.recentPosts[0].engagement).toBe(31)
    expect(data.recentPosts[0].metrics?.views).toBe(450)
    expect(data.platformMetrics.find((item) => item.platform === 'facebook')?.engagement).toBe(31)
    expect(data.topContent[0].engagement).toBe(31)
  })

  it('builds activity from live provider posts and scheduled workspace jobs', () => {
    const entries: DashboardAnalyticsEntry[] = [{
      accountId: 'fb-1',
      platform: 'facebook',
      sourceName: 'Facebook Page',
      analytics: analytics('facebook', 'fb-1', 31),
    }]
    const points = buildActivitySeries([
      job('SCHEDULED', { scheduledAt: '2026-08-29T16:00:00.000Z' }),
    ], 7, new Date('2026-08-29T18:00:00.000Z'), entries)
    const latest = points.at(-1)

    expect(latest?.published).toBe(1)
    expect(latest?.scheduled).toBe(1)
    expect(latest?.engagement).toBe(31)
  })
})
