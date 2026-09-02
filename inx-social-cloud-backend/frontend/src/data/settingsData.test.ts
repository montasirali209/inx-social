import { describe, expect, it } from 'vitest'
import { billingUsage, buildTimezoneOptions, connectionSummary, defaultSettingsValues, normaliseSettings, relativeSyncTime, settingsCards, settingsEqual } from './settingsData'
import type { SettingsWorkspace } from '../types/settings'

function workspace(): SettingsWorkspace {
  return {
    settings: defaultSettingsValues,
    account: {
      user: { id: 'user-1', name: 'Owner', businessName: 'INX', email: 'owner@example.com' },
      license: {
        plan: 'PRO', subscriptionStatus: 'ACTIVE', provider: 'stripe', currentPeriodEnd: '2026-10-18T00:00:00.000Z', trialEndsAt: null, cancelAtPeriodEnd: false,
        limits: { pages: 50, batchPosts: null, postsPerDay: null, devices: 3 },
      },
      pageUsage: { connected: 9, limit: 50 },
      emailDeliveryConfigured: true,
    },
    pages: [{ id: 'page-1', status: 'ACTIVE', lastSyncAt: '2026-09-02T09:57:00.000Z', lastError: null }],
    connections: [{
      id: 'youtube-1', platform: 'youtube', displayName: 'Google account', status: 'ACTIVE', connectedAt: '2026-09-01T10:00:00.000Z', lastSyncedAt: '2026-09-02T09:58:00.000Z', lastError: null,
      profiles: [
        { id: 'channel-1', displayName: 'Channel 1', username: '@one', avatarUrl: null, status: 'ACTIVE' },
        { id: 'channel-2', displayName: 'Channel 2', username: '@two', avatarUrl: null, status: 'ACTIVE' },
      ],
    }],
  }
}

describe('settings data', () => {
  it('normalises persisted values and detects unsaved changes', () => {
    const saved = normaliseSettings({ timezone: 'UTC', emailAlerts: false, defaultScheduleTimes: ['18:30', '09:00', '18:30'] })
    expect(saved.timezone).toBe('UTC')
    expect(saved.emailAlerts).toBe(false)
    expect(saved.workspaceName).toBe('INX Social')
    expect(saved.defaultScheduleTimes).toEqual(['09:00', '18:30'])
    expect(settingsEqual(saved, { ...saved })).toBe(true)
    expect(settingsEqual(saved, { ...saved, defaultScheduleTimes: ['09:00'] })).toBe(false)
    expect(settingsEqual(saved, { ...saved, mediaAutoSave: false })).toBe(false)
  })

  it('uses live connection and licence values instead of screenshot samples', () => {
    const data = workspace()
    expect(connectionSummary(data)).toMatchObject({ destinations: 11, platforms: 2, status: 'All synced' })
    expect(billingUsage(data)).toEqual({ connected: 9, limit: 50, percent: 18 })
    const cards = settingsCards(data.settings, data)
    expect(cards).toHaveLength(7)
    expect(cards.find((card) => card.id === 'billing')?.rows.map((row) => row.value)).toContain('Pro Plan')
    expect(JSON.stringify(cards)).not.toContain('May 18, 2025')
    expect(cards.find((card) => card.id === 'workspace')?.actionLabel).toBeUndefined()
    expect(cards.find((card) => card.id === 'publishing')?.rows.map((row) => row.label)).toContain('Confirm Before Publishing')
    expect(cards.find((card) => card.id === 'notifications')?.rows.map((row) => row.value)).toContain('Active')
  })

  it('offers the complete timezone catalogue supported by the runtime', () => {
    const options = buildTimezoneOptions(new Date('2026-09-02T12:00:00.000Z'))
    expect(options.length).toBeGreaterThan(300)
    expect(options.some((option) => option.value === 'Europe/London')).toBe(true)
    expect(options.some((option) => option.value === 'Asia/Dhaka')).toBe(true)
    expect(options.some((option) => option.value === 'America/New_York')).toBe(true)
  })

  it('formats live sync timestamps clearly', () => {
    expect(relativeSyncTime('2026-09-02T09:58:00.000Z', new Date('2026-09-02T10:00:00.000Z'))).toBe('2 minutes ago')
    expect(relativeSyncTime(null)).toBe('Not synced yet')
  })
})
