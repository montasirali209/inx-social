import { Film, ListChecks } from 'lucide-react'
import type { SelectedVideo, TimingMode } from '../../types/bulk-scheduler'
import { formatFileSize } from '../../lib/bulk-scheduler-utils'

const timingLabels: Record<TimingMode, string> = {
  publish_now: 'Publish now',
  schedule_time: 'Selected time',
  next_available_slots: 'Next slots',
  spread_across_days: 'Across days',
  best_engagement_time: 'Best time',
}

type Props = {
  videos: SelectedVideo[]
  captionCount: number
  timingMode: TimingMode | ''
  selectedDestinations: number
}

export function SessionSummary({ videos, captionCount, timingMode, selectedDestinations }: Props) {
  const actions = videos.length * selectedDestinations
  return (
    <div className="rounded-xl border border-border-soft bg-black/15 p-3">
      <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        <div><strong className="block text-lg">{videos.length}</strong><span className="text-[10px] uppercase tracking-wide text-text-soft">Videos</span></div>
        <div><strong className="block text-lg">{captionCount}</strong><span className="text-[10px] uppercase tracking-wide text-text-soft">Captions</span></div>
        <div><strong className="block truncate text-sm leading-7">{timingMode ? timingLabels[timingMode] : '—'}</strong><span className="text-[10px] uppercase tracking-wide text-text-soft">Timing</span></div>
        <div><strong className="block text-lg">{selectedDestinations}</strong><span className="text-[10px] uppercase tracking-wide text-text-soft">Destinations</span></div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/6 pt-3 text-xs text-text-muted">
        <span className="inline-flex items-center gap-2"><ListChecks aria-hidden="true" className="size-4 text-brand-cyan" /> Estimated publishing actions</span>
        <strong className="text-text-main">{videos.length} × {selectedDestinations} = {actions}</strong>
      </div>
      {videos.length ? (
        <ul aria-label="Selected video preview" className="scrollbar-thin mt-3 flex gap-2 overflow-x-auto">
          {videos.slice(0, 8).map((video) => (
            <li className="flex min-w-44 items-center gap-2 rounded-lg border border-white/7 bg-bg/45 p-2" key={video.id}>
              <video aria-hidden="true" className="size-10 rounded-md bg-black object-cover" muted preload="metadata" src={video.previewUrl} />
              <span className="min-w-0"><strong className="block truncate text-[11px]">{video.file.name}</strong><small className="text-[10px] text-text-soft">{formatFileSize(video.file.size)}</small></span>
            </li>
          ))}
          {videos.length > 8 && <li className="grid min-w-20 place-items-center rounded-lg border border-dashed border-border-soft text-xs text-text-muted">+{videos.length - 8}</li>}
        </ul>
      ) : (
        <div className="mt-3 flex min-h-16 items-center justify-center gap-2 rounded-lg border border-dashed border-border-soft text-xs text-text-soft"><Film aria-hidden="true" className="size-4" /> Upload preview will appear here</div>
      )}
    </div>
  )
}
