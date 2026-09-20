import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, PencilLine, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DashboardJob } from '../../types/dashboard'
import { Button } from '../ui/Button'
import { ScheduledPostEditorModal } from '../posts/ScheduledPostEditorModal'
import type { BulkHistoryView } from './BulkSchedulerStats'

function matches(job: DashboardJob, view: BulkHistoryView) {
  if (view === 'all') return true
  if (view === 'scheduled') return job.status === 'SCHEDULED'
  if (view === 'published') return job.status === 'PUBLISHED'
  return job.status === 'FAILED' || job.status === 'CANCELLED' || job.status === 'AWAITING_UPLOAD'
}

function statusStyle(status: DashboardJob['status']) {
  if (status === 'PUBLISHED') return 'border-brand-green/25 bg-brand-green/8 text-brand-green'
  if (status === 'SCHEDULED') return 'border-brand-cyan/25 bg-brand-cyan/8 text-brand-cyan'
  if (status === 'FAILED' || status === 'CANCELLED') return 'border-brand-red/25 bg-brand-red/8 text-brand-red'
  return 'border-brand-purple/25 bg-brand-purple/8 text-brand-purple'
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

export function BulkScheduleManager({ jobs, initialView, timezone, onClose, onChanged }: {
  jobs: DashboardJob[]
  initialView: BulkHistoryView
  timezone: string
  onClose: () => void
  onChanged: () => Promise<unknown> | void
}) {
  const [view, setView] = useState<BulkHistoryView>(initialView)
  const [editing, setEditing] = useState<DashboardJob | null>(null)
  const deduped = useMemo(() => uniqueJobs(jobs), [jobs])
  const visible = useMemo(() => deduped.filter(job => matches(job, view)), [deduped, view])
  const tabs: Array<{ id: BulkHistoryView; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'published', label: 'Published' },
    { id: 'needs_review', label: 'Needs Review' },
  ]

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#01070d]/85 p-4 backdrop-blur-md" onMouseDown={event => { if (event.currentTarget === event.target && !editing) onClose() }}>
      <section aria-modal="true" className="my-auto flex max-h-[min(850px,calc(100dvh-2rem))] w-full max-w-6xl flex-col overflow-hidden rounded-panel border border-brand-cyan/30 bg-panel shadow-[0_35px_130px_rgba(0,0,0,.72)]" role="dialog">
        <header className="flex items-start gap-3 border-b border-border-soft bg-gradient-to-br from-brand-cyan/[.1] to-panel p-5">
          <span className="grid size-11 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><CalendarClock className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Bulk schedule manager</h2>
            <p className="mt-1 text-xs leading-5 text-text-muted">Future posts are held by Post for Me. While a post is still scheduled you can change its caption, media or publishing time, or cancel it completely.</p>
          </div>
          <button aria-label="Close" className="grid size-9 place-items-center rounded-lg text-text-muted hover:bg-white/5" onClick={onClose} type="button"><X className="size-4" /></button>
        </header>

        <nav className="scrollbar-thin flex gap-2 overflow-x-auto border-b border-border-soft px-5 py-3">
          {tabs.map(tab => <button className={`rounded-xl border px-3 py-2 text-[10px] font-semibold ${view === tab.id ? 'border-brand-cyan/45 bg-brand-cyan/10 text-brand-cyan' : 'border-border-soft text-text-muted hover:text-white'}`} key={tab.id} onClick={() => setView(tab.id)} type="button">{tab.label} <span className="ml-1 opacity-70">{deduped.filter(job => matches(job, tab.id)).length}</span></button>)}
        </nav>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5">
          {visible.length ? <div className="space-y-2">{visible.map(job => {
            const editable = job.status === 'SCHEDULED'
            return <article className="rounded-xl border border-border-soft bg-bg/25 p-3" key={job.id}>
              <div className="flex flex-wrap items-start gap-3">
                <span className="grid size-9 place-items-center rounded-lg border border-border-soft bg-panel/60">{job.status === 'PUBLISHED' ? <CheckCircle2 className="size-4 text-brand-green" /> : job.status === 'FAILED' || job.status === 'CANCELLED' ? <AlertTriangle className="size-4 text-brand-red" /> : <Clock3 className="size-4 text-brand-cyan" />}</span>
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{job.title || job.localFileName || job.caption || 'Untitled bulk item'}</strong>
                  <p className="mt-1 line-clamp-2 text-[10px] text-text-muted">{job.caption || 'No caption'}</p>
                  <p className="mt-1 text-[10px] text-text-soft">{job.destination?.name || job.destination?.username || 'Connected destination'} · {job.scheduledAt ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(job.scheduledAt)) : 'No scheduled time'}</p>
                  {job.errorMessage && <p className="mt-1 text-[10px] text-brand-red">{job.errorMessage}</p>}
                </div>
                <span className={`rounded-lg border px-2 py-1 text-[9px] font-semibold ${statusStyle(job.status)}`}>{job.status.replaceAll('_', ' ')}</span>
                {editable && <Button className="min-h-8 px-3 py-1.5 text-[10px]" onClick={() => setEditing(job)} size="sm" type="button" variant="primary"><PencilLine className="size-3.5" />Edit</Button>}
              </div>
            </article>
          })}</div> : <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-border-soft text-center"><span><CalendarClock className="mx-auto size-6 text-brand-cyan" /><strong className="mt-3 block text-sm">No items in this view</strong><small className="mt-1 text-text-muted">Bulk publishing records will appear here after a batch is created.</small></span></div>}
        </div>
      </section>

      {editing && <ScheduledPostEditorModal job={editing} onChanged={onChanged} onClose={() => setEditing(null)} timezone={timezone} />}
    </div>,
    document.body,
  )
}
