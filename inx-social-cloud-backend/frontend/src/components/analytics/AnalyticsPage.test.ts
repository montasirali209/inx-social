import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import type { PerformancePoint } from '../../types/analytics'
import { aggregatePerformance } from '../../data/analyticsAggregation'

const point = (date: string, views: number): PerformancePoint => ({
  date,
  label: date,
  views,
  engagements: views,
  linkClicks: views,
  followers: views,
})

describe('Analytics performance intervals', () => {
  it('groups monthly data by calendar month instead of collapsing the entire range', () => {
    const result = aggregatePerformance([
      point('2026-07-31', 2),
      point('2026-08-01', 3),
      point('2026-08-31', 4),
      point('2026-09-01', 5),
    ], 'monthly')

    expect(result.map((item) => item.views)).toEqual([2, 7, 5])
    expect(result.map((item) => item.label)).toEqual(['Jul 2026', 'Aug 2026', 'Sept 2026'])
  })

  it('uses the cross-platform Audience Pulse instead of the demographics card', () => {
    const root = path.resolve(__dirname, '../..')
    const page = fs.readFileSync(path.join(root, 'components/analytics/AnalyticsPage.tsx'), 'utf8')
    const cards = fs.readFileSync(path.join(root, 'components/analytics/AudienceCards.tsx'), 'utf8')
    expect(page).toContain('AudiencePulseCard')
    expect(page).not.toContain('AudienceDemographicsCard')
    expect(cards).toContain('title="Audience Pulse"')
    expect(cards).toContain('Interactions / 1K')
  })
})
