import { apiRequest } from './api-client'
import type { DashboardJob } from '../types/dashboard'
import type { SocialConnectionSummary } from '../types/settings'

const browserDraftKey = 'inx-social-post-drafts-v1'

export const universalPublishingKpiQueryKey = ['universal-publishing-kpis', 'post-for-me'] as const

export type UniversalPublishingKpis = {
  allPosts: number
  drafts: number
  scheduled: number
  published: number
  needsReview: number
  connectedAccounts: number
}

type ConnectionsResponse = { connections: SocialConnectionSummary[] }
type PublicationsResponse = { jobs: DashboardJob[] }

function browserDraftCount() {
  if (typeof window === 'undefined') return 0
  try {
    const parsed = JSON.parse(window.localStorage.getItem(browserDraftKey) || '[]')
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}

function activeSocialAccountCount(connections: SocialConnectionSummary[]) {
  return connections
    .filter(connection => connection.status === 'ACTIVE')
    .reduce((total, connection) => {
      const activeProfiles = connection.profiles.filter(profile => profile.status === 'ACTIVE').length
      return total + Math.max(1, activeProfiles)
    }, 0)
}

export async function fetchUniversalPublishingKpis(): Promise<UniversalPublishingKpis> {
  const [publications, social] = await Promise.all([
    apiRequest<PublicationsResponse>('/api/social-publications?limit=500'),
    apiRequest<ConnectionsResponse>('/api/social-connections').catch(() => ({ connections: [] })),
  ])

  const jobs = publications.jobs || []
  const localDrafts = browserDraftCount()
  const drafts = jobs.filter(job => job.status === 'DRAFT').length + localDrafts
  const scheduled = jobs.filter(job => job.status === 'SCHEDULED').length
  const published = jobs.filter(job => job.status === 'PUBLISHED').length
  const needsReview = jobs.filter(job => ['FAILED', 'AWAITING_UPLOAD', 'READY'].includes(job.status)).length

  return {
    allPosts: jobs.length + localDrafts,
    drafts,
    scheduled,
    published,
    needsReview,
    connectedAccounts: activeSocialAccountCount(social.connections || []),
  }
}
