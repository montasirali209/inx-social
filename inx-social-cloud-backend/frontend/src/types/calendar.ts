import type { ConnectedPage, DashboardJob, Platform } from './dashboard'

export type CalendarPostStatus = 'scheduled' | 'published' | 'draft' | 'needs_review' | 'failed'

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
  source: 'inx' | 'meta'
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

export type MetaScheduledPost = {
  id: string
  message?: string
  created_time?: string
  scheduled_publish_time?: number
  is_published?: boolean
  permalink_url?: string
}

export type CalendarData = {
  posts: CalendarPost[]
  pages: ConnectedPage[]
  jobs: DashboardJob[]
  stats: CalendarStat[]
  syncWarnings: string[]
}
