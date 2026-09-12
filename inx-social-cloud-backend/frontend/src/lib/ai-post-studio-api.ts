import { ApiError, apiRequest, getStoredAuthToken } from './api-client'
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

export type PostStudioReferenceUpload = {
  id: string
  fileName: string
  mimeType: string
  byteSize: number
  convertedToPreview: boolean
}

function compactStrings(values: string[] | undefined, maxItems: number, maxChars: number) {
  return (values || []).slice(0, maxItems).map((value) => String(value || '').slice(0, maxChars)).filter(Boolean)
}

export function sourceAnalysisMemoryMessage(analysis: PostStudioSourceAnalysis | null): PostStudioMessage | null {
  if (!analysis?.fingerprint) return null
  // Assistant-message validation is intentionally capped at 4,000 characters. Keep the
  // reusable source memory comfortably below that ceiling rather than sending the full
  // research object back through the conversational message field.
  const compact = {
    fingerprint: analysis.fingerprint,
    productName: String(analysis.productName || '').slice(0, 140),
    summary: String(analysis.summary || '').slice(0, 700),
    positioning: String(analysis.positioning || '').slice(0, 420),
    audience: compactStrings(analysis.audience, 4, 120),
    verifiedClaims: compactStrings(analysis.verifiedClaims, 6, 180),
    visualIdentity: compactStrings(analysis.visualIdentity, 5, 150),
    assetObservations: compactStrings(analysis.assetObservations, 5, 170),
    strongestAngles: compactStrings(analysis.strongestAngles, 4, 180),
    cautions: compactStrings(analysis.cautions, 4, 160),
    sources: (analysis.sources || []).slice(0, 8).map((item) => ({ type: item.type, label: String(item.label || '').slice(0, 160), ok: item.ok })),
  }
  return { role: 'assistant', content: `${SOURCE_MEMORY_PREFIX}${JSON.stringify(compact)}` }
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

export function uploadPostStudioReference(file: File, onProgress: (percent: number) => void): Promise<PostStudioReferenceUpload> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', '/api/ai-content-studio/references')
    request.withCredentials = true
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    request.setRequestHeader('X-File-Name', encodeURIComponent(file.name))
    const token = getStoredAuthToken()
    if (token) request.setRequestHeader('Authorization', `Bearer ${token}`)
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    request.onload = () => {
      let payload: { reference?: PostStudioReferenceUpload; error?: string } = {}
      try { payload = JSON.parse(request.responseText || '{}') } catch { /* use HTTP fallback */ }
      if (request.status >= 200 && request.status < 300 && payload.reference) resolve(payload.reference)
      else reject(new Error(payload.error || `Reference upload failed (HTTP ${request.status}).`))
    }
    request.onerror = () => reject(new Error('The reference upload connection was interrupted.'))
    request.send(file)
  })
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
