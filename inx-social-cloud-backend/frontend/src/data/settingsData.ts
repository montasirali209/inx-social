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
  defaultScheduleTimes: ['10:00'],
  retryFailedPosts: true,
  aiDefaultQuality: 'high',
  brandTone: 'professional',
  mediaAutoSave: true,
  emailAlerts: true,
  publishAlerts: true,
  reviewReminders: false,
}

type IntlWithTimezones = typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] }

function timezoneOffset(timezone: string, reference = new Date()) {
  try {
    const part = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      timeZone: timezone,
      timeZoneName: 'longOffset',
    }).formatToParts(reference).find((item) => item.type === 'timeZoneName')?.value || 'GMT'
    const label = part === 'GMT' ? 'UTC+00:00' : part.replace('GMT', 'UTC')
    const match = label.match(/^UTC([+-])(\d{2}):(\d{2})$/)
    const minutes = match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0
    return { label, minutes }
  } catch {
    return { label: 'UTC+00:00', minutes: 0 }
  }
}

export function buildTimezoneOptions(reference = new Date()) {
  const supported = (Intl as IntlWithTimezones).supportedValuesOf?.('timeZone') || [
    'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Dhaka', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland',
  ]
  return [...new Set(['UTC', ...supported])]
    .map((value) => {
      const offset = timezoneOffset(value, reference)
      return { label: `(${offset.label}) ${value.replaceAll('_', ' ')}`, value, offset: offset.minutes }
    })
    .sort((left, right) => left.offset - right.offset || left.label.localeCompare(right.label))
    .map(({ label, value }) => ({ label, value }))
}

export const timezoneOptions = buildTimezoneOptions()

export function normaliseSettings(input: Partial<SettingsValues> | null | undefined): SettingsValues {
  const merged = { ...defaultSettingsValues, ...(input || {}) }
  const defaultScheduleTimes = [...new Set((Array.isArray(merged.defaultScheduleTimes) ? merged.defaultScheduleTimes : [])
    .filter((time): time is string => typeof time === 'string' && /^\d{2}:\d{2}$/.test(time)))]
    .sort()
  return { ...merged, defaultScheduleTimes: defaultScheduleTimes.length ? defaultScheduleTimes : defaultSettingsValues.defaultScheduleTimes }
}

export function settingsEqual(left: SettingsValues, right: SettingsValues) {
  return Object.keys(defaultSettingsValues).every((key) => {
    const leftValue = left[key as keyof SettingsValues]
    const rightValue = right[key as keyof SettingsValues]
    if (Array.isArray(leftValue) && Array.isArray(rightValue)) return leftValue.join('|') === rightValue.join('|')
    return leftValue === rightValue
  })
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
      id: 'workspace', number: 1, title: 'Account & Region', description: 'Review your sign-in identity and regional preferences.', icon: 'building', tone: 'teal',
      rows: [
        { id: 'accountEmail', label: 'Account Email', description: 'The read-only email that owns these settings', type: 'summary', value: workspace.account.user.email },
        { id: 'timezone', label: 'Timezone', type: 'select', value: values.timezone, options: timezoneOptions },
        { id: 'language', label: 'Language', type: 'select', value: values.language, options: [{ label: 'English (UK)', value: 'en-GB' }, { label: 'English (US)', value: 'en-US' }] },
      ],
    },
    {
      id: 'publishing', number: 2, title: 'Publishing', description: 'Choose the safe defaults used when creating content.', icon: 'send', tone: 'teal',
      rows: [
        { id: 'defaultPublishMode', label: 'Default in Create Post', description: 'The starting choice; it can still be changed for each post', type: 'select', value: values.defaultPublishMode, options: [{ label: 'Publish immediately', value: 'direct' }, { label: 'Schedule for later', value: 'scheduled' }, { label: 'Save as draft', value: 'draft' }] },
        { id: 'approvalRequired', label: 'Confirm Before Publishing', description: 'Ask for final confirmation before INXSocial sends or schedules content', type: 'toggle', value: values.approvalRequired },
      ],
    },
    {
      id: 'scheduler', number: 3, title: 'Scheduler', description: `Save reusable daily posting times in ${values.timezone.replaceAll('_', ' ')}.`, icon: 'calendar', tone: 'green',
      rows: [
        { id: 'defaultScheduleTimes', label: 'Default Posting Times', description: 'Bulk Scheduler fills every saved time before moving to the next day', type: 'times', value: values.defaultScheduleTimes },
      ],
    },
    {
      id: 'ai_content', number: 4, title: 'AI Content Studio', description: 'AI preferences will be configured with the AI Content Studio redesign.', icon: 'sparkles', tone: 'purple',
      rows: [
        { id: 'aiStatus', label: 'Status', description: 'No placeholder AI settings are applied from this card', type: 'summary', value: 'Coming with AI Studio' },
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
      id: 'notifications', number: 6, title: 'Notifications', description: 'Essential account messages without routine publishing noise.', icon: 'bell', tone: 'amber',
      rows: [
        { id: 'importantEmails', label: 'Important Account Emails', description: 'Email verification, password security, billing, subscription and access changes', type: 'summary', value: workspace.account.emailDeliveryConfigured ? 'Active' : 'Setup required' },
        { id: 'publishingEmails', label: 'Routine Publishing Emails', description: 'Post-by-post success messages stay inside INXSocial', type: 'summary', value: 'Not sent' },
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
