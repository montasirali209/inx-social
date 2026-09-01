import type { PerformancePoint } from '../types/analytics'

export function aggregatePerformance(points: PerformancePoint[], interval: 'daily' | 'weekly' | 'monthly') {
  if (interval === 'daily') return points
  if (interval === 'monthly') {
    const formatter = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' })
    const months = new Map<string, PerformancePoint[]>()
    points.forEach((point) => {
      const key = point.date.slice(0, 7)
      months.set(key, [...(months.get(key) || []), point])
    })
    return [...months.entries()].map(([key, group]) => ({
      date: group[0].date,
      label: formatter.format(new Date(`${key}-01T00:00:00`)),
      views: group.reduce((sum, item) => sum + item.views, 0),
      engagements: group.reduce((sum, item) => sum + item.engagements, 0),
      linkClicks: group.reduce((sum, item) => sum + item.linkClicks, 0),
      followers: group.reduce((sum, item) => sum + item.followers, 0),
    }))
  }
  const result: PerformancePoint[] = []
  for (let index = 0; index < points.length; index += 7) {
    const group = points.slice(index, index + 7)
    result.push({ date: group[0].date, label: `${group[0].label}–${group.at(-1)?.label}`, views: group.reduce((sum, item) => sum + item.views, 0), engagements: group.reduce((sum, item) => sum + item.engagements, 0), linkClicks: group.reduce((sum, item) => sum + item.linkClicks, 0), followers: group.reduce((sum, item) => sum + item.followers, 0) })
  }
  return result
}
