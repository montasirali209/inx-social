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
  it('maps returned Meta data and exposes available interaction metrics', () => {
    const view = buildAnalyticsView(liveAnalytics(), 30)
    expect(view.stats.find((stat) => stat.id === 'followers')?.value).toBe(1200)
    expect(view.stats.find((stat) => stat.id === 'interactions')?.value).toBe(14)
    expect(view.stats.find((stat) => stat.id === 'engagement-rate')?.value).toBe(28)
    expect(view.topPosts[0].engagements).toBe(14)
    expect(view.audienceGrowth).toBe(4)
    expect(view.lowData).toBe(true)
  })

  it('derives engagement rate from content views when unique-viewer rate is unavailable', () => {
    const source = liveAnalytics()
    source.summary.engagementRate = null
    source.summary.uniqueViewers = 0
    source.summary.views = 100
    source.summary.totalInteractions = 5
    const view = buildAnalyticsView(source, 30)
    expect(view.stats.find((stat) => stat.id === 'engagement-rate')?.value).toBe(5)
    expect(view.stats.find((stat) => stat.id === 'engagement-rate')?.detail).toBe('Interactions divided by content views')
  })


  it('uses live content-efficiency KPIs when audience, views and clicks are unavailable', () => {
    const source = liveAnalytics()
    source.summary.followers = 0
    source.summary.follows = null
    source.summary.views = null
    source.summary.postViews = 0
    source.summary.engagementRate = null
    source.summary.clicks = 0
    source.content[0].insights = { ...source.content[0].insights!, views: null, clicks: null, engagementRate: null }

    const view = buildAnalyticsView(source, 30)
    expect(view.stats.find((stat) => stat.id === 'avg-interactions')?.value).toBe(14)
    expect(view.stats.find((stat) => stat.id === 'reactions')?.value).toBe(8)
    expect(view.stats.find((stat) => stat.id === 'comments')?.value).toBe(2)
    expect(view.stats.find((stat) => stat.id === 'engaged-posts')?.value).toBe(1)
    expect(view.stats.every((stat) => stat.value !== null)).toBe(true)
  })

  it('uses measured snapshot deltas instead of assigning lifetime metrics to the post publish date', () => {
    const source = liveAnalytics()
    source.fetchedAt = '2026-09-18T10:00:00.000Z'
    source.provider = { engine: 'POST_FOR_ME' }
    source.tracking = {
      mode: 'measured_snapshot_delta',
      startedAt: '2026-09-17T10:00:00.000Z',
      latestAt: '2026-09-18T10:00:00.000Z',
      sampledDays: 2,
      historicalDailyAvailable: true,
    }
    source.content[0].createdTime = '2026-08-20T10:00:00.000Z'
    source.series = {
      views: [{ date: '2026-09-18', value: 25 }],
      engagements: [{ date: '2026-09-18', value: 3 }],
      clicks: [{ date: '2026-09-18', value: 2 }],
      follows: [{ date: '2026-09-18', value: 1 }],
    }

    const view = buildAnalyticsView(source, 30)
    expect(view.performance.find((point) => point.date === '2026-08-20')?.views).toBe(0)
    expect(view.performance.find((point) => point.date === '2026-09-18')).toMatchObject({
      views: 25,
      engagements: 3,
      linkClicks: 2,
      followers: 1,
    })
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
