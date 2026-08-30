import type { PublishingActivityPoint } from '../types/dashboard'

export type ActivitySeriesKey = 'published' | 'scheduled' | 'failed'
export type ActivityTone = ActivitySeriesKey

export const publishingActivitySeries: Array<{
  key: ActivitySeriesKey
  label: string
  colour: string
}> = [
  { key: 'published', label: 'Published', colour: '#2dd4bf' },
  { key: 'scheduled', label: 'Scheduled', colour: '#3b82f6' },
  { key: 'failed', label: 'Failed', colour: '#ef4444' },
]

export function activityTotal(points: PublishingActivityPoint[], key?: ActivitySeriesKey) {
  return points.reduce((total, point) => (
    total + (key ? point[key] : point.published + point.scheduled + point.failed)
  ), 0)
}
