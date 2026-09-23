import { apiRequest, getStoredAuthToken } from './api-client'
import type {
  CreateUGCCampaignInput,
  UGCAd,
  UGCAvatar,
  UGCBrandProfile,
  UGCCampaign,
  UGCEditorUpdate,
  UGCEstimate,
  UGCOverview,
} from '../types/ugc-studio'

export function getUGCOverview() {
  return apiRequest<UGCOverview>('/api/ai-content-studio/ugc/overview')
}

export function estimateUGCCampaign(input: CreateUGCCampaignInput) {
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

export function generateUGCAvatar(input: { prompt: string; name: string; category?: string; locale?: string; voice?: string }) {
  return apiRequest<{ avatar: UGCAvatar }>('/api/ai-content-studio/ugc/avatars/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((result) => result.avatar)
}

export function deleteUGCAvatar(id: string) {
  return apiRequest<{ ok: boolean }>(`/api/ai-content-studio/ugc/avatars/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function uploadUGCAvatar(file: File): Promise<UGCAvatar> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', '/api/ai-content-studio/ugc/avatars/upload')
    request.withCredentials = true
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    request.setRequestHeader('X-File-Name', encodeURIComponent(file.name))
    const token = getStoredAuthToken()
    if (token) request.setRequestHeader('Authorization', `Bearer ${token}`)
    request.onload = () => {
      let payload: { avatar?: UGCAvatar; error?: string } = {}
      try { payload = JSON.parse(request.responseText || '{}') } catch { /* handled below */ }
      if (request.status >= 200 && request.status < 300 && payload.avatar) resolve(payload.avatar)
      else reject(new Error(payload.error || `Avatar upload failed (HTTP ${request.status}).`))
    }
    request.onerror = () => reject(new Error('The avatar upload connection was interrupted.'))
    request.send(file)
  })
}

export async function fetchUGCAvatarImage(avatar: UGCAvatar) {
  if (!avatar.imageUrl) return null
  const headers = new Headers()
  const token = getStoredAuthToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(avatar.imageUrl, { credentials: 'same-origin', headers })
  if (!response.ok) return null
  return URL.createObjectURL(await response.blob())
}
