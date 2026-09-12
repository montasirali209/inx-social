import { apiRequest } from './api-client'
import type { GeneratedAsset, GenerationCostEstimate } from '../types/ai-content-studio'
import type { PostStudioBrief, PostStudioSourceAnalysis } from './ai-post-studio-api'

export type VideoResolution = '480p' | '720p' | '1080p'
export type VideoAspectRatio = '9:16' | '16:9' | '1:1'

export type VideoModelOption = {
  id: string
  name: string
  badge: string
  speed: 'fast' | 'balanced' | 'quality' | 'premium'
  description: string
  resolutions: VideoResolution[]
  durations: number[]
  aspects: VideoAspectRatio[]
  draftSupported: boolean
  audioSupported: boolean
  imageReferenceSupported: boolean
  tags: string[]
}

export type VideoStudioSelection = {
  modelRoute: string
  duration: number
  resolution: VideoResolution
  aspectRatio: VideoAspectRatio
  draft: boolean
  audio: boolean
}

export type VideoModelRecommendation = VideoStudioSelection & {
  reason: string
}

export type StockVideoAccess = {
  enabled: boolean
  configured: boolean
  limit: number
  used: number
  remaining: number
  periodStart?: string
  periodEnd?: string
  providers?: { pexels: boolean; pixabay: boolean; archiveOrg: boolean }
  commercialOutput?: boolean
}

export type StockVideoSelection = {
  prompt: string
  duration: 15 | 30 | 45 | 60
  resolution: '720p' | '1080p'
  aspectRatio: VideoAspectRatio
  tone: 'Natural' | 'Friendly' | 'Confident' | 'Energetic' | 'Professional' | 'Cinematic'
  voiceover: boolean
  captions: boolean
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
  caption?: string
  hashtags?: string[]
  script?: string
}, signal?: AbortSignal) {
  return apiRequest<GeneratedAsset>('/api/ai-content-studio/generate/video-studio', {
    method: 'POST', body: JSON.stringify(input), signal,
  })
}

export function getStockVideoAccess() {
  return apiRequest<StockVideoAccess>('/api/ai-content-studio/stock-video/access')
}

export function generateStockVideo(input: StockVideoSelection) {
  return apiRequest<{ id: string; status: 'preparing'; progress: number }>('/api/ai-content-studio/generate/stock-video', {
    method: 'POST', body: JSON.stringify(input),
  })
}
