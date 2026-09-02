import { FileText, HardDrive, Images, Play, RotateCcw, UploadCloud } from 'lucide-react'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import type { SelectedMedia, TimingMode } from '../../types/bulk-scheduler'
import { Button } from '../ui/Button'
import { CaptionInput } from './CaptionInput'
import { SessionSummary } from './SessionSummary'
import { TimingModeSelect } from './TimingModeSelect'
import { DailyTimeSelector } from './DailyTimeSelector'

type Props = {
  media: SelectedMedia[]
  captions: string
  captionCount: number
  timingMode: TimingMode | ''
  scheduleDate: string
  scheduleTimes: string[]
  savedScheduleTimes: string[]
  timezone: string
  selectedDestinations: number
  useFallback: boolean
  retainMedia: boolean
  canStart: boolean
  disabledReason: string
  running: boolean
  onMedia: (files: File[]) => void
  onCaptionFile: (file: File) => void
  onCaptionsChange: (value: string) => void
  onTimingModeChange: (value: TimingMode) => void
  onScheduleDateChange: (value: string) => void
  onScheduleTimeAdd: (value: string) => void
  onScheduleTimeRemove: (value: string) => void
  onFallbackChange: (value: boolean) => void
  onRetainMediaChange: (value: boolean) => void
  onClear: () => void
  onStart: () => void
}

export function UploadBatchPanel(props: Props) {
  const mediaInput = useRef<HTMLInputElement>(null)
  const captionInput = useRef<HTMLInputElement>(null)
  const needsDate = props.timingMode === 'schedule_time' || props.timingMode === 'saved_schedule'
  const exceedsLibraryLimit = props.media.some((item) => item.file.size > 100 * 1024 * 1024)
  return (
    <section aria-labelledby="upload-batch-title" className="interactive-surface rounded-panel border p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/8 text-brand-cyan"><UploadCloud aria-hidden="true" className="size-5" /></span>
          <div><h2 className="text-base font-semibold" id="upload-batch-title">Upload media batch</h2><p className="mt-0.5 text-xs leading-5 text-text-muted">Add local images or videos and captions, then choose how they should publish.</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={props.running} onClick={() => mediaInput.current?.click()} type="button"><Images aria-hidden="true" className="size-4" /> Select media</Button>
          <Button disabled={props.running} onClick={() => captionInput.current?.click()} type="button" variant="ghost"><FileText aria-hidden="true" className="size-4" /> Caption file</Button>
          <input accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/x-m4v,video/webm,.avi,.mkv" className="sr-only" multiple onChange={(event) => { props.onMedia(Array.from(event.target.files || [])); event.target.value = '' }} ref={mediaInput} type="file" />
          <input accept=".txt,text/plain" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onCaptionFile(file) }} ref={captionInput} type="file" />
        </div>
      </div>

      <div className={`mt-4 grid gap-4 ${needsDate ? '' : 'lg:grid-cols-2'}`}>
        <TimingModeSelect onChange={props.onTimingModeChange} value={props.timingMode} />
        {needsDate ? (
          <div className="grid gap-2 sm:grid-cols-[minmax(0,.72fr)_minmax(0,1.28fr)]">
            <label><span className="mb-1.5 block text-xs font-medium text-text-muted">Start date</span><input className="min-h-11 w-full rounded-xl border border-border-soft bg-bg/65 px-3 text-sm focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/20" disabled={props.running} onChange={(event) => props.onScheduleDateChange(event.target.value)} type="date" value={props.scheduleDate} /></label>
            {props.timingMode === 'schedule_time'
              ? <DailyTimeSelector disabled={props.running} onAdd={props.onScheduleTimeAdd} onRemove={props.onScheduleTimeRemove} times={props.scheduleTimes} />
              : <div><span className="mb-1.5 block text-xs font-medium text-text-muted">Saved posting times</span><div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-border-soft bg-bg/40 px-3 py-2">{props.savedScheduleTimes.map((time) => <span className="rounded-lg border border-brand-teal/20 bg-brand-teal/8 px-2.5 py-1 text-xs font-semibold text-brand-cyan" key={time}>{time}</span>)}</div><p className="mt-1.5 text-[10px] leading-4 text-text-soft">Account timezone: {props.timezone.replaceAll('_', ' ')} · <Link className="text-brand-cyan hover:underline" to="/settings">Change saved times</Link></p></div>}
          </div>
        ) : <div className="flex min-h-11 items-end text-xs leading-5 text-text-muted">{props.timingMode === 'publish_now' ? 'Each image or video publishes after Meta accepts the upload.' : 'Choose when this batch should publish.'}</div>}
      </div>

      <div className="mt-4"><CaptionInput captionCount={props.captionCount} mediaCount={props.media.length} onChange={props.onCaptionsChange} onFallbackChange={props.onFallbackChange} useFallback={props.useFallback} value={props.captions} /></div>
      <div className="mt-4"><SessionSummary captionCount={props.captionCount} media={props.media} scheduleTimes={props.scheduleTimes} selectedDestinations={props.selectedDestinations} timingMode={props.timingMode} /></div>

      <label className={`mt-4 flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${props.retainMedia ? 'border-brand-teal/45 bg-brand-teal/8' : 'border-border-soft bg-bg/35'} ${exceedsLibraryLimit ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-brand-teal/30'}`}>
        <input checked={props.retainMedia && !exceedsLibraryLimit} className="mt-0.5 size-4 accent-brand-teal" disabled={props.running || exceedsLibraryLimit || !props.media.length} onChange={(event) => props.onRetainMediaChange(event.target.checked)} type="checkbox" />
        <HardDrive aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-teal" />
        <span><span className="block text-xs font-semibold text-text-main">Save selected media to Media Library for reuse</span><span className="mt-0.5 block text-[11px] leading-4 text-text-muted">Off by default. One deduplicated copy is stored and linked to every resulting post.{exceedsLibraryLimit ? ' Files over 100 MB remain temporary.' : ''}</span></span>
      </label>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button className="sm:w-auto" disabled={props.running || (!props.media.length && !props.captions)} onClick={props.onClear} type="button" variant="ghost"><RotateCcw aria-hidden="true" className="size-4" /> Clear session</Button>
        <Button className="flex-1" disabled={!props.canStart || props.running} onClick={props.onStart} type="button" variant="primary"><Play aria-hidden="true" className="size-4 fill-current" /> Start Upload</Button>
      </div>
      {!props.canStart && <p className="mt-2 text-center text-xs text-text-soft">{props.disabledReason}</p>}
    </section>
  )
}
