import type { TimingMode } from '../types/bulk-scheduler'

export const MAX_BULK_SCHEDULE_DAYS = 25
const MAX_BULK_SCHEDULE_AHEAD_MS = MAX_BULK_SCHEDULE_DAYS * 24 * 60 * 60 * 1000

export function parseCaptions(value: string) {
  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (!normalized) return []
  const paragraphs = normalized.split(/\n\s*\n+/).map((caption) => caption.trim()).filter(Boolean)
  if (paragraphs.length > 1) return paragraphs
  const lines = normalized.split('\n').map((caption) => caption.trim()).filter(Boolean)
  return lines.length > 1 ? lines : paragraphs
}

export function zonedDateTimeToIso(date: string, time: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('Choose a valid date and time.')
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const wanted = Date.UTC(year, month - 1, day, hour, minute)
  let guess = wanted
  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', hour: '2-digit', hourCycle: 'h23', minute: '2-digit', month: '2-digit', timeZone: timezone, year: 'numeric',
  })
  const readParts = (value: number) => Object.fromEntries(formatter.formatToParts(new Date(value)).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)])) as Record<string, number>
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = readParts(guess)
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
    const difference = wanted - represented
    if (!difference) break
    guess += difference
  }
  const resolved = readParts(guess)
  if (resolved.year !== year || resolved.month !== month || resolved.day !== day || resolved.hour !== hour || resolved.minute !== minute) {
    throw new Error(`That local time does not exist in ${timezone.replaceAll('_', ' ')} because of a daylight-saving change.`)
  }
  return new Date(guess).toISOString()
}


export function getBulkScheduleCapacity(input: {
  date: string
  dailyTimes?: string[]
  timezone?: string
  now?: number
}) {
  const times = [...new Set((input.dailyTimes || []).filter((time) => /^\d{2}:\d{2}$/.test(time)))].sort()
  if (!input.date || !times.length) return { capacity: 0, cutoffIso: null, lastAllowedIso: null }
  const timezone = input.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const firstDay = new Date(`${input.date}T00:00:00Z`)
  if (Number.isNaN(firstDay.getTime())) return { capacity: 0, cutoffIso: null, lastAllowedIso: null }

  const now = input.now ?? Date.now()
  const minimum = now + 20 * 60_000
  const cutoff = now + MAX_BULK_SCHEDULE_AHEAD_MS
  let capacity = 0
  let lastAllowedIso: string | null = null

  for (let dayOffset = 0; dayOffset <= MAX_BULK_SCHEDULE_DAYS + 1; dayOffset += 1) {
    const candidateDay = new Date(firstDay)
    candidateDay.setUTCDate(candidateDay.getUTCDate() + dayOffset)
    const localDate = candidateDay.toISOString().slice(0, 10)
    for (const time of times) {
      const candidate = zonedDateTimeToIso(localDate, time, timezone)
      const value = new Date(candidate).getTime()
      if (value >= minimum && value <= cutoff) {
        capacity += 1
        lastAllowedIso = candidate
      }
    }
  }

  return { capacity, cutoffIso: new Date(cutoff).toISOString(), lastAllowedIso }
}

export function buildPublishingTimes(input: {
  mode: TimingMode
  mediaCount: number
  date: string
  dailyTimes?: string[]
  timezone?: string
}) {
  if (input.mode === 'publish_now') return Array.from({ length: input.mediaCount }, () => null)
  const times = [...new Set((input.dailyTimes || []).filter((time) => /^\d{2}:\d{2}$/.test(time)))].sort()
  if (!input.date || !times.length) throw new Error('Choose a start date and add at least one publishing time.')
  const timezone = input.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const capacity = getBulkScheduleCapacity({ date: input.date, dailyTimes: times, timezone }).capacity
  if (input.mediaCount > capacity) {
    throw new Error(`This schedule needs ${input.mediaCount} publishing slots, but only ${capacity} fit inside the current ${MAX_BULK_SCHEDULE_DAYS}-day scheduling window. Reduce the media count or add more daily publishing times.`)
  }
  const firstDay = new Date(`${input.date}T00:00:00Z`)
  if (Number.isNaN(firstDay.getTime())) throw new Error('Choose a valid start date.')
  const result: string[] = []
  let dayOffset = 0
  while (result.length < input.mediaCount && dayOffset < input.mediaCount + 366) {
    const candidateDay = new Date(firstDay)
    candidateDay.setUTCDate(candidateDay.getUTCDate() + dayOffset)
    const localDate = candidateDay.toISOString().slice(0, 10)
    for (const time of times) {
      const candidate = zonedDateTimeToIso(localDate, time, timezone)
      if (new Date(candidate).getTime() >= Date.now() + 20 * 60_000) result.push(candidate)
      if (result.length === input.mediaCount) break
    }
    dayOffset += 1
  }
  if (result.length !== input.mediaCount) throw new Error('Could not build the selected daily publishing schedule.')
  return result
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}
