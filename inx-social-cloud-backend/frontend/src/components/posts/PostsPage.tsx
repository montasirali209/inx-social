import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { fetchPostsWorkspace, createDirectPosts, uploadDirectPostMedia } from '../../lib/posts-api'
import { fetchFacebookDashboardAnalytics } from '../../lib/dashboard-api'
import { fetchMediaAssetFile } from '../../lib/media-library-api'
import { calculateBestPostTime } from '../../lib/posts-analytics'
import type { MediaAsset } from '../../types/media-library'
import type { BestTimeInsight, MediaItem, PostDraft, PostType, PublishProgress, ScheduleMode } from '../../types/posts'
import { CreatePostPanel } from './CreatePostPanel'
import { DestinationSelector } from './DestinationSelector'
import { DraftLibraryModal } from './DraftLibraryModal'
import { PostPreviewPanel } from './PostPreviewPanel'
import { PostsStatCard } from './PostPrimitives'
import { SchedulePanel } from './SchedulePanel'

const draftKey = 'inx-social-post-drafts-v1'

function readDrafts(): PostDraft[] {
  try { return JSON.parse(window.localStorage.getItem(draftKey) || '[]') as PostDraft[] } catch { return [] }
}

function defaultDate() {
  const value = new Date(Date.now() + 86_400_000)
  return value.toISOString().slice(0, 10)
}

export function PostsPage() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const importedAssetId = useRef<string | null>(null)
  const workspace = useQuery({ queryKey: ['posts-workspace'], queryFn: fetchPostsWorkspace, refetchInterval: 45_000 })
  const [postType, setPostType] = useState<PostType>('text')
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [media, setMedia] = useState<MediaItem | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [mode, setMode] = useState<ScheduleMode>('later')
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('19:30')
  const [campaign, setCampaign] = useState('No campaign')
  const [labels, setLabels] = useState('')
  const [drafts, setDrafts] = useState<PostDraft[]>(readDrafts)
  const [draftLibraryOpen, setDraftLibraryOpen] = useState(false)
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
  const [progress, setProgress] = useState<PublishProgress>({ state: 'idle', percent: 0, message: '' })

  useEffect(() => {
    const state = location.state as { mediaLibraryAsset?: MediaAsset; scheduleMode?: ScheduleMode } | null
    const asset = state?.mediaLibraryAsset
    if (!asset || importedAssetId.current === asset.id) return
    importedAssetId.current = asset.id
    setProgress({ state: 'preparing', percent: 15, message: `Attaching ${asset.fileName} from your Media Library…` })
    void fetchMediaAssetFile(asset).then(file => {
      const url = URL.createObjectURL(file)
      setMedia({ id: asset.id, type: asset.type === 'video' ? 'video' : 'image', file, url, thumbnailUrl: url, fileName: asset.fileName, size: file.size })
      setPostType(asset.type === 'video' ? 'video' : 'image')
      if (state?.scheduleMode) setMode(state.scheduleMode)
      setProgress({ state: 'completed', percent: 100, message: `${asset.fileName} is attached and ready to publish.` })
    }).catch(error => setProgress({ state: 'failed', percent: 0, message: error instanceof Error ? error.message : 'The Media Library asset could not be attached.' }))
  }, [location.state])

  const jobs = useMemo(() => workspace.data?.jobs || [], [workspace.data?.jobs])
  const stats = useMemo(() => {
    const needsReview = jobs.filter((job) => ['FAILED', 'AWAITING_UPLOAD'].includes(job.status)).length
    return [
      { label: 'All Posts', value: jobs.length + drafts.length, detail: 'All publishing records', tone: 'teal' as const },
      { label: 'Drafts', value: drafts.length, detail: 'Open saved drafts', tone: 'amber' as const },
      { label: 'Scheduled', value: jobs.filter((job) => job.status === 'SCHEDULED').length, detail: 'Future publishing slots', tone: 'blue' as const },
      { label: 'Published', value: jobs.filter((job) => job.status === 'PUBLISHED').length, detail: 'Confirmed by Meta', tone: 'green' as const },
      { label: 'Needs Review', value: needsReview, detail: needsReview ? 'Action required' : 'Nothing needs attention', tone: 'red' as const },
    ]
  }, [jobs, drafts])

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
  const needsMedia = postType === 'image' || postType === 'video' || postType === 'reel'
  const scheduledAt = mode === 'later' && date && time ? new Date(`${date}T${time}`).toISOString() : null
  const ready = Boolean(caption.trim() && selectedIds.length && (!needsMedia || media) && (mode !== 'later' || scheduledAt))

  function saveDraft() {
    if (!caption.trim() && !title.trim()) {
      setProgress({ state: 'failed', percent: 0, message: 'Add a title or caption before saving this draft.' })
      return
    }
    const existing = activeDraftId ? drafts.find((draft) => draft.id === activeDraftId) : null
    const draft: PostDraft = { id: existing?.id || crypto.randomUUID(), title: title.trim(), caption: caption.trim(), postType, mediaFileName: media?.fileName || existing?.mediaFileName || null, selectedDestinationIds: selectedIds, scheduleMode: mode, scheduledAt, campaign, labels: labels.split(',').map((label) => label.trim()).filter(Boolean), status: 'draft', createdAt: existing?.createdAt || new Date().toISOString() }
    const next = [draft, ...drafts.filter((item) => item.id !== draft.id)].slice(0, 30)
    window.localStorage.setItem(draftKey, JSON.stringify(next))
    setDrafts(next)
    setActiveDraftId(draft.id)
    setProgress({ state: 'completed', percent: 100, message: existing ? 'Draft updated in this browser.' : media ? 'Draft saved in this browser. Reselect the media file before publishing.' : 'Draft saved safely in this browser.' })
  }

  function deleteDraft(id: string) {
    const next = drafts.filter((draft) => draft.id !== id)
    window.localStorage.setItem(draftKey, JSON.stringify(next))
    setDrafts(next)
    if (activeDraftId === id) setActiveDraftId(null)
  }

  function loadDraft(draft: PostDraft) {
    setTitle(draft.title)
    setCaption(draft.caption)
    setPostType(draft.postType)
    setSelectedIds(draft.selectedDestinationIds.filter((id) => workspace.data?.pages.some((page) => page.id === id)))
    setMode(draft.scheduleMode)
    setCampaign(draft.campaign)
    setLabels(draft.labels.join(', '))
    setMedia(null)
    if (draft.scheduledAt) {
      const scheduled = new Date(draft.scheduledAt)
      const localValue = new Date(scheduled.getTime() - scheduled.getTimezoneOffset() * 60_000).toISOString()
      setDate(localValue.slice(0, 10))
      setTime(localValue.slice(11, 16))
    }
    setActiveDraftId(draft.id)
    setDraftLibraryOpen(false)
    setProgress({ state: 'completed', percent: 100, message: draft.mediaFileName ? `${draft.title || 'Draft'} loaded. Reselect ${draft.mediaFileName} before publishing.` : `${draft.title || 'Draft'} loaded and ready to continue.` })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function publish() {
    if (!ready) {
      setProgress({ state: 'failed', percent: 0, message: 'Add a caption, choose destinations and complete the publishing settings.' })
      return
    }
    setProgress({ state: 'preparing', percent: 8, message: 'Preparing one publishing record per destination…' })
    try {
      const response = await createDirectPosts({
        connectedPageIds: selectedIds,
        clientRequestId: `posts-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        title: title.trim() || null,
        caption: caption.trim(),
        contentType: postType === 'text' ? 'TEXT' : postType === 'image' ? 'IMAGE' : 'VIDEO',
        originalFileName: media?.fileName || null,
        mimeType: media?.file.type || null,
        fileSizeBytes: media?.size || null,
        scheduledAt,
        publishMode: mode === 'now' ? 'NOW' : 'SCHEDULED',
      })
      let mediaFailures = 0
      if (response.uploadRequired && media) {
        let completed = 0
        for (const job of response.jobs) {
          try {
            await uploadDirectPostMedia(job.id, media.file, (filePercent) => setProgress({ state: 'uploading', percent: Math.round(((completed + filePercent / 100) / response.jobs.length) * 100), message: `Publishing to ${job.page?.facebookPageName || 'destination'}…` }))
          } catch {
            mediaFailures += 1
          }
          completed += 1
        }
      }
      const failed = response.failures.length + mediaFailures
      setProgress({ state: failed ? 'failed' : 'completed', percent: 100, message: failed ? `${response.jobs.length - failed} destinations completed; ${failed} failed. Review the Dashboard for details.` : `${response.jobs.length} destination${response.jobs.length === 1 ? '' : 's'} ${mode === 'now' ? 'published' : 'scheduled'} successfully.` })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['posts-workspace'] }),
        queryClient.invalidateQueries({ queryKey: ['studio-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['content-calendar'] }),
      ])
    } catch (error) {
      setProgress({ state: 'failed', percent: 0, message: error instanceof Error ? error.message : 'The post could not be submitted.' })
    }
  }

  if (workspace.isLoading) return <PostsSkeleton />
  if (workspace.isError || !workspace.data) return <div className="rounded-panel border border-brand-red/25 bg-brand-red/8 p-6"><h2 className="font-semibold">Posts workspace unavailable</h2><p className="mt-2 text-sm text-text-muted">{workspace.error instanceof Error ? workspace.error.message : 'Refresh the workspace and try again.'}</p><button className="mt-4 rounded-xl border border-brand-red/30 px-4 py-2 text-xs" onClick={() => void workspace.refetch()} type="button">Retry</button></div>

  return (
    <div className="dashboard-canvas pb-8">
      <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 xl:grid-cols-5">{stats.map((stat) => <PostsStatCard key={stat.label} {...stat} onClick={stat.label === 'Drafts' ? () => setDraftLibraryOpen(true) : undefined} />)}</div>
      <DestinationSelector pages={workspace.data.pages} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.35fr)_minmax(290px,.72fr)_minmax(320px,.82fr)]">
        <CreatePostPanel bestTime={bestTime} bestTimeLoading={pageAnalytics.isLoading} caption={caption} destinationCount={selectedIds.length} media={media} postType={postType} setCaption={setCaption} setMedia={setMedia} setPostType={setPostType} setTitle={setTitle} title={title} />
        <SchedulePanel bestTime={bestTime} bestTimeLoading={pageAnalytics.isLoading} campaign={campaign} canPublish={mode === 'draft' ? Boolean(title.trim() || caption.trim()) : ready} date={date} labels={labels} mode={mode} onDraft={saveDraft} onPublish={() => void publish()} progress={progress} setCampaign={setCampaign} setDate={setDate} setLabels={setLabels} setMode={setMode} setTime={setTime} time={time} />
        <PostPreviewPanel caption={caption} media={media} selectedPage={selectedPage} />
      </div>
      {draftLibraryOpen && <DraftLibraryModal drafts={drafts} onClose={() => setDraftLibraryOpen(false)} onDelete={deleteDraft} onLoad={loadDraft} pages={workspace.data.pages} />}
    </div>
  )
}

function PostsSkeleton() { return <div aria-label="Loading Posts workspace" className="space-y-5"><div className="grid gap-3 md:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div className="h-28 animate-pulse rounded-card border border-border-soft bg-panel/70" key={index} />)}</div><div className="h-24 animate-pulse rounded-panel border border-border-soft bg-panel/70" /><div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[1.35fr_.72fr_.82fr]">{Array.from({ length: 3 }, (_, index) => <div className="h-[620px] animate-pulse rounded-panel border border-border-soft bg-panel/70" key={index} />)}</div></div> }
