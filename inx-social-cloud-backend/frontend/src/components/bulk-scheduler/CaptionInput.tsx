import { AlertTriangle, CheckCircle2 } from 'lucide-react'

type Props = {
  value: string
  onChange: (value: string) => void
  captionCount: number
  mediaCount: number
  useFallback: boolean
  onFallbackChange: (value: boolean) => void
}

export function CaptionInput({ value, onChange, captionCount, mediaCount, useFallback, onFallbackChange }: Props) {
  const short = mediaCount > 0 && captionCount < mediaCount
  const extra = mediaCount > 0 && captionCount > mediaCount
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <label className="font-medium text-text-muted" htmlFor="bulk-captions">Captions</label>
        <span className="text-text-soft">{captionCount} loaded</span>
      </div>
      <textarea className="min-h-32 w-full resize-y rounded-xl border border-border-soft bg-bg/65 p-3 text-sm leading-6 text-text-main placeholder:text-text-soft focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20" id="bulk-captions" onChange={(event) => onChange(event.target.value)} placeholder="One caption per line or blank-line separated captions…" value={value} />
      {short && (
        <div className="mt-2 rounded-xl border border-brand-amber/25 bg-brand-amber/8 p-3 text-xs text-brand-amber">
          <p className="flex items-start gap-2"><AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {mediaCount - captionCount} file{mediaCount - captionCount === 1 ? '' : 's'} need a caption.</p>
          {captionCount > 0 && <label className="mt-2 flex cursor-pointer items-start gap-2 text-text-muted"><input checked={useFallback} className="mt-0.5 accent-brand-blue" onChange={(event) => onFallbackChange(event.target.checked)} type="checkbox" /> Use the final loaded caption as fallback for unmatched files.</label>}
        </div>
      )}
      {extra && <p className="mt-2 flex items-center gap-2 text-xs text-brand-amber"><AlertTriangle aria-hidden="true" className="size-4" /> {captionCount - mediaCount} extra caption{captionCount - mediaCount === 1 ? '' : 's'} will remain unused.</p>}
      {!short && mediaCount > 0 && captionCount > 0 && <p className="mt-2 flex items-center gap-2 text-xs text-brand-green"><CheckCircle2 aria-hidden="true" className="size-4" /> Every media file has a caption.</p>}
    </div>
  )
}
