import { apiRequest } from './api-client'
import { fetchStudioOverview } from './dashboard-api'
import type { SocialConnectionSummary } from '../types/settings'

const browserDraftKey = 'inx-social-post-drafts-v1'

export const universalPublishingKpiQueryKey = ['universal-publishing-kpis'] as const

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
    .filter((connection) => connection.status === 'ACTIVE')
    .reduce((total, connection) => {
      const activeProfiles = connection.profiles.filter((profile) => profile.status === 'ACTIVE').length
      return total + Math.max(1, activeProfiles)
    }, 0)
}

export async function fetchUniversalPublishingKpis(): Promise<UniversalPublishingKpis> {
  const [overview, social] = await Promise.all([
    fetchStudioOverview(),
    apiRequest<ConnectionsResponse>('/api/social-connections').catch(() => ({ connections: [] })),
  ])

  const localDrafts = browserDraftCount()
  const summary = overview.summary
  const facebookAccounts = overview.pages.filter((page) => page.status === 'ACTIVE').length

  return {
    allPosts: summary.total + localDrafts,
    drafts: summary.draft + localDrafts,
    scheduled: summary.scheduled,
    published: summary.published,
    // A review item is something the user can still act on. Cancelled history is
    // deliberately excluded so clearing Needs Review actually clears the KPI.
    needsReview: summary.failed + summary.awaitingUpload,
    connectedAccounts: facebookAccounts + activeSocialAccountCount(social.connections || []),
  }
}
