import { describe, expect, it } from 'vitest'
import { availableSlotsForDate, buildCalendarDays, calendarFetchRange, calendarRangeLabel, shiftMonth } from './calendar-utils'
import type { CalendarPost } from '../types/calendar'

const post: CalendarPost = { id: 'one', title: 'Scheduled content', time: '09:00', date: '2026-08-12', occurredAt: '2026-08-12T08:00:00.000Z', platform: 'facebook', pageId: 'page', pageName: 'INX Social', status: 'scheduled', thumbnailUrl: null, engagementScore: null, source: 'inx' }

describe('calendar utilities', () => {
  it('builds a complete six-week month without placeholder posts', () => {
    const days = buildCalendarDays('2026-08', [post], '2026-08-12', '2026-08-29')
    expect(days).toHaveLength(42)
    expect(days.find((day) => day.date === '2026-08-12')?.posts).toHaveLength(1)
    expect(days.find((day) => day.date === '2026-08-12')?.isSelected).toBe(true)
  })

  it('moves months and detects occupied session slots', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(calendarRangeLabel('2026-02')).toBe('Feb 1 – Feb 28, 2026')
    expect(availableSlotsForDate([post], '2026-08-12').find((slot) => slot.time === '09:00')?.available).toBe(false)
    expect(availableSlotsForDate([post], '2026-08-12').find((slot) => slot.time === '11:00')?.available).toBe(true)
  })

  it('builds a padded backend range for the month being viewed', () => {
    expect(calendarFetchRange('2026-09')).toEqual({
      from: '2026-08-24T00:00:00.000Z',
      to: '2026-10-16T00:00:00.000Z',
    })
  })
})
