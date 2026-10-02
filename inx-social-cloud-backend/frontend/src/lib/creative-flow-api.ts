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
    projectId?: string | null
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


export function handoffCreativeFlowCampaign(campaignId: string, approvedPostIds: string[]) {
  return apiRequest<{
    campaign: AIPostCampaign
    reused: boolean
  }>(
    `/api/ai-content-studio/creative-flow/render/${encodeURIComponent(campaignId)}/handoff`,
    {
      method: 'POST',
      body: JSON.stringify({ approvedPostIds }),
    },
  )
}


export type CreativeFlowProject = {
  id: string
  name: string
  status: string
  currentStage: string
  activeJobType: string | null
  activeJobId: string | null
  progress: {
    current: number
    total: number
    label: string | null
  }
  productUrl: string | null
  workflow: {
    version: number
    source: {
      websiteInput: string
      normalizedUrl: string
      referenceAssetIds: string[]
      referenceNames: string[]
    }
    analysis: CreativeFlowAnalysis | null
    campaignSetup: {
      goal: string
      platforms: string[]
      creativeCount: number
      style: string
      audience: string
    }
    strategyPlan: CreativeFlowStrategy | null
    selectedConceptSequences: number[]
    generation: {
      plannedCredits: number
      creditsPerCreative: number
    }
    review: {
      selectedPostIds: string[]
      revealedPostIds: string[]
      failedPostId: string | null
      failedPostError: string | null
    }
    canvas: {
      positions: {
        productUrl: { x: number; y: number }
        productImages: { x: number; y: number }
        analyzeProduct: { x: number; y: number }
        productIntelligence: { x: number; y: number }
        campaignSetup: { x: number; y: number }
        creativeStrategy: { x: number; y: number }
        generateCreatives: { x: number; y: number }
      }
      creativePositions: Record<string, { x: number; y: number }>
      schedulePosition: { x: number; y: number } | null
      viewport: { x: number; y: number; zoom: number }
    }
  }
  renderCampaignId: string | null
  handoffCampaignId: string | null
  lastError: string | null
  lastOpenedAt: string
  createdAt: string
  updatedAt: string
}

export type CreativeFlowProjectList = {
  projects: CreativeFlowProject[]
  archivedProjects: CreativeFlowProject[]
  activeProject: CreativeFlowProject | null
}

export function listCreativeFlowProjects() {
  return apiRequest<CreativeFlowProjectList>('/api/ai-content-studio/creative-flow/projects', {
    cache: 'no-store',
  })
}

export function createCreativeFlowProject(name: string) {
  return apiRequest<{ project: CreativeFlowProject }>('/api/ai-content-studio/creative-flow/projects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }).then((response) => response.project)
}

export function openCreativeFlowProject(projectId: string) {
  return apiRequest<{ project: CreativeFlowProject }>(
    `/api/ai-content-studio/creative-flow/projects/${encodeURIComponent(projectId)}/open`,
    { method: 'POST' },
  ).then((response) => response.project)
}

export function renameCreativeFlowProject(projectId: string, name: string) {
  return apiRequest<{ project: CreativeFlowProject }>(
    `/api/ai-content-studio/creative-flow/projects/${encodeURIComponent(projectId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    },
  ).then((response) => response.project)
}

export function archiveCreativeFlowProject(projectId: string) {
  return apiRequest<{ ok: true }>(
    `/api/ai-content-studio/creative-flow/projects/${encodeURIComponent(projectId)}`,
    { method: 'DELETE' },
  )
}

export function restoreCreativeFlowProject(projectId: string) {
  return apiRequest<{ project: CreativeFlowProject }>(
    `/api/ai-content-studio/creative-flow/projects/${encodeURIComponent(projectId)}/restore`,
    { method: 'POST' },
  ).then((response) => response.project)
}


export function getCreativeFlowProject(projectId: string) {
  return apiRequest<{ project: CreativeFlowProject }>(
    `/api/ai-content-studio/creative-flow/projects/${encodeURIComponent(projectId)}`,
    { cache: 'no-store' },
  ).then((response) => response.project)
}

export function saveCreativeFlowProjectSource(projectId: string, input: {
  website?: string
  referenceAssetIds?: string[]
  referenceNames?: string[]
}) {
  return apiRequest<{ project: CreativeFlowProject }>(
    `/api/ai-content-studio/creative-flow/projects/${encodeURIComponent(projectId)}/source`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  ).then((response) => response.project)
}

export function analyzeCreativeFlowProject(projectId: string, input: {
  website?: string
  referenceAssetIds?: string[]
  referenceNames?: string[]
}) {
  return apiRequest<{ project: CreativeFlowProject }>(
    `/api/ai-content-studio/creative-flow/projects/${encodeURIComponent(projectId)}/analyze`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  ).then((response) => response.project)
}

export function saveCreativeFlowProjectCanvas(projectId: string, input: {
  positions: Partial<Record<'productUrl' | 'productImages' | 'analyzeProduct' | 'productIntelligence' | 'campaignSetup' | 'creativeStrategy' | 'generateCreatives', { x: number; y: number }>>
  creativePositions?: Record<string, { x: number; y: number }>
  schedulePosition?: { x: number; y: number } | null
  viewport?: { x: number; y: number; zoom: number }
}) {
  return apiRequest<{ project: CreativeFlowProject }>(
    `/api/ai-content-studio/creative-flow/projects/${encodeURIComponent(projectId)}/canvas`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  ).then((response) => response.project)
}


export function saveCreativeFlowCampaignSetup(projectId: string, input: {
  goal: string
  platforms: string[]
  creativeCount: number
  style: string
  audience: string
}) {
  return apiRequest<{ project: CreativeFlowProject }>(
    `/api/ai-content-studio/creative-flow/projects/${encodeURIComponent(projectId)}/campaign-setup`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  ).then((response) => response.project)
}


export function startCreativeFlowProjectStrategy(projectId: string) {
  return apiRequest<{ project: CreativeFlowProject }>(
    `/api/ai-content-studio/creative-flow/projects/${encodeURIComponent(projectId)}/strategy`,
    { method: 'POST' },
  ).then((response) => response.project)
}

export function saveCreativeFlowStrategySelection(projectId: string, sequences: number[]) {
  return apiRequest<{ project: CreativeFlowProject }>(
    `/api/ai-content-studio/creative-flow/projects/${encodeURIComponent(projectId)}/strategy-selection`,
    {
      method: 'PATCH',
      body: JSON.stringify({ sequences }),
    },
  ).then((response) => response.project)
}

export type CreativeFlowGenerationEstimate = {
  count: number
  creditsPerCreative: number
  requiredCredits: number
  creditsRemaining: number
  canGenerate: boolean
}

export function getCreativeFlowGenerationEstimate(projectId: string, count?: number) {
  const query = count == null ? '' : `?count=${encodeURIComponent(String(count))}`
  return apiRequest<CreativeFlowGenerationEstimate>(
    `/api/ai-content-studio/creative-flow/projects/${encodeURIComponent(projectId)}/generation-estimate${query}`,
    { cache: 'no-store' },
  )
}

export function generateCreativeFlowCampaign(projectId: string, input: {
  goal: string
  platforms: string[]
  creativeCount: number
  style: string
  audience: string
}) {
  return apiRequest<{ project: CreativeFlowProject }>(
    `/api/ai-content-studio/creative-flow/projects/${encodeURIComponent(projectId)}/campaign-generate`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  ).then((response) => response.project)
}

export function startCreativeFlowProjectGeneration(projectId: string) {
  return apiRequest<{ project: CreativeFlowProject }>(
    `/api/ai-content-studio/creative-flow/projects/${encodeURIComponent(projectId)}/generate`,
    { method: 'POST' },
  ).then((response) => response.project)
}


export function saveCreativeFlowReviewSelection(projectId: string, postIds: string[]) {
  return apiRequest<{ project: CreativeFlowProject }>(
    `/api/ai-content-studio/creative-flow/projects/${encodeURIComponent(projectId)}/review-selection`,
    {
      method: 'PATCH',
      body: JSON.stringify({ postIds }),
    },
  ).then((response) => response.project)
}

export function saveCreativeFlowReviewReveal(projectId: string, postIds: string[]) {
  return apiRequest<{ project: CreativeFlowProject }>(
    `/api/ai-content-studio/creative-flow/projects/${encodeURIComponent(projectId)}/review-reveal`,
    {
      method: 'PATCH',
      body: JSON.stringify({ postIds }),
    },
  ).then((response) => response.project)
}

export function retryCreativeFlowMissing(projectId: string) {
  return apiRequest<{ project: CreativeFlowProject }>(
    `/api/ai-content-studio/creative-flow/projects/${encodeURIComponent(projectId)}/retry-missing`,
    { method: 'POST' },
  ).then((response) => response.project)
}

export function regenerateCreativeFlowProjectPost(projectId: string, postId: string, input: {
  caption?: string
  imageBrief?: string
} = {}) {
  return apiRequest<{ project: CreativeFlowProject }>(
    `/api/ai-content-studio/creative-flow/projects/${encodeURIComponent(projectId)}/posts/${encodeURIComponent(postId)}/regenerate`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  ).then((response) => response.project)
}

export function removeCreativeFlowProjectPost(projectId: string, postId: string) {
  return apiRequest<{ project: CreativeFlowProject; campaign: CreativeFlowRenderCampaign }>(
    `/api/ai-content-studio/creative-flow/projects/${encodeURIComponent(projectId)}/posts/${encodeURIComponent(postId)}`,
    { method: 'DELETE' },
  )
}

export function handoffCreativeFlowProject(projectId: string) {
  return apiRequest<{
    project: CreativeFlowProject
    campaign: AIPostCampaign
    reused: boolean
  }>(
    `/api/ai-content-studio/creative-flow/projects/${encodeURIComponent(projectId)}/handoff`,
    { method: 'POST' },
  )
}
