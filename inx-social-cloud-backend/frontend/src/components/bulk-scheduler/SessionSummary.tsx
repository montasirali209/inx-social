import { Film, Image as ImageIcon, ListChecks } from 'lucide-react'
import type { SelectedMedia, TimingMode } from '../../types/bulk-scheduler'
import { formatFileSize } from '../../lib/bulk-scheduler-utils'

const timingLabels: Record<TimingMode, string> = {
  publish_now: 'Immediately',
  schedule_time: 'Custom times',
  saved_schedule: 'Saved times',
}

type Props = {
  media: SelectedMedia[]
  captionCount: number
  timingMode: TimingMode | ''
  selectedDestinations: number
  scheduleTimes: string[]
}

export function SessionSummary({ media, captionCount, timingMode, selectedDestinations, scheduleTimes }: Props) {
  const actions = media.length * selectedDestinations
  const imageCount = media.filter((item) => item.kind === 'image').length
  const videoCount = media.length - imageCount
  return (
    <div className="rounded-xl border border-border-soft bg-black/15 p-3">
      <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        <div><strong className="block text-lg">{media.length}</strong><span className="text-[10px] uppercase tracking-wide text-text-soft">Media files</span></div>
        <div><strong className="block text-lg">{captionCount}</strong><span className="text-[10px] uppercase tracking-wide text-text-soft">Captions</span></div>
        <div><strong className="block truncate text-sm leading-7">{timingMode ? timingLabels[timingMode] : '—'}</strong><span className="text-[10px] uppercase tracking-wide text-text-soft">Timing</span></div>
        <div><strong className="block text-lg">{selectedDestinations}</strong><span className="text-[10px] uppercase tracking-wide text-text-soft">Destinations</span></div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/6 pt-3 text-xs text-text-muted">
        <span className="inline-flex items-center gap-2"><ListChecks aria-hidden="true" className="size-4 text-brand-cyan" /> Estimated publishing actions</span>
        <strong className="text-text-main">{media.length} × {selectedDestinations} = {actions}</strong>
      </div>
      {media.length ? (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-text-soft"><span>{imageCount} image{imageCount === 1 ? '' : 's'}</span><span aria-hidden="true">•</span><span>{videoCount} video{videoCount === 1 ? '' : 's'}</span>{timingMode !== 'publish_now' && <><span aria-hidden="true">•</span><span>{scheduleTimes.length} time{scheduleTimes.length === 1 ? '' : 's'} per day</span></>}</div>
          <ul aria-label="Selected media preview" className="scrollbar-thin mt-3 flex gap-2 overflow-x-auto">
          {media.slice(0, 8).map((item) => (
            <li className="flex min-w-44 items-center gap-2 rounded-lg border border-white/7 bg-bg/45 p-2" key={item.id}>
              {item.kind === 'image'
                ? <img alt="" className="size-10 rounded-md bg-black object-cover" src={item.previewUrl} />
                : <video aria-hidden="true" className="size-10 rounded-md bg-black object-cover" muted preload="metadata" src={item.previewUrl} />}
              <span className="min-w-0"><strong className="block truncate text-[11px]">{item.file.name}</strong><small className="inline-flex items-center gap-1 text-[10px] text-text-soft">{item.kind === 'image' ? <ImageIcon aria-hidden="true" className="size-3" /> : <Film aria-hidden="true" className="size-3" />}{formatFileSize(item.file.size)}</small></span>
            </li>
          ))}
          {media.length > 8 && <li className="grid min-w-20 place-items-center rounded-lg border border-dashed border-border-soft text-xs text-text-muted">+{media.length - 8}</li>}
          </ul>
        </>
      ) : (
        <div className="mt-3 flex min-h-16 items-center justify-center gap-2 rounded-lg border border-dashed border-border-soft text-xs text-text-soft"><Film aria-hidden="true" className="size-4" /> Upload preview will appear here</div>
      )}
    </div>
  )
}
