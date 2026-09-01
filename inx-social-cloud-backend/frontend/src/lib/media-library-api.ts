import { apiRequest, getStoredAuthToken } from './api-client'
import type { MediaAsset, MediaFolder, MediaLibraryWorkspace } from '../types/media-library'

export function fetchMediaLibrary() {
  return apiRequest<MediaLibraryWorkspace>('/api/studio/media-library')
}

export function createMediaFolder(name: string) {
  return apiRequest<{ folder: MediaFolder }>('/api/studio/media-library/folders', { method: 'POST', body: JSON.stringify({ name }) })
}

export function renameMediaAsset(id: string, fileName: string) {
  return apiRequest<{ asset: MediaAsset }>(`/api/studio/media-library/assets/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ fileName }) })
}

export function duplicateMediaAsset(id: string) {
  return apiRequest<{ asset: MediaAsset }>(`/api/studio/media-library/assets/${encodeURIComponent(id)}/duplicate`, { method: 'POST' })
}

export function archiveMediaAsset(id: string) {
  return apiRequest<{ ok: boolean }>(`/api/studio/media-library/assets/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function restoreMediaAsset(id: string) {
  return apiRequest<{ ok: boolean }>(`/api/studio/media-library/assets/${encodeURIComponent(id)}/restore`, { method: 'POST' })
}

export function purgeMediaAsset(id: string) {
  return apiRequest<{ ok: boolean }>(`/api/studio/media-library/assets/${encodeURIComponent(id)}/permanent`, { method: 'DELETE' })
}

function authHeaders() {
  const headers = new Headers()
  const token = getStoredAuthToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

export function uploadMediaAsset(file: File, folderId: string | null, onProgress: (percent: number) => void, signal?: AbortSignal): Promise<MediaAsset> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    const abort = () => request.abort()
    request.open('POST', '/api/studio/media-library/assets')
    request.withCredentials = true
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    request.setRequestHeader('X-File-Name', encodeURIComponent(file.name))
    if (folderId) request.setRequestHeader('X-Folder-Id', folderId)
    const token = getStoredAuthToken()
    if (token) request.setRequestHeader('Authorization', `Bearer ${token}`)
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)) }
    request.onload = () => {
      signal?.removeEventListener('abort', abort)
      let payload: { asset?: MediaAsset; error?: string } = {}
      try { payload = JSON.parse(request.responseText || '{}') } catch { /* use HTTP fallback */ }
      if (request.status >= 200 && request.status < 300 && payload.asset) resolve(payload.asset)
      else reject(new Error(payload.error || `Upload failed (HTTP ${request.status}).`))
    }
    request.onerror = () => {
      signal?.removeEventListener('abort', abort)
      reject(new Error('The media upload connection was interrupted.'))
    }
    request.onabort = () => {
      signal?.removeEventListener('abort', abort)
      reject(new DOMException('Upload stopped by user.', 'AbortError'))
    }
    signal?.addEventListener('abort', abort, { once: true })
    request.send(file)
  })
}

export async function fetchMediaAssetFile(asset: MediaAsset) {
  const response = await fetch(asset.fileUrl, { credentials: 'include', headers: authHeaders() })
  if (!response.ok) throw new Error(`The selected asset could not be loaded (HTTP ${response.status}).`)
  const blob = await response.blob()
  return new File([blob], asset.fileName, { type: blob.type || (asset.type === 'video' ? 'video/mp4' : 'image/png') })
}

export async function downloadMediaAsset(asset: MediaAsset) {
  const downloadUrl = new URL(asset.fileUrl, window.location.origin)
  downloadUrl.searchParams.set('download', '1')
  const response = await fetch(downloadUrl, { credentials: 'include', headers: authHeaders() })
  if (!response.ok) throw new Error('The download could not be prepared.')
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = asset.fileName
  link.click()
  URL.revokeObjectURL(url)
}
