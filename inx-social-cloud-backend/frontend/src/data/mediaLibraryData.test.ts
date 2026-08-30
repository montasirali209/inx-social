import { describe, expect, it } from 'vitest'
import { matchesTab, platformReadiness } from './mediaLibraryData'
import type { MediaAsset } from '../types/media-library'

const asset: MediaAsset = {
  id: 'asset-1', fileName: 'Campaign reel.mp4', type: 'video', source: 'ai_generated', collection: 'ai_generated', status: 'unused',
  thumbnailUrl: '/content', fileUrl: '/content', width: 1080, height: 1920, duration: 91, fileSize: 1024,
  createdAt: '2026-08-30T12:00:00.000Z', folder: null, tags: ['campaign'], prompt: 'A campaign reel', qualityScore: 92,
  usedIn: [], contentAvailable: true,
}

describe('media library filters and readiness', () => {
  it('filters assets by real type, source and state', () => {
    expect(matchesTab(asset, 'all')).toBe(true)
    expect(matchesTab(asset, 'videos')).toBe(true)
    expect(matchesTab(asset, 'ai_generated')).toBe(true)
    expect(matchesTab(asset, 'published')).toBe(false)
  })

  it('reports known duration constraints without inventing metadata', () => {
    const readiness = platformReadiness(asset)
    expect(readiness.find(item => item.platform === 'instagram')?.status).toBe('too_long')
    expect(readiness.find(item => item.platform === 'facebook')?.status).toBe('ready')
  })
})
