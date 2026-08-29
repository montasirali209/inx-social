import { apiRequest, getStoredAuthToken } from './api-client'
import type {
  BulkSchedulerData,
  ConnectedPagesResponse,
  CreateDraftInput,
  CreateDraftResponse,
  ScheduledPostsResponse,
  StudioJobsResponse,
  StudioPlatformsResponse,
  UploadVideoResponse,
} from '../types/bulk-scheduler'

export async function fetchBulkSchedulerData(): Promise<BulkSchedulerData> {
  const [pageResult, platformResult, jobResult] = await Promise.all([
    apiRequest<ConnectedPagesResponse>('/api/pages'),
    apiRequest<StudioPlatformsResponse>('/api/social-platforms'),
    apiRequest<StudioJobsResponse>('/api/studio/jobs?limit=250'),
  ])
  return { pages: pageResult.pages, platforms: platformResult.platforms, jobs: jobResult.jobs }
}

export function createBulkDraft(input: CreateDraftInput) {
  return apiRequest<CreateDraftResponse>('/api/studio/jobs', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function fetchFacebookScheduledPosts(connectedPageId: string) {
  return apiRequest<ScheduledPostsResponse>(`/api/studio/facebook/scheduled-posts?connectedPageId=${encodeURIComponent(connectedPageId)}`)
}

type UploadOptions = {
  signal: AbortSignal
  onProgress: (loaded: number, total: number) => void
}

export function uploadBulkVideo(url: string, file: File, options: UploadOptions): Promise<UploadVideoResponse> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    const abort = () => request.abort()
    request.open('PUT', url)
    request.withCredentials = true
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
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
        resolve(payload as UploadVideoResponse)
        return
      }
      const message = payload && typeof payload === 'object' && 'error' in payload
        ? String(payload.error)
        : `Upload failed (HTTP ${request.status}).`
      reject(new Error(message))
    })
    request.addEventListener('error', () => {
      options.signal.removeEventListener('abort', abort)
      reject(new Error('The video upload connection was interrupted.'))
    })
    request.addEventListener('abort', () => {
      options.signal.removeEventListener('abort', abort)
      reject(new DOMException('Upload stopped by user.', 'AbortError'))
    })
    options.signal.addEventListener('abort', abort, { once: true })
    request.send(file)
  })
}
