import { apiRequest, getStoredAuthToken } from './api-client'
import type { DashboardJob } from '../types/dashboard'
import type { CaptionEnhancement, CaptionTone, CreateDirectPostInput, DirectPostResponse, EnhancementAction, PostsWorkspaceData } from '../types/posts'
import { fetchDashboardJobs, fetchStudioOverview } from './dashboard-api'
import { normaliseSettings } from '../data/settingsData'
import type { SettingsValues } from '../types/settings'
import { fetchConnectionsWorkspace } from './connections-api'
import type { Destination } from '../types/posts'

function facebookDestinations(pages: Awaited<ReturnType<typeof fetchStudioOverview>>['pages']): Destination[] {
  return pages.map((page) => ({
    id: page.id,
    platform: 'facebook',
    name: page.facebookPageName,
    handle: page.facebookPageUsername ? `@${page.facebookPageUsername.replace(/^@/, '')}` : null,
    type: page.facebookCategory ? `Facebook Page · ${page.facebookCategory}` : 'Facebook Page',
    avatarUrl: page.facebookPagePicture,
    connected: page.status === 'ACTIVE',
    disabledReason: page.status === 'ACTIVE' ? null : page.lastError || 'Reconnect this Facebook Page.',
  }))
}

function socialDestinations(connections: Awaited<ReturnType<typeof fetchConnectionsWorkspace>>['connections']): Destination[] {
  return connections.flatMap((connection) => connection.profiles
    .filter((profile) => profile.status === 'ACTIVE')
    .map((profile) => {
      const publishable = connection.platform === 'instagram' && Boolean(profile.capabilities?.publish)
      return {
        id: profile.id,
        platform: connection.platform,
        name: profile.displayName || connection.displayName || `${connection.platform} account`,
        handle: profile.username ? `@${profile.username.replace(/^@/, '')}` : null,
        type: connection.platform === 'instagram' ? 'Instagram professional profile' : profile.profileType || 'Social profile',
        avatarUrl: profile.avatarUrl,
        // The current production publisher still accepts Facebook Page jobs only.
        // Keep connected Instagram identities visible while preventing a false
        // successful selection that the API cannot publish yet.
        connected: false,
        disabledReason: publishable
          ? 'Instagram is connected for identity and analytics. Publishing from INXSocial is not available yet.'
          : 'This connection currently supports identity and analytics only.',
      } satisfies Destination
    }))
}

export async function fetchPostsWorkspace(): Promise<PostsWorkspaceData> {
  const [overview, jobs, preferences, connections] = await Promise.all([
    fetchStudioOverview(),
    fetchDashboardJobs(),
    apiRequest<{ settings: Partial<SettingsValues> }>('/api/studio/preferences'),
    fetchConnectionsWorkspace(),
  ])
  const settings = normaliseSettings(preferences.settings)
  return {
    overview,
    pages: overview.pages,
    destinations: [...facebookDestinations(overview.pages), ...socialDestinations(connections.connections)],
    jobs,
    settings: {
      approvalRequired: settings.approvalRequired,
      defaultPublishMode: settings.defaultPublishMode,
      timezone: settings.timezone,
    },
  }
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

export function publishDirectPostLibraryMedia(jobId: string) {
  return apiRequest<{ job: DashboardJob; accepted: boolean; scheduled?: boolean; published?: boolean; reusableMedia: true }>(`/api/studio/direct-posts/${encodeURIComponent(jobId)}/library-media`, { method: 'POST' })
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
