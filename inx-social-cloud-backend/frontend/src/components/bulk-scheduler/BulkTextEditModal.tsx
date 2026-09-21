import { AlertTriangle, CalendarClock, Check, FileText, Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  applyBulkScheduleEdit,
  applyBulkTextEdit,
  earliestLocalDate,
  EMPTY_BULK_TEXT_EDIT_RULES,
  hasScheduleRuleChanges,
  hasTextRuleChanges,
  type BulkScheduledEditRules,
} from '../../lib/bulk-text-edit'
import type { DashboardJob } from '../../types/dashboard'
import { Button } from '../ui/Button'

function platformLabel(job: DashboardJob) {
  const platform = job.destination?.platform || 'social'
  return platform === 'x' ? 'X' : platform.charAt(0).toUpperCase() + platform.slice(1)
}

function formatSchedule(value: string | null, timezone: string) {
  if (!value) return 'No publishing time'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value))
}

export function BulkTextEditModal({
  jobs,
  timezone,
  onClose,
  onApply,
}: {
  jobs: DashboardJob[]
  timezone: string
  onClose: () => void
  onApply: (jobs: DashboardJob[], rules: BulkScheduledEditRules) => void
}) {
  const [rules, setRules] = useState<BulkScheduledEditRules>(EMPTY_BULK_TEXT_EDIT_RULES)
  const baselineDate = useMemo(() => earliestLocalDate(jobs.map((job) => job.scheduledAt), timezone), [jobs, timezone])

  const preview = useMemo(() => jobs.map((job) => {
    const beforeText = job.caption || ''
    const afterText = hasTextRuleChanges(rules) ? applyBulkTextEdit(beforeText, rules) : beforeText
    const beforeSchedule = job.scheduledAt
    const afterSchedule = applyBulkScheduleEdit(job.scheduledAt, baselineDate, rules, timezone)
    return {
      job,
      beforeText,
      afterText,
      beforeSchedule,
      afterSchedule,
      changed: beforeText !== afterText || beforeSchedule !== afterSchedule,
    }
  }), [baselineDate, jobs, rules, timezone])

  const changed = preview.filter((item) => item.changed)
  const emptyTextPosts = preview.filter((item) => item.job.contentType === 'TEXT' && !item.afterText.trim())
  const samples = changed.slice(0, 5)
  const scheduleChanging = hasScheduleRuleChanges(rules)
  const textChanging = hasTextRuleChanges(rules)

  return createPortal(
    <div className="fixed inset-0 z-[140] grid place-items-center overflow-y-auto bg-[#01070d]/90 p-3 backdrop-blur-md sm:p-5" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
      <section aria-modal="true" className="my-auto flex max-h-[min(940px,calc(100dvh-2rem))] w-full max-w-6xl flex-col overflow-hidden rounded-[22px] border border-brand-cyan/25 bg-panel shadow-[0_38px_150px_rgba(0,0,0,.76)]" role="dialog">
        <header className="flex items-start gap-3 border-b border-border-soft bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,.10),transparent_42%),linear-gradient(135deg,rgba(10,30,44,.98),rgba(6,18,29,.98))] p-5 sm:p-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><FileText className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold sm:text-xl">Bulk edit scheduled posts</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-text-muted">Change caption text, move the batch to a new start date, or replace the publishing time for the selected destinations. Review every change before applying.</p>
          </div>
          <button aria-label="Close bulk editor" className="grid size-9 shrink-0 place-items-center rounded-lg text-text-muted hover:bg-white/5 hover:text-white" onClick={onClose} type="button"><X className="size-4" /></button>
        </header>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)]">
            <section className="rounded-2xl border border-border-soft bg-black/12 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h3 className="text-sm font-semibold">Edit rules</h3><p className="mt-1 text-[10px] leading-4 text-text-muted">{jobs.length} destination schedule{jobs.length === 1 ? '' : 's'} selected.</p></div>
                <button className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-brand-cyan/25 bg-brand-cyan/[.07] px-3 text-[10px] font-semibold text-brand-cyan transition hover:bg-brand-cyan/[.12]" onClick={() => setRules((current) => ({ ...current, removeHashtags: true, emojiMode: 'one', findText: '', replaceText: '' }))} type="button"><Sparkles className="size-3.5" />X clean text preset</button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-border-soft bg-bg/25 p-3">
                  <div className="flex items-center gap-2"><FileText className="size-4 text-brand-cyan" /><span className="text-xs font-semibold">Caption / text</span></div>
                  <label className="mt-3 flex cursor-pointer items-start gap-3">
                    <input checked={rules.removeHashtags} className="mt-0.5 size-4 accent-current" onChange={(event) => setRules((current) => ({ ...current, removeHashtags: event.target.checked }))} type="checkbox" />
                    <span><strong className="block text-xs">Remove hashtags</strong><small className="mt-1 block text-[10px] leading-4 text-text-muted">Removes hashtag tokens while preserving URL fragments such as example.com/#pricing.</small></span>
                  </label>

                  <label className="mt-3 block">
                    <span className="text-[10px] font-semibold text-text-muted">Emoji handling</span>
                    <select className="mt-1.5 min-h-10 w-full rounded-lg border border-border-soft bg-panel px-3 text-xs outline-none focus:border-brand-cyan/40" onChange={(event) => setRules((current) => ({ ...current, emojiMode: event.target.value as BulkScheduledEditRules['emojiMode'] }))} value={rules.emojiMode}>
                      <option value="keep">Keep all emojis</option>
                      <option value="one">Maximum one emoji</option>
                      <option value="none">Remove all emojis</option>
                    </select>
                  </label>

                  <div className="mt-3">
                    <span className="text-[10px] font-semibold text-text-muted">Optional find and replace</span>
                    <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                      <input className="min-h-10 rounded-lg border border-border-soft bg-panel px-3 text-xs outline-none focus:border-brand-cyan/40" onChange={(event) => setRules((current) => ({ ...current, findText: event.target.value }))} placeholder="Find exact text" value={rules.findText} />
                      <input className="min-h-10 rounded-lg border border-border-soft bg-panel px-3 text-xs outline-none focus:border-brand-cyan/40" onChange={(event) => setRules((current) => ({ ...current, replaceText: event.target.value }))} placeholder="Replace with" value={rules.replaceText} />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border-soft bg-bg/25 p-3">
                  <div className="flex items-center gap-2"><CalendarClock className="size-4 text-brand-cyan" /><span className="text-xs font-semibold">Publishing schedule</span></div>
                  <p className="mt-1 text-[10px] leading-4 text-text-muted">Leave both fields blank to keep all current dates and times.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label>
                      <span className="mb-1.5 block text-[10px] font-semibold text-text-muted">New start date</span>
                      <input className="min-h-10 w-full rounded-lg border border-border-soft bg-panel px-3 text-xs outline-none focus:border-brand-cyan/40" min={new Date().toISOString().slice(0, 10)} onChange={(event) => setRules((current) => ({ ...current, startDate: event.target.value }))} type="date" value={rules.startDate} />
                    </label>
                    <label>
                      <span className="mb-1.5 block text-[10px] font-semibold text-text-muted">Set time for selected posts</span>
                      <input className="min-h-10 w-full rounded-lg border border-border-soft bg-panel px-3 text-xs outline-none focus:border-brand-cyan/40" onChange={(event) => setRules((current) => ({ ...current, time: event.target.value }))} type="time" value={rules.time} />
                    </label>
                  </div>
                  <p className="mt-2 text-[9px] leading-4 text-text-soft">{rules.startDate ? 'The earliest selected post moves to the new start date. Other selected dates keep the same day spacing.' : 'Current dates stay unchanged.'} {rules.time ? `Every selected post will publish at ${rules.time} in ${timezone.replaceAll('_', ' ')}.` : 'Each post keeps its current local time.'}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <article className="rounded-xl border border-border-soft bg-black/10 p-3"><small className="text-[9px] text-text-soft">Selected</small><strong className="mt-1 block text-lg">{jobs.length}</strong></article>
                <article className="rounded-xl border border-brand-cyan/20 bg-brand-cyan/[.04] p-3"><small className="text-[9px] text-text-soft">Will change</small><strong className="mt-1 block text-lg text-brand-cyan">{changed.length}</strong></article>
                <article className={`rounded-xl border p-3 ${emptyTextPosts.length ? 'border-brand-red/25 bg-brand-red/[.05]' : 'border-border-soft bg-black/10'}`}><small className="text-[9px] text-text-soft">Invalid text</small><strong className={`mt-1 block text-lg ${emptyTextPosts.length ? 'text-brand-red' : ''}`}>{emptyTextPosts.length}</strong></article>
              </div>
            </section>

            <section className="rounded-2xl border border-border-soft bg-black/12 p-4">
              <div><h3 className="text-sm font-semibold">Preview</h3><p className="mt-1 text-[10px] leading-4 text-text-muted">Showing up to five affected destination schedules. Unselected destinations are not changed.</p></div>
              <div className="mt-3 space-y-3">
                {samples.length ? samples.map(({ job, beforeText, afterText, beforeSchedule, afterSchedule }) => (
                  <article className="rounded-xl border border-border-soft bg-bg/25 p-3" key={job.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] text-text-soft">
                      <span>{platformLabel(job)} · {job.destination?.name || job.destination?.username || 'Connected account'}</span>
                      <span>{job.contentType.toLowerCase()} post</span>
                    </div>
                    {beforeText !== afterText && <div className="mt-2 grid gap-2">
                      <div className="rounded-lg border border-brand-red/15 bg-brand-red/[.025] px-3 py-2"><small className="text-[9px] font-semibold uppercase tracking-[.06em] text-text-soft">Text before</small><p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-text-muted">{beforeText || 'No caption'}</p></div>
                      <div className="rounded-lg border border-brand-green/15 bg-brand-green/[.025] px-3 py-2"><small className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[.06em] text-brand-green"><Check className="size-3" />Text after</small><p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-text-main">{afterText || 'No caption'}</p></div>
                    </div>}
                    {beforeSchedule !== afterSchedule && <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-border-soft bg-black/10 px-3 py-2"><small className="text-[9px] font-semibold uppercase tracking-[.06em] text-text-soft">Schedule before</small><p className="mt-1 text-[11px] text-text-muted">{formatSchedule(beforeSchedule, timezone)}</p></div>
                      <div className="rounded-lg border border-brand-cyan/20 bg-brand-cyan/[.035] px-3 py-2"><small className="text-[9px] font-semibold uppercase tracking-[.06em] text-brand-cyan">Schedule after</small><p className="mt-1 text-[11px] text-text-main">{formatSchedule(afterSchedule, timezone)}</p></div>
                    </div>}
                  </article>
                )) : <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-border-soft text-center"><span><Check className="mx-auto size-6 text-brand-green" /><strong className="mt-2 block text-xs">No changes yet</strong><small className="mt-1 block text-[10px] text-text-muted">Change caption rules, start date, or publishing time to preview the bulk edit.</small></span></div>}
              </div>
            </section>
          </div>

          {emptyTextPosts.length > 0 && <div className="mt-4 flex gap-2 rounded-xl border border-brand-red/25 bg-brand-red/[.055] p-3 text-xs text-brand-red"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>{emptyTextPosts.length} text post{emptyTextPosts.length === 1 ? '' : 's'} would become empty. Bulk Edit is blocked until those rules are changed.</span></div>}
          <div className="mt-4 flex gap-2 rounded-xl border border-brand-cyan/15 bg-brand-cyan/[.035] p-3 text-[10px] leading-5 text-text-muted"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand-cyan" /><span>Only the destinations you selected are changed. If one scheduled post was originally shared across several destinations and you selected only some of them, INX Social separates those selected destinations safely while preserving the unselected destinations and their original schedule.</span></div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-soft bg-bg/20 p-4">
          <Button onClick={() => setRules(EMPTY_BULK_TEXT_EDIT_RULES)} type="button" variant="ghost">Clear changes</Button>
          <div className="flex gap-2">
            <Button onClick={onClose} type="button" variant="ghost">Cancel</Button>
            <Button disabled={!changed.length || Boolean(emptyTextPosts.length)} onClick={() => onApply(jobs, rules)} type="button" variant="primary">Apply to {changed.length} destination{changed.length === 1 ? '' : 's'}</Button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
