import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ArrowRight, BadgeCheck, Boxes, CalendarRange, Check, CirclePlay, Coins,
  Crown, FileText, Film, Globe2, ImagePlus, Images, LoaderCircle, PackageOpen, Search,
  Sparkles, Upload, UserRound, UsersRound, WandSparkles, X,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchMediaLibrary } from '../../lib/media-library-api'
import {
  analyzeUGCBrand,
  createUGCCampaign,
  estimateUGCCampaign,
  fetchUGCAvatarImage,
  generateUGCAvatar,
  getUGCCampaign,
  getUGCOverview,
  uploadUGCAvatar,
  uploadUGCProductAsset,
} from '../../lib/ugc-studio-api'
import type { MediaAsset } from '../../types/media-library'
import type {
  CreateUGCCampaignInput, UGCAdCount, UGCAvatar, UGCBrandProfile, UGCCampaign,
  UGCCampaignType, UGCDuration, UGCProductAsset, UGCQuality, UGCSourceType,
} from '../../types/ugc-studio'
import { Button } from '../ui/Button'
import './ugc-wizard.css'

type WizardStep = 'source' | 'brand' | 'format' | 'avatar' | 'working' | 'video' | 'finish'

const steps: Array<{ key: WizardStep; group: string; label: string }> = [
  { key: 'source', group: 'YOUR BRAND', label: 'Source' },
  { key: 'brand', group: 'YOUR BRAND', label: 'Brand' },
  { key: 'format', group: 'YOUR CONTENT', label: 'Ad style' },
  { key: 'avatar', group: 'YOUR CONTENT', label: 'Creator' },
  { key: 'working', group: 'YOUR CONTENT', label: "What's working" },
  { key: 'video', group: 'GO LIVE', label: 'Video & credits' },
  { key: 'finish', group: 'GO LIVE', label: 'Finish' },
]

const durations: UGCDuration[] = [15, 20, 30]
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
  onClose,
  onBackToHome,
  onToast,
}: {
  open: boolean
  seedCampaign?: UGCCampaign | null
  onClose: () => void
  onBackToHome: () => void
  onToast: (message: string) => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [furthest, setFurthest] = useState(0)
  const [sourceType, setSourceType] = useState<UGCSourceType>(seedCampaign?.sourceType || 'WEBSITE')
  const [productUrl, setProductUrl] = useState(seedCampaign?.productUrl || '')
  const [description, setDescription] = useState(seedCampaign?.productDescription || '')
  const [brand, setBrand] = useState<UGCBrandProfile | null>(null)
  const [productAssets, setProductAssets] = useState<UGCProductAsset[]>([])
  const [seedProductIds] = useState<string[]>(seedCampaign?.productAssetIds || [])
  const [campaignType, setCampaignType] = useState<UGCCampaignType>(seedCampaign?.campaignType || 'AUTO')
  const [creatorMode, setCreatorMode] = useState<'AUTO' | 'SELECTED'>(seedCampaign?.creatorMode || 'AUTO')
  const [avatarId, setAvatarId] = useState<string | null>(seedCampaign?.selectedAvatarId || null)
  const [showAllCreators, setShowAllCreators] = useState(false)
  const [customCreatorOpen, setCustomCreatorOpen] = useState(false)
  const [avatarName, setAvatarName] = useState('')
  const [avatarPrompt, setAvatarPrompt] = useState('')
  const [workingReady, setWorkingReady] = useState(false)
  const [duration, setDuration] = useState<UGCDuration>((seedCampaign?.duration === 15 || seedCampaign?.duration === 20 || seedCampaign?.duration === 30) ? seedCampaign.duration : 30)
  const [adCount, setAdCount] = useState<UGCAdCount>(([1,5,10,15,20] as number[]).includes(seedCampaign?.adCount || 0) ? seedCampaign!.adCount as UGCAdCount : 5)
  const [quality, setQuality] = useState<UGCQuality>(seedCampaign?.quality || 'STANDARD')
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const overview = useQuery({ queryKey: ['ugc-studio-overview'], queryFn: getUGCOverview, enabled: open, staleTime: 8_000 })
  const selectedBrand = brand || overview.data?.brands.find((item) => item.id === seedCampaign?.brandProfileId) || null
  const productAssetIds = [...seedProductIds, ...productAssets.map((asset) => asset.id)]

  const input = useMemo<CreateUGCCampaignInput>(() => ({
    brandProfileId: selectedBrand?.id || seedCampaign?.brandProfileId || null,
    productUrl: selectedBrand ? '' : productUrl.trim(),
    productDescription: description.trim(),
    productAssetIds,
    sourceType,
    campaignType,
    creatorMode,
    avatarId: creatorMode === 'SELECTED' ? avatarId : null,
    duration,
    adCount,
    quality,
    notes: '',
  }), [selectedBrand, seedCampaign?.brandProfileId, productUrl, description, productAssetIds, sourceType, campaignType, creatorMode, avatarId, duration, adCount, quality])

  const estimate = useQuery({
    queryKey: ['ugc-wizard-estimate', duration, adCount, quality, campaignType],
    queryFn: () => estimateUGCCampaign({ duration, adCount, quality, campaignType }),
    enabled: open && step >= 5,
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
    if (steps[step]?.key !== 'working' || workingReady) return
    const timer = window.setTimeout(() => setWorkingReady(true), 1200)
    return () => window.clearTimeout(timer)
  }, [step, selectedBrand?.id, workingReady])

  useEffect(() => {
    if (!campaign.data || !terminal.has(campaign.data.status)) return
    void queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
    void queryClient.invalidateQueries({ queryKey: ['ai-studio-access'] })
  }, [campaign.data, queryClient])

  const analyze = useMutation({
    mutationFn: () => analyzeUGCBrand(productUrl),
    onSuccess: (value) => { setBrand(value); setError(''); moveTo(1); void queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] }) },
    onError: (value) => setError(value instanceof Error ? value.message : 'We could not analyse that website.'),
  })

  const create = useMutation({
    mutationFn: () => createUGCCampaign(input),
    onSuccess: (value) => {
      setCampaignId(value.id)
      setError('')
      moveTo(6)
      void queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
    },
    onError: (value) => setError(value instanceof Error ? value.message : 'The UGC campaign could not be started.'),
  })

  const generateAvatar = useMutation({
    mutationFn: () => generateUGCAvatar({ name: avatarName, prompt: avatarPrompt }),
    onSuccess: (value) => {
      setCreatorMode('SELECTED'); setAvatarId(value.id); setCustomCreatorOpen(false); setAvatarName(''); setAvatarPrompt('')
      void queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
    },
    onError: (value) => setError(value instanceof Error ? value.message : 'The creator could not be generated.'),
  })

  function moveTo(next: number) {
    const bounded = Math.max(0, Math.min(steps.length - 1, next))
    if (bounded === 4 && step !== 4) setWorkingReady(false)
    setStep(bounded)
    setFurthest((current) => Math.max(current, bounded))
  }

  async function uploadAvatar(file: File | undefined) {
    if (!file) return
    try {
      const value = await uploadUGCAvatar(file)
      setCreatorMode('SELECTED'); setAvatarId(value.id); setCustomCreatorOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
    } catch (value) { setError(value instanceof Error ? value.message : 'Creator upload failed.') }
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
      analyze.mutate()
      return
    }
    if (sourceType === 'PRODUCT' && (productAssets.length || seedProductIds.length || description.trim().length >= 8)) { moveTo(1); return }
    if (sourceType === 'BRIEF' && description.trim().length >= 12) { moveTo(1); return }
    setError(sourceType === 'PRODUCT' ? 'Add a product URL, upload at least one product image, or describe the product.' : 'Add enough information for INXSocial to understand the offer.')
  }

  function scheduleReady() {
    const current = campaign.data
    if (!current) return
    const ready = current.ads
      .filter((ad) => ad.status === 'READY' && ad.mediaAssetId)
      .map((ad) => ({ ad, asset: assetsById.get(ad.mediaAssetId!) }))
      .filter((value): value is { ad: typeof current.ads[number]; asset: MediaAsset } => Boolean(value.asset))
    if (!ready.length) { onToast('Wait for at least one finished UGC ad before scheduling.'); return }
    onClose()
    navigate('/bulk-scheduler', { state: {
      mediaLibraryAssets: ready.map((value) => value.asset),
      aiMixedCampaign: { id: current.id, title: current.title, posts: ready.map(({ ad }) => ({ id: ad.id, contentType: 'IMAGE' as const, caption: ad.caption || ad.script, mediaAssetId: ad.mediaAssetId! })) },
    } })
  }

  if (!open) return null
  const currentKey = steps[step].key
  const avatars = overview.data?.featuredAvatars?.length ? overview.data.featuredAvatars : overview.data?.avatars || []
  const selectedAvatar = avatars.find((avatar) => avatar.id === avatarId) || null
  const directions = selectedBrand?.analysis?.ugcDirections?.length ? selectedBrand.analysis.ugcDirections.slice(0, 4) : [
    campaignType === 'PRODUCT_SHOWCASE' ? 'Open with a creator reaction or clear product problem in the first two seconds.' : 'Open with a natural creator-led hook in the first two seconds.',
    campaignType === 'PRODUCT_SHOWCASE' ? 'Use the real product reference in grounded cutaways and avoid invented packaging.' : 'Keep the creator and real environment visually consistent throughout.',
    'Use specific verified benefits instead of generic marketing language.',
    'Finish with one simple next action and keep the delivery conversational.',
  ]
  const readyAds = campaign.data?.ads.filter((ad) => ad.status === 'READY').length || 0
  const failedAds = campaign.data?.ads.filter((ad) => ad.status === 'FAILED').length || 0
  const progress = campaign.data?.ads.length ? Math.round(((readyAds + failedAds) / campaign.data.ads.length) * 100) : 0
  const remaining = overview.data?.credits.remaining ?? 0
  const insufficient = Boolean(estimate.data && remaining < estimate.data.credits)

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

              {sourceType !== 'BRIEF' && <div className="mt-6"><span className="ugc-wizard-mini-label">{sourceType === 'PRODUCT' ? 'PRODUCT PAGE — OPTIONAL IF YOU UPLOAD PHOTOS' : 'WEBSITE'}</span><div className="ugc-wizard-url-field mt-2"><Globe2 className="size-4" /><input autoFocus onChange={(event) => { setProductUrl(event.target.value); setBrand(null); setError('') }} placeholder={sourceType === 'PRODUCT' ? 'https://shop.com/product' : 'https://yourbrand.com'} value={productUrl} /></div></div>}

              {sourceType === 'PRODUCT' && <div className="mt-5"><span className="ugc-wizard-mini-label">REAL PRODUCT IMAGES</span><label className="ugc-product-upload mt-2"><Images className="size-5" /><div><strong>Upload product photos</strong><span>PNG, JPEG or WebP · up to 8 references</span></div><input accept="image/png,image/jpeg,image/webp" className="hidden" multiple onChange={(event) => void uploadProducts(event.target.files)} type="file" /></label>{(productAssets.length || seedProductIds.length) > 0 && <div className="mt-2 flex flex-wrap gap-2">{productAssets.map((asset) => <span className="ugc-product-chip" key={asset.id}><Check className="size-3" />{asset.originalName}</span>)}{seedProductIds.map((id, index) => <span className="ugc-product-chip" key={id}><Check className="size-3" />Saved product image {index + 1}</span>)}</div>}</div>}

              {(sourceType === 'BRIEF' || sourceType === 'PRODUCT') && <div className="mt-5"><span className="ugc-wizard-mini-label">{sourceType === 'BRIEF' ? 'TELL US ABOUT THE OFFER' : 'OPTIONAL PRODUCT NOTES'}</span><textarea className="ugc-wizard-input mt-2 min-h-28 w-full resize-y" onChange={(event) => setDescription(event.target.value)} placeholder="What is it, who is it for, and what does it help with?" value={description} /></div>}

              {analyze.isPending && <div className="ugc-wizard-analyzing mt-6"><div className="ugc-wizard-scan"><span /><Search className="size-7" /></div><div><strong>Understanding your offer…</strong><p className="mt-1 text-[9px] text-text-muted">Reading the site, finding verified benefits and preparing creator directions.</p></div></div>}
              <div className="ugc-wizard-footer"><Button onClick={onBackToHome}><ArrowLeft className="size-4" />Studio</Button><Button disabled={analyze.isPending} onClick={() => void continueSource()} variant="primary">{analyze.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{sourceType === 'WEBSITE' || productUrl.trim() ? 'Analyze & continue' : 'Continue'} <ArrowRight className="size-4" /></Button></div>
            </>}

            {currentKey === 'brand' && <>
              <div className="ugc-wizard-title-row"><span className="ugc-wizard-icon"><BadgeCheck className="size-5" /></span><div><h2>Here's what INXSocial understands.</h2><p>Check the essentials. The generator uses this as the factual boundary for scripts and scenes.</p></div></div>
              {selectedBrand ? <div className="ugc-wizard-brand-card mt-7"><div className="flex items-start justify-between gap-4"><div><span className="ugc-wizard-mini-label">BRAND / OFFER</span><h3>{selectedBrand.productName || selectedBrand.name}</h3></div><BadgeCheck className="size-5 text-brand-cyan" /></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><div><span className="ugc-wizard-mini-label">COMPANY</span><strong>{selectedBrand.name}</strong></div><div><span className="ugc-wizard-mini-label">TYPE</span><strong>{selectedBrand.analysis?.offerType || 'Brand'}</strong></div></div><div className="mt-5"><span className="ugc-wizard-mini-label">WHAT IT DOES</span><p>{selectedBrand.summary}</p></div>{!!selectedBrand.audience.length && <div className="mt-5"><span className="ugc-wizard-mini-label">AUDIENCE</span><div className="mt-2 flex flex-wrap gap-2">{selectedBrand.audience.slice(0,6).map((item) => <span className="ugc-wizard-pill" key={item}>{item}</span>)}</div></div>}</div> :
                <div className="ugc-wizard-brand-card mt-7"><span className="ugc-wizard-mini-label">YOUR BRIEF</span><textarea className="ugc-wizard-input mt-3 min-h-36 w-full resize-y" onChange={(event) => setDescription(event.target.value)} value={description} /></div>}
              <div className="ugc-wizard-footer"><Button onClick={() => moveTo(0)}><ArrowLeft className="size-4" />Back</Button><Button disabled={!selectedBrand && description.trim().length < 12 && !productAssetIds.length} onClick={() => moveTo(2)} variant="primary">Looks right <ArrowRight className="size-4" /></Button></div>
            </>}

            {currentKey === 'format' && <>
              <div className="ugc-wizard-title-row"><span className="ugc-wizard-icon"><Boxes className="size-5" /></span><div><h2>How should the UGC feel?</h2><p>Choose the content style, or leave it on Auto and let the offer decide. This changes the scene plan — not the quality tier.</p></div></div>
              <div className="ugc-format-grid mt-7">
                <button className={`ugc-format-card ${campaignType === 'AUTO' ? 'active' : ''}`} onClick={() => setCampaignType('AUTO')} type="button"><span className="ugc-format-icon"><Sparkles className="size-5" /></span><strong>Choose for me</strong><p>Website/SaaS usually becomes a creator explainer. Physical products usually become a product showcase.</p><span>Recommended</span></button>
                <button className={`ugc-format-card ${campaignType === 'AVATAR_EXPLAINER' ? 'active' : ''}`} onClick={() => setCampaignType('AVATAR_EXPLAINER')} type="button"><span className="ugc-format-icon"><UserRound className="size-5" /></span><strong>Avatar Explainer</strong><p>A realistic creator talks directly to camera and explains the offer. Ideal for SaaS, services and websites.</p><span>Creator-led</span></button>
                <button className={`ugc-format-card ${campaignType === 'PRODUCT_SHOWCASE' ? 'active' : ''}`} onClick={() => setCampaignType('PRODUCT_SHOWCASE')} type="button"><span className="ugc-format-icon"><PackageOpen className="size-5" /></span><strong>Product Showcase</strong><p>Creator-led opening plus real product cutaways, benefits and believable use-case shots.</p><span>Product-led</span></button>
              </div>
              {campaignType === 'PRODUCT_SHOWCASE' && !productAssetIds.length && !(selectedBrand?.brandReferences?.length) && <div className="mt-4 rounded-xl border border-brand-amber/25 bg-brand-amber/[.05] p-3 text-[10px] leading-4 text-brand-amber">Product Showcase needs a real product reference. Go back to Source and upload a product photo, or choose Avatar Explainer.</div>}
              <div className="ugc-wizard-footer"><Button onClick={() => moveTo(1)}><ArrowLeft className="size-4" />Back</Button><Button disabled={campaignType === 'PRODUCT_SHOWCASE' && !productAssetIds.length && !selectedBrand?.brandReferences?.length} onClick={() => moveTo(3)} variant="primary">Continue <ArrowRight className="size-4" /></Button></div>
            </>}

            {currentKey === 'avatar' && <>
              <div className="ugc-wizard-title-row"><span className="ugc-wizard-icon"><UsersRound className="size-5" /></span><div><h2>Pick a creator.</h2><p>Use Auto for the best audience match, select one of the realistic featured creators, or add your own.</p></div></div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <button className={`ugc-wizard-avatar-card auto ${creatorMode === 'AUTO' ? 'selected' : ''}`} onClick={() => { setCreatorMode('AUTO'); setAvatarId(null) }} type="button"><span className="ugc-wizard-auto-avatar"><Sparkles className="size-6" /></span><strong>Choose for me</strong><small>AI matches niche, audience and ad angle.</small>{creatorMode === 'AUTO' && <span className="ugc-wizard-selected-check"><Check className="size-3" /></span>}</button>
                {(showAllCreators ? avatars : avatars.slice(0,7)).map((avatar) => <button className={`ugc-wizard-avatar-card ${creatorMode === 'SELECTED' && avatar.id === avatarId ? 'selected' : ''}`} key={avatar.id} onClick={() => { setCreatorMode('SELECTED'); setAvatarId(avatar.id) }} type="button"><div className="ugc-wizard-avatar-image"><AvatarPortrait avatar={avatar} /></div><strong>{avatar.name}</strong><small>{avatar.category} · {avatar.ageBand}</small>{creatorMode === 'SELECTED' && avatar.id === avatarId && <span className="ugc-wizard-selected-check"><Check className="size-3" /></span>}</button>)}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3"><button className="ugc-wizard-text-button" onClick={() => setShowAllCreators((value) => !value)} type="button">{showAllCreators ? 'Show fewer creators' : `View all ${avatars.length} available creators`}</button><span className="text-[10px] text-text-soft">or</span><button className="ugc-wizard-text-button" onClick={() => setCustomCreatorOpen((value) => !value)} type="button"><ImagePlus className="size-3.5" />Create my own</button></div>
              {customCreatorOpen && <div className="ugc-wizard-custom-creator mt-5"><div><strong>Custom creator</strong><p>Upload your own portrait for free, or generate one for 5 credits. It stays in your creator library.</p></div><label className="ugc-wizard-upload"><Upload className="size-4" />Upload portrait<input accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void uploadAvatar(event.target.files?.[0])} type="file" /></label><div className="ugc-wizard-or"><span />OR<span /></div><input className="ugc-wizard-input w-full" onChange={(event) => setAvatarName(event.target.value)} placeholder="Creator name" value={avatarName} /><textarea className="ugc-wizard-input mt-2 min-h-20 w-full resize-y" onChange={(event) => setAvatarPrompt(event.target.value)} placeholder="Describe the creator: age range, style, appearance and niche." value={avatarPrompt} /><Button className="mt-3" disabled={avatarName.trim().length < 2 || avatarPrompt.trim().length < 8 || generateAvatar.isPending} onClick={() => generateAvatar.mutate()}>{generateAvatar.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}Generate creator · 5 credits</Button></div>}
              <div className="ugc-wizard-footer"><Button onClick={() => moveTo(2)}><ArrowLeft className="size-4" />Back</Button><Button disabled={creatorMode === 'SELECTED' && !avatarId} onClick={() => moveTo(4)} variant="primary">Continue <ArrowRight className="size-4" /></Button></div>
            </>}

            {currentKey === 'working' && <>
              <div className="ugc-wizard-title-row"><span className="ugc-wizard-icon"><Search className="size-5" /></span><div><h2>Here's the creative direction.</h2><p>INXSocial turns the offer into creator-native hooks and scene logic automatically. You still don't need to write the script.</p></div></div>
              {!workingReady ? <div className="ugc-wizard-research mt-8"><div className="ugc-wizard-radar"><span /><Search className="size-6" /></div><strong>Building your UGC direction…</strong><p>Matching the offer, format, creator and audience.</p></div> : <div className="mt-7 grid gap-3 sm:grid-cols-2">{directions.map((direction,index) => <article className="ugc-wizard-direction" key={direction}><span>{String(index+1).padStart(2,'0')}</span><p>{direction}</p></article>)}</div>}
              <div className="ugc-wizard-footer"><Button onClick={() => moveTo(3)}><ArrowLeft className="size-4" />Back</Button><Button disabled={!workingReady} onClick={() => moveTo(5)} variant="primary">Use this direction <ArrowRight className="size-4" /></Button></div>
            </>}

            {currentKey === 'video' && <>
              <div className="ugc-wizard-title-row"><span className="ugc-wizard-icon"><CirclePlay className="size-5" /></span><div><h2>Set the campaign size.</h2><p>Choose duration, variations and quality. Models stay hidden — you only choose the experience you want.</p></div></div>
              <div className="mt-7 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div className="ugc-wizard-phone-preview"><div className="ugc-wizard-phone-screen"><span className="ugc-wizard-preview-avatar">{selectedAvatar ? <AvatarPortrait avatar={selectedAvatar} /> : <UserRound className="size-8" />}</span><CirclePlay className="size-8 text-brand-cyan" /><strong>{duration}s UGC</strong><small>{campaignType === 'PRODUCT_SHOWCASE' ? 'Product showcase' : campaignType === 'AVATAR_EXPLAINER' ? 'Avatar explainer' : 'Auto-selected style'}</small></div></div>
                <div className="space-y-5">
                  <div><span className="ugc-wizard-mini-label">VIDEO LENGTH</span><div className="mt-2 grid grid-cols-3 gap-2">{durations.map((value) => <StepChoice current={duration} key={value} onClick={setDuration} value={value}><strong>{value}s</strong><small>{value === 15 ? 'Quick' : value === 20 ? 'Balanced' : 'Full ad'}</small></StepChoice>)}</div></div>
                  <div><span className="ugc-wizard-mini-label">VARIATIONS</span><div className="mt-2 grid grid-cols-5 gap-2">{adCounts.map((value) => <StepChoice current={adCount} key={value} onClick={setAdCount} value={value}><strong>{value}</strong></StepChoice>)}</div></div>
                  <div><span className="ugc-wizard-mini-label">QUALITY</span><div className="mt-2 grid grid-cols-2 gap-2"><StepChoice current={quality} onClick={setQuality} value="STANDARD"><Film className="mx-auto mb-1 size-4 text-brand-cyan" /><strong>Standard</strong><small>Natural social UGC</small></StepChoice><StepChoice current={quality} onClick={setQuality} value="PREMIUM"><Crown className="mx-auto mb-1 size-4 text-[#c4b5fd]" /><strong>Premium</strong><small>Complex motion & scenes</small></StepChoice></div></div>
                  <div className={`ugc-credit-summary ${insufficient ? 'insufficient' : ''}`}><div><span>Campaign total</span><strong>{estimate.isFetching ? '…' : estimate.data?.credits.toLocaleString() || '—'} credits</strong></div><div><span>{estimate.data?.perAd?.toLocaleString() || '—'} per ad · {remaining.toLocaleString()} available</span>{insufficient && <em>Reduce duration, variations or quality.</em>}</div></div>
                </div>
              </div>
              <div className="ugc-wizard-footer"><Button onClick={() => moveTo(4)}><ArrowLeft className="size-4" />Back</Button><Button disabled={create.isPending || insufficient || !estimate.data} onClick={() => create.mutate()} variant="primary">{create.isPending ? <><LoaderCircle className="size-4 animate-spin" />Starting campaign…</> : <><WandSparkles className="size-4" />Generate {adCount} ad{adCount === 1 ? '' : 's'}</>}</Button></div>
            </>}

            {currentKey === 'finish' && <>
              <div className="ugc-wizard-title-row"><span className="ugc-wizard-icon"><Sparkles className="size-5" /></span><div><h2>{terminal.has(campaign.data?.status || '') ? 'Your UGC campaign is ready.' : 'Your UGC campaign is rendering.'}</h2><p>{terminal.has(campaign.data?.status || '') ? 'Edit a finished ad or send the ready videos straight to the scheduler.' : 'Go back to UGC Studio whenever you want. The campaign keeps rendering in the background and will appear there automatically.'}</p></div></div>
              <div className="ugc-wizard-generation mt-7"><div className="flex items-center justify-between gap-3"><div><strong>{campaign.data?.title || 'UGC campaign'}</strong><span>{readyAds} of {campaign.data?.ads.length || adCount} ready{failedAds ? ` · ${failedAds} failed` : ''}</span></div><span className="ugc-wizard-status">{campaign.data?.status?.replaceAll('_',' ') || 'STARTING'}</span></div><div className="ugc-wizard-generation-bar"><span style={{ width: `${Math.max(4,progress)}%` }} /></div></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">{(campaign.data?.ads || []).map((ad) => <article className="ugc-wizard-output-card" key={ad.id}><div><span className="ugc-wizard-mini-label">VARIATION {ad.sequence}</span><strong>{ad.title}</strong><p>{ad.hook || ad.angle}</p></div><div className="flex items-center justify-between gap-2"><span className={`ugc-wizard-output-status ${ad.status.toLowerCase()}`}>{ad.status}</span><Button disabled={busyStatuses.has(ad.status)} onClick={() => { onClose(); navigate(`/ai-content-studio/ugc/${ad.id}/edit`) }} size="sm">Edit</Button></div></article>)}</div>
              <div className="ugc-wizard-footer"><Button onClick={onBackToHome}><ArrowLeft className="size-4" />Back to UGC Studio</Button><Button disabled={!campaign.data?.ads.some((ad) => ad.status === 'READY' && ad.mediaAssetId && assetsById.has(ad.mediaAssetId))} onClick={scheduleReady} variant="primary"><CalendarRange className="size-4" />Schedule ready ads</Button></div>
            </>}
          </div>
          {error && <div className="ugc-wizard-error"><X className="size-4 shrink-0" />{error}</div>}
        </main>
      </div>
    </section>
  </div>, document.body)
}
