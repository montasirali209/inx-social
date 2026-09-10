import { ApiError, apiRequest, getStoredAuthToken } from './api-client'
import { fetchStudioOverview } from './dashboard-api'
import { fetchMediaLibrary, uploadMediaAsset } from './media-library-api'
import type { MediaAsset } from '../types/media-library'
import type {
  AIDraft,
  AIContentType,
  AIPlanAccess,
  BrandKit,
  GeneratedAsset,
  GenerationCostEstimate,
  GenerationHistoryItem,
  GenerationRequest,
  GenerationStatus,
} from '../types/ai-content-studio'

const DRAFT_KEY = 'inx-social-ai-drafts-v1'
const HISTORY_KEY = 'inx-social-ai-generation-history-v1'

function normalisePlan(plan: string): AIPlanAccess['plan'] {
  const value = String(plan || 'TRIAL').toUpperCase()
  if (value === 'PLUS' || value === 'LIFETIME') return 'plus'
  if (value === 'PRO') return 'pro'
  return 'trial'
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '') as T
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function writeLocal<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

function unavailableMessage(type: AIContentType) {
  const label = ({ image_post: 'image post', carousel_post: 'carousel', short_video: 'short video', ugc_ad: 'UGC ad' } as const)[type]
  return `The ${label} generation provider is not connected to the new AI Content Studio service yet. Your inputs are still available to edit.`
}

export async function getAIStudioAccess(): Promise<AIPlanAccess> {
  const overview = await fetchStudioOverview()
  const plan = normalisePlan(overview.license.plan)
  const studio = overview.features?.aiContentStudio
  const extended = studio as (typeof studio & {
    credits?: {
      remaining?: number | null
      limit?: number | null
      unlimited?: boolean
      commercialUse?: boolean
      priorityProcessing?: boolean
    }
  }) | undefined
  const credits = extended?.credits
  return {
    plan,
    studioEnabled: Boolean(studio?.allowed && plan === 'plus'),
    creditsRemaining: typeof credits?.remaining === 'number' ? credits.remaining : null,
    creditsLimit: typeof credits?.limit === 'number' ? credits.limit : null,
    unlimitedCredits: Boolean(credits?.unlimited),
    creditsConfigured: Boolean(credits),
    commercialUse: credits?.commercialUse ?? plan === 'plus',
    priorityProcessing: credits?.priorityProcessing ?? plan === 'plus',
  }
}

export async function getAICreditBalance() {
  const access = await getAIStudioAccess()
  return {
    remaining: access.creditsRemaining,
    limit: access.creditsLimit,
    unlimited: access.unlimitedCredits,
    configured: access.creditsConfigured,
  }
}

function fallbackCredits(request: GenerationRequest) {
  const variants = Math.max(1, Math.min(4, Number(request.options.variants || 1)))
  if (request.type === 'image_post') return Math.max(1, variants)
  if (request.type === 'carousel_post') {
    const slides = Math.max(3, Math.min(10, Number(request.options.slides || 4)))
    return Math.max(2, Math.ceil(slides / 4) * 2)
  }
  if (request.type === 'short_video') {
    const duration = Math.max(5, Math.min(30, Number(request.options.duration || 5)))
    return Math.max(3, Math.ceil(duration / 5) * 3)
  }
  const duration = Math.max(5, Math.min(30, Number(request.options.duration || 5)))
  return Math.max(2, Math.ceil(duration / 5) * 2)
}

export async function estimateGenerationCost(request: GenerationRequest): Promise<GenerationCostEstimate> {
  try {
    return await apiRequest<GenerationCostEstimate>('/api/ai-content-studio/estimate', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  } catch (error) {
    if (!(error instanceof ApiError) || ![404, 501].includes(error.status)) throw error
    return {
      credits: fallbackCredits(request),
      source: 'fallback',
      explanation: 'Estimated from the current Studio pricing profile. The generation service validates the final charge before starting.',
    }
  }
}

async function generate(endpoint: string, request: GenerationRequest, signal?: AbortSignal): Promise<GeneratedAsset> {
  try {
    return await apiRequest<GeneratedAsset>(endpoint, {
      method: 'POST',
      body: JSON.stringify(request),
      signal,
    })
  } catch (error) {
    if (error instanceof ApiError && [404, 501].includes(error.status)) {
      throw new Error(unavailableMessage(request.type))
    }
    throw error
  }
}

export function generateImagePost(request: GenerationRequest, signal?: AbortSignal) {
  return generate('/api/ai-content-studio/generate/image-post', request, signal)
}

export function generateCarouselPost(request: GenerationRequest, signal?: AbortSignal) {
  return generate('/api/ai-content-studio/generate/carousel-post', request, signal)
}

export function generateShortVideo(request: GenerationRequest, signal?: AbortSignal) {
  return generate('/api/ai-content-studio/generate/short-video', request, signal)
}

export function generateUGCAd(request: GenerationRequest, signal?: AbortSignal) {
  return generate('/api/ai-content-studio/generate/ugc-ad', request, signal)
}

export function getGenerationStatus(id: string) {
  return apiRequest<{ id: string; status: GenerationStatus; asset?: GeneratedAsset | null }>(`/api/ai-content-studio/generations/${encodeURIComponent(id)}`)
}

export function cancelGeneration(id: string) {
  return apiRequest<{ ok: boolean; status: GenerationStatus }>(`/api/ai-content-studio/generations/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
}

async function downloadGeneratedFile(asset: GeneratedAsset) {
  const headers = new Headers()
  const token = getStoredAuthToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(asset.url, { credentials: 'include', headers })
  if (!response.ok) throw new Error(`Generated media could not be prepared for Media Library (HTTP ${response.status}).`)
  const blob = await response.blob()
  const extension = asset.type === 'video' ? 'mp4' : 'png'
  return new File([blob], `inxsocial-ai-${asset.id}.${extension}`, { type: blob.type || (asset.type === 'video' ? 'video/mp4' : 'image/png') })
}

export async function saveGeneratedAsset(asset: GeneratedAsset, onProgress: (percent: number) => void = () => {}): Promise<MediaAsset> {
  if (asset.mediaLibraryAssetId) {
    const library = await fetchMediaLibrary()
    const existing = library.assets.find((item) => item.id === asset.mediaLibraryAssetId)
    if (existing) return existing
  }
  const file = await downloadGeneratedFile(asset)
  return uploadMediaAsset(file, null, onProgress)
}

export async function saveGeneratedAssets(asset: GeneratedAsset, onProgress: (percent: number) => void = () => {}) {
  const assets = asset.type === 'carousel' && asset.slides?.length ? asset.slides : [asset]
  const saved: MediaAsset[] = []
  for (let index = 0; index < assets.length; index += 1) {
    const offset = (index / Math.max(1, assets.length)) * 100
    const span = 100 / Math.max(1, assets.length)
    saved.push(await saveGeneratedAsset(assets[index], (percent) => onProgress(Math.round(offset + (percent / 100) * span))))
  }
  return saved
}

export async function saveAIDraft(draft: AIDraft): Promise<AIDraft> {
  try {
    return await apiRequest<AIDraft>('/api/ai-content-studio/drafts', {
      method: 'POST',
      body: JSON.stringify(draft),
    })
  } catch (error) {
    if (!(error instanceof ApiError) || ![404, 501].includes(error.status)) throw error
    const drafts = readLocal<AIDraft[]>(DRAFT_KEY, [])
    const next = [draft, ...drafts.filter((item) => item.id !== draft.id)].slice(0, 40)
    writeLocal(DRAFT_KEY, next)
    return draft
  }
}

export async function getRecentAIDrafts(): Promise<AIDraft[]> {
  try {
    const response = await apiRequest<{ drafts: AIDraft[] }>('/api/ai-content-studio/drafts?limit=8')
    return response.drafts
  } catch (error) {
    if (!(error instanceof ApiError) || ![404, 501].includes(error.status)) throw error
    return readLocal<AIDraft[]>(DRAFT_KEY, []).slice(0, 8)
  }
}

export async function deleteAIDraft(id: string) {
  try {
    await apiRequest(`/api/ai-content-studio/drafts/${encodeURIComponent(id)}`, { method: 'DELETE' })
  } catch (error) {
    if (!(error instanceof ApiError) || ![404, 501].includes(error.status)) throw error
  }
  const drafts = readLocal<AIDraft[]>(DRAFT_KEY, [])
  writeLocal(DRAFT_KEY, drafts.filter((item) => item.id !== id))
}

export async function duplicateAIDraft(draft: AIDraft) {
  const copy: AIDraft = {
    ...draft,
    id: crypto.randomUUID(),
    title: `${draft.title} copy`,
    updatedAt: new Date().toISOString(),
    status: 'draft',
  }
  return saveAIDraft(copy)
}

export async function sendDraftToPosts(draft: AIDraft): Promise<AIDraft> {
  try {
    return await apiRequest<AIDraft>(`/api/ai-content-studio/drafts/${encodeURIComponent(draft.id)}/send-to-posts`, { method: 'POST' })
  } catch (error) {
    if (!(error instanceof ApiError) || ![404, 501].includes(error.status)) throw error
    return draft
  }
}

export async function getBrandKits(): Promise<BrandKit[]> {
  try {
    const response = await apiRequest<{ brandKits: BrandKit[] }>('/api/ai-content-studio/brand-kits')
    return response.brandKits
  } catch (error) {
    if (!(error instanceof ApiError) || ![404, 501].includes(error.status)) throw error
    return []
  }
}

export async function getGenerationHistory(): Promise<GenerationHistoryItem[]> {
  try {
    const response = await apiRequest<{ history: GenerationHistoryItem[] }>('/api/ai-content-studio/history?limit=50')
    return response.history
  } catch (error) {
    if (!(error instanceof ApiError) || ![404, 501].includes(error.status)) throw error
    return readLocal<GenerationHistoryItem[]>(HISTORY_KEY, [])
  }
}

export function rememberGeneration(item: GenerationHistoryItem) {
  const history = readLocal<GenerationHistoryItem[]>(HISTORY_KEY, [])
  writeLocal(HISTORY_KEY, [item, ...history.filter((entry) => entry.id !== item.id)].slice(0, 50))
}
