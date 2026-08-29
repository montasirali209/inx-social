import { Activity, Play, Square } from 'lucide-react'
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
  onStart: () => void
  onStop: () => void
}

export function BatchRunPanel({ progress, results, destinations, canStart, running, disabledReason, onStart, onStop }: Props) {
  return (
    <section aria-labelledby="batch-run-title" className="interactive-surface rounded-panel border p-4 sm:p-5">
      <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl border border-brand-purple/25 bg-brand-purple/8 text-[#a98bff]"><Activity aria-hidden="true" className="size-5" /></span><div><h2 className="text-base font-semibold" id="batch-run-title">Batch run</h2><p className="mt-0.5 text-xs leading-5 text-text-muted">Start the upload process and monitor every publishing action live.</p></div></div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1" disabled={!canStart || running} onClick={onStart} type="button" variant="primary"><Play aria-hidden="true" className="size-4 fill-current" /> Upload Now</Button>
        {running && <Button className="flex-1 border-brand-red/45 bg-brand-red/15 text-brand-red hover:bg-brand-red/25" onClick={onStop} type="button"><Square aria-hidden="true" className="size-3.5 fill-current" /> Stop Upload</Button>}
      </div>
      {!canStart && !running && <p className="mt-2 text-center text-xs text-text-soft">{disabledReason}</p>}
      <div className="mt-4"><UploadProgress progress={progress} /></div>
      <div className="mt-4"><div className="mb-2"><h3 className="text-sm font-semibold">Upload results</h3><p className="mt-0.5 text-xs text-text-muted">Published, scheduled, failed and blocked results are retained for this browser session.</p></div><UploadResultsTable destinations={destinations} results={results} /></div>
    </section>
  )
}
