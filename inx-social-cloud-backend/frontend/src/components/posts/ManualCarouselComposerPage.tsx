import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ImagePlus, Images, LoaderCircle, Trash2, UploadCloud } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { fetchFacebookDashboardAnalytics } from '../../lib/dashboard-api'
import { uploadMediaAsset } from '../../lib/media-library-api'
import { zonedDateTimeToIso } from '../../lib/bulk-scheduler-utils'
import { calculateBestPostTime } from '../../lib/posts-analytics'
import { createCarouselPosts, fetchPostsWorkspace } from '../../lib/posts-api'
import type { MediaAsset } from '../../types/media-library'
import type { BestTimeInsight, PublishProgress, ScheduleMode } from '../../types/posts'
import { Button } from '../ui/Button'
import { PublishConfirmationDialog } from '../ui/PublishConfirmationDialog'
import { DestinationSelector } from './DestinationSelector'
import { PanelHeading, PlatformIcon } from './PostPrimitives'
import { SchedulePanel } from './SchedulePanel'

const DRAFT_KEY = 'inx-social-manual-carousel-draft-v1'

function defaultDate() {
  return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
}

export function ManualCarouselComposerPage({ onStandardPost }: { onStandardPost: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const workspace = useQuery({ queryKey: ['posts-workspace'], queryFn: fetchPostsWorkspace, refetchInterval: 45_000 })
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [mode, setMode] = useState<ScheduleMode>('later')
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('19:30')
  const [campaign, setCampaign] = useState('No campaign')
  const [labels, setLabels] = useState('Carousel')
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [progress, setProgress] = useState<PublishProgress>({ state: 'idle', percent: 0, message: 'Add 2–10 images to build your carousel.' })
  const [confirmationOpen, setConfirmationOpen] = useState(false)

  const selectedPage = workspace.data?.pages.find((page) => selectedIds.includes(page.id)) || null
  const pageAnalytics = useQuery({
    queryKey: ['posts-best-time', selectedPage?.id],
    queryFn: () => fetchFacebookDashboardAnalytics(selectedPage!.id, 90),
    enabled: Boolean(selectedPage),
    retry: 1,
    staleTime: 5 * 60_000,
  })
  const bestTime = useMemo<BestTimeInsight>(() => {
    if (!selectedPage) return { available: false, label: 'Choose a destination', time: null, detail: 'Select a connected Page to personalise the recommendation.' }
    if (pageAnalytics.isError) return { available: false, label: 'Analytics unavailable', time: null, detail: `Live timing data for ${selectedPage.facebookPageName} could not be loaded.` }
    return calculateBestPostTime(pageAnalytics.data)
  }, [pageAnalytics.data, pageAnalytics.isError, selectedPage])

  let scheduledAt: string | null = null
  try {
    scheduledAt = mode === 'later' && date && time ? zonedDateTimeToIso(date, time, workspace.data?.settings.timezone || 'UTC') : null
  } catch {
    scheduledAt = null
  }

  const ready = Boolean(caption.trim() && assets.length >= 2 && assets.length <= 10 && selectedIds.length && (mode !== 'later' || scheduledAt))

  async function addFiles(files: FileList | File[]) {
    const remaining = Math.max(0, 10 - assets.length)
    const selected = Array.from(files).filter((file) => file.type.startsWith('image/')).slice(0, remaining)
    if (!selected.length) {
      setProgress({ state: 'failed', percent: 0, message: remaining ? 'Carousel slides must be image files.' : 'A carousel can contain up to 10 slides.' })
      return
    }
    if (selected.some((file) => file.size > 15 * 1024 * 1024)) {
      setProgress({ state: 'failed', percent: 0, message: 'Each carousel image must be 15 MB or smaller.' })
      return
    }
    setUploading(true)
    setProgress({ state: 'uploading', percent: 0, message: `Uploading ${selected.length} carousel slide${selected.length === 1 ? '' : 's'}…` })
    try {
      const uploaded: MediaAsset[] = []
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index]
        const asset = await uploadMediaAsset(file, null, (percent) => {
          const total = Math.round(((index + percent / 100) / selected.length) * 100)
          setUploadPercent(total)
          setProgress({ state: 'uploading', percent: total, message: `Uploading slide ${index + 1} of ${selected.length}…` })
        })
        if (asset.type !== 'image') throw new Error(`${file.name} is not a supported carousel image.`)
        uploaded.push(asset)
      }
      setAssets((current) => [...current, ...uploaded].slice(0, 10))
      const nextCount = assets.length + uploaded.length
      setProgress({ state: 'completed', percent: 100, message: nextCount >= 2 ? `${nextCount} carousel slides ready. Drag order is represented left to right.` : 'Add at least one more image to complete the carousel.' })
    } catch (error) {
      setProgress({ state: 'failed', percent: 0, message: error instanceof Error ? error.message : 'Carousel images could not be uploaded.' })
    } finally {
      setUploading(false)
      setUploadPercent(0)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function moveSlide(index: number, direction: -1 | 1) {
    setAssets((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function removeSlide(index: number) {
    setAssets((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  function saveDraft() {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, caption, assetIds: assets.map((asset) => asset.id), updatedAt: new Date().toISOString() }))
    setProgress({ state: 'completed', percent: 100, message: 'Carousel draft saved on this browser.' })
  }

  async function publish() {
    if (!ready || (mode === 'later' && !scheduledAt)) {
      setProgress({ state: 'failed', percent: 0, message: 'Add a caption, at least two images, destinations and complete the publishing settings.' })
      return
    }
    setProgress({ state: 'preparing', percent: 15, message: `Preparing ${assets.length} slides for ${selectedIds.length} destination${selectedIds.length === 1 ? '' : 's'}…` })
    try {
      const response = await createCarouselPosts({
        connectedPageIds: selectedIds,
        clientRequestId: `manual-carousel-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        title: title.trim() || null,
        caption: caption.trim(),
        mediaLibraryAssetIds: assets.map((asset) => asset.id),
        scheduledAt,
        publishMode: mode === 'now' ? 'NOW' : 'SCHEDULED',
      })
      const failed = response.failures.length
      const succeeded = Math.max(0, response.jobs.length - failed)
      setProgress({
        state: failed ? 'failed' : 'completed',
        percent: 100,
        message: failed
          ? `${succeeded} destination${succeeded === 1 ? '' : 's'} completed; ${failed} failed.`
          : `${assets.length}-slide carousel ${mode === 'now' ? 'published' : 'scheduled'} successfully.`,
      })
      if (!failed) window.localStorage.removeItem(DRAFT_KEY)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['posts-workspace'] }),
        queryClient.invalidateQueries({ queryKey: ['studio-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['content-calendar'] }),
      ])
    } catch (error) {
      setProgress({ state: 'failed', percent: 0, message: error instanceof Error ? error.message : 'The carousel could not be submitted.' })
    }
  }

  function requestPublish() {
    if (!ready) {
      setProgress({ state: 'failed', percent: 0, message: 'Add a caption, at least two images, destinations and complete the publishing settings.' })
      return
    }
    if (workspace.data?.settings.approvalRequired) return setConfirmationOpen(true)
    void publish()
  }

  if (workspace.isLoading) return <div className="h-[620px] animate-pulse rounded-panel border border-border-soft bg-panel/70" />
  if (workspace.isError || !workspace.data) return <div className="rounded-panel border border-brand-red/25 bg-brand-red/8 p-6"><h2 className="font-semibold">Posts workspace unavailable</h2><p className="mt-2 text-sm text-text-muted">{workspace.error instanceof Error ? workspace.error.message : 'Refresh and try again.'}</p></div>

  return (
    <div className="dashboard-canvas pb-8">
      <DestinationSelector destinations={workspace.data.destinations} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.35fr)_minmax(290px,.72fr)_minmax(320px,.82fr)]">
        <section className="interactive-surface rounded-panel border p-4 xl:p-5">
          <PanelHeading step={1} subtitle="Add your own images, caption and slide order. AI Content Studio is optional and separate." title="Create Your Post" />
          <fieldset>
            <legend className="mb-2 text-[11px] font-semibold text-text-muted">Post type</legend>
            <div className="grid grid-cols-2 gap-2">
              <button className="min-h-[58px] rounded-xl border border-border-soft bg-bg/30 px-3 py-2 text-left text-text-muted transition hover:border-brand-cyan/30 hover:text-white" onClick={onStandardPost} type="button"><span className="block text-xs font-semibold">Text / Media Post</span><span className="mt-0.5 block text-[9px] text-text-soft">Text, image or video.</span></button>
              <button aria-pressed="true" className="min-h-[58px] rounded-xl border border-brand-cyan/60 bg-brand-cyan/12 px-3 py-2 text-left text-brand-cyan" type="button"><span className="block text-xs font-semibold">Carousel Post</span><span className="mt-0.5 block text-[9px] text-text-soft">Upload 2–10 images manually.</span></button>
            </div>
          </fieldset>

          <label className="mt-4 block text-[11px] font-semibold text-text-muted">Post title <span className="font-normal text-text-soft">(optional)</span><input className="mt-2 w-full rounded-xl border border-border-soft bg-bg/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-brand-cyan" maxLength={200} onChange={(event) => setTitle(event.target.value)} placeholder="Give your post a working title…" value={title} /></label>
          <label className="mt-4 block text-[11px] font-semibold text-text-muted">Caption<textarea className="mt-2 min-h-36 w-full resize-y rounded-xl border border-border-soft bg-bg/40 p-3 text-sm leading-6 text-white outline-none transition placeholder:text-text-soft focus:border-brand-cyan" maxLength={5000} onChange={(event) => setCaption(event.target.value)} placeholder="What would you like to share?" value={caption} /></label>
          <div className="-mt-8 flex h-8 justify-end px-3 text-[10px] text-text-soft">{caption.length} / 5,000</div>

          <div className="mt-4 rounded-2xl border border-brand-cyan/20 bg-brand-cyan/[0.03] p-3">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-brand-cyan/10 text-brand-cyan"><Images className="size-4" /></span><div><strong className="block text-xs">Carousel slides</strong><span className="text-[9px] text-text-soft">{assets.length}/10 images · publish order is left to right</span></div></div><Button disabled={uploading || assets.length >= 10} onClick={() => inputRef.current?.click()} size="sm" variant="ghost"><ImagePlus className="size-3.5" />Add images</Button></div>
            <input accept="image/png,image/jpeg,image/webp" className="sr-only" multiple onChange={(event) => event.target.files && void addFiles(event.target.files)} ref={inputRef} type="file" />
            {!assets.length ? <button className="mt-3 grid min-h-36 w-full place-items-center rounded-xl border border-dashed border-brand-cyan/30 bg-bg/20 p-4 text-center transition hover:border-brand-cyan/60" disabled={uploading} onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addFiles(event.dataTransfer.files) }} type="button"><span><UploadCloud className="mx-auto size-7 text-brand-cyan" /><strong className="mt-2 block text-xs">Upload carousel images</strong><span className="mt-1 block text-[10px] text-text-muted">Select 2–10 PNG, JPEG or WebP images</span></span></button> : <div className="scrollbar-thin mt-3 flex gap-2 overflow-x-auto pb-2">{assets.map((asset, index) => <div className="w-32 shrink-0 rounded-xl border border-border-soft bg-bg/30 p-2" key={asset.id}><div className="relative aspect-square overflow-hidden rounded-lg bg-black/30"><img alt={`Carousel slide ${index + 1}`} className="h-full w-full object-cover" src={asset.thumbnailUrl || asset.fileUrl} /><span className="absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[8px] font-bold text-white">{index + 1}</span></div><div className="mt-2 flex items-center justify-between gap-1"><button aria-label={`Move slide ${index + 1} left`} className="rounded-md border border-border-soft p-1 text-text-muted disabled:opacity-30" disabled={index === 0} onClick={() => moveSlide(index, -1)} type="button"><ArrowUp className="size-3 -rotate-90" /></button><button aria-label={`Move slide ${index + 1} right`} className="rounded-md border border-border-soft p-1 text-text-muted disabled:opacity-30" disabled={index === assets.length - 1} onClick={() => moveSlide(index, 1)} type="button"><ArrowDown className="size-3 -rotate-90" /></button><button aria-label={`Remove slide ${index + 1}`} className="rounded-md border border-brand-red/25 p-1 text-brand-red" onClick={() => removeSlide(index)} type="button"><Trash2 className="size-3" /></button></div></div>)}</div>}
            {uploading && <div className="mt-3 flex items-center gap-2 text-[10px] text-brand-cyan"><LoaderCircle className="size-3.5 animate-spin" />Uploading carousel images… {uploadPercent}%</div>}
            <p className="mt-2 text-[9px] leading-4 text-text-soft">Manual carousel posting is available without AI Content Studio. Plus users can also create AI carousels from AI Content Studio and send them here pre-filled.</p>
          </div>
        </section>

        <SchedulePanel bestTime={bestTime} bestTimeLoading={pageAnalytics.isLoading} campaign={campaign} canPublish={mode === 'draft' ? Boolean(title.trim() || caption.trim() || assets.length) : ready} date={date} labels={labels} mode={mode} onDraft={saveDraft} onPublish={requestPublish} progress={progress} setCampaign={setCampaign} setDate={setDate} setLabels={setLabels} setMode={setMode} setTime={setTime} time={time} />

        <section className="interactive-surface rounded-panel border p-4 xl:p-5">
          <PanelHeading step={4} subtitle="Preview the slide sequence before publishing." title="Post Preview" />
          <div className="flex items-center gap-2 border-b border-border-soft pb-2 text-[10px] font-medium text-brand-cyan"><PlatformIcon className="size-[18px] rounded-md shadow-none" platform="facebook" />Facebook carousel</div>
          <article className="mt-3 overflow-hidden rounded-xl border border-border-soft bg-bg/45"><header className="flex items-center gap-3 p-3"><span className="grid size-10 place-items-center rounded-full border border-border-strong bg-panel text-sm font-bold">{selectedPage?.facebookPageName?.trim().slice(0, 1).toUpperCase() || 'P'}</span><div><strong className="block text-xs">{selectedPage?.facebookPageName || 'Selected Page'}</strong><span className="text-[9px] text-text-soft">Carousel preview</span></div></header>{assets.length ? <div className="scrollbar-thin flex snap-x gap-1 overflow-x-auto bg-black/20">{assets.map((asset, index) => <img alt={`Preview slide ${index + 1}`} className="aspect-square w-full min-w-full snap-center object-cover" key={asset.id} src={asset.thumbnailUrl || asset.fileUrl} />)}</div> : <div className="grid aspect-square place-items-center bg-bg/30 text-center text-[10px] text-text-soft"><span><Images className="mx-auto mb-2 size-7" />Add images to preview your carousel.</span></div>}<div className="p-3"><p className="whitespace-pre-wrap text-xs leading-5 text-text-main">{caption || 'Your caption will appear here.'}</p><span className="mt-2 block text-[9px] text-text-soft">{assets.length} slide{assets.length === 1 ? '' : 's'} · Preview may vary slightly on Facebook.</span></div></article>
        </section>
      </div>
      <PublishConfirmationDialog actionLabel={mode === 'now' ? 'Publish carousel' : 'Schedule carousel'} description={`This will ${mode === 'now' ? 'publish' : 'schedule'} a ${assets.length}-slide carousel to ${selectedIds.length} destination${selectedIds.length === 1 ? '' : 's'}.`} onCancel={() => setConfirmationOpen(false)} onConfirm={() => { setConfirmationOpen(false); void publish() }} open={confirmationOpen} title="Confirm carousel publishing" />
    </div>
  )
}
