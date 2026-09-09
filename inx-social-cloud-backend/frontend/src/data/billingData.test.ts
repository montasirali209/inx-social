import { describe, expect, it } from 'vitest'
import { comparisonRows, getPlan, plans } from './billingData'

describe('billing plans', () => {
  it('uses only the Trial, Pro and Plus subscription model', () => {
    expect(plans.map((plan) => plan.id)).toEqual(['trial', 'pro', 'plus'])
    expect(plans.map((plan) => plan.monthlyPrice)).toEqual([undefined, 9.99, 15.99])
    expect(getPlan('trial').connectedPagesLimit).toBe(2)
    expect(getPlan('trial').schedulingWindowDays).toBe(30)
  })

  it('keeps analytics and caption tools out of Trial and full AI Studio in Plus only', () => {
    expect(getPlan('trial').features).not.toContain('analytics')
    expect(getPlan('trial').features).not.toContain('ai_caption_writing')
    expect(getPlan('pro').features).toContain('analytics')
    expect(getPlan('pro').features).toContain('ai_caption_writing')
    expect(getPlan('pro').features).not.toContain('ai_content_studio')
    expect(getPlan('plus').features).toContain('ai_content_studio')
    expect(getPlan('plus').features).toContain('ai_image_generation')
    expect(getPlan('plus').features).toContain('ai_video_generation')
  })

  it('includes priority support in all plans and matches comparison values', () => {
    expect(plans.every((plan) => plan.features.includes('priority_support'))).toBe(true)
    expect(comparisonRows.find((row) => row.label === 'Analytics')?.values).toEqual({ trial: false, pro: 'Full', plus: 'Full' })
  })
})
