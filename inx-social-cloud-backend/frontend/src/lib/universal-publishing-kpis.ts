import { apiRequest } from './api-client'
import { fetchPublishingRecords, isNeedsReviewJob } from './publishing-records'
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
  const [jobs, social] = await Promise.all([
    fetchPublishingRecords(),
    apiRequest<ConnectionsResponse>('/api/social-connections').catch(() => ({ connections: [] })),
  ])

  const localDrafts = browserDraftCount()
  const drafts = jobs.filter(job => job.status === 'DRAFT').length + localDrafts
  const scheduled = jobs.filter(job => job.status === 'SCHEDULED').length
  const published = jobs.filter(job => job.status === 'PUBLISHED').length
  const needsReview = jobs.filter(isNeedsReviewJob).length

  return {
    allPosts: jobs.length + localDrafts,
    drafts,
    scheduled,
    published,
    needsReview,
    connectedAccounts: activeSocialAccountCount(social.connections || []),
  }
}
