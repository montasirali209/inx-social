import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../lib/api-client'
import { createBulkMediaPost, fetchBulkSchedulerData, optimiseBulkScheduleTimes, publishBulkLibraryMedia, saveBulkScheduleTimes, uploadBulkMedia } from '../../lib/bulk-scheduler-api'
import { bulkCancelScheduledPosts, bulkEditScheduledPosts, retryFailedScheduledPost } from '../../lib/posts-api'
import { getAIPostCampaign, getAIPostCampaigns } from '../../lib/ai-content-studio-api'
import { fetchMediaAssetFile, fetchMediaLibrary, uploadMediaAsset } from '../../lib/media-library-api'
import { buildPublishingTimes, isLikelyTransportFailure, parseCaptions, parseTextPosts } from '../../lib/bulk-scheduler-utils'
import { applyBulkScheduleEdit, applyBulkTextEdit, earliestLocalDate, hasTextRuleChanges, type BulkScheduledEditRules } from '../../lib/bulk-text-edit'
import type { BatchProgress, BulkContentMode, BulkSchedulerData, MediaKind, SelectedMedia, TimingMode, UploadResult } from '../../types/bulk-scheduler'
import type { MediaAsset } from '../../types/media-library'
import type { DashboardJob } from '../../types/dashboard'
import type { AIPostCampaign } from '../../types/ai-content-studio'
import { backendStatusToUploadStatus } from '../../types/bulk-scheduler'
import { BatchRunPanel } from './BatchRunPanel'
import { BulkScheduleManager } from './BulkScheduleManager'
import { BulkSchedulerStats, type BulkHistoryView } from './BulkSchedulerStats'
import { BulkSchedulerHero } from './BulkSchedulerHero'
import { PublishingDestinationsPanel } from './PublishingDestinationsPanel'
import { UploadBatchPanel } from './UploadBatchPanel'
import { useBulkSchedulerActivity } from './bulk-scheduler-activity-store'
import { PublishConfirmationDialog } from '../ui/PublishConfirmationDialog'

const idleProgress: BatchProgress = { state: 'idle', percent: 0, current: 0, total: 0, completed: 0, failed: 0, message: 'Select destinations, then choose Media Posts, Text Posts or AI Campaign and configure publishing.' }

const TEXT_POST_PLATFORMS = new Set(['facebook', 'x', 'linkedin', 'threads', 'bluesky'])
const ACTIVE_AI_CAMPAIGN_KEY = 'inx-social-bulk-ai-campaign-v1'

const immediateSchedulerData: BulkSchedulerData = {
  destinations: [],
  platforms: [],
  jobs: [],
  settings: { approvalRequired: false, defaultScheduleTimes: ['10:00'], timezone: 'Europe/London' },
}

function initialDate() {
  const date = new Date(Date.now() + 24 * 60 * 60_000)
  return date.toISOString().slice(0, 10)
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

type ImportedMixedCampaignItem = {
  id: string
  sequence: number
  contentType: 'TEXT' | 'IMAGE'
  caption: string
  media: SelectedMedia | null
}

type ImportedMixedCampaign = {
  id: string
  title: string
  posts: ImportedMixedCampaignItem[]
}

export function BulkSchedulerPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { registerStop, update: updateActivity } = useBulkSchedulerActivity()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [contentMode, setContentMode] = useState<BulkContentMode>('media')
  const [workspaceMode, setWorkspaceMode] = useState<'media' | 'text' | 'campaign'>('media')
  const [media, setMedia] = useState<SelectedMedia[]>([])
  const mediaRef = useRef<SelectedMedia[]>([])
  const [captions, setCaptions] = useState('')
  const [timingMode, setTimingMode] = useState<TimingMode | ''>('')
  const [scheduleDate, setScheduleDate] = useState(initialDate)
  const [scheduleTimes, setScheduleTimes] = useState<string[]>(['10:00'])
  const [useFallback, setUseFallback] = useState(false)
  const [retainMedia, setRetainMedia] = useState(false)
  const [smartTiming, setSmartTiming] = useState(false)
  const [progress, setProgress] = useState<BatchProgress>(idleProgress)
  const [results, setResults] = useState<UploadResult[]>([])
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [historyView, setHistoryView] = useState<BulkHistoryView | null>(null)
  const [mixedCampaign, setMixedCampaign] = useState<ImportedMixedCampaign | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const importedLibrarySelection = useRef('')
  const importedCampaignSelection = useRef('')
  const importedMixedCampaignSelection = useRef('')
  const importedPersistentCampaignSelection = useRef('')
  const restoredCampaignSelection = useRef(false)
  const destinationSection = useRef<HTMLDivElement>(null)
  const batchRunSection = useRef<HTMLDivElement>(null)
  const running = ['preparing', 'uploading', 'scheduling'].includes(progress.state)
  const stopUpload = useCallback(() => abortRef.current?.abort(), [])

  const scheduler = useQuery({
    queryKey: ['bulk-scheduler'],
    queryFn: fetchBulkSchedulerData,
    refetchInterval: results.some((result) => result.status === 'uploading' || result.status === 'checking') ? 5_000 : 15_000,
  })
  const campaignsQuery = useQuery({
    queryKey: ['ai-post-campaigns', 'bulk-scheduler'],
    queryFn: () => getAIPostCampaigns(20),
    staleTime: 5_000,
  })
  const schedulerData = scheduler.data || immediateSchedulerData
  const destinations = schedulerData.destinations
  const captionBlocks = useMemo(() => contentMode === 'text' ? parseTextPosts(captions) : parseCaptions(captions), [captions, contentMode])
  const selectedDestinations = destinations.filter((destination) => selectedIds.has(destination.id))
  const incompatibleTextDestinations = contentMode === 'text' ? selectedDestinations.filter((destination) => !TEXT_POST_PLATFORMS.has(destination.platform)) : []
  const mixedTextPosts = mixedCampaign?.posts.filter((post) => post.contentType === 'TEXT') || []
  const mixedImagePosts = mixedCampaign?.posts.filter((post) => post.contentType === 'IMAGE') || []
  const mixedTextDestinations = selectedDestinations.filter((destination) => TEXT_POST_PLATFORMS.has(destination.platform))
  const batchCount = mixedCampaign ? mixedCampaign.posts.length : contentMode === 'text' ? captionBlocks.length : media.length
  const activeScheduleTimes = timingMode === 'saved_schedule' ? schedulerData.settings.defaultScheduleTimes : scheduleTimes

  async function saveCurrentScheduleTimesForFuture() {
    const merged = [...new Set([...schedulerData.settings.defaultScheduleTimes, ...scheduleTimes])].sort()
    if (merged.length > 12) {
      throw new Error(`Saving these times would create ${merged.length} reusable posting times. Keep the saved list to 12 or fewer.`)
    }
    await saveBulkScheduleTimes(merged)
    await scheduler.refetch()
  }

  const loadSavedCampaign = useCallback(async (campaign: AIPostCampaign) => {
    const imagePosts = campaign.posts.filter((post) => post.contentType === 'IMAGE')
    const missingImages = imagePosts.filter((post) => !post.mediaAssetId)
    if (missingImages.length) {
      throw new Error(`“${campaign.title}” still needs ${missingImages.length} generated image${missingImages.length === 1 ? '' : 's'} before it can be scheduled as a complete AI campaign.`)
    }

    setProgress({ ...idleProgress, state: 'preparing', message: `Loading AI campaign “${campaign.title}”…` })
    const library = imagePosts.length ? await fetchMediaLibrary() : null
    const assetsById = new Map((library?.assets || []).map((asset) => [asset.id, asset]))

    const items = await Promise.all(campaign.posts.map(async (post): Promise<ImportedMixedCampaignItem> => {
      const tags = post.hashtags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')
      const caption = [post.hook?.trim(), post.caption.trim(), post.cta?.trim(), tags].filter(Boolean).join('\n\n')
      if (post.contentType === 'TEXT') {
        return { id: post.id, sequence: post.sequence, contentType: 'TEXT', caption, media: null }
      }

      const asset = post.mediaAssetId ? assetsById.get(post.mediaAssetId) : null
      if (!asset) throw new Error(`The generated image for post ${post.sequence} is no longer available in Media Library.`)
      const file = await fetchMediaAssetFile(asset)
      const kind = mediaKind(file)
      if (!kind) throw new Error(`${asset.fileName} is not a supported image or video.`)
      return {
        id: post.id,
        sequence: post.sequence,
        contentType: 'IMAGE',
        caption,
        media: { id: asset.id, libraryAssetId: asset.id, file, kind, previewUrl: URL.createObjectURL(file) },
      }
    }))

    mediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    const imageMedia = items.flatMap((item) => item.media ? [item.media] : [])
    mediaRef.current = imageMedia
    setMedia(imageMedia)
    setMixedCampaign({ id: campaign.id, title: campaign.title, posts: items })
    setWorkspaceMode('campaign')
    setContentMode('media')
    setCaptions('')
    setRetainMedia(true)
    setUseFallback(false)
    setResults([])
    window.localStorage.setItem(ACTIVE_AI_CAMPAIGN_KEY, campaign.id)

    const textPosts = items.filter((item) => item.contentType === 'TEXT').length
    const imageCount = items.length - textPosts
    setProgress({ ...idleProgress, state: 'completed', message: `${items.length}-post AI campaign loaded: ${textPosts} text + ${imageCount} image. Review the campaign preview, choose destinations and publishing times.` })
  }, [])

  useEffect(() => {
    if (!schedulerData.jobs.length || !results.length) return
    setResults((current) => current.map((result) => {
      const job = schedulerData.jobs.find((candidate) =>
        (result.jobId && candidate.id === result.jobId)
        || (result.clientRequestId && candidate.clientRequestId === result.clientRequestId)
      )
      if (!job) return result

      const backendStatus = backendStatusToUploadStatus(job.status)
      const acceptedNow = backendStatus === 'scheduled' || backendStatus === 'published'
      return {
        ...result,
        jobId: job.id,
        status: acceptedNow ? 'scheduled' : backendStatus,
        resultId: job.providerPostId || job.metaPostId || job.metaVideoId || result.resultId,
        errorMessage: acceptedNow ? null : job.errorMessage || result.errorMessage,
      }
    }))
  }, [schedulerData.jobs, results.length])

  useEffect(() => {
    const reconcileWhenVisible = () => {
      if (document.visibilityState === 'visible' && results.some((result) => result.status === 'checking')) {
        void scheduler.refetch()
      }
    }
    document.addEventListener('visibilitychange', reconcileWhenVisible)
    window.addEventListener('focus', reconcileWhenVisible)
    return () => {
      document.removeEventListener('visibilitychange', reconcileWhenVisible)
      window.removeEventListener('focus', reconcileWhenVisible)
    }
  }, [results, scheduler])

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

  const canUseFallback = contentMode === 'media' && captionBlocks.length > 0 && useFallback
  const disabledReason = workspaceMode === 'campaign' && !mixedCampaign
    ? 'Choose a saved AI campaign first.'
    : !selectedIds.size
      ? 'Select at least one connected destination.'
    : mixedCampaign && mixedTextPosts.length && !mixedTextDestinations.length
      ? 'This mixed campaign contains text-only posts. Select at least one destination that supports text posts, such as Facebook, X, LinkedIn, Threads or Bluesky.'
      : mixedCampaign && mixedImagePosts.some((post) => !post.media)
        ? 'One or more mixed-campaign image posts are missing their generated media.'
        : !timingMode
          ? 'Choose a timing mode.'
          : timingMode !== 'publish_now' && (!scheduleDate || !activeScheduleTimes.length)
            ? 'Choose a start date and add at least one publishing time.'
            : mixedCampaign
              ? ''
              : contentMode === 'text' && incompatibleTextDestinations.length
                ? `Text-only posts are not supported by ${incompatibleTextDestinations.map((destination) => destination.name).join(', ')}. Deselect those destinations or switch to Media Posts.`
                : contentMode === 'text' && !captionBlocks.length
                  ? 'Add at least one complete text post. Separate multiple posts with a line containing ---.'
                  : contentMode === 'media' && !media.length
                    ? 'Select one or more image or video files.'
                    : contentMode === 'media' && !captionBlocks.length
                      ? 'Add at least one caption.'
                      : contentMode === 'media' && captionBlocks.length < media.length && !canUseFallback
                        ? 'Add matching captions or confirm the fallback caption.'
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
    setMixedCampaign(null)
    setWorkspaceMode('media')
    window.localStorage.removeItem(ACTIVE_AI_CAMPAIGN_KEY)
    setResults([])
    setRetainMedia(false)
    const rejected = files.length - valid.length
    setProgress(rejected ? { ...idleProgress, state: 'failed', message: `${rejected} unsupported, empty or oversized file${rejected === 1 ? ' was' : 's were'} not added. Images may be PNG, JPEG or WebP up to 15 MB; videos may be MP4, MOV or WebM.` } : idleProgress)
  }

  useEffect(() => {
    const state = location.state as { aiCampaignId?: string } | null
    const campaignId = state?.aiCampaignId
    if (!campaignId) return
    const fingerprint = `${campaignId}:${location.key}`
    if (importedPersistentCampaignSelection.current === fingerprint) return
    importedPersistentCampaignSelection.current = fingerprint
    setWorkspaceMode('campaign')
    setProgress({ ...idleProgress, state: 'preparing', message: 'Loading saved AI campaign…' })

    void getAIPostCampaign(campaignId)
      .then((campaign) => loadSavedCampaign(campaign))
      .catch((error) => {
        importedPersistentCampaignSelection.current = ''
        setProgress({ ...idleProgress, state: 'failed', message: error instanceof Error ? error.message : 'The AI campaign could not be loaded.' })
      })
  }, [location.state, location.key, loadSavedCampaign])

  useEffect(() => {
    const routeCampaignId = (location.state as { aiCampaignId?: string } | null)?.aiCampaignId
    if (routeCampaignId || restoredCampaignSelection.current || mixedCampaign || !campaignsQuery.data) return
    restoredCampaignSelection.current = true
    const campaignId = window.localStorage.getItem(ACTIVE_AI_CAMPAIGN_KEY)
    if (!campaignId) return
    const campaign = campaignsQuery.data.find((item) => item.id === campaignId)
    if (!campaign) {
      window.localStorage.removeItem(ACTIVE_AI_CAMPAIGN_KEY)
      return
    }
    setWorkspaceMode('campaign')
    void loadSavedCampaign(campaign).catch((error) => {
      window.localStorage.removeItem(ACTIVE_AI_CAMPAIGN_KEY)
      setProgress({ ...idleProgress, state: 'failed', message: error instanceof Error ? error.message : 'The saved AI campaign could not be restored.' })
    })
  }, [campaignsQuery.data, loadSavedCampaign, location.state, mixedCampaign])

  useEffect(() => {
    const state = location.state as { aiPostCampaign?: { id: string; title: string; contentMode: 'TEXT'; captions: string[] } } | null
    const imported = state?.aiPostCampaign
    if (!imported?.id) return
    const campaignFingerprint = `${imported.id}:${location.key}`
    if (importedCampaignSelection.current === campaignFingerprint) return
    importedCampaignSelection.current = campaignFingerprint
    const blocks = (imported.captions || []).map((caption) => String(caption || '').trim()).filter(Boolean)
    if (!blocks.length) return
    setMixedCampaign(null)
    setWorkspaceMode('text')
    window.localStorage.removeItem(ACTIVE_AI_CAMPAIGN_KEY)
    setContentMode('text')
    setCaptions(blocks.join('\n\n---\n\n'))
    setMedia([])
    mediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    mediaRef.current = []
    setUseFallback(false)
    setRetainMedia(false)
    setResults([])
    setProgress({ ...idleProgress, state: 'completed', message: `${blocks.length} AI campaign posts from “${imported.title}” are ready. Choose destinations and publishing times, then schedule the campaign.` })
  }, [location.state, location.key])

  useEffect(() => {
    const state = location.state as {
      mediaLibraryAssets?: MediaAsset[]
      aiMixedCampaign?: {
        id: string
        title: string
        posts: Array<{ id: string; contentType: 'TEXT' | 'IMAGE'; caption: string; mediaAssetId: string | null }>
      }
    } | null
    const imported = state?.aiMixedCampaign
    if (!imported?.id) return
    const fingerprint = `${imported.id}:${location.key}`
    if (importedMixedCampaignSelection.current === fingerprint) return
    importedMixedCampaignSelection.current = fingerprint

    const assetsById = new Map((state?.mediaLibraryAssets || []).map((asset) => [asset.id, asset]))
    setProgress({ ...idleProgress, state: 'preparing', message: `Loading mixed AI campaign “${imported.title}”…` })

    void Promise.all(imported.posts.map(async (post, index): Promise<ImportedMixedCampaignItem> => {
      if (post.contentType === 'TEXT') return { id: post.id, sequence: index + 1, contentType: 'TEXT', caption: post.caption, media: null }
      const asset = post.mediaAssetId ? assetsById.get(post.mediaAssetId) : null
      if (!asset) throw new Error(`Generated media is missing for one of the image posts in “${imported.title}”.`)
      const file = await fetchMediaAssetFile(asset)
      const kind = mediaKind(file)
      if (!kind) throw new Error(`${asset.fileName} is not a supported image or video.`)
      return {
        id: post.id,
        sequence: index + 1,
        contentType: 'IMAGE',
        caption: post.caption,
        media: { id: asset.id, libraryAssetId: asset.id, file, kind, previewUrl: URL.createObjectURL(file) },
      }
    })).then((items) => {
      mediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
      const imageMedia = items.flatMap((item) => item.media ? [item.media] : [])
      mediaRef.current = imageMedia
      setMedia(imageMedia)
      setMixedCampaign({ id: imported.id, title: imported.title, posts: items })
      setWorkspaceMode('campaign')
      window.localStorage.setItem(ACTIVE_AI_CAMPAIGN_KEY, imported.id)
      setContentMode('media')
      setCaptions('')
      setRetainMedia(true)
      setUseFallback(false)
      setResults([])
      const textPosts = items.filter((item) => item.contentType === 'TEXT').length
      const imagePosts = items.length - textPosts
      setProgress({ ...idleProgress, state: 'completed', message: `${items.length}-post mixed AI campaign loaded: ${textPosts} text + ${imagePosts} image. Choose destinations and publishing times.` })
    }).catch((error) => {
      importedMixedCampaignSelection.current = ''
      setMixedCampaign(null)
      setProgress({ ...idleProgress, state: 'failed', message: error instanceof Error ? error.message : 'The mixed AI campaign could not be loaded.' })
    })
  }, [location.state, location.key])

  useEffect(() => {
    const state = location.state as { mediaLibraryAssets?: MediaAsset[]; aiCampaignCaptions?: string[]; aiCampaignTitle?: string; aiMixedCampaign?: unknown } | null
    if (state?.aiMixedCampaign) return
    const selectedAssets = state?.mediaLibraryAssets || []
    const fingerprint = selectedAssets.length ? `${selectedAssets.map((asset) => asset.id).join(':')}:${location.key}` : ''
    if (!fingerprint || importedLibrarySelection.current === fingerprint) return
    importedLibrarySelection.current = fingerprint
    setWorkspaceMode('media')
    window.localStorage.removeItem(ACTIVE_AI_CAMPAIGN_KEY)
    setContentMode('media')
    if (state?.aiCampaignCaptions?.length) {
      setCaptions(state.aiCampaignCaptions.map((caption) => String(caption || '').trim()).filter(Boolean).join('\n\n---\n\n'))
      setUseFallback(false)
    }
    setProgress({ ...idleProgress, state: 'preparing', message: state?.aiCampaignTitle ? `Loading ${selectedAssets.length} campaign images from “${state.aiCampaignTitle}”…` : `Loading ${selectedAssets.length} Media Library assets for separate bulk posts…` })
    void Promise.all(selectedAssets.map(async (asset): Promise<SelectedMedia> => {
      const file = await fetchMediaAssetFile(asset)
      const kind = mediaKind(file)
      if (!kind) throw new Error(`${asset.fileName} is not a supported image or video.`)
      return { id: asset.id, libraryAssetId: asset.id, file, kind, previewUrl: URL.createObjectURL(file) }
    })).then((items) => {
      mediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
      mediaRef.current = items
      setMedia(items)
      setRetainMedia(true)
      setResults([])
      setProgress({ ...idleProgress, state: 'completed', message: state?.aiCampaignTitle ? `${items.length} AI campaign image posts are ready from “${state.aiCampaignTitle}”. Choose destinations and publishing times, then schedule the campaign.` : `${items.length} Media Library assets are ready as separate bulk posts. Add one caption per asset, or enable the fallback caption.` })
    }).catch((error) => {
      importedLibrarySelection.current = ''
      setProgress({ ...idleProgress, state: 'failed', message: error instanceof Error ? error.message : 'The selected Media Library assets could not be loaded.' })
    })
  }, [location.state, location.key])

  const clearSession = () => {
    mediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    mediaRef.current = []
    setMedia([])
    setMixedCampaign(null)
    window.localStorage.removeItem(ACTIVE_AI_CAMPAIGN_KEY)
    setCaptions('')
    setTimingMode('')
    setScheduleTimes(['10:00'])
    setUseFallback(false)
    setRetainMedia(false)
    setSmartTiming(false)
    setResults([])
    setConfirmationOpen(false)
    setRetryingId(null)
    setProgress(idleProgress)
  }

  const readCaptionFile = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) throw new Error('Text files must be smaller than 2 MB.')
    setCaptions(await file.text())
  }

  const changeContentMode = (value: BulkContentMode) => {
    if (running || value === contentMode) return
    setContentMode(value)
    setUseFallback(false)
    setRetainMedia(false)
    setResults([])
    setProgress(idleProgress)
  }

  const changeWorkspaceMode = (value: 'media' | 'text' | 'campaign') => {
    if (running || value === workspaceMode) return
    if (value === 'campaign') {
      setWorkspaceMode('campaign')
      setResults([])
      if (!mixedCampaign) setProgress(idleProgress)
      return
    }

    if (mixedCampaign) {
      mediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
      mediaRef.current = []
      setMedia([])
      setMixedCampaign(null)
      setCaptions('')
      window.localStorage.removeItem(ACTIVE_AI_CAMPAIGN_KEY)
    }

    setWorkspaceMode(value)
    setUseFallback(false)
    setRetainMedia(false)
    setResults([])
    setProgress(idleProgress)
    changeContentMode(value === 'text' ? 'text' : 'media')
  }

  const chooseSavedCampaign = (campaign: AIPostCampaign) => {
    if (running) return
    void loadSavedCampaign(campaign).catch((error) => {
      setMixedCampaign(null)
      window.localStorage.removeItem(ACTIVE_AI_CAMPAIGN_KEY)
      setProgress({ ...idleProgress, state: 'failed', message: error instanceof Error ? error.message : 'The AI campaign could not be loaded.' })
    })
  }

  const clearCampaignSelection = () => {
    if (running) return
    mediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    mediaRef.current = []
    setMedia([])
    setMixedCampaign(null)
    setCaptions('')
    window.localStorage.removeItem(ACTIVE_AI_CAMPAIGN_KEY)
    setTimingMode('')
    setResults([])
    setProgress(idleProgress)
    setWorkspaceMode('campaign')
  }

  const runBatch = async () => {
    if (!canStart || !scheduler.data) return
    const destinationIds = [...selectedIds]
    let publishingTimes: Array<string | null>
    let baselinePublishingTimes: Array<string | null>
    let smartTimingSource: string | null = null
    try {
      baselinePublishingTimes = buildPublishingTimes({ mode: timingMode as TimingMode, mediaCount: batchCount, date: scheduleDate, dailyTimes: activeScheduleTimes, timezone: schedulerData.settings.timezone })
      publishingTimes = [...baselinePublishingTimes]
    } catch (error) {
      setProgress({ ...idleProgress, state: 'failed', message: error instanceof Error ? error.message : 'The publishing schedule is invalid.' })
      return
    }

    if (smartTiming && timingMode !== 'publish_now') {
      const baselineTimes = baselinePublishingTimes.filter((value): value is string => Boolean(value))
      setProgress({ state: 'preparing', percent: 1, current: 0, total: batchCount, completed: 0, failed: 0, message: 'Smart Timing is analysing your account performance and selected posting windows…' })
      try {
        const optimised = await optimiseBulkScheduleTimes({
          profileIds: destinationIds,
          baselineTimes,
          timezone: schedulerData.settings.timezone,
        })
        if (optimised.times.length === baselineTimes.length) {
          publishingTimes = optimised.times
          smartTimingSource = optimised.source
        }
      } catch (error) {
        console.warn('Smart Timing could not optimise this batch; selected publishing times will be used.', error)
        publishingTimes = [...baselinePublishingTimes]
      }
    }

    const controller = new AbortController()
    abortRef.current = controller

    if (mixedCampaign) {
      const textDestinationIds = mixedTextDestinations.map((destination) => destination.id)
      const initialResults: UploadResult[] = mixedCampaign.posts.map((post, index) => {
        const targets = post.contentType === 'TEXT' ? textDestinationIds : destinationIds
        return {
          id: `mixed:${post.id}:${crypto.randomUUID()}`,
          mediaId: post.media?.id || `text:${post.id}`,
          mediaIndex: index,
          jobId: null,
          fileName: post.contentType === 'TEXT' ? `Text post ${index + 1}` : (post.media?.file.name || `Image post ${index + 1}`),
          mediaKind: post.contentType === 'TEXT' ? 'text' : (post.media?.kind || 'image'),
          thumbnailUrl: post.media?.previewUrl || '',
          textPreview: post.caption.replace(/\s+/g, ' ').slice(0, 180),
          destinationIds: targets,
          status: 'waiting',
          resultId: null,
          errorMessage: null,
          scheduledAt: publishingTimes[index],
          clientRequestId: `ai-mixed-${post.contentType.toLowerCase()}-${crypto.randomUUID()}`,
          caption: post.caption,
        }
      })
      setResults(initialResults)
      setProgress({ state: 'preparing', percent: 1, current: 0, total: mixedCampaign.posts.length, completed: 0, failed: 0, message: 'Preparing AI campaign in campaign order…' })

      let completed = 0
      let failed = 0
      let checking = 0

      for (let index = 0; index < mixedCampaign.posts.length; index += 1) {
        if (controller.signal.aborted) break
        const post = mixedCampaign.posts[index]
        const resultId = initialResults[index].id
        const targets = post.contentType === 'TEXT' ? textDestinationIds : destinationIds

        try {
          setProgress({
            state: timingMode === 'publish_now' ? 'preparing' : 'scheduling',
            percent: (index / mixedCampaign.posts.length) * 100,
            current: index + 1,
            total: mixedCampaign.posts.length,
            completed,
            failed,
            message: `${timingMode === 'publish_now' ? 'Publishing' : 'Scheduling'} ${post.contentType === 'TEXT' ? 'text' : 'image'} post ${index + 1} of ${mixedCampaign.posts.length}…`,
          })

          let finalJob
          if (post.contentType === 'TEXT') {
            const prepared = await createBulkMediaPost({
              connectedPageIds: targets,
              clientRequestId: initialResults[index].clientRequestId!,
              title: null,
              caption: post.caption,
              contentType: 'TEXT',
              originalFileName: null,
              mimeType: null,
              fileSizeBytes: null,
              mediaLibraryAssetId: null,
              scheduledAt: publishingTimes[index],
              publishMode: timingMode === 'publish_now' ? 'NOW' : 'SCHEDULED',
              smartTiming: smartTimingSource ? { enabled: true, baseScheduledAt: baselinePublishingTimes[index], source: smartTimingSource } : null,
            })
            finalJob = prepared.jobs[0]
            if (!finalJob) throw new Error(prepared.failures[0]?.error || 'The publishing provider could not create this text post.')
          } else {
            if (!post.media?.libraryAssetId) throw new Error('The generated campaign image is missing from Media Library.')
            const prepared = await createBulkMediaPost({
              connectedPageIds: targets,
              clientRequestId: initialResults[index].clientRequestId!,
              title: titleFromFile(post.media.file),
              caption: post.caption,
              contentType: 'IMAGE',
              originalFileName: post.media.file.name,
              mimeType: mediaMimeType(post.media.file),
              fileSizeBytes: post.media.file.size,
              mediaLibraryAssetId: post.media.libraryAssetId,
              scheduledAt: publishingTimes[index],
              publishMode: timingMode === 'publish_now' ? 'NOW' : 'SCHEDULED',
              smartTiming: smartTimingSource ? { enabled: true, baseScheduledAt: baselinePublishingTimes[index], source: smartTimingSource } : null,
            })
            finalJob = prepared.jobs[0]
            if (!finalJob) throw new Error(prepared.failures[0]?.error || 'The publishing provider could not create this image post.')
            if (prepared.uploadRequired) {
              const uploaded = await publishBulkLibraryMedia(finalJob.id)
              finalJob = uploaded.job
            }
          }

          completed += 1
          setResults((current) => current.map((result) => result.id === resultId ? {
            ...result,
            jobId: finalJob.id,
            status: backendStatusToUploadStatus(finalJob.status),
            resultId: finalJob.providerPostId || finalJob.metaPostId || finalJob.metaVideoId || null,
            errorMessage: null,
          } : result))
        } catch (error) {
          if (isLikelyTransportFailure(error)) {
            checking += 1
            setResults((current) => current.map((result) => result.id === resultId ? {
              ...result,
              status: 'checking',
              errorMessage: 'The mobile connection paused before the browser received the result. INXSocial is checking the server before allowing a duplicate retry.',
            } : result))
          } else {
            failed += 1
            setResults((current) => current.map((result) => result.id === resultId ? {
              ...result,
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : 'Campaign post failed.',
            } : result))
          }
        }
      }

      const stopped = controller.signal.aborted
      if (stopped) {
        setResults((current) => current.map((result) => result.status === 'waiting'
          ? { ...result, status: 'blocked', errorMessage: 'Not started because the campaign run was stopped.' }
          : result))
      }
      setProgress({
        state: stopped ? 'stopped' : failed === mixedCampaign.posts.length ? 'failed' : 'completed',
        percent: stopped ? ((completed + failed) / mixedCampaign.posts.length) * 100 : 100,
        current: completed + failed + checking,
        total: mixedCampaign.posts.length,
        completed,
        failed,
        message: stopped
          ? 'Mixed campaign stopped safely.'
          : checking
            ? `${checking} campaign post${checking === 1 ? '' : 's'} are being checked against the server after the mobile connection paused. Confirmed results will update automatically.`
          : failed
            ? `Mixed campaign finished with ${failed} failed post${failed === 1 ? '' : 's'}.`
            : timingMode === 'publish_now'
              ? `${completed} campaign post${completed === 1 ? '' : 's'} accepted for publishing.`
              : `${completed} campaign post${completed === 1 ? '' : 's'} scheduled in campaign order.`,
      })
      abortRef.current = null
      await scheduler.refetch()
      return
    }

    if (contentMode === 'text') {
      const initialResults: UploadResult[] = captionBlocks.map((post, index) => ({
        id: `text:${index}:${crypto.randomUUID()}`,
        mediaId: `text:${index}`,
        mediaIndex: index,
        jobId: null,
        fileName: `Text post ${index + 1}`,
        mediaKind: 'text',
        thumbnailUrl: '',
        textPreview: post.replace(/\s+/g, ' ').slice(0, 180),
        destinationIds,
        status: 'waiting',
        resultId: null,
        errorMessage: null,
        scheduledAt: publishingTimes[index],
        clientRequestId: `bulk-text-${crypto.randomUUID()}`,
        caption: post,
      }))
      setResults(initialResults)
      setProgress({ state: 'preparing', percent: 1, current: 0, total: captionBlocks.length, completed: 0, failed: 0, message: 'Preparing text posts for publishing provider…' })
      let completed = 0
      let failed = 0
      let checking = 0

      for (let index = 0; index < captionBlocks.length; index += 1) {
        if (controller.signal.aborted) break
        const post = captionBlocks[index]
        const resultId = initialResults[index].id
        try {
          setProgress({ state: timingMode === 'publish_now' ? 'preparing' : 'scheduling', percent: (index / captionBlocks.length) * 100, current: index + 1, total: captionBlocks.length, completed, failed, message: `${timingMode === 'publish_now' ? 'Publishing' : 'Scheduling'} text post ${index + 1} of ${captionBlocks.length}…` })
          const prepared = await createBulkMediaPost({
            connectedPageIds: destinationIds,
            clientRequestId: initialResults[index].clientRequestId!,
            title: null,
            caption: post,
            contentType: 'TEXT',
            originalFileName: null,
            mimeType: null,
            fileSizeBytes: null,
            mediaLibraryAssetId: null,
            scheduledAt: publishingTimes[index],
            publishMode: timingMode === 'publish_now' ? 'NOW' : 'SCHEDULED',
            smartTiming: smartTimingSource ? { enabled: true, baseScheduledAt: baselinePublishingTimes[index], source: smartTimingSource } : null,
          })
          const job = prepared.jobs[0]
          if (!job) throw new Error(prepared.failures[0]?.error || 'publishing provider could not create this text post.')
          completed += 1
          setResults((current) => current.map((result) => result.id === resultId ? {
            ...result,
            jobId: job.id,
            status: backendStatusToUploadStatus(job.status),
            resultId: job.providerPostId || job.metaPostId || null,
            errorMessage: prepared.failures.length ? prepared.failures.map((failure) => failure.error).join(' · ') : null,
          } : result))
        } catch (error) {
          if (isLikelyTransportFailure(error)) {
            checking += 1
            setResults((current) => current.map((result) => result.id === resultId ? {
              ...result,
              status: 'checking',
              errorMessage: 'The mobile connection paused before the browser received the result. INXSocial is checking the server before allowing a duplicate retry.',
            } : result))
          } else {
            failed += 1
            setResults((current) => current.map((result) => result.id === resultId ? {
              ...result,
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : 'Text post failed.',
            } : result))
          }
        }
      }

      const stopped = controller.signal.aborted
      if (stopped) setResults((current) => current.map((result) => result.status === 'waiting' ? { ...result, status: 'blocked', errorMessage: 'Not started because the batch was stopped.' } : result))
      setProgress({
        state: stopped ? 'stopped' : failed === captionBlocks.length ? 'failed' : 'completed',
        percent: stopped ? ((completed + failed) / captionBlocks.length) * 100 : 100,
        current: completed + failed + checking,
        total: captionBlocks.length,
        completed,
        failed,
        message: stopped
          ? 'Text batch stopped. Unstarted posts were blocked safely.'
          : checking
            ? `${checking} text post${checking === 1 ? '' : 's'} are being checked against the server after the mobile connection paused. Confirmed results will update automatically.`
          : failed
            ? `Text batch finished with ${failed} failed post${failed === 1 ? '' : 's'}.`
            : timingMode === 'publish_now'
              ? `${completed} text post${completed === 1 ? '' : 's'} accepted for publishing.`
              : smartTimingSource
                ? `${completed} text post${completed === 1 ? '' : 's'} scheduled with Smart Timing. Exact times are visible in Calendar.`
                : `${completed} text post${completed === 1 ? '' : 's'} scheduled with publishing provider using your selected daily times.`,
      })
      abortRef.current = null
      await scheduler.refetch()
      return
    }

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

    const actions = publishingMedia.map((item, mediaIndex) => ({ item, mediaIndex }))
    const initialResults = actions.map((action, index): UploadResult => ({
      id: `${action.item.id}:${index}`,
      mediaId: action.item.id,
      mediaIndex: action.mediaIndex,
      jobId: null,
      fileName: action.item.file.name,
      mediaKind: action.item.kind,
      thumbnailUrl: action.item.previewUrl,
      destinationIds,
      status: 'waiting',
      resultId: null,
      errorMessage: null,
      scheduledAt: publishingTimes[action.mediaIndex],
      clientRequestId: `bulk-${crypto.randomUUID()}`,
      caption: captionBlocks[action.mediaIndex] || captionBlocks.at(-1) || '',
    }))
    setResults(initialResults)
    setProgress({ state: 'preparing', percent: 1, current: 0, total: actions.length, completed: 0, failed: 0, message: 'Preparing publishing provider publishing records…' })
    let completed = 0
    let failed = 0
    let checking = 0

    for (let index = 0; index < actions.length; index += 1) {
      const action = actions[index]
      if (controller.signal.aborted) break
      const resultId = initialResults[index].id
      const caption = captionBlocks[action.mediaIndex] || captionBlocks.at(-1) || ''
      try {
        setProgress({ state: 'preparing', percent: (index / actions.length) * 100, current: index + 1, total: actions.length, completed, failed, message: `Preparing ${action.item.file.name}…` })
        const prepared = await createBulkMediaPost({
          connectedPageIds: destinationIds,
          clientRequestId: initialResults[index].clientRequestId!,
          title: titleFromFile(action.item.file),
          caption,
          contentType: action.item.kind === 'image' ? 'IMAGE' : 'VIDEO',
          originalFileName: action.item.file.name,
          mimeType: mediaMimeType(action.item.file),
          fileSizeBytes: action.item.file.size,
          mediaLibraryAssetId: action.item.libraryAssetId || null,
          scheduledAt: publishingTimes[action.mediaIndex],
          publishMode: timingMode === 'publish_now' ? 'NOW' : 'SCHEDULED',
          smartTiming: smartTimingSource ? { enabled: true, baseScheduledAt: baselinePublishingTimes[action.mediaIndex], source: smartTimingSource } : null,
        })
        const job = prepared.jobs[0]
        if (!job) throw new Error(prepared.failures[0]?.error || 'publishing provider could not prepare this publishing record.')
        setResults((current) => current.map((result) => result.id === resultId ? {
          ...result,
          jobId: job.id,
          status: prepared.uploadRequired ? 'uploading' : backendStatusToUploadStatus(job.status),
          errorMessage: prepared.failures.length ? prepared.failures.map((failure) => failure.error).join(' · ') : null,
        } : result))

        let finalJob = job
        if (prepared.uploadRequired) {
          const uploaded = action.item.libraryAssetId
            ? await publishBulkLibraryMedia(job.id)
            : await uploadBulkMedia(job.id, action.item.file, {
                signal: controller.signal,
                onProgress: (loaded, total) => {
                  const actionPart = total ? loaded / total : 0
                  setProgress({
                    state: timingMode === 'publish_now' ? 'uploading' : 'scheduling',
                    percent: ((index + actionPart) / actions.length) * 100,
                    current: index + 1,
                    total: actions.length,
                    completed,
                    failed,
                    message: timingMode === 'publish_now'
                      ? `Publishing ${action.item.file.name}…`
                      : `Uploading ${action.item.file.name} to the publishing provider schedule…`,
                  })
                },
              })
          finalJob = uploaded.job
        }

        completed += 1
        setResults((current) => current.map((result) => result.id === resultId ? {
          ...result,
          status: backendStatusToUploadStatus(finalJob.status),
          resultId: finalJob.providerPostId || finalJob.metaPostId || finalJob.metaVideoId || null,
          errorMessage: prepared.failures.length ? prepared.failures.map((failure) => failure.error).join(' · ') : null,
        } : result))
      } catch (error) {
        const stopped = error instanceof DOMException && error.name === 'AbortError'
        if (stopped) {
          setResults((current) => current.map((result) => result.id === resultId ? { ...result, status: 'blocked', errorMessage: 'Stopped safely before the upload completed.' } : result))
          break
        }
        if (isLikelyTransportFailure(error)) {
          checking += 1
          setResults((current) => current.map((result) => result.id === resultId ? {
            ...result,
            status: 'checking',
            errorMessage: 'The mobile connection paused before the browser received the result. INXSocial is checking the server before allowing a duplicate retry.',
          } : result))
        } else {
          failed += 1
          setResults((current) => current.map((result) => result.id === resultId ? { ...result, status: 'failed', errorMessage: error instanceof Error ? error.message : 'Upload failed.' } : result))
        }
      }
    }

    const stopped = controller.signal.aborted
    if (stopped) setResults((current) => current.map((result) => result.status === 'waiting' ? { ...result, status: 'blocked', errorMessage: 'Not started because the batch was stopped.' } : result))
    setProgress({
      state: stopped ? 'stopped' : failed === actions.length ? 'failed' : 'completed',
      percent: stopped ? ((completed + failed) / actions.length) * 100 : 100,
      current: completed + failed + checking,
      total: actions.length,
      completed,
      failed,
      message: stopped
        ? 'Upload stopped. Unstarted posts were blocked safely.'
        : checking
          ? `${checking} post${checking === 1 ? '' : 's'} are being checked against the server after the mobile connection paused. Confirmed results will update automatically.`
        : failed
          ? `Batch finished with ${failed} failed post${failed === 1 ? '' : 's'}.`
          : timingMode === 'publish_now'
            ? 'Every media item was accepted for publishing.'
            : smartTimingSource
              ? 'Every future post is scheduled with Smart Timing. Exact chosen times are visible in Calendar and can still be edited until processing begins.'
              : 'Every future post is scheduled with publishing provider. You can edit its caption, media or publishing time until processing begins.',
    })
    abortRef.current = null
    await scheduler.refetch()
  }

  const retryFailedUpload = async (result: UploadResult) => {
    if (running || retryingId || !result.jobId) return

    setRetryingId(result.id)
    setResults((current) => current.map((candidate) => candidate.id === result.id ? { ...candidate, status: 'uploading', errorMessage: null } : candidate))
    setProgress({ state: 'scheduling', percent: 15, current: 1, total: 1, completed: 0, failed: 0, message: `Retrying ${result.fileName}…` })

    try {
      if (result.mediaKind === 'text') {
        const response = await retryFailedScheduledPost(result.jobId)
        setResults((current) => current.map((candidate) => candidate.id === result.id ? {
          ...candidate,
          status: backendStatusToUploadStatus(response.job.status),
          resultId: response.job.providerPostId || response.job.metaPostId || candidate.resultId,
          errorMessage: response.job.errorMessage || null,
        } : candidate))
      } else {
        const item = media.find((candidate) => candidate.id === result.mediaId)
        if (!item) throw new Error('The original media is no longer available in this browser session.')
        const uploaded = item.libraryAssetId
          ? await publishBulkLibraryMedia(result.jobId)
          : await uploadBulkMedia(result.jobId, item.file, { signal: new AbortController().signal, onProgress: (loaded, total) => {
            const percent = total > 0 ? Math.max(15, Math.min(90, Math.round((loaded / total) * 90))) : 40
            setProgress({ state: 'uploading', percent, current: 1, total: 1, completed: 0, failed: 0, message: `Retrying ${result.fileName}…` })
          } })
        setResults((current) => current.map((candidate) => candidate.id === result.id ? {
          ...candidate,
          status: backendStatusToUploadStatus(uploaded.job.status),
          resultId: uploaded.job.metaPostId || uploaded.job.metaVideoId || candidate.resultId,
          errorMessage: null,
        } : candidate))
      }
      setProgress({ state: 'completed', percent: 100, current: 1, total: 1, completed: 1, failed: 0, message: 'Retry completed successfully.' })
      await scheduler.refetch()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Retry failed.'
      setResults((current) => current.map((candidate) => candidate.id === result.id ? {
        ...candidate,
        status: 'failed',
        errorMessage: message,
      } : candidate))
      setProgress({ state: 'failed', percent: 100, current: 1, total: 1, completed: 0, failed: 1, message })
    } finally {
      setRetryingId(null)
    }
  }

  const retryReviewJobs = async (jobs: DashboardJob[]) => {
    if (running || retryingId) return
    const retryable = jobs.filter((job) => job.status === 'FAILED' && !job.metaPostId)
    if (!retryable.length) return

    setHistoryView(null)
    const retryResults: UploadResult[] = retryable.map((job, index) => ({
      id: `review-retry:${job.id}`,
      mediaId: job.id,
      mediaIndex: index,
      jobId: job.id,
      fileName: job.localFileName || (job.contentType === 'TEXT' ? `Text post ${index + 1}` : `Failed post ${index + 1}`),
      mediaKind: job.contentType === 'IMAGE' ? 'image' : job.contentType === 'VIDEO' ? 'video' : 'text',
      thumbnailUrl: '',
      textPreview: job.caption?.replace(/\s+/g, ' ').slice(0, 180) || null,
      destinationIds: job.destination?.id ? [job.destination.id] : [],
      status: 'waiting',
      resultId: null,
      errorMessage: null,
      scheduledAt: job.scheduledAt,
    }))
    setResults(retryResults)
    setProgress({
      state: 'preparing',
      percent: 0,
      current: 0,
      total: retryable.length,
      completed: 0,
      failed: 0,
      message: `Preparing ${retryable.length} failed post${retryable.length === 1 ? '' : 's'} for retry…`,
    })

    const controller = new AbortController()
    abortRef.current = controller
    window.requestAnimationFrame(() => batchRunSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))

    let completed = 0
    let failed = 0
    for (let index = 0; index < retryable.length; index += 1) {
      if (controller.signal.aborted) break
      const job = retryable[index]
      const resultId = retryResults[index].id
      setRetryingId(resultId)
      setResults((current) => current.map((result) => result.id === resultId ? { ...result, status: 'uploading', errorMessage: null } : result))
      setProgress({
        state: 'scheduling',
        percent: Math.round((index / retryable.length) * 100),
        current: index + 1,
        total: retryable.length,
        completed,
        failed,
        message: `Retrying post ${index + 1} of ${retryable.length}…`,
      })

      try {
        const response = await retryFailedScheduledPost(job.id)
        completed += 1
        setResults((current) => current.map((result) => result.id === resultId ? {
          ...result,
          status: backendStatusToUploadStatus(response.job.status),
          resultId: response.job.providerPostId || response.job.metaPostId || result.resultId,
          errorMessage: response.job.errorMessage || null,
        } : result))
      } catch (error) {
        failed += 1
        setResults((current) => current.map((result) => result.id === resultId ? {
          ...result,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Retry failed.',
        } : result))
      }
    }

    const stopped = controller.signal.aborted
    if (stopped) {
      setResults((current) => current.map((result) => result.status === 'waiting' ? { ...result, status: 'blocked', errorMessage: 'Not retried because the retry batch was stopped.' } : result))
    }
    setProgress({
      state: stopped ? 'stopped' : failed === retryable.length ? 'failed' : 'completed',
      percent: stopped ? Math.round(((completed + failed) / retryable.length) * 100) : 100,
      current: completed + failed,
      total: retryable.length,
      completed,
      failed,
      message: stopped
        ? `Retry batch stopped after ${completed + failed} of ${retryable.length} posts.`
        : failed
          ? `Retry finished: ${completed} recovered, ${failed} still need review.`
          : `Retry complete. ${completed} post${completed === 1 ? '' : 's'} recovered successfully.`,
    })
    setRetryingId(null)
    abortRef.current = null
    await scheduler.refetch()
  }

  const bulkEditScheduledJobs = async (jobs: DashboardJob[], rules: BulkScheduledEditRules) => {
    if (running || retryingId) return

    const timezone = schedulerData.settings.timezone
    const baselineDate = earliestLocalDate(jobs.map((job) => job.scheduledAt), timezone)
    const prepared = jobs
      .filter((job) => job.status === 'SCHEDULED' && Boolean(job.providerPostId))
      .map((job) => {
        const beforeText = job.caption || ''
        const afterText = hasTextRuleChanges(rules) ? applyBulkTextEdit(beforeText, rules) : beforeText
        const afterSchedule = applyBulkScheduleEdit(job.scheduledAt, baselineDate, rules, timezone)
        return {
          job,
          afterText,
          afterSchedule,
          textChanged: beforeText !== afterText,
          scheduleChanged: job.scheduledAt !== afterSchedule,
        }
      })
      .filter((item) => item.textChanged || item.scheduleChanged)

    if (!prepared.length) return

    const grouped = new Map<string, typeof prepared>()
    prepared.forEach((item) => {
      const key = String(item.job.providerPostId)
      const group = grouped.get(key) || []
      group.push(item)
      grouped.set(key, group)
    })

    setHistoryView(null)
    const editResults: UploadResult[] = prepared.map(({ job, afterText, afterSchedule }, index) => ({
      id: `bulk-edit:${job.id}`,
      mediaId: job.id,
      mediaIndex: index,
      jobId: job.id,
      fileName: job.localFileName || job.title || `Scheduled ${job.contentType.toLowerCase()} post ${index + 1}`,
      mediaKind: job.contentType === 'IMAGE' ? 'image' : job.contentType === 'VIDEO' ? 'video' : 'text',
      thumbnailUrl: '',
      textPreview: afterText.replace(/\s+/g, ' ').slice(0, 180) || null,
      destinationIds: job.destination?.id ? [job.destination.id] : [],
      status: 'waiting',
      resultId: job.providerPostId || null,
      errorMessage: null,
      scheduledAt: afterSchedule,
    }))
    setResults(editResults)
    setProgress({
      state: 'preparing',
      percent: 0,
      current: 0,
      total: prepared.length,
      completed: 0,
      failed: 0,
      message: `Preparing ${prepared.length} destination schedule edit${prepared.length === 1 ? '' : 's'}…`,
    })

    const controller = new AbortController()
    abortRef.current = controller
    window.requestAnimationFrame(() => batchRunSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))

    let completed = 0
    let failed = 0
    const groups = [...grouped.values()]

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      if (controller.signal.aborted) break
      const group = groups[groupIndex]
      const resultIds = new Set(group.map((item) => `bulk-edit:${item.job.id}`))
      setRetryingId([...resultIds][0] || null)
      setResults((current) => current.map((result) => resultIds.has(result.id) ? { ...result, status: 'uploading', errorMessage: null } : result))
      setProgress({
        state: 'scheduling',
        percent: Math.round(((completed + failed) / prepared.length) * 100),
        current: Math.min(prepared.length, completed + failed + group.length),
        total: prepared.length,
        completed,
        failed,
        message: `Updating ${group.length} selected destination${group.length === 1 ? '' : 's'} for scheduled post ${groupIndex + 1} of ${groups.length}…`,
      })

      try {
        const response = await bulkEditScheduledPosts(group.map((item) => ({
          publicationId: item.job.id,
          ...(item.textChanged ? { caption: item.afterText } : {}),
          ...(item.scheduleChanged && item.afterSchedule ? { scheduledAt: item.afterSchedule } : {}),
        })))
        const affected = new Map(response.affected.map((item) => [item.publicationId, item]))
        completed += group.length
        setResults((current) => current.map((result) => {
          if (!resultIds.has(result.id)) return result
          const publicationId = result.id.replace(/^bulk-edit:/, '')
          const updated = affected.get(publicationId)
          return {
            ...result,
            status: 'scheduled',
            resultId: updated?.providerPostId || result.resultId,
            scheduledAt: updated?.scheduledAt || result.scheduledAt,
            textPreview: (updated?.caption || result.textPreview || '').replace(/\s+/g, ' ').slice(0, 180) || null,
            errorMessage: null,
          }
        }))
      } catch (error) {
        failed += group.length
        const message = error instanceof Error ? error.message : 'Scheduled Bulk Edit failed.'
        setResults((current) => current.map((result) => resultIds.has(result.id) ? {
          ...result,
          jobId: null,
          status: 'failed',
          errorMessage: `${message} The affected destination schedule was left unchanged. Reopen Scheduled → Bulk Edit to try again.`,
        } : result))
      }
    }

    const stopped = controller.signal.aborted
    if (stopped) {
      setResults((current) => current.map((result) => result.status === 'waiting'
        ? { ...result, status: 'blocked', errorMessage: 'Not edited because Bulk Edit was stopped. The original destination schedule remains unchanged.' }
        : result))
    }

    setProgress({
      state: stopped ? 'stopped' : failed === prepared.length ? 'failed' : 'completed',
      percent: stopped ? Math.round(((completed + failed) / prepared.length) * 100) : 100,
      current: completed + failed,
      total: prepared.length,
      completed,
      failed,
      message: stopped
        ? `Bulk Edit stopped after ${completed + failed} of ${prepared.length} destination schedules.`
        : failed
          ? `Bulk Edit finished: ${completed} updated, ${failed} unchanged because their edits failed.`
          : `Bulk Edit complete. ${completed} destination schedule${completed === 1 ? '' : 's'} updated successfully.`,
    })
    setRetryingId(null)
    abortRef.current = null
    await scheduler.refetch()
  }

  const bulkCancelScheduledJobs = async (jobs: DashboardJob[]) => {
    if (running || retryingId) throw new Error('Wait for the current publishing action to finish before cancelling schedules.')

    const publicationIds = jobs
      .filter((job) => job.status === 'SCHEDULED' && Boolean(job.providerPostId))
      .map((job) => job.id)

    if (!publicationIds.length) throw new Error('Choose at least one active scheduled destination to cancel.')

    return bulkCancelScheduledPosts(publicationIds)
  }

  const requestStart = () => {
    if (!canStart) return
    if (scheduler.data?.settings.approvalRequired) setConfirmationOpen(true)
    else void runBatch()
  }

  const sessionRequired = scheduler.error instanceof ApiError && scheduler.error.status === 401

  return (
    <div className="dashboard-canvas">
      {scheduler.isError && <section className="mb-4 flex flex-col gap-3 rounded-xl border border-brand-red/25 bg-brand-red/7 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"><span>{sessionRequired ? 'Your session must be refreshed before connected destinations can be loaded.' : 'Connected destinations could not refresh. The Bulk Scheduler interface remains available.'}</span>{sessionRequired ? <a className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border-soft px-3 font-semibold" href="/portal/login.html?return=/app/">Sign in</a> : <button className="min-h-9 rounded-lg border border-border-soft px-3 font-semibold" onClick={() => scheduler.refetch()} type="button">Retry destinations</button>}</section>}
      <BulkSchedulerHero onStop={stopUpload} running={running} />
      <BulkSchedulerStats jobs={schedulerData.jobs} onOpen={setHistoryView} />
      <div className="mt-4 scroll-mt-24" ref={destinationSection}><PublishingDestinationsPanel destinations={destinations} onSelectionChange={setSelectedIds} platforms={schedulerData.platforms} selectedIds={selectedIds} /></div>
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)]">
        <UploadBatchPanel
          campaignError={campaignsQuery.isError ? (campaignsQuery.error instanceof Error ? campaignsQuery.error.message : 'Saved AI campaigns could not be loaded.') : ''}
          campaignImport={mixedCampaign ? {
            id: mixedCampaign.id,
            title: mixedCampaign.title,
            textPosts: mixedTextPosts.length,
            imagePosts: mixedImagePosts.length,
            total: mixedCampaign.posts.length,
            posts: mixedCampaign.posts.map((post) => ({
              id: post.id,
              sequence: post.sequence,
              contentType: post.contentType,
              caption: post.caption,
              thumbnailUrl: post.media?.previewUrl || '',
            })),
          } : null}
          campaignLoading={campaignsQuery.isLoading}
          campaigns={campaignsQuery.data || []}
          canStart={canStart}
          captionCount={mixedCampaign ? mixedCampaign.posts.length : captionBlocks.length}
          captions={captions}
          contentMode={contentMode}
          disabledReason={disabledReason}
          media={media}
          onCampaignClear={clearCampaignSelection}
          onCampaignSelect={chooseSavedCampaign}
          onCaptionFile={(file) => { void readCaptionFile(file).catch((error) => setProgress({ ...idleProgress, state: 'failed', message: error.message })) }}
          onCaptionsChange={setCaptions}
          onClear={clearSession}
          onContentModeChange={changeContentMode}
          onCreateCampaign={() => navigate('/ai-content-studio?campaign=new')}
          onFallbackChange={setUseFallback}
          onMedia={selectMedia}
          onRetainMediaChange={setRetainMedia}
          onSmartTimingChange={setSmartTiming}
          onScheduleDateChange={setScheduleDate}
          onScheduleTimeAdd={(time) => setScheduleTimes((current) => [...new Set([...current, time])].sort())}
          onScheduleTimeRemove={(time) => setScheduleTimes((current) => current.filter((value) => value !== time))}
          onSaveScheduleTimes={saveCurrentScheduleTimesForFuture}
          onStart={requestStart}
          onTimingModeChange={setTimingMode}
          onWorkspaceModeChange={changeWorkspaceMode}
          retainMedia={retainMedia}
          smartTiming={smartTiming}
          running={running}
          savedScheduleTimes={schedulerData.settings.defaultScheduleTimes}
          scheduleDate={scheduleDate}
          scheduleTimes={activeScheduleTimes}
          selectedDestinations={selectedIds.size}
          timezone={schedulerData.settings.timezone}
          timingMode={timingMode}
          useFallback={useFallback}
          workspaceMode={workspaceMode}
        />
        <div className="scroll-mt-24" ref={batchRunSection}><BatchRunPanel canStart={canStart} destinations={destinations} disabledReason={disabledReason} onRetry={retryFailedUpload} onStart={requestStart} onStop={stopUpload} progress={progress} results={results} retryingId={retryingId} running={running} /></div>
      </div>
      {historyView && <BulkScheduleManager initialView={historyView} jobs={schedulerData.jobs} onBulkCancelJobs={bulkCancelScheduledJobs} onBulkEditJobs={(jobs, rules) => { void bulkEditScheduledJobs(jobs, rules) }} onChanged={() => scheduler.refetch()} onClose={() => setHistoryView(null)} onRetryJobs={(jobs) => { void retryReviewJobs(jobs) }} timezone={schedulerData.settings.timezone} />}
      <PublishConfirmationDialog busy={running} confirmLabel={timingMode === 'publish_now' ? 'Publish batch' : 'Schedule batch'} description={mixedCampaign ? `You are about to ${timingMode === 'publish_now' ? 'publish' : 'schedule'} the ${mixedCampaign.posts.length}-post AI campaign “${mixedCampaign.title}” in campaign order. Image posts go to all selected compatible destinations; text posts go only to selected destinations that support text-only publishing.` : `You are about to ${timingMode === 'publish_now' ? 'publish' : 'schedule'} ${batchCount} ${contentMode === 'text' ? `text post${batchCount === 1 ? '' : 's'}` : `media file${batchCount === 1 ? '' : 's'}`} across ${selectedIds.size} destination${selectedIds.size === 1 ? '' : 's'}.`} onCancel={() => setConfirmationOpen(false)} onConfirm={() => { setConfirmationOpen(false); void runBatch() }} open={confirmationOpen} title="Confirm this bulk publishing action" />
    </div>
  )
}
