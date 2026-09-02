import type { SettingsCardData, SettingsValues, SettingsWorkspace } from '../types/settings'

export const defaultSettingsValues: SettingsValues = {
  workspaceName: 'INX Social',
  timezone: 'Europe/London',
  language: 'en-GB',
  defaultPublishMode: 'direct',
  approvalRequired: false,
  captionLengthReminder: true,
  postingWindow: '07:00-22:00',
  queueBehavior: 'fill-empty',
  retryFailedPosts: true,
  aiDefaultQuality: 'high',
  brandTone: 'professional',
  mediaAutoSave: true,
  emailAlerts: true,
  publishAlerts: true,
  reviewReminders: false,
}

const timezoneOptions = [
  { label: '(UTC+01:00) Europe/London', value: 'Europe/London' },
  { label: '(UTC+00:00) UTC', value: 'UTC' },
  { label: '(UTC-04:00) America/New York', value: 'America/New_York' },
  { label: '(UTC+06:00) Asia/Dhaka', value: 'Asia/Dhaka' },
]

export function normaliseSettings(input: Partial<SettingsValues> | null | undefined): SettingsValues {
  return { ...defaultSettingsValues, ...(input || {}) }
}

export function settingsEqual(left: SettingsValues, right: SettingsValues) {
  return Object.keys(defaultSettingsValues).every((key) => left[key as keyof SettingsValues] === right[key as keyof SettingsValues])
}

export function connectionSummary(workspace: SettingsWorkspace) {
  const activePages = (workspace.pages || []).filter((page) => page.status === 'ACTIVE')
  const facebookCount = workspace.account.pageUsage?.connected ?? activePages.length
  const activeConnections = workspace.connections.filter((connection) => connection.status === 'ACTIVE')
  const profileCount = activeConnections.reduce((total, connection) => total + Math.max(1, connection.profiles.filter((profile) => profile.status === 'ACTIVE').length), 0)
  const platforms = new Set<string>(activeConnections.map((connection) => connection.platform))
  if (facebookCount) platforms.add('facebook')
  const errors = [
    ...activeConnections.filter((connection) => connection.lastError),
    ...activePages.filter((page) => page.lastError),
  ]
  const latestSync = [...activeConnections
    .map((connection) => connection.lastSyncedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime()), ...activePages
    .map((page) => page.lastSyncAt)
    .filter((value): value is string => Boolean(value))]
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || null
  return {
    destinations: facebookCount + profileCount,
    platforms: platforms.size,
    status: errors.length ? `${errors.length} need attention` : activeConnections.length || facebookCount ? 'All synced' : 'No accounts connected',
    healthy: errors.length === 0,
    latestSync,
  }
}

export function billingUsage(workspace: SettingsWorkspace) {
  const connected = workspace.account.pageUsage?.connected || 0
  const limit = workspace.account.pageUsage?.limit ?? workspace.account.license.limits.pages
  const percent = limit ? Math.min(100, Math.round((connected / limit) * 100)) : 0
  return { connected, limit, percent }
}

export function relativeSyncTime(value: string | null, now = new Date()) {
  if (!value) return 'Not synced yet'
  const elapsedMinutes = Math.max(0, Math.round((now.getTime() - new Date(value).getTime()) / 60_000))
  if (elapsedMinutes < 1) return 'Just now'
  if (elapsedMinutes < 60) return `${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'} ago`
  const hours = Math.round(elapsedMinutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function settingsCards(values: SettingsValues, workspace: SettingsWorkspace): SettingsCardData[] {
  const connections = connectionSummary(workspace)
  const usage = billingUsage(workspace)
  const license = workspace.account.license
  const renewal = license.currentPeriodEnd
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(license.currentPeriodEnd))
    : license.plan === 'LIFETIME' ? 'No renewal required' : 'Managed in billing portal'

  return [
    {
      id: 'workspace', number: 1, title: 'Workspace', description: 'Manage workspace profile and preferences.', icon: 'building', tone: 'teal', actionLabel: 'Manage workspace',
      rows: [
        { id: 'workspaceName', label: 'Workspace Name', type: 'input', value: values.workspaceName },
        { id: 'timezone', label: 'Timezone', type: 'select', value: values.timezone, options: timezoneOptions },
        { id: 'language', label: 'Language', type: 'select', value: values.language, options: [{ label: 'English (UK)', value: 'en-GB' }, { label: 'English (US)', value: 'en-US' }] },
      ],
    },
    {
      id: 'publishing', number: 2, title: 'Publishing', description: 'Control how content is published across platforms.', icon: 'send', tone: 'teal', actionLabel: 'Manage publishing',
      rows: [
        { id: 'defaultPublishMode', label: 'Default Publish Mode', type: 'select', value: values.defaultPublishMode, options: [{ label: 'Direct Publish', value: 'direct' }, { label: 'Schedule for Later', value: 'scheduled' }, { label: 'Save as Draft', value: 'draft' }] },
        { id: 'approvalRequired', label: 'Approval Required', description: 'Require review before publishing', type: 'toggle', value: values.approvalRequired },
        { id: 'captionLengthReminder', label: 'Caption Length Reminder', description: 'Show a reminder for long captions', type: 'toggle', value: values.captionLengthReminder },
      ],
    },
    {
      id: 'scheduler', number: 3, title: 'Scheduler', description: 'Configure scheduling and queue behaviour.', icon: 'calendar', tone: 'green', actionLabel: 'Manage scheduler',
      rows: [
        { id: 'postingWindow', label: 'Posting Window', type: 'select', value: values.postingWindow, options: [{ label: '7:00 AM – 10:00 PM', value: '07:00-22:00' }, { label: '8:00 AM – 8:00 PM', value: '08:00-20:00' }, { label: 'Any time', value: 'always' }] },
        { id: 'queueBehavior', label: 'Queue Behaviour', type: 'select', value: values.queueBehavior, options: [{ label: 'Fill empty time slots', value: 'fill-empty' }, { label: 'Preserve upload order', value: 'preserve-order' }, { label: 'Use next available time', value: 'next-available' }] },
        { id: 'retryFailedPosts', label: 'Retry Failed Posts', description: 'Automatically retry recoverable failures', type: 'toggle', value: values.retryFailedPosts },
      ],
    },
    {
      id: 'ai_content', number: 4, title: 'AI Content Studio', description: 'Customise AI content generation settings.', icon: 'sparkles', tone: 'purple', actionLabel: 'Manage AI settings',
      rows: [
        { id: 'aiDefaultQuality', label: 'Default Quality', type: 'select', value: values.aiDefaultQuality, options: [{ label: 'Fast', value: 'fast' }, { label: 'High', value: 'high' }, { label: 'Premium', value: 'premium' }] },
        { id: 'brandTone', label: 'Brand Tone', type: 'select', value: values.brandTone, options: [{ label: 'Professional', value: 'professional' }, { label: 'Friendly', value: 'friendly' }, { label: 'Energetic', value: 'energetic' }, { label: 'Concise', value: 'concise' }] },
        { id: 'mediaAutoSave', label: 'Media Auto-save', description: 'Save generated media to Media Library', type: 'toggle', value: values.mediaAutoSave },
      ],
    },
    {
      id: 'connected_accounts', number: 5, title: 'Connected Accounts', description: 'Show connected social platforms and sync state.', icon: 'link', tone: 'teal', actionLabel: 'Manage connections',
      rows: [
        { id: 'connectedDestinations', label: 'Connected Destinations', type: 'summary', value: connections.destinations },
        { id: 'connectedPlatforms', label: 'Connected Platforms', type: 'summary', value: connections.platforms },
        { id: 'syncStatus', label: 'Sync Status', type: 'summary', value: connections.status },
        { id: 'lastSync', label: 'Last Sync', type: 'summary', value: relativeSyncTime(connections.latestSync) },
      ],
    },
    {
      id: 'notifications', number: 6, title: 'Notifications', description: 'Manage email alerts and in-app notifications.', icon: 'bell', tone: 'amber', actionLabel: 'Manage notifications',
      rows: [
        { id: 'emailAlerts', label: 'Email Alerts', description: 'Receive important account updates', type: 'toggle', value: values.emailAlerts },
        { id: 'publishAlerts', label: 'Publish Success/Failure Alerts', description: 'Get notified about publishing outcomes', type: 'toggle', value: values.publishAlerts },
        { id: 'reviewReminders', label: 'Review Reminders', description: 'Get reminded about pending reviews', type: 'toggle', value: values.reviewReminders },
      ],
    },
    {
      id: 'billing', number: 7, title: 'Billing & Plans', description: 'View your plan details and usage.', icon: 'crown', tone: 'amber', actionLabel: 'Manage billing',
      rows: [
        { id: 'currentPlan', label: 'Current Plan', type: 'summary', value: `${license.plan.charAt(0)}${license.plan.slice(1).toLowerCase()} Plan` },
        { id: 'renewalDate', label: license.cancelAtPeriodEnd ? 'Access Until' : 'Renewal Date', type: 'summary', value: renewal },
        { id: 'usage', label: 'Usage', description: usage.limit === null ? `${usage.connected} connected · unlimited allowance` : `${usage.connected} of ${usage.limit} Pages`, type: 'progress', value: usage.percent },
      ],
    },
  ]
}
