import { apiRequest } from './api-client'
import type { GeneratedAsset } from '../types/ai-content-studio'

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

export type PostStudioAssistantResponse = {
  reply: string
  inScope: boolean
  readyToGenerate: boolean
  needsMoreContext: boolean
  quickReplies: string[]
  brief: PostStudioBrief
  model: string
  analysedUrls: Array<{ url: string; ok: boolean; title: string | null; error: string | null }>
  analysedReferences: Array<{ id: string; name: string }>
}

export function sendPostStudioMessage(input: {
  messages: PostStudioMessage[]
  urls?: string[]
  referenceAssetIds?: string[]
  platform?: string
  aspectRatio?: PostStudioBrief['aspectRatio']
}) {
  return apiRequest<PostStudioAssistantResponse>('/api/ai-content-studio/assistant/message', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function generateConversationalImagePost(input: {
  prompt: string
  platform?: string
  aspectRatio?: PostStudioBrief['aspectRatio']
  referenceAssetIds?: string[]
  brief: PostStudioBrief
}, signal?: AbortSignal) {
  return apiRequest<GeneratedAsset>('/api/ai-content-studio/generate/conversational-image-post', {
    method: 'POST',
    body: JSON.stringify(input),
    signal,
  })
}
