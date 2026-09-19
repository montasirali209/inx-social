import { Activity, CalendarClock, CircleAlert, LoaderCircle, Play, Send, Square, UploadCloud } from 'lucide-react'
import type { BatchProgress, Destination, UploadResult } from '../../types/bulk-scheduler'
import { Button } from '../ui/Button'
import { UploadProgress } from './UploadProgress'
import { UploadResultsTable } from './UploadResultsTable'

type Props = {
  progress: BatchProgress
  results: UploadResult[]
  destinations: Destination[]
  canStart: boolean
  running: boolean
  disabledReason: string
  retryingId: string | null
  onStart: () => void
  onStop: () => void
  onRetry: (result: UploadResult) => void | Promise<void>
}

export function BatchRunPanel({ progress, results, destinations, canStart, running, disabledReason, retryingId, onStart, onStop, onRetry }: Props) {
  const total = results.length || progress.total
  const scheduled = results.filter((result) => result.status === 'scheduled').length
  const published = results.filter((result) => result.status === 'published').length
  const processing = results.filter((result) => result.status === 'uploading' || result.status === 'waiting').length
  const review = results.filter((result) => result.status === 'failed' || result.status === 'blocked').length
  const failureGroups = [...results.reduce((groups, result) => {
    if (!['failed', 'blocked'].includes(result.status)) return groups
    const message = result.errorMessage || (result.status === 'blocked' ? 'Blocked before upload completed.' : 'Publishing failed.')
    groups.set(message, (groups.get(message) || 0) + 1)
    return groups
  }, new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1])

  const kpis = [
    { label: 'Total actions', value: total, icon: UploadCloud, tone: 'text-brand-cyan border-brand-cyan/20 bg-brand-cyan/[.045]' },
    { label: 'Scheduled', value: scheduled, icon: CalendarClock, tone: 'text-brand-cyan border-brand-cyan/20 bg-brand-cyan/[.045]' },
    { label: 'Published', value: published, icon: Send, tone: 'text-brand-green border-brand-green/20 bg-brand-green/[.045]' },
    { label: 'Processing', value: processing, icon: LoaderCircle, tone: 'text-brand-purple border-brand-purple/20 bg-brand-purple/[.045]' },
    { label: 'Needs review', value: review, icon: CircleAlert, tone: review ? 'text-brand-red border-brand-red/25 bg-brand-red/[.055]' : 'text-text-muted border-border-soft bg-white/[.025]' },
  ]

  return (
    <section aria-labelledby="batch-run-title" className="interactive-surface rounded-panel border p-4 sm:p-5">
      <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl border border-brand-purple/25 bg-brand-purple/8 text-[#a98bff]"><Activity aria-hidden="true" className="size-5" /></span><div><h2 className="text-base font-semibold" id="batch-run-title">Batch run</h2><p className="mt-0.5 text-xs leading-5 text-text-muted">Start the upload process and monitor every publishing action live.</p></div></div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1" disabled={!canStart || running} onClick={onStart} type="button" variant="primary"><Play aria-hidden="true" className="size-4 fill-current" /> Upload Now</Button>
        {running && <Button className="flex-1 border-brand-red/45 bg-brand-red/15 text-brand-red hover:bg-brand-red/25" onClick={onStop} type="button"><Square aria-hidden="true" className="size-3.5 fill-current" /> Stop Upload</Button>}
      </div>
      {!canStart && !running && <p className="mt-2 text-center text-xs text-text-soft">{disabledReason}</p>}
      <div className="mt-4"><UploadProgress progress={progress} /></div>

      {(results.length > 0 || progress.total > 0) && (
        <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-5">
          {kpis.map(({ label, value, icon: Icon, tone }) => (
            <article className={`rounded-xl border px-3 py-3 ${tone}`} key={label}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium text-text-muted">{label}</span>
                <Icon aria-hidden="true" className={`size-3.5 ${label === 'Processing' && processing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
              </div>
              <strong className="mt-1 block text-xl text-text-main">{value}</strong>
            </article>
          ))}
        </div>
      )}

      {failureGroups.length > 0 && (
        <section className="mt-3 rounded-xl border border-brand-red/25 bg-brand-red/[.045] px-3.5 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-red"><CircleAlert className="size-4" /> Why items need review</div>
          <div className="mt-2 space-y-1.5">
            {failureGroups.slice(0, 4).map(([message, count]) => (
              <p className="text-[11px] leading-4 text-text-muted" key={message}><strong className="text-text-main">{count}×</strong> {message}</p>
            ))}
          </div>
        </section>
      )}

      <div className="mt-4"><div className="mb-2"><h3 className="text-sm font-semibold">Upload results</h3><p className="mt-0.5 text-xs text-text-muted">Review all scheduled, published, processing, failed and blocked actions. Failed uploads with an existing job can be retried without duplicating successful posts.</p></div><UploadResultsTable destinations={destinations} onRetry={onRetry} results={results} retryingId={retryingId} /></div>
    </section>
  )
}
