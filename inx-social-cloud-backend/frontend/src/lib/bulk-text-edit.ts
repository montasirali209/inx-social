export type BulkTextEmojiMode = 'keep' | 'one' | 'none'

export type BulkTextEditRules = {
  removeHashtags: boolean
  emojiMode: BulkTextEmojiMode
  findText: string
  replaceText: string
}

export const X_TEXT_CLEANUP_RULES: BulkTextEditRules = {
  removeHashtags: true,
  emojiMode: 'one',
  findText: '',
  replaceText: '',
}

export const EMPTY_BULK_TEXT_EDIT_RULES: BulkTextEditRules = {
  removeHashtags: false,
  emojiMode: 'keep',
  findText: '',
  replaceText: '',
}

const emojiSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('en', { granularity: 'grapheme' })
  : null
const emojiPattern = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u

export function removeHashtagTokens(value: string) {
  return String(value || '')
    .split('\n')
    .map((line) => line
      .replace(/(^|[ \t]+)#[^\s]+/g, '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function limitEmoji(value: string, mode: BulkTextEmojiMode) {
  const source = String(value || '')
  if (!source || mode === 'keep') return source

  if (!emojiSegmenter) {
    let kept = false
    return source.replace(/\p{Extended_Pictographic}/gu, (match) => {
      if (mode === 'none') return ''
      if (!kept) {
        kept = true
        return match
      }
      return ''
    })
  }

  let kept = false
  let result = ''
  for (const { segment } of emojiSegmenter.segment(source)) {
    if (!emojiPattern.test(segment)) {
      result += segment
      continue
    }
    if (mode === 'one' && !kept) {
      kept = true
      result += segment
    }
  }
  return result
}

export function replacePlainText(value: string, findText: string, replaceText: string) {
  if (!findText) return value
  return value.split(findText).join(replaceText)
}

export function applyBulkTextEdit(value: string, rules: BulkTextEditRules) {
  let output = String(value || '')
  if (rules.removeHashtags) output = removeHashtagTokens(output)
  output = limitEmoji(output, rules.emojiMode)
  output = replacePlainText(output, rules.findText, rules.replaceText)
  return output
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
