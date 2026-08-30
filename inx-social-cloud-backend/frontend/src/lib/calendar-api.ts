import { apiRequest } from './api-client'
import { dateKeyInTimezone, timeInTimezone } from './calendar-utils'
import type { CalendarData, CalendarPost, CalendarPostStatus, MetaScheduledPost } from '../types/calendar'
import type { BackendJobStatus, DashboardJob, StudioOverview } from '../types/dashboard'

type JobsResponse = { jobs: DashboardJob[] }
type ScheduledResponse = { result: { data: MetaScheduledPost[] } }

function calendarStatus(status: BackendJobStatus): CalendarPostStatus {
  if (status === 'PUBLISHED') return 'published'
  if (status === 'SCHEDULED' || status === 'PROCESSING' || status === 'QUEUED') return 'scheduled'
  if (status === 'FAILED' || status === 'CANCELLED') return 'failed'
  if (status === 'AWAITING_UPLOAD' || status === 'READY') return 'needs_review'
  return 'draft'
}

function jobDate(job: DashboardJob) {
  if (job.status === 'PUBLISHED') return job.completedAt || job.updatedAt
  if (['SCHEDULED', 'PROCESSING', 'QUEUED'].includes(job.status)) return job.scheduledAt || job.updatedAt
  return job.scheduledAt || job.updatedAt || job.createdAt
}

function jobPost(job: DashboardJob, timeZone: string): CalendarPost {
  const occurredAt = jobDate(job)
  return {
    id: `job-${job.id}`,
    title: job.title?.trim() || job.localFileName || job.asset?.originalFileName || (job.contentType === 'TEXT' ? 'Facebook post' : 'Untitled content'),
    time: timeInTimezone(occurredAt, timeZone),
    date: dateKeyInTimezone(occurredAt, timeZone),
    occurredAt,
    platform: 'facebook',
    pageId: job.page?.id || null,
    pageName: job.page?.facebookPageName || 'Facebook Page',
    status: calendarStatus(job.status),
    thumbnailUrl: job.page?.facebookPagePicture || null,
    engagementScore: null,
    source: 'inx',
  }
}

function weekStart(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  value.setDate(value.getDate() - value.getDay())
  return value
}

export function buildCalendarData(overview: StudioOverview, jobs: DashboardJob[], external: Array<{ pageId: string; pageName: string; picture: string | null; posts: MetaScheduledPost[] }>, timeZone: string, now = new Date(), syncWarnings: string[] = []): CalendarData {
  const localMetaIds = new Set(jobs.flatMap((job) => [job.metaPostId, job.metaVideoId]).filter(Boolean).map(String))
  const posts = jobs.map((job) => jobPost(job, timeZone))
  external.forEach((page) => page.posts.forEach((post) => {
    if (!post.scheduled_publish_time || localMetaIds.has(String(post.id))) return
    const occurredAt = new Date(post.scheduled_publish_time * 1000).toISOString()
    posts.push({
      id: `meta-${page.pageId}-${post.id}`,
      title: post.message?.trim().split(/\n+/)[0]?.slice(0, 90) || 'Facebook scheduled post',
      time: timeInTimezone(occurredAt, timeZone),
      date: dateKeyInTimezone(occurredAt, timeZone),
      occurredAt,
      platform: 'facebook',
      pageId: page.pageId,
      pageName: page.pageName,
      status: post.is_published ? 'published' : 'scheduled',
      thumbnailUrl: page.picture,
      engagementScore: null,
      source: 'meta',
    })
  }))

  const currentWeek = weekStart(now)
  const nextWeek = new Date(currentWeek.getTime() + 7 * 86400000)
  const previousWeek = new Date(currentWeek.getTime() - 7 * 86400000)
  const scheduledTimes = posts.filter((post) => post.status === 'scheduled').map((post) => new Date(post.occurredAt).getTime())
  const scheduledThisWeek = scheduledTimes.filter((value) => value >= currentWeek.getTime() && value < nextWeek.getTime()).length
  const scheduledPreviousWeek = scheduledTimes.filter((value) => value >= previousWeek.getTime() && value < currentWeek.getTime()).length
  const nowKey = dateKeyInTimezone(now, timeZone)
  const currentMonth = nowKey.slice(0, 7)
  const previousMonthDate = new Date(Date.UTC(Number(currentMonth.slice(0, 4)), Number(currentMonth.slice(5, 7)) - 2, 1))
  const previousMonth = `${previousMonthDate.getUTCFullYear()}-${String(previousMonthDate.getUTCMonth() + 1).padStart(2, '0')}`
  const publishedThisMonth = posts.filter((post) => post.status === 'published' && post.date.startsWith(currentMonth)).length
  const publishedPreviousMonth = posts.filter((post) => post.status === 'published' && post.date.startsWith(previousMonth)).length
  const drafts = posts.filter((post) => post.status === 'draft').length
  const needsReview = posts.filter((post) => post.status === 'needs_review' || post.status === 'failed').length
  const signed = (value: number) => `${value >= 0 ? '+' : ''}${value}`

  return {
    posts,
    pages: overview.pages,
    jobs,
    syncWarnings,
    stats: [
      { label: 'Scheduled This Week', value: scheduledThisWeek, detail: `${signed(scheduledThisWeek - scheduledPreviousWeek)} vs last week`, tone: 'teal' },
      { label: 'Published This Month', value: publishedThisMonth, detail: `${signed(publishedThisMonth - publishedPreviousMonth)} vs last month`, tone: 'green' },
      { label: 'Drafts', value: drafts, detail: drafts ? 'Saved in INX Social' : 'No saved drafts', tone: 'teal' },
      { label: 'Needs Review', value: needsReview, detail: needsReview ? 'Review before publishing' : 'Nothing needs attention', tone: needsReview ? 'amber' : 'green' },
      { label: 'Connected Accounts', value: overview.pages.length, detail: overview.pages.length ? 'Facebook Pages available' : 'Connect a publishing account', tone: 'purple' },
    ],
  }
}

export async function fetchCalendarData(timeZone: string, selectedPageId = ''): Promise<CalendarData> {
  const [overview, jobsResult] = await Promise.all([
    apiRequest<StudioOverview>('/api/studio/overview'),
    apiRequest<JobsResponse>('/api/studio/jobs?limit=250'),
  ])
  // Avoid opening dozens of simultaneous Meta requests for large accounts.
  // Saved INX Social jobs always load; live Meta reconciliation runs only for
  // the Page explicitly selected in this calendar session.
  const pagesToSync = selectedPageId ? overview.pages.filter((page) => page.id === selectedPageId) : []
  const results = await Promise.allSettled(pagesToSync.map(async (page) => {
    const response = await apiRequest<ScheduledResponse>(`/api/studio/facebook/scheduled-posts?connectedPageId=${encodeURIComponent(page.id)}`)
    return { pageId: page.id, pageName: page.facebookPageName, picture: page.facebookPagePicture, posts: response.result.data }
  }))
  const external = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
  const warnings = results.flatMap((result, index) => result.status === 'rejected' ? [`${pagesToSync[index].facebookPageName}: Meta schedule could not be refreshed.`] : [])
  return buildCalendarData(overview, jobsResult.jobs, external, timeZone, new Date(), warnings)
}
