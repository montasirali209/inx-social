import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, Clapperboard, Film, LoaderCircle, Trash2 } from 'lucide-react'
import { dismissGeneration, getGenerationStatus, getVideoProductions } from '../../lib/ai-content-studio-api'
import type { GeneratedAsset, GenerationHistoryItem } from '../../types/ai-content-studio'
import { videoProductionKind } from './video-production-utils'

export function VideoProductionRail({ currentJobId, onOpen }: {
  currentJobId?: string
  onOpen: (item: GenerationHistoryItem, asset: GeneratedAsset | null) => void
}) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['video-productions'],
    queryFn: () => getVideoProductions(10),
    refetchInterval: (state) => state.state.data?.some((item) => ['preparing', 'generating', 'processing'].includes(item.status)) ? 3000 : 15_000,
    staleTime: 2000,
  })
  const dismiss = useMutation({
    mutationFn: dismissGeneration,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['video-productions'] })
      const previous = queryClient.getQueryData<GenerationHistoryItem[]>(['video-productions'])
      queryClient.setQueryData<GenerationHistoryItem[]>(['video-productions'], current => (current || []).filter(item => item.id !== id))
      return { previous }
    },
    onError: (_error, _id, context) => queryClient.setQueryData(['video-productions'], context?.previous || []),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['video-productions'] }),
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

  return <aside className="min-w-0 overflow-hidden rounded-[22px] border border-border-soft bg-black/15 p-3 2xl:w-[216px] 2xl:shrink-0">
    <div className="flex items-center justify-between gap-2"><div><span className="text-[7px] font-bold uppercase tracking-[.15em] text-brand-cyan">Media preparing</span><h3 className="mt-1 text-[10px] font-bold text-white">Your video queue</h3></div>{query.isFetching ? <LoaderCircle className="size-3 animate-spin text-brand-cyan"/> : <Clapperboard className="size-3.5 text-text-soft"/>}</div>
    <p className="mt-1 text-[8px] leading-3.5 text-text-soft">Renders continue safely when this window is closed.</p>
    <div className="scrollbar-thin mt-3 flex max-h-[520px] min-w-0 gap-2 overflow-x-auto pb-1 2xl:flex-col 2xl:overflow-x-hidden 2xl:overflow-y-auto 2xl:pr-1">
      {items.map((item) => {
        const kind = videoProductionKind(item)
        const busy = ['preparing', 'generating', 'processing'].includes(item.status)
        const failed = item.status === 'failed' || item.status === 'cancelled'
        const removing = dismiss.isPending && dismiss.variables === item.id
        return <div className={`group relative w-full min-w-[176px] overflow-hidden rounded-2xl border transition duration-300 hover:-translate-y-0.5 hover:border-brand-cyan/30 2xl:min-w-0 ${currentJobId === item.id ? 'border-brand-cyan/45 bg-brand-cyan/[.07]' : 'border-white/7 bg-white/[.025]'}`} key={item.id}>
          <button type="button" onClick={() => void open(item)} className="block w-full min-w-0 p-2.5 pr-9 text-left">
            <span className="flex items-center justify-between gap-2"><span className={`grid size-7 shrink-0 place-items-center rounded-lg ${kind === 'stock' ? 'bg-brand-green/10 text-brand-green' : 'bg-violet-400/10 text-violet-300'}`}>{kind === 'stock' ? <Clapperboard className="size-3.5"/> : <Film className="size-3.5"/>}</span>{busy ? <LoaderCircle className="size-3.5 shrink-0 animate-spin text-brand-cyan"/> : failed ? <AlertTriangle className="size-3.5 shrink-0 text-red-300"/> : <Check className="size-3.5 shrink-0 text-brand-green"/>}</span>
            <strong className="mt-2 block break-words line-clamp-2 text-[9px] leading-3.5 text-white">{item.prompt || (kind === 'stock' ? 'Stock video' : 'AI video')}</strong>
            <span className="mt-1 block truncate text-[7px] font-semibold uppercase tracking-wide text-text-soft">{kind === 'stock' ? 'Stock' : 'AI generated'} · {busy ? `${Math.max(1, Number(item.progress || 0))}%` : item.status}</span>
            {busy ? <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/5"><span className="block h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-green transition-all" style={{ width: `${Math.max(3, Number(item.progress || 0))}%` }}/></span> : null}
          </button>
          <button aria-label="Remove video from queue" className="absolute right-2 top-2 grid size-6 place-items-center rounded-lg border border-white/8 bg-[#07131d]/90 text-text-soft opacity-75 transition hover:border-red-400/30 hover:text-red-300 group-hover:opacity-100" disabled={removing} onClick={(event) => { event.stopPropagation(); dismiss.mutate(item.id) }} title="Remove from queue" type="button">
            {removing ? <LoaderCircle className="size-3 animate-spin"/> : <Trash2 className="size-3"/>}
          </button>
        </div>
      })}
      {!query.isLoading && !items.length ? <div className="min-w-[176px] rounded-2xl border border-dashed border-white/10 p-4 text-center text-[8px] leading-4 text-text-soft 2xl:min-w-0">Your pending and finished videos will appear here.</div> : null}
    </div>
  </aside>
}
