import { AlertTriangle, CalendarClock, ImagePlus, RefreshCw, Save, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { cancelScheduledPost, replaceScheduledPostMedia, retryFailedScheduledPost, updateScheduledPost } from '../../lib/posts-api'
import { zonedDateTimeToIso } from '../../lib/bulk-scheduler-utils'
import type { DashboardJob } from '../../types/dashboard'
import { Button } from '../ui/Button'

function localParts(value: string | null, timezone: string) {
  if (!value) return { date: '', time: '' }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: timezone,
    })
      .formatToParts(new Date(value))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

export function ScheduledPostEditorModal({
  job,
  timezone,
  onClose,
  onChanged,
}: {
  job: DashboardJob
  timezone: string
  onClose: () => void
  onChanged: () => Promise<unknown> | void
}) {
  const recovery = job.status === 'FAILED' && !job.metaPostId
  const initial = useMemo(() => {
    const scheduled = job.scheduledAt ? new Date(job.scheduledAt) : null
    const value = recovery && (!scheduled || scheduled.getTime() <= Date.now())
      ? new Date(Date.now() + 10 * 60_000).toISOString()
      : job.scheduledAt
    return localParts(value, timezone)
  }, [job.scheduledAt, recovery, timezone])
  const [caption, setCaption] = useState(job.caption || '')
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [replacement, setReplacement] = useState<File | null>(null)
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const scheduledEditable = job.status === 'SCHEDULED'
  const editable = scheduledEditable || recovery

  async function save() {
    if (!editable || busy || !date || !time) return
    setBusy('save')
    setError('')
    try {
      const scheduledAt = zonedDateTimeToIso(date, time, timezone)
      if (recovery) {
        await retryFailedScheduledPost(job.id, { caption: caption.trim(), scheduledAt })
      } else {
        await updateScheduledPost(job.id, { caption: caption.trim(), scheduledAt })
        if (replacement) {
          await replaceScheduledPostMedia(job.id, replacement, setProgress)
        }
      }
      await onChanged()
      onClose()
    } catch (current) {
      setError(current instanceof Error ? current.message : 'The scheduled post could not be updated.')
    } finally {
      setBusy(null)
      setProgress(0)
    }
  }

  async function remove() {
    if (!scheduledEditable || busy) return
    if (!window.confirm('Cancel this scheduled post? It will be removed from the publishing queue before it goes live.')) return
    setBusy('delete')
    setError('')
    try {
      await cancelScheduledPost(job.id)
      await onChanged()
      onClose()
    } catch (current) {
      setError(current instanceof Error ? current.message : 'The scheduled post could not be cancelled.')
    } finally {
      setBusy(null)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-[#01070d]/88 p-4 backdrop-blur-md" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) onClose() }}>
      <section aria-modal="true" className="my-auto w-full max-w-2xl overflow-hidden rounded-panel border border-brand-cyan/30 bg-panel shadow-[0_35px_130px_rgba(0,0,0,.72)]" role="dialog">
        <header className="flex items-start gap-3 border-b border-border-soft bg-gradient-to-br from-brand-cyan/[.1] to-panel p-5">
          <span className="grid size-11 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><CalendarClock className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{recovery ? 'Fix & retry post' : 'Edit scheduled post'}</h2>
            <p className="mt-1 text-xs leading-5 text-text-muted">{recovery ? 'Review the failure, correct the caption or publishing time, then create a safe new publishing attempt for this destination.' : 'This post is scheduled for future publishing. Caption, media and publishing time can be changed while its status remains scheduled.'}</p>
          </div>
          <button aria-label="Close editor" className="grid size-9 place-items-center rounded-lg text-text-muted hover:bg-white/5" disabled={Boolean(busy)} onClick={onClose} type="button"><X className="size-4" /></button>
        </header>

        <div className="space-y-4 p-5">
          {recovery && <div className="flex gap-2 rounded-xl border border-brand-amber/25 bg-brand-amber/8 p-3 text-xs text-brand-amber"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span><strong>Why it failed:</strong> {job.errorMessage || 'The social platform rejected this publishing attempt.'}</span></div>}
          {!editable && <div className="flex gap-2 rounded-xl border border-brand-amber/25 bg-brand-amber/8 p-3 text-xs text-brand-amber"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>This post is already {job.status.toLowerCase().replaceAll('_', ' ')} and cannot be changed safely.</span></div>}
          {error && <div className="rounded-xl border border-brand-red/25 bg-brand-red/8 p-3 text-xs text-brand-red">{error}</div>}

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.08em] text-text-muted">Caption</span>
            <textarea className="min-h-36 w-full resize-y rounded-xl border border-border-soft bg-bg/45 px-3 py-3 text-sm leading-6 outline-none focus:border-brand-cyan/45" disabled={!editable || Boolean(busy)} maxLength={5000} onChange={(event) => setCaption(event.target.value)} value={caption} />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.08em] text-text-muted">Publishing date</span>
              <input className="min-h-11 w-full rounded-xl border border-border-soft bg-bg/45 px-3 text-sm outline-none focus:border-brand-cyan/45" disabled={!editable || Boolean(busy)} onChange={(event) => setDate(event.target.value)} type="date" value={date} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.08em] text-text-muted">Publishing time</span>
              <input className="min-h-11 w-full rounded-xl border border-border-soft bg-bg/45 px-3 text-sm outline-none focus:border-brand-cyan/45" disabled={!editable || Boolean(busy)} onChange={(event) => setTime(event.target.value)} type="time" value={time} />
            </label>
          </div>

          {job.contentType !== 'TEXT' && !recovery && <label className="block rounded-xl border border-border-soft bg-bg/25 p-3">
            <span className="flex items-center gap-2 text-xs font-semibold"><ImagePlus className="size-4 text-brand-cyan" />Replace media</span>
            <span className="mt-1 block text-[10px] leading-4 text-text-muted">Optional. The current provider media remains unchanged unless you choose a replacement file.</span>
            <input accept={job.contentType === 'VIDEO' ? 'video/*' : 'image/*'} className="mt-3 block w-full text-xs text-text-muted file:mr-3 file:rounded-lg file:border file:border-border-soft file:bg-panel file:px-3 file:py-2 file:text-xs file:font-semibold file:text-text-main" disabled={!editable || Boolean(busy)} onChange={(event) => setReplacement(event.target.files?.[0] || null)} type="file" />
            {replacement && <span className="mt-2 block truncate text-[10px] text-brand-cyan">{replacement.name}</span>}
            {busy === 'save' && replacement && progress > 0 && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/7"><div className="h-full bg-brand-cyan transition-all" style={{ width: `${progress}%` }} /></div>}
          </label>}

          <div className="rounded-xl border border-brand-cyan/15 bg-brand-cyan/[.035] p-3 text-[10px] leading-5 text-text-muted">
            Destination: <strong className="text-text-main">{job.destination?.name || job.destination?.username || 'Connected account'}</strong>. INX Social keeps the live publishing status and available edits synchronized.
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-soft bg-bg/20 p-4">
          {scheduledEditable ? <Button className="border-brand-red/25 text-brand-red hover:bg-brand-red/10" disabled={Boolean(busy)} onClick={() => void remove()} type="button" variant="ghost"><Trash2 className="size-4" />{busy === 'delete' ? 'Cancelling…' : 'Cancel schedule'}</Button> : <span />}
          <div className="flex gap-2">
            <Button disabled={Boolean(busy)} onClick={onClose} type="button" variant="ghost">Close</Button>
            <Button disabled={!editable || Boolean(busy) || !date || !time} onClick={() => void save()} type="button" variant="primary">{busy === 'save' ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}{busy === 'save' ? (recovery ? 'Retrying…' : 'Saving…') : (recovery ? 'Retry with changes' : 'Save changes')}</Button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
