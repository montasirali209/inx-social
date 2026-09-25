import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ArrowRight, BadgeCheck, Boxes, CalendarRange, Check, CirclePlay,
  Crown, FileText, Film, Globe2, ImagePlus, Images, LoaderCircle, PackageOpen, Search,
  Sparkles, Upload, UserRound, UsersRound, WandSparkles, X,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchMediaLibrary } from '../../lib/media-library-api'
import { deleteAIDraft, saveAIDraft } from '../../lib/ai-content-studio-api'
import {
  analyzeUGCBrand,
  createUGCCampaign,
  estimateUGCCampaign,
  fetchUGCAvatarImage,
  fetchUGCGeneratedReferenceImage,
  generateUGCReference,
  getUGCCampaign,
  getUGCOverview,
  regenerateUGCAd,
  uploadUGCProductAsset,
  trackUGCStudioEvent,
} from '../../lib/ugc-studio-api'
import type { MediaAsset } from '../../types/media-library'
import type {
  CreateUGCCampaignInput, UGCAdCount, UGCAvatar, UGCBrandProfile, UGCCampaign,
  UGCCampaignType, UGCCreativeFormat, UGCDuration, UGCGeneratedReference, UGCProductAsset, UGCQuality, UGCSourceType, UGCWizardDraftSeed,
} from '../../types/ugc-studio'
import { Button } from '../ui/Button'
import './ugc-wizard.css'

type WizardStep = 'source' | 'brand' | 'avatar' | 'video' | 'review' | 'finish'

const steps: Array<{ key: WizardStep; group: string; label: string }> = [
  { key: 'source', group: 'YOUR BRAND', label: 'Source' },
  { key: 'brand', group: 'YOUR BRAND', label: 'Brand' },
  { key: 'avatar', group: 'YOUR CONTENT', label: 'Creator' },
  { key: 'video', group: 'GO LIVE', label: 'Production' },
  { key: 'review', group: 'GO LIVE', label: 'Review & credits' },
  { key: 'finish', group: 'GO LIVE', label: 'Finish' },
]

const durations: UGCDuration[] = [20, 30, 45, 60]
const adCounts: UGCAdCount[] = [1, 5, 10, 15, 20]
const terminal = new Set(['READY', 'PARTIAL', 'FAILED'])
const busyStatuses = new Set(['QUEUED', 'RENDERING', 'RESERVING', 'PLANNING'])

function StepChoice<T extends string | number>({ value, current, onClick, children }: { value: T; current: T; onClick: (value: T) => void; children: ReactNode }) {
  return <button className={`ugc-wizard-choice ${value === current ? 'ugc-wizard-choice-active' : ''}`} onClick={() => onClick(value)} type="button">{children}</button>
}

function AvatarPortrait({ avatar }: { avatar: UGCAvatar }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    let created: string | null = null
    if (!avatar.imageUrl) return undefined
    void fetchUGCAvatarImage(avatar).then((value) => {
      if (!value) return
      if (!active) { URL.revokeObjectURL(value); return }
      created = value
      setUrl(value)
    })
    return () => { active = false; if (created) URL.revokeObjectURL(created) }
  }, [avatar])
  if (url) return <img alt="" className="size-full object-cover" src={url} />
  return <div className="ugc-wizard-avatar-placeholder grid size-full place-items-center text-sm font-bold">{avatar.name.slice(0, 1)}</div>
}

function Rail({ current, furthest, onStep }: { current: number; furthest: number; onStep: (step: number) => void }) {
  return <aside className="ugc-wizard-rail">
    {steps.map((step, index) => {
      const groupChanged = index === 0 || steps[index - 1].group !== step.group
      const done = index < current
      const active = index === current
      const reachable = index <= furthest
      return <div key={step.key}>
        {groupChanged && <div className="ugc-wizard-group">{step.group}</div>}
        <button className={`ugc-wizard-rail-item ${active ? 'active' : ''} ${done ? 'done' : ''}`} disabled={!reachable} onClick={() => reachable && onStep(index)} type="button">
          <span className="ugc-wizard-dot">{done ? <Check className="size-3" /> : index + 1}</span><span>{step.label}</span>
        </button>
      </div>
    })}
  </aside>
}

export function UGCWizardModal({
  open,
  seedCampaign,
  seedDraft,
  onClose,
  onBackToHome,
  onToast,
}: {
  open: boolean
  seedCampaign?: UGCCampaign | null
  seedDraft?: UGCWizardDraftSeed | null
  onClose: () => void
  onBackToHome: () => void
  onToast: (message: string) => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const initialStep = Math.max(0, Math.min(steps.length - 1, Number.isInteger(seedDraft?.wizardStep) ? Number(seedDraft?.wizardStep) : seedDraft?.brandProfileId ? 2 : 0))
  const [step, setStep] = useState(initialStep)
  const [furthest, setFurthest] = useState(initialStep)
  const [sourceType, setSourceType] = useState<UGCSourceType>(seedCampaign?.sourceType || seedDraft?.sourceType || 'WEBSITE')
  const [productUrl, setProductUrl] = useState(seedCampaign?.productUrl || seedDraft?.productUrl || '')
  const [description, setDescription] = useState(seedCampaign?.productDescription || seedDraft?.productDescription || '')
  const [brand, setBrand] = useState<UGCBrandProfile | null>(null)
  const [productAssets, setProductAssets] = useState<UGCProductAsset[]>([])
  const [seedProductIds] = useState<string[]>(seedCampaign?.productAssetIds || seedDraft?.productAssetIds || [])
  const [creatorMode, setCreatorMode] = useState<'AUTO' | 'SELECTED' | 'NONE'>(seedCampaign?.creatorMode || seedDraft?.creatorMode || 'AUTO')
  const [avatarId, setAvatarId] = useState<string | null>(seedCampaign?.selectedAvatarId || seedDraft?.avatarId || null)
  const [referencePrompt, setReferencePrompt] = useState(seedDraft?.referencePrompt || '')
  const [generatedReferences, setGeneratedReferences] = useState<UGCGeneratedReference[]>(seedDraft?.generatedReferences || [])
  const [selectedGeneratedProductIds, setSelectedGeneratedProductIds] = useState<string[]>(seedDraft?.selectedGeneratedProductIds || [])
  const [referencePreview, setReferencePreview] = useState<UGCGeneratedReference | null>(null)
  const draftId = useRef(seedDraft?.draftId || ('ugc-draft-' + crypto.randomUUID()))
  const [creatorPickerOpen, setCreatorPickerOpen] = useState(false)
  const [showAllCreators, setShowAllCreators] = useState(false)
  const [creatorSearch, setCreatorSearch] = useState('')
  const [creatorCategory, setCreatorCategory] = useState('ALL')
  const [creatorPresentation, setCreatorPresentation] = useState('ALL')
  const [creatorAgeBand, setCreatorAgeBand] = useState('ALL')
  const [creatorLocale, setCreatorLocale] = useState('ALL')
  const [duration, setDuration] = useState<UGCDuration>(([20,30,45,60] as number[]).includes(seedCampaign?.duration || 0) ? seedCampaign!.duration as UGCDuration : ([20,30,45,60] as number[]).includes(seedDraft?.duration || 0) ? seedDraft!.duration as UGCDuration : 20)
  const [adCount, setAdCount] = useState<UGCAdCount>(([1,5,10,15,20] as number[]).includes(seedCampaign?.adCount || 0) ? seedCampaign!.adCount as UGCAdCount : ([1,5,10,15,20] as number[]).includes(seedDraft?.adCount || 0) ? seedDraft!.adCount as UGCAdCount : 5)
  const [quality, setQuality] = useState<UGCQuality>(seedCampaign?.quality || seedDraft?.quality || 'STANDARD')
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const autoReturnedToStudio = useRef(false)
  const [error, setError] = useState('')

  const overview = useQuery({ queryKey: ['ugc-studio-overview'], queryFn: getUGCOverview, enabled: open, staleTime: 8_000 })
  const selectedBrand = brand || overview.data?.brands.find((item) => item.id === (seedCampaign?.brandProfileId || seedDraft?.brandProfileId)) || null
  const productAssetIds = useMemo(() => [...new Set([...seedProductIds, ...productAssets.map((asset) => asset.id), ...selectedGeneratedProductIds])].slice(0, 8), [seedProductIds, productAssets, selectedGeneratedProductIds])

  const campaignType: UGCCampaignType = creatorMode === 'NONE' ? 'PRODUCT_SHOWCASE' : 'AUTO'
  const creativeFormat: UGCCreativeFormat = 'AUTO'

  const input = useMemo<CreateUGCCampaignInput>(() => ({
    brandProfileId: selectedBrand?.id || seedCampaign?.brandProfileId || seedDraft?.brandProfileId || null,
    productUrl: selectedBrand ? '' : productUrl.trim(),
    productDescription: description.trim(),
    productAssetIds,
    sourceType,
    campaignType,
    creativeFormat,
    creatorMode,
    avatarId: creatorMode === 'SELECTED' ? avatarId : null,
    duration,
    adCount,
    quality,
    notes: seedCampaign?.notes || seedDraft?.notes || '',
  }), [selectedBrand, seedCampaign?.brandProfileId, seedCampaign?.notes, seedDraft?.brandProfileId, seedDraft?.notes, productUrl, description, productAssetIds, sourceType, campaignType, creativeFormat, creatorMode, avatarId, duration, adCount, quality])

  const estimate = useQuery({
    queryKey: ['ugc-wizard-estimate', duration, adCount, quality, campaignType, creativeFormat],
    queryFn: () => estimateUGCCampaign({ duration, adCount, quality, campaignType, creativeFormat }),
    enabled: open && step >= 3,
    staleTime: 60_000,
  })

  const campaign = useQuery({
    queryKey: ['ugc-campaign', campaignId],
    queryFn: () => getUGCCampaign(campaignId!),
    enabled: open && Boolean(campaignId),
    refetchInterval: (query) => {
      const value = query.state.data
      return value && terminal.has(value.status) ? false : 3500
    },
  })

  const media = useQuery({
    queryKey: ['media-library', 'ugc-wizard', campaignId],
    queryFn: fetchMediaLibrary,
    enabled: open && Boolean(campaign.data?.ads.some((ad) => ad.mediaAssetId)),
    refetchInterval: campaign.data && !terminal.has(campaign.data.status) ? 5000 : false,
  })
  const assetsById = useMemo(() => new Map((media.data?.assets || []).map((asset) => [asset.id, asset])), [media.data])

  useEffect(() => {
    if (!open) return
    const bodyOverflow = document.body.style.overflow
    const htmlOverflow = document.documentElement.style.overflow
    const bodyOverscroll = document.body.style.overscrollBehavior
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    return () => {
      document.body.style.overflow = bodyOverflow
      document.documentElement.style.overflow = htmlOverflow
      document.body.style.overscrollBehavior = bodyOverscroll
    }
  }, [open])

  useEffect(() => {
    if (!open || campaignId) return
    const meaningful = step > 0 || Boolean(productUrl.trim() || description.trim() || referencePrompt.trim() || productAssetIds.length || avatarId || generatedReferences.length)
    if (!meaningful) return
    const timer = window.setTimeout(() => { void persistDraft().catch(() => undefined) }, 700)
    return () => window.clearTimeout(timer)
  }, [open, campaignId, step, productUrl, description, referencePrompt, productAssetIds, avatarId, generatedReferences, selectedGeneratedProductIds, creatorMode, duration, adCount, quality, selectedBrand?.id])

  useEffect(() => {
    if (!campaign.data || !terminal.has(campaign.data.status)) return
    void queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
    void queryClient.invalidateQueries({ queryKey: ['ai-studio-access'] })
  }, [campaign.data, queryClient])

  useEffect(() => {
    if (!open || steps[step]?.key !== 'finish' || autoReturnedToStudio.current) return
    const value = campaign.data
    if (!value || value.status !== 'READY' || !value.ads.length) return
    const allPublishable = value.ads.every((ad) => Boolean(ad.mediaAssetId && ad.qualityControl?.publishable))
    if (!allPublishable) return
    autoReturnedToStudio.current = true
    void queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
    void queryClient.invalidateQueries({ queryKey: ['media-library'] })
    onToast(value.ads.length === 1 ? 'Your UGC video is ready.' : `${value.ads.length} UGC videos are ready.`)
    onBackToHome()
  }, [campaign.data, onBackToHome, onToast, open, queryClient, step])

  const analyze = useMutation({
    mutationFn: () => analyzeUGCBrand(productUrl),
    onSuccess: (value) => {
      setBrand(value)
      setError('')
      moveTo(1)
      void queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
    },
    onError: (value) => setError(value instanceof Error ? value.message : 'We could not analyse that website.'),
  })

  const create = useMutation({
    mutationFn: () => createUGCCampaign(input),
    onSuccess: (value) => {
      setCampaignId(value.id)
      setError('')
      void deleteAIDraft(draftId.current).catch(() => undefined)
      void queryClient.invalidateQueries({ queryKey: ['ugc-drafts'] })
      void queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
    },
    onError: (value) => setError(value instanceof Error ? value.message : 'The UGC campaign could not be started.'),
  })

  const retryAd = useMutation({
    mutationFn: regenerateUGCAd,
    onSuccess: async () => {
      setError('')
      await queryClient.invalidateQueries({ queryKey: ['ugc-campaign', campaignId] })
      await queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
      onToast('UGC variation queued again.')
    },
    onError: (value) => setError(value instanceof Error ? value.message : 'The UGC variation could not be retried.'),
  })

  const generateReference = useMutation({
    mutationFn: () => generateUGCReference({ prompt: referencePrompt, brandProfileId: selectedBrand?.id || null }),
    onSuccess: async ({ generated }) => {
      setGeneratedReferences((current) => [...current, generated])
      setReferencePrompt('')
      setError('')
      await queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
      await queryClient.invalidateQueries({ queryKey: ['ai-studio-access'] })
      onToast(generated.kind === 'AVATAR' ? 'Avatar created. Select it below when you want to use it.' : 'Product image created. Select it below when you want to use it.')
    },
    onError: (value) => setError(value instanceof Error ? value.message : 'The image could not be generated.'),
  })

  function moveTo(next: number) {
    const bounded = Math.max(0, Math.min(steps.length - 1, next))
    setStep(bounded)
    setFurthest((current) => Math.max(current, bounded))
  }

  async function persistDraft() {
    if (campaignId) return
    const meaningful = step > 0 || Boolean(productUrl.trim() || description.trim() || referencePrompt.trim() || productAssetIds.length || avatarId || generatedReferences.length)
    if (!meaningful) return
    const title = (selectedBrand?.productName || selectedBrand?.name || description.trim() || 'UGC draft').slice(0, 120)
    await saveAIDraft({
      id: draftId.current,
      contentType: 'ugc_ad',
      title,
      thumbnailUrl: generatedReferences[0]?.imageUrl || undefined,
      updatedAt: new Date().toISOString(),
      status: 'draft',
      prompt: description.trim() || productUrl.trim() || referencePrompt.trim(),
      asset: {
        kind: 'ugc_wizard',
        version: 1,
        draftId: draftId.current,
        wizardStep: step,
        sourceType,
        productUrl,
        productDescription: description,
        productAssetIds,
        brandProfileId: selectedBrand?.id || seedCampaign?.brandProfileId || seedDraft?.brandProfileId || null,
        creatorMode,
        avatarId: creatorMode === 'SELECTED' ? avatarId : null,
        duration,
        adCount,
        quality,
        campaignType,
        creativeFormat,
        referencePrompt,
        generatedReferences,
        selectedGeneratedProductIds,
      } as never,
    })
    void queryClient.invalidateQueries({ queryKey: ['ugc-drafts'] })
  }

  function closeWithDraft() {
    void persistDraft().catch(() => undefined)
    onClose()
  }

  function backHomeWithDraft() {
    void persistDraft().catch(() => undefined)
    onBackToHome()
  }

  async function uploadProducts(files: FileList | null) {
    if (!files?.length) return
    setError('')
    try {
      const selected = Array.from(files).slice(0, Math.max(0, 8 - productAssets.length))
      const uploaded: UGCProductAsset[] = []
      for (const file of selected) uploaded.push(await uploadUGCProductAsset(file, selectedBrand?.id))
      setProductAssets((current) => [...current, ...uploaded].slice(0, 8))
      if (sourceType !== 'PRODUCT') setSourceType('PRODUCT')
    } catch (value) { setError(value instanceof Error ? value.message : 'Product image upload failed.') }
  }

  async function continueSource() {
    setError('')
    if ((sourceType === 'WEBSITE' || sourceType === 'PRODUCT') && productUrl.trim()) {
      void trackUGCStudioEvent({ event: 'SOURCE_COMPLETED', stage: 'source', metadata: { sourceType, hasProductAssets: Boolean(productAssets.length || seedProductIds.length) } })
      analyze.mutate()
      return
    }
    if (sourceType === 'PRODUCT' && (productAssets.length || seedProductIds.length || description.trim().length >= 8)) {
      void trackUGCStudioEvent({ event: 'SOURCE_COMPLETED', stage: 'source', metadata: { sourceType, hasProductAssets: Boolean(productAssets.length || seedProductIds.length) } })
      moveTo(1)
      return
    }
    if (sourceType === 'BRIEF' && description.trim().length >= 12) {
      void trackUGCStudioEvent({ event: 'SOURCE_COMPLETED', stage: 'source', metadata: { sourceType } })
      moveTo(1)
      return
    }
    setError(sourceType === 'PRODUCT' ? 'Add a product URL, upload at least one product image, or describe the product.' : 'Add enough information for INXSocial to understand the offer.')
  }

  function selectGeneratedReference(reference: UGCGeneratedReference) {
    setError('')
    if (reference.kind === 'AVATAR' && reference.avatarId) {
      setCreatorMode('SELECTED')
      setAvatarId(reference.avatarId)
      return
    }
    if (reference.kind === 'PRODUCT' && reference.productAssetId) {
      setSelectedGeneratedProductIds((current) => current.includes(reference.productAssetId!)
        ? current.filter((id) => id !== reference.productAssetId)
        : [...current, reference.productAssetId!].slice(0, 8))
    }
  }

  function continueCreator() {
    if (creatorMode === 'SELECTED' && !avatarId) {
      setError('Choose a creator before continuing.')
      return
    }
    if (creatorMode === 'NONE' && !productAssetIds.length && !selectedBrand?.brandReferences?.length) {
      setError('No creator needs a product reference. Generate a product image below or go back and add a product photo.')
      return
    }
    void trackUGCStudioEvent({ event: 'CREATOR_SELECTED', stage: 'creator', metadata: { creatorMode, avatarScope: selectedAvatar?.scope || creatorMode } })
    moveTo(3)
  }

  function scheduleReady() {
    const current = campaign.data
    if (!current) return
    const ready = current.ads
      .filter((ad) => ad.status === 'READY' && ad.mediaAssetId && ad.qualityControl?.publishable)
      .map((ad) => ({ ad, asset: assetsById.get(ad.mediaAssetId!) }))
      .filter((value): value is { ad: typeof current.ads[number]; asset: MediaAsset } => Boolean(value.asset))
    if (!ready.length) { onToast('Wait for at least one finished UGC ad before scheduling.'); return }
    onClose()
    navigate('/bulk-scheduler', { state: {
      mediaLibraryAssets: ready.map((value) => value.asset),
      aiMixedCampaign: { id: current.id, title: current.title, posts: ready.map(({ ad }) => ({ id: ad.id, contentType: 'VIDEO' as const, caption: ad.caption || ad.script, mediaAssetId: ad.mediaAssetId! })) },
    } })
  }

  if (!open) return null
  const currentKey = steps[step].key
  const allCreators = overview.data?.avatars || []
  const featuredCreators = overview.data?.featuredAvatars?.length ? overview.data.featuredAvatars : allCreators
  const selectedAvatar = allCreators.find((avatar) => avatar.id === avatarId) || null
  const creatorCategories = [...new Set(allCreators.map((avatar) => avatar.category).filter(Boolean))].sort()
  const creatorPresentations = [...new Set(allCreators.map((avatar) => avatar.presentation).filter(Boolean))].sort()
  const creatorAgeBands = [...new Set(allCreators.map((avatar) => avatar.ageBand).filter(Boolean))].sort()
  const creatorLocales = [...new Set(allCreators.map((avatar) => avatar.locale).filter(Boolean))].sort()
  const creativeFormatOptions = overview.data?.options.creativeFormats || []
  const hasProductReference = Boolean(productAssetIds.length || selectedBrand?.brandReferences?.length)
  const hasVerifiedTransformation = Boolean(selectedBrand?.verifiedClaims?.some((claim) => /\b(before|after|improv(?:e|es|ed|ing|ement|ements)?|increas(?:e|es|ed|ing)|reduc(?:e|es|ed|ing|tion|tions)|decreas(?:e|es|ed|ing)|faster|slower|results?|transform(?:s|ed|ing|ation|ations)?|restor(?:e|es|ed|ing)|remov(?:e|es|ed|ing)|clear(?:s|ed|ing)?|sav(?:e|es|ed|ing)\s+time)\b/i.test(claim)))
  const selectedCreativeFormat = creativeFormatOptions.find((option) => option.key === creativeFormat) || null
  const creativeFormatBlocked = Boolean(selectedCreativeFormat && creativeFormat !== 'AUTO' && (
    (campaignType !== 'AUTO' && !selectedCreativeFormat.campaignTypes.includes(campaignType)) ||
    (selectedCreativeFormat.requiresProductReference && !hasProductReference) ||
    (selectedCreativeFormat.requiresVerifiedTransformation && !hasVerifiedTransformation)
  ))
  const creatorFilterActive = Boolean(creatorSearch.trim() || creatorCategory !== 'ALL' || creatorPresentation !== 'ALL' || creatorAgeBand !== 'ALL' || creatorLocale !== 'ALL')
  const creatorPool = showAllCreators || creatorFilterActive ? allCreators : featuredCreators
  const creatorNeedle = creatorSearch.trim().toLowerCase()
  const filteredCreators = creatorPool.filter((avatar) => {
    if (creatorCategory !== 'ALL' && avatar.category !== creatorCategory) return false
    if (creatorPresentation !== 'ALL' && avatar.presentation !== creatorPresentation) return false
    if (creatorAgeBand !== 'ALL' && avatar.ageBand !== creatorAgeBand) return false
    if (creatorLocale !== 'ALL' && avatar.locale !== creatorLocale) return false
    if (!creatorNeedle) return true
    const haystack = [
      avatar.name, avatar.category, avatar.presentation, avatar.ageBand, avatar.locale, avatar.accent,
      ...(avatar.niches || []), ...(avatar.environments || []), ...(avatar.languages || [])
    ].join(' ').toLowerCase()
    return haystack.includes(creatorNeedle)
  })
  const visibleCreators = showAllCreators ? filteredCreators : filteredCreators.slice(0, 12)
  const campaignAds = campaign.data?.ads || []
  const readyAds = campaignAds.filter((ad) => ad.status === 'READY').length
  const failedAds = campaignAds.filter((ad) => ad.status === 'FAILED').length
  const progress = campaignAds.length ? Math.round(campaignAds.reduce((sum, ad) => sum + Number(ad.progress || 0), 0) / campaignAds.length) : 0
  const displayProgress = failedAds && campaignAds.length ? Math.round((readyAds / campaignAds.length) * 100) : progress
  const activeAd = campaignAds.find((ad) => busyStatuses.has(ad.status))
  const activeStage = activeAd?.stageLabel || (terminal.has(campaign.data?.status || '') ? 'Finished' : 'Starting render')
  const activeDetail = activeAd?.stageDetail || (activeAd ? `${activeAd.progress}% complete` : '')
  const studioControls = overview.data?.options.studioControls
  const qualityTiers = studioControls?.qualityTiers || []
  const selectedTier = qualityTiers.find((tier) => tier.key === quality) || estimate.data?.tier || null
  const selectedDurationOption = studioControls?.durations.find((item) => item.seconds === duration) || estimate.data?.durationOption || null
  const selectedVariationOption = studioControls?.variationCounts.find((item) => item.count === adCount) || estimate.data?.variationOption || null
  const remaining = estimate.data?.affordability.balanceBefore ?? overview.data?.credits.remaining ?? 0
  const insufficient = Boolean(estimate.data && !estimate.data.affordability.affordable)

  return createPortal(<div className="ugc-wizard-backdrop">
    <section aria-label="Create UGC ad" aria-modal="true" className="ugc-wizard-panel" role="dialog">
      <header className="ugc-wizard-header">
        <div><button className="ugc-wizard-back-home" onClick={onBackToHome} type="button"><ArrowLeft className="size-3.5" />UGC Studio</button><span className="ugc-wizard-step-count">Step {step + 1} of {steps.length}</span></div>
        <button aria-label="Close UGC Studio" className="ugc-wizard-close" onClick={onClose} type="button"><X className="size-4" /></button>
        <div className="ugc-wizard-progress"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
      </header>

      <div className="ugc-wizard-layout">
        <Rail current={step} furthest={furthest} onStep={moveTo} />
        <main className="ugc-wizard-content">
          <div className="ugc-wizard-step" key={currentKey}>
            {currentKey === 'source' && <>
              <div className="ugc-wizard-title-row"><span className="ugc-wizard-icon"><Globe2 className="size-5" /></span><div><h2>What are we making this ad for?</h2><p>Start with a website, a physical product, or a short description. INXSocial does the research and creative setup from there.</p></div></div>
              <div className="ugc-source-grid mt-7">
                <button className={`ugc-source-card ${sourceType === 'WEBSITE' ? 'active' : ''}`} onClick={() => setSourceType('WEBSITE')} type="button"><Globe2 className="size-5" /><strong>Website or SaaS</strong><span>Best for apps, services, websites and software.</span></button>
                <button className={`ugc-source-card ${sourceType === 'PRODUCT' ? 'active' : ''}`} onClick={() => setSourceType('PRODUCT')} type="button"><PackageOpen className="size-5" /><strong>Physical product</strong><span>Use a product page and/or real product photos.</span></button>
                <button className={`ugc-source-card ${sourceType === 'BRIEF' ? 'active' : ''}`} onClick={() => setSourceType('BRIEF')} type="button"><FileText className="size-5" /><strong>Describe it</strong><span>No website needed. Tell us what you sell.</span></button>
              </div>

              {sourceType !== 'BRIEF' && <div className="mt-6"><span className="ugc-wizard-mini-label">{sourceType === 'PRODUCT' ? 'PRODUCT PAGE — OPTIONAL IF YOU UPLOAD PHOTOS' : 'WEBSITE · DOMAIN ONLY IS FINE'}</span><div className="ugc-wizard-url-field mt-2"><Globe2 className="size-4" /><input autoFocus onChange={(event) => { setProductUrl(event.target.value); setBrand(null); setError('') }} placeholder={sourceType === 'PRODUCT' ? 'shop.com/product' : 'yourbrand.com'} value={productUrl} /></div></div>}

              {sourceType === 'PRODUCT' && <div className="mt-5"><span className="ugc-wizard-mini-label">REAL PRODUCT IMAGES</span><label className="ugc-product-upload mt-2"><Images className="size-5" /><div><strong>Upload product photos</strong><span>PNG, JPEG or WebP · up to 8 references</span></div><input accept="image/png,image/jpeg,image/webp" className="hidden" multiple onChange={(event) => void uploadProducts(event.target.files)} type="file" /></label>{(productAssets.length || seedProductIds.length) > 0 && <div className="mt-2 flex flex-wrap gap-2">{productAssets.map((asset) => <span className="ugc-product-chip" key={asset.id}><Check className="size-3" />{asset.originalName}</span>)}{seedProductIds.map((id, index) => <span className="ugc-product-chip" key={id}><Check className="size-3" />Saved product image {index + 1}</span>)}</div>}</div>}

              {(sourceType === 'BRIEF' || sourceType === 'PRODUCT') && <div className="mt-5"><span className="ugc-wizard-mini-label">{sourceType === 'BRIEF' ? 'TELL US ABOUT THE OFFER' : 'OPTIONAL PRODUCT NOTES'}</span><textarea className="ugc-wizard-input mt-2 min-h-28 w-full resize-y" onChange={(event) => setDescription(event.target.value)} placeholder="What is it, who is it for, and what does it help with?" value={description} /></div>}

              {analyze.isPending && <div className="ugc-wizard-analyzing mt-6"><div className="ugc-wizard-scan"><span /><Search className="size-7" /></div><div><strong>Understanding your offer…</strong><p className="mt-1 text-[9px] text-text-muted">Reading the site, finding verified benefits and preparing the campaign script.</p></div></div>}
              <div className="ugc-wizard-footer"><Button onClick={onBackToHome}><ArrowLeft className="size-4" />Studio</Button><Button disabled={analyze.isPending} onClick={() => void continueSource()} variant="primary">{analyze.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{sourceType === 'WEBSITE' || productUrl.trim() ? 'Analyze & continue' : 'Continue'} <ArrowRight className="size-4" /></Button></div>
            </>}

            {currentKey === 'brand' && <>
              <div className="ugc-wizard-title-row"><span className="ugc-wizard-icon"><BadgeCheck className="size-5" /></span><div><h2>Here's what INXSocial understands.</h2><p>Check the essentials. The generator uses this as the factual boundary for the script and visual references.</p></div></div>
              {selectedBrand ? <div className="ugc-wizard-brand-card mt-7"><div className="flex items-start justify-between gap-4"><div><span className="ugc-wizard-mini-label">BRAND / OFFER</span><h3>{selectedBrand.productName || selectedBrand.name}</h3></div><BadgeCheck className="size-5 text-brand-cyan" /></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><div><span className="ugc-wizard-mini-label">COMPANY</span><strong>{selectedBrand.name}</strong></div><div><span className="ugc-wizard-mini-label">TYPE</span><strong>{selectedBrand.analysis?.offerType || 'Brand'}</strong></div></div><div className="mt-5"><span className="ugc-wizard-mini-label">WHAT IT DOES</span><p>{selectedBrand.summary}</p></div>{!!selectedBrand.audience.length && <div className="mt-5"><span className="ugc-wizard-mini-label">AUDIENCE</span><div className="mt-2 flex flex-wrap gap-2">{selectedBrand.audience.slice(0,6).map((item) => <span className="ugc-wizard-pill" key={item}>{item}</span>)}</div></div>}</div> :
                <div className="ugc-wizard-brand-card mt-7"><span className="ugc-wizard-mini-label">YOUR BRIEF</span><textarea className="ugc-wizard-input mt-3 min-h-36 w-full resize-y" onChange={(event) => setDescription(event.target.value)} value={description} /></div>}
              <div className="ugc-wizard-footer"><Button onClick={() => moveTo(0)}><ArrowLeft className="size-4" />Back</Button><Button disabled={!selectedBrand && description.trim().length < 12 && !productAssetIds.length} onClick={() => { void trackUGCStudioEvent({ event: 'BRAND_ANALYZED', stage: 'brand', metadata: { sourceType } }); moveTo(2) }} variant="primary">Looks right <ArrowRight className="size-4" /></Button></div>
            </>}

            {currentKey === 'format' && <>
              <div className="ugc-wizard-title-row"><span className="ugc-wizard-icon"><Boxes className="size-5" /></span><div><h2>How should the UGC feel?</h2><p>Choose the content style, or leave it on Auto and let the offer decide. This changes the scene plan — not the quality tier.</p></div></div>
              <div className="ugc-format-grid mt-7">
                <button className={`ugc-format-card ${campaignType === 'AUTO' ? 'active' : ''}`} onClick={() => setCampaignType('AUTO')} type="button"><span className="ugc-format-icon"><Sparkles className="size-5" /></span><strong>Choose production for me</strong><p>Website/SaaS usually becomes a creator explainer. Physical products usually become a product showcase.</p><span>Recommended</span></button>
                <button className={`ugc-format-card ${campaignType === 'AVATAR_EXPLAINER' ? 'active' : ''}`} onClick={() => setCampaignType('AVATAR_EXPLAINER')} type="button"><span className="ugc-format-icon"><UserRound className="size-5" /></span><strong>Avatar Explainer</strong><p>A realistic creator talks directly to camera and explains the offer. Ideal for SaaS, services and websites.</p><span>Creator-led</span></button>
                <button className={`ugc-format-card ${campaignType === 'PRODUCT_SHOWCASE' ? 'active' : ''}`} onClick={() => setCampaignType('PRODUCT_SHOWCASE')} type="button"><span className="ugc-format-icon"><PackageOpen className="size-5" /></span><strong>Product Showcase</strong><p>Creator-led opening plus real product cutaways, benefits and believable use-case shots.</p><span>Product-led</span></button>
              </div>
              <div className="mt-7">
                <div className="ugc-wizard-title-row"><span className="ugc-wizard-icon"><WandSparkles className="size-5" /></span><div><h3>Creative structure</h3><p>Choose the story grammar, or let INXSocial mix compatible formats across your ad variations.</p></div></div>
                <div className="ugc-format-grid mt-4">
                  {creativeFormatOptions.map((option) => {
                    const incompatibleType = campaignType !== 'AUTO' && !option.campaignTypes.includes(campaignType)
                    const missingProduct = option.requiresProductReference && !hasProductReference
                    const missingTransformation = option.requiresVerifiedTransformation && !hasVerifiedTransformation
                    const blocked = option.key !== 'AUTO' && (incompatibleType || missingProduct || missingTransformation)
                    const reason = incompatibleType ? 'Needs a different production type' : missingProduct ? 'Needs a real product reference' : missingTransformation ? 'Needs verified before/after evidence' : option.key === 'AUTO' ? 'Recommended' : option.bestFor.slice(0, 2).join(' · ')
                    return <button aria-disabled={blocked} className={`ugc-format-card ${creativeFormat === option.key ? 'active' : ''} ${blocked ? 'opacity-45' : ''}`} key={option.key} onClick={() => { if (!blocked) setCreativeFormat(option.key) }} type="button"><span className="ugc-format-icon">{option.key === 'AUTO' ? <Sparkles className="size-5" /> : <Film className="size-5" />}</span><strong>{option.label}</strong><p>{option.description}</p><span>{reason}</span></button>
                  })}
                </div>
              </div>
              {campaignType === 'PRODUCT_SHOWCASE' && !hasProductReference && <div className="mt-4 rounded-xl border border-brand-amber/25 bg-brand-amber/[.05] p-3 text-[10px] leading-4 text-brand-amber">Product Showcase needs a real product reference. Go back to Source and upload a product photo, or choose Avatar Explainer.</div>}
              {creativeFormatBlocked && <div className="mt-4 rounded-xl border border-brand-amber/25 bg-brand-amber/[.05] p-3 text-[10px] leading-4 text-brand-amber">The selected creative structure is not compatible with the current evidence or production type. Choose another structure or use Auto.</div>}
              <div className="ugc-wizard-footer"><Button onClick={() => moveTo(1)}><ArrowLeft className="size-4" />Back</Button><Button disabled={(campaignType === 'PRODUCT_SHOWCASE' && !hasProductReference) || creativeFormatBlocked} onClick={() => { void trackUGCStudioEvent({ event: 'FORMAT_SELECTED', stage: 'format', metadata: { campaignType, creativeFormat } }); moveTo(3) }} variant="primary">Continue <ArrowRight className="size-4" /></Button></div>
            </>}

            {currentKey === 'avatar' && <>
              <div className="ugc-wizard-title-row"><span className="ugc-wizard-icon"><UsersRound className="size-5" /></span><div><h2>Pick a creator.</h2><p>Keep automatic casting, or open the creator picker only when you want to browse the library.</p></div></div>
              <div className="ugc-creator-selection-summary mt-7">
                <button className={`ugc-creator-selection-option ${creatorMode === 'AUTO' ? 'selected' : ''}`} onClick={() => { setCreatorMode('AUTO'); setAvatarId(null) }} type="button">
                  <span className="ugc-wizard-auto-avatar"><Sparkles className="size-6" /></span>
                  <div><strong>Choose for me</strong><p>INXSocial casts a compatible creator for this offer and production route.</p></div>
                  {creatorMode === 'AUTO' && <span className="ugc-wizard-selected-check"><Check className="size-3" /></span>}
                </button>
                <button className={`ugc-creator-selection-option ${creatorMode === 'SELECTED' ? 'selected' : ''}`} onClick={() => setCreatorPickerOpen(true)} type="button">
                  <span className="ugc-creator-selected-placeholder"><UsersRound className="size-6" /></span>
                  <div><strong>{creatorMode === 'SELECTED' ? selectedAvatar?.name || 'Selected creator' : 'Browse creators'}</strong><p>{creatorMode === 'SELECTED' && selectedAvatar ? `${selectedAvatar.category} · ${selectedAvatar.ageBand} · ${selectedAvatar.accent || selectedAvatar.locale}` : `${allCreators.length || '100+'} reusable creators available in a focused picker.`}</p></div>
                  <ArrowRight className="size-4" />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.02] p-4">
                <div><strong className="block text-[12px] text-text-primary">Creator library loads on demand</strong><p className="mt-1 text-[10px] leading-4 text-text-muted">Portraits are not loaded while you scroll through the campaign setup. Open the picker only when you need to compare creators.</p></div>
                <Button onClick={() => setCreatorPickerOpen(true)} size="sm"><UsersRound className="size-3.5" />Browse creators</Button>
              </div>
              <div className="ugc-wizard-footer"><Button onClick={() => moveTo(2)}><ArrowLeft className="size-4" />Back</Button><Button disabled={creatorMode === 'SELECTED' && !avatarId} onClick={() => { void trackUGCStudioEvent({ event: 'CREATOR_SELECTED', stage: 'creator', metadata: { creatorMode, avatarScope: selectedAvatar?.scope || (creatorMode === 'AUTO' ? 'AUTO' : '') } }); moveTo(4) }} variant="primary">Continue <ArrowRight className="size-4" /></Button></div>
            </>}

            {currentKey === 'video' && <>
              <div className="ugc-wizard-title-row"><span className="ugc-wizard-icon"><CirclePlay className="size-5" /></span><div><h2>Choose the production setup.</h2><p>Set length, number of variations and production quality. INXSocial keeps provider/model routing automatic and hidden.</p></div></div>
              <div className="mt-7 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div className="ugc-wizard-phone-preview"><div className="ugc-wizard-phone-screen"><span className="ugc-wizard-preview-avatar">{selectedAvatar ? <AvatarPortrait avatar={selectedAvatar} /> : <UserRound className="size-8" />}</span><CirclePlay className="size-8 text-brand-cyan" /><strong>{duration}s UGC</strong><small>{selectedTier?.label || quality} · {campaignType === 'PRODUCT_SHOWCASE' ? 'Product showcase' : campaignType === 'AVATAR_EXPLAINER' ? 'Avatar explainer' : 'Auto production'}</small></div></div>
                <div className="space-y-5">
                  <div><span className="ugc-wizard-mini-label">VIDEO LENGTH</span><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{durations.map((value) => { const option = studioControls?.durations.find((item) => item.seconds === value); return <StepChoice current={duration} key={value} onClick={setDuration} value={value}><strong>{value}s</strong><small>{option?.label || (value === 20 ? 'Balanced' : value === 30 ? 'Full ad' : value === 45 ? 'Extended' : 'Long-form')}</small></StepChoice> })}</div>{selectedDurationOption?.description && <p className="mt-2 text-[10px] text-text-muted">{selectedDurationOption.description}</p>}</div>
                  <div><span className="ugc-wizard-mini-label">VARIATIONS</span><div className="mt-2 grid grid-cols-5 gap-2">{adCounts.map((value) => <StepChoice current={adCount} key={value} onClick={setAdCount} value={value}><strong>{value}</strong></StepChoice>)}</div>{selectedVariationOption?.description && <p className="mt-2 text-[10px] text-text-muted">{selectedVariationOption.description}</p>}</div>
                  <div><span className="ugc-wizard-mini-label">QUALITY</span><div className="mt-2 grid grid-cols-2 gap-2">{(qualityTiers.length ? qualityTiers : [{ key: 'STANDARD' as const, label: 'Standard', badge: 'Efficient', description: 'Natural social UGC', bestFor: [], experience: [] }, { key: 'PREMIUM' as const, label: 'Premium', badge: 'Advanced', description: 'Higher-control production', bestFor: [], experience: [] }]).map((tier) => <StepChoice current={quality} key={tier.key} onClick={setQuality} value={tier.key}>{tier.key === 'PREMIUM' ? <Crown className="mx-auto mb-1 size-4 text-[#c4b5fd]" /> : <Film className="mx-auto mb-1 size-4 text-brand-cyan" />}<strong>{tier.label}</strong><small>{tier.badge}</small></StepChoice>)}</div>{selectedTier && <div className="mt-2 rounded-xl border border-white/10 bg-white/[.025] p-3"><p className="text-[10px] leading-4 text-text-muted">{selectedTier.description}</p><div className="mt-2 flex flex-wrap gap-1.5">{selectedTier.bestFor.slice(0,3).map((item) => <span className="ugc-wizard-pill" key={item}>{item}</span>)}</div></div>}</div>
                  <div className={`ugc-credit-summary ${insufficient ? 'insufficient' : ''}`}><div><span>Live quote</span><strong>{estimate.isFetching ? '…' : estimate.data?.credits.toLocaleString() || '—'} credits</strong></div><div><span>{estimate.data?.perAd?.toLocaleString() || '—'} per ad · {remaining.toLocaleString()} available</span>{insufficient && <em>{estimate.data ? `${estimate.data.affordability.shortfall.toLocaleString()} credits short` : 'Choose a smaller setup.'}</em>}</div></div>
                </div>
              </div>
              <div className="ugc-wizard-footer"><Button onClick={() => moveTo(3)}><ArrowLeft className="size-4" />Back</Button><Button disabled={!estimate.data || estimate.isFetching} onClick={() => { void trackUGCStudioEvent({ event: 'PRODUCTION_CONFIGURED', stage: 'production', metadata: { quality, duration, adCount, credits: estimate.data?.credits || 0 } }); moveTo(5) }} variant="primary">Review campaign <ArrowRight className="size-4" /></Button></div>
            </>}

            {currentKey === 'review' && <>
              <div className="ugc-wizard-title-row"><span className="ugc-wizard-icon"><BadgeCheck className="size-5" /></span><div><h2>Review before generation.</h2><p>This is the exact customer-facing setup and credit quote. Generation starts only after you confirm below.</p></div></div>
              <div className="ugc-wizard-brand-card mt-7">
                <div className="flex items-start justify-between gap-4"><div><span className="ugc-wizard-mini-label">CAMPAIGN</span><h3>{selectedBrand?.productName || selectedBrand?.name || description.trim() || 'UGC campaign'}</h3></div><BadgeCheck className="size-5 text-brand-cyan" /></div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div><span className="ugc-wizard-mini-label">PRODUCTION</span><strong>{campaignType === 'PRODUCT_SHOWCASE' ? 'Product Showcase' : campaignType === 'AVATAR_EXPLAINER' ? 'Avatar Explainer' : 'Auto-selected production'}</strong><p className="mt-1 text-[10px] text-text-muted">{selectedCreativeFormat?.label || (creativeFormat === 'AUTO' ? 'Auto creative mix' : creativeFormat.replaceAll('_',' '))}</p></div>
                  <div><span className="ugc-wizard-mini-label">CREATOR</span><strong>{creatorMode === 'SELECTED' ? selectedAvatar?.name || 'Selected creator' : 'Auto casting'}</strong><p className="mt-1 text-[10px] text-text-muted">{overview.data?.options.creatorProfileVersion || 'Creator V2'} identity and consistency rules</p></div>
                  <div><span className="ugc-wizard-mini-label">OUTPUT</span><strong>{adCount} × {duration}s vertical ad{adCount === 1 ? '' : 's'}</strong><p className="mt-1 text-[10px] text-text-muted">{selectedVariationOption?.label || 'Campaign'} · background rendering with recovery</p></div>
                  <div><span className="ugc-wizard-mini-label">QUALITY</span><strong>{selectedTier?.label || quality}</strong><p className="mt-1 text-[10px] text-text-muted">{selectedTier?.description || 'Production quality selected.'}</p></div>
                </div>
              </div>
              <div className={`ugc-credit-summary mt-5 ${insufficient ? 'insufficient' : ''}`}>
                <div><span>Total to reserve</span><strong>{estimate.isFetching ? '…' : estimate.data?.credits.toLocaleString() || '—'} credits</strong></div>
                <div><span>{estimate.data?.perAd.toLocaleString() || '—'} per ad · {remaining.toLocaleString()} available</span>{estimate.data?.affordability.affordable && <em>{estimate.data.affordability.balanceAfter.toLocaleString()} credits remain after reservation.</em>}{insufficient && <em>{estimate.data?.affordability.shortfall.toLocaleString()} more credits needed.</em>}</div>
              </div>
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[.025] p-4 text-[10px] leading-4 text-text-muted"><strong className="text-text-primary">Pricing is fixed for this selection.</strong> Creative structure and creator choice do not change the quoted price. Provider/model routing stays automatic and is never exposed as a customer control.</div>
              {insufficient && estimate.data?.affordability.alternative && <div className="mt-4 rounded-xl border border-brand-amber/25 bg-brand-amber/[.05] p-4"><span className="ugc-wizard-mini-label">AFFORDABLE OPTION</span><div className="mt-2 flex flex-wrap items-center justify-between gap-3"><div><strong>{estimate.data.affordability.alternative.label}</strong><p className="mt-1 text-[10px] text-text-muted">{estimate.data.affordability.alternative.credits.toLocaleString()} credits total</p></div><Button onClick={() => { const alt = estimate.data?.affordability.alternative; if (!alt) return; setQuality(alt.quality); setDuration(alt.duration); setAdCount(alt.adCount); void trackUGCStudioEvent({ event: 'AFFORDABLE_SETUP_APPLIED', stage: 'review', metadata: { quality: alt.quality, duration: alt.duration, adCount: alt.adCount, credits: alt.credits } }); }} size="sm">Use this setup</Button></div></div>}
              <div className="ugc-wizard-footer"><Button onClick={() => moveTo(4)}><ArrowLeft className="size-4" />Change setup</Button><Button disabled={create.isPending || insufficient || !estimate.data || estimate.isFetching} onClick={() => { void trackUGCStudioEvent({ event: 'GENERATION_CONFIRMED', stage: 'review', metadata: { quality, duration, adCount, credits: estimate.data?.credits || 0 } }); create.mutate() }} variant="primary">{create.isPending ? <><LoaderCircle className="size-4 animate-spin" />Starting campaign…</> : <><WandSparkles className="size-4" />Confirm & generate {adCount}</>}</Button></div>
            </>}

            {currentKey === 'finish' && <>
              <div className="ugc-wizard-title-row"><span className="ugc-wizard-icon"><Sparkles className="size-5" /></span><div><h2>{failedAds === campaignAds.length && campaignAds.length ? 'This UGC campaign needs attention.' : failedAds ? 'Some UGC variations need attention.' : campaign.data?.status === 'READY' ? 'Your UGC campaign is ready.' : 'Your UGC campaign is rendering.'}</h2><p>{failedAds ? 'The failed variations can be retried. Ready videos remain available and generation errors are kept separate from successful output.' : campaign.data?.status === 'READY' ? 'Your finished videos are being returned to UGC Studio.' : 'Generation keeps running safely in the background.'}</p></div></div>
              {!terminal.has(campaign.data?.status || '') && <div className="mt-5 rounded-2xl border border-brand-cyan/20 bg-brand-cyan/[.055] p-4"><strong className="block text-sm text-white">You can leave this window at any time.</strong><p className="mt-1 text-[10px] leading-4 text-text-muted">Your UGC keeps rendering in the background. If you stay here, this window will close automatically and take you back to UGC Studio as soon as every video is finished and ready to publish.</p></div>}
              <div className="ugc-wizard-generation mt-7">
                <div className="flex items-center justify-between gap-3"><div><strong>{campaign.data?.title || 'UGC campaign'}</strong><span>{readyAds} of {campaignAds.length || adCount} ready{failedAds ? ` · ${failedAds} failed` : ''}</span></div><span className={`ugc-wizard-status ${failedAds ? 'failed' : ''}`}>{failedAds ? 'Needs retry' : `${progress}%`}</span></div>
                {!terminal.has(campaign.data?.status || '') && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px]"><strong className="text-brand-cyan">{activeStage}</strong><span className="text-text-muted">{activeDetail}</span></div>}
                <div className={`ugc-wizard-generation-bar ${failedAds ? 'failed' : ''}`}><span style={{ width: `${failedAds ? displayProgress : Math.max(4, displayProgress)}%` }} /></div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">{campaignAds.map((ad) => <article className="ugc-wizard-output-card" key={ad.id}><div><span className="ugc-wizard-mini-label">VARIATION {ad.sequence}</span><strong>{ad.title}</strong><p>{ad.hook || ad.angle}</p>{busyStatuses.has(ad.status) && <p className="mt-2 text-[9px] text-brand-cyan">{ad.stageLabel} · {ad.progress}%{ad.stageDetail ? ` · ${ad.stageDetail}` : ''}</p>}{ad.status === 'FAILED' && ad.error && <p className="mt-2 text-[9px] leading-4 text-brand-red">{ad.error}</p>}</div><div className="flex items-center justify-between gap-2"><span className={`ugc-wizard-output-status ${ad.status.toLowerCase()}`}>{ad.status}</span><div className="flex items-center gap-2">{ad.status === 'FAILED' && <Button disabled={retryAd.isPending} onClick={() => retryAd.mutate(ad.id)} size="sm" variant="primary">{retryAd.isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}Retry</Button>}<Button disabled={busyStatuses.has(ad.status)} onClick={() => { onClose(); navigate(`/ai-content-studio/ugc/${ad.id}/edit`) }} size="sm">Edit</Button></div></div></article>)}</div>
              <div className="ugc-wizard-footer"><Button onClick={onBackToHome}><ArrowLeft className="size-4" />Back to UGC Studio</Button><Button disabled={!campaign.data?.ads.some((ad) => ad.qualityControl?.publishable && ad.mediaAssetId && assetsById.has(ad.mediaAssetId))} onClick={scheduleReady} variant="primary"><CalendarRange className="size-4" />Schedule ready ads</Button></div>
            </>}
          </div>
          {error && <div className="ugc-wizard-error"><X className="size-4 shrink-0" />{error}</div>}
        </main>
      </div>
    </section>
    {creatorPickerOpen && <div className="ugc-creator-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreatorPickerOpen(false) }} role="presentation">
      <section aria-label="Choose a UGC creator" aria-modal="true" className="ugc-creator-picker" role="dialog">
        <header className="ugc-creator-picker-header"><div><span className="ugc-wizard-mini-label">CREATOR LIBRARY</span><h3>Choose a creator</h3><p>{allCreators.length} reusable creator profiles. Portraits load only while this picker is open.</p></div><button aria-label="Close creator picker" className="ugc-wizard-close" onClick={() => setCreatorPickerOpen(false)} type="button"><X className="size-4" /></button></header>
        <div className="ugc-creator-picker-body">
          <div className="ugc-creator-picker-filters">
            <label className="ugc-wizard-url-field"><Search className="size-4" /><input autoFocus onChange={(event) => setCreatorSearch(event.target.value)} placeholder="Search name, niche, accent…" value={creatorSearch} /></label>
            <select aria-label="Creator niche" className="ugc-wizard-input" onChange={(event) => setCreatorCategory(event.target.value)} value={creatorCategory}><option value="ALL">All niches</option>{creatorCategories.map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <select aria-label="Creator presentation" className="ugc-wizard-input" onChange={(event) => setCreatorPresentation(event.target.value)} value={creatorPresentation}><option value="ALL">All presentations</option>{creatorPresentations.map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <select aria-label="Creator age band" className="ugc-wizard-input" onChange={(event) => setCreatorAgeBand(event.target.value)} value={creatorAgeBand}><option value="ALL">All adult ages</option>{creatorAgeBands.map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <select aria-label="Creator locale" className="ugc-wizard-input" onChange={(event) => setCreatorLocale(event.target.value)} value={creatorLocale}><option value="ALL">All locales</option>{creatorLocales.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          </div>
          <div className="ugc-creator-picker-grid">
            <button className={`ugc-wizard-avatar-card auto ${creatorMode === 'AUTO' ? 'selected' : ''}`} onClick={() => { setCreatorMode('AUTO'); setAvatarId(null); setCreatorPickerOpen(false) }} type="button"><span className="ugc-wizard-auto-avatar"><Sparkles className="size-6" /></span><strong>Choose for me</strong><small>Automatic casting</small>{creatorMode === 'AUTO' && <span className="ugc-wizard-selected-check"><Check className="size-3" /></span>}</button>
            {visibleCreators.map((avatar) => <button className={`ugc-wizard-avatar-card ${creatorMode === 'SELECTED' && avatar.id === avatarId ? 'selected' : ''}`} key={avatar.id} onClick={() => { setCreatorMode('SELECTED'); setAvatarId(avatar.id); setCreatorPickerOpen(false) }} type="button"><div className="ugc-wizard-avatar-image"><AvatarPortrait avatar={avatar} /></div><strong>{avatar.name}</strong><small>{avatar.category} · {avatar.ageBand}</small><small>{avatar.accent || avatar.locale}{avatar.scope === 'USER' ? ' · Saved' : ''}</small>{creatorMode === 'SELECTED' && avatar.id === avatarId && <span className="ugc-wizard-selected-check"><Check className="size-3" /></span>}</button>)}
          </div>
          {!visibleCreators.length && <div className="mt-4 rounded-xl border border-white/10 bg-white/[.025] p-4 text-[10px] text-text-muted">No creators match these filters. Clear a filter or search more broadly.</div>}
          <div className="ugc-creator-picker-actions">
            {filteredCreators.length > 12 && <button className="ugc-wizard-text-button" onClick={() => setShowAllCreators((value) => !value)} type="button">{showAllCreators ? 'Show fewer creators' : `View all ${filteredCreators.length} creators`}</button>}
            {creatorFilterActive && <button className="ugc-wizard-text-button" onClick={() => { setCreatorSearch(''); setCreatorCategory('ALL'); setCreatorPresentation('ALL'); setCreatorAgeBand('ALL'); setCreatorLocale('ALL') }} type="button">Clear filters</button>}
            <button className="ugc-wizard-text-button" onClick={() => setCustomCreatorOpen((value) => !value)} type="button"><ImagePlus className="size-3.5" />Create my own</button>
          </div>
          {customCreatorOpen && <div className="ugc-wizard-custom-creator mt-5">
            <div><strong>Custom creator</strong><p>Upload your own portrait for free, or generate one for 5 credits. It stays in your reusable creator library.</p></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <input aria-label="Custom creator niche" className="ugc-wizard-input" onChange={(event) => setCustomCreatorCategory(event.target.value)} placeholder="Niche, e.g. Beauty" value={customCreatorCategory} />
              <select aria-label="Custom creator presentation" className="ugc-wizard-input" onChange={(event) => setCustomCreatorPresentation(event.target.value)} value={customCreatorPresentation}><option>Woman</option><option>Man</option><option>Non-binary</option></select>
              <select aria-label="Custom creator adult age band" className="ugc-wizard-input" onChange={(event) => setCustomCreatorAgeBand(event.target.value)} value={customCreatorAgeBand}><option>18–24</option><option>25–34</option><option>35–44</option><option>45–54</option><option>55+</option></select>
              <input aria-label="Custom creator locale" className="ugc-wizard-input" onChange={(event) => setCustomCreatorLocale(event.target.value)} placeholder="Locale, e.g. en-GB" value={customCreatorLocale} />
            </div>
            <label className="ugc-wizard-upload mt-3"><Upload className="size-4" />Upload portrait with this profile<input accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void uploadAvatar(event.target.files?.[0])} type="file" /></label>
            <div className="ugc-wizard-or"><span />OR<span /></div>
            <input className="ugc-wizard-input w-full" onChange={(event) => setAvatarName(event.target.value)} placeholder="Creator name" value={avatarName} />
            <textarea className="ugc-wizard-input mt-2 min-h-20 w-full resize-y" onChange={(event) => setAvatarPrompt(event.target.value)} placeholder="Describe appearance, style and believable setting. Do not request a celebrity or real-person resemblance." value={avatarPrompt} />
            <Button className="mt-3" disabled={avatarName.trim().length < 2 || avatarPrompt.trim().length < 8 || customCreatorCategory.trim().length < 2 || customCreatorLocale.trim().length < 2 || generateAvatar.isPending} onClick={() => generateAvatar.mutate()}>{generateAvatar.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}Generate creator · 5 credits</Button>
          </div>}
        </div>
      </section>
    </div>}
  </div>, document.body)
}
