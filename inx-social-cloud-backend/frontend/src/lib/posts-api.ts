import { apiRequest, getStoredAuthToken } from './api-client'
import type { DashboardJob } from '../types/dashboard'
import type { CaptionEnhancement, CaptionTone, CreateDirectPostInput, DirectPostResponse, EnhancementAction, PostsWorkspaceData } from '../types/posts'
import { fetchStudioOverview } from './dashboard-api'
import { normaliseSettings } from '../data/settingsData'
import type { SettingsValues } from '../types/settings'
import { fetchConnectionsWorkspace } from './connections-api'
import type { Destination } from '../types/posts'

export type CreateCarouselPostInput = {
  connectedPageIds: string[]
  clientRequestId: string
  title: string | null
  caption: string
  mediaLibraryAssetIds: string[]
  slideLinks?: string[]
  scheduledAt: string | null
  publishMode: 'NOW' | 'SCHEDULED'
}

function socialDestinations(connections: Awaited<ReturnType<typeof fetchConnectionsWorkspace>>['connections']): Destination[] {
  return connections.flatMap((connection) => connection.profiles
    .filter((profile) => profile.status === 'ACTIVE')
    .map((profile) => {
      const publishable = Boolean(profile.capabilities?.publish)
      return {
        id: profile.id,
        platform: connection.platform,
        name: profile.displayName || connection.displayName || `${connection.platform} account`,
        handle: profile.username ? `@${profile.username.replace(/^@/, '')}` : null,
        type: profile.profileType || `${connection.platform} profile`,
        avatarUrl: profile.avatarUrl,
        connected: publishable,
        disabledReason: publishable ? null : 'Reconnect this account to enable publishing.',
      } satisfies Destination
    }))
}

async function fetchPostForMePublications() {
  try {
    const response = await apiRequest<{ jobs: DashboardJob[] }>('/api/social-connections/publications?limit=150')
    return response.jobs || []
  } catch {
    return [] as DashboardJob[]
  }
}

export async function fetchPostsWorkspace(): Promise<PostsWorkspaceData> {
  const [overview, preferences, connections, publications] = await Promise.all([
    fetchStudioOverview(),
    apiRequest<{ settings: Partial<SettingsValues> }>('/api/studio/preferences'),
    fetchConnectionsWorkspace(),
    fetchPostForMePublications(),
  ])
  const settings = normaliseSettings(preferences.settings)
  return {
    overview,
    // ConnectedPage was the old Meta-only destination model. Keep the field for
    // component compatibility, but Post for Me profiles are now the sole destinations.
    pages: [],
    destinations: socialDestinations(connections.connections),
    jobs: publications,
    settings: {
      approvalRequired: settings.approvalRequired,
      defaultPublishMode: settings.defaultPublishMode,
      timezone: settings.timezone,
    },
  }
}

export async function createDirectPosts(input: CreateDirectPostInput): Promise<DirectPostResponse> {
  if (!input.connectedPageIds.length) throw new Error('Choose at least one publishing destination that is ready to publish.')
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
    }),
  })
}

export async function createCarouselPosts(input: CreateCarouselPostInput) {
  const response = await apiRequest<DirectPostResponse>('/api/social-connections/publications/carousel', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      profileIds: input.connectedPageIds,
      contentType: 'IMAGE',
    }),
  })
  if (response.failures.length) {
    const details = response.failures
      .map((failure) => `${failure.pageName || 'Destination'}: ${failure.error || 'Carousel publishing failed.'}`)
      .join(' · ')
    throw new Error(details)
  }
  return response
}

export function dismissPostJob(jobId: string) {
  // Deleting provider-backed posts is handled by the publication endpoint. The
  // DELETE route is introduced alongside calendar migration; until then the UI can
  // continue hiding/dismissing historical cards without invoking native Meta jobs.
  return apiRequest<{ ok: boolean; job?: DashboardJob }>(`/api/social-connections/publications/${encodeURIComponent(jobId)}`, { method: 'DELETE' })
}

export function enhancePostCaption(caption: string, action: EnhancementAction, tone: CaptionTone) {
  return apiRequest<CaptionEnhancement>('/api/studio/post-enhancements', {
    method: 'POST',
    body: JSON.stringify({ caption, action, tone }),
  })
}

export function publishDirectPostLibraryMedia(jobId: string) {
  return apiRequest<{ job: DashboardJob; accepted?: boolean; scheduled?: boolean; published?: boolean; reusableMedia: true }>(
    `/api/social-connections/publications/${encodeURIComponent(jobId)}/library-media`,
    { method: 'POST' },
  )
}

export function uploadDirectPostMedia(jobId: string, file: File, onProgress: (percent: number) => void): Promise<{ job: DashboardJob }> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', `/api/social-connections/publications/${encodeURIComponent(jobId)}/media`)
    request.withCredentials = true
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    request.setRequestHeader('X-File-Name', file.name)
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
    request.addEventListener('error', () => reject(new Error('The media upload connection was interrupted.'))
    request.send(file)
  })
}
