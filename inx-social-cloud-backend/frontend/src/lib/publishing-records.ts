import { apiRequest } from './api-client'
import type { DashboardJob } from '../types/dashboard'

export const publishingRecordsQueryKey = ['publishing-records', 'post-for-me'] as const

type PublicationsResponse = { jobs: DashboardJob[] }

export async function fetchPublishingRecords(limit = 500): Promise<DashboardJob[]> {
  const response = await apiRequest<PublicationsResponse>(`/api/social-publications?limit=${limit}`)
  return response.jobs || []
}

export function isNeedsReviewJob(job: DashboardJob) {
  return job.status === 'FAILED' || job.status === 'AWAITING_UPLOAD'
}
