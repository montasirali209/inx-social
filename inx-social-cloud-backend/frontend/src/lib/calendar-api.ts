import { apiRequest } from './api-client'
import { calendarFetchRange, dateKeyInTimezone, timeInTimezone } from './calendar-utils'
import type { CalendarData, CalendarPost, CalendarPostStatus, MetaScheduledPost } from '../types/calendar'
import type { BackendJobStatus, DashboardJob, StudioOverview } from '../types/dashboard'

type JobsResponse = { jobs: DashboardJob[] }
type ScheduledResponse = { result: { data: MetaScheduledPost[] }; reconciledJobIds?: string[] }

function metaIdVariants(value: string | null | undefined) {
  const id = String(value || '').trim()
  if (!id) return []
  return [...new Set([id, id.split('_').at(-1)!])]
}

function facebookPostUrl(pageFacebookId: string | null | undefined, objectId: string | null) {
  if (!objectId) return null
  const [objectPageId, postId] = objectId.split('_')
  if (objectPageId && postId) return `https://www.facebook.com/${objectPageId}/posts/${postId}`
  if (pageFacebookId) return `https://www.facebook.com/${pageFacebookId}/posts/${objectId}`
  return `https://www.facebook.com/${objectId}`
}

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

function jobPost(job: DashboardJob, timeZone: string, metaPost?: MetaScheduledPost): CalendarPost {
  const occurredAt = jobDate(job)
  const providerPostId = job.metaPostId || job.metaVideoId || null
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
    jobId: job.id,
    providerPostId,
    platformUrl: metaPost?.permalink_url || facebookPostUrl(job.page?.facebookPageId, providerPostId),
  }
}

function weekStart(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  value.setDate(value.getDate() - value.getDay())
  return value
}

export function buildCalendarData(overview: StudioOverview, jobs: DashboardJob[], external: Array<{ pageId: string; facebookPageId: string; pageName: string; picture: string | null; posts: MetaScheduledPost[]; reconciledJobIds: string[] }>, timeZone: string, now = new Date(), syncWarnings: string[] = []): CalendarData {
  const reconciledJobIds = new Set(external.flatMap(page => page.reconciledJobIds))
  const activeJobs = jobs.filter(job => !reconciledJobIds.has(job.id))
  const localMetaIds = new Set(activeJobs.flatMap((job) => [job.metaPostId, job.metaVideoId]).filter(Boolean).flatMap(id => metaIdVariants(String(id))))
  const externalById = new Map(external.flatMap(page => page.posts.flatMap(post => {
    const id = String(post.id || '')
    return metaIdVariants(id).map(variant => [variant, post] as const)
  })))
  const allPosts = activeJobs.map((job) => jobPost(job, timeZone, metaIdVariants(job.metaPostId).map(id => externalById.get(id)).find(Boolean) || metaIdVariants(job.metaVideoId).map(id => externalById.get(id)).find(Boolean)))
  external.forEach((page) => page.posts.forEach((post) => {
    if (!post.scheduled_publish_time || metaIdVariants(post.id).some(id => localMetaIds.has(id))) return
    const occurredAt = new Date(post.scheduled_publish_time * 1000).toISOString()
    allPosts.push({
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
      jobId: null,
      providerPostId: String(post.id),
      platformUrl: post.permalink_url || facebookPostUrl(page.facebookPageId, String(post.id)),
    })
  }))

  // Content Calendar is a forward-looking publishing workspace. Published,
  // failed and draft history belongs in Posts/Analytics, not on the schedule.
  // The time check also removes stale jobs that still say SCHEDULED after
  // their publishing time has already passed while provider state catches up.
  const nowMs = now.getTime()
  const posts = allPosts.filter((post) => {
    const scheduledFor = new Date(post.occurredAt).getTime()
    if (!Number.isFinite(scheduledFor) || scheduledFor < nowMs) return false
    return post.status === 'scheduled' || post.status === 'needs_review'
  })

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
  const publishedThisMonth = allPosts.filter((post) => post.status === 'published' && post.date.startsWith(currentMonth)).length
  const publishedPreviousMonth = allPosts.filter((post) => post.status === 'published' && post.date.startsWith(previousMonth)).length
  const drafts = allPosts.filter((post) => post.status === 'draft').length
  const needsReview = allPosts.filter((post) => post.status === 'needs_review' || post.status === 'failed').length
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

export async function fetchCalendarData(timeZone: string, selectedPageId = '', monthKey = dateKeyInTimezone(new Date(), timeZone).slice(0, 7)): Promise<CalendarData> {
  const range = calendarFetchRange(monthKey)
  const jobParams = new URLSearchParams({ limit: '1000', from: range.from, to: range.to })
  const [overview, jobsResult] = await Promise.all([
    apiRequest<StudioOverview>('/api/studio/overview'),
    apiRequest<JobsResponse>(`/api/studio/jobs?${jobParams.toString()}`),
  ])
  // Refresh Pages with calendar jobs so posts removed directly in Facebook do
  // not remain in INX Social. Also refresh the explicitly selected Page so its
  // Meta-only scheduled content is visible without querying unused accounts.
  const scheduledPageIds = new Set(jobsResult.jobs.filter(job => job.status === 'SCHEDULED').map(job => job.page?.id).filter(Boolean))
  const pagesToSync = overview.pages.filter(page => scheduledPageIds.has(page.id) || page.id === selectedPageId).sort((left, right) => Number(right.id === selectedPageId) - Number(left.id === selectedPageId))
  const results: PromiseSettledResult<{ pageId: string; facebookPageId: string; pageName: string; picture: string | null; posts: MetaScheduledPost[]; reconciledJobIds: string[] }>[] = []
  for (let index = 0; index < pagesToSync.length; index += 4) {
    results.push(...await Promise.allSettled(pagesToSync.slice(index, index + 4).map(async (page) => {
      const response = await apiRequest<ScheduledResponse>(`/api/studio/facebook/scheduled-posts?connectedPageId=${encodeURIComponent(page.id)}`)
      return { pageId: page.id, facebookPageId: page.facebookPageId, pageName: page.facebookPageName, picture: page.facebookPagePicture, posts: response.result.data, reconciledJobIds: response.reconciledJobIds || [] }
    })))
  }
  const external = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
  const warnings = results.flatMap((result, index) => result.status === 'rejected' ? [`${pagesToSync[index].facebookPageName}: Meta schedule could not be refreshed.`] : [])
  return buildCalendarData(overview, jobsResult.jobs, external, timeZone, new Date(), warnings)
}

export async function rescheduleCalendarPost(post: CalendarPost, scheduledAt: string) {
  if (post.jobId) {
    return apiRequest<{ job: DashboardJob }>(`/api/studio/jobs/${encodeURIComponent(post.jobId)}/schedule`, {
      method: 'PATCH',
      body: JSON.stringify({ scheduledAt }),
    })
  }
  if (!post.providerPostId || !post.pageId) throw new Error('The Facebook post reference is unavailable.')
  return apiRequest<{ result: MetaScheduledPost }>(`/api/studio/facebook/posts/${encodeURIComponent(post.providerPostId)}/schedule`, {
    method: 'PATCH',
    body: JSON.stringify({ scheduledAt, connectedPageId: post.pageId }),
  })
}

export async function deleteCalendarPost(post: CalendarPost) {
  if (post.jobId) {
    return apiRequest<{ ok: boolean; job: DashboardJob }>(`/api/studio/jobs/${encodeURIComponent(post.jobId)}`, { method: 'DELETE' })
  }
  if (!post.providerPostId || !post.pageId) throw new Error('The Facebook post reference is unavailable.')
  return apiRequest<{ ok: boolean }>(`/api/studio/facebook/posts/${encodeURIComponent(post.providerPostId)}?connectedPageId=${encodeURIComponent(post.pageId)}`, { method: 'DELETE' })
}
