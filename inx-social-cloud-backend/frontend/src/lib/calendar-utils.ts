import { calendarSlotCandidates } from '../data/calendarData'
import type { AvailableSlot, CalendarDay, CalendarPost } from '../types/calendar'

export function dateKeyInTimezone(value: string | Date, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function timeInTimezone(value: string | Date, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(date)
}

export function monthKeyInTimezone(value: Date, timeZone: string) {
  return dateKeyInTimezone(value, timeZone).slice(0, 7)
}

function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 12))
}

export function shiftMonth(monthKey: string, offset: number) {
  const [year, month] = monthKey.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1, 12))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

export function formatMonth(monthKey: string) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dateFromKey(`${monthKey}-01`))
}

export function formatDateKey(dateKey: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(dateFromKey(dateKey))
}

export function calendarRangeLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  const finalDay = new Date(Date.UTC(year, month, 0, 12)).getUTCDate()
  const monthLabel = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(dateFromKey(`${monthKey}-01`))
  return `${monthLabel} 1 – ${monthLabel} ${finalDay}, ${year}`
}

export function buildCalendarDays(monthKey: string, posts: CalendarPost[], selectedDate: string, todayKey: string): CalendarDay[] {
  const [year, month] = monthKey.split('-').map(Number)
  const first = new Date(Date.UTC(year, month - 1, 1, 12))
  const gridStart = new Date(first)
  gridStart.setUTCDate(1 - first.getUTCDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setUTCDate(gridStart.getUTCDate() + index)
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
    return {
      date: key,
      isCurrentMonth: date.getUTCFullYear() === year && date.getUTCMonth() === month - 1,
      isToday: key === todayKey,
      isSelected: key === selectedDate,
      posts: posts.filter((post) => post.date === key).sort((left, right) => left.time.localeCompare(right.time)),
    }
  })
}

export function availableSlotsForDate(posts: CalendarPost[], date: string): AvailableSlot[] {
  const occupied = new Set(posts.filter((post) => post.date === date && ['scheduled', 'needs_review'].includes(post.status)).map((post) => post.time))
  return calendarSlotCandidates.map((slot) => ({ ...slot, available: !occupied.has(slot.time) }))
}
