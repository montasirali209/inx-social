import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Film,
  Gauge,
  ImagePlus,
  Layers3,
  LoaderCircle,
  Save,
  Sparkles,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react'
import type { AIDraft, AIContentType, AIPlanAccess, GeneratedAsset, GenerationHistoryItem } from '../../types/ai-content-studio'
import { uploadMediaAsset } from '../../lib/media-library-api'
import { getGenerationStatus, saveAIDraft } from '../../lib/ai-content-studio-api'
import {
  estimateVideoCredits,
  generateStudioVideo,
  getVideoCatalog,
  recommendVideoModel,
  type VideoAspectRatio,
  type VideoGenerationMode,
  type VideoModelOption,
  type VideoResolution,
  type VideoStudioSelection,
} from '../../lib/ai-next-studio-api'
import { sendPostStudioMessage, type PostStudioBrief } from '../../lib/ai-post-studio-api'
import { ApiError } from '../../lib/api-client'
import { Button } from '../ui/Button'
import { StudioSelect } from './StudioSelect'
import { StockVideoCreator } from './StockVideoCreator'
import { VideoModelPicker } from './VideoModelPicker'
import { VideoProductionRail } from './VideoProductionRail'
import { videoProductionKind, type VideoProductionKind } from './video-production-utils'

const ACTIVE_AI_VIDEO_JOB_KEY = 'inx-social-ai-video-active-job-v1'
const HIGH_COST_CONFIRMATION_CREDITS = 100
const MAX_REFERENCE_IMAGES = 8

type ReferenceAsset = { id: string; fileName: string }
type RoutingChoice = 'recommended' | 'manual'

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

function extractUrls(text: string) {
  return [...new Set((text.match(/https?:\/\/[^\s<>()]+/gi) || []).map((value) => value.replace(/[.,;!?]+$/, '')))].slice(0, 2)
}

function buildDraft(asset: GeneratedAsset, prompt: string, brief: PostStudioBrief | null, existing?: AIDraft | null): AIDraft {
  return {
    id: existing?.id || crypto.randomUUID(),
    contentType: 'short_video',
    title: (brief?.headline || prompt || 'AI video').slice(0, 70),
    thumbnailUrl: asset.thumbnailUrl || asset.url,
    updatedAt: new Date().toISOString(),
    status: 'ready',
    prompt: prompt.slice(0, 1500),
    caption: brief?.caption || asset.caption || '',
    hashtags: brief?.hashtags || asset.hashtags || [],
    altText: '',
    asset: { ...asset, caption: brief?.caption || asset.caption || '', hashtags: brief?.hashtags || asset.hashtags || [] },
    mediaLibraryAsset: existing?.mediaLibraryAsset || null,
    mediaLibraryAssets: existing?.mediaLibraryAssets || [],
  }
}

function durationsFor(model?: VideoModelOption | null) {
  return model?.durations?.length ? model.durations : model?.availableDurations || []
}

function resolutionsFor(model?: VideoModelOption | null) {
  return model?.resolutions?.length ? model.resolutions : model?.availableResolutions || []
}

function fpsFor(model?: VideoModelOption | null) {
  return model?.fps?.length ? model.fps : model?.availableFps || []
}

function supportedUiModes(model?: VideoModelOption | null): VideoGenerationMode[] {
  if (!model) return []
  const modes: VideoGenerationMode[] = []
  if (model.modes?.includes('TEXT_TO_VIDEO')) modes.push('TEXT_TO_VIDEO')
  if (model.modes?.includes('IMAGE_TO_VIDEO') || model.imageReferenceSupported) modes.push('IMAGE_TO_VIDEO')
  if (model.referenceImagesSupported) modes.push('REFERENCE_TO_VIDEO')
  return [...new Set(modes)]
}

function modeLabel(mode: VideoGenerationMode) {
  if (mode === 'IMAGE_TO_VIDEO') return 'Image to video'
  if (mode === 'REFERENCE_TO_VIDEO') return 'Reference guided'
  return 'Text to video'
}

function modeDescription(mode: VideoGenerationMode) {
  if (mode === 'IMAGE_TO_VIDEO') return 'Animate a first frame or product image.'
  if (mode === 'REFERENCE_TO_VIDEO') return 'Guide the render with multiple reference images.'
  return 'Generate directly from your creative brief.'
}

function RouteChoice({
  active,
  icon,
  title,
  text,
  onClick,
  busy,
}: {
  active: boolean
  icon: ReactNode
  title: string
  text: string
  onClick: () => void
  busy?: boolean
}) {
  return <button
    type="button"
    disabled={busy}
    onClick={onClick}
    className={cx(
      'group relative overflow-hidden rounded-[20px] border p-3.5 text-left transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50',
      active
        ? 'border-brand-cyan/45 bg-[linear-gradient(145deg,rgba(0,214,192,.11),rgba(4,23,34,.92))] shadow-[0_18px_60px_rgba(0,214,192,.10)]'
        : 'border-border-soft bg-black/12 hover:border-brand-cyan/25',
    )}
  >
    <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
    <span className={cx(
      'grid size-8 place-items-center rounded-xl border',
      active ? 'border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan' : 'border-white/7 bg-white/[.03] text-text-muted',
    )}>{icon}</span>
    <strong className="mt-2 block text-[10px] text-white">{title}</strong>
    <span className="mt-1 block text-[8px] leading-4 text-text-muted">{text}</span>
  </button>
}

function ReferenceRow({ asset, onRemove }: { asset: ReferenceAsset; onRemove: () => void }) {
  return <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand-green/20 bg-brand-green/[.04] px-3 py-2.5">
    <span className="flex min-w-0 items-center gap-2 text-[9px]">
      <ImagePlus className="size-3.5 shrink-0 text-brand-green" />
      <span className="truncate">{asset.fileName}</span>
    </span>
    <button type="button" className="shrink-0 text-[8px] text-text-soft hover:text-white" onClick={onRemove}>Remove</button>
  </div>
}

export function VideoStudioModal({
  open,
  type,
  access,
  initialDraft,
  initialVideoKind,
  initialGenerationId,
  onClose,
  onSaved,
  onContinue,
  onToast,
}: {
  open: boolean
  type: AIContentType | null
  access: AIPlanAccess
  initialDraft?: AIDraft | null
  initialVideoKind?: VideoProductionKind | null
  initialGenerationId?: string | null
  onClose: () => void
  onSaved: (draft: AIDraft) => void
  onContinue: (draft: AIDraft) => void
  onToast: (message: string) => void
}) {
  const firstFrameInput = useRef<HTMLInputElement>(null)
  const lastFrameInput = useRef<HTMLInputElement>(null)
  const referencesInput = useRef<HTMLInputElement>(null)

  const [models, setModels] = useState<VideoModelOption[]>([])
  const [catalogLabel, setCatalogLabel] = useState('')
  const [prompt, setPrompt] = useState(initialDraft?.prompt || '')
  const [brief, setBrief] = useState<PostStudioBrief | null>(null)
  const [routingChoice, setRoutingChoice] = useState<RoutingChoice>('recommended')
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const [modelRoute, setModelRoute] = useState('pvideo')
  const [generationMode, setGenerationMode] = useState<VideoGenerationMode>('TEXT_TO_VIDEO')
  const [duration, setDuration] = useState(5)
  const [resolution, setResolution] = useState<VideoResolution>('720p')
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('9:16')
  const [fps, setFps] = useState<number | undefined>(undefined)
  const [draft, setDraft] = useState(false)
  const [audio, setAudio] = useState(true)
  const [firstFrame, setFirstFrame] = useState<ReferenceAsset | null>(null)
  const [lastFrame, setLastFrame] = useState<ReferenceAsset | null>(null)
  const [referenceAssets, setReferenceAssets] = useState<ReferenceAsset[]>([])
  const [asset, setAsset] = useState<GeneratedAsset | null>(() => initialDraft?.asset?.type === 'video' ? initialDraft.asset : null)
  const [credits, setCredits] = useState(10)
  const [recommendation, setRecommendation] = useState('')
  const [recommending, setRecommending] = useState(false)
  const [polishing, setPolishing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [jobId, setJobId] = useState(() => (initialVideoKind === 'generative' ? initialGenerationId : '') || window.localStorage.getItem(ACTIVE_AI_VIDEO_JOB_KEY) || '')
  const [error, setError] = useState('')
  const [selectedProductionId, setSelectedProductionId] = useState(initialGenerationId || '')
  const [studioKind, setStudioKind] = useState<'choose' | VideoProductionKind>(() =>
    initialVideoKind || (initialDraft ? (initialDraft.asset?.provider === 'OpenMontage stock workflow' ? 'stock' : 'generative') : 'choose'),
  )

  const selected = useMemo(() => models.find((item) => item.id === modelRoute) || models[0], [models, modelRoute])
  const modeOptions = useMemo(() => supportedUiModes(selected), [selected])
  const durationValues = useMemo(() => durationsFor(selected), [selected])
  const resolutionValues = useMemo(() => resolutionsFor(selected), [selected])
  const fpsValues = useMemo(() => fpsFor(selected), [selected])

  const selection = useMemo<VideoStudioSelection>(() => ({
    modelRoute,
    mode: generationMode,
    duration,
    resolution,
    aspectRatio,
    fps,
    draft,
    audio,
  }), [modelRoute, generationMode, duration, resolution, aspectRatio, fps, draft, audio])

  const activeReferenceIds = useMemo(() => {
    if (generationMode === 'IMAGE_TO_VIDEO') return [firstFrame?.id, lastFrame?.id].filter(Boolean) as string[]
    if (generationMode === 'REFERENCE_TO_VIDEO') return referenceAssets.map((item) => item.id)
    return []
  }, [firstFrame, generationMode, lastFrame, referenceAssets])

  const allReferenceIds = useMemo(() => [
    firstFrame?.id,
    lastFrame?.id,
    ...referenceAssets.map((item) => item.id),
  ].filter(Boolean) as string[], [firstFrame, lastFrame, referenceAssets])

  const referenceMissing = ['IMAGE_TO_VIDEO', 'REFERENCE_TO_VIDEO'].includes(generationMode) && activeReferenceIds.length === 0
  const insufficient = access.creditsConfigured && !access.unlimitedCredits && access.creditsRemaining !== null && access.creditsRemaining < credits
  const rendering = generating || Boolean(jobId)

  useEffect(() => {
    if (!open || (type !== 'short_video' && initialDraft?.contentType !== 'short_video')) return
    const bodyOverflow = document.body.style.overflow
    const bodyOverscroll = document.body.style.overscrollBehavior
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    return () => {
      document.body.style.overflow = bodyOverflow
      document.body.style.overscrollBehavior = bodyOverscroll
    }
  }, [open, type, initialDraft?.contentType])

  useEffect(() => {
    if (!open || (type !== 'short_video' && initialDraft?.contentType !== 'short_video')) return
    let active = true
    void getVideoCatalog().then((catalog) => {
      if (!active) return
      const ready = catalog.models.filter((model) => model.generationReady && supportedUiModes(model).length > 0)
      setModels(ready)
      setCatalogLabel([
        catalog.health?.status === 'DEGRADED' ? 'Catalogue protection active' : catalog.source === 'runware-live' ? 'Live catalogue' : 'Cached catalogue',
        catalog.syncedAt ? new Date(catalog.syncedAt).toLocaleString() : ''
      ].filter(Boolean).join(' · '))
      const initial = ready.find((model) => model.id === 'pvideo') || ready[0]
      if (initial) {
        const durations = durationsFor(initial)
        const resolutions = resolutionsFor(initial)
        const aspects = initial.aspects || []
        const modelFps = fpsFor(initial)
        const modes = supportedUiModes(initial)
        setModelRoute(initial.id)
        setDuration(durations.includes(5) ? 5 : durations[0] || 5)
        setResolution(resolutions.includes('720p') ? '720p' : resolutions[0] || '720p')
        setAspectRatio((aspects.includes('9:16') ? '9:16' : aspects[0] || '9:16') as VideoAspectRatio)
        setGenerationMode(modes.includes('TEXT_TO_VIDEO') ? 'TEXT_TO_VIDEO' : modes[0] || 'TEXT_TO_VIDEO')
        setFps(modelFps[0])
        setAudio(Boolean(initial.audioSupported))
        setDraft(false)
      }
      if (!ready.length) setError('No generation-ready video models are available right now.')
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : 'Video model catalogue could not be loaded.')
    })
    return () => { active = false }
  }, [open, type, initialDraft?.contentType])

  useEffect(() => {
    if (!open || !selected) return
    let active = true
    const timer = window.setTimeout(() => {
      void estimateVideoCredits(selection).then((value) => {
        if (active) {
          setCredits(value.credits)
          setError((current) => current.includes('credits could not be estimated') ? '' : current)
        }
      }).catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Video credits could not be estimated.')
      })
    }, 220)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [open, selected, selection])

  useEffect(() => {
    if (!jobId || studioKind !== 'generative') return
    let active = true
    let timer = 0
    let retryCount = 0
    const schedule = (delay = 3000) => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => { if (active) void poll() }, delay)
    }
    async function poll() {
      try {
        const result = await getGenerationStatus(jobId)
        if (!active) return
        retryCount = 0
        if (result.status === 'completed' && result.asset) {
          setAsset(result.asset)
          setPrompt((current) => current || result.prompt || '')
          setGenerating(false)
          setJobId('')
          window.localStorage.removeItem(ACTIVE_AI_VIDEO_JOB_KEY)
          onToast('AI video created and saved to Media Library.')
          return
        }
        if (result.status === 'failed' || result.status === 'cancelled') {
          setError(result.error || 'AI video generation failed.')
          setGenerating(false)
          setJobId('')
          window.localStorage.removeItem(ACTIVE_AI_VIDEO_JOB_KEY)
          return
        }
        schedule()
      } catch (caught) {
        if (!active) return
        const terminal = caught instanceof ApiError && [401, 403, 404].includes(caught.status)
        if (terminal) {
          setError(caught.message || 'Video progress could not be checked.')
          setGenerating(false)
          setJobId('')
          window.localStorage.removeItem(ACTIVE_AI_VIDEO_JOB_KEY)
          return
        }
        retryCount += 1
        schedule(caught instanceof ApiError && caught.status === 429 ? 5000 : Math.min(15000, 2000 + retryCount * 1500))
      }
    }
    void poll()
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [jobId, studioKind, onToast])

  if (!open || (type !== 'short_video' && initialDraft?.contentType !== 'short_video')) return null

  if (studioKind === 'choose') {
    return createPortal(<div className="fixed inset-0 z-[100] grid place-items-center bg-[#01070d]/92 p-3 backdrop-blur-xl">
      <div className="video-studio-choice-pop w-full max-w-[860px] overflow-hidden rounded-[30px] border border-brand-cyan/25 bg-[radial-gradient(circle_at_20%_0%,rgba(0,214,192,.12),transparent_42%),linear-gradient(145deg,#071c29,#020b13)] shadow-[0_44px_160px_rgba(0,0,0,.78)]">
        <header className="flex items-center justify-between border-b border-border-soft px-5 py-4 sm:px-7">
          <div>
            <span className="text-[8px] font-bold uppercase tracking-[.18em] text-brand-cyan">Short video / Reel</span>
            <h2 className="mt-1 text-lg font-bold">How would you like to create it?</h2>
            <p className="mt-1 text-[10px] text-text-muted">Choose original AI motion or a complete story edited from professional stock footage.</p>
          </div>
          <button className="grid size-9 place-items-center rounded-xl border border-border-soft text-text-muted hover:text-white" onClick={onClose}><X className="size-4" /></button>
        </header>
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
          <button type="button" onClick={() => setStudioKind('generative')} className="group relative min-h-[250px] overflow-hidden rounded-[25px] border border-violet-400/20 bg-[linear-gradient(145deg,rgba(139,92,246,.12),rgba(3,15,25,.82))] p-6 text-left transition duration-500 hover:-translate-y-1 hover:border-violet-300/45">
            <span className="grid size-14 place-items-center rounded-[20px] border border-violet-300/25 bg-violet-400/10 text-violet-200"><Sparkles className="size-6" /></span>
            <span className="mt-8 block text-[9px] font-bold uppercase tracking-[.16em] text-violet-300">Original AI motion</span>
            <strong className="mt-2 block text-xl">AI Generated Video</strong>
            <span className="mt-2 block text-[10px] leading-5 text-text-muted">Use the live Runware catalogue with AI routing or choose the exact model yourself.</span>
            <span className="mt-6 inline-flex items-center gap-2 text-[10px] font-bold text-violet-200">Open AI Video Studio <ArrowRight className="size-4" /></span>
          </button>
          <button type="button" onClick={() => setStudioKind('stock')} className="group relative min-h-[250px] overflow-hidden rounded-[25px] border border-brand-green/20 bg-[linear-gradient(145deg,rgba(16,185,129,.12),rgba(3,15,25,.82))] p-6 text-left transition duration-500 hover:-translate-y-1 hover:border-brand-green/45">
            <span className="grid size-14 place-items-center rounded-[20px] border border-brand-green/25 bg-brand-green/10 text-brand-green"><Layers3 className="size-6" /></span>
            <span className="mt-8 block text-[9px] font-bold uppercase tracking-[.16em] text-brand-green">Professional real footage</span>
            <strong className="mt-2 block text-xl">Stock Video Creator</strong>
            <span className="mt-2 block text-[10px] leading-5 text-text-muted">Turn one idea into an edited story with professional stock scenes, narration, music and captions.</span>
            <span className="mt-6 inline-flex items-center gap-2 text-[10px] font-bold text-brand-green">Open Stock Video Creator <ArrowRight className="size-4" /></span>
          </button>
        </div>
      </div>
    </div>, document.body)
  }

  function openProduction(item: GenerationHistoryItem, selectedAsset: GeneratedAsset | null) {
    const kind = videoProductionKind(item)
    setSelectedProductionId(item.id)
    setStudioKind(kind)
    setPrompt(item.prompt || '')
    if (kind === 'generative') {
      setAsset(selectedAsset)
      if (!selectedAsset && ['preparing', 'generating', 'processing'].includes(item.status)) {
        setJobId(item.id)
        window.localStorage.setItem(ACTIVE_AI_VIDEO_JOB_KEY, item.id)
      }
    }
  }

  if (studioKind === 'stock') {
    return <StockVideoCreator
      initialDraft={initialDraft}
      initialGenerationId={selectedProductionId || (initialVideoKind === 'stock' ? initialGenerationId : '')}
      onClose={onClose}
      onBackToChooser={() => setStudioKind('choose')}
      onOpenProduction={openProduction}
      onSaved={onSaved}
      onContinue={onContinue}
      onToast={onToast}
    />
  }

  function applyModel(model: VideoModelOption, preferred?: Partial<VideoStudioSelection>) {
    setModelRoute(model.id)
    const durations = durationsFor(model)
    const resolutions = resolutionsFor(model)
    const aspects = model.aspects || []
    const modelFps = fpsFor(model)
    const modes = supportedUiModes(model)

    const nextDuration = preferred?.duration && (!durations.length || durations.includes(preferred.duration))
      ? preferred.duration
      : durations.includes(duration) ? duration : durations.includes(5) ? 5 : durations[0] || duration || 5
    const nextResolution = preferred?.resolution && (!resolutions.length || resolutions.includes(preferred.resolution))
      ? preferred.resolution
      : resolutions.includes(resolution) ? resolution : resolutions.includes('720p') ? '720p' : resolutions[0] || resolution || '720p'
    const nextAspect = preferred?.aspectRatio && aspects.includes(preferred.aspectRatio)
      ? preferred.aspectRatio
      : aspects.includes(aspectRatio) ? aspectRatio : aspects.includes('9:16') ? '9:16' : aspects[0] || '9:16'

    const hasStoredReference = allReferenceIds.length > 0
    const preferredMode = preferred?.mode && modes.includes(preferred.mode) ? preferred.mode : null
    const nextMode = preferredMode
      || (hasStoredReference && modes.includes('REFERENCE_TO_VIDEO') ? 'REFERENCE_TO_VIDEO' : null)
      || (hasStoredReference && modes.includes('IMAGE_TO_VIDEO') ? 'IMAGE_TO_VIDEO' : null)
      || (modes.includes(generationMode) ? generationMode : null)
      || modes[0]
      || 'TEXT_TO_VIDEO'

    setDuration(nextDuration)
    setResolution(nextResolution)
    setAspectRatio(nextAspect as VideoAspectRatio)
    setGenerationMode(nextMode)
    setFps(preferred?.fps && modelFps.includes(preferred.fps) ? preferred.fps : modelFps.includes(fps || -1) ? fps : modelFps[0])
    setAudio(model.audioSupported ? preferred?.audio !== false : false)
    setDraft(model.draftSupported ? Boolean(preferred?.draft) : false)
    setError('')
  }

  async function analyseBrief() {
    if (prompt.trim().length < 2) throw new Error('Describe the video first so AI can analyse it.')
    const result = await sendPostStudioMessage({
      messages: [{
        role: 'user',
        content: 'Analyse this idea as a short-form video/Reel brief. Use any supplied URL or reference image as evidence. Focus on hook, scene progression, motion, camera direction, pacing, audience and production needs. Do not generate the video yet.\n\n' + prompt,
      }],
      urls: extractUrls(prompt),
      referenceAssetIds: allReferenceIds,
      platform: aspectRatio === '9:16' ? 'Instagram Reels / TikTok' : 'Social video',
      aspectRatio,
    })
    setBrief(result.brief)
    return result.brief
  }

  async function recommend() {
    if (prompt.trim().length < 2 || recommending) {
      if (prompt.trim().length < 2) setError('Describe the video first so AI can recommend the right model.')
      return
    }
    setRoutingChoice('recommended')
    setRecommending(true)
    setError('')
    setRecommendation('')
    try {
      const analysed = await analyseBrief()
      const routingPrompt = [
        prompt.trim(),
        analysed.visualDirection ? 'Creative direction: ' + analysed.visualDirection : '',
        analysed.supportingCopy ? 'Story: ' + analysed.supportingCopy : '',
      ].filter(Boolean).join('\n')
      const result = await recommendVideoModel({
        prompt: routingPrompt.slice(0, 1500),
        hasReference: allReferenceIds.length > 0,
        aspectRatio,
      })
      const model = models.find((item) => item.id === result.modelRoute)
      if (!model) throw new Error('The recommended model is temporarily unavailable in this workspace.')
      applyModel(model, result)
      setRecommendation(result.reason)
      onToast(model.name + ' recommended for this video brief.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI could not recommend a video model.')
    } finally {
      setRecommending(false)
    }
  }

  async function polishWithAI() {
    if (prompt.trim().length < 2 || polishing) return
    setPolishing(true)
    setError('')
    try {
      const result = await analyseBrief()
      if (result.visualDirection) setPrompt(result.visualDirection.slice(0, 1500))
      onToast('Video brief analysed and polished.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The AI creative brief could not be prepared.')
    } finally {
      setPolishing(false)
    }
  }

  async function uploadReference(event: ChangeEvent<HTMLInputElement>, target: 'first' | 'last' | 'references') {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    if (files.some((file) => !file.type.startsWith('image/'))) {
      setError('Video references must be image files.')
      return
    }
    setUploading(true)
    setError('')
    try {
      const stored: ReferenceAsset[] = []
      for (const file of files.slice(0, target === 'references' ? MAX_REFERENCE_IMAGES : 1)) {
        const uploaded = await uploadMediaAsset(file, null, () => {})
        stored.push({ id: uploaded.id, fileName: uploaded.fileName })
      }
      if (target === 'first') setFirstFrame(stored[0] || null)
      if (target === 'last') setLastFrame(stored[0] || null)
      if (target === 'references') {
        setReferenceAssets((current) => {
          const merged = [...current, ...stored]
          return merged.filter((item, index) => merged.findIndex((candidate) => candidate.id === item.id) === index).slice(0, MAX_REFERENCE_IMAGES)
        })
      }
      onToast(stored.length > 1 ? stored.length + ' reference images added.' : 'Video reference image added.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Reference upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function generate() {
    if (prompt.trim().length < 2 || rendering || insufficient || referenceMissing || !selected) return
    setGenerating(true)
    setError('')
    try {
      const result = await generateStudioVideo({
        ...selection,
        prompt: prompt.trim(),
        sourceMediaLibraryAssetId: generationMode === 'IMAGE_TO_VIDEO' ? firstFrame?.id || null : null,
        firstFrameMediaLibraryAssetId: generationMode === 'IMAGE_TO_VIDEO' ? firstFrame?.id || null : null,
        lastFrameMediaLibraryAssetId: generationMode === 'IMAGE_TO_VIDEO' ? lastFrame?.id || null : null,
        referenceMediaLibraryAssetIds: generationMode === 'REFERENCE_TO_VIDEO' ? referenceAssets.map((item) => item.id) : [],
        caption: brief?.caption || '',
        hashtags: brief?.hashtags || [],
        script: brief?.supportingCopy || '',
      })
      window.localStorage.setItem(ACTIVE_AI_VIDEO_JOB_KEY, result.id)
      setSelectedProductionId(result.id)
      setJobId(result.id)
      onToast('AI video production started. You can safely leave this screen while it renders.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Video generation failed.')
      setGenerating(false)
    }
  }

  async function requestGeneration() {
    if (credits >= HIGH_COST_CONFIRMATION_CREDITS && !rendering && selected) {
      const balanceBefore = typeof access.creditsRemaining === 'number' ? access.creditsRemaining : null
      const balanceAfter = balanceBefore === null ? null : Math.max(0, balanceBefore - credits)
      const details = [
        'Confirm high-credit video generation',
        selected.name + ' · ' + duration + 's · ' + resolution,
        'This render will reserve ' + credits + ' AI credits.',
        balanceBefore === null ? '' : 'Current balance: ' + balanceBefore.toLocaleString() + ' credits.',
        balanceAfter === null ? '' : 'Balance after reservation: ' + balanceAfter.toLocaleString() + ' credits.',
        'If the generation fails, the reserved credits are returned automatically.',
      ].filter(Boolean).join('\n\n')
      if (!window.confirm(details)) return
    }
    await generate()
  }

  async function saveDraft() {
    if (!asset) return
    try {
      const saved = await saveAIDraft(buildDraft(asset, prompt, brief, initialDraft))
      onSaved(saved)
      onToast('Video saved to drafts.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Draft could not be saved.')
    }
  }

  function continueToPosts() {
    if (asset) onContinue(buildDraft(asset, prompt, brief, initialDraft))
  }

  const durationOptions = durationValues.map((value) => ({
    value,
    label: value + ' seconds',
    meta: value <= 5 ? 'Quick social clip' : value >= 15 ? 'Longer story' : 'Balanced length',
    icon: <Gauge className="size-3.5" />,
  }))
  const resolutionOptions = resolutionValues.map((value) => ({
    value,
    label: value,
    meta: /1080|1440|2160/i.test(value) ? 'Higher detail' : /360|480/i.test(value) ? 'Lower cost' : 'Balanced output',
    icon: <Film className="size-3.5" />,
  }))
  const aspectOptions = (selected?.aspects || []).map((value) => ({
    value,
    label: value,
    meta: value === '9:16' ? 'Reels / TikTok / Shorts' : value === '16:9' ? 'Landscape video' : value === '4:5' ? 'Portrait feed' : 'Square social',
    icon: <Film className="size-3.5" />,
  }))
  const fpsOptions = fpsValues.map((value) => ({ value, label: value + ' fps', meta: value >= 48 ? 'Smoother motion' : 'Standard motion' }))
  const audioOptions = [
    { value: 'on', label: 'Native audio on', meta: 'Generate sound with the video' },
    { value: 'off', label: 'Silent video', meta: 'Visual-only generation' },
  ]

  return createPortal(<div className="ai-studio-modal-backdrop fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-[#01070d]/94 p-1.5 sm:p-4">
    <div className="ai-studio-modal-enter relative flex h-[min(940px,97vh)] w-full max-w-[1580px] flex-col overflow-hidden rounded-[26px] border border-brand-cyan/25 bg-[radial-gradient(circle_at_12%_12%,rgba(0,214,192,.07),transparent_27%),linear-gradient(145deg,#061824,#020b13)] shadow-[0_28px_90px_rgba(0,0,0,.58)] sm:rounded-[30px]">
      <VideoModelPicker
        open={modelPickerOpen}
        models={models}
        selectedId={selected?.id || ''}
        onSelect={(model) => {
          setRoutingChoice('manual')
          setRecommendation('')
          applyModel(model)
        }}
        onClose={() => setModelPickerOpen(false)}
      />

      <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-soft px-3 py-3 sm:px-6">
        <div className="min-w-0">
          <span className="text-[8px] font-bold uppercase tracking-[.18em] text-brand-cyan">Generative Video</span>
          <h2 className="mt-1 truncate text-base font-bold">AI Video Studio <span className="font-medium text-text-soft">· Professional creator</span></h2>
          {catalogLabel && <p className="mt-1 text-[7px] text-text-soft">{catalogLabel}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-xl border border-border-soft px-2.5 py-2 text-[8px] font-semibold text-text-muted transition hover:border-brand-cyan/30 hover:text-white sm:px-3 sm:text-[9px]" onClick={() => setStudioKind('choose')}><ArrowLeft className="mr-1.5 inline size-3.5" />Video types</button>
          <span className="rounded-full border border-amber-400/25 bg-amber-400/[.06] px-2.5 py-1 text-[8px] font-bold text-amber-300 sm:px-3 sm:text-[9px]">{credits} credits</span>
          <button className="grid size-9 place-items-center rounded-xl border border-border-soft text-text-muted transition hover:border-brand-cyan/30 hover:text-white" onClick={onClose}><X className="size-4" /></button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 overflow-y-auto overflow-x-hidden lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] lg:overflow-hidden">
        <section className="min-w-0 p-3 sm:p-5 lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-border-soft">
          <div className="rounded-[24px] border border-border-soft bg-black/12 p-4 shadow-[inset_0_1px_rgba(255,255,255,.025)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[8px] font-bold uppercase tracking-[.14em] text-text-soft">Creative brief</span>
                <h3 className="mt-1 text-sm font-bold">Describe the video you want</h3>
              </div>
              <Button size="sm" variant="secondary" disabled={polishing || prompt.trim().length < 2} onClick={() => void polishWithAI()}>
                {polishing ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                AI analyse & polish
              </Button>
            </div>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={5}
              className="mt-3 w-full resize-none rounded-2xl border border-brand-cyan/20 bg-bg/60 px-3.5 py-3 text-[11px] leading-5 outline-none transition focus:border-brand-cyan/45 focus:shadow-[0_16px_50px_rgba(0,214,192,.06)]"
              placeholder="e.g. Create a polished 9:16 Reel with a fast hook, realistic motion, clear product focus and a strong closing CTA…"
            />
          </div>

          <div className="mt-4">
            <span className="text-[8px] font-bold uppercase tracking-[.14em] text-text-soft">Model routing</span>
            <h3 className="mt-1 text-sm font-bold">AI Recommended or choose the model yourself</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <RouteChoice
                active={routingChoice === 'recommended'}
                busy={recommending}
                icon={recommending ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                title="AI Recommended"
                text="Analyse the brief and references, then route to the best quality-to-cost model."
                onClick={() => {
                  setRoutingChoice('recommended')
                  void recommend()
                }}
              />
              <RouteChoice
                active={routingChoice === 'manual'}
                icon={<Film className="size-4" />}
                title="Choose Model"
                text="Browse Best Value, Popular, specialist and all generation-ready models."
                onClick={() => {
                  setRoutingChoice('manual')
                  setModelPickerOpen(true)
                }}
              />
            </div>
          </div>

          {recommendation && <div className="mt-3 rounded-[20px] border border-brand-green/20 bg-brand-green/[.045] p-3.5">
            <div className="flex items-start gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-xl border border-brand-green/20 bg-brand-green/10 text-brand-green"><Check className="size-4" /></span>
              <div className="min-w-0">
                <span className="text-[8px] font-bold uppercase tracking-[.13em] text-brand-green">AI recommendation</span>
                <p className="mt-1 text-[9px] leading-4 text-text-muted">{recommendation}</p>
              </div>
            </div>
          </div>}

          {selected && <div className="mt-4 rounded-[24px] border border-border-soft bg-black/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[8px] font-bold uppercase tracking-[.14em] text-text-soft">Selected model</span>
                <h3 className="mt-1 truncate text-sm font-bold">{selected.name}</h3>
                <p className="mt-1 text-[8px] text-text-muted">{selected.creator || selected.badge || 'Runware'}{selected.baselineCredits ? ' · from ' + selected.baselineCredits + ' credits' : ''}</p>
              </div>
              <button type="button" onClick={() => { setRoutingChoice('manual'); setModelPickerOpen(true) }} className="rounded-xl border border-violet-300/20 bg-violet-300/[.04] px-3 py-2 text-[8px] font-semibold text-violet-200 transition hover:border-violet-300/40">Change model</button>
            </div>
            <p className="mt-3 text-[8px] leading-4 text-text-soft">{selected.description}</p>

            {modeOptions.length > 1 && <div className="mt-4">
              <span className="text-[8px] font-semibold uppercase tracking-[.12em] text-text-soft">Generation mode</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {modeOptions.map((mode) => <button
                  type="button"
                  key={mode}
                  onClick={() => setGenerationMode(mode)}
                  className={cx(
                    'rounded-2xl border p-3 text-left transition',
                    generationMode === mode ? 'border-brand-cyan/35 bg-brand-cyan/[.07]' : 'border-border-soft bg-white/[.02] hover:border-brand-cyan/20',
                  )}
                >
                  <strong className="block text-[9px] text-white">{modeLabel(mode)}</strong>
                  <span className="mt-1 block text-[7px] leading-3 text-text-soft">{modeDescription(mode)}</span>
                </button>)}
              </div>
            </div>}

            {modeOptions.length === 1 && <div className="mt-3 inline-flex rounded-full border border-brand-cyan/20 bg-brand-cyan/[.04] px-2.5 py-1 text-[8px] text-brand-cyan">{modeLabel(modeOptions[0])}</div>}

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {durationOptions.length > 0 && <StudioSelect label="Duration" value={duration} options={durationOptions} onChange={setDuration} accent="cyan" />}
              {resolutionOptions.length > 0 && <StudioSelect label="Resolution" value={resolution} options={resolutionOptions} onChange={setResolution} accent="green" />}
              {aspectOptions.length > 0 && <StudioSelect label="Aspect ratio" value={aspectRatio} options={aspectOptions} onChange={setAspectRatio} accent="violet" />}
              {fpsOptions.length > 0 && fps !== undefined && <StudioSelect label="Frame rate" value={fps} options={fpsOptions} onChange={setFps} accent="cyan" />}
              {selected.audioSupported && <StudioSelect label="Audio" value={audio ? 'on' : 'off'} options={audioOptions} onChange={(value) => setAudio(value === 'on')} accent="amber" />}
            </div>

            {selected.draftSupported && <button
              type="button"
              onClick={() => setDraft((value) => !value)}
              className={cx(
                'mt-3 flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition-all duration-300 hover:-translate-y-0.5',
                draft ? 'border-brand-cyan/35 bg-brand-cyan/[.07] shadow-[0_12px_38px_rgba(0,214,192,.07)]' : 'border-border-soft bg-white/[.025]',
              )}
            >
              <span>
                <strong className="block text-[9px]">Draft preview</strong>
                <span className="text-[8px] text-text-soft">Use the model's lower-cost draft capability before a standard render.</span>
              </span>
              <span className={cx('relative h-6 w-11 rounded-full border transition', draft ? 'border-brand-cyan/40 bg-brand-cyan/20' : 'border-white/10 bg-black/30')}>
                <span className={cx('absolute top-0.5 size-[18px] rounded-full bg-white shadow transition-all', draft ? 'left-[21px]' : 'left-0.5')} />
              </span>
            </button>}
          </div>}

          {selected && generationMode === 'IMAGE_TO_VIDEO' && <div className="mt-4 rounded-[22px] border border-border-soft bg-black/10 p-4">
            <span className="text-[8px] font-bold uppercase tracking-[.14em] text-text-soft">Image guidance</span>
            <h3 className="mt-1 text-sm font-bold">Animate a visual starting point</h3>
            <p className="mt-2 text-[9px] leading-4 text-text-muted">Only the controls this model supports are shown.</p>
            <div className={cx('mt-3 grid gap-3', selected.lastFrameSupported && 'sm:grid-cols-2')}>
              <div className="rounded-2xl border border-border-soft bg-white/[.02] p-3">
                <strong className="text-[9px]">First frame / source image</strong>
                {firstFrame
                  ? <div className="mt-2"><ReferenceRow asset={firstFrame} onRemove={() => setFirstFrame(null)} /></div>
                  : <Button className="mt-3" disabled={uploading} onClick={() => firstFrameInput.current?.click()}><Upload className="size-3.5" />{uploading ? 'Uploading…' : 'Add image'}</Button>}
                <input ref={firstFrameInput} type="file" accept="image/*" className="hidden" onChange={(event) => void uploadReference(event, 'first')} />
              </div>
              {selected.lastFrameSupported && <div className="rounded-2xl border border-border-soft bg-white/[.02] p-3">
                <strong className="text-[9px]">Last frame</strong>
                {lastFrame
                  ? <div className="mt-2"><ReferenceRow asset={lastFrame} onRemove={() => setLastFrame(null)} /></div>
                  : <Button className="mt-3" disabled={uploading} onClick={() => lastFrameInput.current?.click()}><Upload className="size-3.5" />{uploading ? 'Uploading…' : 'Add last frame'}</Button>}
                <input ref={lastFrameInput} type="file" accept="image/*" className="hidden" onChange={(event) => void uploadReference(event, 'last')} />
              </div>}
            </div>
          </div>}

          {selected && generationMode === 'REFERENCE_TO_VIDEO' && <div className="mt-4 rounded-[22px] border border-border-soft bg-black/10 p-4">
            <span className="text-[8px] font-bold uppercase tracking-[.14em] text-text-soft">Reference guidance</span>
            <h3 className="mt-1 text-sm font-bold">Guide the video with reference images</h3>
            <p className="mt-2 text-[9px] leading-4 text-text-muted">Use product, character, style or scene references. Up to {MAX_REFERENCE_IMAGES} images are kept in this workspace.</p>
            {referenceAssets.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{referenceAssets.map((reference) => <ReferenceRow key={reference.id} asset={reference} onRemove={() => setReferenceAssets((current) => current.filter((item) => item.id !== reference.id))} />)}</div>}
            {referenceAssets.length < MAX_REFERENCE_IMAGES && <Button className="mt-3" disabled={uploading} onClick={() => referencesInput.current?.click()}><Upload className="size-3.5" />{uploading ? 'Uploading…' : 'Add reference images'}</Button>}
            <input ref={referencesInput} type="file" multiple accept="image/*" className="hidden" onChange={(event) => void uploadReference(event, 'references')} />
          </div>}

          <div className="mt-4 rounded-[22px] border border-brand-cyan/20 bg-[linear-gradient(145deg,rgba(0,214,192,.05),rgba(2,13,21,.35))] p-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <span className="text-[8px] font-bold uppercase tracking-[.14em] text-brand-cyan">Live generation cost</span>
                <div className="mt-2 flex items-baseline gap-2"><strong className="text-3xl tracking-tight">{credits}</strong><span className="text-[9px] text-text-muted">INXSocial credits</span></div>
              </div>
              {selected && <span className="max-w-[180px] text-right text-[7px] leading-3 text-text-soft">{selected.name} · {modeLabel(generationMode)}</span>}
            </div>
            <p className="mt-2 text-[8px] leading-4 text-text-soft">Recalculates from the selected model and supported settings before generation. Successful renders are reconciled against actual provider cost.</p>
          </div>

          {referenceMissing && <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/[.05] px-3 py-2.5 text-[8px] text-amber-100">Add a reference image to use {modeLabel(generationMode)}.</div>}
          {error && <div className="mt-3 rounded-2xl border border-red-400/25 bg-red-500/[.06] px-3 py-2.5 text-[9px] text-red-200">{error}</div>}
        </section>

        <section className="flex min-w-0 flex-col bg-black/10 p-3 sm:p-5 lg:min-h-0">
          <div className="flex min-h-[520px] min-w-0 flex-1 flex-col gap-3 2xl:flex-row lg:min-h-0">
            <div className="min-h-[420px] min-w-0 flex-1 overflow-y-auto rounded-[26px] border border-border-soft bg-[radial-gradient(circle_at_50%_25%,rgba(0,214,192,.08),transparent_43%)] p-4 lg:min-h-0">
              {!asset && !rendering && <div className="grid h-full min-h-[430px] place-items-center text-center">
                <div className="max-w-md">
                  <span className="mx-auto grid size-16 place-items-center rounded-[22px] border border-brand-cyan/25 bg-brand-cyan/[.07] text-brand-cyan shadow-[0_18px_60px_rgba(0,214,192,.08)]"><Film className="size-7" /></span>
                  <h3 className="mt-5 text-lg font-bold">Build the video in one workspace.</h3>
                  <p className="mt-2 text-[10px] leading-5 text-text-muted">Describe the idea, let AI route it or choose a model, then INXSocial shows only the controls and reference inputs that model supports.</p>
                  {selected && <div className="mx-auto mt-4 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-border-soft bg-black/20 px-3 py-1.5 text-[8px] text-text-soft"><span className="size-1.5 rounded-full bg-brand-green" />{selected.name} · {modeLabel(generationMode)} · {duration}s · {resolution}</div>}
                </div>
              </div>}
              {rendering && <div className="grid h-full min-h-[430px] place-items-center text-center">
                <div>
                  <LoaderCircle className="mx-auto size-10 animate-spin text-brand-cyan" />
                  <h3 className="mt-4 text-base font-bold">Generating in the background…</h3>
                  <p className="mt-2 text-[9px] text-text-muted">You may close this window. Progress continues and the finished video is saved to Media Library.</p>
                </div>
              </div>}
              {asset && <div>
                <video className="max-h-[580px] w-full rounded-2xl bg-black object-contain" controls src={asset.url} />
                <div className="mt-4 rounded-2xl border border-border-soft bg-bg/35 p-4">
                  <span className="text-[8px] font-bold uppercase tracking-[.13em] text-text-soft">Post package</span>
                  <p className="mt-2 text-[10px] leading-5">{brief?.caption || asset.caption || 'Video generated and ready for your post.'}</p>
                  {(brief?.hashtags || asset.hashtags || []).length > 0 && <p className="mt-2 text-[9px] text-text-muted">{(brief?.hashtags || asset.hashtags || []).map((tag) => '#' + tag.replace(/^#/, '')).join(' ')}</p>}
                </div>
              </div>}
            </div>
            <VideoProductionRail currentJobId={selectedProductionId || jobId} kind="generative" onOpen={openProduction} />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Button disabled={!asset} onClick={() => void saveDraft()}><Save className="size-3.5" />Save draft</Button>
            <Button disabled={!asset} onClick={continueToPosts}>Post / Schedule <ArrowRight className="size-3.5" /></Button>
            <Button
              variant="primary"
              disabled={rendering || insufficient || referenceMissing || prompt.trim().length < 2 || !selected}
              onClick={() => void requestGeneration()}
            >
              <WandSparkles className="size-3.5" />
              {rendering ? 'Rendering in background…' : 'Generate video · ' + credits + ' credits'}
            </Button>
          </div>
          {insufficient && <p className="mt-2 text-right text-[8px] text-red-300">You need more AI credits for this configuration.</p>}
        </section>
      </div>
    </div>
  </div>, document.body)
}
