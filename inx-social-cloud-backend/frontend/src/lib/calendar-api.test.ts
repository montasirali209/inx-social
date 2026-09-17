import { describe, expect, it } from 'vitest'
import { buildCalendarData } from './calendar-api'
import type { CalendarDestination } from '../types/calendar'
import type { DashboardJob } from '../types/dashboard'

const destination: CalendarDestination = {
  id: 'profile-1',
  platform: 'instagram',
  name: 'INXSocial',
  username: 'inxsocial',
  avatarUrl: 'https://example.com/avatar.jpg',
}

const scheduledJob = {
  id: 'pfm:post-1',
  status: 'SCHEDULED',
  uploadStatus: null,
  publishMode: 'SCHEDULED',
  contentType: 'IMAGE',
  title: 'Future post',
  caption: 'Future post caption',
  localFileName: null,
  scheduledAt: '2026-09-20T10:00:00.000Z',
  completedAt: null,
  errorMessage: null,
  mediaLibraryAssetId: null,
  metaPostId: 'post-1',
  metaVideoId: null,
  createdAt: '2026-09-10T10:00:00.000Z',
  updatedAt: '2026-09-10T10:00:00.000Z',
  page: null,
  destination: { ...destination },
  platformUrl: 'https://www.instagram.com/p/post-1',
  asset: null,
} satisfies DashboardJob

describe('Post for Me calendar identity', () => {
  it('maps the universal publication destination, platform and provider URL', () => {
    const result = buildCalendarData([scheduledJob], [destination], 'UTC', new Date('2026-09-11T00:00:00.000Z'))
    expect(result.posts).toHaveLength(1)
    expect(result.posts[0]).toMatchObject({
      jobId: 'pfm:post-1',
      providerPostId: 'post-1',
      platform: 'instagram',
      pageId: 'profile-1',
      pageName: 'INXSocial',
      platformUrl: 'https://www.instagram.com/p/post-1',
      source: 'post_for_me',
    })
    expect(result.destinations).toEqual([destination])
  })

  it('keeps the actionable calendar focused on future Post for Me schedule state', () => {
    const publishedJob = {
      ...scheduledJob,
      id: 'pfm:published-1',
      status: 'PUBLISHED',
      scheduledAt: '2026-09-10T10:00:00.000Z',
      completedAt: '2026-09-10T10:01:00.000Z',
      metaPostId: 'published-1',
    } satisfies DashboardJob
    const result = buildCalendarData([scheduledJob, publishedJob], [destination], 'UTC', new Date('2026-09-11T00:00:00.000Z'))
    expect(result.posts.map(post => post.id)).toEqual(['pfm:post-1'])
    expect(result.stats.find(stat => stat.label === 'Connected Accounts')?.value).toBe(1)
  })
})
