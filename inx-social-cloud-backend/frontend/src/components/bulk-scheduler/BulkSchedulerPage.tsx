import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../lib/api-client'
import { createBulkMediaPost, fetchBulkSchedulerData, publishBulkLibraryMedia, uploadBulkMedia } from '../../lib/bulk-scheduler-api'
import { uploadMediaAsset } from '../../lib/media-library-api'
import { buildPublishingTimes, parseCaptions } from '../../lib/bulk-scheduler-utils'
import type { BatchProgress, Destination, MediaKind, SelectedMedia, TimingMode, UploadResult } from '../../types/bulk-scheduler'
import { backendStatusToUploadStatus } from '../../types/bulk-scheduler'
import { BatchRunPanel } from './BatchRunPanel'
import { BulkSchedulerHero } from './BulkSchedulerHero'
import { PublishingDestinationsPanel } from './PublishingDestinationsPanel'
import { UploadBatchPanel } from './UploadBatchPanel'
import { useBulkSchedulerActivity } from './bulk-scheduler-activity-store'
import { PublishConfirmationDialog } from '../ui/PublishConfirmationDialog'

const idleProgress: BatchProgress = { state: 'idle', percent: 0, current: 0, total: 0, completed: 0, failed: 0, message: 'Select destinations and media, add captions, then choose a timing mode.' }

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

function mediaKind(file: File): MediaKind | null {
  if (/^image\/(png|jpeg|webp)$/i.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name)) return 'image'
  if (/^video\//i.test(file.type) || /\.(mp4|mov|m4v|avi|mkv|webm)$/i.test(file.name)) return 'video'
  return null
}

function mediaMimeType(file: File) {
  if (file.type) return file.type
  if (/\.png$/i.test(file.name)) return 'image/png'
  if (/\.jpe?g$/i.test(file.name)) return 'image/jpeg'
  if (/\.webp$/i.test(file.name)) return 'image/webp'
  return 'application/octet-stream'
}

export function BulkSchedulerPage() {
  const { registerStop, update: updateActivity } = useBulkSchedulerActivity()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [media, setMedia] = useState<SelectedMedia[]>([])
  const mediaRef = useRef<SelectedMedia[]>([])
  const [captions, setCaptions] = useState('')
  const [timingMode, setTimingMode] = useState<TimingMode | ''>('')
  const [scheduleDate, setScheduleDate] = useState(initialDate)
  const [scheduleTimes, setScheduleTimes] = useState<string[]>(['10:00'])
  const [useFallback, setUseFallback] = useState(false)
  const [retainMedia, setRetainMedia] = useState(false)
  const [progress, setProgress] = useState<BatchProgress>(idleProgress)
  const [results, setResults] = useState<UploadResult[]>([])
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const destinationSection = useRef<HTMLDivElement>(null)
  const running = ['preparing', 'uploading', 'scheduling'].includes(progress.state)
  const stopUpload = useCallback(() => abortRef.current?.abort(), [])

  const scheduler = useQuery({
    queryKey: ['bulk-scheduler'],
    queryFn: fetchBulkSchedulerData,
    refetchInterval: results.some((result) => result.status === 'uploading') ? 8_000 : false,
  })
  const destinations = useMemo(() => pageDestinations(scheduler.data?.pages || []), [scheduler.data?.pages])
  const captionBlocks = useMemo(() => parseCaptions(captions), [captions])
  const activeScheduleTimes = timingMode === 'saved_schedule' ? scheduler.data?.settings.defaultScheduleTimes || ['10:00'] : scheduleTimes

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
    mediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    abortRef.current?.abort()
  }, [])

  useEffect(() => {
    updateActivity(progress)
  }, [progress, updateActivity])

  useEffect(() => {
    registerStop(stopUpload)
    return () => registerStop(null)
  }, [registerStop, stopUpload])

  useEffect(() => {
    if (!running) return
    const warnBeforeClose = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    type WakeLockHandle = { release: () => Promise<void> }
    const wakeLockApi = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockHandle> } }).wakeLock
    let lock: WakeLockHandle | null = null
    window.addEventListener('beforeunload', warnBeforeClose)
    if (wakeLockApi) void wakeLockApi.request('screen').then((value) => { lock = value }).catch(() => {})
    return () => {
      window.removeEventListener('beforeunload', warnBeforeClose)
      if (lock) void lock.release().catch(() => {})
    }
  }, [running])

  const canUseFallback = captionBlocks.length > 0 && useFallback
  const disabledReason = !selectedIds.size
    ? 'Select at least one connected destination.'
    : !media.length
      ? 'Select one or more image or video files.'
      : !captionBlocks.length
        ? 'Add at least one caption.'
        : captionBlocks.length < media.length && !canUseFallback
          ? 'Add matching captions or confirm the fallback caption.'
          : !timingMode
            ? 'Choose a timing mode.'
            : timingMode !== 'publish_now' && (!scheduleDate || !activeScheduleTimes.length)
              ? 'Choose a start date and add at least one publishing time.'
              : ''
  const canStart = !disabledReason && !running

  const selectMedia = (files: File[]) => {
    const valid = files.flatMap((file) => {
      const kind = mediaKind(file)
      const withinLimit = kind === 'image' ? file.size <= 15 * 1024 * 1024 : file.size <= 10 * 1024 * 1024 * 1024
      return kind && file.size > 0 && withinLimit ? [{ file, kind }] : []
    })
    mediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    const next = valid.map(({ file, kind }) => ({ id: crypto.randomUUID(), libraryAssetId: null, file, kind, previewUrl: URL.createObjectURL(file) }))
    mediaRef.current = next
    setMedia(next)
    setResults([])
    setRetainMedia(false)
    const rejected = files.length - valid.length
    setProgress(rejected ? { ...idleProgress, state: 'failed', message: `${rejected} unsupported, empty or oversized file${rejected === 1 ? ' was' : 's were'} not added. Images may be PNG, JPEG or WebP up to 15 MB; videos may be MP4, MOV or WebM.` } : idleProgress)
  }

  const clearSession = () => {
    mediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    mediaRef.current = []
    setMedia([])
    setCaptions('')
    setTimingMode('')
    setScheduleTimes(['10:00'])
    setUseFallback(false)
    setRetainMedia(false)
    setResults([])
    setConfirmationOpen(false)
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
      publishingTimes = buildPublishingTimes({ mode: timingMode as TimingMode, mediaCount: media.length, date: scheduleDate, dailyTimes: activeScheduleTimes, timezone: scheduler.data.settings.timezone })
    } catch (error) {
      setProgress({ ...idleProgress, state: 'failed', message: error instanceof Error ? error.message : 'The publishing schedule is invalid.' })
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    let publishingMedia = media
    try {
      if (retainMedia) {
        const storedMedia: SelectedMedia[] = []
        for (let mediaIndex = 0; mediaIndex < media.length; mediaIndex += 1) {
          const item = media[mediaIndex]
          if (controller.signal.aborted) throw new DOMException('Upload stopped by user.', 'AbortError')
          setProgress({ state: 'uploading', percent: Math.round((mediaIndex / media.length) * 10), current: mediaIndex + 1, total: media.length, completed: 0, failed: 0, message: `Saving ${item.file.name} to Media Library for reuse…` })
          const stored = item.libraryAssetId
            ? { id: item.libraryAssetId }
            : await uploadMediaAsset(item.file, null, (percent) => setProgress({ state: 'uploading', percent: Math.round(((mediaIndex + percent / 100) / media.length) * 10), current: mediaIndex + 1, total: media.length, completed: 0, failed: 0, message: `Saving ${item.file.name} to Media Library for reuse…` }), controller.signal)
          storedMedia.push({ ...item, libraryAssetId: stored.id })
        }
        publishingMedia = storedMedia
        setMedia(storedMedia)
        mediaRef.current = storedMedia
      }
    } catch (error) {
      const stopped = error instanceof DOMException && error.name === 'AbortError'
      setProgress({ ...idleProgress, state: stopped ? 'stopped' : 'failed', message: stopped ? 'Upload stopped before reusable media storage completed.' : error instanceof Error ? error.message : 'The media could not be saved for reuse.' })
      abortRef.current = null
      return
    }

    const actions = publishingMedia.flatMap((item, mediaIndex) => destinationIds.map((destinationId) => ({ item, mediaIndex, destinationId })))
    const initialResults = actions.map((action, index): UploadResult => ({ id: `${action.item.id}:${action.destinationId}:${index}`, jobId: null, fileName: action.item.file.name, mediaKind: action.item.kind, thumbnailUrl: action.item.previewUrl, destinationIds: [action.destinationId], status: 'waiting', resultId: null, errorMessage: null, scheduledAt: publishingTimes[action.mediaIndex] }))
    setResults(initialResults)
    setProgress({ state: 'preparing', percent: 1, current: 0, total: actions.length, completed: 0, failed: 0, message: 'Preparing protected publishing jobs…' })
    let completed = 0
    let failed = 0

    for (let index = 0; index < actions.length; index += 1) {
      const action = actions[index]
      if (controller.signal.aborted) break
      const resultId = initialResults[index].id
      const caption = captionBlocks[action.mediaIndex] || captionBlocks.at(-1) || ''
      try {
        setProgress({ state: 'preparing', percent: (index / actions.length) * 100, current: index + 1, total: actions.length, completed, failed, message: `Preparing ${action.item.file.name}…` })
        const prepared = await createBulkMediaPost({
          connectedPageIds: [action.destinationId],
          clientRequestId: `bulk-${crypto.randomUUID()}`,
          title: titleFromFile(action.item.file),
          caption,
          contentType: action.item.kind === 'image' ? 'IMAGE' : 'VIDEO',
          originalFileName: action.item.file.name,
          mimeType: mediaMimeType(action.item.file),
          fileSizeBytes: action.item.file.size,
          mediaLibraryAssetId: action.item.libraryAssetId || null,
          scheduledAt: publishingTimes[action.mediaIndex],
          publishMode: timingMode === 'publish_now' ? 'NOW' : 'SCHEDULED',
        })
        const job = prepared.jobs[0]
        if (!job) throw new Error(prepared.failures[0]?.error || 'The media publishing job could not be prepared.')
        setResults((current) => current.map((result) => result.id === resultId ? { ...result, jobId: job.id, status: 'uploading' } : result))
        const uploaded = action.item.libraryAssetId
          ? await publishBulkLibraryMedia(job.id)
          : await uploadBulkMedia(job.id, action.item.file, {
              signal: controller.signal,
              onProgress: (loaded, total) => {
                const actionPart = total ? loaded / total : 0
                setProgress({ state: timingMode === 'publish_now' ? 'uploading' : 'scheduling', percent: ((index + actionPart) / actions.length) * 100, current: index + 1, total: actions.length, completed, failed, message: `${timingMode === 'publish_now' ? 'Publishing' : 'Scheduling'} ${action.item.file.name}…` })
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

  const requestStart = () => {
    if (!canStart) return
    if (scheduler.data?.settings.approvalRequired) setConfirmationOpen(true)
    else void runBatch()
  }

  if (scheduler.isPending) return <div aria-label="Loading Bulk Scheduler" className="space-y-4" role="status"><div className="h-20 animate-pulse rounded-panel bg-panel motion-reduce:animate-none" /><div className="h-36 animate-pulse rounded-panel bg-panel motion-reduce:animate-none" /><div className="h-72 animate-pulse rounded-panel bg-panel motion-reduce:animate-none" /></div>
  if (scheduler.isError) {
    const sessionRequired = scheduler.error instanceof ApiError && scheduler.error.status === 401
    return <section className="grid min-h-[60vh] place-items-center"><div className="max-w-lg rounded-panel border border-brand-red/25 bg-panel p-7 text-center shadow-panel"><AlertTriangle className="mx-auto size-8 text-brand-red" /><h1 className="mt-4 text-xl font-semibold">{sessionRequired ? 'Sign in to open Bulk Scheduler' : 'Bulk Scheduler is unavailable'}</h1><p className="mt-2 text-sm text-text-muted">{sessionRequired ? 'Your private INX Social session is required.' : scheduler.error.message}</p>{sessionRequired ? <a className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand-blue px-5 text-sm font-semibold" href="/studio/">Open sign in</a> : <button className="mt-5 rounded-xl bg-brand-blue px-5 py-3 text-sm font-semibold" onClick={() => scheduler.refetch()} type="button">Retry</button>}</div></section>
  }

  return (
    <div className="dashboard-canvas">
      <BulkSchedulerHero
        onOpen={() => destinationSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        onStop={stopUpload}
        running={running}
      />
      <div className="mt-4 scroll-mt-24" ref={destinationSection}><PublishingDestinationsPanel destinations={destinations} onSelectionChange={setSelectedIds} platforms={scheduler.data.platforms} selectedIds={selectedIds} /></div>
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)]">
        <UploadBatchPanel canStart={canStart} captionCount={captionBlocks.length} captions={captions} disabledReason={disabledReason} media={media} onCaptionFile={(file) => { void readCaptionFile(file).catch((error) => setProgress({ ...idleProgress, state: 'failed', message: error.message })) }} onCaptionsChange={setCaptions} onClear={clearSession} onFallbackChange={setUseFallback} onMedia={selectMedia} onRetainMediaChange={setRetainMedia} onScheduleDateChange={setScheduleDate} onScheduleTimeAdd={(time) => setScheduleTimes((current) => [...new Set([...current, time])].sort())} onScheduleTimeRemove={(time) => setScheduleTimes((current) => current.filter((value) => value !== time))} onStart={requestStart} onTimingModeChange={setTimingMode} retainMedia={retainMedia} running={running} savedScheduleTimes={scheduler.data.settings.defaultScheduleTimes} scheduleDate={scheduleDate} scheduleTimes={activeScheduleTimes} selectedDestinations={selectedIds.size} timezone={scheduler.data.settings.timezone} timingMode={timingMode} useFallback={useFallback} />
        <BatchRunPanel canStart={canStart} destinations={destinations} disabledReason={disabledReason} onStart={requestStart} onStop={stopUpload} progress={progress} results={results} running={running} />
      </div>
      <PublishConfirmationDialog busy={running} confirmLabel={timingMode === 'publish_now' ? 'Publish batch' : 'Schedule batch'} description={`You are about to ${timingMode === 'publish_now' ? 'publish' : 'schedule'} ${media.length} media file${media.length === 1 ? '' : 's'} across ${selectedIds.size} destination${selectedIds.size === 1 ? '' : 's'}.`} onCancel={() => setConfirmationOpen(false)} onConfirm={() => { setConfirmationOpen(false); void runBatch() }} open={confirmationOpen} title="Confirm this bulk publishing action" />
    </div>
  )
}
