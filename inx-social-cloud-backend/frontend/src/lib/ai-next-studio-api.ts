import { apiRequest } from './api-client'
import type { GeneratedAsset, GenerationCostEstimate } from '../types/ai-content-studio'
import type { PostStudioBrief, PostStudioSourceAnalysis } from './ai-post-studio-api'

export type VideoModelOption = {
  id: 'fast' | 'quality'
  name: string
  badge: string
  description: string
  resolutions: Array<'480p' | '720p' | '1080p'>
  durations: number[]
  aspects: Array<'9:16' | '16:9' | '1:1'>
  draftSupported: boolean
  audioSupported: boolean
  imageReferenceSupported: boolean
}

export type VideoStudioSelection = {
  modelRoute: 'fast' | 'quality'
  duration: number
  resolution: '480p' | '720p' | '1080p'
  aspectRatio: '9:16' | '16:9' | '1:1'
  draft: boolean
  audio: boolean
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
