import type { Platform, PlatformAnalytics } from './dashboard'

export type AnalyticsTab = 'overview' | 'content_performance' | 'audience' | 'engagement' | 'reach' | 'videos' | 'reports'
export type AnalyticsTone = 'green' | 'blue' | 'red' | 'purple' | 'amber' | 'teal'

export type AnalyticsStat = {
  id: string
  label: string
  value: number | null
  format: 'compact' | 'percent' | 'integer'
  detail: string
  tone: AnalyticsTone
  sparkline: number[]
  availability?: string
}
export type PerformancePoint = { date: string; label: string; views: number; engagements: number; linkClicks: number; followers: number }
export type TopPost = { id: string; title: string; date: string | null; thumbnailUrl: string | null; engagements: number; contentType: string; permalinkUrl: string | null; platform?: Platform }
export type HeatmapCell = { day: string; hour: number; value: number }
export type AnalyticsView = {
  stats: AnalyticsStat[]
  performance: PerformancePoint[]
  publishedPerformance: PerformancePoint[]
  topPosts: TopPost[]
  heatmap: HeatmapCell[]
  totalEngagements: number
  audienceGrowth: number | null
  lowData: boolean
  source: PlatformAnalytics
}
