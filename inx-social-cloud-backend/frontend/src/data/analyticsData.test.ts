import { describe, expect, it } from 'vitest'
import type { FacebookAnalytics } from '../types/dashboard'
import { buildAnalyticsView, formatAnalyticsValue } from './analyticsData'

function liveAnalytics(): FacebookAnalytics {
  return {
    platform: 'facebook', fetchedAt: '2026-08-31T10:00:00.000Z', page: { id: 'meta-1', name: 'INX Social' },
    summary: { followers: 1200, posts: 1, reactions: 8, comments: 2, shares: 1, engagements: 11, totalInteractions: 14, views: 90, postViews: 75, uniqueViewers: 50, clicks: 3, follows: 4, engagementRate: 28, calculationNote: 'Live calculation.' },
    series: { views: [{ date: new Date().toISOString().slice(0, 10), value: 90 }], follows: [{ date: new Date().toISOString().slice(0, 10), value: 4 }] },
    content: [{ id: 'post-1', message: 'A real post', createdTime: new Date().toISOString(), permalinkUrl: null, thumbnailUrl: null, contentType: 'added_video', reactions: 8, comments: 2, shares: 1, insights: { views: 75, uniqueViewers: 50, clicks: 3, engagement: 11, totalInteractions: 14, engagementRate: 28 } }],
  }
}

describe('Analytics live view', () => {
  it('maps only returned Meta data and keeps unavailable metrics explicit', () => {
    const view = buildAnalyticsView(liveAnalytics(), 30)
    expect(view.stats.find((stat) => stat.id === 'followers')?.value).toBe(1200)
    expect(view.stats.find((stat) => stat.id === 'profile-visits')?.value).toBeNull()
    expect(view.topPosts[0].engagements).toBe(14)
    expect(view.audienceGrowth).toBe(4)
    expect(view.lowData).toBe(true)
  })

  it('formats compact, percentage and unavailable values honestly', () => {
    expect(formatAnalyticsValue(2450, 'compact')).toMatch(/2\.5K/i)
    expect(formatAnalyticsValue(3.67, 'percent')).toBe('3.67%')
    expect(formatAnalyticsValue(null, 'compact')).toBe('Unavailable')
  })

  it('converts cumulative Page follower totals into daily and net growth', () => {
    const source = liveAnalytics()
    source.series = { ...source.series, follows: [
      { date: '2026-08-30', value: 161_000 },
      { date: '2026-08-31', value: 161_075 },
    ] }
    const view = buildAnalyticsView(source, 2)
    expect(view.performance.find((point) => point.date === '2026-08-31')?.followers).toBe(75)
    expect(view.audienceGrowth).toBe(75)
  })
})
