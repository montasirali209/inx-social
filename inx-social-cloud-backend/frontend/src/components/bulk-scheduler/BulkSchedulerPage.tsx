import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, RefreshCw, Square } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../lib/api-client'
import { createBulkDraft, fetchBulkSchedulerData, fetchFacebookScheduledPosts, uploadBulkVideo } from '../../lib/bulk-scheduler-api'
import { buildPublishingTimes, parseCaptions } from '../../lib/bulk-scheduler-utils'
import type { BatchProgress, Destination, SelectedVideo, TimingMode, UploadResult } from '../../types/bulk-scheduler'
import { backendStatusToUploadStatus } from '../../types/bulk-scheduler'
import { BatchRunPanel } from './BatchRunPanel'
import { BulkSchedulerHero } from './BulkSchedulerHero'
import { PublishingDestinationsPanel } from './PublishingDestinationsPanel'
import { UploadBatchPanel } from './UploadBatchPanel'

const idleProgress: BatchProgress = { state: 'idle', percent: 0, current: 0, total: 0, completed: 0, failed: 0, message: 'Select destinations and videos, add captions, then choose a timing mode.' }

function initialDate() {
  const date = new Date(Date.now() + 24 * 60 * 60_000)
  return date.toISOString().slice(0, 10)
}

function pageDestinations(pages: Awaited<ReturnType<typeof fetchBulkSchedulerData>>['pages']): Destination[] {
  return pages.map((page) => ({
    id: page.id,
    name: page.facebookPageName,
    handle: page.facebookPageUsername ? `@${page.facebookPageUsername.replace(/^@/, '')}` : null,
    platform: 'facebook',
    type: page.facebookCategory ? `Facebook Page · ${page.facebookCategory}` : 'Facebook Page',
    avatarUrl: page.facebookPagePicture || null,
    connected: page.status === 'ACTIVE',
    disabledReason: page.status === 'ACTIVE' ? null : page.lastError || 'Reconnect required',
  }))
}

function titleFromFile(file: File) {
  return file.name.replace(/\.[^.]+$/, '').slice(0, 200)
}

export function BulkSchedulerPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [videos, setVideos] = useState<SelectedVideo[]>([])
  const videosRef = useRef<SelectedVideo[]>([])
  const [captions, setCaptions] = useState('')
  const [timingMode, setTimingMode] = useState<TimingMode | ''>('')
  const [scheduleDate, setScheduleDate] = useState(initialDate)
  const [scheduleTime, setScheduleTime] = useState('10:00')
  const [useFallback, setUseFallback] = useState(false)
  const [progress, setProgress] = useState<BatchProgress>(idleProgress)
  const [results, setResults] = useState<UploadResult[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const destinationSection = useRef<HTMLDivElement>(null)
  const running = ['preparing', 'uploading', 'scheduling'].includes(progress.state)

  const scheduler = useQuery({
    queryKey: ['bulk-scheduler'],
    queryFn: fetchBulkSchedulerData,
    refetchInterval: results.some((result) => result.status === 'uploading') ? 8_000 : false,
  })
  const destinations = useMemo(() => pageDestinations(scheduler.data?.pages || []), [scheduler.data?.pages])
  const captionBlocks = useMemo(() => parseCaptions(captions), [captions])

  useEffect(() => {
    if (!scheduler.data?.jobs.length || !results.length) return
    setResults((current) => current.map((result) => {
      if (!result.jobId) return result
      const job = scheduler.data.jobs.find((candidate) => candidate.id === result.jobId)
      if (!job) return result
      return { ...result, status: backendStatusToUploadStatus(job.status), resultId: job.metaPostId || job.metaVideoId || result.resultId, errorMessage: job.errorMessage || result.errorMessage }
    }))
  }, [scheduler.data?.jobs, results.length])

  useEffect(() => () => {
    videosRef.current.forEach((video) => URL.revokeObjectURL(video.previewUrl))
    abortRef.current?.abort()
  }, [])

  const canUseFallback = captionBlocks.length > 0 && useFallback
  const dateNeeded = timingMode === 'schedule_time' || timingMode === 'spread_across_days'
  const disabledReason = !selectedIds.size
    ? 'Select at least one connected destination.'
    : !videos.length
      ? 'Select one or more video files.'
      : !captionBlocks.length
        ? 'Add at least one caption.'
        : captionBlocks.length < videos.length && !canUseFallback
          ? 'Add matching captions or confirm the fallback caption.'
          : !timingMode
            ? 'Choose a timing mode.'
            : dateNeeded && (!scheduleDate || !scheduleTime)
              ? 'Choose a future start date and time.'
              : ''
  const canStart = !disabledReason && !running

  const selectVideos = (files: File[]) => {
    const valid = files.filter((file) => file.size > 0 && file.size <= 10 * 1024 * 1024 * 1024 && (/^video\//.test(file.type) || /\.(mp4|mov|m4v|avi|mkv|webm)$/i.test(file.name)))
    videosRef.current.forEach((video) => URL.revokeObjectURL(video.previewUrl))
    const next = valid.map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) }))
    videosRef.current = next
    setVideos(next)
    setResults([])
    setProgress(idleProgress)
  }

  const clearSession = () => {
    videosRef.current.forEach((video) => URL.revokeObjectURL(video.previewUrl))
    videosRef.current = []
    setVideos([])
    setCaptions('')
    setTimingMode('')
    setUseFallback(false)
    setResults([])
    setProgress(idleProgress)
  }

  const readCaptionFile = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) throw new Error('Caption files must be smaller than 2 MB.')
    setCaptions(await file.text())
  }

  const runBatch = async () => {
    if (!canStart || !scheduler.data) return
    const destinationIds = [...selectedIds]
    let publishingTimes: Array<string | null>
    try {
      let externalScheduledAt: string[] = []
      if (timingMode === 'next_available_slots') {
        setProgress({ state: 'preparing', percent: 1, current: 0, total: videos.length * destinationIds.length, completed: 0, failed: 0, message: 'Checking the selected Facebook Pages for occupied Meta schedule slots…' })
        const liveSchedules = await Promise.all(destinationIds.map((destinationId) => fetchFacebookScheduledPosts(destinationId)))
        externalScheduledAt = liveSchedules.flatMap((response) => response.result.data
          .map((post) => post.scheduled_publish_time ? new Date(post.scheduled_publish_time * 1000).toISOString() : null)
          .filter((value): value is string => Boolean(value)))
      }
      publishingTimes = buildPublishingTimes({ mode: timingMode as TimingMode, videoCount: videos.length, date: scheduleDate, time: scheduleTime, jobs: scheduler.data.jobs, destinationIds, externalScheduledAt })
    } catch (error) {
      setProgress({ ...idleProgress, state: 'failed', message: error instanceof Error ? error.message : 'The publishing schedule is invalid.' })
      return
    }

    const actions = videos.flatMap((video, videoIndex) => destinationIds.map((destinationId) => ({ video, videoIndex, destinationId })))
    const initialResults = actions.map((action, index): UploadResult => ({ id: `${action.video.id}:${action.destinationId}:${index}`, jobId: null, videoName: action.video.file.name, thumbnailUrl: action.video.previewUrl, destinationIds: [action.destinationId], status: 'waiting', resultId: null, errorMessage: null, scheduledAt: publishingTimes[action.videoIndex] }))
    setResults(initialResults)
    setProgress({ state: 'preparing', percent: 1, current: 0, total: actions.length, completed: 0, failed: 0, message: 'Preparing protected publishing jobs…' })
    const controller = new AbortController()
    abortRef.current = controller
    let completed = 0
    let failed = 0

    for (let index = 0; index < actions.length; index += 1) {
      const action = actions[index]
      if (controller.signal.aborted) break
      const resultId = initialResults[index].id
      const caption = captionBlocks[action.videoIndex] || captionBlocks.at(-1) || ''
      try {
        setProgress({ state: 'preparing', percent: (index / actions.length) * 100, current: index + 1, total: actions.length, completed, failed, message: `Preparing ${action.video.file.name}…` })
        const draft = await createBulkDraft({
          connectedPageId: action.destinationId,
          clientRequestId: `bulk-${crypto.randomUUID()}`,
          title: titleFromFile(action.video.file),
          caption,
          originalFileName: action.video.file.name,
          mimeType: action.video.file.type || 'application/octet-stream',
          fileSizeBytes: action.video.file.size,
          scheduledAt: publishingTimes[action.videoIndex],
          publishMode: timingMode === 'publish_now' ? 'NOW' : 'SCHEDULED',
        })
        if (!draft.uploadUrl) throw new Error('The prepared job did not return a secure upload route.')
        setResults((current) => current.map((result) => result.id === resultId ? { ...result, jobId: draft.job.id, status: 'uploading' } : result))
        const uploaded = await uploadBulkVideo(draft.uploadUrl, action.video.file, {
          signal: controller.signal,
          onProgress: (loaded, total) => {
            const actionPart = total ? loaded / total : 0
            setProgress({ state: timingMode === 'publish_now' ? 'uploading' : 'scheduling', percent: ((index + actionPart) / actions.length) * 100, current: index + 1, total: actions.length, completed, failed, message: `${timingMode === 'publish_now' ? 'Publishing' : 'Scheduling'} ${action.video.file.name}…` })
          },
        })
        completed += 1
        setResults((current) => current.map((result) => result.id === resultId ? { ...result, status: backendStatusToUploadStatus(uploaded.job.status), resultId: uploaded.job.metaPostId || uploaded.job.metaVideoId || null, errorMessage: null } : result))
      } catch (error) {
        const stopped = error instanceof DOMException && error.name === 'AbortError'
        if (stopped) {
          setResults((current) => current.map((result) => result.id === resultId ? { ...result, status: 'blocked', errorMessage: 'Stopped safely before the upload completed.' } : result))
          break
        }
        failed += 1
        setResults((current) => current.map((result) => result.id === resultId ? { ...result, status: 'failed', errorMessage: error instanceof Error ? error.message : 'Upload failed.' } : result))
      }
    }

    const stopped = controller.signal.aborted
    if (stopped) setResults((current) => current.map((result) => result.status === 'waiting' ? { ...result, status: 'blocked', errorMessage: 'Not started because the batch was stopped.' } : result))
    setProgress({ state: stopped ? 'stopped' : failed === actions.length ? 'failed' : 'completed', percent: stopped ? ((completed + failed) / actions.length) * 100 : 100, current: completed + failed, total: actions.length, completed, failed, message: stopped ? 'Upload stopped. Unstarted actions were blocked safely.' : failed ? `Batch finished with ${failed} failed action${failed === 1 ? '' : 's'}.` : 'Every file was accepted. Meta verification continues in the live result rows.' })
    abortRef.current = null
    scheduler.refetch()
  }

  if (scheduler.isPending) return <div aria-label="Loading Bulk Scheduler" className="space-y-4" role="status"><div className="h-20 animate-pulse rounded-panel bg-panel motion-reduce:animate-none" /><div className="h-36 animate-pulse rounded-panel bg-panel motion-reduce:animate-none" /><div className="h-72 animate-pulse rounded-panel bg-panel motion-reduce:animate-none" /></div>
  if (scheduler.isError) {
    const sessionRequired = scheduler.error instanceof ApiError && scheduler.error.status === 401
    return <section className="grid min-h-[60vh] place-items-center"><div className="max-w-lg rounded-panel border border-brand-red/25 bg-panel p-7 text-center shadow-panel"><AlertTriangle className="mx-auto size-8 text-brand-red" /><h1 className="mt-4 text-xl font-semibold">{sessionRequired ? 'Sign in to open Bulk Scheduler' : 'Bulk Scheduler is unavailable'}</h1><p className="mt-2 text-sm text-text-muted">{sessionRequired ? 'Your private INX Social session is required.' : scheduler.error.message}</p>{sessionRequired ? <a className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand-blue px-5 text-sm font-semibold" href="/studio/">Open sign in</a> : <button className="mt-5 rounded-xl bg-brand-blue px-5 py-3 text-sm font-semibold" onClick={() => scheduler.refetch()} type="button">Retry</button>}</div></section>
  }

  return (
    <div className="dashboard-canvas">
      <header className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Bulk Scheduler</h1><p className="mt-1 text-sm text-text-muted">Publish video batches across one or several connected social media platforms.</p></div>
        <div className="flex flex-wrap gap-2">
          <label className="relative"><span className="sr-only">Theme</span><select className="min-h-10 appearance-none rounded-xl border border-border-soft bg-panel px-3 pr-9 text-xs font-semibold focus:border-brand-blue focus:outline-none" defaultValue="midnight"><option value="midnight">Theme · Midnight</option></select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-text-soft" /></label>
          <button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border-soft bg-panel px-3 text-xs font-semibold transition hover:border-brand-blue/45 hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-brand-cyan" disabled={scheduler.isFetching} onClick={() => scheduler.refetch()} type="button"><RefreshCw aria-hidden="true" className={`size-4 ${scheduler.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} /> Refresh</button>
          <button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-blue/50 bg-gradient-to-r from-brand-blue to-[#0f8f7f] px-4 text-xs font-semibold text-white shadow-glow-blue transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={() => destinationSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} type="button">Open Bulk Scheduler</button>
          {running && <button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-red/45 bg-brand-red/15 px-4 text-xs font-semibold text-brand-red focus-visible:outline-2 focus-visible:outline-brand-red" onClick={() => abortRef.current?.abort()} type="button"><Square aria-hidden="true" className="size-3 fill-current" /> Stop Scheduler</button>}
        </div>
      </header>
      <BulkSchedulerHero />
      <div className="mt-4 scroll-mt-24" ref={destinationSection}><PublishingDestinationsPanel destinations={destinations} onSelectionChange={setSelectedIds} platforms={scheduler.data.platforms} selectedIds={selectedIds} /></div>
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)]">
        <UploadBatchPanel canStart={canStart} captionCount={captionBlocks.length} captions={captions} disabledReason={disabledReason} onCaptionFile={(file) => { void readCaptionFile(file).catch((error) => setProgress({ ...idleProgress, state: 'failed', message: error.message })) }} onCaptionsChange={setCaptions} onClear={clearSession} onFallbackChange={setUseFallback} onScheduleDateChange={setScheduleDate} onScheduleTimeChange={setScheduleTime} onStart={() => void runBatch()} onTimingModeChange={setTimingMode} onVideos={selectVideos} running={running} scheduleDate={scheduleDate} scheduleTime={scheduleTime} selectedDestinations={selectedIds.size} timingMode={timingMode} useFallback={useFallback} videos={videos} />
        <BatchRunPanel canStart={canStart} destinations={destinations} disabledReason={disabledReason} onStart={() => void runBatch()} onStop={() => abortRef.current?.abort()} progress={progress} results={results} running={running} />
      </div>
    </div>
  )
}
