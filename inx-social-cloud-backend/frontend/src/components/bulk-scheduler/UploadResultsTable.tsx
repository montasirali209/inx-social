import { ChevronLeft, ChevronRight, FileText, Film, Image as ImageIcon, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Destination, UploadResult } from '../../types/bulk-scheduler'
import { Button } from '../ui/Button'
import { PlatformMark } from './PlatformMark'
import { StatusBadge } from './StatusBadge'

const PAGE_SIZE = 12

type ResultFilter = 'all' | 'scheduled' | 'published' | 'processing' | 'review'

function ResultDestinations({ ids, destinations }: { ids: string[]; destinations: Destination[] }) {
  const selected = ids.map((id) => destinations.find((destination) => destination.id === id)).filter(Boolean) as Destination[]
  return <span className="flex items-center gap-1">{selected.slice(0, 5).map((destination) => <PlatformMark key={destination.id} platform={destination.platform} size="sm" />)}{selected.length > 5 && <span className="rounded-full bg-white/7 px-2 py-1 text-[10px] text-text-muted">+{selected.length - 5}</span>}</span>
}

function matchesFilter(result: UploadResult, filter: ResultFilter) {
  if (filter === 'all') return true
  if (filter === 'scheduled') return result.status === 'scheduled'
  if (filter === 'published') return result.status === 'published'
  if (filter === 'processing') return result.status === 'uploading' || result.status === 'waiting'
  return result.status === 'failed' || result.status === 'blocked'
}

function formattedScheduledAt(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZoneName: 'short',
  }).format(new Date(value))
}

export function UploadResultsTable({
  results,
  destinations,
  retryingId,
  onRetry,
}: {
  results: UploadResult[]
  destinations: Destination[]
  retryingId: string | null
  onRetry: (result: UploadResult) => void | Promise<void>
}) {
  const [filter, setFilter] = useState<ResultFilter>('all')
  const [page, setPage] = useState(1)
  const filtered = useMemo(() => results.filter((result) => matchesFilter(result, filter)), [filter, results])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const counts = {
    all: results.length,
    scheduled: results.filter((result) => result.status === 'scheduled').length,
    published: results.filter((result) => result.status === 'published').length,
    processing: results.filter((result) => result.status === 'uploading' || result.status === 'waiting').length,
    review: results.filter((result) => result.status === 'failed' || result.status === 'blocked').length,
  }


  if (!results.length) return <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-border-soft bg-black/10 text-center"><span><Film aria-hidden="true" className="mx-auto size-6 text-brand-cyan" /><strong className="mt-2 block text-sm">No batch results yet</strong><small className="mt-1 block text-text-soft">Completed and failed publishing actions will appear here live.</small></span></div>

  const filters: Array<{ id: ResultFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'scheduled', label: 'Scheduled', count: counts.scheduled },
    { id: 'published', label: 'Published', count: counts.published },
    { id: 'processing', label: 'Processing', count: counts.processing },
    { id: 'review', label: 'Needs review', count: counts.review },
  ]

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {filters.map((item) => (
          <button
            className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition ${filter === item.id ? 'border-brand-cyan/35 bg-brand-cyan/10 text-brand-cyan' : 'border-border-soft bg-black/10 text-text-muted hover:border-brand-cyan/20 hover:text-white'}`}
            key={item.id}
            onClick={() => { setFilter(item.id); setPage(1) }}
            type="button"
          >
            {item.label} <span className="ml-1 opacity-70">{item.count}</span>
          </button>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border-soft lg:block">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-white/[0.035] text-[10px] uppercase tracking-[0.09em] text-text-soft"><tr><th className="px-3 py-2.5">Content</th><th className="px-3 py-2.5">Destination</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Result / Error</th><th className="px-3 py-2.5">Action</th></tr></thead>
          <tbody className="divide-y divide-white/6">
            {visible.map((result) => {
              const canRetry = result.status === 'failed' && Boolean(result.jobId)
              const scheduledAt = formattedScheduledAt(result.scheduledAt)
              return (
                <tr className="bg-black/8 transition hover:bg-brand-blue/5" key={result.id}>
                  <td className="px-3 py-2.5"><span className="flex min-w-0 items-center gap-2">{result.mediaKind === 'image' ? <img alt="" className="size-10 rounded-md bg-black object-cover" src={result.thumbnailUrl} /> : result.mediaKind === 'video' ? <video aria-hidden="true" className="size-10 rounded-md bg-black object-cover" muted src={result.thumbnailUrl} /> : <span className="grid size-10 shrink-0 place-items-center rounded-md border border-brand-cyan/20 bg-brand-cyan/[.06] text-brand-cyan"><FileText className="size-4" /></span>}<span className="min-w-0"><strong className="block max-w-48 truncate">{result.fileName}</strong>{result.textPreview && <small className="block max-w-56 truncate text-[9px] text-text-muted">{result.textPreview}</small>}<small className="inline-flex items-center gap-1 text-[9px] capitalize text-text-soft">{result.mediaKind === 'image' ? <ImageIcon aria-hidden="true" className="size-3" /> : result.mediaKind === 'video' ? <Film aria-hidden="true" className="size-3" /> : <FileText aria-hidden="true" className="size-3" />}{result.mediaKind === 'text' ? 'text post' : result.mediaKind}{scheduledAt ? ` · ${scheduledAt}` : ''}</small></span></span></td>
                  <td className="px-3 py-2.5"><ResultDestinations destinations={destinations} ids={result.destinationIds} /></td>
                  <td className="px-3 py-2.5"><StatusBadge status={result.status} /></td>
                  <td className="max-w-64 px-3 py-2.5 text-text-muted"><span className={`line-clamp-3 ${result.errorMessage ? 'text-brand-red' : ''}`}>{result.errorMessage || result.resultId || (result.status === 'uploading' ? (result.mediaKind === 'text' ? 'Provider is processing this post.' : 'Provider is processing this media.') : result.mediaKind === 'text' ? 'Awaiting publishing' : 'Awaiting upload')}</span></td>
                  <td className="px-3 py-2.5">
                    {canRetry ? (
                      <Button disabled={Boolean(retryingId)} onClick={() => void onRetry(result)} size="sm" type="button" variant="ghost">
                        <RefreshCw className={`size-3.5 ${retryingId === result.id ? 'animate-spin motion-reduce:animate-none' : ''}`} />
                        {result.mediaKind === 'text' ? 'Retry post' : 'Retry upload'}
                      </Button>
                    ) : result.status === 'failed' ? <span className="text-[10px] text-text-soft">Adjust setup</span> : <span className="text-[10px] text-text-soft">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-2 lg:hidden">
        {visible.map((result) => {
          const canRetry = result.status === 'failed' && Boolean(result.jobId)
          return (
            <article className="rounded-xl border border-border-soft bg-black/12 p-3" key={result.id}>
              <div className="flex items-start gap-3">{result.mediaKind === 'image' ? <img alt="" className="size-14 rounded-lg bg-black object-cover" src={result.thumbnailUrl} /> : result.mediaKind === 'video' ? <video aria-hidden="true" className="size-14 rounded-lg bg-black object-cover" muted src={result.thumbnailUrl} /> : <span className="grid size-14 shrink-0 place-items-center rounded-lg border border-brand-cyan/20 bg-brand-cyan/[.06] text-brand-cyan"><FileText className="size-5" /></span>}<div className="min-w-0 flex-1"><strong className="block truncate text-sm">{result.fileName}</strong>{result.textPreview && <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-muted">{result.textPreview}</p>}<small className="capitalize text-text-soft">{result.mediaKind === 'text' ? 'text post' : result.mediaKind}{result.scheduledAt ? ` · ${formattedScheduledAt(result.scheduledAt)}` : ''}</small><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><ResultDestinations destinations={destinations} ids={result.destinationIds} /><StatusBadge status={result.status} /></div></div></div>
              {(result.errorMessage || result.resultId) && <p className={`mt-2 text-xs leading-5 ${result.errorMessage ? 'text-brand-red' : 'text-text-muted'}`}>{result.errorMessage || result.resultId}</p>}
              {canRetry && <Button className="mt-2" disabled={Boolean(retryingId)} onClick={() => void onRetry(result)} size="sm" type="button" variant="ghost"><RefreshCw className={`size-3.5 ${retryingId === result.id ? 'animate-spin motion-reduce:animate-none' : ''}`} />{result.mediaKind === 'text' ? 'Retry post' : 'Retry upload'}</Button>}
            </article>
          )
        })}
      </div>

      {!visible.length && <div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-border-soft bg-black/10 text-xs text-text-muted">No results in this filter.</div>}

      {pages > 1 && (
        <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-text-muted">
          <span>Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button aria-label="Previous results page" className="grid size-8 place-items-center rounded-lg border border-border-soft hover:border-brand-cyan/25 hover:text-white disabled:opacity-40" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button"><ChevronLeft className="size-3.5" /></button>
            <span className="px-2">Page {currentPage} / {pages}</span>
            <button aria-label="Next results page" className="grid size-8 place-items-center rounded-lg border border-border-soft hover:border-brand-cyan/25 hover:text-white disabled:opacity-40" disabled={currentPage >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))} type="button"><ChevronRight className="size-3.5" /></button>
          </div>
        </div>
      )}
    </>
  )
}
