import type { DashboardJob } from '../types/dashboard'

export type PostLibraryView = 'all' | 'scheduled' | 'published' | 'needs_review'

export function matchesPostLibraryView(job: DashboardJob, view: PostLibraryView) {
  if (view === 'all') return true
  if (view === 'scheduled') return job.status === 'SCHEDULED'
  if (view === 'published') return job.status === 'PUBLISHED'
  return ['FAILED', 'AWAITING_UPLOAD', 'CANCELLED'].includes(job.status)
}

export function requiresMediaReattachment(job: DashboardJob) {
  return (job.contentType === 'IMAGE' || job.contentType === 'VIDEO') && !job.mediaLibraryAssetId
}
