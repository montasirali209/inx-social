import { describe, expect, it } from 'vitest'
import { buildCalendarData, mergeCalendarFeedData } from './calendar-api'
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

  it('keeps published history alongside future schedule state', () => {
    const publishedJob = {
      ...scheduledJob,
      id: 'pfm:published-1',
      status: 'PUBLISHED',
      scheduledAt: '2026-09-10T10:00:00.000Z',
      completedAt: '2026-09-10T10:01:00.000Z',
      metaPostId: 'published-1',
    } satisfies DashboardJob
    const result = buildCalendarData([scheduledJob, publishedJob], [destination], 'UTC', new Date('2026-09-11T00:00:00.000Z'))
    expect(result.posts.map(post => post.id)).toEqual(['pfm:published-1', 'pfm:post-1'])
    expect(result.stats.find(stat => stat.label === 'Connected Accounts')?.value).toBe(1)
  })
  it('merges native account feed posts into the calendar and monthly published KPI', () => {
    const result = buildCalendarData([scheduledJob], [destination], 'UTC', new Date('2026-09-18T00:00:00.000Z'))
    const merged = mergeCalendarFeedData(result, [{
      account: {
        analyticsKey: 'instagram:profile-1',
        id: 'profile-1',
        platform: 'instagram',
        displayName: 'INXSocial',
        username: 'inxsocial',
        avatarUrl: null,
        detail: 'PROFESSIONAL',
        status: 'connected',
        connectedAt: '2026-09-01T00:00:00.000Z',
        lastSyncedAt: null,
        connectionId: 'connection-1',
      },
      analytics: {
        platform: 'instagram',
        fetchedAt: '2026-09-18T10:00:00.000Z',
        page: { id: 'profile-1', name: 'INXSocial' },
        summary: { followers: 0, posts: 1, reactions: 10, comments: 2, shares: 1, engagements: 13, totalInteractions: 13, views: 200, postViews: 200, uniqueViewers: 0, clicks: 0, engagementRate: 6.5, calculationNote: 'Current post metrics.' },
        content: [{
          id: 'native-post-1',
          message: 'Published natively',
          createdTime: '2026-09-08T12:00:00.000Z',
          permalinkUrl: 'https://www.instagram.com/p/native-post-1',
          thumbnailUrl: 'https://example.com/native.jpg',
          contentType: 'IMAGE',
          reactions: 10,
          comments: 2,
          shares: 1,
          insights: { views: 200, uniqueViewers: null, clicks: null, engagement: 13, totalInteractions: 13, engagementRate: 6.5 },
        }],
      },
    }], 'UTC', new Date('2026-09-18T00:00:00.000Z'))

    expect(merged.posts.some(post => post.providerPostId === 'native-post-1' && post.status === 'published')).toBe(true)
    expect(merged.stats.find(stat => stat.label === 'Published This Month')?.value).toBe(1)
  })


  it('merges future INX Social cloud queue jobs into the same calendar', () => {
    const cloudJob = {
      ...scheduledJob,
      id: 'cloud-queued-1',
      status: 'QUEUED',
      metaPostId: null,
      destination: null,
      page: {
        id: 'page-1',
        facebookPageId: 'facebook-page-1',
        facebookPageName: 'Trails & Tales',
        facebookPageUsername: 'trailsandtales',
        facebookPagePicture: null,
        facebookCategory: null,
        status: 'ACTIVE',
        isSelected: false,
        connectedAt: '2026-09-01T00:00:00.000Z',
        lastCheckedAt: null,
        lastSyncAt: null,
        lastError: null,
      },
      platformUrl: null,
    } satisfies DashboardJob
    const facebookDestination: CalendarDestination = {
      id: 'page-1',
      platform: 'facebook',
      name: 'Trails & Tales',
      username: 'trailsandtales',
      avatarUrl: null,
    }
    const result = buildCalendarData([scheduledJob], [destination, facebookDestination], 'UTC', new Date('2026-09-11T00:00:00.000Z'), [cloudJob])
    expect(result.posts.find(post => post.id === 'cloud-queued-1')).toMatchObject({
      status: 'scheduled',
      source: 'inx',
      platform: 'facebook',
      pageId: 'page-1',
      pageName: 'Trails & Tales',
    })
    expect(result.jobs).toHaveLength(2)
  })

})
