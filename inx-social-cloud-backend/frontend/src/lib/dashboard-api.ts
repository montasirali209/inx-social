import { apiRequest } from './api-client'
import type {
  BackendJobStatus,
  ConnectedPage,
  ContentMetrics,
  DashboardAnalyticsEntry,
  DashboardJob,
  DashboardViewData,
  FacebookAnalytics,
  AudienceDemographics,
  Platform,
  PlatformAnalytics,
  PlatformMetric,
  PublishingActivityPoint,
  SocialPost,
  StatCardData,
  StudioOverview,
  TopContentItem,
  VideoStatus,
} from '../types/dashboard'

type JobsResponse = { jobs: DashboardJob[] }
type FacebookAnalyticsResponse = { analytics: FacebookAnalytics }

const queueStatuses = new Set<BackendJobStatus>([
  'AWAITING_UPLOAD',
  'READY',
  'QUEUED',
  'PROCESSING',
  'SCHEDULED',
  'FAILED',
])

function localDayKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function jobPlatform(job: DashboardJob): Platform {
  // The current production publishing queue still creates Facebook Page jobs.
  // Live dashboard content for other connected platforms is supplied by their
  // analytics connectors instead of pretending those jobs exist.
  void job
  return 'facebook'
}

function occurredAt(job: DashboardJob) {
  return job.completedAt || job.scheduledAt || job.updatedAt || job.createdAt
}

function contentMetrics(content: PlatformAnalytics['content'][number]): ContentMetrics {
  const interactions = content.insights?.totalInteractions ?? (content.reactions + content.comments + content.shares)
  return {
    likes: content.reactions,
    comments: content.comments,
    shares: content.shares,
    views: content.insights?.views ?? null,
    interactions,
  }
}

function socialPost(job: DashboardJob): SocialPost {
  return {
    id: job.id,
    title: job.title?.trim() || job.localFileName || job.asset?.originalFileName || 'Untitled post',
    excerpt: job.caption?.trim() || (job.errorMessage ? 'This post needs attention.' : 'Publishing details available in Posts.'),
    thumbnailUrl: job.page?.facebookPagePicture || null,
    platforms: [jobPlatform(job)],
    status: videoStatus(job.status),
    occurredAt: occurredAt(job),
    engagement: null,
    metrics: null,
    sourceName: job.page?.facebookPageName || null,
  }
}

function normaliseAnalytics(input: DashboardAnalyticsEntry[] | FacebookAnalytics | null | undefined): DashboardAnalyticsEntry[] {
  if (!input) return []
  if (Array.isArray(input)) return input
  return [{
    accountId: input.page.id,
    platform: 'facebook',
    sourceName: input.page.name,
    analytics: input,
  }]
}

export function buildActivitySeries(
  jobs: DashboardJob[],
  days = 14,
  now = new Date(),
  analyticsInput: DashboardAnalyticsEntry[] | FacebookAnalytics | null = [],
): PublishingActivityPoint[] {
  const analytics = normaliseAnalytics(analyticsInput)
  const totalDays = Math.min(30, Math.max(7, days))
  const today = startOfLocalDay(now)
  const livePublishedByDay = new Map<string, number>()
  const engagementByDay = new Map<string, number>()
  const liveContentIds = new Set<string>()

  analytics.forEach((entry) => entry.analytics.content.forEach((content) => {
    liveContentIds.add(content.id)
    if (!content.createdTime) return
    const key = localDayKey(content.createdTime)
    if (!key) return
    livePublishedByDay.set(key, (livePublishedByDay.get(key) || 0) + 1)
    engagementByDay.set(key, (engagementByDay.get(key) || 0) + contentMetrics(content).interactions)
  }))

  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (totalDays - index - 1))
    const key = localDayKey(date)
    const count = (status: BackendJobStatus, value: (job: DashboardJob) => string | null) => jobs.filter((job) => (
      job.status === status && Boolean(value(job)) && localDayKey(value(job)!) === key
    )).length
    const publishedJobs = jobs.filter((job) => {
      if (job.status !== 'PUBLISHED') return false
      const value = job.completedAt || job.updatedAt
      if (!value || localDayKey(value) !== key) return false
      const providerId = job.metaPostId || job.metaVideoId
      return !providerId || !liveContentIds.has(providerId)
    }).length
    return {
      date: date.toISOString(),
      label: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date),
      published: publishedJobs + (livePublishedByDay.get(key) || 0),
      scheduled: count('SCHEDULED', (job) => job.scheduledAt || job.updatedAt),
      failed: count('FAILED', (job) => job.updatedAt),
      engagement: engagementByDay.get(key) || 0,
    }
  })
}

export function videoStatus(status: BackendJobStatus): VideoStatus {
  const statuses: Record<BackendJobStatus, VideoStatus> = {
    DRAFT: 'pending_review',
    AWAITING_UPLOAD: 'pending_review',
    READY: 'ready',
    QUEUED: 'in_queue',
    PROCESSING: 'publishing',
    SCHEDULED: 'scheduled',
    PUBLISHED: 'published',
    FAILED: 'failed',
    CANCELLED: 'failed',
  }
  return statuses[status]
}

export function buildDashboardView(
  overview: StudioOverview,
  jobs: DashboardJob[],
  now = new Date(),
  analyticsInput: DashboardAnalyticsEntry[] | FacebookAnalytics | null = [],
  connectedAccountsCount?: number,
): DashboardViewData {
  const analytics = normaliseAnalytics(analyticsInput)
  const liveEngagement = analytics.reduce((sum, entry) => sum + entry.analytics.summary.totalInteractions, 0)
  const livePublished = analytics.reduce((sum, entry) => sum + entry.analytics.summary.posts, 0)
  const scheduledCount = jobs.filter((job) => job.status === 'SCHEDULED').length
  const draftQueuedCount = jobs.filter((job) => ['DRAFT', 'AWAITING_UPLOAD', 'READY', 'QUEUED', 'PROCESSING'].includes(job.status)).length
  const failedCount = jobs.filter((job) => job.status === 'FAILED' || job.status === 'CANCELLED').length
  const connectedCount = connectedAccountsCount ?? overview.pages.filter((page) => page.status !== 'REVOKED').length
  const periodDays = analytics.find((entry) => entry.analytics.period?.days)?.analytics.period?.days
  const livePeriod = periodDays ? `Last ${periodDays} days` : 'Live connected data'

  const stats: StatCardData[] = [
    {
      label: 'Total Published',
      value: analytics.length ? livePublished : overview.summary.published,
      detail: analytics.length ? `${livePeriod} · all platforms` : 'Across INXSocial publishing',
      tone: 'green',
    },
    { label: 'Scheduled', value: scheduledCount, detail: 'In queue for publishing', tone: 'cyan', route: '/content-calendar' },
    { label: 'Drafts / Queued', value: draftQueuedCount, detail: 'In progress', tone: 'purple', route: '/posts' },
    { label: 'Failed / Needs Review', value: failedCount, detail: 'Needs your attention', tone: 'red', route: '/posts' },
    {
      label: 'Total Engagement',
      value: analytics.length ? liveEngagement : '—',
      detail: analytics.length ? `${livePeriod} · likes, comments, shares` : 'Connect insights-capable accounts',
      tone: 'green',
      route: '/analytics',
    },
    { label: 'Connected Accounts', value: connectedCount, detail: 'Across all active platforms', tone: 'blue', route: '/connected-accounts' },
  ]

  const queue = jobs.filter((job) => queueStatuses.has(job.status)).slice(0, 8)
  const upcoming = jobs
    .filter((job) => job.status === 'SCHEDULED' && job.scheduledAt && new Date(job.scheduledAt) > now)
    .sort((left, right) => new Date(left.scheduledAt!).getTime() - new Date(right.scheduledAt!).getTime())
    .slice(0, 5)
  const activeTransfer = jobs.find((job) => job.status === 'PROCESSING' || job.uploadStatus === 'UPLOADING') ?? null

  const sortedJobs = [...jobs].sort((left, right) => new Date(occurredAt(right)).getTime() - new Date(occurredAt(left)).getTime())
  const livePosts: SocialPost[] = analytics.flatMap((entry) => entry.analytics.content.map((post) => {
    const metrics = contentMetrics(post)
    return {
      id: `${entry.platform}:${entry.accountId}:${post.id}`,
      title: post.message.trim().split(/\r?\n/)[0]?.slice(0, 100) || `${entry.platform} content`,
      excerpt: post.message.trim() || `Published ${entry.platform} content`,
      thumbnailUrl: post.thumbnailUrl,
      platforms: [entry.platform],
      status: 'published' as const,
      occurredAt: post.createdTime || entry.analytics.fetchedAt || now.toISOString(),
      engagement: metrics.interactions,
      metrics,
      sourceName: entry.sourceName,
    }
  }))
  livePosts.sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
  const recentPosts = livePosts.length ? livePosts.slice(0, 5) : sortedJobs.slice(0, 5).map(socialPost)

  const platforms: Platform[] = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'pinterest', 'x']
  const platformMetrics: PlatformMetric[] = platforms.map((platform) => {
    const entries = analytics.filter((entry) => entry.platform === platform)
    if (entries.length) {
      return {
        platform,
        posts: entries.reduce((sum, entry) => sum + entry.analytics.summary.posts, 0),
        engagement: entries.reduce((sum, entry) => sum + entry.analytics.summary.totalInteractions, 0),
      }
    }
    const fallbackPosts = platform === 'facebook'
      ? jobs.filter((job) => job.status === 'PUBLISHED' && jobPlatform(job) === platform).length
      : 0
    return { platform, posts: fallbackPosts, engagement: null }
  })

  const topContent: TopContentItem[] = livePosts
    .filter((post) => post.engagement !== null)
    .sort((left, right) => (right.engagement || 0) - (left.engagement || 0))
    .slice(0, 5)
    .map((post) => ({
      id: post.id,
      title: post.title,
      thumbnailUrl: post.thumbnailUrl,
      engagement: post.engagement,
      status: 'published',
      platform: post.platforms[0],
      metrics: post.metrics,
      sourceName: post.sourceName,
    }))

  return { overview, jobs, queue, upcoming, activeTransfer, stats, recentPosts, platformMetrics, topContent, analytics }
}

export async function fetchStudioOverview() {
  return apiRequest<StudioOverview>('/api/studio/overview')
}

export async function fetchDashboardJobs() {
  return (await apiRequest<JobsResponse>('/api/studio/jobs?limit=250')).jobs
}

export async function fetchFacebookDashboardAnalytics(connectedPageId: string, days = 7, force = false) {
  const result = await apiRequest<FacebookAnalyticsResponse>(
    `/api/studio/analytics/facebook?connectedPageId=${encodeURIComponent(connectedPageId)}&days=${days}${force ? '&force=true' : ''}`,
  )
  return result.analytics
}

export async function saveFacebookDemographicsSnapshot(input: {
  connectedPageId: string
  capturedAt: string
  audienceSize: number | null
  ageGender: Array<{ age: string; women: number; men: number; unknown: number }>
}) {
  return apiRequest<{ snapshot: AudienceDemographics }>('/api/studio/analytics/facebook/demographics-snapshot', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function selectDashboardAnalyticsPage(pages: ConnectedPage[], connectedPageId?: string | null) {
  if (!pages.length) return null
  if (connectedPageId) {
    const requested = pages.find((page) => page.id === connectedPageId && page.status !== 'REVOKED')
    if (requested) return requested
  }
  return pages.find((page) => page.status !== 'REVOKED') || null
}

export async function fetchDashboardView(days = 30, connectedPageId?: string | null) {
  const [overview, jobs] = await Promise.all([
    fetchStudioOverview(),
    fetchDashboardJobs(),
  ])
  const page = selectDashboardAnalyticsPage(overview.pages, connectedPageId)
  let facebookAnalytics: FacebookAnalytics | null = null
  if (page) {
    try {
      facebookAnalytics = await fetchFacebookDashboardAnalytics(page.id, days)
    } catch {
      // Keep operational publishing available when a provider insight request
      // fails. The production Dashboard uses all-source partial-failure handling.
    }
  }
  return buildDashboardView(overview, jobs, new Date(), facebookAnalytics)
}
