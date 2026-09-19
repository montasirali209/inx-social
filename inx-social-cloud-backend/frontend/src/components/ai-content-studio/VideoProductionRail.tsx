import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Clapperboard, Film, LoaderCircle, Play, Trash2 } from 'lucide-react'
import { dismissGeneration, getGenerationStatus, getVideoProductions } from '../../lib/ai-content-studio-api'
import type { GeneratedAsset, GenerationHistoryItem } from '../../types/ai-content-studio'
import { videoProductionKind, type VideoProductionKind } from './video-production-utils'

function formatGeneratedDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function previewTitle(item: GenerationHistoryItem) {
  const prompt = String(item.prompt || '').trim()
  if (!prompt) return videoProductionKind(item) === 'stock' ? 'Stock video' : 'AI generated video'
  return prompt.length > 58 ? `${prompt.slice(0, 58).trim()}…` : prompt
}

export function VideoProductionRail({ currentJobId, kind, onOpen }: {
  currentJobId?: string
  kind?: VideoProductionKind
  onOpen: (item: GenerationHistoryItem, asset: GeneratedAsset | null) => void
}) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['video-productions'],
    queryFn: () => getVideoProductions(36),
    refetchInterval: currentJobId ? 8_000 : 30_000,
    staleTime: 5_000,
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

  const items = (query.data || [])
    .filter((item) => item.status === 'completed')
    .filter((item) => !kind || videoProductionKind(item) === kind)
    .slice(0, 12)

  async function open(item: GenerationHistoryItem) {
    const job = await getGenerationStatus(item.id)
    onOpen({ ...item, error: job.error }, job.asset || null)
  }

  const label = kind === 'stock' ? 'Stock videos' : kind === 'generative' ? 'AI videos' : 'Videos'
  const description = kind === 'stock'
    ? 'Completed videos made in Stock Video Creator. Select one to preview and play it here.'
    : kind === 'generative'
      ? 'Completed videos made in AI Video Studio. Select one to preview and play it here.'
      : 'Completed videos from this workspace. Select one to preview.'

  return <aside className="flex min-w-0 flex-col overflow-hidden rounded-[24px] border border-border-soft bg-[linear-gradient(180deg,rgba(5,22,32,.96),rgba(3,13,21,.96))] p-3 shadow-[inset_0_1px_rgba(255,255,255,.025)] 2xl:w-[250px] 2xl:shrink-0">
    <div className="flex items-start justify-between gap-3 border-b border-white/[.06] pb-3">
      <div className="min-w-0">
        <span className="text-[7px] font-bold uppercase tracking-[.16em] text-brand-cyan">Generated media</span>
        <h3 className="mt-1 text-[11px] font-bold text-white">Your Generated Videos</h3>
      </div>
      <span className="shrink-0 rounded-full border border-brand-cyan/20 bg-brand-cyan/[.07] px-2 py-1 text-[8px] font-semibold text-brand-cyan">{items.length}</span>
    </div>
    <p className="mt-2 text-[8px] leading-4 text-text-soft">{description}</p>

    <div className="scrollbar-thin mt-3 flex min-h-0 flex-1 gap-2 overflow-x-auto pb-1 2xl:max-h-[560px] 2xl:flex-col 2xl:overflow-x-hidden 2xl:overflow-y-auto 2xl:pr-1">
      {query.isLoading ? Array.from({ length: 4 }, (_, index) => <div aria-hidden="true" className="min-w-[205px] overflow-hidden rounded-2xl border border-white/[.06] bg-white/[.02] p-2 2xl:min-w-0" key={index}>
        <div className="flex gap-2.5">
          <span className="h-16 w-20 shrink-0 animate-pulse rounded-xl bg-white/[.05] motion-reduce:animate-none" />
          <span className="min-w-0 flex-1 pt-1"><i className="block h-2.5 w-4/5 animate-pulse rounded bg-white/[.06] motion-reduce:animate-none" /><i className="mt-2 block h-2 w-2/3 animate-pulse rounded bg-white/[.04] motion-reduce:animate-none" /><i className="mt-2 block h-2 w-1/2 animate-pulse rounded bg-white/[.04] motion-reduce:animate-none" /></span>
        </div>
      </div>) : null}

      {items.map((item) => {
        const itemKind = videoProductionKind(item)
        const removing = dismiss.isPending && dismiss.variables === item.id
        const selected = currentJobId === item.id
        const thumbnail = item.thumbnailUrl || ''
        return <article className={`group relative min-w-[220px] overflow-hidden rounded-2xl border transition duration-300 2xl:min-w-0 ${selected ? 'border-brand-cyan/50 bg-brand-cyan/[.075] shadow-[0_10px_34px_rgba(0,214,192,.08)]' : 'border-white/[.07] bg-white/[.022] hover:border-brand-cyan/30 hover:bg-white/[.035]'}`} key={item.id}>
          <button className="flex w-full gap-2.5 p-2 text-left focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={() => void open(item)} type="button">
            <span className="relative h-[68px] w-[78px] shrink-0 overflow-hidden rounded-xl border border-white/[.07] bg-[radial-gradient(circle_at_40%_20%,rgba(45,212,191,.13),transparent_48%),#07131d]">
              {thumbnail ? <img alt="" className="h-full w-full object-cover" loading="lazy" src={thumbnail} /> : <span className="grid h-full w-full place-items-center">{itemKind === 'stock' ? <Clapperboard className="size-5 text-brand-green/75" /> : <Film className="size-5 text-violet-300/75" />}</span>}
              <span className="absolute inset-0 grid place-items-center bg-black/10 opacity-0 transition group-hover:opacity-100"><span className="grid size-7 place-items-center rounded-full border border-white/40 bg-black/55 text-white"><Play className="ml-0.5 size-3 fill-current" /></span></span>
            </span>
            <span className="min-w-0 flex-1 py-0.5 pr-5">
              <strong className="block line-clamp-2 text-[9px] leading-3.5 text-white">{previewTitle(item)}</strong>
              <span className="mt-1.5 flex items-center gap-1.5 text-[7px] font-semibold uppercase tracking-wide text-text-soft">
                <span className={`size-1.5 rounded-full ${itemKind === 'stock' ? 'bg-brand-green' : 'bg-violet-300'}`} />
                {itemKind === 'stock' ? 'Stock video' : 'AI video'}
              </span>
              <span className="mt-1 block truncate text-[7px] text-text-soft">{formatGeneratedDate(item.completedAt || item.createdAt)}</span>
            </span>
          </button>
          <span className="pointer-events-none absolute bottom-2 left-[66px] grid size-5 place-items-center rounded-full border border-brand-green/25 bg-[#06141d]/95 text-brand-green"><Check className="size-3" /></span>
          <button aria-label="Remove generated video from history" className="absolute right-2 top-2 grid size-6 place-items-center rounded-lg border border-white/[.07] bg-[#07131d]/90 text-text-soft opacity-60 transition hover:border-red-400/30 hover:text-red-300 group-hover:opacity-100" disabled={removing} onClick={(event) => { event.stopPropagation(); dismiss.mutate(item.id) }} title="Remove from generated videos" type="button">
            {removing ? <LoaderCircle className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
          </button>
        </article>
      })}

      {!query.isLoading && !items.length ? <div className="min-w-[220px] rounded-2xl border border-dashed border-white/10 p-5 text-center 2xl:min-w-0">
        <span className="mx-auto grid size-9 place-items-center rounded-xl border border-brand-cyan/15 bg-brand-cyan/[.05] text-brand-cyan">{kind === 'stock' ? <Clapperboard className="size-4" /> : <Film className="size-4" />}</span>
        <strong className="mt-3 block text-[9px] text-white">No completed {label.toLowerCase()} yet</strong>
        <p className="mt-1 text-[8px] leading-4 text-text-soft">Finished videos created here will appear in this panel for quick preview.</p>
      </div> : null}
    </div>

    <button className="mt-3 min-h-9 rounded-xl border border-brand-cyan/20 bg-brand-cyan/[.04] px-3 text-[8px] font-semibold text-brand-cyan transition hover:border-brand-cyan/40 hover:bg-brand-cyan/[.07]" onClick={() => { window.location.href = '/app/media-library' }} type="button">View in Media Library</button>
  </aside>
}
