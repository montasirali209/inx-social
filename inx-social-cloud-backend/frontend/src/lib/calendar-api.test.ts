import { describe, expect, it } from 'vitest'
import { buildCalendarData } from './calendar-api'
import type { DashboardJob, StudioOverview } from '../types/dashboard'

const page = { id: 'connected-1', facebookPageId: 'page-1', facebookPageName: 'INXSocial', facebookPageUsername: null, facebookPagePicture: null, facebookCategory: null, status: 'ACTIVE', isSelected: true, connectedAt: '2026-01-01T00:00:00.000Z', lastCheckedAt: null, lastSyncAt: null, lastError: null }
const overview = { pages: [page] } as StudioOverview
const job = { id: 'job-1', status: 'SCHEDULED', uploadStatus: 'DELETED', publishMode: 'SCHEDULED', contentType: 'TEXT', title: 'Future post', caption: 'Future post', localFileName: null, scheduledAt: '2026-09-20T10:00:00.000Z', completedAt: null, errorMessage: null, mediaLibraryAssetId: null, metaPostId: 'page-1_post-1', metaVideoId: null, createdAt: '2026-09-10T10:00:00.000Z', updatedAt: '2026-09-10T10:00:00.000Z', page, asset: null } satisfies DashboardJob

describe('calendar Meta identity', () => {
  it('attaches the provider permalink to a saved INXSocial job without duplicating it', () => {
    const result = buildCalendarData(overview, [job], [{ pageId: page.id, facebookPageId: page.facebookPageId, pageName: page.facebookPageName, picture: null, reconciledJobIds: [], posts: [{ id: 'post-1', scheduled_publish_time: 1789898400, permalink_url: 'https://www.facebook.com/permalink' }] }], 'UTC', new Date('2026-09-11T00:00:00.000Z'))
    expect(result.posts).toHaveLength(1)
    expect(result.posts[0]).toMatchObject({ jobId: 'job-1', providerPostId: 'page-1_post-1', platformUrl: 'https://www.facebook.com/permalink' })
  })

  it('removes a locally stale job during the same calendar reconciliation response', () => {
    const result = buildCalendarData(overview, [job], [{ pageId: page.id, facebookPageId: page.facebookPageId, pageName: page.facebookPageName, picture: null, reconciledJobIds: ['job-1'], posts: [] }], 'UTC', new Date('2026-09-11T00:00:00.000Z'))
    expect(result.posts).toEqual([])
  })
})
