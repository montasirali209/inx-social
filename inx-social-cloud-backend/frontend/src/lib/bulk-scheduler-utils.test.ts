import { describe, expect, it, vi } from 'vitest'
import { buildPublishingTimes, parseCaptions, parseTextPosts, zonedDateTimeToIso } from './bulk-scheduler-utils'

describe('Bulk Scheduler session utilities', () => {
  it('parses paragraph captions without splitting multiline copy', () => {
    expect(parseCaptions('First line\ncontinues here\n\nSecond caption')).toEqual([
      'First line\ncontinues here',
      'Second caption',
    ])
  })

  it('parses complete multiline text posts only at explicit separator lines', () => {
    expect(parseTextPosts('First paragraph\n\nSecond paragraph\n#tag\n\n---\n\nAnother post\nwith two lines\n\n---\nFinal post')).toEqual([
      'First paragraph\n\nSecond paragraph\n#tag',
      'Another post\nwith two lines',
      'Final post',
    ])
  })

  it('treats blank lines inside a text post as content rather than separators', () => {
    expect(parseTextPosts('Line one\n\nLine two\n\n#hashtag')).toEqual(['Line one\n\nLine two\n\n#hashtag'])
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

  it('builds long-range schedules beyond 25 days for Post for Me', () => {
    vi.setSystemTime(new Date('2026-09-19T20:12:00.000Z'))
    const result = buildPublishingTimes({ mode: 'schedule_time', mediaCount: 130, date: '2026-09-20', dailyTimes: ['10:00', '11:00', '21:00', '23:00'], timezone: 'Europe/London' })
    expect(result).toHaveLength(130)
    expect(new Date(result.at(-1)!).getTime()).toBeGreaterThan(new Date('2026-10-15T20:12:00.000Z').getTime())
    vi.useRealTimers()
  })

  it('requires at least one session time for selected-date scheduling', () => {
    expect(() => buildPublishingTimes({ mode: 'schedule_time', mediaCount: 1, date: '2026-09-10', dailyTimes: [] })).toThrow(/add at least one publishing time/i)
  })
})
