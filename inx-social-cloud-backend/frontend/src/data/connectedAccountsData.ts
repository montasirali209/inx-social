export type Platform = 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube' | 'x' | 'pinterest' | 'google_business' | 'threads' | 'bluesky'

export type ConnectionStatus = 'connected' | 'syncing' | 'expiring_soon' | 'disconnected' | 'permission_issue' | 'reconnect_required'

export type ConnectedAccount = {
  id: string
  platform: Platform
  platformLabel: string
  accountName: string
  handle?: string
  accountType: string
  pageCount: number
  profileCount?: number
  status: ConnectionStatus
  lastSyncAt: string | null
  nextSyncAt?: string
  tokenExpiresAt?: string
  schedulerEnabled: boolean
  analyticsEnabled: boolean
  publishingEnabled: boolean
}

export type ConnectedPageProfile = {
  id: string
  accountId: string
  platform: Platform
  name: string
  handle?: string | null
  type: 'page' | 'profile' | 'group' | 'channel' | 'business_location'
  avatarUrl?: string | null
  isPrimary: boolean
  enabledForPosts: boolean
  enabledForScheduler: boolean
  enabledForAnalytics: boolean
  status: ConnectionStatus
}

export type ConnectionActivity = {
  id: string
  platform: Platform
  accountName: string
  message: string
  status: 'success' | 'warning' | 'error' | 'info'
  createdAt: string
}

export type PlatformOption = {
  platform: Platform
  label: string
  description: string
  supportedContentTypes: string[]
  available: boolean
  connectedCount: number
}

export const platformMeta: Record<Platform, { label: string; mark: string; className: string; contentTypes: string[]; description: string; available: boolean }> = {
  facebook: { label: 'Facebook', mark: 'f', className: 'bg-[#1877f2] text-white', contentTypes: ['Post', 'Reel', 'Video', 'Story'], description: 'Publish to Pages and view Page analytics.', available: true },
  instagram: { label: 'Instagram', mark: '◎', className: 'bg-gradient-to-br from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white', contentTypes: ['Post', 'Reel', 'Story'], description: 'Link Instagram professional accounts through Meta.', available: true },
  linkedin: { label: 'LinkedIn', mark: 'in', className: 'bg-[#0a66c2] text-white', contentTypes: ['Post', 'Video'], description: 'Connect your LinkedIn identity with official OAuth.', available: true },
  tiktok: { label: 'TikTok', mark: '♪', className: 'bg-[#111827] text-white', contentTypes: ['Post', 'Video'], description: 'TikTok publishing support is being prepared.', available: false },
  youtube: { label: 'YouTube', mark: '▶', className: 'bg-[#ff0000] text-white', contentTypes: ['Video', 'Shorts'], description: 'Connect channels and inspect YouTube account data.', available: true },
  x: { label: 'X / Twitter', mark: '𝕏', className: 'bg-white text-black', contentTypes: ['Post', 'Video'], description: 'Connect your X identity with official OAuth.', available: true },
  pinterest: { label: 'Pinterest', mark: 'P', className: 'bg-[#e60023] text-white', contentTypes: ['Post', 'Video'], description: 'Pinterest publishing support is being prepared.', available: false },
  google_business: { label: 'Google Business', mark: 'G', className: 'bg-[#4285f4] text-white', contentTypes: ['Post'], description: 'Google Business support is being prepared.', available: false },
  threads: { label: 'Threads', mark: '@', className: 'bg-[#111111] text-white', contentTypes: ['Post'], description: 'Threads support is coming soon.', available: false },
  bluesky: { label: 'Bluesky', mark: '☁', className: 'bg-[#1185fe] text-white', contentTypes: ['Post'], description: 'Bluesky support is coming soon.', available: false },
}

export const supportedPlatforms = (connectedCount: Partial<Record<Platform, number>> = {}): PlatformOption[] =>
  (Object.keys(platformMeta) as Platform[]).map((platform) => ({
    platform,
    label: platformMeta[platform].label,
    description: platformMeta[platform].description,
    supportedContentTypes: platformMeta[platform].contentTypes,
    available: platformMeta[platform].available,
    connectedCount: connectedCount[platform] || 0,
  }))

export const advancedHealthItems = [
  ['Webhook status', 'Not enabled', 'INXSocial uses secure refresh checks for the current connections.'],
  ['API health check', 'Ready', 'Checks whether your saved connections can be read securely.'],
] as const
