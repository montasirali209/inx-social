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
  videoCount: number
  date: string
  time: string
  jobs: DashboardJob[]
  destinationIds: string[]
  externalScheduledAt?: string[]
}) {
  if (input.mode === 'publish_now') return Array.from({ length: input.videoCount }, () => null)
  if (input.mode === 'best_engagement_time') throw new Error('Best engagement timing is not available until platform analytics are connected.')

  if (input.mode === 'next_available_slots') {
    const occupied = new Set(input.jobs
      .filter((job) => job.scheduledAt && job.page && input.destinationIds.includes(job.page.id) && !['FAILED', 'CANCELLED'].includes(job.status))
      .map((job) => new Date(job.scheduledAt!).toISOString()))
    input.externalScheduledAt?.forEach((value) => occupied.add(new Date(value).toISOString()))
    const result: string[] = []
    let candidate = roundToNextHalfHour(new Date(Date.now() + 20 * 60_000))
    while (result.length < input.videoCount) {
      const iso = candidate.toISOString()
      if (!occupied.has(iso)) result.push(iso)
      candidate = new Date(candidate.getTime() + 30 * 60_000)
    }
    return result
  }

  const start = localDate(input.date, input.time)
  const interval = input.mode === 'spread_across_days' ? 24 * 60 * 60_000 : 30 * 60_000
  return Array.from({ length: input.videoCount }, (_, index) => new Date(start.getTime() + index * interval).toISOString())
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}
