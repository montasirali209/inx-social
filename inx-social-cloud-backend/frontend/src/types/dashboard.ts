export type Platform = 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok' | 'x'

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
}

export type DashboardStat = StatCardData

export type SocialPost = {
  id: string
  title: string
  excerpt: string
  thumbnailUrl: string | null
  platforms: Platform[]
  status: PostStatus
  occurredAt: string
  engagement: number | null
}

export type PlatformMetric = {
  platform: Platform
  posts: number
  engagement: number | null
}

export type ScheduledPost = {
  id: string
  title: string
  scheduledAt: string
  platforms: Platform[]
  status: PostStatus
}

export type TopContentItem = {
  id: string
  title: string
  thumbnailUrl: string | null
  engagement: number | null
  status: PostStatus
}

export type PublishingActivityPoint = {
  date: string
  label: string
  published: number
  scheduled: number
  failed: number
}

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
  metaPostId?: string | null
  metaVideoId?: string | null
  createdAt: string
  updatedAt: string
  page: ConnectedPage | null
  asset: {
    id: string
    originalFileName: string
    mimeType: string | null
    fileSizeBytes: string | null
    status: string
  } | null
}

export type JobSummary = {
  total: number
  draft: number
  awaitingUpload: number
  ready: number
  queued: number
  processing: number
  scheduled: number
  published: number
  failed: number
  cancelled: number
}

export type StudioOverview = {
  user: {
    id: string
    name: string | null
    businessName: string | null
    email: string
  }
  license: {
    allowed: boolean
    plan: string
    subscriptionStatus: string
    trialEndsAt: string | null
    limits: {
      pages: number | null
      batchPosts: number | null
      devices: number | null
    }
  }
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
}
