import { apiRequest } from './api-client'
import type { GeneratedAsset, GenerationCostEstimate } from '../types/ai-content-studio'
import type { PostStudioBrief, PostStudioSourceAnalysis } from './ai-post-studio-api'

export type VideoResolution = string
export type VideoAspectRatio = '9:16' | '16:9' | '1:1' | '4:5'
export type VideoGenerationMode = 'TEXT_TO_VIDEO' | 'IMAGE_TO_VIDEO' | 'REFERENCE_TO_VIDEO' | 'VIDEO_TO_VIDEO' | 'AUDIO_TO_VIDEO'

export type VideoModelOption = {
  id: string
  routeId?: string
  air?: string
  name: string
  creator?: string | null
  badge?: string | null
  speed?: 'fast' | 'balanced' | 'quality' | 'premium' | null
  description: string
  coverImage?: string | null
  modes: VideoGenerationMode[]
  resolutions: VideoResolution[]
  availableResolutions?: VideoResolution[]
  durations: number[]
  availableDurations?: number[]
  fps?: number[]
  availableFps?: number[]
  aspects: VideoAspectRatio[]
  draftSupported: boolean
  audioSupported: boolean
  imageReferenceSupported: boolean
  firstFrameSupported?: boolean
  lastFrameSupported?: boolean
  referenceImagesSupported?: boolean
  compatibility?: string
  generationReady?: boolean
  pricingStatus?: string
  baselineCredits?: number | null
  tags: string[]
}

export type VideoCatalog = {
  version: string
  source: string
  syncedAt: string
  stats: {
    total: number
    compatibility: number
    discovered: number
    generationReady: number
    pricingSynced: number
    schemaResolved: number
  }
  health?: {
    status: 'HEALTHY' | 'DEGRADED'
    fresh: boolean
    source: string
    syncedAt: string | null
    pricingAgeMinutes: number | null
    pricingMaxAgeHours: number
    creditCostBuffer: number
    maxGenerationCredits: number
    costDriftTolerance: number
    blockedModels: number
    generationReady: number
    pricingSynced: number
    total: number
    reasons: string[]
  }
  models: VideoModelOption[]
}

export type VideoStudioSelection = {
  modelRoute: string
  mode?: VideoGenerationMode
  duration: number
  resolution: VideoResolution
  aspectRatio: VideoAspectRatio
  fps?: number
  draft: boolean
  audio: boolean
}

export type VideoModelRecommendation = VideoStudioSelection & {
  reason: string
}

export type StockVideoAccess = {
  enabled: boolean
  configured: boolean
  creditsRemaining: number
  creditsLimit: number
  estimates: Record<string, number>
  providers?: { pexels: boolean; pixabay: boolean }
  commercialOutput?: boolean
  runtime?: { name: string; commit?: string; pipelines: string[]; studioWorkflow?: { name: string; version: string; stageCount: number; stages: string[] } | null; providerMenu?: unknown } | null
}

export type StockVideoSelection = {
  prompt: string
  duration: 15 | 30 | 45 | 60
  resolution: '720p' | '1080p'
  aspectRatio: VideoAspectRatio
  tone: 'Natural' | 'Friendly' | 'Confident' | 'Energetic' | 'Professional' | 'Cinematic'
  voiceover: boolean
  captions: boolean
  fullRunAuthorized: boolean
}

export function generateConversationalCarousel(input: {
  prompt: string
  platform?: string
  aspectRatio: '1:1' | '4:5' | '9:16' | '16:9'
  slides: number
  referenceAssetIds?: string[]
  brief: PostStudioBrief
  sourceAnalysis?: PostStudioSourceAnalysis | null
}, signal?: AbortSignal) {
  return apiRequest<GeneratedAsset>('/api/ai-content-studio/generate/conversational-carousel', {
    method: 'POST', body: JSON.stringify(input), signal,
  })
}

export async function getVideoModels() {
  const response = await apiRequest<{ models: VideoModelOption[] }>('/api/ai-content-studio/video/models')
  return response.models
}

export function getVideoCatalog() {
  return apiRequest<VideoCatalog>('/api/ai-content-studio/video/catalog', { cache: 'no-store' })
}

export function recommendVideoModel(input: { prompt: string; hasReference: boolean; aspectRatio: VideoAspectRatio }) {
  return apiRequest<VideoModelRecommendation>('/api/ai-content-studio/video/recommend', {
    method: 'POST', body: JSON.stringify(input),
  })
}

export function estimateVideoCredits(selection: VideoStudioSelection) {
  return apiRequest<GenerationCostEstimate>('/api/ai-content-studio/video/estimate', {
    method: 'POST', body: JSON.stringify(selection),
  })
}

export function generateStudioVideo(input: VideoStudioSelection & {
  prompt: string
  sourceMediaLibraryAssetId?: string | null
  firstFrameMediaLibraryAssetId?: string | null
  lastFrameMediaLibraryAssetId?: string | null
  referenceMediaLibraryAssetIds?: string[]
  caption?: string
  hashtags?: string[]
  script?: string
}, signal?: AbortSignal) {
  return apiRequest<{ id: string; status: 'preparing'; progress: number }>('/api/ai-content-studio/generate/video-studio', {
    method: 'POST', body: JSON.stringify(input), signal,
  })
}

export function getStockVideoAccess() {
  return apiRequest<StockVideoAccess>('/api/ai-content-studio/stock-video/access')
}

export function generateStockVideo(input: StockVideoSelection) {
  return apiRequest<{ id: string; status: 'preparing'; progress: number; credits: number }>('/api/ai-content-studio/generate/stock-video', {
    method: 'POST', body: JSON.stringify(input),
  })
}
