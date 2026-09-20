export type Platform = 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube' | 'x' | 'pinterest' | 'google_business' | 'threads' | 'bluesky'

export const customerFacingPlatforms = ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'threads', 'bluesky', 'x'] as const satisfies readonly Platform[]
export type CustomerFacingPlatform = (typeof customerFacingPlatforms)[number]
export const isCustomerFacingPlatform = (platform: Platform): platform is CustomerFacingPlatform =>
  customerFacingPlatforms.includes(platform as CustomerFacingPlatform)

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

export type ConnectionHelpTopic = {
  id: string
  question: string
  answer: string
}

export const platformMeta: Record<Platform, { label: string; contentTypes: string[]; description: string; available: boolean }> = {
  facebook: { label: 'Facebook', contentTypes: ['Post', 'Image', 'Video', 'Reel', 'Story'], description: 'Connect Facebook destinations for publishing, scheduling and analytics.', available: true },
  instagram: { label: 'Instagram', contentTypes: ['Post', 'Carousel', 'Reel', 'Story'], description: 'Publish and schedule Instagram content from the same INXSocial workspace.', available: true },
  linkedin: { label: 'LinkedIn', contentTypes: ['Post', 'Image', 'Video'], description: 'Connect LinkedIn profiles and supported organisation destinations.', available: true },
  tiktok: { label: 'TikTok', contentTypes: ['Image', 'Video'], description: 'Connect TikTok accounts for direct or scheduled publishing.', available: true },
  youtube: { label: 'YouTube', contentTypes: ['Video', 'Shorts'], description: 'Connect YouTube channels for uploads, scheduling and performance data.', available: true },
  x: { label: 'X / Twitter', contentTypes: ['Post', 'Image', 'Video'], description: 'Publish and schedule posts to X from INXSocial.', available: true },
  pinterest: { label: 'Pinterest', contentTypes: ['Pin', 'Image', 'Video'], description: 'Connect Pinterest accounts and publish to selected boards.', available: true },
  threads: { label: 'Threads', contentTypes: ['Post', 'Image', 'Video'], description: 'Publish and schedule Threads content alongside your other networks.', available: true },
  bluesky: { label: 'Bluesky', contentTypes: ['Post', 'Image'], description: 'Connect Bluesky using your handle and an app password.', available: true },
  google_business: { label: 'Google Business', contentTypes: ['Post'], description: 'Not currently supplied by the INXSocial publishing gateway.', available: false },
}

export const supportedPlatforms = (connectedCount: Partial<Record<Platform, number>> = {}): PlatformOption[] =>
  customerFacingPlatforms.map((platform) => ({
    platform,
    label: platformMeta[platform].label,
    description: platformMeta[platform].description,
    supportedContentTypes: platformMeta[platform].contentTypes,
    available: platformMeta[platform].available,
    connectedCount: connectedCount[platform] || 0,
  }))

export const advancedHealthItems = [
  ['Webhook status', 'Enabled when configured', 'Secure publishing webhooks update account and publishing state in real time.'],
  ['API health check', 'Ready', 'Checks whether your saved connections can be read securely from the INXSocial backend.'],
] as const

export const connectionHelpTopics: ConnectionHelpTopic[] = [
  {
    id: 'connect-account',
    question: 'How do I connect a social account?',
    answer: 'Choose Connect Account, select the network, and complete its secure authorisation flow. INXSocial requests publishing and feed permissions so scheduling and analytics can work from the same connection.',
  },
  {
    id: 'bluesky',
    question: 'How do I connect Bluesky?',
    answer: 'Bluesky uses an app password rather than the normal OAuth popup. Create an app password in Bluesky, then enter your handle and that app password in INXSocial. Your main Bluesky password is not required.',
  },
  {
    id: 'multiple-accounts',
    question: 'Can I connect more than one account on the same platform?',
    answer: 'Yes. You can add multiple destinations from the same network and choose one or many of them for each post or scheduled task.',
  },
  {
    id: 'permissions',
    question: 'Why does INXSocial request publishing and feed permissions?',
    answer: 'Publishing permissions are required to send or schedule content. Feed permissions let INXSocial show supported account activity and analytics. Your social password is never stored by INXSocial.',
  },
  {
    id: 'reconnect',
    question: 'How do I fix an expired connection or permission issue?',
    answer: 'Open the affected account, choose Reconnect, and complete the authorisation flow again. Existing INXSocial post history stays in your workspace.',
  },
  {
    id: 'disconnect',
    question: 'What happens when I disconnect an account?',
    answer: 'Future publishing and analytics sync stop for that destination. Existing INXSocial post records remain available, and content already published on the social network is not removed automatically.',
  },
]
