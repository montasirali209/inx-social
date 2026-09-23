import type { MediaAsset } from './media-library'

export type UGCQuality = 'STANDARD' | 'PREMIUM'
export type UGCDuration = 15 | 30 | 60
export type UGCAdCount = 1 | 5 | 10 | 15 | 20

export type UGCAvatar = {
  id: string
  scope: 'SYSTEM' | 'USER'
  name: string
  category: string
  presentation: string
  ageBand: string
  locale: string
  voice: string
  voicePrompt: string
  referenceReady: boolean
  imageUrl: string | null
  createdAt?: string
}

export type UGCBrandProfile = {
  id: string
  name: string
  websiteUrl: string
  productName: string
  summary: string
  audience: string[]
  verifiedClaims: string[]
  brandReferences: Array<string | { url?: string; type?: string }>
  analysis: {
    offerType?: string
    ugcDirections?: string[]
    productInteractionUseful?: boolean
    sourceTitle?: string
    sourceDescription?: string
  }
  updatedAt: string
}

export type UGCScene = {
  id: string
  sequence: number
  status: string
  kind: 'CREATOR' | 'PRODUCT' | 'LIFESTYLE' | 'CTA'
  route: string
  duration: number
  prompt: string
  script: string
  avatarId: string | null
  providerCostUsd: number
  model: string | null
  error: string | null
}

export type UGCAd = {
  id: string
  campaignId: string
  sequence: number
  status: string
  title: string
  angle: string
  hook: string
  script: string
  cta: string
  caption: string
  avatarId: string | null
  avatar: UGCAvatar | null
  route: string
  voice: string
  voicePrompt: string
  duration: number
  quality: UGCQuality
  credits: number
  generationId: string | null
  mediaAssetId: string | null
  musicMode: 'AUTO' | 'NONE'
  captionsEnabled: boolean
  plan: Record<string, unknown>
  error: string | null
  scenes: UGCScene[]
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export type UGCCampaign = {
  id: string
  title: string
  brandProfileId: string | null
  productUrl: string
  productDescription: string
  duration: number
  adCount: number
  quality: UGCQuality
  creatorMode: 'AUTO' | 'SELECTED'
  selectedAvatarId: string | null
  status: string
  totalCredits: number
  notes: string
  plan: Record<string, unknown>
  ads: UGCAd[]
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export type UGCOverview = {
  avatars: UGCAvatar[]
  brands: UGCBrandProfile[]
  campaigns: UGCCampaign[]
  music: Array<{ id: string; name: string; category: string; durationSeconds: number | null }>
  credits: { remaining: number; monthlyRemaining: number; topupRemaining: number }
  options: { durations: UGCDuration[]; adCounts: UGCAdCount[]; qualities: UGCQuality[]; systemAvatarCount: number }
}

export type CreateUGCCampaignInput = {
  brandProfileId?: string | null
  productUrl?: string
  productDescription?: string
  avatarId?: string | null
  creatorMode: 'AUTO' | 'SELECTED'
  duration: UGCDuration
  adCount: UGCAdCount
  quality: UGCQuality
  notes?: string
}

export type UGCEstimate = {
  credits: number
  perAd: number
  adCount: number
  duration: number
  quality: UGCQuality
}

export type UGCEditorUpdate = {
  avatarId?: string | null
  script?: string
  voice?: string
  voicePrompt?: string
  musicMode?: 'AUTO' | 'NONE'
  captionsEnabled?: boolean
  cta?: string
  caption?: string
}

export type UGCSchedulerState = {
  mediaLibraryAssets: MediaAsset[]
  aiMixedCampaign: {
    id: string
    title: string
    posts: Array<{ id: string; contentType: 'IMAGE'; caption: string; mediaAssetId: string }>
  }
}
