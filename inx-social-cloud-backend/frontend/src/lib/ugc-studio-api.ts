import { apiRequest, getStoredAuthToken } from './api-client'
import type {
  CreateUGCCampaignInput,
  UGCAd,
  UGCAvatar,
  UGCAvatarReference,
  UGCBrandProfile,
  UGCCampaign,
  UGCEditorUpdate,
  UGCEstimate,
  UGCOverview,
  UGCProductAsset,
  UGCSampleVideo,
} from '../types/ugc-studio'

export function getUGCOverview() {
  return apiRequest<UGCOverview>('/api/ai-content-studio/ugc/overview')
}

export function estimateUGCCampaign(input: Pick<CreateUGCCampaignInput, 'duration' | 'adCount' | 'quality' | 'campaignType' | 'creativeFormat'>) {
  return apiRequest<UGCEstimate>('/api/ai-content-studio/ugc/estimate', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function analyzeUGCBrand(url: string, refresh = false) {
  return apiRequest<{ brand: UGCBrandProfile }>('/api/ai-content-studio/ugc/brands/analyze', {
    method: 'POST',
    body: JSON.stringify({ url, refresh }),
  }).then((result) => result.brand)
}

export function createUGCCampaign(input: CreateUGCCampaignInput) {
  return apiRequest<{ campaign: UGCCampaign }>('/api/ai-content-studio/ugc/campaigns', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((result) => result.campaign)
}

export function getUGCCampaign(id: string) {
  return apiRequest<{ campaign: UGCCampaign }>(`/api/ai-content-studio/ugc/campaigns/${encodeURIComponent(id)}`).then((result) => result.campaign)
}

export function getUGCCampaigns(limit = 12) {
  return apiRequest<{ campaigns: UGCCampaign[] }>(`/api/ai-content-studio/ugc/campaigns?limit=${limit}`).then((result) => result.campaigns)
}

export function deleteUGCCampaign(id: string) {
  return apiRequest<{ ok: boolean }>(`/api/ai-content-studio/ugc/campaigns/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function getUGCAd(id: string) {
  return apiRequest<{ ad: UGCAd }>(`/api/ai-content-studio/ugc/ads/${encodeURIComponent(id)}`).then((result) => result.ad)
}

export function updateUGCAd(id: string, update: UGCEditorUpdate) {
  return apiRequest<{ ad: UGCAd }>(`/api/ai-content-studio/ugc/ads/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(update),
  }).then((result) => result.ad)
}

export function regenerateUGCAd(id: string) {
  return apiRequest<{ ad: UGCAd }>(`/api/ai-content-studio/ugc/ads/${encodeURIComponent(id)}/regenerate`, { method: 'POST' }).then((result) => result.ad)
}

export function regenerateUGCScene(id: string) {
  return apiRequest<{ ad: UGCAd }>(`/api/ai-content-studio/ugc/scenes/${encodeURIComponent(id)}/regenerate`, { method: 'POST' }).then((result) => result.ad)
}

export function generateUGCAvatar(input: { prompt: string; name: string; category?: string; presentation?: string; ageBand?: string; locale?: string; accent?: string; niches?: string[]; voice?: string }) {
  return apiRequest<{ avatar: UGCAvatar }>('/api/ai-content-studio/ugc/avatars/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((result) => result.avatar)
}

export function deleteUGCAvatar(id: string) {
  return apiRequest<{ ok: boolean }>(`/api/ai-content-studio/ugc/avatars/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function getUGCAvatarReferences(id: string) {
  return apiRequest<{ master: { id: string; role: string; label: string; qualityStatus: string; qualityScore: number; imageUrl: string | null }; alternates: UGCAvatarReference[] }>(
    `/api/ai-content-studio/ugc/avatars/${encodeURIComponent(id)}/references`,
  )
}

export function deleteUGCAvatarReference(avatarId: string, referenceId: string) {
  return apiRequest<{ ok: boolean }>(
    `/api/ai-content-studio/ugc/avatars/${encodeURIComponent(avatarId)}/references/${encodeURIComponent(referenceId)}`,
    { method: 'DELETE' },
  )
}

function uploadBinary<T>(
  url: string,
  file: File,
  headers: Record<string, string>,
  parse: (payload: Record<string, unknown>) => T | undefined,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', url)
    request.withCredentials = true
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    request.setRequestHeader('X-File-Name', encodeURIComponent(file.name))
    Object.entries(headers).forEach(([key, value]) => { if (value) request.setRequestHeader(key, value) })
    const token = getStoredAuthToken()
    if (token) request.setRequestHeader('Authorization', `Bearer ${token}`)
    request.onload = () => {
      let payload: Record<string, unknown> = {}
      try { payload = JSON.parse(request.responseText || '{}') as Record<string, unknown> } catch { /* handled below */ }
      const value = parse(payload)
      if (request.status >= 200 && request.status < 300 && value) resolve(value)
      else reject(new Error(typeof payload.error === 'string' ? payload.error : `Upload failed (HTTP ${request.status}).`))
    }
    request.onerror = () => reject(new Error('The upload connection was interrupted.'))
    request.send(file)
  })
}

export function uploadUGCAvatar(
  file: File,
  metadata?: { category?: string; presentation?: string; ageBand?: string; locale?: string; accent?: string },
): Promise<UGCAvatar> {
  const headers: Record<string, string> = {}
  if (metadata?.category) headers['X-Creator-Category'] = encodeURIComponent(metadata.category)
  if (metadata?.presentation) headers['X-Creator-Presentation'] = encodeURIComponent(metadata.presentation)
  if (metadata?.ageBand) headers['X-Creator-Age-Band'] = encodeURIComponent(metadata.ageBand)
  if (metadata?.locale) headers['X-Creator-Locale'] = encodeURIComponent(metadata.locale)
  if (metadata?.accent) headers['X-Creator-Accent'] = encodeURIComponent(metadata.accent)
  return uploadBinary('/api/ai-content-studio/ugc/avatars/upload', file, headers, (payload) => payload.avatar as UGCAvatar | undefined)
}

export function uploadUGCAvatarReference(avatarId: string, file: File, label?: string): Promise<UGCAvatarReference> {
  return uploadBinary(
    `/api/ai-content-studio/ugc/avatars/${encodeURIComponent(avatarId)}/references/upload`,
    file,
    label ? { 'X-Reference-Label': encodeURIComponent(label) } : {},
    (payload) => payload.reference as UGCAvatarReference | undefined,
  )
}

export function uploadUGCProductAsset(file: File, brandProfileId?: string | null): Promise<UGCProductAsset> {
  return uploadBinary(
    '/api/ai-content-studio/ugc/product-assets/upload',
    file,
    brandProfileId ? { 'X-Brand-Profile-Id': brandProfileId } : {},
    (payload) => payload.asset as UGCProductAsset | undefined,
  )
}

export function uploadUGCSampleVideo(
  file: File,
  input: { title: string; description?: string; campaignType: 'AVATAR_EXPLAINER' | 'PRODUCT_SHOWCASE'; quality: 'STANDARD' | 'PREMIUM'; duration: 15 | 20 | 30; sortOrder?: number },
): Promise<UGCSampleVideo> {
  return uploadBinary(
    '/api/ai-content-studio/ugc/samples/upload',
    file,
    {
      'X-Sample-Title': encodeURIComponent(input.title),
      'X-Sample-Description': encodeURIComponent(input.description || ''),
      'X-Campaign-Type': input.campaignType,
      'X-Quality': input.quality,
      'X-Duration': String(input.duration),
      'X-Sort-Order': String(input.sortOrder || 0),
    },
    (payload) => payload.sample as UGCSampleVideo | undefined,
  )
}

async function fetchProtectedBlob(url: string) {
  const headers = new Headers()
  const token = getStoredAuthToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(url, { credentials: 'same-origin', headers })
  if (!response.ok) return null
  return URL.createObjectURL(await response.blob())
}

export function fetchUGCAvatarImage(avatar: UGCAvatar) {
  return avatar.imageUrl ? fetchProtectedBlob(avatar.imageUrl) : Promise.resolve(null)
}

export function fetchUGCAvatarReferenceImage(reference: UGCAvatarReference) {
  return reference.imageUrl ? fetchProtectedBlob(reference.imageUrl) : Promise.resolve(null)
}

export function fetchUGCProductImage(asset: UGCProductAsset) {
  return fetchProtectedBlob(asset.imageUrl)
}

export function fetchUGCSampleVideo(sample: UGCSampleVideo) {
  return fetchProtectedBlob(sample.videoUrl)
}


export function trackUGCStudioEvent(input: {
  event: string
  stage?: string | null
  campaignId?: string | null
  adId?: string | null
  metadata?: Record<string, string | number | boolean | null>
}) {
  return apiRequest<{ ok: boolean }>('/api/ai-content-studio/ugc/events', {
    method: 'POST',
    body: JSON.stringify(input),
  }).catch(() => ({ ok: false }))
}
