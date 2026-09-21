import { describe, expect, it } from 'vitest'
import {
  applyBulkScheduleEdit,
  applyBulkTextEdit,
  earliestLocalDate,
  EMPTY_BULK_TEXT_EDIT_RULES,
  limitEmoji,
  removeHashtagTokens,
  X_TEXT_CLEANUP_RULES,
} from './bulk-text-edit'

describe('bulk scheduled editing', () => {
  it('removes hashtag tokens without breaking URL fragments', () => {
    expect(removeHashtagTokens('Read https://example.com/#pricing #SaaS #Growth')).toBe('Read https://example.com/#pricing')
  })

  it('keeps only the first emoji for the X cleanup preset', () => {
    expect(applyBulkTextEdit('Launch 🚀 looks great 🎉🔥 #startup', X_TEXT_CLEANUP_RULES)).toBe('Launch 🚀 looks great')
  })

  it('supports removing all emoji', () => {
    expect(limitEmoji('One 😀 two 🚀 three', 'none').trim()).toBe('One  two  three')
  })

  it('supports exact find and replace without changing unrelated text', () => {
    expect(applyBulkTextEdit('Visit old.example.com today', {
      ...EMPTY_BULK_TEXT_EDIT_RULES,
      findText: 'old.example.com',
      replaceText: 'new.example.com',
    })).toBe('Visit new.example.com today')
  })

  it('preserves multiline wording while cleaning hashtags', () => {
    expect(applyBulkTextEdit('First line\n\nSecond line #tag\nThird line', X_TEXT_CLEANUP_RULES)).toBe('First line\n\nSecond line\nThird line')
  })

  it('moves a batch to a new start date while preserving relative day spacing and local times', () => {
    const timezone = 'Europe/London'
    const values = ['2026-09-21T07:00:00.000Z', '2026-09-23T11:30:00.000Z']
    const baseline = earliestLocalDate(values, timezone)
    const rules = { ...EMPTY_BULK_TEXT_EDIT_RULES, startDate: '2026-10-05' }

    expect(applyBulkScheduleEdit(values[0], baseline, rules, timezone)).toBe('2026-10-05T07:00:00.000Z')
    expect(applyBulkScheduleEdit(values[1], baseline, rules, timezone)).toBe('2026-10-07T11:30:00.000Z')
  })

  it('can replace time while preserving each selected local date', () => {
    const timezone = 'Europe/London'
    const value = '2026-09-21T07:00:00.000Z'
    const baseline = earliestLocalDate([value], timezone)
    const rules = { ...EMPTY_BULK_TEXT_EDIT_RULES, time: '14:45' }

    expect(applyBulkScheduleEdit(value, baseline, rules, timezone)).toBe('2026-09-21T13:45:00.000Z')
  })
})
