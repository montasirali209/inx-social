import { describe, expect, it } from 'vitest'
import { buildDashboardView, videoStatus } from './dashboard-api'
import type { DashboardJob, StudioOverview } from '../types/dashboard'

const overview: StudioOverview = {
  user: { id: 'user-1', name: 'Ali', businessName: 'INX Social', email: 'ali@example.com' },
  license: {
    allowed: true,
    plan: 'PRO',
    subscriptionStatus: 'ACTIVE',
    trialEndsAt: null,
    limits: { pages: 50, batchPosts: null, devices: 3 },
  },
  pages: [],
  summary: {
    total: 6,
    draft: 0,
    awaitingUpload: 0,
    ready: 1,
    queued: 1,
    processing: 1,
    scheduled: 1,
    published: 1,
    failed: 1,
    cancelled: 0,
  },
}

function job(status: DashboardJob['status'], overrides: Partial<DashboardJob> = {}): DashboardJob {
  return {
    id: `${status}-${overrides.scheduledAt || overrides.completedAt || 'item'}`,
    status,
    uploadStatus: null,
    publishMode: 'SCHEDULED',
    contentType: 'VIDEO',
    title: status,
    caption: null,
    localFileName: `${status}.mp4`,
    scheduledAt: null,
    completedAt: null,
    errorMessage: null,
    createdAt: '2026-08-28T09:00:00.000Z',
    updatedAt: '2026-08-28T09:00:00.000Z',
    page: null,
    asset: null,
    ...overrides,
  }
}

describe('dashboard data mapping', () => {
  it('derives honest KPI, queue and upcoming values from backend jobs', () => {
    const now = new Date('2026-08-29T10:00:00.000Z')
    const data = buildDashboardView(overview, [
      job('READY'),
      job('QUEUED'),
      job('PROCESSING'),
      job('SCHEDULED', { scheduledAt: '2026-08-29T16:00:00.000Z' }),
      job('PUBLISHED', { completedAt: '2026-08-28T11:00:00.000Z' }),
      job('FAILED'),
    ], now)

    expect(data.stats.map((item) => item.value)).toEqual([1, 1, 2, 1, 1])
    expect(data.queue).toHaveLength(5)
    expect(data.upcoming).toHaveLength(1)
    expect(data.activeTransfer?.status).toBe('PROCESSING')
  })

  it('maps every backend state to a customer-facing publishing state', () => {
    expect(videoStatus('PROCESSING')).toBe('publishing')
    expect(videoStatus('FAILED')).toBe('failed')
    expect(videoStatus('AWAITING_UPLOAD')).toBe('pending_review')
  })
})
