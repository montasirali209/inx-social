export type SettingsCategory =
  | 'workspace'
  | 'publishing'
  | 'scheduler'
  | 'ai_content'
  | 'connected_accounts'
  | 'notifications'
  | 'billing'

export type SettingRowType = 'input' | 'select' | 'toggle' | 'summary' | 'progress' | 'times'

export type SettingRow = {
  id: string
  label: string
  description?: string
  type: SettingRowType
  value: string | boolean | number | string[]
  options?: Array<{ label: string; value: string }>
}

export type SettingsCardData = {
  id: SettingsCategory
  number: number
  title: string
  description: string
  icon: string
  tone: 'teal' | 'green' | 'blue' | 'purple' | 'amber' | 'red'
  rows: SettingRow[]
  actionLabel?: string
}

export type SettingsValues = {
  workspaceName: string
  timezone: string
  language: 'en-GB' | 'en-US'
  defaultPublishMode: 'direct' | 'scheduled' | 'draft'
  approvalRequired: boolean
  captionLengthReminder: boolean
  postingWindow: '07:00-22:00' | '08:00-20:00' | 'always'
  queueBehavior: 'fill-empty' | 'preserve-order' | 'next-available'
  defaultScheduleTimes: string[]
  retryFailedPosts: boolean
  aiDefaultQuality: 'fast' | 'high' | 'premium'
  brandTone: 'professional' | 'friendly' | 'energetic' | 'concise'
  mediaAutoSave: boolean
  emailAlerts: boolean
  publishAlerts: boolean
  reviewReminders: boolean
}

export type SettingsLicense = {
  plan: string
  subscriptionStatus: string
  provider: string | null
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  cancelAtPeriodEnd: boolean
  limits: { pages: number | null; batchPosts: number | null; postsPerDay?: number | null; devices: number | null }
}

export type SettingsAccount = {
  user: { id: string; name: string | null; businessName: string | null; email: string }
  license: SettingsLicense
  pageUsage: { connected: number; limit: number | null } | null
  emailDeliveryConfigured: boolean
}

export type SocialProfileSummary = {
  id: string
  displayName: string | null
  username: string | null
  avatarUrl: string | null
  status: string
}

export type SocialConnectionSummary = {
  id: string
  platform: 'instagram' | 'linkedin' | 'youtube' | 'x'
  displayName: string | null
  status: string
  connectedAt: string
  lastSyncedAt: string | null
  lastError: string | null
  profiles: SocialProfileSummary[]
}

export type SettingsWorkspace = {
  settings: SettingsValues
  account: SettingsAccount
  connections: SocialConnectionSummary[]
  pages?: Array<{
    id: string
    status: string
    lastSyncAt: string | null
    lastError: string | null
  }>
}
