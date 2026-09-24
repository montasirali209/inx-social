import { AlertTriangle, CheckCircle2, FileText } from 'lucide-react'
import type { BulkContentMode } from '../../types/bulk-scheduler'

type Props = {
  value: string
  onChange: (value: string) => void
  captionCount: number
  mediaCount: number
  useFallback: boolean
  onFallbackChange: (value: boolean) => void
  contentMode: BulkContentMode
}

export function CaptionInput({ value, onChange, captionCount, mediaCount, useFallback, onFallbackChange, contentMode }: Props) {
  const textMode = contentMode === 'text'
  const short = !textMode && mediaCount > 0 && captionCount < mediaCount
  const extra = !textMode && mediaCount > 0 && captionCount > mediaCount
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <label className="font-medium text-text-muted" htmlFor="bulk-captions">{textMode ? 'Posts' : 'Captions'}</label>
        <span className="text-text-soft">{captionCount} {textMode ? `post${captionCount === 1 ? '' : 's'}` : 'loaded'}</span>
      </div>
      <textarea
        className="min-h-40 w-full resize-y rounded-xl border border-border-soft bg-bg/65 p-3 text-sm leading-6 text-text-main placeholder:text-text-soft focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
        id="bulk-captions"
        onChange={(event) => onChange(event.target.value)}
        placeholder={textMode
          ? 'Write or paste the first complete post here.\n\n\nLeave two empty lines, then start the next post…'
          : 'Write or paste the first complete caption here.\n\n\nLeave two empty lines, then start the next caption…'}
        value={value}
      />
      {textMode ? (
        <div className="mt-2 rounded-xl border border-brand-cyan/20 bg-brand-cyan/[.045] p-3 text-xs leading-5 text-text-muted">
          <p className="flex items-start gap-2"><FileText aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-cyan" /><span><strong className="text-text-main">One complete post per block.</strong> Leave <strong className="text-text-main">two empty lines</strong> between posts. A single blank line stays inside the same post, so paragraphs, hashtags, links and emojis are preserved. Existing <code className="rounded bg-black/25 px-1.5 py-0.5 text-brand-cyan">---</code> or <code className="rounded bg-black/25 px-1.5 py-0.5 text-brand-cyan">--</code> separator lines still work.</span></p>
        </div>
      ) : (
        <>
          <div className="mt-2 rounded-xl border border-brand-cyan/20 bg-brand-cyan/[.045] p-3 text-xs leading-5 text-text-muted">
            <p className="flex items-start gap-2"><FileText aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-cyan" /><span><strong className="text-text-main">One complete caption per block.</strong> Leave <strong className="text-text-main">two empty lines</strong> between captions. Normal line breaks and a single blank line stay inside the same caption.</span></p>
          </div>
          {short && (
            <div className="mt-2 rounded-xl border border-brand-amber/25 bg-brand-amber/8 p-3 text-xs text-brand-amber">
              <p className="flex items-start gap-2"><AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {mediaCount - captionCount} file{mediaCount - captionCount === 1 ? '' : 's'} need a caption.</p>
              {captionCount > 0 && <label className="mt-2 flex cursor-pointer items-start gap-2 text-text-muted"><input checked={useFallback} className="mt-0.5 accent-brand-blue" onChange={(event) => onFallbackChange(event.target.checked)} type="checkbox" /> Use the final loaded caption as fallback for unmatched files.</label>}
            </div>
          )}
          {extra && <p className="mt-2 flex items-center gap-2 text-xs text-brand-amber"><AlertTriangle aria-hidden="true" className="size-4" /> {captionCount - mediaCount} extra caption{captionCount - mediaCount === 1 ? '' : 's'} will remain unused.</p>}
          {!short && mediaCount > 0 && captionCount > 0 && <p className="mt-2 flex items-center gap-2 text-xs text-brand-green"><CheckCircle2 aria-hidden="true" className="size-4" /> Every media file has a caption.</p>}
        </>
      )}
    </div>
  )
}
