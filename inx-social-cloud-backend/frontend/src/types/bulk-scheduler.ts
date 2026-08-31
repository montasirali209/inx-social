import type { BackendJobStatus, ConnectedPage, DashboardJob } from './dashboard'

export type Platform = 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube' | 'x'

export type PlatformAvailability = 'LIVE' | 'PLANNED'

export type PlatformDefinition = {
  code: string
  label: string
  provider: string
  availability: PlatformAvailability
  profileTypes: string[]
  capabilities: Record<string, boolean>
}

export type Destination = {
  id: string
  name: string
  handle: string | null
  platform: Platform
  type: string
  avatarUrl: string | null
  connected: boolean
  disabledReason: string | null
}

export type TimingMode =
  | 'publish_now'
  | 'schedule_time'
  | 'next_available_slots'
  | 'spread_across_days'
  | 'best_engagement_time'

export type UploadStatus = 'waiting' | 'uploading' | 'published' | 'scheduled' | 'failed' | 'blocked'

export type MediaKind = 'image' | 'video'

export type SelectedMedia = {
  id: string
  file: File
  previewUrl: string
  kind: MediaKind
}

export type UploadResult = {
  id: string
  jobId: string | null
  fileName: string
  mediaKind: MediaKind
  thumbnailUrl: string
  destinationIds: string[]
  status: UploadStatus
  resultId: string | null
  errorMessage: string | null
  scheduledAt: string | null
}

export type BatchProgress = {
  state: 'idle' | 'preparing' | 'uploading' | 'scheduling' | 'completed' | 'failed' | 'stopped'
  percent: number
  current: number
  total: number
  completed: number
  failed: number
  message: string
}

export type StudioPlatformsResponse = {
  live: string[]
  platforms: PlatformDefinition[]
}

export type StudioJobsResponse = { jobs: DashboardJob[] }

export type ConnectedPagesResponse = { pages: ConnectedPage[] }

export type ScheduledPostsResponse = {
  result: { data: Array<{ id: string; scheduled_publish_time?: number }> }
}

export type UploadMediaResponse = {
  job: DashboardJob
  accepted: boolean
  processing?: boolean
  scheduled?: boolean
  published?: boolean
}

export type BulkSchedulerData = {
  pages: ConnectedPage[]
  platforms: PlatformDefinition[]
  jobs: DashboardJob[]
}

export function backendStatusToUploadStatus(status: BackendJobStatus): UploadStatus {
  if (status === 'PUBLISHED') return 'published'
  if (status === 'SCHEDULED') return 'scheduled'
  if (status === 'FAILED' || status === 'CANCELLED') return 'failed'
  if (status === 'PROCESSING') return 'uploading'
  return 'waiting'
}
