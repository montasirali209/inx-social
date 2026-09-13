import { apiRequest, getStoredAuthToken } from './api-client'
import type { DashboardJob } from '../types/dashboard'
import type { CaptionEnhancement, CaptionTone, CreateDirectPostInput, DirectPostResponse, EnhancementAction, PostsWorkspaceData } from '../types/posts'
import { fetchDashboardJobs, fetchStudioOverview } from './dashboard-api'
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

function facebookDestinations(pages: Awaited<ReturnType<typeof fetchStudioOverview>>['pages']): Destination[] {
  return pages.map((page) => ({
    id: page.id,
    platform: 'facebook',
    name: page.facebookPageName,
    handle: page.facebookPageUsername ? `@${page.facebookPageUsername.replace(/^@/, '')}` : null,
    type: page.facebookCategory ? `Facebook Page · ${page.facebookCategory}` : 'Facebook Page',
    avatarUrl: `/api/studio/pages/${encodeURIComponent(page.id)}/picture`,
    connected: page.status === 'ACTIVE',
    disabledReason: page.status === 'ACTIVE' ? null : page.lastError || 'Reconnect this Facebook Page.',
  }))
}

function socialDestinations(connections: Awaited<ReturnType<typeof fetchConnectionsWorkspace>>['connections']): Destination[] {
  return connections.flatMap((connection) => connection.profiles
    .filter((profile) => profile.status === 'ACTIVE')
    .map((profile) => {
      const instagramPublishable = connection.platform === 'instagram' && Boolean(profile.capabilities?.publish)
      const linkedinPublishable = connection.platform === 'linkedin' && Boolean(profile.capabilities?.publish)
      const publishable = linkedinPublishable
      let disabledReason: string | null = null
      if (!publishable) {
        if (connection.platform === 'linkedin') disabledReason = 'Reconnect LinkedIn to grant publishing permission.'
        else if (instagramPublishable) disabledReason = 'Instagram is connected, but publishing from this composer is not available yet.'
        else disabledReason = 'This connection currently supports identity and analytics only.'
      }
      return {
        id: profile.id,
        platform: connection.platform,
        name: profile.displayName || connection.displayName || `${connection.platform} account`,
        handle: profile.username ? `@${profile.username.replace(/^@/, '')}` : null,
        type: connection.platform === 'instagram'
          ? 'Instagram professional profile'
          : connection.platform === 'linkedin'
            ? 'LinkedIn personal profile'
            : profile.profileType || 'Social profile',
        avatarUrl: profile.avatarUrl,
        connected: publishable,
        disabledReason,
      } satisfies Destination
    }))
}

function normaliseLinkedInJob(job: DashboardJob): DashboardJob {
  const rawStatus = String(job.status)
  const status = rawStatus === 'AWAITING_MEDIA'
    ? 'AWAITING_UPLOAD'
    : rawStatus === 'READY'
      ? 'READY'
      : rawStatus === 'PROCESSING'
        ? 'PROCESSING'
        : rawStatus === 'SCHEDULED'
          ? 'SCHEDULED'
          : rawStatus === 'PUBLISHED'
            ? 'PUBLISHED'
            : rawStatus === 'FAILED'
              ? 'FAILED'
              : 'DRAFT'
  return { ...job, status }
}

async function fetchLinkedInPublications() {
  try {
    const response = await apiRequest<{ jobs: DashboardJob[] }>('/api/social-connections/linkedin/publications?limit=100')
    return (response.jobs || []).map(normaliseLinkedInJob)
  } catch {
    return [] as DashboardJob[]
  }
}

export async function fetchPostsWorkspace(): Promise<PostsWorkspaceData> {
  const [overview, jobs, preferences, connections, linkedInJobs] = await Promise.all([
    fetchStudioOverview(),
    fetchDashboardJobs(),
    apiRequest<{ settings: Partial<SettingsValues> }>('/api/studio/preferences'),
    fetchConnectionsWorkspace(),
    fetchLinkedInPublications(),
  ])
  const settings = normaliseSettings(preferences.settings)
  return {
    overview,
    pages: overview.pages,
    destinations: [...facebookDestinations(overview.pages), ...socialDestinations(connections.connections)],
    jobs: [...jobs, ...linkedInJobs],
    settings: {
      approvalRequired: settings.approvalRequired,
      defaultPublishMode: settings.defaultPublishMode,
      timezone: settings.timezone,
    },
  }
}

export async function createDirectPosts(input: CreateDirectPostInput): Promise<DirectPostResponse> {
  const workspace = await fetchConnectionsWorkspace()
  const linkedinProfileIds = new Set(
    workspace.connections
      .filter((connection) => connection.platform === 'linkedin')
      .flatMap((connection) => connection.profiles)
      .filter((profile) => profile.status === 'ACTIVE' && Boolean(profile.capabilities?.publish))
      .map((profile) => profile.id),
  )
  const selectedLinkedIn = input.connectedPageIds.filter((id) => linkedinProfileIds.has(id))
  const selectedFacebook = input.connectedPageIds.filter((id) => !linkedinProfileIds.has(id))
  const responses: DirectPostResponse[] = []

  if (selectedFacebook.length) {
    responses.push(await apiRequest<DirectPostResponse>('/api/studio/direct-posts', {
      method: 'POST',
      body: JSON.stringify({ ...input, connectedPageIds: selectedFacebook }),
    }))
  }

  if (selectedLinkedIn.length) {
    responses.push(await apiRequest<DirectPostResponse>('/api/social-connections/linkedin/posts', {
      method: 'POST',
      body: JSON.stringify({
        profileIds: selectedLinkedIn,
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
    }))
  }

  if (!responses.length) throw new Error('Choose at least one publishing destination that is ready to publish.')
  return {
    jobs: responses.flatMap((response) => response.jobs || []).map((job) => job.id.startsWith('linkedin:') ? normaliseLinkedInJob(job) : job),
    failures: responses.flatMap((response) => response.failures || []),
    uploadRequired: responses.some((response) => response.uploadRequired),
  }
}

export async function createCarouselPosts(input: CreateCarouselPostInput) {
  const response = await apiRequest<DirectPostResponse>('/api/studio/carousel-posts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (response.failures.length) {
    const details = response.failures
      .map((failure) => `${failure.pageName || 'Facebook Page'}: ${failure.error || 'Carousel publishing failed.'}`)
      .join(' · ')
    throw new Error(details)
  }
  return response
}

export function dismissPostJob(jobId: string) {
  return apiRequest<{ ok: boolean; job: DashboardJob }>(`/api/studio/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' })
}

export function enhancePostCaption(caption: string, action: EnhancementAction, tone: CaptionTone) {
  return apiRequest<CaptionEnhancement>('/api/studio/post-enhancements', {
    method: 'POST',
    body: JSON.stringify({ caption, action, tone }),
  })
}

export function publishDirectPostLibraryMedia(jobId: string) {
  if (jobId.startsWith('linkedin:')) {
    const publicationId = jobId.slice('linkedin:'.length)
    return apiRequest<{ job: DashboardJob; accepted?: boolean; scheduled?: boolean; published?: boolean; reusableMedia: true }>(`/api/social-connections/linkedin/publications/${encodeURIComponent(publicationId)}/library-media`, { method: 'POST' })
  }
  return apiRequest<{ job: DashboardJob; accepted: boolean; scheduled?: boolean; published?: boolean; reusableMedia: true }>(`/api/studio/direct-posts/${encodeURIComponent(jobId)}/library-media`, { method: 'POST' })
}

export function uploadDirectPostMedia(jobId: string, file: File, onProgress: (percent: number) => void): Promise<{ job: DashboardJob }> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    const isLinkedIn = jobId.startsWith('linkedin:')
    const publicationId = isLinkedIn ? jobId.slice('linkedin:'.length) : jobId
    const url = isLinkedIn
      ? `/api/social-connections/linkedin/publications/${encodeURIComponent(publicationId)}/media`
      : `/api/studio/direct-posts/${encodeURIComponent(jobId)}/media`
    request.open('PUT', url)
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
