import { FileText, Play, RotateCcw, UploadCloud, Video } from 'lucide-react'
import { useRef } from 'react'
import type { SelectedVideo, TimingMode } from '../../types/bulk-scheduler'
import { Button } from '../ui/Button'
import { CaptionInput } from './CaptionInput'
import { SessionSummary } from './SessionSummary'
import { TimingModeSelect } from './TimingModeSelect'

type Props = {
  videos: SelectedVideo[]
  captions: string
  captionCount: number
  timingMode: TimingMode | ''
  scheduleDate: string
  scheduleTime: string
  selectedDestinations: number
  useFallback: boolean
  canStart: boolean
  disabledReason: string
  running: boolean
  onVideos: (files: File[]) => void
  onCaptionFile: (file: File) => void
  onCaptionsChange: (value: string) => void
  onTimingModeChange: (value: TimingMode) => void
  onScheduleDateChange: (value: string) => void
  onScheduleTimeChange: (value: string) => void
  onFallbackChange: (value: boolean) => void
  onClear: () => void
  onStart: () => void
}

export function UploadBatchPanel(props: Props) {
  const videoInput = useRef<HTMLInputElement>(null)
  const captionInput = useRef<HTMLInputElement>(null)
  const needsDate = props.timingMode === 'schedule_time' || props.timingMode === 'spread_across_days'
  return (
    <section aria-labelledby="upload-batch-title" className="interactive-surface rounded-panel border p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/8 text-brand-cyan"><UploadCloud aria-hidden="true" className="size-5" /></span>
          <div><h2 className="text-base font-semibold" id="upload-batch-title">Upload video batch</h2><p className="mt-0.5 text-xs leading-5 text-text-muted">Add local videos and captions, then choose how they should publish.</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={props.running} onClick={() => videoInput.current?.click()} type="button"><Video aria-hidden="true" className="size-4" /> Select videos</Button>
          <Button disabled={props.running} onClick={() => captionInput.current?.click()} type="button" variant="ghost"><FileText aria-hidden="true" className="size-4" /> Caption file</Button>
          <input accept="video/mp4,video/quicktime,video/x-m4v,video/webm,.avi,.mkv" className="sr-only" multiple onChange={(event) => props.onVideos(Array.from(event.target.files || []))} ref={videoInput} type="file" />
          <input accept=".txt,text/plain" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onCaptionFile(file) }} ref={captionInput} type="file" />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <TimingModeSelect onChange={props.onTimingModeChange} value={props.timingMode} />
        {needsDate ? (
          <div className="grid grid-cols-2 gap-2">
            <label><span className="mb-1.5 block text-xs font-medium text-text-muted">Start date</span><input className="min-h-11 w-full rounded-xl border border-border-soft bg-bg/65 px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20" onChange={(event) => props.onScheduleDateChange(event.target.value)} type="date" value={props.scheduleDate} /></label>
            <label><span className="mb-1.5 block text-xs font-medium text-text-muted">Start time</span><input className="min-h-11 w-full rounded-xl border border-border-soft bg-bg/65 px-3 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20" onChange={(event) => props.onScheduleTimeChange(event.target.value)} type="time" value={props.scheduleTime} /></label>
          </div>
        ) : <div className="flex min-h-11 items-end text-xs leading-5 text-text-muted">{props.timingMode === 'publish_now' ? 'Videos publish after each upload is accepted and verified by Meta.' : props.timingMode === 'next_available_slots' ? 'The browser finds the next free 30-minute slots across the selected Pages.' : 'Choose a timing mode to continue.'}</div>}
      </div>

      <div className="mt-4"><CaptionInput captionCount={props.captionCount} onChange={props.onCaptionsChange} onFallbackChange={props.onFallbackChange} useFallback={props.useFallback} value={props.captions} videoCount={props.videos.length} /></div>
      <div className="mt-4"><SessionSummary captionCount={props.captionCount} selectedDestinations={props.selectedDestinations} timingMode={props.timingMode} videos={props.videos} /></div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button className="sm:w-auto" disabled={props.running || (!props.videos.length && !props.captions)} onClick={props.onClear} type="button" variant="ghost"><RotateCcw aria-hidden="true" className="size-4" /> Clear session</Button>
        <Button className="flex-1" disabled={!props.canStart || props.running} onClick={props.onStart} type="button" variant="primary"><Play aria-hidden="true" className="size-4 fill-current" /> Start Upload</Button>
      </div>
      {!props.canStart && <p className="mt-2 text-center text-xs text-text-soft">{props.disabledReason}</p>}
    </section>
  )
}
