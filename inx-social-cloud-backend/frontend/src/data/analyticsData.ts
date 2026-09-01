import type { AnalyticsStat, AnalyticsView, HeatmapCell, PerformancePoint, TopPost } from '../types/analytics'
import type { FacebookAnalytics } from '../types/dashboard'

export const analyticsTabs = [
  ['overview', 'Overview'], ['content_performance', 'Content Performance'], ['audience', 'Audience'],
  ['engagement', 'Engagement'], ['reach', 'Reach'], ['videos', 'Videos'], ['stories', 'Stories'],
  ['competitors', 'Competitors'], ['reports', 'Reports'],
] as const

function dateKeys(days: number) {
  const formatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
  return Array.from({ length: days }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (days - index - 1))
    return { date: date.toISOString().slice(0, 10), label: formatter.format(date) }
  })
}

function seriesMap(analytics: FacebookAnalytics, key: string) {
  return new Map((analytics.series?.[key] || []).map((point) => [point.date, point.value]))
}

function followerActivity(analytics: FacebookAnalytics) {
  const points = [...(analytics.series?.follows || [])].sort((left, right) => left.date.localeCompare(right.date))
  if (points.length < 2) {
    return {
      daily: new Map(points.map((point) => [point.date, point.value])),
      net: analytics.summary.follows ?? (points[0]?.value ?? null),
    }
  }
  const daily = new Map<string, number>([[points[0].date, 0]])
  for (let index = 1; index < points.length; index += 1) {
    daily.set(points[index].date, Math.max(0, points[index].value - points[index - 1].value))
  }
  return { daily, net: points.at(-1)!.value - points[0].value }
}

function contentSeries(analytics: FacebookAnalytics, key: 'engagements' | 'clicks') {
  const values = new Map<string, number>()
  analytics.content.forEach((post) => {
    if (!post.createdTime) return
    const date = post.createdTime.slice(0, 10)
    const value = key === 'clicks' ? Number(post.insights?.clicks || 0) : post.reactions + post.comments + post.shares
    values.set(date, (values.get(date) || 0) + value)
  })
  return values
}

function sparkline(points: PerformancePoint[], key: keyof Pick<PerformancePoint, 'views' | 'engagements' | 'linkClicks' | 'followers'>) {
  return points.map((point) => point[key])
}

function topPosts(analytics: FacebookAnalytics): TopPost[] {
  return analytics.content.map((post) => ({
    id: post.id,
    title: post.message.trim().split(/\n/)[0]?.slice(0, 90) || `${post.contentType.replaceAll('_', ' ')} post`,
    date: post.createdTime,
    thumbnailUrl: post.thumbnailUrl,
    engagements: post.insights?.totalInteractions ?? post.reactions + post.comments + post.shares,
    contentType: post.contentType,
    permalinkUrl: post.permalinkUrl,
  })).sort((a, b) => b.engagements - a.engagements)
}

function heatmap(analytics: FacebookAnalytics): HeatmapCell[] {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const values = new Map<string, number>()
  analytics.content.forEach((post) => {
    if (!post.createdTime) return
    const date = new Date(post.createdTime)
    const day = days[date.getDay()]
    const hour = Math.floor(date.getHours() / 3) * 3
    const value = post.insights?.totalInteractions ?? post.reactions + post.comments + post.shares
    values.set(`${day}-${hour}`, (values.get(`${day}-${hour}`) || 0) + value)
  })
  return days.slice(1).concat(days[0]).flatMap((day) => Array.from({ length: 8 }, (_, index) => ({ day, hour: index * 3, value: values.get(`${day}-${index * 3}`) || 0 })))
}

export function buildAnalyticsView(analytics: FacebookAnalytics, days: number): AnalyticsView {
  const views = seriesMap(analytics, 'views')
  const pageEngagements = seriesMap(analytics, 'engagements')
  const followers = followerActivity(analytics)
  const follows = followers.daily
  const postEngagements = contentSeries(analytics, 'engagements')
  const clicks = contentSeries(analytics, 'clicks')
  const performance = dateKeys(days).map(({ date, label }) => ({
    date, label,
    views: views.get(date) || 0,
    engagements: pageEngagements.get(date) ?? postEngagements.get(date) ?? 0,
    linkClicks: clicks.get(date) || 0,
    followers: follows.get(date) || 0,
  }))
  const stats: AnalyticsStat[] = [
    { id: 'followers', label: 'Total Followers', value: analytics.summary.followers, format: 'compact', detail: 'Current Page audience', tone: 'teal', sparkline: sparkline(performance, 'followers') },
    { id: 'views', label: 'Content Views', value: analytics.summary.views ?? analytics.summary.postViews, format: 'compact', detail: 'Returned by Meta', tone: 'blue', sparkline: sparkline(performance, 'views'), availability: analytics.capabilities?.metrics.views?.reason },
    { id: 'engagement-rate', label: 'Engagement Rate', value: analytics.summary.engagementRate, format: 'percent', detail: analytics.summary.calculationNote, tone: 'red', sparkline: sparkline(performance, 'engagements') },
    { id: 'profile-visits', label: 'Profile Visits', value: null, format: 'compact', detail: 'Not supplied by this Meta API', tone: 'purple', sparkline: [], availability: 'Profile visits are not returned for the connected Facebook Page token.' },
    { id: 'clicks', label: 'Link Clicks', value: analytics.summary.clicks, format: 'compact', detail: 'Published-post clicks', tone: 'amber', sparkline: sparkline(performance, 'linkClicks') },
    { id: 'posts', label: 'Posts Published', value: analytics.summary.posts, format: 'integer', detail: `Within the selected ${days} days`, tone: 'green', sparkline: performance.map((point) => topPosts(analytics).filter((post) => post.date?.startsWith(point.date)).length) },
  ]
  const totalEngagements = analytics.summary.totalInteractions
  const audienceGrowth = followers.net
  return { stats, performance, topPosts: topPosts(analytics), heatmap: heatmap(analytics), totalEngagements, audienceGrowth, lowData: analytics.summary.posts < 5, source: analytics }
}

export function formatAnalyticsValue(value: number | null, format: AnalyticsStat['format']) {
  if (value === null) return 'Unavailable'
  if (format === 'percent') return `${value.toFixed(2)}%`
  if (format === 'integer') return value.toLocaleString('en-GB')
  return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
