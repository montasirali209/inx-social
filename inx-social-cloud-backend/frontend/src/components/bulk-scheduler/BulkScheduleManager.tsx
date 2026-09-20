import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, PencilLine, RefreshCw, RotateCcw, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { retryFailedScheduledPost } from '../../lib/posts-api'
import type { DashboardJob } from '../../types/dashboard'
import { Button } from '../ui/Button'
import { ScheduledPostEditorModal } from '../posts/ScheduledPostEditorModal'
import type { BulkHistoryView } from './BulkSchedulerStats'

function matches(job: DashboardJob, view: BulkHistoryView) {
  if (view === 'all') return true
  if (view === 'scheduled') return job.status === 'SCHEDULED'
  if (view === 'published') return job.status === 'PUBLISHED'
  return job.status === 'FAILED' || job.status === 'AWAITING_UPLOAD'
}

function uniqueJobs(jobs: DashboardJob[]) {
  const seen = new Set<string>()
  return jobs.filter((job) => {
    const key = job.contentId || job.providerPostId || job.id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function formatSchedule(value: string | null, timezone: string) {
  if (!value) return 'No scheduled time'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value))
}

function reviewTitle(job: DashboardJob) {
  if (!job.providerPostId) return 'Provider submission incomplete'
  return 'Publishing needs attention'
}

function reviewMessage(job: DashboardJob) {
  if (job.errorMessage) return job.errorMessage
  if (!job.providerPostId) return 'Post for Me did not confirm a schedule for this item. It is safe to retry while the publishing time is still in the future.'
  return 'The provider reported a publishing problem. Review the post before taking further action.'
}

function statusPresentation(job: DashboardJob) {
  if (job.status === 'PUBLISHED') return { label: 'Published', icon: CheckCircle2, badge: 'border-brand-green/25 bg-brand-green/8 text-brand-green', iconTone: 'border-brand-green/20 bg-brand-green/8 text-brand-green' }
  if (job.status === 'SCHEDULED') return { label: 'Scheduled', icon: CalendarClock, badge: 'border-brand-cyan/25 bg-brand-cyan/8 text-brand-cyan', iconTone: 'border-brand-cyan/20 bg-brand-cyan/8 text-brand-cyan' }
  if (job.status === 'FAILED' || job.status === 'AWAITING_UPLOAD') return { label: 'Pending Review', icon: AlertTriangle, badge: 'border-brand-amber/30 bg-brand-amber/8 text-brand-amber', iconTone: 'border-brand-amber/25 bg-brand-amber/8 text-brand-amber' }
  if (job.status === 'CANCELLED') return { label: 'Cancelled', icon: X, badge: 'border-border-soft bg-white/[.025] text-text-muted', iconTone: 'border-border-soft bg-white/[.025] text-text-muted' }
  return { label: 'Processing', icon: Clock3, badge: 'border-brand-purple/25 bg-brand-purple/8 text-brand-purple', iconTone: 'border-brand-purple/20 bg-brand-purple/8 text-brand-purple' }
}

export function BulkScheduleManager({ jobs, initialView, timezone, onClose, onChanged }: {
  jobs: DashboardJob[]
  initialView: BulkHistoryView
  timezone: string
  onClose: () => void
  onChanged: () => Promise<unknown> | void
}) {
  const [view, setView] = useState<BulkHistoryView>(initialView)
  const [editing, setEditing] = useState<DashboardJob | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [retryError, setRetryError] = useState<string | null>(null)
  const deduped = useMemo(() => uniqueJobs(jobs), [jobs])
  const visible = useMemo(() => deduped.filter(job => matches(job, view)), [deduped, view])
  const counts = useMemo(() => ({
    all: deduped.length,
    scheduled: deduped.filter(job => job.status === 'SCHEDULED').length,
    published: deduped.filter(job => job.status === 'PUBLISHED').length,
    needs_review: deduped.filter(job => job.status === 'FAILED' || job.status === 'AWAITING_UPLOAD').length,
  }), [deduped])
  const tabs: Array<{ id: BulkHistoryView; label: string; detail: string; icon: typeof CalendarClock }> = [
    { id: 'all', label: 'All jobs', detail: 'Complete batch history', icon: Clock3 },
    { id: 'scheduled', label: 'Scheduled', detail: 'Held by Post for Me', icon: CalendarClock },
    { id: 'published', label: 'Published', detail: 'Successfully completed', icon: CheckCircle2 },
    { id: 'needs_review', label: 'Needs Review', detail: 'Action required', icon: AlertTriangle },
  ]

  const retry = async (job: DashboardJob) => {
    if (retryingId) return
    setRetryingId(job.id)
    setRetryError(null)
    try {
      await retryFailedScheduledPost(job.id)
      await onChanged()
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : 'This post could not be retried.')
    } finally {
      setRetryingId(null)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#01070d]/88 p-3 backdrop-blur-md sm:p-5" onMouseDown={event => { if (event.currentTarget === event.target && !editing && !retryingId) onClose() }}>
      <section aria-modal="true" className="my-auto flex max-h-[min(900px,calc(100dvh-2rem))] w-full max-w-7xl flex-col overflow-hidden rounded-[22px] border border-brand-cyan/25 bg-panel shadow-[0_38px_150px_rgba(0,0,0,.74)]" role="dialog">
        <header className="border-b border-border-soft bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,.10),transparent_42%),linear-gradient(135deg,rgba(10,30,44,.98),rgba(6,18,29,.98))] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><CalendarClock className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold sm:text-xl">Bulk schedule manager</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-text-muted">Review provider-held schedules, completed posts and anything that needs attention. Failed submissions stay visible here until you retry or recreate them.</p>
            </div>
            <button aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-lg border border-transparent text-text-muted transition hover:border-border-soft hover:bg-white/5 hover:text-white" disabled={Boolean(retryingId)} onClick={onClose} type="button"><X className="size-4" /></button>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {tabs.map(({ id, label, detail, icon: Icon }) => {
              const selected = view === id
              const attention = id === 'needs_review' && counts[id] > 0
              return <button
                aria-pressed={selected}
                className={`group rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-brand-cyan ${selected ? attention ? 'border-brand-amber/45 bg-brand-amber/[.08]' : 'border-brand-cyan/40 bg-brand-cyan/[.07]' : 'border-border-soft bg-black/10 hover:border-brand-cyan/25 hover:bg-white/[.025]'}`}
                key={id}
                onClick={() => { setView(id); setRetryError(null) }}
                type="button"
              >
                <span className="flex items-center gap-3">
                  <span className={`grid size-9 place-items-center rounded-lg border ${attention ? 'border-brand-amber/25 bg-brand-amber/8 text-brand-amber' : selected ? 'border-brand-cyan/25 bg-brand-cyan/8 text-brand-cyan' : 'border-border-soft bg-white/[.025] text-text-muted'}`}><Icon className="size-4" /></span>
                  <span className="min-w-0 flex-1"><span className="flex items-baseline justify-between gap-2"><strong className="text-xs">{label}</strong><strong className={`text-lg ${attention ? 'text-brand-amber' : selected ? 'text-brand-cyan' : 'text-text-main'}`}>{counts[id]}</strong></span><small className="mt-0.5 block text-[9px] text-text-soft">{detail}</small></span>
                </span>
              </button>
            })}
          </div>
        </header>

        {view === 'needs_review' && counts.needs_review > 0 && <div className="mx-5 mt-4 flex items-start gap-3 rounded-xl border border-brand-amber/25 bg-brand-amber/[.055] px-4 py-3 sm:mx-6">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-amber/10 text-brand-amber"><AlertTriangle className="size-4" /></span>
          <div className="min-w-0"><strong className="text-xs text-text-main">{counts.needs_review} post{counts.needs_review === 1 ? '' : 's'} need attention</strong><p className="mt-1 text-[10px] leading-5 text-text-muted">These posts were not confirmed as scheduled or published by the provider. A retry is safe when there is no Post for Me ID and the original scheduled time is still in the future.</p></div>
        </div>}

        {retryError && <div className="mx-5 mt-3 rounded-xl border border-brand-red/25 bg-brand-red/[.06] px-4 py-3 text-xs text-brand-red sm:mx-6">{retryError}</div>}

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {visible.length ? <div className="grid gap-3">{visible.map(job => {
            const presentation = statusPresentation(job)
            const Icon = presentation.icon
            const editable = job.status === 'SCHEDULED'
            const retryable = job.status === 'FAILED'
              && !job.providerPostId
              && (!job.scheduledAt || new Date(job.scheduledAt).getTime() > Date.now())
            const review = job.status === 'FAILED' || job.status === 'AWAITING_UPLOAD'
            return <article className={`rounded-2xl border p-4 transition ${review ? 'border-brand-amber/20 bg-gradient-to-r from-brand-amber/[.045] to-bg/20' : 'border-border-soft bg-bg/25 hover:border-brand-cyan/20'}`} key={job.id}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl border ${presentation.iconTone}`}><Icon className={`size-4 ${presentation.label === 'Processing' ? 'animate-spin motion-reduce:animate-none' : ''}`} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-sm text-text-main">{job.title || job.localFileName || job.caption?.split(/\n+/)[0] || 'Untitled bulk item'}</strong>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-text-muted">{job.caption || 'No post text available.'}</p>
                    </div>
                    <span className={`inline-flex min-h-7 shrink-0 items-center rounded-lg border px-2.5 text-[9px] font-semibold uppercase tracking-[.05em] ${presentation.badge}`}>{presentation.label}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[9px] text-text-soft">
                    <span className="rounded-lg border border-border-soft bg-black/10 px-2 py-1">{job.destination?.name || job.destination?.username || 'Connected destination'}</span>
                    <span className="rounded-lg border border-border-soft bg-black/10 px-2 py-1">{formatSchedule(job.scheduledAt, timezone)}</span>
                    <span className="rounded-lg border border-border-soft bg-black/10 px-2 py-1">{job.contentType === 'TEXT' ? 'Text post' : job.contentType.toLowerCase()}</span>
                    {job.providerPostId && <span className="rounded-lg border border-border-soft bg-black/10 px-2 py-1">Provider ID · {job.providerPostId.slice(0, 18)}{job.providerPostId.length > 18 ? '…' : ''}</span>}
                  </div>

                  {review && <div className="mt-3 rounded-xl border border-brand-amber/20 bg-black/15 px-3 py-2.5">
                    <strong className="flex items-center gap-2 text-[10px] text-brand-amber"><AlertTriangle className="size-3.5" />{reviewTitle(job)}</strong>
                    <p className="mt-1 text-[10px] leading-5 text-text-muted">{reviewMessage(job)}</p>
                  </div>}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                  {editable && <Button className="min-h-9 px-3 text-[10px]" onClick={() => setEditing(job)} size="sm" type="button" variant="primary"><PencilLine className="size-3.5" />Edit schedule</Button>}
                  {retryable && <Button className="min-h-9 px-3 text-[10px]" disabled={Boolean(retryingId)} onClick={() => void retry(job)} size="sm" type="button" variant="primary">{retryingId === job.id ? <RefreshCw className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}{retryingId === job.id ? 'Retrying…' : 'Retry now'}</Button>}
                </div>
              </div>
            </article>
          })}</div> : <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-border-soft bg-black/10 text-center"><span><CalendarClock className="mx-auto size-7 text-brand-cyan" /><strong className="mt-3 block text-sm">Nothing in this view</strong><small className="mt-1 block text-[10px] text-text-muted">{view === 'needs_review' ? 'No publishing issues need attention.' : 'Bulk publishing records will appear here after a batch is created.'}</small></span></div>}
        </div>
      </section>

      {editing && <ScheduledPostEditorModal job={editing} onChanged={onChanged} onClose={() => setEditing(null)} timezone={timezone} />}
    </div>,
    document.body,
  )
}
