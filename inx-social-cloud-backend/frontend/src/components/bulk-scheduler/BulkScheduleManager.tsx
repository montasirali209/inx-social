import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, RefreshCw, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { deleteBulkJob, rescheduleBulkJob } from '../../lib/bulk-scheduler-api'
import { zonedDateTimeToIso } from '../../lib/bulk-scheduler-utils'
import type { DashboardJob } from '../../types/dashboard'
import { Button } from '../ui/Button'
import type { BulkHistoryView } from './BulkSchedulerStats'

function matches(job: DashboardJob, view: BulkHistoryView) {
  if (view === 'all') return true
  if (view === 'scheduled') return job.status === 'QUEUED' || job.status === 'SCHEDULED'
  if (view === 'published') return job.status === 'PUBLISHED'
  return job.status === 'FAILED' || job.status === 'CANCELLED'
}

function localParts(value: string | null, timezone: string) {
  if (!value) return { date: '', time: '' }
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: timezone,
  }).formatToParts(new Date(value)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

function statusStyle(status: DashboardJob['status']) {
  if (status === 'PUBLISHED') return 'border-brand-green/25 bg-brand-green/8 text-brand-green'
  if (status === 'QUEUED' || status === 'SCHEDULED') return 'border-brand-cyan/25 bg-brand-cyan/8 text-brand-cyan'
  if (status === 'FAILED' || status === 'CANCELLED') return 'border-brand-red/25 bg-brand-red/8 text-brand-red'
  return 'border-brand-purple/25 bg-brand-purple/8 text-brand-purple'
}

export function BulkScheduleManager({ jobs, initialView, timezone, onClose, onChanged }: {
  jobs: DashboardJob[]
  initialView: BulkHistoryView
  timezone: string
  onClose: () => void
  onChanged: () => Promise<unknown> | void
}) {
  const [view, setView] = useState<BulkHistoryView>(initialView)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const visible = useMemo(() => jobs.filter(job => matches(job, view)), [jobs, view])
  const tabs: Array<{ id: BulkHistoryView; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'published', label: 'Published' },
    { id: 'needs_review', label: 'Needs Review' },
  ]

  const startEdit = (job: DashboardJob) => {
    const values = localParts(job.scheduledAt, timezone)
    setEditingId(job.id)
    setDate(values.date)
    setTime(values.time)
    setError('')
  }

  const saveSchedule = async (job: DashboardJob) => {
    if (!date || !time || busyId) return
    setBusyId(job.id)
    setError('')
    try {
      await rescheduleBulkJob(job.id, zonedDateTimeToIso(date, time, timezone))
      setEditingId(null)
      await onChanged()
    } catch (current) {
      setError(current instanceof Error ? current.message : 'The schedule could not be updated.')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (job: DashboardJob) => {
    if (busyId || !window.confirm(`Remove ${job.localFileName || job.title || 'this item'} from the publishing schedule?`)) return
    setBusyId(job.id)
    setError('')
    try {
      await deleteBulkJob(job.id)
      await onChanged()
    } catch (current) {
      setError(current instanceof Error ? current.message : 'The scheduled item could not be removed.')
    } finally {
      setBusyId(null)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#01070d]/85 p-4 backdrop-blur-md" onMouseDown={event => { if (event.currentTarget === event.target && !busyId) onClose() }}>
      <section aria-modal="true" className="my-auto flex max-h-[min(850px,calc(100dvh-2rem))] w-full max-w-6xl flex-col overflow-hidden rounded-panel border border-brand-cyan/30 bg-panel shadow-[0_35px_130px_rgba(0,0,0,.72)]" role="dialog">
        <header className="flex items-start gap-3 border-b border-border-soft bg-gradient-to-br from-brand-cyan/[.1] to-panel p-5">
          <span className="grid size-11 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><CalendarClock className="size-5" /></span>
          <div className="min-w-0 flex-1"><h2 className="text-lg font-semibold">Bulk schedule manager</h2><p className="mt-1 text-xs text-text-muted">Queued items remain in INX Social until their publishing time. Change the date or remove an item here.</p></div>
          <button aria-label="Close" className="grid size-9 place-items-center rounded-lg text-text-muted hover:bg-white/5" onClick={onClose} type="button"><X className="size-4" /></button>
        </header>
        <nav className="scrollbar-thin flex gap-2 overflow-x-auto border-b border-border-soft px-5 py-3">{tabs.map(tab => <button className={`rounded-xl border px-3 py-2 text-[10px] font-semibold ${view === tab.id ? 'border-brand-cyan/45 bg-brand-cyan/10 text-brand-cyan' : 'border-border-soft text-text-muted hover:text-white'}`} key={tab.id} onClick={() => { setView(tab.id); setEditingId(null); setError('') }} type="button">{tab.label} <span className="ml-1 opacity-70">{jobs.filter(job => matches(job, tab.id)).length}</span></button>)}</nav>
        {error && <p className="mx-5 mt-3 rounded-xl border border-brand-red/25 bg-brand-red/8 px-3 py-2 text-xs text-brand-red">{error}</p>}
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5">
          {visible.length ? <div className="space-y-2">{visible.map(job => {
            const scheduled = job.status === 'QUEUED' || job.status === 'SCHEDULED' || (job.status === 'FAILED' && job.asset?.status === 'READY' && Boolean(job.scheduledAt))
            return <article className="rounded-xl border border-border-soft bg-bg/25 p-3" key={job.id}>
              <div className="flex flex-wrap items-start gap-3">
                <span className="grid size-9 place-items-center rounded-lg border border-border-soft bg-panel/60">{job.status === 'PUBLISHED' ? <CheckCircle2 className="size-4 text-brand-green" /> : job.status === 'FAILED' || job.status === 'CANCELLED' ? <AlertTriangle className="size-4 text-brand-red" /> : <Clock3 className="size-4 text-brand-cyan" />}</span>
                <div className="min-w-0 flex-1"><strong className="block truncate text-sm">{job.title || job.localFileName || job.caption || 'Untitled bulk item'}</strong><p className="mt-1 text-[10px] text-text-muted">{job.page?.facebookPageName || 'Facebook Page'} · {job.scheduledAt ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(job.scheduledAt)) : 'No scheduled time'}</p>{job.errorMessage && <p className="mt-1 text-[10px] text-brand-red">{job.errorMessage}</p>}{job.status === 'FAILED' && job.asset?.status !== 'READY' && <p className="mt-1 text-[10px] text-text-soft">The original upload is no longer safely retryable from history. Re-add the media in a new batch.</p>}</div>
                <span className={`rounded-lg border px-2 py-1 text-[9px] font-semibold ${statusStyle(job.status)}`}>{job.status === 'QUEUED' ? 'SCHEDULED' : job.status.replaceAll('_', ' ')}</span>
                {scheduled && <div className="flex gap-1"><button aria-label="Change schedule" className="grid size-8 place-items-center rounded-lg border border-border-soft text-text-muted hover:border-brand-cyan/30 hover:text-brand-cyan" onClick={() => startEdit(job)} type="button"><CalendarClock className="size-3.5" /></button><button aria-label="Remove scheduled item" className="grid size-8 place-items-center rounded-lg border border-brand-red/20 text-brand-red hover:bg-brand-red/10" onClick={() => void remove(job)} type="button"><Trash2 className="size-3.5" /></button></div>}
              </div>
              {editingId === job.id && <div className="mt-3 grid gap-2 rounded-xl border border-brand-cyan/20 bg-brand-cyan/[.04] p-3 sm:grid-cols-[1fr_1fr_auto_auto]"><input className="min-h-10 rounded-lg border border-border-soft bg-bg/50 px-3 text-xs" onChange={event => setDate(event.target.value)} type="date" value={date} /><input className="min-h-10 rounded-lg border border-border-soft bg-bg/50 px-3 text-xs" onChange={event => setTime(event.target.value)} type="time" value={time} /><Button disabled={busyId === job.id} onClick={() => void saveSchedule(job)} size="sm" type="button" variant="primary">{busyId === job.id ? <RefreshCw className="size-3.5 animate-spin" /> : <CalendarClock className="size-3.5" />}Save</Button><Button onClick={() => setEditingId(null)} size="sm" type="button" variant="ghost">Cancel</Button></div>}
            </article>
          })}</div> : <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-border-soft text-center"><span><CalendarClock className="mx-auto size-6 text-brand-cyan" /><strong className="mt-3 block text-sm">No items in this view</strong><small className="mt-1 text-text-muted">Bulk publishing records will appear here after a batch is created.</small></span></div>}
        </div>
      </section>
    </div>,
    document.body,
  )
}
