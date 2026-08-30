import type { AvailableSlot, CalendarPostStatus } from '../types/calendar'

export const calendarStatusLabels: Record<CalendarPostStatus, string> = {
  scheduled: 'Scheduled',
  published: 'Published',
  draft: 'Draft',
  needs_review: 'Needs Review',
  failed: 'Failed',
}

export const calendarSlotCandidates: Omit<AvailableSlot, 'available'>[] = [
  { time: '09:00', score: null, label: '9:00 AM' },
  { time: '11:00', score: null, label: '11:00 AM' },
  { time: '13:00', score: null, label: '1:00 PM' },
  { time: '15:00', score: null, label: '3:00 PM' },
  { time: '17:00', score: null, label: '5:00 PM' },
  { time: '20:30', score: null, label: '8:30 PM' },
]

export const calendarWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
