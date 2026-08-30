import { apiRequest } from './api-client'
import type {
  BackendJobStatus,
  ConnectedPage,
  DashboardJob,
  DashboardViewData,
  FacebookAnalytics,
  Platform,
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
  // Facebook Pages are the only live publishing connector in this phase.
  void job
  return 'facebook'
}

function occurredAt(job: DashboardJob) {
  return job.completedAt || job.scheduledAt || job.updatedAt || job.createdAt
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
  }
}

export function buildActivitySeries(jobs: DashboardJob[], days = 7, now = new Date()): PublishingActivityPoint[] {
  const totalDays = Math.min(90, Math.max(7, days))
  const today = startOfLocalDay(now)
  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (totalDays - index - 1))
    const key = localDayKey(date)
    const count = (status: BackendJobStatus, value: (job: DashboardJob) => string | null) => jobs.filter((job) => (
      job.status === status && Boolean(value(job)) && localDayKey(value(job)!) === key
    )).length
    return {
      date: date.toISOString(),
      label: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date),
      published: count('PUBLISHED', (job) => job.completedAt || job.updatedAt),
      scheduled: count('SCHEDULED', (job) => job.scheduledAt || job.updatedAt),
      failed: count('FAILED', (job) => job.updatedAt),
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
  facebookAnalytics: FacebookAnalytics | null = null,
): DashboardViewData {
  const liveEngagement = facebookAnalytics?.summary.totalInteractions ?? facebookAnalytics?.summary.engagements ?? null
  const publishedCount = jobs.filter((job) => job.status === 'PUBLISHED').length
  const scheduledCount = jobs.filter((job) => job.status === 'SCHEDULED').length
  const failedCount = jobs.filter((job) => job.status === 'FAILED' || job.status === 'CANCELLED').length
  const stats: StatCardData[] = [
    { label: 'Total Posts', value: jobs.length, detail: 'Selected Page records', tone: 'green' },
    { label: 'Published', value: publishedCount, detail: 'Selected Page · confirmed', tone: 'green' },
    { label: 'Scheduled', value: scheduledCount, detail: 'Selected Page · upcoming', tone: 'cyan' },
    { label: 'Failed', value: failedCount, detail: 'Selected Page · needs attention', tone: 'red' },
    {
      label: 'Engagement',
      value: liveEngagement ?? '—',
      detail: liveEngagement === null ? 'Reconnect Facebook for live data' : `Live from ${facebookAnalytics?.page.name || 'Facebook'}`,
      tone: 'blue',
    },
  ]

  const queue = jobs.filter((job) => queueStatuses.has(job.status)).slice(0, 8)
  const upcoming = jobs
    .filter((job) => job.status === 'SCHEDULED' && job.scheduledAt && new Date(job.scheduledAt) > now)
    .sort((left, right) => new Date(left.scheduledAt!).getTime() - new Date(right.scheduledAt!).getTime())
    .slice(0, 4)
  const activeTransfer = jobs.find((job) => job.status === 'PROCESSING' || job.uploadStatus === 'UPLOADING') ?? null

  const sortedPosts = [...jobs].sort((left, right) => new Date(occurredAt(right)).getTime() - new Date(occurredAt(left)).getTime())
  const livePosts: SocialPost[] = (facebookAnalytics?.content || []).map((post) => ({
    id: post.id,
    title: post.message.trim().split(/\r?\n/)[0]?.slice(0, 100) || 'Facebook content',
    excerpt: post.message.trim() || 'Published Facebook content',
    thumbnailUrl: post.thumbnailUrl,
    platforms: ['facebook'],
    status: 'published',
    occurredAt: post.createdTime || facebookAnalytics?.fetchedAt || now.toISOString(),
    engagement: post.insights?.totalInteractions ?? (post.reactions + post.comments + post.shares),
  }))
  const recentPosts = livePosts.length ? livePosts.slice(0, 5) : sortedPosts.slice(0, 5).map(socialPost)
  const platformCounts = new Map<Platform, number>()
  jobs.forEach((job) => platformCounts.set(jobPlatform(job), (platformCounts.get(jobPlatform(job)) || 0) + 1))
  const platforms: Platform[] = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'x']
  const platformMetrics: PlatformMetric[] = platforms.map((platform) => ({
    platform,
    posts: platform === 'facebook' && facebookAnalytics ? facebookAnalytics.summary.posts : (platformCounts.get(platform) || 0),
    engagement: platform === 'facebook' ? liveEngagement : null,
  }))
  const topContent: TopContentItem[] = livePosts.length
    ? [...livePosts]
      .sort((left, right) => (right.engagement || 0) - (left.engagement || 0))
      .slice(0, 5)
      .map((post) => ({
        id: post.id,
        title: post.title,
        thumbnailUrl: post.thumbnailUrl,
        engagement: post.engagement,
        status: 'published',
      }))
    : sortedPosts.filter((job) => job.status === 'PUBLISHED').slice(0, 5).map((job) => ({
      id: job.id,
      title: socialPost(job).title,
      thumbnailUrl: job.page?.facebookPagePicture || null,
      engagement: null,
      status: videoStatus(job.status),
    }))

  return { overview, jobs, queue, upcoming, activeTransfer, stats, recentPosts, platformMetrics, topContent, facebookAnalytics }
}

export async function fetchStudioOverview() {
  return apiRequest<StudioOverview>('/api/studio/overview')
}

export async function fetchDashboardJobs() {
  return (await apiRequest<JobsResponse>('/api/studio/jobs?limit=250')).jobs
}

export async function fetchFacebookDashboardAnalytics(connectedPageId: string, days = 7) {
  const result = await apiRequest<FacebookAnalyticsResponse>(
    `/api/studio/analytics/facebook?connectedPageId=${encodeURIComponent(connectedPageId)}&days=${days}`,
  )
  return result.analytics
}

export function selectDashboardAnalyticsPage(pages: ConnectedPage[], connectedPageId?: string | null) {
  if (!pages.length) return null
  if (connectedPageId) {
    const requested = pages.find((page) => page.id === connectedPageId && page.status !== 'REVOKED')
    if (requested) return requested
  }
  return pages.find((page) => page.status !== 'REVOKED') || null
}

export async function fetchDashboardView(days = 7, connectedPageId?: string | null) {
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
      // Operational publishing remains available when Meta analytics permission
      // is missing, expired or temporarily rate-limited. The dedicated
      // Analytics view exposes the exact reconnect/error evidence.
    }
  }
  const scopedJobs = page ? jobs.filter((job) => job.page?.id === page.id) : []
  return buildDashboardView(overview, scopedJobs, new Date(), facebookAnalytics)
}
