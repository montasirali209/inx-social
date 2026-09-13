import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Check, Clapperboard, Film, LoaderCircle } from 'lucide-react'
import { getGenerationStatus, getVideoProductions } from '../../lib/ai-content-studio-api'
import type { GeneratedAsset, GenerationHistoryItem } from '../../types/ai-content-studio'
import { videoProductionKind } from './video-production-utils'

export function VideoProductionRail({ currentJobId, onOpen }: {
  currentJobId?: string
  onOpen: (item: GenerationHistoryItem, asset: GeneratedAsset | null) => void
}) {
  const query = useQuery({
    queryKey: ['video-productions'],
    queryFn: () => getVideoProductions(10),
    refetchInterval: (state) => state.state.data?.some((item) => ['preparing', 'generating', 'processing'].includes(item.status)) ? 3000 : 15_000,
    staleTime: 2000,
  })
  const items = query.data || []

  async function open(item: GenerationHistoryItem) {
    if (item.status === 'completed') {
      const job = await getGenerationStatus(item.id)
      onOpen(item, job.asset || null)
      return
    }
    onOpen(item, null)
  }

  return <aside className="rounded-[22px] border border-border-soft bg-black/15 p-3 xl:w-[190px] xl:shrink-0">
    <div className="flex items-center justify-between gap-2"><div><span className="text-[7px] font-bold uppercase tracking-[.15em] text-brand-cyan">Media preparing</span><h3 className="mt-1 text-[10px] font-bold text-white">Your video queue</h3></div>{query.isFetching ? <LoaderCircle className="size-3 animate-spin text-brand-cyan"/> : <Clapperboard className="size-3.5 text-text-soft"/>}</div>
    <p className="mt-1 text-[8px] leading-3.5 text-text-soft">Renders continue safely when this window is closed.</p>
    <div className="scrollbar-thin mt-3 flex max-h-[520px] gap-2 overflow-x-auto pb-1 xl:flex-col xl:overflow-x-hidden xl:overflow-y-auto">
      {items.map((item) => {
        const kind = videoProductionKind(item)
        const busy = ['preparing', 'generating', 'processing'].includes(item.status)
        const failed = item.status === 'failed' || item.status === 'cancelled'
        return <button type="button" onClick={() => void open(item)} className={`group min-w-[168px] rounded-2xl border p-2.5 text-left transition duration-300 hover:-translate-y-0.5 hover:border-brand-cyan/30 ${currentJobId === item.id ? 'border-brand-cyan/45 bg-brand-cyan/[.07]' : 'border-white/7 bg-white/[.025]'}`} key={item.id}>
          <span className="flex items-center justify-between gap-2"><span className={`grid size-7 place-items-center rounded-lg ${kind === 'stock' ? 'bg-brand-green/10 text-brand-green' : 'bg-violet-400/10 text-violet-300'}`}>{kind === 'stock' ? <Clapperboard className="size-3.5"/> : <Film className="size-3.5"/>}</span>{busy ? <LoaderCircle className="size-3.5 animate-spin text-brand-cyan"/> : failed ? <AlertTriangle className="size-3.5 text-red-300"/> : <Check className="size-3.5 text-brand-green"/>}</span>
          <strong className="mt-2 block line-clamp-2 text-[9px] leading-3.5 text-white">{item.prompt || (kind === 'stock' ? 'Stock video' : 'AI video')}</strong>
          <span className="mt-1 block text-[7px] font-semibold uppercase tracking-wide text-text-soft">{kind === 'stock' ? 'Stock' : 'AI generated'} · {busy ? `${Math.max(1, Number(item.progress || 0))}%` : item.status}</span>
          {busy ? <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/5"><span className="block h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-green transition-all" style={{ width: `${Math.max(3, Number(item.progress || 0))}%` }}/></span> : null}
        </button>
      })}
      {!query.isLoading && !items.length ? <div className="min-w-[168px] rounded-2xl border border-dashed border-white/10 p-4 text-center text-[8px] leading-4 text-text-soft">Your pending and finished videos will appear here.</div> : null}
    </div>
  </aside>
}
