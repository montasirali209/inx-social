import type { DashboardJob, Platform } from './dashboard'

export type CalendarPostStatus = 'scheduled' | 'published' | 'draft' | 'needs_review' | 'failed'

export type CalendarDestination = {
  id: string
  platform: Platform
  name: string
  username: string | null
  avatarUrl: string | null
}

export type CalendarPost = {
  id: string
  title: string
  time: string
  date: string
  occurredAt: string
  platform: Platform
  pageId: string | null
  pageName: string
  status: CalendarPostStatus
  thumbnailUrl: string | null
  engagementScore: number | null
  source: 'inx' | 'post_for_me'
  jobId: string | null
  providerPostId: string | null
  platformUrl: string | null
  errorMessage?: string | null
  smartTiming?: boolean
}

export type CalendarDay = {
  date: string
  isCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
  posts: CalendarPost[]
}

export type AvailableSlot = {
  time: string
  score: number | null
  label: string
  available: boolean
}

export type CalendarStat = {
  label: string
  value: number
  detail: string
  tone: 'green' | 'teal' | 'amber' | 'purple' | 'red'
}

export type CalendarData = {
  posts: CalendarPost[]
  destinations: CalendarDestination[]
  jobs: DashboardJob[]
  stats: CalendarStat[]
  syncWarnings: string[]
}
