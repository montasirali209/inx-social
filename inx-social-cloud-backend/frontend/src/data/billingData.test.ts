import { describe, expect, it } from 'vitest'
import { comparisonRows, getPlan, plans } from './billingData'

describe('billing plans', () => {
  it('uses Trial plus Creator, Pro, Business and Agency pricing', () => {
    expect(plans.map((plan) => plan.id)).toEqual(['trial', 'creator', 'pro', 'business', 'agency'])
    expect(plans.map((plan) => plan.monthlyPrice)).toEqual([undefined, 18.99, 34.99, 59.99, 99.99])
    expect(getPlan('trial').connectedPagesLimit).toBe(2)
    expect(getPlan('trial').publishedPostsLimit).toBe(50)
    expect(getPlan('pro').recommended).toBe(true)
  })

  it('gives Trial the full workflow with a small one-time AI allowance', () => {
    expect(getPlan('trial').features).toContain('analytics')
    expect(getPlan('trial').features).toContain('ai_caption_writing')
    expect(getPlan('trial').features).toContain('ai_content_studio')
    expect(getPlan('trial').monthlyAiCredits).toBe(20)
    expect(getPlan('creator').monthlyAiCredits).toBe(300)
    expect(getPlan('pro').monthlyAiCredits).toBe(900)
    expect(getPlan('business').monthlyAiCredits).toBe(2000)
    expect(getPlan('agency').monthlyAiCredits).toBe(4000)
  })

  it('reserves priority support for higher paid tiers', () => {
    expect(getPlan('trial').features).not.toContain('priority_support')
    expect(getPlan('creator').features).not.toContain('priority_support')
    expect(getPlan('pro').features).toContain('priority_support')
    expect(getPlan('business').features).toContain('priority_support')
    expect(getPlan('agency').features).toContain('priority_plus_support')
    expect(comparisonRows.find((row) => row.label === 'Full Analytics')?.values).toEqual({ trial: true, creator: true, pro: true, business: true, agency: true })
  })
})
