import { describe, expect, it } from 'vitest'
import { buildDashboardView, selectDashboardAnalyticsPage, videoStatus } from './dashboard-api'
import type { ConnectedPage, DashboardJob, FacebookAnalytics, StudioOverview } from '../types/dashboard'

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

describe('dashboard data mapping', () => {
  it('derives honest KPI, queue and upcoming values from backend jobs', () => {
    const now = new Date('2026-08-29T10:00:00.000Z')
    const data = buildDashboardView(overview, [
      job('READY'),
      job('QUEUED'),
      job('PROCESSING'),
      job('SCHEDULED', { scheduledAt: '2026-08-29T16:00:00.000Z' }),
      job('PUBLISHED', { completedAt: '2026-08-28T11:00:00.000Z' }),
      job('FAILED'),
    ], now)

    expect(data.stats.map((item) => item.value)).toEqual([6, 1, 1, 1, '—'])
    expect(data.queue).toHaveLength(5)
    expect(data.upcoming).toHaveLength(1)
    expect(data.activeTransfer?.status).toBe('PROCESSING')
    expect(data.recentPosts).toHaveLength(5)
    expect(data.platformMetrics.find((item) => item.platform === 'facebook')?.posts).toBe(6)
    expect(data.platformMetrics.find((item) => item.platform === 'instagram')?.posts).toBe(0)
  })

  it('uses the dashboard account target instead of the universal Page selection', () => {
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

  it('uses permitted live Facebook analytics instead of placeholder engagement', () => {
    const analytics: FacebookAnalytics = {
      platform: 'facebook',
      fetchedAt: '2026-08-29T10:00:00.000Z',
      page: { id: 'page-1', name: 'INXSocial' },
      summary: {
        followers: 100,
        posts: 1,
        reactions: 20,
        comments: 4,
        shares: 2,
        engagements: 26,
        totalInteractions: 31,
        views: 500,
        postViews: 450,
        uniqueViewers: 300,
        clicks: 5,
        engagementRate: 10.33,
        calculationNote: 'Unique viewers are summed per post.',
      },
      content: [{
        id: 'page-1_post-1',
        message: 'Launch update',
        createdTime: '2026-08-29T08:00:00.000Z',
        permalinkUrl: 'https://facebook.example/post-1',
        thumbnailUrl: 'https://example.test/post.jpg',
        contentType: 'added_video',
        reactions: 20,
        comments: 4,
        shares: 2,
        insights: { views: 450, uniqueViewers: 300, clicks: 5, engagement: 26, totalInteractions: 31, engagementRate: 10.33 },
      }],
    }
    const data = buildDashboardView(overview, [job('PUBLISHED')], new Date('2026-08-29T10:00:00.000Z'), analytics)

    expect(data.stats.at(-1)?.value).toBe(31)
    expect(data.recentPosts[0].title).toBe('Launch update')
    expect(data.recentPosts[0].engagement).toBe(31)
    expect(data.platformMetrics.find((item) => item.platform === 'facebook')?.engagement).toBe(31)
    expect(data.topContent[0].engagement).toBe(31)
  })
})
