import { apiRequest, getStoredAuthToken } from './api-client'
import type { DashboardJob } from '../types/dashboard'
import type { CaptionEnhancement, CaptionTone, CreateDirectPostInput, DirectPostResponse, EnhancementAction, PostsWorkspaceData } from '../types/posts'
import { fetchDashboardJobs, fetchStudioOverview } from './dashboard-api'

export async function fetchPostsWorkspace(): Promise<PostsWorkspaceData> {
  const [overview, jobs] = await Promise.all([fetchStudioOverview(), fetchDashboardJobs()])
  return { overview, pages: overview.pages, jobs }
}

export function createDirectPosts(input: CreateDirectPostInput) {
  return apiRequest<DirectPostResponse>('/api/studio/direct-posts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function enhancePostCaption(caption: string, action: EnhancementAction, tone: CaptionTone) {
  return apiRequest<CaptionEnhancement>('/api/studio/post-enhancements', {
    method: 'POST',
    body: JSON.stringify({ caption, action, tone }),
  })
}

export function uploadDirectPostMedia(jobId: string, file: File, onProgress: (percent: number) => void): Promise<{ job: DashboardJob }> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', `/api/studio/direct-posts/${encodeURIComponent(jobId)}/media`)
    request.withCredentials = true
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    const token = getStoredAuthToken()
    if (token) request.setRequestHeader('Authorization', `Bearer ${token}`)
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    })
    request.addEventListener('load', () => {
      let payload: unknown
      try { payload = JSON.parse(request.responseText || '{}') } catch { payload = null }
      if (request.status >= 200 && request.status < 300) return resolve(payload as { job: DashboardJob })
      const message = payload && typeof payload === 'object' && 'error' in payload ? String(payload.error) : `Upload failed (HTTP ${request.status}).`
      reject(new Error(message))
    })
    request.addEventListener('error', () => reject(new Error('The media upload connection was interrupted.')))
    request.send(file)
  })
}
