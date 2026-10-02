import { apiRequest } from './api-client'
import type { PostStudioSourceAnalysis } from './ai-post-studio-api'
import type { AIPostCampaign } from '../types/ai-content-studio'

export type CreativeFlowBrandReference = {
  url?: string
  kind?: string
  label?: string
}

export type CreativeFlowBrandPack = {
  sourceUrl: string | null
  brandName: string
  colors: string[]
  logo: CreativeFlowBrandReference | null
  icon: CreativeFlowBrandReference | null
  productVisuals: CreativeFlowBrandReference[]
  heroVisuals: CreativeFlowBrandReference[]
  confidence: 'high' | 'medium' | 'low'
  confidenceScore: number
  lockLogo: boolean
}

export type CreativeFlowAnalysis = {
  sourceAnalysis: PostStudioSourceAnalysis
  brandPack: CreativeFlowBrandPack
  analysedUrl: {
    url: string
    ok: boolean
    title: string | null
    description: string | null
    error: string | null
  } | null
  analysedReferences: Array<{
    id: string
    name: string
    readable: boolean
  }>
}

export type CreativeFlowConcept = {
  sequence: number
  angle: string
  hook: string
  visualStyle: string
  message: string
  cta: string
  platformApproach: string
  evidenceBasis: 'verified_source' | 'user_brief' | 'brand_safe_generic'
}

export type CreativeFlowStrategy = {
  requestedCount: number
  strategy: {
    campaignTitle: string
    strategySummary: string
    audienceSummary: string
    contentPillars: string[]
    creativePrinciples: string[]
    claimGuardrails: string[]
  }
  concepts: CreativeFlowConcept[]
  model: string
}

export function analyzeCreativeFlow(input: {
  website?: string
  productName?: string
  prompt?: string
  audience?: string
  referenceAssetIds?: string[]
}) {
  return apiRequest<CreativeFlowAnalysis>('/api/ai-content-studio/creative-flow/analyze', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function planCreativeFlow(input: {
  productName?: string
  prompt: string
  platforms: string[]
  creativeCount: number
  goal?: string
  style?: string
  audience?: string
  sourceAnalysis: PostStudioSourceAnalysis
}) {
  return apiRequest<CreativeFlowStrategy>('/api/ai-content-studio/creative-flow/strategy', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}


export type CreativeFlowRenderCampaign = AIPostCampaign & {
  creativeFlow: {
    version: number
    creditsPerCreative: number
    plannedCredits: number
    originalConceptCount: number
    referenceAssetIds: string[]
  }
}

export function startCreativeFlowRender(input: {
  website?: string
  productName?: string
  prompt: string
  platforms: string[]
  goal?: string
  style?: string
  audience?: string
  referenceAssetIds?: string[]
  sourceAnalysis: PostStudioSourceAnalysis
  brandPack: CreativeFlowBrandPack
  strategy: CreativeFlowStrategy['strategy']
  concepts: CreativeFlowConcept[]
}) {
  return apiRequest<{
    campaign: CreativeFlowRenderCampaign
    creditsPerCreative: number
    plannedCredits: number
  }>('/api/ai-content-studio/creative-flow/render', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getCreativeFlowRender(campaignId: string) {
  return apiRequest<{ campaign: CreativeFlowRenderCampaign }>(
    `/api/ai-content-studio/creative-flow/render/${encodeURIComponent(campaignId)}`,
    { cache: 'no-store' },
  ).then((response) => response.campaign)
}

export function retryCreativeFlowRender(campaignId: string) {
  return apiRequest<{ campaign: CreativeFlowRenderCampaign }>(
    `/api/ai-content-studio/creative-flow/render/${encodeURIComponent(campaignId)}/retry`,
    { method: 'POST' },
  ).then((response) => response.campaign)
}

export function regenerateCreativeFlowPost(campaignId: string, postId: string) {
  return apiRequest<{ campaign: CreativeFlowRenderCampaign }>(
    `/api/ai-content-studio/creative-flow/render/${encodeURIComponent(campaignId)}/posts/${encodeURIComponent(postId)}/regenerate`,
    { method: 'POST' },
  ).then((response) => response.campaign)
}

export function deleteCreativeFlowRender(campaignId: string) {
  return apiRequest<{ ok: true }>(
    `/api/ai-content-studio/creative-flow/render/${encodeURIComponent(campaignId)}`,
    { method: 'DELETE' },
  )
}
