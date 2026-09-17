import { apiRequest } from './api-client'
import { dateKeyInTimezone, timeInTimezone } from './calendar-utils'
import { fetchConnectionsWorkspace, flattenConnectedIdentities } from './connections-api'
import type { CalendarData, CalendarDestination, CalendarPost, CalendarPostStatus } from '../types/calendar'
import type { BackendJobStatus, DashboardJob, Platform } from '../types/dashboard'

type JobsResponse = { jobs: DashboardJob[] }

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

function jobPlatform(job: DashboardJob): Platform {
  return job.destination?.platform || 'facebook'
}

function jobPost(job: DashboardJob, timeZone: string): CalendarPost {
  const occurredAt = jobDate(job)
  const destination = job.destination
  return {
    id: job.id,
    title: job.title?.trim() || job.caption?.trim().split(/\n+/)[0]?.slice(0, 90) || job.localFileName || destination?.name || 'Untitled content',
    time: timeInTimezone(occurredAt, timeZone),
    date: dateKeyInTimezone(occurredAt, timeZone),
    occurredAt,
    platform: jobPlatform(job),
    pageId: destination?.id || null,
    pageName: destination?.name || destination?.username || 'Connected account',
    status: calendarStatus(job.status),
    thumbnailUrl: destination?.avatarUrl || null,
    engagementScore: null,
    source: 'post_for_me',
    jobId: job.id,
    providerPostId: job.metaPostId || null,
    platformUrl: job.platformUrl || null,
  }
}

function weekStart(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  value.setDate(value.getDate() - value.getDay())
  return value
}

export function buildCalendarData(jobs: DashboardJob[], destinations: CalendarDestination[], timeZone: string, now = new Date()): CalendarData {
  const allPosts = jobs.map(job => jobPost(job, timeZone))
  const nowMs = now.getTime()
  const posts = allPosts.filter(post => {
    const scheduledFor = new Date(post.occurredAt).getTime()
    if (!Number.isFinite(scheduledFor) || scheduledFor < nowMs) return false
    return post.status === 'scheduled' || post.status === 'needs_review'
  })

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
    jobs,
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

export async function fetchCalendarData(timeZone: string): Promise<CalendarData> {
  const [workspace, jobsResult] = await Promise.all([
    fetchConnectionsWorkspace(),
    apiRequest<JobsResponse>('/api/social-publications?limit=500'),
  ])
  const destinations: CalendarDestination[] = flattenConnectedIdentities(workspace).map(identity => ({
    id: identity.id,
    platform: identity.platform as Platform,
    name: identity.displayName,
    username: identity.username,
    avatarUrl: identity.avatarUrl,
  }))
  return buildCalendarData(jobsResult.jobs || [], destinations, timeZone, new Date())
}

export async function rescheduleCalendarPost(post: CalendarPost, scheduledAt: string) {
  if (!post.jobId) throw new Error('The Post for Me publication reference is unavailable.')
  return apiRequest<{ ok: boolean; scheduledAt: string }>(`/api/social-publications/${encodeURIComponent(post.jobId)}/schedule`, {
    method: 'PUT',
    body: JSON.stringify({ scheduledAt }),
  })
}

export async function deleteCalendarPost(post: CalendarPost) {
  if (!post.jobId) throw new Error('The Post for Me publication reference is unavailable.')
  return apiRequest<{ ok: boolean; publicationId: string; affected: number }>(`/api/social-publications/${encodeURIComponent(post.jobId)}`, { method: 'DELETE' })
}
