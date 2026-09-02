import { describe, expect, it, vi } from 'vitest'
import { buildPublishingTimes, parseCaptions, zonedDateTimeToIso } from './bulk-scheduler-utils'

describe('Bulk Scheduler session utilities', () => {
  it('parses paragraph captions without splitting multiline copy', () => {
    expect(parseCaptions('First line\ncontinues here\n\nSecond caption')).toEqual([
      'First line\ncontinues here',
      'Second caption',
    ])
  })

  it('creates one immediate action time per video without scheduling', () => {
    expect(buildPublishingTimes({ mode: 'publish_now', mediaCount: 3, date: '' })).toEqual([null, null, null])
  })

  it('fills every custom daily time before continuing on the next date', () => {
    vi.setSystemTime(new Date('2026-09-02T08:00:00.000Z'))
    const result = buildPublishingTimes({ mode: 'schedule_time', mediaCount: 5, date: '2026-09-10', dailyTimes: ['18:30', '09:00', '13:00', '13:00'], timezone: 'UTC' })
    expect(result).toEqual([
      '2026-09-10T09:00:00.000Z',
      '2026-09-10T13:00:00.000Z',
      '2026-09-10T18:30:00.000Z',
      '2026-09-11T09:00:00.000Z',
      '2026-09-11T13:00:00.000Z',
    ])
    vi.useRealTimers()
  })

  it('uses saved posting times in the account timezone', () => {
    vi.setSystemTime(new Date('2026-09-02T08:00:00.000Z'))
    expect(buildPublishingTimes({ mode: 'saved_schedule', mediaCount: 3, date: '2026-09-10', dailyTimes: ['10:00', '16:00'], timezone: 'Europe/London' })).toEqual([
      '2026-09-10T09:00:00.000Z',
      '2026-09-10T15:00:00.000Z',
      '2026-09-11T09:00:00.000Z',
    ])
    vi.useRealTimers()
  })

  it('rejects local times that do not exist during a daylight-saving change', () => {
    expect(() => zonedDateTimeToIso('2026-03-29', '01:30', 'Europe/London')).toThrow(/daylight-saving change/i)
  })

  it('requires at least one session time for selected-date scheduling', () => {
    expect(() => buildPublishingTimes({ mode: 'schedule_time', mediaCount: 1, date: '2026-09-10', dailyTimes: [] })).toThrow(/add at least one publishing time/i)
  })
})
