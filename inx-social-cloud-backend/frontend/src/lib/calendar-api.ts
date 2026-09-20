import { apiRequest } from './api-client'
import { dateKeyInTimezone, timeInTimezone } from './calendar-utils'
import { fetchConnectionsWorkspace, flattenConnectedIdentities } from './connections-api'
import type { CalendarData, CalendarDestination, CalendarPost, CalendarPostStatus } from '../types/calendar'
import type { BackendJobStatus, DashboardJob, Platform, PlatformAnalytics } from '../types/dashboard'
import type { AnalyticsSourceAccount } from './analytics-api'

type JobsResponse = { jobs: DashboardJob[] }

function calendarStatus(status: BackendJobStatus): CalendarPostStatus {
  if (status === 'PUBLISHED') return 'published'
  if (status === 'SCHEDULED' || status === 'PROCESSING' || status === 'QUEUED') return 'scheduled'
  if (status === 'FAILED') return 'needs_review'
  if (status === 'CANCELLED') return 'failed'
  if (status === 'AWAITING_UPLOAD' || status === 'READY') return 'needs_review'
  return 'draft'
}

function jobDate(job: DashboardJob) {
  if (job.status === 'PUBLISHED') return job.completedAt || job.updatedAt
  if (['SCHEDULED', 'PROCESSING', 'QUEUED'].includes(job.status)) return job.scheduledAt || job.updatedAt
  return job.scheduledAt || job.updatedAt || job.createdAt
}

function jobPlatform(job: DashboardJob): Platform {
  return job.destination?.platform || 'facebook'
}

function jobPost(job: DashboardJob, timeZone: string, source: CalendarPost['source'] = 'post_for_me'): CalendarPost {
  const occurredAt = jobDate(job)
  const destination = job.destination
  const page = job.page
  return {
    id: job.id,
    title: job.title?.trim() || job.caption?.trim().split(/\n+/)[0]?.slice(0, 90) || job.localFileName || destination?.name || 'Untitled content',
    time: timeInTimezone(occurredAt, timeZone),
    date: dateKeyInTimezone(occurredAt, timeZone),
    occurredAt,
    platform: jobPlatform(job),
    pageId: destination?.id || page?.id || null,
    pageName: destination?.name || destination?.username || page?.facebookPageName || page?.facebookPageUsername || 'Connected account',
    status: calendarStatus(job.status),
    thumbnailUrl: destination?.avatarUrl || page?.facebookPagePicture || null,
    engagementScore: null,
    source,
    jobId: job.id,
    providerPostId: job.providerPostId || job.metaPostId || null,
    platformUrl: job.platformUrl || null,
    errorMessage: job.errorMessage || null,
  }
}

function weekStart(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  value.setDate(value.getDate() - value.getDay())
  return value
}

export function buildCalendarData(jobs: DashboardJob[], destinations: CalendarDestination[], timeZone: string, now = new Date(), cloudJobs: DashboardJob[] = []): CalendarData {
  const allPosts = [...jobs.map(job => jobPost(job, timeZone, 'post_for_me')), ...cloudJobs.map(job => jobPost(job, timeZone, 'inx'))]
  const nowMs = now.getTime()
  const posts = allPosts.filter(post => {
    const occurredAt = new Date(post.occurredAt).getTime()
    if (!Number.isFinite(occurredAt)) return false
    if (post.status === 'published' || post.status === 'failed') return true
    if (occurredAt < nowMs) return false
    return post.status === 'scheduled' || post.status === 'needs_review'
  }).sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))

  const currentWeek = weekStart(now)
  const nextWeek = new Date(currentWeek.getTime() + 7 * 86400000)
  const previousWeek = new Date(currentWeek.getTime() - 7 * 86400000)
  const scheduledTimes = posts.filter(post => post.status === 'scheduled').map(post => new Date(post.occurredAt).getTime())
  const scheduledThisWeek = scheduledTimes.filter(value => value >= currentWeek.getTime() && value < nextWeek.getTime()).length
  const scheduledPreviousWeek = scheduledTimes.filter(value => value >= previousWeek.getTime() && value < currentWeek.getTime()).length
  const nowKey = dateKeyInTimezone(now, timeZone)
  const currentMonth = nowKey.slice(0, 7)
  const previousMonthDate = new Date(Date.UTC(Number(currentMonth.slice(0, 4)), Number(currentMonth.slice(5, 7)) - 2, 1))
  const previousMonth = `${previousMonthDate.getUTCFullYear()}-${String(previousMonthDate.getUTCMonth() + 1).padStart(2, '0')}`
  const publishedThisMonth = allPosts.filter(post => post.status === 'published' && post.date.startsWith(currentMonth)).length
  const publishedPreviousMonth = allPosts.filter(post => post.status === 'published' && post.date.startsWith(previousMonth)).length
  const drafts = allPosts.filter(post => post.status === 'draft').length
  const needsReview = allPosts.filter(post => post.status === 'needs_review' || post.status === 'failed').length
  const signed = (value: number) => `${value >= 0 ? '+' : ''}${value}`

  return {
    posts,
    destinations,
    jobs: [...jobs, ...cloudJobs],
    syncWarnings: [],
    stats: [
      { label: 'Scheduled This Week', value: scheduledThisWeek, detail: `${signed(scheduledThisWeek - scheduledPreviousWeek)} vs last week`, tone: 'teal' },
      { label: 'Published This Month', value: publishedThisMonth, detail: `${signed(publishedThisMonth - publishedPreviousMonth)} vs last month`, tone: 'green' },
      { label: 'Drafts', value: drafts, detail: drafts ? 'Saved in INXSocial' : 'No saved drafts', tone: 'teal' },
      { label: 'Needs Review', value: needsReview, detail: needsReview ? 'Review publishing issues' : 'Nothing needs attention', tone: needsReview ? 'amber' : 'green' },
      { label: 'Connected Accounts', value: destinations.length, detail: 'Across all active platforms', tone: 'purple' },
    ],
  }
}


export type CalendarFeedEntry = {
  account: AnalyticsSourceAccount
  analytics: PlatformAnalytics
}

function feedPost(entry: CalendarFeedEntry, item: PlatformAnalytics['content'][number], timeZone: string): CalendarPost | null {
  if (!item.createdTime) return null
  const timestamp = new Date(item.createdTime)
  if (Number.isNaN(timestamp.getTime())) return null
  const interactions = item.insights?.totalInteractions ?? (item.reactions + item.comments + item.shares)
  return {
    id: `feed:${entry.account.platform}:${entry.account.id}:${item.id}`,
    title: item.message.trim().split(/\n+/)[0]?.slice(0, 90) || `${entry.account.platform} post`,
    time: timeInTimezone(item.createdTime, timeZone),
    date: dateKeyInTimezone(item.createdTime, timeZone),
    occurredAt: item.createdTime,
    platform: entry.account.platform as Platform,
    pageId: entry.account.id,
    pageName: entry.account.displayName,
    status: 'published',
    thumbnailUrl: item.thumbnailUrl,
    engagementScore: interactions,
    source: 'post_for_me',
    jobId: null,
    providerPostId: item.id,
    platformUrl: item.permalinkUrl,
    errorMessage: null,
  }
}

function previousMonthKey(currentMonth: string) {
  const value = new Date(Date.UTC(Number(currentMonth.slice(0, 4)), Number(currentMonth.slice(5, 7)) - 2, 1))
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`
}

export function mergeCalendarFeedData(data: CalendarData, entries: CalendarFeedEntry[], timeZone: string, now = new Date()): CalendarData {
  const existingProviderIds = new Set(
    data.posts
      .filter(post => post.providerPostId)
      .map(post => `${post.platform}:${post.providerPostId}`)
  )
  const existingUrls = new Set(data.posts.map(post => post.platformUrl).filter(Boolean))
  const feedPosts = entries
    .flatMap(entry => entry.analytics.content.map(item => feedPost(entry, item, timeZone)).filter((post): post is CalendarPost => Boolean(post)))
    .filter(post => {
      if (post.providerPostId && existingProviderIds.has(`${post.platform}:${post.providerPostId}`)) return false
      if (post.platformUrl && existingUrls.has(post.platformUrl)) return false
      return true
    })

  const posts = [...data.posts, ...feedPosts].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
  const nowKey = dateKeyInTimezone(now, timeZone)
  const currentMonth = nowKey.slice(0, 7)
  const previousMonth = previousMonthKey(currentMonth)
  const publishedThisMonth = posts.filter(post => post.status === 'published' && post.date.startsWith(currentMonth)).length
  const publishedPreviousMonth = posts.filter(post => post.status === 'published' && post.date.startsWith(previousMonth)).length
  const signed = (value: number) => `${value >= 0 ? '+' : ''}${value}`
  const stats = data.stats.map(stat => stat.label === 'Published This Month'
    ? { ...stat, value: publishedThisMonth, detail: `${signed(publishedThisMonth - publishedPreviousMonth)} vs last month` }
    : stat)

  return { ...data, posts, stats }
}

export async function fetchCalendarData(timeZone: string): Promise<CalendarData> {
  const [workspace, publicationResult, cloudResult] = await Promise.all([
    fetchConnectionsWorkspace(),
    apiRequest<JobsResponse>('/api/social-publications?limit=500'),
    apiRequest<JobsResponse>('/api/studio/jobs?limit=500'),
  ])
  const universalDestinations: CalendarDestination[] = flattenConnectedIdentities(workspace).map(identity => ({
    id: identity.id,
    platform: identity.platform as Platform,
    name: identity.displayName,
    username: identity.username,
    avatarUrl: identity.avatarUrl,
  }))
  const cloudDestinations: CalendarDestination[] = (cloudResult.jobs || []).flatMap(job => job.page ? [{
    id: job.page.id,
    platform: 'facebook' as Platform,
    name: job.page.facebookPageName,
    username: job.page.facebookPageUsername,
    avatarUrl: job.page.facebookPagePicture,
  }] : [])
  const destinations = [...new Map([...universalDestinations, ...cloudDestinations].map(destination => [`${destination.platform}:${destination.id}`, destination])).values()]
  return buildCalendarData(publicationResult.jobs || [], destinations, timeZone, new Date(), cloudResult.jobs || [])
}

export async function rescheduleCalendarPost(post: CalendarPost, scheduledAt: string) {
  if (!post.jobId) throw new Error('The INX Social publishing reference is unavailable.')
  if (post.source === 'inx') {
    return apiRequest<{ job: DashboardJob }>(`/api/studio/jobs/${encodeURIComponent(post.jobId)}/schedule`, {
      method: 'PATCH',
      body: JSON.stringify({ scheduledAt }),
    })
  }
  return apiRequest<{ ok: boolean; scheduledAt: string }>(`/api/social-publications/${encodeURIComponent(post.jobId)}/schedule`, {
    method: 'PUT',
    body: JSON.stringify({ scheduledAt }),
  })
}

export async function deleteCalendarPost(post: CalendarPost) {
  if (!post.jobId) throw new Error('The INX Social publishing reference is unavailable.')
  if (post.source === 'inx') {
    return apiRequest<{ ok: boolean; job: DashboardJob }>(`/api/studio/jobs/${encodeURIComponent(post.jobId)}`, { method: 'DELETE' })
  }
  return apiRequest<{ ok: boolean; publicationId: string; affected: number }>(`/api/social-publications/${encodeURIComponent(post.jobId)}`, { method: 'DELETE' })
}
