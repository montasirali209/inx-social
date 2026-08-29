import { apiRequest } from './api-client'
import type {
  BackendJobStatus,
  DashboardJob,
  DashboardViewData,
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
): DashboardViewData {
  const stats: StatCardData[] = [
    { label: 'Total Posts', value: overview.summary.total, detail: 'All publishing records', tone: 'green' },
    { label: 'Published', value: overview.summary.published, detail: 'Confirmed by Meta', tone: 'green' },
    { label: 'Scheduled', value: overview.summary.scheduled, detail: 'Future publishing slots', tone: 'cyan' },
    { label: 'Failed', value: overview.summary.failed, detail: 'Items needing attention', tone: 'red' },
    { label: 'Engagement', value: '—', detail: 'Open live Analytics', tone: 'blue' },
  ]

  const queue = jobs.filter((job) => queueStatuses.has(job.status)).slice(0, 8)
  const upcoming = jobs
    .filter((job) => job.status === 'SCHEDULED' && job.scheduledAt && new Date(job.scheduledAt) > now)
    .sort((left, right) => new Date(left.scheduledAt!).getTime() - new Date(right.scheduledAt!).getTime())
    .slice(0, 4)
  const activeTransfer = jobs.find((job) => job.status === 'PROCESSING' || job.uploadStatus === 'UPLOADING') ?? null

  const sortedPosts = [...jobs].sort((left, right) => new Date(occurredAt(right)).getTime() - new Date(occurredAt(left)).getTime())
  const recentPosts = sortedPosts.slice(0, 5).map(socialPost)
  const platformCounts = new Map<Platform, number>()
  jobs.forEach((job) => platformCounts.set(jobPlatform(job), (platformCounts.get(jobPlatform(job)) || 0) + 1))
  const platforms: Platform[] = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'x']
  const platformMetrics: PlatformMetric[] = platforms.map((platform) => ({
    platform,
    posts: platformCounts.get(platform) || 0,
    engagement: null,
  }))
  const topContent: TopContentItem[] = sortedPosts
    .filter((job) => job.status === 'PUBLISHED')
    .slice(0, 5)
    .map((job) => ({
      id: job.id,
      title: socialPost(job).title,
      thumbnailUrl: job.page?.facebookPagePicture || null,
      engagement: null,
      status: videoStatus(job.status),
    }))

  return { overview, jobs, queue, upcoming, activeTransfer, stats, recentPosts, platformMetrics, topContent }
}

export async function fetchStudioOverview() {
  return apiRequest<StudioOverview>('/api/studio/overview')
}

export async function fetchDashboardView() {
  const [overview, jobsResult] = await Promise.all([
    fetchStudioOverview(),
    apiRequest<JobsResponse>('/api/studio/jobs?limit=250'),
  ])
  return buildDashboardView(overview, jobsResult.jobs)
}
