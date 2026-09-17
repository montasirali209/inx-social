import { describe, expect, it } from 'vitest'
import { flattenConnectedIdentities } from './connections-api'
import type { ConnectionsWorkspace } from './connections-api'

const provider = { configured: true, method: 'POST_FOR_ME_OAUTH', providerEngine: 'POST_FOR_ME' }

function workspace(): ConnectionsWorkspace {
  return {
    overview: {
      user: { id: 'user-1', name: 'Owner', businessName: 'INX', email: 'owner@example.com' },
      license: { allowed: true, plan: 'PRO', subscriptionStatus: 'ACTIVE', trialEndsAt: null, limits: { pages: 50, batchPosts: null, devices: 3 } },
      pages: [
        { id: 'legacy-page', facebookPageId: 'fb-old', facebookPageName: 'Legacy Page', facebookPageUsername: 'legacy', facebookPagePicture: null, facebookCategory: null, status: 'ACTIVE', isSelected: true, connectedAt: '2026-08-01T08:00:00.000Z', lastCheckedAt: null, lastSyncAt: null, lastError: null },
      ],
      summary: { total: 0, draft: 0, awaitingUpload: 0, ready: 0, queued: 0, processing: 0, scheduled: 0, published: 0, failed: 0, cancelled: 0 },
    },
    connections: [
      {
        id: 'facebook-1', platform: 'facebook', displayName: 'INX Facebook', status: 'ACTIVE', connectedAt: '2026-09-01T09:00:00.000Z', lastSyncedAt: '2026-09-02T09:57:00.000Z', lastError: null,
        profiles: [{ id: 'facebook-profile-1', displayName: 'INX Page', username: 'inxpage', avatarUrl: null, status: 'ACTIVE', capabilities: { publish: true, analytics: true } }],
      },
      {
        id: 'youtube-1', platform: 'youtube', displayName: 'Google account', status: 'ACTIVE', connectedAt: '2026-09-01T10:00:00.000Z', lastSyncedAt: '2026-09-02T09:58:00.000Z', lastError: null,
        profiles: [
          { id: 'channel-1', displayName: 'Channel One', username: '@one', avatarUrl: null, status: 'ACTIVE', capabilities: { publish: true, analytics: true } },
          { id: 'channel-2', displayName: 'Channel Two', username: '@two', avatarUrl: null, status: 'ACTIVE', capabilities: { publish: true, analytics: true } },
          { id: 'channel-revoked', displayName: 'Old Channel', username: null, avatarUrl: null, status: 'REVOKED' },
        ],
      },
      { id: 'linkedin-1', platform: 'linkedin', displayName: 'INX member', status: 'ACTIVE', connectedAt: '2026-09-01T11:00:00.000Z', lastSyncedAt: null, lastError: 'Token needs refresh', profiles: [] },
    ],
    providers: {
      facebook: provider,
      instagram: provider,
      linkedin: provider,
      tiktok: provider,
      youtube: provider,
      pinterest: provider,
      threads: provider,
      bluesky: { configured: true, method: 'POST_FOR_ME_APP_PASSWORD', providerEngine: 'POST_FOR_ME' },
      x: provider,
    },
  }
}

describe('Post for Me connected account identity mapping', () => {
  it('keeps every active provider profile and ignores legacy ConnectedPage rows', () => {
    const identities = flattenConnectedIdentities(workspace())
    expect(identities.map((identity) => `${identity.platform}:${identity.displayName}`)).toEqual([
      'facebook:INX Page',
      'youtube:Channel One',
      'youtube:Channel Two',
      'linkedin:INX member',
    ])
    expect(identities.filter((identity) => identity.platform === 'youtube')).toHaveLength(2)
    expect(identities.some((identity) => identity.displayName === 'Legacy Page')).toBe(false)
    expect(identities.some((identity) => identity.displayName === 'Old Channel')).toBe(false)
  })

  it('marks provider connection errors for attention', () => {
    const identities = flattenConnectedIdentities(workspace())
    expect(identities.find((identity) => identity.platform === 'linkedin')?.status).toBe('attention')
    expect(identities.filter((identity) => identity.platform === 'facebook')).toHaveLength(1)
  })
})
