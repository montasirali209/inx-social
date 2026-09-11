import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Images, Pencil, Send, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchFacebookDashboardAnalytics } from '../../lib/dashboard-api'
import { saveAIDraft } from '../../lib/ai-content-studio-api'
import { zonedDateTimeToIso } from '../../lib/bulk-scheduler-utils'
import { calculateBestPostTime } from '../../lib/posts-analytics'
import { createCarouselPosts, fetchPostsWorkspace } from '../../lib/posts-api'
import type { AIDraft } from '../../types/ai-content-studio'
import type { BestTimeInsight, PublishProgress, ScheduleMode } from '../../types/posts'
import { Button } from '../ui/Button'
import { PublishConfirmationDialog } from '../ui/PublishConfirmationDialog'
import { DestinationSelector } from './DestinationSelector'
import { PanelHeading, PlatformIcon, PostsStatCard } from './PostPrimitives'
import { SchedulePanel } from './SchedulePanel'

function defaultDate() {
  return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
}

export function CarouselPostComposerPage({ draft }: { draft: AIDraft }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const workspace = useQuery({ queryKey: ['posts-workspace'], queryFn: fetchPostsWorkspace, refetchInterval: 45_000 })
  const assets = useMemo(() => draft.mediaLibraryAssets?.length ? draft.mediaLibraryAssets : draft.mediaLibraryAsset ? [draft.mediaLibraryAsset] : [], [draft.mediaLibraryAsset, draft.mediaLibraryAssets])
  const hashtags = useMemo(() => (draft.hashtags || []).map((tag) => `#${tag.replace(/^#/, '')}`).join(' '), [draft.hashtags])
  const [title, setTitle] = useState(draft.title || '')
  const [caption, setCaption] = useState([draft.caption?.trim(), hashtags].filter(Boolean).join('\n\n'))
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [mode, setMode] = useState<ScheduleMode>('later')
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('19:30')
  const [campaign, setCampaign] = useState('No campaign')
  const [labels, setLabels] = useState('AI Content Studio, Carousel')
  const [progress, setProgress] = useState<PublishProgress>({
    state: assets.length >= 2 ? 'completed' : 'failed',
    percent: assets.length >= 2 ? 100 : 0,
    message: assets.length >= 2
      ? `AI carousel pre-filled with ${assets.length} slides. Choose destinations and a publishing time.`
      : 'This carousel does not have at least two saved slides. Return to AI Content Studio and generate the carousel again.',
  })
  const [confirmationOpen, setConfirmationOpen] = useState(false)

  const jobs = useMemo(() => workspace.data?.jobs || [], [workspace.data?.jobs])
  const stats = useMemo(() => {
    const needsReview = jobs.filter((job) => ['FAILED', 'AWAITING_UPLOAD'].includes(job.status)).length
    return [
      { label: 'All Posts', value: jobs.length, detail: 'All publishing records', tone: 'teal' as const },
      { label: 'Drafts', value: 0, detail: 'AI draft is already saved', tone: 'amber' as const },
      { label: 'Scheduled', value: jobs.filter((job) => job.status === 'SCHEDULED').length, detail: 'Future publishing slots', tone: 'blue' as const },
      { label: 'Published', value: jobs.filter((job) => job.status === 'PUBLISHED').length, detail: 'Confirmed by Meta', tone: 'green' as const },
      { label: 'Needs Review', value: needsReview, detail: needsReview ? 'Action required' : 'Nothing needs attention', tone: 'red' as const },
    ]
  }, [jobs])

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
  const ready = Boolean(caption.trim() && assets.length >= 2 && selectedIds.length && (mode !== 'later' || scheduledAt))

  async function saveDraft() {
    try {
      await saveAIDraft({ ...draft, title: title.trim() || draft.title, caption: caption.trim(), updatedAt: new Date().toISOString(), status: 'draft' })
      setProgress({ state: 'completed', percent: 100, message: 'Carousel draft saved with all generated slides in AI Content Studio.' })
    } catch (error) {
      setProgress({ state: 'failed', percent: 0, message: error instanceof Error ? error.message : 'The carousel draft could not be saved.' })
    }
  }

  async function publish() {
    if (!ready || !scheduledAt && mode === 'later') {
      setProgress({ state: 'failed', percent: 0, message: 'Add a caption, choose destinations and complete the publishing settings.' })
      return
    }
    setProgress({ state: 'preparing', percent: 18, message: `Preparing ${assets.length} carousel slides for ${selectedIds.length} destination${selectedIds.length === 1 ? '' : 's'}…` })
    try {
      const response = await createCarouselPosts({
        connectedPageIds: selectedIds,
        clientRequestId: `carousel-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
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
          ? `${succeeded} destination${succeeded === 1 ? '' : 's'} completed; ${failed} failed. Review the Dashboard for details.`
          : `${assets.length}-slide carousel ${mode === 'now' ? 'published' : 'scheduled'} successfully to ${response.jobs.length} destination${response.jobs.length === 1 ? '' : 's'}.`,
      })
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
      setProgress({ state: 'failed', percent: 0, message: 'Add a caption, choose destinations and complete the publishing settings.' })
      return
    }
    if (workspace.data?.settings.approvalRequired) {
      setConfirmationOpen(true)
      return
    }
    void publish()
  }

  if (workspace.isLoading) return <div className="space-y-5"><div className="h-24 animate-pulse rounded-panel border border-border-soft bg-panel/70" /><div className="grid gap-5 xl:grid-cols-[1.35fr_.72fr_.82fr]">{Array.from({ length: 3 }, (_, index) => <div className="h-[620px] animate-pulse rounded-panel border border-border-soft bg-panel/70" key={index} />)}</div></div>
  if (workspace.isError || !workspace.data) return <div className="rounded-panel border border-brand-red/25 bg-brand-red/8 p-6"><h2 className="font-semibold">Posts workspace unavailable</h2><p className="mt-2 text-sm text-text-muted">{workspace.error instanceof Error ? workspace.error.message : 'Refresh the workspace and try again.'}</p><Button className="mt-4" onClick={() => void workspace.refetch()}>Retry</Button></div>

  return (
    <div className="dashboard-canvas pb-8">
      <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 xl:grid-cols-5">{stats.map((stat) => <PostsStatCard key={stat.label} {...stat} />)}</div>
      <DestinationSelector destinations={workspace.data.destinations} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.35fr)_minmax(290px,.72fr)_minmax(320px,.82fr)]">
        <section className="interactive-surface rounded-panel border p-4 xl:p-5">
          <PanelHeading step={1} subtitle="Review every AI-generated slide and publishing copy before scheduling." title="Create Your Post" />
          <fieldset>
            <legend className="mb-2 text-[11px] font-semibold text-text-muted">Post type</legend>
            <div className="grid grid-cols-2 gap-2">
              <button className="min-h-[52px] rounded-xl border border-border-soft bg-bg/30 px-3 py-2 text-left text-text-muted transition hover:border-brand-cyan/30 hover:text-white" onClick={() => navigate('/posts', { replace: true, state: null })} type="button"><span className="block text-xs font-semibold">Text / Media Post</span><span className="mt-0.5 block text-[9px] text-text-soft">Text only, image or video.</span></button>
              <button aria-pressed="true" className="min-h-[52px] rounded-xl border border-brand-cyan/60 bg-brand-cyan/12 px-3 py-2 text-left text-brand-cyan" type="button"><span className="block text-xs font-semibold">Carousel Post</span><span className="mt-0.5 block text-[9px] text-text-soft">AI-generated multi-slide post.</span></button>
            </div>
          </fieldset>
          <label className="mt-4 block text-[11px] font-semibold text-text-muted">Post title <span className="font-normal text-text-soft">(optional)</span><input className="mt-2 w-full rounded-xl border border-border-soft bg-bg/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/10" maxLength={200} onChange={(event) => setTitle(event.target.value)} placeholder="Give your post a working title…" value={title} /></label>
          <label className="mt-4 block text-[11px] font-semibold text-text-muted">Caption<textarea className="mt-2 min-h-36 w-full resize-y rounded-xl border border-border-soft bg-bg/40 p-3 text-sm leading-6 text-white outline-none transition placeholder:text-text-soft focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/10" maxLength={5000} onChange={(event) => setCaption(event.target.value)} placeholder="What would you like to share?" value={caption} /></label>
          <div className="-mt-8 flex h-8 justify-end px-3 text-[10px] text-text-soft">{caption.length} / 5,000</div>

          <div className="mt-4 rounded-2xl border border-brand-cyan/20 bg-brand-cyan/[0.03] p-3">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-brand-cyan/10 text-brand-cyan"><Images className="size-4" /></span><div><strong className="block text-xs">Carousel slides</strong><span className="text-[9px] text-text-soft">{assets.length} slides imported from AI Content Studio</span></div></div><Button onClick={() => navigate('/ai-content-studio')} size="sm" variant="ghost"><Pencil className="size-3.5" />Edit in AI Studio</Button></div>
            {assets.length >= 2 ? <div className="scrollbar-thin mt-3 flex gap-2 overflow-x-auto pb-1">{assets.map((asset, index) => <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-border-soft bg-black/25" key={asset.id}><img alt={`Carousel slide ${index + 1}`} className="h-full w-full object-cover" src={asset.thumbnailUrl || asset.fileUrl} /><span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[8px] font-bold text-white">{index + 1}</span></div>)}</div> : <div className="mt-3 rounded-xl border border-brand-red/20 bg-brand-red/[0.05] p-4 text-center"><p className="text-[10px] text-brand-red">A carousel needs at least two saved slides.</p><Button className="mt-3" onClick={() => navigate('/ai-content-studio')} size="sm"><Sparkles className="size-3.5" />Return to AI Content Studio</Button></div>}
            {assets.length >= 2 && <p className="mt-2 text-[9px] leading-4 text-text-soft">All slides stay in this order and publish together as one carousel. Nothing is reduced to a single lead image.</p>}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-border-soft bg-bg/30 p-3"><span className="text-[10px] text-text-muted">Carousel status</span><strong className="mt-1 block text-lg text-brand-cyan">{assets.length >= 2 ? 'Ready' : 'Incomplete'}</strong><p className="mt-1 text-[9px] text-text-soft">Title, caption, hashtags and every generated slide are pre-filled from AI Content Studio.</p></div><div className="rounded-xl border border-border-soft bg-bg/30 p-3"><span className="text-[10px] text-text-muted">Best Time To Post</span><strong className={`mt-1 block text-xs ${bestTime.available ? 'text-brand-cyan' : 'text-text-main'}`}>{pageAnalytics.isLoading ? 'Analysing Page activity…' : bestTime.label}</strong><p className="mt-1 text-[10px] leading-4 text-text-soft">{pageAnalytics.isLoading ? 'Reading live engagement history from the selected Page.' : bestTime.detail}</p></div></div>
        </section>

        <SchedulePanel bestTime={bestTime} bestTimeLoading={pageAnalytics.isLoading} campaign={campaign} canPublish={mode === 'draft' ? Boolean(title.trim() || caption.trim()) : ready} date={date} labels={labels} mode={mode} onDraft={() => void saveDraft()} onPublish={requestPublish} progress={progress} setCampaign={setCampaign} setDate={setDate} setLabels={setLabels} setMode={setMode} setTime={setTime} time={time} />

        <section className="interactive-surface rounded-panel border p-4 xl:p-5">
          <PanelHeading step={4} subtitle="Preview the complete slide sequence before publishing." title="Post Preview" />
          <div className="flex items-center gap-2 border-b border-border-soft pb-2 text-[10px] font-medium text-brand-cyan"><PlatformIcon className="size-[18px] rounded-md shadow-none" platform="facebook" />Facebook carousel</div>
          <article className="mt-3 overflow-hidden rounded-xl border border-border-soft bg-bg/45"><header className="flex items-center gap-3 p-3"><span className="grid size-10 place-items-center rounded-full border border-border-strong bg-panel text-sm font-bold">{selectedPage?.facebookPageName?.trim().slice(0, 1).toUpperCase() || 'P'}</span><div className="min-w-0 flex-1"><strong className="block truncate text-xs">{selectedPage?.facebookPageName || 'Choose a destination'}</strong><span className="text-[9px] text-text-soft">Just now · Public</span></div></header><p className="whitespace-pre-wrap px-3 pb-3 text-xs leading-5 text-text-main">{caption || 'Your carousel caption will appear here.'}</p>{assets[0] ? <div className="relative h-64 overflow-hidden bg-black/35"><img alt="Carousel lead slide" className="h-full w-full object-contain" src={assets[0].thumbnailUrl || assets[0].fileUrl} /><span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[9px] font-semibold text-white">1 / {assets.length}</span></div> : <div className="grid h-64 place-items-center text-xs text-text-soft">Carousel preview unavailable</div>}<div className="scrollbar-thin flex gap-1.5 overflow-x-auto border-t border-border-soft p-2">{assets.map((asset, index) => <img alt={`Slide ${index + 1}`} className="size-12 shrink-0 rounded-lg border border-border-soft object-cover" key={asset.id} src={asset.thumbnailUrl || asset.fileUrl} />)}</div></article>
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-brand-cyan/15 bg-brand-cyan/[0.03] p-2 text-[9px] text-text-soft"><Send className="size-3 text-brand-cyan" />All {assets.length} slides will be sent as one Facebook multi-photo carousel.</p>
        </section>
      </div>
      <PublishConfirmationDialog busy={progress.state === 'preparing' || progress.state === 'uploading'} confirmLabel={mode === 'now' ? 'Publish carousel' : 'Confirm schedule'} description={`${selectedIds.length} destination${selectedIds.length === 1 ? '' : 's'} will receive this ${assets.length}-slide carousel${mode === 'later' ? ` at the selected time in ${workspace.data.settings.timezone}` : ' immediately'}.`} onCancel={() => setConfirmationOpen(false)} onConfirm={() => { setConfirmationOpen(false); void publish() }} open={confirmationOpen} title={mode === 'now' ? 'Publish this carousel now?' : 'Schedule this carousel?'} />
    </div>
  )
}
