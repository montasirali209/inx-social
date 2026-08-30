import type { ConnectedPage, DashboardJob, StudioOverview } from './dashboard'

export type Platform = 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube' | 'x'
export type PostType = 'text' | 'image' | 'video' | 'reel' | 'carousel'
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'awaiting_approval' | 'needs_review' | 'failed'
export type ScheduleMode = 'now' | 'later' | 'draft'
export type EnhancementAction = 'rewrite' | 'shorten' | 'expand' | 'hashtags' | 'cta'
export type CaptionTone = 'professional' | 'friendly' | 'concise' | 'energetic'

export type CaptionEnhancement = {
  caption: string
  action: EnhancementAction
  tone: CaptionTone
}

export type BestTimeInsight = {
  available: boolean
  label: string
  time: string | null
  detail: string
}

export type Destination = {
  id: string
  platform: Platform
  name: string
  handle: string | null
  type: string
  avatarUrl: string | null
  connected: boolean
}

export type MediaItem = {
  id: string
  type: 'image' | 'video'
  file: File
  url: string
  thumbnailUrl: string
  fileName: string
  size: number
}

export type PostDraft = {
  id: string
  title: string
  caption: string
  postType: PostType
  mediaFileName: string | null
  selectedDestinationIds: string[]
  scheduleMode: ScheduleMode
  scheduledAt: string | null
  campaign: string
  labels: string[]
  status: 'draft'
  createdAt: string
}

export type PostsWorkspaceData = {
  overview: StudioOverview
  pages: ConnectedPage[]
  jobs: DashboardJob[]
}

export type CreateDirectPostInput = {
  connectedPageIds: string[]
  clientRequestId: string
  title: string | null
  caption: string
  contentType: 'TEXT' | 'IMAGE' | 'VIDEO'
  originalFileName: string | null
  mimeType: string | null
  fileSizeBytes: number | null
  scheduledAt: string | null
  publishMode: 'NOW' | 'SCHEDULED'
}

export type DirectPostResponse = {
  jobs: DashboardJob[]
  failures: Array<{ pageId: string; pageName: string; error: string }>
  uploadRequired: boolean
}

export type PublishProgress = {
  state: 'idle' | 'preparing' | 'uploading' | 'completed' | 'failed'
  percent: number
  message: string
}
