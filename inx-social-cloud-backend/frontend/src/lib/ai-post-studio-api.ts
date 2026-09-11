import { ApiError, apiRequest } from './api-client'
import type { GeneratedAsset } from '../types/ai-content-studio'

export const SOURCE_MEMORY_PREFIX = '[[INXSOCIAL_SOURCE_ANALYSIS_V2]]'

export type PostStudioMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type PostStudioBrief = {
  objective: string
  audience: string
  platform: string
  aspectRatio: '1:1' | '4:5' | '9:16' | '16:9'
  tone: string
  visualStyle: string
  headline: string
  supportingCopy: string
  cta: string
  visualDirection: string
  caption: string
  hashtags: string[]
  altText: string
}

export type PostStudioSourceAnalysis = {
  fingerprint: string
  productName: string
  summary: string
  positioning: string
  audience: string[]
  verifiedClaims: string[]
  visualIdentity: string[]
  assetObservations: string[]
  strongestAngles: string[]
  cautions: string[]
  sources: Array<{ type: 'url' | 'reference'; label: string; ok: boolean }>
}

export type PostStudioRouting = {
  assistantTier: 'fast' | 'reasoning' | 'guardrail'
  deepAnalysisPerformed: boolean
  reusedSourceAnalysis: boolean
}

export type PostStudioAssistantResponse = {
  reply: string
  inScope: boolean
  readyToGenerate: boolean
  needsMoreContext: boolean
  quickReplies: string[]
  brief: PostStudioBrief
  sourceAnalysis: PostStudioSourceAnalysis | null
  routing: PostStudioRouting
  analysedUrls: Array<{ url: string; ok: boolean; title: string | null; error: string | null }>
  analysedReferences: Array<{ id: string; name: string }>
}

export function sourceAnalysisMemoryMessage(analysis: PostStudioSourceAnalysis | null): PostStudioMessage | null {
  if (!analysis?.fingerprint) return null
  return { role: 'assistant', content: `${SOURCE_MEMORY_PREFIX}${JSON.stringify(analysis)}` }
}

function studioFailure(error: unknown, kind: 'assistant' | 'render') {
  if (error instanceof ApiError && [500, 502, 503, 504].includes(error.status)) {
    if (kind === 'render') {
      return new Error('Image generation hit a temporary provider or network problem. Please retry the render. If the render did not complete, its reserved credits are refunded automatically.')
    }
    return new Error('The AI Post Studio hit a temporary provider or network problem. Please retry your last message.')
  }
  return error instanceof Error ? error : new Error(kind === 'render' ? 'The post image could not be generated.' : 'The AI Post Studio could not respond.')
}

export async function sendPostStudioMessage(input: {
  messages: PostStudioMessage[]
  urls?: string[]
  referenceAssetIds?: string[]
  platform?: string
  aspectRatio?: PostStudioBrief['aspectRatio']
}) {
  try {
    return await apiRequest<PostStudioAssistantResponse>('/api/ai-content-studio/assistant/message', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  } catch (error) {
    throw studioFailure(error, 'assistant')
  }
}

export async function generateConversationalImagePost(input: {
  prompt: string
  platform?: string
  aspectRatio?: PostStudioBrief['aspectRatio']
  referenceAssetIds?: string[]
  brief: PostStudioBrief
}, signal?: AbortSignal) {
  try {
    return await apiRequest<GeneratedAsset>('/api/ai-content-studio/generate/conversational-image-post', {
      method: 'POST',
      body: JSON.stringify(input),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw studioFailure(error, 'render')
  }
}
