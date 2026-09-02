import { apiRequest } from './api-client'
import { normaliseSettings } from '../data/settingsData'
import type { SettingsAccount, SettingsValues, SettingsWorkspace, SocialConnectionSummary } from '../types/settings'

type PreferencesResponse = {
  settings: Partial<SettingsValues>
  account: SettingsAccount
  pages?: SettingsWorkspace['pages']
}

type ConnectionsResponse = { connections: SocialConnectionSummary[] }

export async function fetchSettingsWorkspace(): Promise<SettingsWorkspace> {
  const [preferences, connections] = await Promise.all([
    apiRequest<PreferencesResponse>('/api/studio/preferences'),
    apiRequest<ConnectionsResponse>('/api/social-connections'),
  ])
  return {
    settings: normaliseSettings(preferences.settings),
    account: preferences.account,
    connections: connections.connections || [],
    pages: preferences.pages || [],
  }
}

export async function saveSettings(values: SettingsValues) {
  const response = await apiRequest<{ settings: Partial<SettingsValues> }>('/api/studio/preferences', {
    method: 'PUT',
    body: JSON.stringify({ settings: values }),
  })
  return normaliseSettings(response.settings)
}

export async function openBillingPortal() {
  const response = await apiRequest<{ url: string }>('/api/billing/portal', { method: 'POST', body: '{}' })
  window.location.assign(response.url)
}
