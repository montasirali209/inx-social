import { apiRequest, getStoredAuthToken } from './api-client'
import type {
  BulkSchedulerData,
  ConnectedPagesResponse,
  ScheduledPostsResponse,
  StudioJobsResponse,
  StudioPlatformsResponse,
  UploadMediaResponse,
} from '../types/bulk-scheduler'
import type { CreateDirectPostInput, DirectPostResponse } from '../types/posts'

export async function fetchBulkSchedulerData(): Promise<BulkSchedulerData> {
  const [pageResult, platformResult, jobResult] = await Promise.all([
    apiRequest<ConnectedPagesResponse>('/api/pages'),
    apiRequest<StudioPlatformsResponse>('/api/social-platforms'),
    apiRequest<StudioJobsResponse>('/api/studio/jobs?limit=250'),
  ])
  return { pages: pageResult.pages, platforms: platformResult.platforms, jobs: jobResult.jobs }
}

export function createBulkMediaPost(input: CreateDirectPostInput) {
  return apiRequest<DirectPostResponse>('/api/studio/direct-posts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function publishBulkLibraryMedia(jobId: string) {
  return apiRequest<UploadMediaResponse & { reusableMedia: true }>(`/api/studio/direct-posts/${encodeURIComponent(jobId)}/library-media`, { method: 'POST' })
}

export function fetchFacebookScheduledPosts(connectedPageId: string) {
  return apiRequest<ScheduledPostsResponse>(`/api/studio/facebook/scheduled-posts?connectedPageId=${encodeURIComponent(connectedPageId)}`)
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
    request.open('PUT', `/api/studio/direct-posts/${encodeURIComponent(jobId)}/media`)
    request.withCredentials = true
    request.setRequestHeader('Content-Type', uploadContentType(file))
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
