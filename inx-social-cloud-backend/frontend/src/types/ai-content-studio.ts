import type { MediaAsset } from './media-library'

export type AIContentType =
  | 'image_post'
  | 'carousel_post'
  | 'short_video'
  | 'ugc_ad'

export type GenerationStatus =
  | 'idle'
  | 'preparing'
  | 'generating'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type AIPlanAccess = {
  plan: 'trial' | 'creator' | 'pro' | 'business' | 'agency'
  administrator?: boolean
  studioEnabled: boolean
  creditsRemaining: number | null
  creditsLimit: number | null
  unlimitedCredits: boolean
  creditsConfigured: boolean
  commercialUse: boolean
  priorityProcessing: boolean
  monthlyRemaining?: number
  topupRemaining?: number
  periodStart?: string
  periodEnd?: string
  providerConfigured?: boolean
  topupsSupported?: boolean
  topupsEnabled?: boolean
}

export type GenerationRequest = {
  type: AIContentType
  prompt: string
  platform?: string
  aspectRatio?: string
  tone?: string
  brandKitId?: string
  options: Record<string, unknown>
}

export type GeneratedAsset = {
  id: string
  type: 'image' | 'video' | 'carousel'
  url: string
  thumbnailUrl?: string
  prompt: string
  caption?: string
  hashtags?: string[]
  altText?: string
  creditsUsed: number
  createdAt: string
  provider?: string
  model?: string
  aspectRatio?: string
  mediaLibraryAssetId?: string | null
  slides?: GeneratedAsset[]
  variants?: GeneratedAsset[]
  script?: string
  hook?: string
  cta?: string
  warnings?: string[]
  completionStatus?: 'completed' | 'completed_with_warnings'
  expiresAt?: string
  retentionDays?: number
  studioState?: Record<string, unknown>
  provenance?: Array<{
    provider: string
    providerId: string
    sourceUrl: string
    creator: string
    creatorUrl?: string
    searchQuery?: string
    license?: string
  }>
}

export type AIDraft = {
  id: string
  contentType: AIContentType
  title: string
  thumbnailUrl?: string
  updatedAt: string
  status: 'draft' | 'ready'
  prompt?: string
  caption?: string
  hashtags?: string[]
  altText?: string
  asset?: GeneratedAsset | null
  mediaLibraryAsset?: MediaAsset | null
  mediaLibraryAssets?: MediaAsset[]
}

export type BrandKit = {
  id: string
  name: string
  active?: boolean
}

export type GenerationHistoryItem = {
  id: string
  type: AIContentType | 'stock_video'
  provider?: string | null
  prompt: string
  createdAt: string
  completedAt?: string | null
  creditsUsed: number
  status: Exclude<GenerationStatus, 'idle'>
  progress?: number
  assetUrl?: string | null
  thumbnailUrl?: string | null
  error?: string | null
}

export type GenerationJob = {
  id: string
  type?: AIContentType | 'stock_video'
  provider?: string | null
  prompt?: string
  status: GenerationStatus
  progress?: number
  asset?: GeneratedAsset | null
  error?: string | null
  createdAt?: string
  completedAt?: string | null
}

export type GenerationCostEstimate = {
  credits: number
  source: 'backend' | 'fallback'
  explanation?: string
}

export type PostsHandoffState = {
  aiDraft: AIDraft
}


export type AIPostCampaignPost = {
  id: string
  sequence: number
  status: string
  contentType: 'TEXT' | 'IMAGE'
  pillar?: string | null
  hook?: string | null
  caption: string
  cta?: string | null
  hashtags: string[]
  imageBrief?: string | null
  mediaAssetId?: string | null
  mediaAsset?: GeneratedAsset | null
  createdAt: string
  updatedAt: string
}

export type AIPostCampaign = {
  id: string
  title: string
  businessUrl?: string | null
  goal: string
  audience?: string | null
  contentMode: 'TEXT' | 'IMAGE' | 'MIXED'
  platforms: string[]
  postCount: number
  imagePostCount: number
  textPostCount: number
  status: string
  strategySummary?: string
  audienceSummary?: string
  contentPillars: string[]
  sourceSummary?: string
  sourceUrl?: string | null
  createdAt: string
  updatedAt: string
  counts: {
    total: number
    textPosts: number
    imagePosts: number
    withImages: number
    ready: number
  }
  posts: AIPostCampaignPost[]
}

export type CreateAIPostCampaignInput = {
  businessUrl?: string
  goal: string
  audience?: string
  contentMode: 'TEXT' | 'IMAGE' | 'MIXED'
  platforms: string[]
  postCount: number
  imagePostCount?: number
}

export type AIPostCampaignHandoff = {
  id: string
  title: string
  contentMode: 'TEXT' | 'IMAGE' | 'MIXED'
  captions: string[]
  mediaAssetIds: string[]
}
