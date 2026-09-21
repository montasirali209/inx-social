import { zonedDateTimeToIso } from './bulk-scheduler-utils'

export type BulkTextEmojiMode = 'keep' | 'one' | 'none'

export type BulkScheduledEditRules = {
  removeHashtags: boolean
  emojiMode: BulkTextEmojiMode
  findText: string
  replaceText: string
  startDate: string
  time: string
}

export type BulkTextEditRules = BulkScheduledEditRules

export const X_TEXT_CLEANUP_RULES: BulkScheduledEditRules = {
  removeHashtags: true,
  emojiMode: 'one',
  findText: '',
  replaceText: '',
  startDate: '',
  time: '',
}

export const EMPTY_BULK_TEXT_EDIT_RULES: BulkScheduledEditRules = {
  removeHashtags: false,
  emojiMode: 'keep',
  findText: '',
  replaceText: '',
  startDate: '',
  time: '',
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

export function applyBulkTextEdit(value: string, rules: BulkScheduledEditRules) {
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

function zonedParts(value: string, timezone: string) {
  const date = new Date(value)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  }
}

function dayNumber(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000)
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
}

export function earliestLocalDate(values: Array<string | null | undefined>, timezone: string) {
  const dates = values.filter(Boolean).map((value) => zonedParts(String(value), timezone).date).sort()
  return dates[0] || ''
}

export function applyBulkScheduleEdit(
  scheduledAt: string | null,
  baselineDate: string,
  rules: BulkScheduledEditRules,
  timezone: string,
) {
  if (!scheduledAt) return null
  if (!rules.startDate && !rules.time) return scheduledAt

  const current = zonedParts(scheduledAt, timezone)
  const dayOffset = baselineDate ? dayNumber(current.date) - dayNumber(baselineDate) : 0
  const targetDate = rules.startDate ? addDays(rules.startDate, dayOffset) : current.date
  const targetTime = rules.time || current.time
  return zonedDateTimeToIso(targetDate, targetTime, timezone)
}

export function hasTextRuleChanges(rules: BulkScheduledEditRules) {
  return rules.removeHashtags || rules.emojiMode !== 'keep' || Boolean(rules.findText)
}

export function hasScheduleRuleChanges(rules: BulkScheduledEditRules) {
  return Boolean(rules.startDate || rules.time)
}
