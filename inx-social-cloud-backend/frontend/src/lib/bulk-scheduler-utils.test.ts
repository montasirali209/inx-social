import { describe, expect, it, vi } from 'vitest'
import type { DashboardJob } from '../types/dashboard'
import { buildPublishingTimes, parseCaptions } from './bulk-scheduler-utils'

describe('Bulk Scheduler session utilities', () => {
  it('parses paragraph captions without splitting multiline copy', () => {
    expect(parseCaptions('First line\ncontinues here\n\nSecond caption')).toEqual([
      'First line\ncontinues here',
      'Second caption',
    ])
  })

  it('creates one immediate action time per video without scheduling', () => {
    expect(buildPublishingTimes({ mode: 'publish_now', videoCount: 3, date: '', time: '', jobs: [], destinationIds: [] })).toEqual([null, null, null])
  })

  it('skips occupied half-hour slots for the selected destinations', () => {
    vi.setSystemTime(new Date('2026-08-29T10:00:00.000Z'))
    const job = {
      id: 'job-1',
      status: 'SCHEDULED',
      scheduledAt: '2026-08-29T10:30:00.000Z',
      page: { id: 'page-1' },
    } as DashboardJob
    expect(buildPublishingTimes({ mode: 'next_available_slots', videoCount: 2, date: '', time: '', jobs: [job], destinationIds: ['page-1'], externalScheduledAt: ['2026-08-29T11:00:00.000Z'] })).toEqual([
      '2026-08-29T11:30:00.000Z',
      '2026-08-29T12:00:00.000Z',
    ])
    vi.useRealTimers()
  })
})
