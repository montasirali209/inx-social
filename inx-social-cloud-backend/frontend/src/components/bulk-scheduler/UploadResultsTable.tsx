import { Film, Image as ImageIcon } from 'lucide-react'
import type { Destination, UploadResult } from '../../types/bulk-scheduler'
import { PlatformMark } from './PlatformMark'
import { StatusBadge } from './StatusBadge'

function ResultDestinations({ ids, destinations }: { ids: string[]; destinations: Destination[] }) {
  const selected = ids.map((id) => destinations.find((destination) => destination.id === id)).filter(Boolean) as Destination[]
  return <span className="flex items-center gap-1">{selected.slice(0, 5).map((destination) => <PlatformMark key={destination.id} platform={destination.platform} size="sm" />)}{selected.length > 5 && <span className="rounded-full bg-white/7 px-2 py-1 text-[10px] text-text-muted">+{selected.length - 5}</span>}</span>
}

export function UploadResultsTable({ results, destinations }: { results: UploadResult[]; destinations: Destination[] }) {
  if (!results.length) return <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-border-soft bg-black/10 text-center"><span><Film aria-hidden="true" className="mx-auto size-6 text-brand-cyan" /><strong className="mt-2 block text-sm">No upload results yet</strong><small className="mt-1 block text-text-soft">Completed and failed publishing actions will appear here live.</small></span></div>
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border-soft lg:block">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-white/[0.035] text-[10px] uppercase tracking-[0.09em] text-text-soft"><tr><th className="px-3 py-2.5">Media</th><th className="px-3 py-2.5">Destination</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Result / Error</th></tr></thead>
          <tbody className="divide-y divide-white/6">
            {results.slice(0, 12).map((result) => <tr className="bg-black/8 transition hover:bg-brand-blue/5" key={result.id}><td className="px-3 py-2.5"><span className="flex min-w-0 items-center gap-2">{result.mediaKind === 'image' ? <img alt="" className="size-10 rounded-md bg-black object-cover" src={result.thumbnailUrl} /> : <video aria-hidden="true" className="size-10 rounded-md bg-black object-cover" muted src={result.thumbnailUrl} />}<span className="min-w-0"><strong className="block max-w-48 truncate">{result.fileName}</strong><small className="inline-flex items-center gap-1 text-[9px] capitalize text-text-soft">{result.mediaKind === 'image' ? <ImageIcon aria-hidden="true" className="size-3" /> : <Film aria-hidden="true" className="size-3" />}{result.mediaKind}</small></span></span></td><td className="px-3 py-2.5"><ResultDestinations destinations={destinations} ids={result.destinationIds} /></td><td className="px-3 py-2.5"><StatusBadge status={result.status} /></td><td className="max-w-56 px-3 py-2.5 text-text-muted"><span className="line-clamp-2">{result.errorMessage || result.resultId || (result.status === 'uploading' ? 'Meta is processing this media.' : 'Awaiting upload')}</span></td></tr>)}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 lg:hidden">{results.slice(0, 12).map((result) => <article className="rounded-xl border border-border-soft bg-black/12 p-3" key={result.id}><div className="flex items-start gap-3">{result.mediaKind === 'image' ? <img alt="" className="size-14 rounded-lg bg-black object-cover" src={result.thumbnailUrl} /> : <video aria-hidden="true" className="size-14 rounded-lg bg-black object-cover" muted src={result.thumbnailUrl} />}<div className="min-w-0 flex-1"><strong className="block truncate text-sm">{result.fileName}</strong><small className="capitalize text-text-soft">{result.mediaKind}</small><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><ResultDestinations destinations={destinations} ids={result.destinationIds} /><StatusBadge status={result.status} /></div></div></div>{(result.errorMessage || result.resultId) && <p className="mt-2 text-xs leading-5 text-text-muted">{result.errorMessage || result.resultId}</p>}</article>)}</div>
    </>
  )
}
