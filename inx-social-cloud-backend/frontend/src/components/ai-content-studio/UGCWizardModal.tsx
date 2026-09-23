import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import {
  ArrowLeft, ArrowRight, BadgeCheck, CalendarRange, Check, CirclePlay, Coins, Crown,
  Film, Globe2, ImagePlus, LoaderCircle, Search, Sparkles, Upload, UserRound,
  UsersRound, WandSparkles, X,
} from 'lucide-react'
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
} from '../../lib/ugc-studio-api'
import type { MediaAsset } from '../../types/media-library'
import type {
  CreateUGCCampaignInput,
  UGCAdCount,
  UGCAvatar,
  UGCBrandProfile,
  UGCDuration,
  UGCQuality,
} from '../../types/ugc-studio'
import { Button } from '../ui/Button'
import './ugc-wizard.css'

type WizardStep = 'website' | 'brand' | 'avatar' | 'working' | 'first-video' | 'credits' | 'finish'

const steps: Array<{ key: WizardStep; group: string; label: string }> = [
  { key: 'website', group: 'YOUR BRAND', label: 'Website' },
  { key: 'brand', group: 'YOUR BRAND', label: 'Brand' },
  { key: 'avatar', group: 'YOUR CONTENT', label: 'Avatar' },
  { key: 'working', group: 'YOUR CONTENT', label: "What's working" },
  { key: 'first-video', group: 'YOUR CONTENT', label: 'First video' },
  { key: 'credits', group: 'GO LIVE', label: 'Credits' },
  { key: 'finish', group: 'GO LIVE', label: 'Finish' },
]

const durations: UGCDuration[] = [15, 30, 60]
const adCounts: UGCAdCount[] = [1, 5, 10, 15, 20]
const terminal = new Set(['READY', 'PARTIAL', 'FAILED'])

function StepChoice<T extends string | number>({
  value, current, onClick, children,
}: { value: T; current: T; onClick: (value: T) => void; children: ReactNode }) {
  return <button className={`ugc-wizard-choice ${value === current ? 'ugc-wizard-choice-active' : ''}`} onClick={() => onClick(value)} type="button">{children}</button>
}

function AvatarPortrait({ avatar }: { avatar: UGCAvatar }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    let created: string | null = null
    if (!avatar.imageUrl) return undefined
    void fetchUGCAvatarImage(avatar).then((value) => {
      if (!value) return
      if (!alive) { URL.revokeObjectURL(value); return }
      created = value
      setUrl(value)
    })
    return () => {
      alive = false
      if (created) URL.revokeObjectURL(created)
    }
  }, [avatar])
  if (url) return <img alt="" className="size-full object-cover" src={url} />
  return <div className="ugc-wizard-avatar-placeholder grid size-full place-items-center text-sm font-bold">{avatar.name.slice(0, 1)}</div>
}

function Rail({
  current,
  furthest,
  onStep,
}: {
  current: number
  furthest: number
  onStep: (step: number) => void
}) {
  return <aside className="ugc-wizard-rail">
    {steps.map((step, index) => {
      const groupChanged = index === 0 || steps[index - 1].group !== step.group
      const done = index < current
      const active = index === current
      const reachable = index <= furthest
      return <div key={step.key}>
        {groupChanged && <div className="ugc-wizard-group">{step.group}</div>}
        <button
          className={`ugc-wizard-rail-item ${active ? 'active' : ''} ${done ? 'done' : ''}`}
          disabled={!reachable}
          onClick={() => reachable && onStep(index)}
          type="button"
        >
          <span className="ugc-wizard-dot">{done ? <Check className="size-3" /> : index + 1}</span>
          <span>{step.label}</span>
        </button>
      </div>
    })}
  </aside>
}

export function UGCWizardModal({
  open,
  onClose,
  onToast,
}: {
  open: boolean
  onClose: () => void
  onToast: (message: string) => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [furthest, setFurthest] = useState(0)
  const [productUrl, setProductUrl] = useState('')
  const [manualMode, setManualMode] = useState(false)
  const [description, setDescription] = useState('')
  const [brand, setBrand] = useState<UGCBrandProfile | null>(null)
  const [creatorMode, setCreatorMode] = useState<'AUTO' | 'SELECTED'>('AUTO')
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [showAllCreators, setShowAllCreators] = useState(false)
  const [customCreatorOpen, setCustomCreatorOpen] = useState(false)
  const [avatarName, setAvatarName] = useState('')
  const [avatarPrompt, setAvatarPrompt] = useState('')
  const [workingReady, setWorkingReady] = useState(false)
  const [duration, setDuration] = useState<UGCDuration>(30)
  const [adCount, setAdCount] = useState<UGCAdCount>(5)
  const [quality, setQuality] = useState<UGCQuality>('STANDARD')
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const overview = useQuery({
    queryKey: ['ugc-studio-overview'],
    queryFn: getUGCOverview,
    enabled: open,
    staleTime: 15_000,
  })

  const input = useMemo<CreateUGCCampaignInput>(() => ({
    brandProfileId: brand?.id || null,
    productUrl: brand ? '' : productUrl.trim(),
    productDescription: description.trim(),
    creatorMode,
    avatarId: creatorMode === 'SELECTED' ? avatarId : null,
    duration,
    adCount,
    quality,
    notes: '',
  }), [brand, productUrl, description, creatorMode, avatarId, duration, adCount, quality])

  const estimate = useQuery({
    queryKey: ['ugc-wizard-estimate', duration, adCount, quality],
    queryFn: () => estimateUGCCampaign(input),
    enabled: open && step >= 4,
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
  const avatars = overview.data?.avatars || []
  const systemAvatars = avatars.filter((avatar) => avatar.scope === 'SYSTEM')
  const selectedAvatar = avatars.find((avatar) => avatar.id === avatarId) || null
  const remaining = overview.data?.credits.remaining ?? 0
  const directions = brand?.analysis?.ugcDirections?.length
    ? brand.analysis.ugcDirections.slice(0, 4)
    : [
        'Open with a creator-native problem or discovery hook in the first two seconds.',
        'Show the product or service benefit visually instead of explaining everything.',
        'Keep the language conversational, specific and believable rather than ad-like.',
        'Finish with one clear next action instead of multiple competing CTAs.',
      ]

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
    const timer = window.setTimeout(() => setWorkingReady(true), 1400)
    return () => window.clearTimeout(timer)
  }, [step, brand?.id, workingReady])

  useEffect(() => {
    if (!campaign.data || !terminal.has(campaign.data.status)) return
    void queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
    void queryClient.invalidateQueries({ queryKey: ['ai-studio-access'] })
  }, [campaign.data, queryClient])

  const analyze = useMutation({
    mutationFn: () => analyzeUGCBrand(productUrl),
    onSuccess: (value) => {
      setBrand(value)
      setDescription('')
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
      moveTo(6)
      void queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
    },
    onError: (value) => setError(value instanceof Error ? value.message : 'The UGC campaign could not be started.'),
  })

  const generateAvatar = useMutation({
    mutationFn: () => generateUGCAvatar({ name: avatarName, prompt: avatarPrompt }),
    onSuccess: (value) => {
      setCreatorMode('SELECTED')
      setAvatarId(value.id)
      setCustomCreatorOpen(false)
      setAvatarName('')
      setAvatarPrompt('')
      void queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
    },
    onError: (value) => setError(value instanceof Error ? value.message : 'The creator could not be generated.'),
  })

  function moveTo(next: number) {
    const bounded = Math.max(0, Math.min(steps.length - 1, next))
    if (bounded === 3 && step !== 3) setWorkingReady(false)
    setStep(bounded)
    setFurthest((current) => Math.max(current, bounded))
  }

  function closeWizard() {
    setStep(0)
    setFurthest(0)
    setProductUrl('')
    setManualMode(false)
    setDescription('')
    setBrand(null)
    setCreatorMode('AUTO')
    setAvatarId(null)
    setShowAllCreators(false)
    setCustomCreatorOpen(false)
    setAvatarName('')
    setAvatarPrompt('')
    setWorkingReady(false)
    setDuration(30)
    setAdCount(5)
    setQuality('STANDARD')
    setCampaignId(null)
    setError('')
    onClose()
  }

  async function uploadAvatar(file: File | undefined) {
    if (!file) return
    try {
      const value = await uploadUGCAvatar(file)
      setCreatorMode('SELECTED')
      setAvatarId(value.id)
      setCustomCreatorOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Avatar upload failed.')
    }
  }

  function schedulerState(ads = campaign.data?.ads || []) {
    const ready = ads
      .filter((ad) => ad.status === 'READY' && ad.mediaAssetId)
      .map((ad) => ({ ad, asset: assetsById.get(ad.mediaAssetId!) }))
      .filter((value): value is { ad: typeof ads[number]; asset: MediaAsset } => Boolean(value.asset))
    if (!ready.length) return null
    return {
      mediaLibraryAssets: ready.map((value) => value.asset),
      aiMixedCampaign: {
        id: campaign.data?.id || campaignId || 'ugc',
        title: campaign.data?.title || 'UGC Campaign',
        posts: ready.map(({ ad }) => ({
          id: ad.id,
          contentType: 'IMAGE' as const,
          caption: ad.caption || ad.script,
          mediaAssetId: ad.mediaAssetId!,
        })),
      },
    }
  }

  function scheduleReady() {
    const state = schedulerState()
    if (!state) {
      onToast('Wait for at least one finished UGC ad before scheduling.')
      return
    }
    closeWizard()
    navigate('/bulk-scheduler', { state })
  }

  if (!open) return null

  const currentKey = steps[step].key
  const analyzeMessages = ['Reading your site', 'Understanding the offer', 'Finding your audience', 'Building UGC angles']
  const readyAds = campaign.data?.ads.filter((ad) => ad.status === 'READY').length || 0
  const failedAds = campaign.data?.ads.filter((ad) => ad.status === 'FAILED').length || 0
  const progress = campaign.data?.ads.length ? Math.round(((readyAds + failedAds) / campaign.data.ads.length) * 100) : 0
  const insufficient = Boolean(estimate.data && remaining < estimate.data.credits)

  return createPortal(<div className="ugc-wizard-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && currentKey !== 'finish') closeWizard() }}>
    <section aria-label="UGC Ad Studio" aria-modal="true" className="ugc-wizard-panel" role="dialog">
      <header className="ugc-wizard-header">
        <div>
          <span className="ugc-wizard-eyebrow">UGC AD STUDIO</span>
          <span className="ugc-wizard-step-count">Step {step + 1} of {steps.length}</span>
        </div>
        <button aria-label="Close UGC Studio" className="ugc-wizard-close" onClick={closeWizard} type="button"><X className="size-4" /></button>
        <div className="ugc-wizard-progress"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
      </header>

      <div className="ugc-wizard-layout">
        <Rail current={step} furthest={furthest} onStep={moveTo} />

        <main className="ugc-wizard-content">
          <div className="ugc-wizard-step" key={currentKey}>
            {currentKey === 'website' && <>
              <div className="ugc-wizard-title-row">
                <span className="ugc-wizard-icon"><Globe2 className="size-5" /></span>
                <div><h2>What's your website?</h2><p>We'll read it and set up the UGC campaign automatically — your company, offer, audience and content direction.</p></div>
              </div>

              {!manualMode ? <>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <div className="ugc-wizard-url-field"><Globe2 className="size-4" /><input autoFocus onChange={(event) => { setProductUrl(event.target.value); setBrand(null); setError('') }} placeholder="https://yourbrand.com" value={productUrl} /></div>
                  <Button className="min-h-12 sm:min-w-[170px]" disabled={!productUrl.trim() || analyze.isPending} onClick={() => analyze.mutate()} variant="primary">{analyze.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}Analyze my site</Button>
                </div>
                <button className="ugc-wizard-text-button mt-4" onClick={() => { setManualMode(true); setProductUrl(''); setError('') }} type="button">I don't have a website</button>
              </> : <>
                <textarea autoFocus className="ugc-wizard-input mt-7 min-h-36 w-full resize-y" onChange={(event) => setDescription(event.target.value)} placeholder="Tell us what you sell, who it is for, and the main benefit. Keep it simple." value={description} />
                <div className="mt-4 flex items-center justify-between gap-3"><button className="ugc-wizard-text-button" onClick={() => setManualMode(false)} type="button"><ArrowLeft className="size-3.5" />Use a website instead</button><Button disabled={description.trim().length < 12} onClick={() => moveTo(1)} variant="primary">Continue <ArrowRight className="size-4" /></Button></div>
              </>}

              {analyze.isPending && <div className="ugc-wizard-analyzing mt-7">
                <div className="ugc-wizard-scan"><span /><Globe2 className="size-7" /></div>
                <div><strong>Building your brand profile…</strong><div className="mt-2 flex flex-wrap gap-2">{analyzeMessages.map((message, index) => <span className="ugc-wizard-analysis-chip" key={message} style={{ animationDelay: `${index * 180}ms` }}><Check className="size-3" />{message}</span>)}</div></div>
              </div>}
            </>}

            {currentKey === 'brand' && <>
              <div className="ugc-wizard-title-row"><span className="ugc-wizard-icon"><BadgeCheck className="size-5" /></span><div><h2>Here's what we learned.</h2><p>You shouldn't have to build the brief yourself. Check the essentials and continue.</p></div></div>
              {brand ? <div className="ugc-wizard-brand-card mt-7">
                <div className="flex items-start justify-between gap-4"><div><span className="ugc-wizard-mini-label">COMPANY</span><h3>{brand.name}</h3></div><BadgeCheck className="size-5 text-brand-cyan" /></div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2"><div><span className="ugc-wizard-mini-label">OFFER</span><strong>{brand.productName || brand.name}</strong></div><div><span className="ugc-wizard-mini-label">TYPE</span><strong>{brand.analysis?.offerType || 'Brand'}</strong></div></div>
                <div className="mt-5"><span className="ugc-wizard-mini-label">WHAT YOU DO</span><p>{brand.summary}</p></div>
                {!!brand.audience.length && <div className="mt-5"><span className="ugc-wizard-mini-label">AUDIENCE</span><div className="mt-2 flex flex-wrap gap-2">{brand.audience.slice(0, 6).map((item) => <span className="ugc-wizard-pill" key={item}>{item}</span>)}</div></div>}
              </div> : <div className="ugc-wizard-brand-card mt-7"><span className="ugc-wizard-mini-label">YOUR BRIEF</span><textarea className="ugc-wizard-input mt-3 min-h-36 w-full resize-y" onChange={(event) => setDescription(event.target.value)} value={description} /></div>}
              <div className="ugc-wizard-footer"><Button onClick={() => moveTo(0)}><ArrowLeft className="size-4" />Back</Button><Button disabled={!brand && description.trim().length < 12} onClick={() => moveTo(2)} variant="primary">Looks right <ArrowRight className="size-4" /></Button></div>
            </>}

            {currentKey === 'avatar' && <>
              <div className="ugc-wizard-title-row"><span className="ugc-wizard-icon"><UsersRound className="size-5" /></span><div><h2>Pick a creator.</h2><p>Choose one, or let INXSocial match the creator automatically. Built-in creators are reusable and cost nothing extra.</p></div></div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <button className={`ugc-wizard-avatar-card auto ${creatorMode === 'AUTO' ? 'selected' : ''}`} onClick={() => { setCreatorMode('AUTO'); setAvatarId(null) }} type="button">
                  <span className="ugc-wizard-auto-avatar"><Sparkles className="size-6" /></span><strong>Choose for me</strong><small>AI matches the offer and audience.</small>{creatorMode === 'AUTO' && <span className="ugc-wizard-selected-check"><Check className="size-3" /></span>}
                </button>
                {(showAllCreators ? systemAvatars : systemAvatars.slice(0, 7)).map((avatar) => <button className={`ugc-wizard-avatar-card ${creatorMode === 'SELECTED' && avatar.id === avatarId ? 'selected' : ''}`} key={avatar.id} onClick={() => { setCreatorMode('SELECTED'); setAvatarId(avatar.id) }} type="button"><div className="ugc-wizard-avatar-image"><AvatarPortrait avatar={avatar} /></div><strong>{avatar.name}</strong><small>{avatar.category} · {avatar.ageBand}</small>{creatorMode === 'SELECTED' && avatar.id === avatarId && <span className="ugc-wizard-selected-check"><Check className="size-3" /></span>}</button>)}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3"><button className="ugc-wizard-text-button" onClick={() => setShowAllCreators((value) => !value)} type="button">{showAllCreators ? 'Show fewer creators' : `View all ${systemAvatars.length || 52} creators`}</button><span className="text-[10px] text-text-soft">or</span><button className="ugc-wizard-text-button" onClick={() => setCustomCreatorOpen((value) => !value)} type="button"><ImagePlus className="size-3.5" />Create my own</button></div>

              {customCreatorOpen && <div className="ugc-wizard-custom-creator mt-5">
                <div><strong>Custom creator</strong><p>Upload your own portrait for free, or generate an original reusable creator for 5 credits.</p></div>
                <label className="ugc-wizard-upload"><Upload className="size-4" />Upload portrait<input accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void uploadAvatar(event.target.files?.[0])} type="file" /></label>
                <div className="ugc-wizard-or"><span />OR<span /></div>
                <input className="ugc-wizard-input w-full" onChange={(event) => setAvatarName(event.target.value)} placeholder="Creator name" value={avatarName} />
                <textarea className="ugc-wizard-input mt-2 min-h-20 w-full resize-y" onChange={(event) => setAvatarPrompt(event.target.value)} placeholder="Describe the creator you want." value={avatarPrompt} />
                <Button className="mt-3" disabled={avatarName.trim().length < 2 || avatarPrompt.trim().length < 8 || generateAvatar.isPending} onClick={() => generateAvatar.mutate()}>{generateAvatar.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}Generate creator · 5 credits</Button>
              </div>}

              <div className="ugc-wizard-footer"><Button onClick={() => moveTo(1)}><ArrowLeft className="size-4" />Back</Button><Button disabled={creatorMode === 'SELECTED' && !avatarId} onClick={() => moveTo(3)} variant="primary">Continue <ArrowRight className="size-4" /></Button></div>
            </>}

            {currentKey === 'working' && <>
              <div className="ugc-wizard-title-row"><span className="ugc-wizard-icon"><Search className="size-5" /></span><div><h2>Here's what should work for your offer.</h2><p>INXSocial turns the brand analysis into creator-native angles automatically. You don't need to write the scripts.</p></div></div>
              {!workingReady ? <div className="ugc-wizard-research mt-8"><div className="ugc-wizard-radar"><span /><Search className="size-6" /></div><strong>Building your UGC direction…</strong><p>Matching your offer, audience and content format.</p></div> : <div className="mt-7 grid gap-3 sm:grid-cols-2">{directions.map((direction, index) => <article className="ugc-wizard-direction" key={direction}><span>{String(index + 1).padStart(2, '0')}</span><p>{direction}</p></article>)}</div>}
              <div className="ugc-wizard-footer"><Button onClick={() => moveTo(2)}><ArrowLeft className="size-4" />Back</Button><Button disabled={!workingReady} onClick={() => moveTo(4)} variant="primary">Use these directions <ArrowRight className="size-4" /></Button></div>
            </>}

            {currentKey === 'first-video' && <>
              <div className="ugc-wizard-title-row"><span className="ugc-wizard-icon"><CirclePlay className="size-5" /></span><div><h2>Set your first UGC campaign.</h2><p>Only the essentials. INXSocial handles scripts, scenes, voice and product/creator routing automatically.</p></div></div>
              <div className="mt-7 grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
                <div className="ugc-wizard-phone-preview">
                  <div className="ugc-wizard-phone-screen"><span className="ugc-wizard-preview-avatar">{selectedAvatar ? <AvatarPortrait avatar={selectedAvatar} /> : <UserRound className="size-8" />}</span><CirclePlay className="size-8 text-brand-cyan" /><strong>{duration}s UGC</strong><small>{creatorMode === 'AUTO' ? 'Creator matched automatically' : selectedAvatar?.name || 'Selected creator'}</small></div>
                </div>
                <div className="space-y-5">
                  <div><span className="ugc-wizard-mini-label">VIDEO LENGTH</span><div className="mt-2 grid grid-cols-3 gap-2">{durations.map((value) => <StepChoice current={duration} key={value} onClick={setDuration} value={value}><strong>{value}s</strong><small>{value === 15 ? 'Quick' : value === 30 ? 'Recommended' : 'Story'}</small></StepChoice>)}</div></div>
                  <div><span className="ugc-wizard-mini-label">VARIATIONS</span><div className="mt-2 grid grid-cols-5 gap-2">{adCounts.map((value) => <StepChoice current={adCount} key={value} onClick={setAdCount} value={value}><strong>{value}</strong></StepChoice>)}</div></div>
                  <div><span className="ugc-wizard-mini-label">QUALITY</span><div className="mt-2 grid grid-cols-2 gap-2"><StepChoice current={quality} onClick={setQuality} value="STANDARD"><Film className="mx-auto mb-1 size-4 text-brand-cyan" /><strong>Standard</strong><small>Best everyday UGC</small></StepChoice><StepChoice current={quality} onClick={setQuality} value="PREMIUM"><Crown className="mx-auto mb-1 size-4 text-[#c4b5fd]" /><strong>Premium</strong><small>Complex scenes</small></StepChoice></div></div>
                </div>
              </div>
              <div className="ugc-wizard-footer"><Button onClick={() => moveTo(3)}><ArrowLeft className="size-4" />Back</Button><Button onClick={() => moveTo(5)} variant="primary">Continue <ArrowRight className="size-4" /></Button></div>
            </>}

            {currentKey === 'credits' && <>
              <div className="ugc-wizard-title-row"><span className="ugc-wizard-icon"><Coins className="size-5" /></span><div><h2>Ready to bring it to life.</h2><p>Nothing is charged until you confirm. Failed renders automatically return their reserved credits.</p></div></div>
              <div className="mt-7 grid gap-4 lg:grid-cols-2">
                <div className="ugc-wizard-credit-card">
                  <span className="ugc-wizard-mini-label">YOUR CAMPAIGN</span>
                  <div className="mt-4 space-y-3"><div><span>{adCount} UGC ad{adCount === 1 ? '' : 's'}</span><strong>{duration}s each</strong></div><div><span>Quality</span><strong>{quality === 'PREMIUM' ? 'Premium' : 'Standard'}</strong></div><div><span>Creator</span><strong>{creatorMode === 'AUTO' ? 'Auto match' : selectedAvatar?.name || 'Selected'}</strong></div><div><span>Credits per ad</span><strong>{estimate.data?.perAd?.toLocaleString() || '—'}</strong></div></div>
                </div>
                <div className={`ugc-wizard-credit-card total ${insufficient ? 'insufficient' : ''}`}>
                  <span className="ugc-wizard-mini-label">TOTAL</span>
                  <strong className="ugc-wizard-credit-total">{estimate.isFetching ? '…' : estimate.data?.credits.toLocaleString() || '—'}</strong>
                  <span className="text-[11px] text-text-muted">credits</span>
                  <div className="mt-5 h-px bg-white/10" />
                  <div className="mt-4 flex items-center justify-between text-xs"><span className="text-text-muted">Your balance</span><strong>{remaining.toLocaleString()}</strong></div>
                  {insufficient && <p className="mt-3 text-[10px] leading-4 text-brand-red">You don't have enough credits for this campaign. Reduce the number of ads, duration or quality.</p>}
                </div>
              </div>
              <div className="ugc-wizard-footer"><Button onClick={() => moveTo(4)}><ArrowLeft className="size-4" />Back</Button><Button disabled={create.isPending || insufficient || !estimate.data} onClick={() => create.mutate()} variant="primary">{create.isPending ? <><LoaderCircle className="size-4 animate-spin" />Starting campaign…</> : <><WandSparkles className="size-4" />Generate campaign</>}</Button></div>
            </>}

            {currentKey === 'finish' && <>
              <div className="ugc-wizard-title-row"><span className="ugc-wizard-icon"><Sparkles className="size-5" /></span><div><h2>{terminal.has(campaign.data?.status || '') ? 'Your UGC campaign is ready.' : 'Your UGC campaign is being created.'}</h2><p>{terminal.has(campaign.data?.status || '') ? 'Review, edit a specific ad if you want, or send the ready videos straight to the scheduler.' : 'You can close this window. Rendering continues safely in the background.'}</p></div></div>

              <div className="ugc-wizard-generation mt-7">
                <div className="flex items-center justify-between gap-3"><div><strong>{campaign.data?.title || 'UGC campaign'}</strong><span>{readyAds} of {campaign.data?.ads.length || adCount} ready{failedAds ? ` · ${failedAds} failed` : ''}</span></div><span className="ugc-wizard-status">{campaign.data?.status?.replaceAll('_', ' ') || 'STARTING'}</span></div>
                <div className="ugc-wizard-generation-bar"><span style={{ width: `${Math.max(4, progress)}%` }} /></div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {(campaign.data?.ads || []).map((ad) => <article className="ugc-wizard-output-card" key={ad.id}><div><span className="ugc-wizard-mini-label">VARIATION {ad.sequence}</span><strong>{ad.title}</strong><p>{ad.hook || ad.angle}</p></div><div className="flex items-center justify-between gap-2"><span className={`ugc-wizard-output-status ${ad.status.toLowerCase()}`}>{ad.status}</span><Button disabled={['QUEUED','RENDERING','RESERVING'].includes(ad.status)} onClick={() => { closeWizard(); navigate(`/ai-content-studio/ugc/${ad.id}/edit`) }} size="sm">Edit</Button></div></article>)}
              </div>

              <div className="ugc-wizard-footer">
                <Button onClick={closeWizard}>Close</Button>
                <Button disabled={!campaign.data?.ads.some((ad) => ad.status === 'READY' && ad.mediaAssetId && assetsById.has(ad.mediaAssetId))} onClick={scheduleReady} variant="primary"><CalendarRange className="size-4" />Schedule ready ads</Button>
              </div>
            </>}
          </div>

          {error && <div className="ugc-wizard-error"><X className="size-4 shrink-0" />{error}</div>}
        </main>
      </div>
    </section>
  </div>, document.body)
}
