export type Platform = 'facebook' | 'instagram' | 'youtube' | 'tiktok' | 'linkedin'

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

export type VideoStatus =
  | 'ready'
  | 'scheduled'
  | 'in_queue'
  | 'publishing'
  | 'published'
  | 'pending_review'
  | 'failed'

export type DashboardTone = 'blue' | 'cyan' | 'green' | 'purple' | 'amber' | 'red'

export type StatCardData = {
  label: string
  value: number
  detail: string
  tone: DashboardTone
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
}
