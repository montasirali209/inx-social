import { AlertTriangle, CalendarClock, CheckCircle2, CheckSquare2, Clock3, PencilLine, RotateCcw, SquarePen, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BulkScheduledEditRules } from '../../lib/bulk-text-edit'
import type { DashboardJob } from '../../types/dashboard'
import { ScheduledPostEditorModal } from '../posts/ScheduledPostEditorModal'
import { Button } from '../ui/Button'
import { BulkTextEditModal } from './BulkTextEditModal'
import type { BulkHistoryView } from './BulkSchedulerStats'

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
  if (!job.providerPostId) return 'The publishing service did not confirm a schedule for this item. It is safe to retry while the publishing time is still in the future.'
  return 'The publishing service reported a problem. Review the post before taking further action.'
}

function statusPresentation(job: DashboardJob) {
  if (job.status === 'PUBLISHED') return { label: 'Published', icon: CheckCircle2, badge: 'border-brand-green/25 bg-brand-green/8 text-brand-green', iconTone: 'border-brand-green/20 bg-brand-green/8 text-brand-green' }
  if (job.status === 'SCHEDULED') return { label: 'Scheduled', icon: CalendarClock, badge: 'border-brand-cyan/25 bg-brand-cyan/8 text-brand-cyan', iconTone: 'border-brand-cyan/20 bg-brand-cyan/8 text-brand-cyan' }
  if (job.status === 'FAILED') return { label: 'Pending Review', icon: AlertTriangle, badge: 'border-brand-amber/30 bg-brand-amber/8 text-brand-amber', iconTone: 'border-brand-amber/25 bg-brand-amber/8 text-brand-amber' }
  if (job.status === 'CANCELLED') return { label: 'Cancelled', icon: X, badge: 'border-border-soft bg-white/[.025] text-text-muted', iconTone: 'border-border-soft bg-white/[.025] text-text-muted' }
  return { label: 'Processing', icon: Clock3, badge: 'border-brand-purple/25 bg-brand-purple/8 text-brand-purple', iconTone: 'border-brand-purple/20 bg-brand-purple/8 text-brand-purple' }
}

export function BulkScheduleManager({ jobs, initialView, timezone, onClose, onChanged, onRetryJobs, onBulkEditJobs, onBulkCancelJobs }: {
  jobs: DashboardJob[]
  initialView: BulkHistoryView
  timezone: string
  onClose: () => void
  onChanged: () => Promise<unknown> | void
  onRetryJobs: (jobs: DashboardJob[]) => void
  onBulkEditJobs: (jobs: DashboardJob[], rules: BulkScheduledEditRules) => void
  onBulkCancelJobs: (jobs: DashboardJob[]) => Promise<unknown>
}) {
  const [view, setView] = useState<BulkHistoryView>(initialView)
  const [editing, setEditing] = useState<DashboardJob | null>(null)
  const [bulkEditing, setBulkEditing] = useState(false)
  const [bulkCancelling, setBulkCancelling] = useState(false)
  const [bulkCancelError, setBulkCancelError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [destinationScope, setDestinationScope] = useState<Set<string>>(new Set())

  const deduped = useMemo(() => uniqueJobs(jobs), [jobs])
  const scheduledRows = useMemo(() => jobs.filter((job) => job.status === 'SCHEDULED' && Boolean(job.providerPostId)), [jobs])
  const availableDestinations = useMemo(() => {
    const seen = new Map<string, { id: string; label: string; platform: string }>()
    scheduledRows.forEach((job) => {
      const id = job.destination?.id
      if (!id || seen.has(id)) return
      seen.set(id, {
        id,
        label: job.destination?.name || job.destination?.username || 'Connected destination',
        platform: job.destination?.platform || 'social',
      })
    })
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [scheduledRows])

  const visible = useMemo(() => {
    if (view === 'scheduled') {
      return scheduledRows.filter((job) => !destinationScope.size || (job.destination?.id && destinationScope.has(job.destination.id)))
    }
    return deduped.filter((job) => matches(job, view))
  }, [deduped, destinationScope, scheduledRows, view])

  const selectedJobs = useMemo(() => scheduledRows.filter((job) => selectedIds.has(job.id)), [scheduledRows, selectedIds])
  const visibleSelectable = view === 'scheduled' ? visible : []
  const allVisibleSelected = visibleSelectable.length > 0 && visibleSelectable.every((job) => selectedIds.has(job.id))
  const retryableJobs = useMemo(() => deduped.filter((job) => job.status === 'FAILED' && !job.metaPostId), [deduped])

  const counts = useMemo(() => ({
    all: deduped.length,
    scheduled: deduped.filter((job) => job.status === 'SCHEDULED').length,
    published: deduped.filter((job) => job.status === 'PUBLISHED').length,
    needs_review: deduped.filter((job) => job.status === 'FAILED').length,
  }), [deduped])

  const tabs: Array<{ id: BulkHistoryView; label: string; detail: string; icon: typeof CalendarClock }> = [
    { id: 'all', label: 'All jobs', detail: 'Complete batch history', icon: Clock3 },
    { id: 'scheduled', label: 'Scheduled', detail: 'Future publishing', icon: CalendarClock },
    { id: 'published', label: 'Published', detail: 'Successfully completed', icon: CheckCircle2 },
    { id: 'needs_review', label: 'Needs Review', detail: 'Action required', icon: AlertTriangle },
  ]

  const toggleDestination = (id: string) => {
    setDestinationScope((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSelectedIds(new Set())
  }

  const cancelSelected = async () => {
    if (!selectedJobs.length || bulkCancelling) return
    const count = selectedJobs.length
    if (!window.confirm(`Cancel ${count} selected scheduled destination${count === 1 ? '' : 's'}? They will be removed from the publishing queue and will not go live. This cannot be undone.`)) return

    setBulkCancelling(true)
    setBulkCancelError(null)
    try {
      await onBulkCancelJobs(selectedJobs)
      setSelectedIds(new Set())
    } catch (error) {
      setBulkCancelError(error instanceof Error ? error.message : 'The selected schedules could not be cancelled.')
    } finally {
      setBulkCancelling(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#01070d]/88 p-3 backdrop-blur-md sm:p-5" onMouseDown={(event) => { if (event.currentTarget === event.target && !editing && !bulkEditing && !bulkCancelling) onClose() }}>
      <section aria-modal="true" className="my-auto flex max-h-[min(900px,calc(100dvh-2rem))] w-full max-w-7xl flex-col overflow-hidden rounded-[22px] border border-brand-cyan/25 bg-panel shadow-[0_38px_150px_rgba(0,0,0,.74)]" role="dialog">
        <header className="border-b border-border-soft bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,.10),transparent_42%),linear-gradient(135deg,rgba(10,30,44,.98),rgba(6,18,29,.98))] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><CalendarClock className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold sm:text-xl">Bulk schedule manager</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-text-muted">Review future schedules, published posts, and anything that needs attention. Select scheduled destinations to bulk edit or cancel them safely.</p>
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
                onClick={() => {
                  setView(id)
                  if (id !== 'scheduled') {
                    setSelectedIds(new Set())
                    setDestinationScope(new Set())
                  }
                }}
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

        {view === 'all' && counts.scheduled > 0 && <div className="mx-5 mt-4 flex flex-col gap-3 rounded-xl border border-brand-cyan/18 bg-brand-cyan/[.035] px-4 py-3 sm:mx-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-cyan/10 text-brand-cyan"><SquarePen className="size-4" /></span>
            <div><strong className="text-xs text-text-main">Need to change several scheduled posts?</strong><p className="mt-1 text-[10px] leading-4 text-text-muted">Open Scheduled to select one, several or all destination schedules and change caption, start date or publishing time in bulk.</p></div>
          </div>
          <Button className="shrink-0" onClick={() => setView('scheduled')} size="sm" type="button" variant="primary"><SquarePen className="size-3.5" />Bulk Edit Scheduled ({counts.scheduled})</Button>
        </div>}

        {view === 'needs_review' && counts.needs_review > 0 && <div className="mx-5 mt-4 flex items-start gap-3 rounded-xl border border-brand-amber/25 bg-brand-amber/[.055] px-4 py-3 sm:mx-6">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-amber/10 text-brand-amber"><AlertTriangle className="size-4" /></span>
          <div className="min-w-0 flex-1"><strong className="text-xs text-text-main">{counts.needs_review} post{counts.needs_review === 1 ? '' : 's'} need attention</strong><p className="mt-1 text-[10px] leading-5 text-text-muted">Use Fix & retry to correct the post first, or Retry now to submit the same content again. Progress and any new publishing reason stay visible in Batch Run.</p></div>
          {retryableJobs.length > 1 && <Button className="shrink-0" onClick={() => onRetryJobs(retryableJobs)} size="sm" type="button" variant="primary"><RotateCcw className="size-3.5" />Retry All ({retryableJobs.length})</Button>}
        </div>}

        {view === 'scheduled' && <div className="mx-5 mt-4 rounded-xl border border-brand-cyan/18 bg-brand-cyan/[.035] p-3 sm:mx-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-cyan/10 text-brand-cyan"><SquarePen className="size-4" /></span>
                <div><strong className="text-xs text-text-main">Manage scheduled posts</strong><p className="mt-1 text-[10px] leading-4 text-text-muted">Select one, several or all visible destination schedules. Bulk Edit changes them; Cancel Selected removes them from the publishing queue.</p></div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {visibleSelectable.length > 0 && <Button onClick={() => setSelectedIds((current) => {
                  const next = new Set(current)
                  if (allVisibleSelected) visibleSelectable.forEach((job) => next.delete(job.id))
                  else visibleSelectable.forEach((job) => next.add(job.id))
                  return next
                })} size="sm" type="button" variant="ghost"><CheckSquare2 className="size-3.5" />{allVisibleSelected ? 'Clear visible' : `Select all (${visibleSelectable.length})`}</Button>}
                <Button disabled={!selectedJobs.length || bulkCancelling} onClick={() => setBulkEditing(true)} size="sm" type="button" variant="primary"><SquarePen className="size-3.5" />Bulk Edit{selectedJobs.length ? ` (${selectedJobs.length})` : ''}</Button>
                <Button className="border-brand-red/25 text-brand-red hover:bg-brand-red/10 hover:text-brand-red" disabled={!selectedJobs.length || bulkCancelling} onClick={() => { void cancelSelected() }} size="sm" type="button" variant="ghost"><Trash2 className="size-3.5" />{bulkCancelling ? `Cancelling (${selectedJobs.length})…` : `Cancel Selected${selectedJobs.length ? ` (${selectedJobs.length})` : ''}`}</Button>
              </div>
            </div>

            {availableDestinations.length > 1 && <div className="flex flex-wrap items-center gap-1.5 border-t border-white/6 pt-3">
              <span className="mr-1 text-[9px] font-semibold uppercase tracking-[.06em] text-text-soft">Destination scope</span>
              <button className={`rounded-lg border px-2.5 py-1.5 text-[9px] font-semibold transition ${!destinationScope.size ? 'border-brand-cyan/35 bg-brand-cyan/10 text-brand-cyan' : 'border-border-soft text-text-muted hover:text-white'}`} onClick={() => { setDestinationScope(new Set()); setSelectedIds(new Set()) }} type="button">All destinations</button>
              {availableDestinations.map((destination) => {
                const active = destinationScope.has(destination.id)
                return <button className={`rounded-lg border px-2.5 py-1.5 text-[9px] font-semibold transition ${active ? 'border-brand-cyan/35 bg-brand-cyan/10 text-brand-cyan' : 'border-border-soft text-text-muted hover:text-white'}`} key={destination.id} onClick={() => toggleDestination(destination.id)} type="button">{destination.platform === 'x' ? 'X' : destination.platform.charAt(0).toUpperCase() + destination.platform.slice(1)} · {destination.label}</button>
              })}
            </div>}

            {bulkCancelError && <p className="rounded-lg border border-brand-red/20 bg-brand-red/7 px-3 py-2 text-[10px] text-brand-red">{bulkCancelError}</p>}
            <p className="text-[9px] text-text-soft">{visibleSelectable.length} editable destination schedule{visibleSelectable.length === 1 ? '' : 's'} in the current scope.{selectedJobs.length ? ` ${selectedJobs.length} selected for Bulk Edit or cancellation.` : ''}</p>
          </div>
        </div>}

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {visible.length ? <div className="grid gap-3">{visible.map((job) => {
            const presentation = statusPresentation(job)
            const Icon = presentation.icon
            const editable = job.status === 'SCHEDULED'
            const selectable = view === 'scheduled' && editable && Boolean(job.providerPostId)
            const retryable = job.status === 'FAILED' && !job.metaPostId
            const fixable = job.status === 'FAILED' && !job.metaPostId
            const review = job.status === 'FAILED'
            const selected = selectedIds.has(job.id)
            return <article className={`rounded-2xl border p-4 transition ${selected ? 'border-brand-cyan/35 bg-brand-cyan/[.055]' : review ? 'border-brand-amber/20 bg-gradient-to-r from-brand-amber/[.045] to-bg/20' : 'border-border-soft bg-bg/25 hover:border-brand-cyan/20'}`} key={job.id}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                {view === 'scheduled' && <span className="pt-2">{selectable ? <input aria-label={`Select ${job.destination?.name || 'scheduled destination'}`} checked={selected} className="size-4 accent-current" onChange={(event) => setSelectedIds((current) => { const next = new Set(current); if (event.target.checked) next.add(job.id); else next.delete(job.id); return next })} type="checkbox" /> : <span className="block size-4 rounded border border-border-soft opacity-30" />}</span>}
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl border ${presentation.iconTone}`}><Icon className={`size-4 ${presentation.label === 'Processing' ? 'animate-spin motion-reduce:animate-none' : ''}`} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-sm text-text-main">{job.title || job.localFileName || job.caption?.split(/\n+/)[0] || 'Untitled bulk item'}</strong>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-text-muted">{job.caption || 'No caption text.'}</p>
                    </div>
                    <span className={`inline-flex min-h-7 shrink-0 items-center rounded-lg border px-2.5 text-[9px] font-semibold uppercase tracking-[.05em] ${presentation.badge}`}>{presentation.label}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[9px] text-text-soft">
                    <span className="rounded-lg border border-border-soft bg-black/10 px-2 py-1">{job.destination?.platform === 'x' ? 'X' : job.destination?.platform || 'social'} · {job.destination?.name || job.destination?.username || 'Connected destination'}</span>
                    <span className="rounded-lg border border-border-soft bg-black/10 px-2 py-1">{formatSchedule(job.scheduledAt, timezone)}</span>
                    <span className="rounded-lg border border-border-soft bg-black/10 px-2 py-1">{job.contentType.toLowerCase()} post</span>
                  </div>

                  {review && <div className="mt-3 rounded-xl border border-brand-amber/20 bg-black/15 px-3 py-2.5">
                    <strong className="flex items-center gap-2 text-[10px] text-brand-amber"><AlertTriangle className="size-3.5" />{reviewTitle(job)}</strong>
                    <p className="mt-1 text-[10px] leading-5 text-text-muted">{reviewMessage(job)}</p>
                  </div>}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                  {editable && <Button className="min-h-9 px-3 text-[10px]" onClick={() => setEditing(job)} size="sm" type="button" variant="primary"><PencilLine className="size-3.5" />Edit schedule</Button>}
                  {fixable && <Button className="min-h-9 px-3 text-[10px]" onClick={() => setEditing(job)} size="sm" type="button" variant="primary"><PencilLine className="size-3.5" />Fix & retry</Button>}
                  {retryable && <Button className="min-h-9 px-3 text-[10px]" onClick={() => onRetryJobs([job])} size="sm" type="button" variant="ghost"><RotateCcw className="size-3.5" />Retry now</Button>}
                </div>
              </div>
            </article>
          })}</div> : <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-border-soft bg-black/10 text-center"><span><CalendarClock className="mx-auto size-7 text-brand-cyan" /><strong className="mt-3 block text-sm">Nothing in this view</strong><small className="mt-1 block text-[10px] text-text-muted">{view === 'needs_review' ? 'No publishing issues need attention.' : 'Bulk publishing records will appear here after a batch is created.'}</small></span></div>}
        </div>
      </section>

      {editing && <ScheduledPostEditorModal job={editing} onChanged={onChanged} onClose={() => setEditing(null)} timezone={timezone} />}
      {bulkEditing && selectedJobs.length > 0 && <BulkTextEditModal jobs={selectedJobs} onApply={(selected, rules) => { setBulkEditing(false); onBulkEditJobs(selected, rules) }} onClose={() => setBulkEditing(false)} timezone={timezone} />}
    </div>,
    document.body,
  )
}
