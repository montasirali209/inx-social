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
    expect(buildPublishingTimes({ mode: 'publish_now', mediaCount: 3, date: '', time: '', jobs: [], destinationIds: [] })).toEqual([null, null, null])
  })

  it('skips occupied half-hour slots for the selected destinations', () => {
    vi.setSystemTime(new Date('2026-08-29T10:00:00.000Z'))
    const job = {
      id: 'job-1',
      status: 'SCHEDULED',
      scheduledAt: '2026-08-29T10:30:00.000Z',
      page: { id: 'page-1' },
    } as DashboardJob
    expect(buildPublishingTimes({ mode: 'next_available_slots', mediaCount: 2, date: '', time: '', jobs: [job], destinationIds: ['page-1'], externalScheduledAt: ['2026-08-29T11:00:00.000Z'] })).toEqual([
      '2026-08-29T11:30:00.000Z',
      '2026-08-29T12:00:00.000Z',
    ])
    vi.useRealTimers()
  })

  it('fills every selected daily time before continuing on the next date', () => {
    vi.setSystemTime(new Date('2026-08-29T08:00:00.000Z'))
    const result = buildPublishingTimes({ mode: 'schedule_time', mediaCount: 5, date: '2026-08-30', time: '', dailyTimes: ['18:30', '09:00', '13:00', '13:00'], jobs: [], destinationIds: ['page-1'] })
    expect(result.map((value) => {
      const date = new Date(value!)
      return [date.getDate(), date.getHours(), date.getMinutes()]
    })).toEqual([[30, 9, 0], [30, 13, 0], [30, 18, 30], [31, 9, 0], [31, 13, 0]])
    vi.useRealTimers()
  })

  it('requires at least one session time for selected-date scheduling', () => {
    expect(() => buildPublishingTimes({ mode: 'schedule_time', mediaCount: 1, date: '2026-08-30', time: '', dailyTimes: [], jobs: [], destinationIds: [] })).toThrow(/add at least one daily publishing time/i)
  })
})
