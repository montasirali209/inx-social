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
  plan: 'trial' | 'pro' | 'plus'
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
  type: AIContentType
  prompt: string
  createdAt: string
  creditsUsed: number
  status: Exclude<GenerationStatus, 'idle'>
  assetUrl?: string | null
}

export type GenerationCostEstimate = {
  credits: number
  source: 'backend' | 'fallback'
  explanation?: string
}

export type PostsHandoffState = {
  aiDraft: AIDraft
}
