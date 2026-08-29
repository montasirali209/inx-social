import { apiRequest } from './api-client'
import type {
  BackendJobStatus,
  DashboardJob,
  DashboardViewData,
  StatCardData,
  StudioOverview,
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

function isWithinLastDays(value: string | null, days: number, now = new Date()) {
  if (!value) return false
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return false
  const age = now.getTime() - time
  return age >= 0 && age < days * 86_400_000
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
  const today = localDayKey(now)
  const scheduledToday = jobs.filter((job) => (
    job.status === 'SCHEDULED'
    && Boolean(job.scheduledAt)
    && localDayKey(job.scheduledAt!) === today
  )).length
  const publishedThisWeek = jobs.filter((job) => (
    job.status === 'PUBLISHED' && isWithinLastDays(job.completedAt ?? job.updatedAt, 7, now)
  )).length
  const queueCount = overview.summary.queued + overview.summary.processing

  const stats: StatCardData[] = [
    { label: 'Videos Ready', value: overview.summary.ready, detail: 'Prepared for scheduling', tone: 'blue' },
    { label: 'Scheduled Today', value: scheduledToday, detail: 'Due today', tone: 'cyan' },
    { label: 'Publishing Queue', value: queueCount, detail: 'Queued or publishing', tone: 'purple' },
    { label: 'Published This Week', value: publishedThisWeek, detail: 'Confirmed by Meta', tone: 'green' },
    { label: 'Needs Review', value: overview.summary.failed, detail: 'Failed items need attention', tone: 'red' },
  ]

  const queue = jobs.filter((job) => queueStatuses.has(job.status)).slice(0, 8)
  const upcoming = jobs
    .filter((job) => job.status === 'SCHEDULED' && job.scheduledAt && new Date(job.scheduledAt) > now)
    .sort((left, right) => new Date(left.scheduledAt!).getTime() - new Date(right.scheduledAt!).getTime())
    .slice(0, 4)
  const activeTransfer = jobs.find((job) => job.status === 'PROCESSING' || job.uploadStatus === 'UPLOADING') ?? null

  return { overview, jobs, queue, upcoming, activeTransfer, stats }
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
