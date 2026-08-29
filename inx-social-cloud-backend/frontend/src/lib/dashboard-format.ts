import type { DashboardJob } from '../types/dashboard'

export function jobTitle(job: DashboardJob) {
  return job.title?.trim() || job.localFileName || job.asset?.originalFileName || 'Untitled video'
}

export function formatFileSize(value: string | null | undefined) {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Size unavailable'
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  return `${Math.ceil(bytes / 1024)} KB`
}

export function formatSchedule(value: string | null, part: 'date' | 'time' | 'full' = 'full', timeZone?: string) {
  if (!value) return 'Not scheduled'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  const options: Intl.DateTimeFormatOptions = part === 'date'
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : part === 'time'
      ? { hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone }).format(date)
}

export function fileDetails(job: DashboardJob) {
  const mime = job.asset?.mimeType || ''
  const type = mime.includes('/') ? mime.split('/')[1].toUpperCase() : job.contentType
  return `${type} · ${formatFileSize(job.asset?.fileSizeBytes)}`
}
