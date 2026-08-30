import { describe, expect, it } from 'vitest'
import type { FacebookAnalytics } from '../types/dashboard'
import { calculateBestPostTime } from './posts-analytics'

function analytics(): FacebookAnalytics {
  return {
    platform: 'facebook',
    fetchedAt: '2026-08-30T10:00:00.000Z',
    page: { id: 'page-1', name: 'Trails & Tales' },
    summary: { followers: 0, posts: 2, reactions: 0, comments: 0, shares: 0, engagements: 0, totalInteractions: 0, views: null, postViews: 0, uniqueViewers: 0, clicks: 0, engagementRate: null, calculationNote: '' },
    content: [
      { id: 'one', message: 'Morning', createdTime: '2026-08-29T08:00:00.000Z', permalinkUrl: null, thumbnailUrl: null, contentType: 'post', reactions: 2, comments: 1, shares: 0, insights: { views: null, uniqueViewers: null, clicks: null, engagement: 3, totalInteractions: 3, engagementRate: null } },
      { id: 'two', message: 'Evening', createdTime: '2026-08-29T19:00:00.000Z', permalinkUrl: null, thumbnailUrl: null, contentType: 'post', reactions: 20, comments: 5, shares: 2, insights: { views: null, uniqueViewers: null, clicks: null, engagement: 27, totalInteractions: 27, engagementRate: null } },
    ],
  }
}

describe('Posts best-time analytics', () => {
  it('selects the strongest live engagement hour and explains the evidence', () => {
    const result = calculateBestPostTime(analytics())
    expect(result.available).toBe(true)
    expect(result.time).toMatch(/^\d{2}:00$/)
    expect(result.detail).toContain('Trails & Tales')
  })

  it('does not invent a recommendation without Page content', () => {
    const result = calculateBestPostTime({ ...analytics(), content: [] })
    expect(result.available).toBe(false)
    expect(result.time).toBeNull()
  })
})
