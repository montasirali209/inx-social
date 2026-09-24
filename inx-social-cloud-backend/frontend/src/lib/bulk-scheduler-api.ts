import { apiRequest, getStoredAuthToken } from './api-client'
import { fetchConnectionsWorkspace, flattenConnectedIdentities } from './connections-api'
import type {
  BulkSchedulerData,
  Destination,
  StudioJobsResponse,
  StudioPlatformsResponse,
  UploadMediaResponse,
} from '../types/bulk-scheduler'
import type { CreateDirectPostInput, DirectPostResponse } from '../types/posts'
import type { SettingsValues } from '../types/settings'
import { normaliseSettings } from '../data/settingsData'

function universalDestinations(workspace: Awaited<ReturnType<typeof fetchConnectionsWorkspace>>): Destination[] {
  return flattenConnectedIdentities(workspace)
    .filter((identity) => identity.status === 'connected')
    .map((identity) => ({
      id: identity.id,
      name: identity.displayName,
      handle: identity.username ? `@${identity.username.replace(/^@/, '')}` : null,
      platform: identity.platform as Destination['platform'],
      type: identity.detail,
      avatarUrl: identity.avatarUrl,
      connected: true,
      disabledReason: null,
    }))
}

export async function fetchBulkSchedulerData(): Promise<BulkSchedulerData> {
  const [connections, platformResult, jobResult, preferenceResult] = await Promise.all([
    fetchConnectionsWorkspace(),
    apiRequest<StudioPlatformsResponse>('/api/social-platforms'),
    apiRequest<StudioJobsResponse>('/api/social-connections/publications?limit=1000'),
    apiRequest<{ settings: Partial<SettingsValues> }>('/api/studio/preferences'),
  ])
  const settings = normaliseSettings(preferenceResult.settings)
  return {
    destinations: universalDestinations(connections),
    platforms: platformResult.platforms,
    jobs: (jobResult.jobs || []).filter((job) => job.source === 'BULK_SCHEDULER'),
    settings: { approvalRequired: settings.approvalRequired, defaultScheduleTimes: settings.defaultScheduleTimes, timezone: settings.timezone },
  }
}

export async function saveBulkScheduleTimes(times: string[]) {
  const values = [...new Set(times.filter((time) => /^\d{2}:\d{2}$/.test(time)))].sort()
  if (!values.length) throw new Error('Add at least one publishing time before saving.')
  if (values.length > 12) throw new Error('You can save up to 12 reusable posting times.')

  const response = await apiRequest<{ settings: Partial<SettingsValues> }>('/api/studio/preferences', {
    method: 'PUT',
    body: JSON.stringify({ settings: { defaultScheduleTimes: values } }),
  })
  return normaliseSettings(response.settings).defaultScheduleTimes
}

export type SmartTimingResponse = { times: string[]; source: 'ai' | 'fallback'; reason: string; historyPosts: number; maxShiftMinutes: number }

export function optimiseBulkScheduleTimes(input: { profileIds: string[]; baselineTimes: string[]; timezone: string }) {
  return apiRequest<SmartTimingResponse>('/api/social-connections/publications/smart-timing', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function createBulkMediaPost(input: CreateDirectPostInput & { smartTiming?: { enabled: boolean; baseScheduledAt: string | null; source: string | null } | null }) {
  return apiRequest<DirectPostResponse>('/api/social-connections/publications', {
    method: 'POST',
    body: JSON.stringify({
      profileIds: input.connectedPageIds,
      clientRequestId: input.clientRequestId,
      title: input.title,
      caption: input.caption,
      contentType: input.contentType,
      originalFileName: input.originalFileName,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      mediaLibraryAssetId: input.mediaLibraryAssetId,
      scheduledAt: input.scheduledAt,
      publishMode: input.publishMode,
      smartTiming: input.smartTiming || null,
      source: 'BULK_SCHEDULER',
    }),
  })
}

export function publishBulkLibraryMedia(jobId: string) {
  return apiRequest<UploadMediaResponse & { reusableMedia: true }>(`/api/social-connections/publications/${encodeURIComponent(jobId)}/library-media`, { method: 'POST' })
}

type UploadOptions = {
  signal: AbortSignal
  onProgress: (loaded: number, total: number) => void
}

function uploadContentType(file: File) {
  if (file.type) return file.type
  if (/\.png$/i.test(file.name)) return 'image/png'
  if (/\.jpe?g$/i.test(file.name)) return 'image/jpeg'
  if (/\.webp$/i.test(file.name)) return 'image/webp'
  return 'application/octet-stream'
}

export function uploadBulkMedia(jobId: string, file: File, options: UploadOptions): Promise<UploadMediaResponse> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    const abort = () => request.abort()
    request.open('PUT', `/api/social-connections/publications/${encodeURIComponent(jobId)}/media`)
    request.withCredentials = true
    request.setRequestHeader('Content-Type', uploadContentType(file))
    request.setRequestHeader('X-File-Name', file.name)
    const token = getStoredAuthToken()
    if (token) request.setRequestHeader('Authorization', `Bearer ${token}`)

    request.upload.addEventListener('progress', (event) => {
      options.onProgress(event.loaded, event.lengthComputable ? event.total : file.size)
    })
    request.addEventListener('load', () => {
      options.signal.removeEventListener('abort', abort)
      let payload: unknown
      try { payload = JSON.parse(request.responseText || '{}') } catch { payload = null }
      if (request.status >= 200 && request.status < 300) {
        resolve(payload as UploadMediaResponse)
        return
      }
      const message = payload && typeof payload === 'object' && 'error' in payload
        ? String(payload.error)
        : `Upload failed (HTTP ${request.status}).`
      reject(new Error(message))
    })
    request.addEventListener('error', () => {
      options.signal.removeEventListener('abort', abort)
      reject(new Error('The media upload connection was interrupted.'))
    })
    request.addEventListener('abort', () => {
      options.signal.removeEventListener('abort', abort)
      reject(new DOMException('Upload stopped by user.', 'AbortError'))
    })
    options.signal.addEventListener('abort', abort, { once: true })
    request.send(file)
  })
}

export function rescheduleBulkJob(jobId: string, scheduledAt: string) {
  return apiRequest<{ ok: boolean; scheduledAt: string }>(`/api/social-connections/publications/${encodeURIComponent(jobId)}/schedule`, {
    method: 'PUT',
    body: JSON.stringify({ scheduledAt }),
  })
}

export function updateBulkScheduledPost(jobId: string, input: { title?: string | null; caption?: string; scheduledAt?: string }) {
  return apiRequest<{ ok: boolean; scheduledAt: string; caption: string; title: string | null }>(`/api/social-connections/publications/${encodeURIComponent(jobId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function replaceBulkScheduledMedia(jobId: string, file: File, onProgress: (percent: number) => void) {
  return new Promise<{ ok: boolean; mediaReplaced: boolean }>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', `/api/social-connections/publications/${encodeURIComponent(jobId)}/scheduled-media`)
    request.withCredentials = true
    request.setRequestHeader('Content-Type', uploadContentType(file))
    request.setRequestHeader('X-File-Name', file.name)
    const token = getStoredAuthToken()
    if (token) request.setRequestHeader('Authorization', `Bearer ${token}`)
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    })
    request.addEventListener('load', () => {
      let payload: unknown
      try { payload = JSON.parse(request.responseText || '{}') } catch { payload = null }
      if (request.status >= 200 && request.status < 300) return resolve(payload as { ok: boolean; mediaReplaced: boolean })
      reject(new Error(payload && typeof payload === 'object' && 'error' in payload ? String(payload.error) : `Media replacement failed (HTTP ${request.status}).`))
    })
    request.addEventListener('error', () => reject(new Error('The replacement media upload was interrupted.')))
    request.send(file)
  })
}

export function deleteBulkJob(jobId: string) {
  return apiRequest<{ ok: boolean; publicationId: string; affected: number }>(`/api/social-connections/publications/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
  })
}
