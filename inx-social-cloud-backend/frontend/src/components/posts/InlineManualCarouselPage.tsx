import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, Images, LoaderCircle, Trash2, UploadCloud } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchFacebookDashboardAnalytics } from '../../lib/dashboard-api'
import { fetchMediaLibrary, uploadMediaAsset } from '../../lib/media-library-api'
import { zonedDateTimeToIso } from '../../lib/bulk-scheduler-utils'
import { clearCarouselSession, readCarouselSession, saveCarouselSession } from '../../lib/carousel-composer-session'
import { calculateBestPostTime } from '../../lib/posts-analytics'
import { createCarouselPosts, fetchPostsWorkspace } from '../../lib/posts-api'
import type { AIDraft } from '../../types/ai-content-studio'
import type { MediaAsset } from '../../types/media-library'
import type { BestTimeInsight, PublishProgress, ScheduleMode } from '../../types/posts'
import { Button } from '../ui/Button'
import { PublishConfirmationDialog } from '../ui/PublishConfirmationDialog'
import { CreatePostPanel } from './CreatePostPanel'
import { DestinationSelector } from './DestinationSelector'
import { PostsStatCard } from './PostPrimitives'
import { PostPreviewPanel } from './PostPreviewPanel'
import { SchedulePanel } from './SchedulePanel'

const MANUAL_DRAFT_KEY = 'inx-social-manual-carousel-draft-v1'
const STANDARD_DRAFT_KEY = 'inx-social-post-drafts-v1'

type Props = {
  onStandardPost: () => void
  initialDraft?: AIDraft
  initialAssets?: MediaAsset[]
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname)
  } catch {
    return false
  }
}

function defaultDate() {
  return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
}

function initialComposerState(initialDraft?: AIDraft, initialAssets?: MediaAsset[]) {
  if (initialDraft) {
    const assets = initialDraft.mediaLibraryAssets?.length
      ? initialDraft.mediaLibraryAssets
      : initialDraft.mediaLibraryAsset ? [initialDraft.mediaLibraryAsset] : []
    const hashtags = (initialDraft.hashtags || []).map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')
    return {
      title: initialDraft.title || '',
      caption: [initialDraft.caption?.trim(), hashtags].filter(Boolean).join('\n\n'),
      captionIdea: '',
      assets: assets.filter((asset) => asset.type === 'image').slice(0, 10),
      slideLinks: {}, selectedIds: [], mode: 'later' as ScheduleMode, date: defaultDate(), time: '19:30',
      campaign: 'No campaign', labels: 'AI Content Studio, Carousel',
    }
  }
  if (initialAssets?.length) {
    return {
      title: '', caption: '', captionIdea: '', assets: initialAssets.filter((asset) => asset.type === 'image').slice(0, 10),
      slideLinks: {}, selectedIds: [], mode: 'later' as ScheduleMode, date: defaultDate(), time: '19:30',
      campaign: 'No campaign', labels: 'Media Library, Carousel',
    }
  }
  const restored = readCarouselSession()
  return restored || {
    title: '', caption: '', captionIdea: '', assets: [], slideLinks: {}, selectedIds: [], mode: 'later' as ScheduleMode,
    date: defaultDate(), time: '19:30', campaign: 'No campaign', labels: 'Carousel',
  }
}

function browserDraftCount() {
  try {
    const standard = JSON.parse(window.localStorage.getItem(STANDARD_DRAFT_KEY) || '[]') as unknown[]
    return standard.length + (window.localStorage.getItem(MANUAL_DRAFT_KEY) ? 1 : 0)
  } catch {
    return window.localStorage.getItem(MANUAL_DRAFT_KEY) ? 1 : 0
  }
}

export function InlineManualCarouselPage({ onStandardPost, initialDraft, initialAssets }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dragIndex = useRef<number | null>(null)
  const refreshedRestoredAssets = useRef(false)
  const [initial] = useState(() => initialComposerState(initialDraft, initialAssets))
  const queryClient = useQueryClient()
  const workspace = useQuery({ queryKey: ['posts-workspace'], queryFn: fetchPostsWorkspace, refetchInterval: 45_000 })
  const [title, setTitle] = useState(initial.title)
  const [caption, setCaption] = useState(initial.caption)
  const [captionIdea, setCaptionIdea] = useState(initial.captionIdea)
  const [assets, setAssets] = useState<MediaAsset[]>(initial.assets)
  const [slideLinks, setSlideLinks] = useState<Record<string, string>>(initial.slideLinks)
  const [selectedIds, setSelectedIds] = useState<string[]>(initial.selectedIds)
  const [mode, setMode] = useState<ScheduleMode>(initial.mode)
  const [date, setDate] = useState(initial.date || defaultDate())
  const [time, setTime] = useState(initial.time)
  const [campaign, setCampaign] = useState(initial.campaign)
  const [labels, setLabels] = useState(initial.labels)
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null)
  const [dragOverAssetId, setDragOverAssetId] = useState<string | null>(null)
  const [draftVersion, setDraftVersion] = useState(0)
  const [progress, setProgress] = useState<PublishProgress>({
    state: initial.assets.length >= 2 ? 'completed' : 'idle',
    percent: initial.assets.length >= 2 ? 100 : 0,
    message: initial.assets.length >= 2 ? `${initial.assets.length} carousel slides restored and ready to edit.` : 'Add 2–10 images to build your carousel.',
  })
  const [confirmationOpen, setConfirmationOpen] = useState(false)

  useEffect(() => {
    if (!title.trim() && !caption.trim() && !captionIdea.trim() && !assets.length) {
      clearCarouselSession()
      return
    }
    saveCarouselSession({ title, caption, captionIdea, assets, slideLinks, selectedIds, mode, date, time, campaign, labels })
  }, [assets, campaign, caption, captionIdea, date, labels, mode, selectedIds, slideLinks, time, title])

  useEffect(() => {
    if (initialDraft || initialAssets?.length || !initial.assets.length || refreshedRestoredAssets.current) return
    refreshedRestoredAssets.current = true
    void fetchMediaLibrary().then((library) => {
      const currentById = new Map(library.assets.map((asset) => [asset.id, asset]))
      setAssets((stored) => stored.map((asset) => currentById.get(asset.id) || asset))
    }).catch(() => {
      setProgress({ state: 'failed', percent: 0, message: 'Your carousel text and order were restored, but the latest slide previews could not be refreshed.' })
    })
  }, [initial.assets.length, initialAssets, initialDraft])

  const jobs = useMemo(() => workspace.data?.jobs || [], [workspace.data?.jobs])
  const draftCount = useMemo(() => draftVersion >= 0 ? browserDraftCount() : 0, [draftVersion])
  const stats = useMemo(() => {
    const needsReview = jobs.filter((job) => ['FAILED', 'AWAITING_UPLOAD'].includes(job.status)).length
    return [
      { label: 'All Posts', value: jobs.length + draftCount, detail: 'All publishing records', tone: 'teal' as const },
      { label: 'Drafts', value: draftCount, detail: 'Open saved drafts', tone: 'amber' as const },
      { label: 'Scheduled', value: jobs.filter((job) => job.status === 'SCHEDULED').length, detail: 'Future publishing slots', tone: 'blue' as const },
      { label: 'Published', value: jobs.filter((job) => job.status === 'PUBLISHED').length, detail: 'Confirmed by Meta', tone: 'green' as const },
      { label: 'Needs Review', value: needsReview, detail: needsReview ? 'Action required' : 'Nothing needs attention', tone: 'red' as const },
    ]
  }, [draftCount, jobs])

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
  const orderedLinks = assets.map((asset) => (slideLinks[asset.id] || '').trim())
  const linkedSlideCount = orderedLinks.filter(Boolean).length
  const linksComplete = linkedSlideCount === 0 || linkedSlideCount === assets.length
  const linksValid = linkedSlideCount === 0 || orderedLinks.every(isHttpUrl)
  const linkedCarouselWithinLimit = linkedSlideCount === 0 || assets.length <= 5
  const ready = Boolean(caption.trim() && assets.length >= 2 && assets.length <= 10 && linksComplete && linksValid && linkedCarouselWithinLimit && selectedIds.length && (mode !== 'later' || scheduledAt))

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
    try {
      const uploaded: MediaAsset[] = []
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index]
        const asset = await uploadMediaAsset(file, null, (percent) => {
          const total = Math.round(((index + percent / 100) / selected.length) * 100)
          setUploadPercent(total)
          setProgress({ state: 'uploading', percent: total, message: `Uploading slide ${index + 1} of ${selected.length}…` })
        })
        uploaded.push(asset)
      }
      setAssets((current) => [...current, ...uploaded].slice(0, 10))
      const count = assets.length + uploaded.length
      setProgress({ state: 'completed', percent: 100, message: count >= 2 ? `${count} carousel slides ready.` : 'Add at least one more image.' })
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

  function moveSlideTo(source: number, target: number) {
    if (source === target || source < 0 || target < 0) return
    setAssets((current) => {
      if (source >= current.length || target >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(source, 1)
      next.splice(target, 0, moved)
      return next
    })
  }

  function saveDraft() {
    saveCarouselSession({ title, caption, captionIdea, assets, slideLinks, selectedIds, mode, date, time, campaign, labels })
    window.localStorage.setItem(MANUAL_DRAFT_KEY, JSON.stringify({ title, caption, assetIds: assets.map((asset) => asset.id), slideLinks: orderedLinks, updatedAt: new Date().toISOString() }))
    setDraftVersion((value) => value + 1)
    setProgress({ state: 'completed', percent: 100, message: 'Carousel draft saved on this browser.' })
  }

  async function publish() {
    if (!ready || (mode === 'later' && !scheduledAt)) return
    setProgress({ state: 'preparing', percent: 15, message: `Preparing ${assets.length} carousel slides…` })
    try {
      const response = await createCarouselPosts({
        connectedPageIds: selectedIds,
        clientRequestId: `manual-carousel-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        title: title.trim() || null,
        caption: caption.trim(),
        mediaLibraryAssetIds: assets.map((asset) => asset.id),
        slideLinks: orderedLinks,
        scheduledAt,
        publishMode: mode === 'now' ? 'NOW' : 'SCHEDULED',
      })
      const failed = response.failures.length
      setProgress({ state: failed ? 'failed' : 'completed', percent: 100, message: failed ? `${failed} destination${failed === 1 ? '' : 's'} failed.` : `${assets.length}-slide carousel ${mode === 'now' ? 'published' : 'scheduled'} successfully.` })
      if (!failed) {
        window.localStorage.removeItem(MANUAL_DRAFT_KEY)
        clearCarouselSession()
        setDraftVersion((value) => value + 1)
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['posts-workspace'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['content-calendar'] }),
      ])
    } catch (error) {
      setProgress({ state: 'failed', percent: 0, message: error instanceof Error ? error.message : 'The carousel could not be submitted.' })
    }
  }

  function requestPublish() {
    if (!ready) {
      const message = !linksComplete
        ? 'For a linked carousel, add or clear the destination link on every slide.'
        : !linksValid
          ? 'Enter a complete http:// or https:// destination for every linked slide.'
        : !linkedCarouselWithinLimit
          ? 'Facebook link carousels support up to 5 linked slides. Use 2–5 linked slides, or clear the links to publish up to 10 media slides.'
          : 'Add a caption, at least two images, destinations and complete the publishing settings.'
      setProgress({ state: 'failed', percent: 0, message })
      return
    }
    if (workspace.data?.settings.approvalRequired) return setConfirmationOpen(true)
    void publish()
  }

  if (workspace.isLoading) return <div className="space-y-5"><div className="grid gap-3 md:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div className="h-28 animate-pulse rounded-card border border-border-soft bg-panel/70" key={index} />)}</div><div className="h-24 animate-pulse rounded-panel border border-border-soft bg-panel/70" /></div>
  if (workspace.isError || !workspace.data) return <div className="rounded-panel border border-brand-red/25 bg-brand-red/8 p-6"><h2 className="font-semibold">Posts workspace unavailable</h2><p className="mt-2 text-sm text-text-muted">{workspace.error instanceof Error ? workspace.error.message : 'Refresh and try again.'}</p></div>

  return (
    <div className="dashboard-canvas pb-8">
      <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 xl:grid-cols-5">{stats.map((stat) => <PostsStatCard key={stat.label} {...stat} />)}</div>
      <DestinationSelector destinations={workspace.data.destinations} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.35fr)_minmax(290px,.72fr)_minmax(320px,.82fr)]">
        <CreatePostPanel bestTime={bestTime} bestTimeLoading={pageAnalytics.isLoading} caption={caption} captionIdea={captionIdea} carouselHasMedia={assets.length > 0} carouselUploader={<div className="rounded-2xl border border-brand-cyan/20 bg-brand-cyan/[0.03] p-3">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-brand-cyan/10 text-brand-cyan"><Images className="size-4" /></span><div><strong className="block text-xs">Carousel slides</strong><span className="text-[9px] text-text-soft">{assets.length}/10 images · publish order is left to right</span></div></div><Button disabled={uploading || assets.length >= 10} onClick={() => inputRef.current?.click()} size="sm" variant="ghost"><ImagePlus className="size-3.5" />Add images</Button></div>
            <input accept="image/png,image/jpeg,image/webp" className="sr-only" multiple onChange={(event) => event.target.files && void addFiles(event.target.files)} ref={inputRef} type="file" />
            {!assets.length ? <button className="mt-3 grid min-h-32 w-full place-items-center rounded-xl border border-dashed border-brand-cyan/25 bg-brand-cyan/[0.025] p-4 text-center transition hover:border-brand-cyan/55 hover:bg-brand-cyan/[0.06]" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addFiles(event.dataTransfer.files) }} type="button"><span><UploadCloud className="mx-auto size-7 text-brand-cyan" /><strong className="mt-2 block text-xs">Drag & drop carousel images here</strong><span className="mt-1 block text-[10px] text-text-muted">PNG, JPEG or WebP · 2–10 slides</span></span></button> : (
              <div className="scrollbar-thin mt-3 flex gap-2 overflow-x-auto pb-4 pt-2 [perspective:900px]">
                {assets.map((asset, index) => (
                  <div
                    aria-label={`Carousel slide ${index + 1}. Drag anywhere on the card to reorder.`}
                    className={`relative w-44 shrink-0 cursor-grab select-none rounded-xl border bg-bg/30 p-2 transition-[transform,box-shadow,border-color,opacity] duration-300 ease-out [transform-style:preserve-3d] active:cursor-grabbing ${draggingAssetId === asset.id ? 'z-20 border-brand-cyan/80 opacity-80 shadow-[0_24px_55px_rgba(0,214,192,.28)] [transform:translate3d(0,-10px,32px)_rotateX(7deg)_rotateZ(-2deg)_scale(1.04)]' : dragOverAssetId === asset.id ? 'border-brand-cyan/65 shadow-[0_16px_36px_rgba(0,214,192,.2)] [transform:translate3d(0,-4px,18px)_rotateX(3deg)_rotateZ(1deg)_scale(1.025)]' : 'border-border-soft hover:border-brand-cyan/40 hover:shadow-[0_12px_28px_rgba(0,214,192,.12)] hover:[transform:translate3d(0,-2px,8px)_rotateX(1deg)]'}`}
                    draggable
                    key={asset.id}
                    onDragEnd={() => { dragIndex.current = null; setDraggingAssetId(null); setDragOverAssetId(null) }}
                    onDragEnter={() => { if (dragIndex.current !== null) setDragOverAssetId(asset.id) }}
                    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; if (dragIndex.current !== null) setDragOverAssetId(asset.id) }}
                    onDragStart={(event) => {
                      if ((event.target as HTMLElement).closest('input,button,[data-no-card-drag]')) { event.preventDefault(); return }
                      dragIndex.current = index
                      setDraggingAssetId(asset.id)
                      setDragOverAssetId(asset.id)
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', String(index))
                    }}
                    onDrop={(event) => { event.preventDefault(); if (dragIndex.current !== null) moveSlideTo(dragIndex.current, index); dragIndex.current = null; setDraggingAssetId(null); setDragOverAssetId(null) }}
                  >
                    <div className="relative aspect-square overflow-hidden rounded-lg bg-black/30">
                      <img alt={`Carousel slide ${index + 1}`} className="pointer-events-none h-full w-full object-cover" draggable={false} src={asset.thumbnailUrl || asset.fileUrl} />
                      <span className="absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[8px] font-bold text-white">{index + 1}</span>
                      <span aria-hidden="true" className="pointer-events-none absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/75 px-1.5 py-1 text-[8px] font-semibold text-white"><GripVertical className="size-3" />Grab anywhere</span>
                    </div>
                    <label className="mt-2 block text-[9px] font-semibold text-text-muted">Slide link <span className="font-normal text-text-soft">(optional)</span><input aria-label={`Link for carousel slide ${index + 1}`} className="mt-1 w-full rounded-lg border border-border-soft bg-bg/50 px-2 py-1.5 text-[10px] text-white outline-none placeholder:text-text-soft focus:border-brand-cyan" data-no-card-drag draggable={false} inputMode="url" onChange={(event) => setSlideLinks((current) => ({ ...current, [asset.id]: event.target.value }))} placeholder="https://example.com" type="url" value={slideLinks[asset.id] || ''} /></label>
                    <div className="mt-2 flex items-center justify-between gap-1" data-no-card-drag><button aria-label={`Move slide ${index + 1} left`} className="rounded-md border border-border-soft p-1 text-text-muted disabled:opacity-30" disabled={index === 0} onClick={() => moveSlide(index, -1)} type="button"><ArrowLeft className="size-3" /></button><button aria-label={`Move slide ${index + 1} right`} className="rounded-md border border-border-soft p-1 text-text-muted disabled:opacity-30" disabled={index === assets.length - 1} onClick={() => moveSlide(index, 1)} type="button"><ArrowRight className="size-3" /></button><button aria-label={`Remove slide ${index + 1}`} className="rounded-md border border-brand-red/25 p-1 text-brand-red" onClick={() => { setAssets((current) => current.filter((_, itemIndex) => itemIndex !== index)); setSlideLinks((current) => { const next = { ...current }; delete next[asset.id]; return next }) }} type="button"><Trash2 className="size-3" /></button></div>
                  </div>
                ))}
              </div>
            )}
            {uploading && <div className="mt-3 flex items-center gap-2 text-[10px] text-brand-cyan"><LoaderCircle className="size-3.5 animate-spin" />Uploading carousel images… {uploadPercent}%</div>}
            {linkedSlideCount > 0 && <p className={`mt-2 text-[9px] leading-4 ${linksComplete && linksValid && linkedCarouselWithinLimit ? 'text-brand-green' : 'text-brand-amber'}`}>{linksComplete && linksValid && linkedCarouselWithinLimit ? `${linkedSlideCount}-slide linked carousel ready.` : assets.length > 5 ? 'Linked Facebook carousels support 2–5 slides; media-only carousels support up to 10.' : !linksComplete ? 'Add a link to every slide, or clear all slide links.' : 'Enter complete http:// or https:// links.'}</p>}
          </div>} destinationCount={selectedIds.length} media={null} onStandardPost={onStandardPost} postType="carousel" retainMedia={false} setCaption={setCaption} setCaptionIdea={setCaptionIdea} setMedia={() => {}} setPostType={() => {}} setRetainMedia={() => {}} setTitle={setTitle} title={title} />
        <SchedulePanel bestTime={bestTime} bestTimeLoading={pageAnalytics.isLoading} campaign={campaign} canPublish={mode === 'draft' ? Boolean(title.trim() || caption.trim() || assets.length) : ready} date={date} labels={labels} mode={mode} onDraft={saveDraft} onPublish={requestPublish} progress={progress} setCampaign={setCampaign} setDate={setDate} setLabels={setLabels} setMode={setMode} setTime={setTime} time={time} />
        <PostPreviewPanel caption={caption} carouselAssets={assets} media={null} selectedPage={selectedPage} />
      </div>
      <PublishConfirmationDialog busy={progress.state === 'preparing' || progress.state === 'uploading'} confirmLabel={mode === 'now' ? 'Publish carousel' : 'Confirm schedule'} description={`${selectedIds.length} destination${selectedIds.length === 1 ? '' : 's'} will receive this ${assets.length}-slide carousel${mode === 'later' ? ` at the selected time in ${workspace.data.settings.timezone}` : ' immediately'}.`} onCancel={() => setConfirmationOpen(false)} onConfirm={() => { setConfirmationOpen(false); void publish() }} open={confirmationOpen} title={mode === 'now' ? 'Publish this carousel now?' : 'Schedule this carousel?'} />
    </div>
  )
}
