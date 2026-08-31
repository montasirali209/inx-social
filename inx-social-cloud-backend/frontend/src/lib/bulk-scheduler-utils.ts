import type { DashboardJob } from '../types/dashboard'
import type { TimingMode } from '../types/bulk-scheduler'

export function parseCaptions(value: string) {
  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (!normalized) return []
  const paragraphs = normalized.split(/\n\s*\n+/).map((caption) => caption.trim()).filter(Boolean)
  if (paragraphs.length > 1) return paragraphs
  const lines = normalized.split('\n').map((caption) => caption.trim()).filter(Boolean)
  return lines.length > 1 ? lines : paragraphs
}

function localDate(date: string, time: string) {
  const parsed = new Date(`${date}T${time}:00`)
  if (!date || !time || Number.isNaN(parsed.getTime())) throw new Error('Choose a valid future date and time.')
  if (parsed.getTime() < Date.now() + 20 * 60_000) throw new Error('The first publishing time must be at least 20 minutes in the future.')
  return parsed
}

function roundToNextHalfHour(date: Date) {
  const rounded = new Date(date)
  rounded.setSeconds(0, 0)
  rounded.setMinutes(rounded.getMinutes() < 30 ? 30 : 60)
  return rounded
}

export function buildPublishingTimes(input: {
  mode: TimingMode
  mediaCount: number
  date: string
  time: string
  dailyTimes?: string[]
  jobs: DashboardJob[]
  destinationIds: string[]
  externalScheduledAt?: string[]
}) {
  if (input.mode === 'publish_now') return Array.from({ length: input.mediaCount }, () => null)
  if (input.mode === 'best_engagement_time') throw new Error('Best engagement timing is not available until platform analytics are connected.')

  if (input.mode === 'next_available_slots') {
    const occupied = new Set(input.jobs
      .filter((job) => job.scheduledAt && job.page && input.destinationIds.includes(job.page.id) && !['FAILED', 'CANCELLED'].includes(job.status))
      .map((job) => new Date(job.scheduledAt!).toISOString()))
    input.externalScheduledAt?.forEach((value) => occupied.add(new Date(value).toISOString()))
    const result: string[] = []
    let candidate = roundToNextHalfHour(new Date(Date.now() + 20 * 60_000))
    while (result.length < input.mediaCount) {
      const iso = candidate.toISOString()
      if (!occupied.has(iso)) result.push(iso)
      candidate = new Date(candidate.getTime() + 30 * 60_000)
    }
    return result
  }

  if (input.mode === 'schedule_time') {
    const times = [...new Set((input.dailyTimes || []).filter((time) => /^\d{2}:\d{2}$/.test(time)))].sort()
    if (!input.date || !times.length) throw new Error('Choose a start date and add at least one daily publishing time.')
    const result: string[] = []
    const day = new Date(`${input.date}T00:00:00`)
    if (Number.isNaN(day.getTime())) throw new Error('Choose a valid start date.')
    let dayOffset = 0
    while (result.length < input.mediaCount && dayOffset < input.mediaCount + 366) {
      for (const time of times) {
        const candidate = new Date(day)
        candidate.setDate(candidate.getDate() + dayOffset)
        const [hours, minutes] = time.split(':').map(Number)
        candidate.setHours(hours, minutes, 0, 0)
        if (candidate.getTime() >= Date.now() + 20 * 60_000) result.push(candidate.toISOString())
        if (result.length === input.mediaCount) break
      }
      dayOffset += 1
    }
    if (result.length !== input.mediaCount) throw new Error('Could not build the selected daily publishing schedule.')
    return result
  }

  const start = localDate(input.date, input.time)
  return Array.from({ length: input.mediaCount }, (_, index) => new Date(start.getTime() + index * 24 * 60 * 60_000).toISOString())
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}
