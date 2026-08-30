import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { fetchPostsWorkspace, createDirectPosts, uploadDirectPostMedia } from '../../lib/posts-api'
import type { MediaItem, PostDraft, PostType, PublishProgress, ScheduleMode } from '../../types/posts'
import { CreatePostPanel } from './CreatePostPanel'
import { DestinationSelector } from './DestinationSelector'
import { PostPreviewPanel } from './PostPreviewPanel'
import { PostsStatCard } from './PostPrimitives'
import { RecentPostsTable } from './RecentPostsTable'
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
  const [progress, setProgress] = useState<PublishProgress>({ state: 'idle', percent: 0, message: '' })

  const jobs = useMemo(() => workspace.data?.jobs || [], [workspace.data?.jobs])
  const stats = useMemo(() => {
    const needsReview = jobs.filter((job) => ['FAILED', 'AWAITING_UPLOAD'].includes(job.status)).length
    return [
      { label: 'All Posts', value: jobs.length + drafts.length, detail: 'All publishing records', tone: 'teal' as const },
      { label: 'Drafts', value: jobs.filter((job) => job.status === 'DRAFT').length + drafts.length, detail: 'Saved for later', tone: 'amber' as const },
      { label: 'Scheduled', value: jobs.filter((job) => job.status === 'SCHEDULED').length, detail: 'Future publishing slots', tone: 'blue' as const },
      { label: 'Published', value: jobs.filter((job) => job.status === 'PUBLISHED').length, detail: 'Confirmed by Meta', tone: 'green' as const },
      { label: 'Needs Review', value: needsReview, detail: needsReview ? 'Action required' : 'Nothing needs attention', tone: 'red' as const },
    ]
  }, [jobs, drafts])

  const selectedPage = workspace.data?.pages.find((page) => selectedIds.includes(page.id)) || null
  const needsMedia = postType === 'image' || postType === 'video' || postType === 'reel'
  const scheduledAt = mode === 'later' && date && time ? new Date(`${date}T${time}`).toISOString() : null
  const ready = Boolean(caption.trim() && selectedIds.length && (!needsMedia || media) && (mode !== 'later' || scheduledAt))

  function saveDraft() {
    if (!caption.trim() && !title.trim()) {
      setProgress({ state: 'failed', percent: 0, message: 'Add a title or caption before saving this draft.' })
      return
    }
    const draft: PostDraft = { id: crypto.randomUUID(), title: title.trim(), caption: caption.trim(), postType, mediaFileName: media?.fileName || null, selectedDestinationIds: selectedIds, scheduleMode: mode, scheduledAt, campaign, labels: labels.split(',').map((label) => label.trim()).filter(Boolean), status: 'draft', createdAt: new Date().toISOString() }
    const next = [draft, ...drafts].slice(0, 30)
    window.localStorage.setItem(draftKey, JSON.stringify(next))
    setDrafts(next)
    setProgress({ state: 'completed', percent: 100, message: media ? 'Draft saved in this browser. Reselect the media file before publishing.' : 'Draft saved safely in this browser.' })
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
      setProgress({ state: failed ? 'failed' : 'completed', percent: 100, message: failed ? `${response.jobs.length - failed} destinations completed; ${failed} failed. Review the queue below.` : `${response.jobs.length} destination${response.jobs.length === 1 ? '' : 's'} ${mode === 'now' ? 'published' : 'scheduled'} successfully.` })
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
      <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 xl:grid-cols-5">{stats.map((stat) => <PostsStatCard key={stat.label} {...stat} />)}</div>
      <div className="mt-5 grid items-start gap-5 2xl:grid-cols-[minmax(0,1.28fr)_minmax(360px,.82fr)_minmax(300px,.62fr)]">
        <CreatePostPanel caption={caption} destinationCount={selectedIds.length} media={media} postType={postType} setCaption={setCaption} setMedia={setMedia} setPostType={setPostType} setTitle={setTitle} title={title} />
        <DestinationSelector pages={workspace.data.pages} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-1"><SchedulePanel campaign={campaign} canPublish={mode === 'draft' ? Boolean(title.trim() || caption.trim()) : ready} date={date} labels={labels} mode={mode} onDraft={saveDraft} onPublish={() => void publish()} progress={progress} setCampaign={setCampaign} setDate={setDate} setLabels={setLabels} setMode={setMode} setTime={setTime} time={time} /><PostPreviewPanel caption={caption} media={media} selectedPage={selectedPage} /></div>
      </div>
      <RecentPostsTable drafts={drafts} jobs={workspace.data.jobs} />
    </div>
  )
}

function PostsSkeleton() { return <div aria-label="Loading Posts workspace" className="space-y-5"><div className="grid gap-3 md:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div className="h-28 animate-pulse rounded-card border border-border-soft bg-panel/70" key={index} />)}</div><div className="grid gap-5 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div className="h-[620px] animate-pulse rounded-panel border border-border-soft bg-panel/70" key={index} />)}</div></div> }
