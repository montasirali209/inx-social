import { AlertTriangle, CalendarClock, CheckCircle2, CheckSquare2, Clock3, PencilLine, RotateCcw, SquarePen, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DashboardJob, Platform } from '../../types/dashboard'
import type { BulkTextEditRules } from '../../lib/bulk-text-edit'
import { Button } from '../ui/Button'
import { ScheduledPostEditorModal } from '../posts/ScheduledPostEditorModal'
import type { BulkHistoryView } from './BulkSchedulerStats'
import { BulkTextEditModal } from './BulkTextEditModal'

function matches(job: DashboardJob, view: BulkHistoryView) {
  if (view === 'all') return true
  if (view === 'scheduled') return job.status === 'SCHEDULED'
  if (view === 'published') return job.status === 'PUBLISHED'
  return job.status === 'FAILED'
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
  if (!job.providerPostId) return 'publishing provider did not confirm a schedule for this item. It is safe to retry while the publishing time is still in the future.'
  return 'The provider reported a publishing problem. Review the post before taking further action.'
}

function statusPresentation(job: DashboardJob) {
  if (job.status === 'PUBLISHED') return { label: 'Published', icon: CheckCircle2, badge: 'border-brand-green/25 bg-brand-green/8 text-brand-green', iconTone: 'border-brand-green/20 bg-brand-green/8 text-brand-green' }
  if (job.status === 'SCHEDULED') return { label: 'Scheduled', icon: CalendarClock, badge: 'border-brand-cyan/25 bg-brand-cyan/8 text-brand-cyan', iconTone: 'border-brand-cyan/20 bg-brand-cyan/8 text-brand-cyan' }
  if (job.status === 'FAILED') return { label: 'Pending Review', icon: AlertTriangle, badge: 'border-brand-amber/30 bg-brand-amber/8 text-brand-amber', iconTone: 'border-brand-amber/25 bg-brand-amber/8 text-brand-amber' }
  if (job.status === 'CANCELLED') return { label: 'Cancelled', icon: X, badge: 'border-border-soft bg-white/[.025] text-text-muted', iconTone: 'border-border-soft bg-white/[.025] text-text-muted' }
  return { label: 'Processing', icon: Clock3, badge: 'border-brand-purple/25 bg-brand-purple/8 text-brand-purple', iconTone: 'border-brand-purple/20 bg-brand-purple/8 text-brand-purple' }
}

export function BulkScheduleManager({ jobs, initialView, timezone, onClose, onChanged, onRetryJobs, onBulkEditJobs }: {
  jobs: DashboardJob[]
  initialView: BulkHistoryView
  timezone: string
  onClose: () => void
  onChanged: () => Promise<unknown> | void
  onRetryJobs: (jobs: DashboardJob[]) => void
  onBulkEditJobs: (jobs: DashboardJob[], rules: BulkTextEditRules) => void
}) {
  const [view, setView] = useState<BulkHistoryView>(initialView)
  const [editing, setEditing] = useState<DashboardJob | null>(null)
  const [bulkEditing, setBulkEditing] = useState(false)
  const [platformFilter, setPlatformFilter] = useState<'all' | Platform>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const deduped = useMemo(() => uniqueJobs(jobs), [jobs])
  const visible = useMemo(() => deduped
    .filter(job => matches(job, view))
    .filter(job => platformFilter === 'all' || job.destination?.platform === platformFilter), [deduped, platformFilter, view])
  const retryableJobs = useMemo(() => deduped.filter(job => job.status === 'FAILED' && !job.providerPostId), [deduped])
  const singleDestinationContentIds = useMemo(() => {
    const counts = new Map<string, number>()
    jobs.forEach((job) => {
      const key = job.contentId || job.providerPostId || job.id
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return new Set([...counts.entries()].filter(([, count]) => count === 1).map(([key]) => key))
  }, [jobs])
  const isBulkEditable = (job: DashboardJob) => {
    const key = job.contentId || job.providerPostId || job.id
    return job.status === 'SCHEDULED' && job.contentType === 'TEXT' && Boolean(job.providerPostId) && singleDestinationContentIds.has(key)
  }
  const scheduledTextJobs = useMemo(() => deduped.filter(isBulkEditable), [deduped, singleDestinationContentIds])
  const visibleEditableText = useMemo(() => visible.filter(isBulkEditable), [visible, singleDestinationContentIds])
  const selectedJobs = useMemo(() => scheduledTextJobs.filter(job => selectedIds.has(job.id)), [scheduledTextJobs, selectedIds])
  const availablePlatforms = useMemo(() => [...new Set(scheduledTextJobs.map(job => job.destination?.platform).filter(Boolean))].sort() as Platform[], [scheduledTextJobs])
  const allVisibleSelected = visibleEditableText.length > 0 && visibleEditableText.every(job => selectedIds.has(job.id))
  const counts = useMemo(() => ({
    all: deduped.length,
    scheduled: deduped.filter(job => job.status === 'SCHEDULED').length,
    published: deduped.filter(job => job.status === 'PUBLISHED').length,
    needs_review: deduped.filter(job => job.status === 'FAILED').length,
  }), [deduped])
  const tabs: Array<{ id: BulkHistoryView; label: string; detail: string; icon: typeof CalendarClock }> = [
    { id: 'all', label: 'All jobs', detail: 'Complete batch history', icon: Clock3 },
    { id: 'scheduled', label: 'Scheduled', detail: 'Held by publishing provider', icon: CalendarClock },
    { id: 'published', label: 'Published', detail: 'Successfully completed', icon: CheckCircle2 },
    { id: 'needs_review', label: 'Needs Review', detail: 'Action required', icon: AlertTriangle },
  ]

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#01070d]/88 p-3 backdrop-blur-md sm:p-5" onMouseDown={event => { if (event.currentTarget === event.target && !editing) onClose() }}>
      <section aria-modal="true" className="my-auto flex max-h-[min(900px,calc(100dvh-2rem))] w-full max-w-7xl flex-col overflow-hidden rounded-[22px] border border-brand-cyan/25 bg-panel shadow-[0_38px_150px_rgba(0,0,0,.74)]" role="dialog">
        <header className="border-b border-border-soft bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,.10),transparent_42%),linear-gradient(135deg,rgba(10,30,44,.98),rgba(6,18,29,.98))] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><CalendarClock className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold sm:text-xl">Bulk schedule manager</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-text-muted">Review provider-held schedules, completed posts and anything that needs attention. Failed submissions stay visible here until you retry or recreate them.</p>
            </div>
            <button aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-lg border border-transparent text-text-muted transition hover:border-border-soft hover:bg-white/5 hover:text-white" onClick={onClose} type="button"><X className="size-4" /></button>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {tabs.map(({ id, label, detail, icon: Icon }) => {
              const selected = view === id
              const attention = id === 'needs_review' && counts[id] > 0
              return <button
                aria-pressed={selected}
                className={`group rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-brand-cyan ${selected ? attention ? 'border-brand-amber/45 bg-brand-amber/[.08]' : 'border-brand-cyan/40 bg-brand-cyan/[.07]' : 'border-border-soft bg-black/10 hover:border-brand-cyan/25 hover:bg-white/[.025]'}`}
                key={id}
                onClick={() => { setView(id); if (id !== 'scheduled') setSelectedIds(new Set()) }}
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
          <div className="min-w-0 flex-1"><strong className="text-xs text-text-main">{counts.needs_review} post{counts.needs_review === 1 ? '' : 's'} need attention</strong><p className="mt-1 text-[10px] leading-5 text-text-muted">These posts were not confirmed as scheduled or published. Retryable items can be sent back through the main Batch Run so progress and any new errors stay visible.</p></div>
          {retryableJobs.length > 1 && <Button className="shrink-0" onClick={() => onRetryJobs(retryableJobs)} size="sm" type="button" variant="primary"><RotateCcw className="size-3.5" />Retry All ({retryableJobs.length})</Button>}
        </div>}

        {view === 'scheduled' && <div className="mx-5 mt-4 rounded-xl border border-brand-cyan/18 bg-brand-cyan/[.035] p-3 sm:mx-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-cyan/10 text-brand-cyan"><SquarePen className="size-4" /></span>
              <div><strong className="text-xs text-text-main">Bulk edit scheduled text</strong><p className="mt-1 text-[10px] leading-4 text-text-muted">Select future single-destination text posts, preview cleanup rules, then update the existing schedules in place. Shared multi-destination posts are excluded to prevent unintended cross-platform edits.</p></div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Filter scheduled posts by platform" className="min-h-9 rounded-lg border border-border-soft bg-panel px-2.5 text-[10px] font-semibold text-text-main outline-none focus:border-brand-cyan/40" onChange={(event) => { setPlatformFilter(event.target.value as 'all' | Platform); setSelectedIds(new Set()) }} value={platformFilter}>
                <option value="all">All platforms</option>
                {availablePlatforms.map(platform => <option key={platform} value={platform}>{platform === 'x' ? 'X' : platform.charAt(0).toUpperCase() + platform.slice(1)}</option>)}
              </select>
              {visibleEditableText.length > 0 && <Button onClick={() => setSelectedIds((current) => {
                const next = new Set(current)
                if (allVisibleSelected) visibleEditableText.forEach(job => next.delete(job.id))
                else visibleEditableText.forEach(job => next.add(job.id))
                return next
              })} size="sm" type="button" variant="ghost"><CheckSquare2 className="size-3.5" />{allVisibleSelected ? 'Clear visible' : `Select all (${visibleEditableText.length})`}</Button>}
              <Button disabled={!selectedJobs.length} onClick={() => setBulkEditing(true)} size="sm" type="button" variant="primary"><SquarePen className="size-3.5" />Bulk Edit{selectedJobs.length ? ` (${selectedJobs.length})` : ''}</Button>
            </div>
          </div>
          {selectedJobs.length > 0 && <p className="mt-2 text-[9px] text-brand-cyan">{selectedJobs.length} scheduled text post{selectedJobs.length === 1 ? '' : 's'} selected. Media posts are intentionally excluded from this text editor.</p>}
        </div>}

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {visible.length ? <div className="grid gap-3">{visible.map(job => {
            const presentation = statusPresentation(job)
            const Icon = presentation.icon
            const editable = job.status === 'SCHEDULED'
            const bulkEditable = isBulkEditable(job)
            const retryable = job.status === 'FAILED' && !job.providerPostId
            const review = job.status === 'FAILED'
            const selected = selectedIds.has(job.id)
            return <article className={`rounded-2xl border p-4 transition ${selected ? 'border-brand-cyan/35 bg-brand-cyan/[.055]' : review ? 'border-brand-amber/20 bg-gradient-to-r from-brand-amber/[.045] to-bg/20' : 'border-border-soft bg-bg/25 hover:border-brand-cyan/20'}`} key={job.id}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                {view === 'scheduled' && <span className="pt-2">{bulkEditable ? <input aria-label={`Select ${job.title || job.caption?.slice(0, 40) || 'scheduled text post'}`} checked={selected} className="size-4 accent-current" onChange={(event) => setSelectedIds((current) => { const next = new Set(current); if (event.target.checked) next.add(job.id); else next.delete(job.id); return next })} type="checkbox" /> : <span className="block size-4 rounded border border-border-soft opacity-30" />}</span>}
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
                  {retryable && <Button className="min-h-9 px-3 text-[10px]" onClick={() => onRetryJobs([job])} size="sm" type="button" variant="primary"><RotateCcw className="size-3.5" />Retry now</Button>}
                </div>
              </div>
            </article>
          })}</div> : <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-border-soft bg-black/10 text-center"><span><CalendarClock className="mx-auto size-7 text-brand-cyan" /><strong className="mt-3 block text-sm">Nothing in this view</strong><small className="mt-1 block text-[10px] text-text-muted">{view === 'needs_review' ? 'No publishing issues need attention.' : 'Bulk publishing records will appear here after a batch is created.'}</small></span></div>}
        </div>
      </section>

      {editing && <ScheduledPostEditorModal job={editing} onChanged={onChanged} onClose={() => setEditing(null)} timezone={timezone} />}
      {bulkEditing && selectedJobs.length > 0 && <BulkTextEditModal jobs={selectedJobs} onApply={(selected, rules) => { setBulkEditing(false); onBulkEditJobs(selected, rules) }} onClose={() => setBulkEditing(false)} />}
    </div>,
    document.body,
  )
}
