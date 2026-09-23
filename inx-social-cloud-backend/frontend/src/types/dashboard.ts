export type Platform = 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok' | 'pinterest' | 'threads' | 'bluesky' | 'x'

export type BackendJobStatus =
  | 'DRAFT'
  | 'AWAITING_UPLOAD'
  | 'READY'
  | 'QUEUED'
  | 'PROCESSING'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'FAILED'
  | 'CANCELLED'

export type PostStatus =
  | 'ready'
  | 'scheduled'
  | 'in_queue'
  | 'publishing'
  | 'published'
  | 'pending_review'
  | 'failed'

export type VideoStatus = PostStatus
export type DashboardTone = 'blue' | 'cyan' | 'green' | 'purple' | 'amber' | 'red'

export type StatCardData = {
  label: string
  value: number | string
  detail: string
  tone: DashboardTone
  trend?: string | null
  trendDirection?: 'up' | 'down' | 'neutral'
  route?: string
}
export type DashboardStat = StatCardData

export type ContentMetrics = {
  likes: number
  comments: number
  shares: number
  views: number | null
  interactions: number
}

export type SocialPost = {
  id: string
  title: string
  excerpt: string
  thumbnailUrl: string | null
  platforms: Platform[]
  status: PostStatus
  occurredAt: string
  engagement: number | null
  metrics?: ContentMetrics | null
  sourceName?: string | null
}
export type PlatformMetric = { platform: Platform; posts: number; engagement: number | null }
export type ScheduledPost = { id: string; title: string; scheduledAt: string; platforms: Platform[]; status: PostStatus }
export type TopContentItem = {
  id: string
  title: string
  thumbnailUrl: string | null
  engagement: number | null
  status: PostStatus
  platform: Platform
  metrics?: ContentMetrics | null
  sourceName?: string | null
}

export type ProviderMetricSummary = { key: string; value: number; aggregation: 'sum' | 'average'; samples: number }

export type AnalyticsContent = {
  id: string
  platform?: Platform
  message: string
  createdTime: string | null
  permalinkUrl: string | null
  thumbnailUrl: string | null
  contentType: string
  reactions: number
  comments: number
  shares: number
  providerMetrics?: Record<string, unknown>
  insights: null | { views: number | null; uniqueViewers: number | null; clicks: number | null; engagement: number; totalInteractions: number; engagementRate: number | null }
}
export type FacebookAnalyticsContent = AnalyticsContent

export type AudienceDemographicRow = { age: string; gender: 'women' | 'men' | 'unknown'; value: number | null; percentage: number }
export type AudienceDemographics = {
  source: 'instagram_api' | 'facebook_snapshot' | 'youtube_api'
  capturedAt: string
  audienceSize: number | null
  account: { id: string; name?: string | null; username?: string | null; pictureUrl?: string | null; followers?: number }
  ageGender: AudienceDemographicRow[]
}

export type AnalyticsCapability = { state: string; available: boolean; reason: string; metaCode?: number | null }
export type PlatformAnalytics = {
  platform: Platform
  fetchedAt: string
  period?: { days: number; since: string; until: string }
  scope?: { accountCount: number; platforms: Platform[]; label: string }
  page: { id: string; name: string; username?: string | null; followers?: number; fans?: number; link?: string | null; pictureUrl?: string | null }
  capabilities?: {
    basicEngagement: AnalyticsCapability
    publishedContent: AnalyticsCapability
    pageInsights: AnalyticsCapability
    postInsights: AnalyticsCapability
    instagramDemographics?: AnalyticsCapability
    metrics: Record<string, AnalyticsCapability>
  }
  summary: {
    followers: number
    posts: number
    reactions: number
    comments: number
    shares: number
    engagements: number
    totalInteractions: number
    views: number | null
    postViews: number
    uniqueViewers: number
    clicks: number
    follows?: number | null
    pageEngagements?: number | null
    engagementRate: number | null
    calculationNote: string
  }
  series?: Record<string, Array<{ date: string; value: number }>>
  tracking?: {
    mode: 'measured_snapshot_delta'
    startedAt: string | null
    latestAt: string | null
    sampledDays: number
    historicalDailyAvailable: boolean
    note?: string
  }
  demographics?: { instagram: AudienceDemographics | null; facebookSnapshot: AudienceDemographics | null }
  content: AnalyticsContent[]
  warnings?: string[]
  cache?: { hit: boolean; expiresAt: string }
  provider?: { engine?: string; accountId?: string; postsWithMetrics?: number; feedPosts?: number; periodPosts?: number; metricsRequested?: boolean; metricSummary?: ProviderMetricSummary[]; cacheState?: 'fresh' | 'live' | 'stale' | 'refreshing' | 'partial' }
}
export type FacebookAnalytics = PlatformAnalytics & { platform: 'facebook' }
export type DashboardAnalyticsEntry = { accountId: string; platform: Platform; sourceName: string; analytics: PlatformAnalytics }

export type PublishingActivityPoint = { date: string; label: string; published: number; scheduled: number; failed: number; engagement: number }
export type ConnectedPage = {
  id: string
  facebookPageId: string
  facebookPageName: string
  facebookPageUsername: string | null
  facebookPagePicture: string | null
  facebookCategory: string | null
  status: string
  isSelected: boolean
  connectedAt: string
  lastCheckedAt: string | null
  lastSyncAt: string | null
  lastError: string | null
}

export type DashboardJob = {
  id: string
  status: BackendJobStatus
  uploadStatus: string | null
  publishMode: 'SCHEDULED' | 'NOW' | 'DRAFT'
  contentType: 'TEXT' | 'IMAGE' | 'VIDEO'
  title: string | null
  caption: string | null
  localFileName: string | null
  scheduledAt: string | null
  completedAt: string | null
  errorMessage: string | null
  mediaLibraryAssetId: string | null
  metaPostId?: string | null
  metaVideoId?: string | null
  contentId?: string | null
  providerPostId?: string | null
  providerStatus?: string | null
  smartTiming?: { enabled: boolean; baseScheduledAt?: string | null; source?: string | null } | null
  source?: string | null
  createdAt: string
  updatedAt: string
  page: ConnectedPage | null
  destination?: { id: string; platform: Platform; name: string; username: string | null; avatarUrl: string | null } | null
  platformUrl?: string | null
  asset: { id: string; originalFileName: string; mimeType: string | null; fileSizeBytes: string | null; status: string } | null
}

export type JobSummary = { total: number; draft: number; awaitingUpload: number; ready: number; queued: number; processing: number; scheduled: number; published: number; failed: number; cancelled: number }
export type StudioOverview = {
  user: { id: string; name: string | null; businessName: string | null; email: string }
  license: { allowed: boolean; plan: string; subscriptionStatus: string; trialEndsAt: string | null; limits: { pages: number | null; batchPosts: number | null; devices: number | null } }
  features?: { aiContentStudio: { visible: boolean; allowed: boolean; availability: string; override: 'DEFAULT' | 'ALLOW' | 'DENY'; usage: { used: number; limit: number | null; remaining: number | null; periodStart: string; periodEnd: string } } }
  pages: ConnectedPage[]
  summary: JobSummary
}

export type DashboardViewData = {
  overview: StudioOverview
  jobs: DashboardJob[]
  queue: DashboardJob[]
  upcoming: DashboardJob[]
  activeTransfer: DashboardJob | null
  stats: StatCardData[]
  recentPosts: SocialPost[]
  platformMetrics: PlatformMetric[]
  topContent: TopContentItem[]
  analytics: DashboardAnalyticsEntry[]
}
