import { describe, expect, it } from 'vitest'
import type { DashboardJob } from '../types/dashboard'
import { matchesPostLibraryView, requiresMediaReattachment } from './posts-reuse'

function job(status: DashboardJob['status'], contentType: DashboardJob['contentType'] = 'TEXT'): DashboardJob {
  return {
    id: 'job-1', status, uploadStatus: null, publishMode: 'SCHEDULED', contentType,
    title: 'Reusable post', caption: 'Caption', localFileName: contentType === 'TEXT' ? null : 'media.jpg',
    scheduledAt: null, completedAt: null, errorMessage: null, mediaLibraryAssetId: null, createdAt: '2026-08-31T10:00:00.000Z',
    updatedAt: '2026-08-31T10:00:00.000Z', page: null, asset: null,
  }
}

describe('post reuse library', () => {
  it('filters scheduled, published and review records honestly', () => {
    expect(matchesPostLibraryView(job('SCHEDULED'), 'scheduled')).toBe(true)
    expect(matchesPostLibraryView(job('PUBLISHED'), 'published')).toBe(true)
    expect(matchesPostLibraryView(job('FAILED'), 'needs_review')).toBe(true)
    expect(matchesPostLibraryView(job('PUBLISHED'), 'needs_review')).toBe(false)
  })

  it('requires reattachment for temporary image and video uploads', () => {
    expect(requiresMediaReattachment(job('PUBLISHED', 'IMAGE'))).toBe(true)
    expect(requiresMediaReattachment(job('PUBLISHED', 'VIDEO'))).toBe(true)
    expect(requiresMediaReattachment(job('PUBLISHED', 'TEXT'))).toBe(false)
  })
})
