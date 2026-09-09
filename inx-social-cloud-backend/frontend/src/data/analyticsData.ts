import type { AnalyticsStat, AnalyticsView, HeatmapCell, PerformancePoint, TopPost } from '../types/analytics'
import type { PlatformAnalytics } from '../types/dashboard'

export const analyticsTabs = [
  ['overview', 'Overview'], ['content_performance', 'Content Performance'], ['audience', 'Audience'],
  ['engagement', 'Engagement'], ['reach', 'Reach'], ['videos', 'Videos'], ['stories', 'Stories'],
  ['competitors', 'Competitors'], ['reports', 'Reports'],
] as const

const platformLabel = (platform: PlatformAnalytics['platform']) => ({ facebook: 'Meta', instagram: 'Instagram', youtube: 'YouTube', linkedin: 'LinkedIn' }[platform])

function dateKeys(days: number, anchorDate: string) {
  const formatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const anchor = new Date(anchorDate)
  const anchorTime = Number.isNaN(anchor.getTime()) ? Date.now() : anchor.getTime()
  const end = new Date(anchorTime)
  end.setUTCHours(0, 0, 0, 0)
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end)
    date.setUTCDate(end.getUTCDate() - (days - index - 1))
    return { date: date.toISOString().slice(0, 10), label: formatter.format(date) }
  })
}

function seriesMap(analytics: PlatformAnalytics, key: string) {
  return new Map((analytics.series?.[key] || []).map((point) => [point.date, point.value]))
}

function followerActivity(analytics: PlatformAnalytics) {
  const points = [...(analytics.series?.follows || [])].sort((left, right) => left.date.localeCompare(right.date))
  if (analytics.platform === 'youtube') {
    return { daily: new Map(points.map(point => [point.date, point.value])), net: analytics.summary.follows ?? null }
  }
  if (points.length < 2) return { daily: new Map(points.map(point => [point.date, point.value])), net: analytics.summary.follows ?? (points[0]?.value ?? null) }
  const daily = new Map<string, number>([[points[0].date, 0]])
  for (let index = 1; index < points.length; index += 1) daily.set(points[index].date, Math.max(0, points[index].value - points[index - 1].value))
  return { daily, net: points.at(-1)!.value - points[0].value }
}

function contentSeries(analytics: PlatformAnalytics, key: 'engagements' | 'clicks') {
  const values = new Map<string, number>()
  analytics.content.forEach((post) => {
    if (!post.createdTime) return
    const date = post.createdTime.slice(0, 10)
    const value = key === 'clicks' ? Number(post.insights?.clicks || 0) : post.reactions + post.comments + post.shares
    values.set(date, (values.get(date) || 0) + value)
  })
  return values
}

function sparkline(points: PerformancePoint[], key: keyof Pick<PerformancePoint, 'views' | 'engagements' | 'linkClicks' | 'followers'>) { return points.map(point => point[key]) }
function topPosts(analytics: PlatformAnalytics): TopPost[] {
  return analytics.content.map(post => ({
    id: post.id,
    title: post.message.trim().split(/\n/)[0]?.slice(0, 90) || `${post.contentType.replaceAll('_', ' ')} post`,
    date: post.createdTime,
    thumbnailUrl: post.thumbnailUrl,
    engagements: post.insights?.totalInteractions ?? post.reactions + post.comments + post.shares,
    contentType: post.contentType,
    permalinkUrl: post.permalinkUrl,
  })).sort((a, b) => b.engagements - a.engagements)
}
function heatmap(analytics: PlatformAnalytics): HeatmapCell[] {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const values = new Map<string, number>()
  analytics.content.forEach(post => {
    if (!post.createdTime) return
    const date = new Date(post.createdTime)
    const day = days[date.getDay()]
    const hour = Math.floor(date.getHours() / 3) * 3
    const value = post.insights?.totalInteractions ?? post.reactions + post.comments + post.shares
    values.set(`${day}-${hour}`, (values.get(`${day}-${hour}`) || 0) + value)
  })
  return days.slice(1).concat(days[0]).flatMap(day => Array.from({ length: 8 }, (_, index) => ({ day, hour: index * 3, value: values.get(`${day}-${index * 3}`) || 0 })))
}

export function buildAnalyticsView(analytics: PlatformAnalytics, days: number): AnalyticsView {
  const views = seriesMap(analytics, 'views')
  const sourceEngagements = seriesMap(analytics, 'engagements')
  const followers = followerActivity(analytics)
  const postEngagements = contentSeries(analytics, 'engagements')
  const clicks = contentSeries(analytics, 'clicks')
  const performance = dateKeys(days, analytics.fetchedAt).map(({ date, label }) => ({
    date, label,
    views: views.get(date) || 0,
    engagements: sourceEngagements.get(date) ?? postEngagements.get(date) ?? 0,
    linkClicks: clicks.get(date) || 0,
    followers: followers.daily.get(date) || 0,
  }))
  const contentViews = analytics.summary.views ?? analytics.summary.postViews
  const totalInteractions = analytics.summary.totalInteractions
  const derivedEngagementRate = analytics.summary.engagementRate ?? (contentViews > 0 ? Number(((totalInteractions / contentViews) * 100).toFixed(2)) : null)
  const sourceName = platformLabel(analytics.platform)
  const stats: AnalyticsStat[] = [
    { id: 'followers', label: analytics.platform === 'youtube' ? 'Subscribers' : 'Total Followers', value: analytics.summary.followers, format: 'compact', detail: `Current ${sourceName} audience`, tone: 'teal', sparkline: sparkline(performance, 'followers') },
    { id: 'views', label: 'Content Views', value: contentViews, format: 'compact', detail: analytics.capabilities?.pageInsights.available ? `Returned by ${sourceName}` : 'Unavailable for this connection', tone: 'blue', sparkline: sparkline(performance, 'views'), availability: analytics.capabilities?.pageInsights.reason },
    { id: 'engagement-rate', label: 'Engagement Rate', value: derivedEngagementRate, format: 'percent', detail: analytics.summary.calculationNote, tone: 'red', sparkline: sparkline(performance, 'engagements') },
    { id: 'interactions', label: 'Total Interactions', value: totalInteractions, format: 'compact', detail: `Verified ${sourceName} interactions`, tone: 'purple', sparkline: sparkline(performance, 'engagements') },
    { id: 'clicks', label: 'Link Clicks', value: analytics.summary.clicks, format: 'compact', detail: analytics.summary.clicks ? 'Published-content clicks' : `Not supplied by ${sourceName} for this view`, tone: 'amber', sparkline: sparkline(performance, 'linkClicks') },
    { id: 'posts', label: analytics.platform === 'youtube' ? 'Videos' : 'Posts Published', value: analytics.summary.posts, format: 'integer', detail: analytics.platform === 'youtube' ? 'Current channel video count' : `Within the selected ${days} days`, tone: 'green', sparkline: performance.map(point => topPosts(analytics).filter(post => post.date?.startsWith(point.date)).length) },
  ]
  return { stats, performance, topPosts: topPosts(analytics), heatmap: heatmap(analytics), totalEngagements: analytics.summary.totalInteractions, audienceGrowth: followers.net, lowData: analytics.summary.posts < 5, source: analytics }
}

export function formatAnalyticsValue(value: number | null, format: AnalyticsStat['format']) {
  if (value === null) return 'Unavailable'
  if (format === 'percent') return `${value.toFixed(2)}%`
  if (format === 'integer') return value.toLocaleString('en-GB')
  return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
