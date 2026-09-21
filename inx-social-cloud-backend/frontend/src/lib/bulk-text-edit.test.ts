import { describe, expect, it } from 'vitest'
import { applyBulkTextEdit, EMPTY_BULK_TEXT_EDIT_RULES, limitEmoji, removeHashtagTokens, X_TEXT_CLEANUP_RULES } from './bulk-text-edit'

describe('bulk scheduled text editing', () => {
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
})
