import { fetchDashboardJobs } from './dashboard-api'
import {
  connectPostForMePlatform,
  disconnectSocialConnection,
  fetchConnectionsWorkspace,
  flattenConnectedIdentities,
  syncPostForMeConnections,
  type ConnectedIdentity,
  type ConnectionsWorkspace,
  type PostForMeConnectionInput,
} from './connections-api'
import type { SocialPlatform } from '../types/settings'

export async function getConnectedAccounts() {
  const workspace = await fetchConnectionsWorkspace()
  return { workspace, accounts: flattenConnectedIdentities(workspace) }
}

export async function getConnectionStats() {
  const { workspace, accounts } = await getConnectedAccounts()
  const healthy = accounts.filter((account) => account.status === 'connected').length
  const activePlatforms = new Set(accounts.filter((account) => account.status === 'connected').map((account) => account.platform)).size
  return {
    totalConnectedAccounts: accounts.length,
    activePlatforms,
    connectionHealth: accounts.length ? Math.round((healthy / accounts.length) * 100) : 0,
    overview: workspace.overview,
  }
}

export async function searchConnectedAccounts(query: string) {
  const { accounts } = await getConnectedAccounts()
  const term = query.trim().toLowerCase()
  if (!term) return accounts
  return accounts.filter((account) => `${account.platform} ${account.displayName} ${account.username || ''} ${account.detail}`.toLowerCase().includes(term))
}

export async function refreshConnection(_connectionId?: string | null) {
  // Post for Me currently exposes one secure workspace sync endpoint. The optional
  // connection id keeps the UI contract ready for a future per-connection sync API.
  return syncPostForMeConnections()
}

export function reconnectAccount(platform: SocialPlatform, input: PostForMeConnectionInput = {}) {
  return connectPostForMePlatform(platform, input)
}

export function disconnectAccount(connectionId: string) {
  return disconnectSocialConnection(connectionId)
}

export async function getConnectionActivity() {
  const { accounts } = await getConnectedAccounts()
  return accounts
    .map((account) => ({
      id: `${account.platform}:${account.id}`,
      platform: account.platform,
      accountName: account.displayName,
      message: account.status === 'connected' ? 'Connection sync completed' : 'Connection needs attention',
      createdAt: account.lastSyncedAt || account.connectedAt,
      status: account.status === 'connected' ? 'success' as const : 'warning' as const,
    }))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

export async function getSupportedPlatforms() {
  const workspace = await fetchConnectionsWorkspace()
  return workspace.providers
}

export function beginOAuthConnection(platform: SocialPlatform, input: PostForMeConnectionInput = {}) {
  return connectPostForMePlatform(platform, input)
}

export async function getAvailableDestinations(workspace?: ConnectionsWorkspace, platform?: SocialPlatform): Promise<ConnectedIdentity[]> {
  const source = workspace || await fetchConnectionsWorkspace()
  const accounts = flattenConnectedIdentities(source)
  return platform ? accounts.filter((account) => account.platform === platform) : accounts
}

export async function saveConnectedDestinations(destinationIds: string[], available: ConnectedIdentity[]) {
  // The current Post for Me connection contract authorises returned destinations
  // together. Keep this facade so a future selective-destination endpoint can be
  // introduced without changing the Connected Accounts UI contract.
  const availableIds = new Set(available.map((destination) => destination.id))
  return available.filter((destination) => destinationIds.includes(destination.id) && availableIds.has(destination.id))
}

export async function getPostsThisWeek() {
  const jobs = await fetchDashboardJobs()
  const now = Date.now()
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  const inWindow = (value: string | null | undefined, start: number, end: number) => {
    if (!value) return false
    const timestamp = new Date(value).getTime()
    return Number.isFinite(timestamp) && timestamp >= start && timestamp < end
  }
  const occurredAt = (job: (typeof jobs)[number]) => job.completedAt || job.scheduledAt || job.updatedAt || job.createdAt
  const current = jobs.filter((job) => inWindow(occurredAt(job), now - sevenDays, now)).length
  const previous = jobs.filter((job) => inWindow(occurredAt(job), now - (2 * sevenDays), now - sevenDays)).length
  return { current, previous }
}
