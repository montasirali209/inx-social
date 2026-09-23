import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ArrowRight, BadgeCheck, Boxes, CalendarRange, Check, ChevronRight, CirclePlay,
  Clapperboard, Coins, Crown, Film, Globe2, ImagePlus, LoaderCircle, Plus, RefreshCcw,
  Sparkles, Upload, UserRound, UsersRound, WandSparkles, X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchMediaLibrary } from '../../lib/media-library-api'
import {
  analyzeUGCBrand, createUGCCampaign, estimateUGCCampaign, fetchUGCAvatarImage,
  generateUGCAvatar, getUGCCampaign, getUGCOverview, uploadUGCAvatar,
} from '../../lib/ugc-studio-api'
import type { MediaAsset } from '../../types/media-library'
import type {
  CreateUGCCampaignInput, UGCAd, UGCAdCount, UGCAvatar, UGCBrandProfile,
  UGCCampaign, UGCDuration, UGCQuality,
} from '../../types/ugc-studio'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import './ugc-studio.css'

const terminal = new Set(['READY', 'PARTIAL', 'FAILED'])
const durations: UGCDuration[] = [15, 30, 60]
const adCounts: UGCAdCount[] = [1, 5, 10, 15, 20]

function AvatarPortrait({ avatar, className = '' }: { avatar: UGCAvatar; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    if (!avatar.imageUrl) { setUrl(null); return }
    void fetchUGCAvatarImage(avatar).then((value) => { if (active) setUrl(value) })
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
    // imageUrl is the stable reference; avoid refetching on metadata-only changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatar.imageUrl])
  if (url) return <img alt="" className={`size-full object-cover ${className}`} src={url} />
  const initials = avatar.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)
  return <div className={`ugc-avatar-placeholder grid size-full place-items-center ${className}`}><span>{initials}</span></div>
}

function Choice<T extends string | number>({ value, current, onClick, children }: { value: T; current: T; onClick: (value: T) => void; children: ReactNode }) {
  const active = value === current
  return <button className={`ugc-choice ${active ? 'ugc-choice-active' : ''}`} onClick={() => onClick(value)} type="button">{children}</button>
}

function CreditEstimate({ credits, remaining, loading }: { credits: number | null; remaining: number; loading?: boolean }) {
  const insufficient = credits !== null && remaining < credits
  return <div className={`rounded-2xl border p-4 ${insufficient ? 'border-brand-red/30 bg-brand-red/[.06]' : 'border-brand-teal/25 bg-brand-teal/[.05]'}`}>
    <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-xs font-semibold"><Coins className="size-4 text-brand-amber" />Campaign credits</span><strong className="text-xl">{loading ? '…' : credits?.toLocaleString() ?? '—'}</strong></div>
    <p className="mt-1.5 text-[10px] leading-4 text-text-muted">{insufficient ? `You have ${remaining.toLocaleString()} credits. Reduce the campaign or add credits before rendering.` : 'Credits are reserved before rendering and automatically returned for failed renders.'}</p>
  </div>
}

function BrandCard({ brand }: { brand: UGCBrandProfile }) {
  return <div className="ugc-depth-card overflow-hidden rounded-2xl border border-brand-cyan/25 bg-brand-cyan/[.035] p-4">
    <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><BadgeCheck className="size-4" /></span><div className="min-w-0"><strong className="block truncate text-sm">{brand.productName || brand.name}</strong><span className="mt-1 block truncate text-[10px] text-text-soft">{brand.websiteUrl}</span><p className="mt-2 line-clamp-3 text-[11px] leading-5 text-text-muted">{brand.summary}</p></div></div>
    {!!brand.audience.length && <div className="mt-3 flex flex-wrap gap-1.5">{brand.audience.slice(0, 4).map((item) => <span className="rounded-full border border-white/10 bg-black/15 px-2 py-1 text-[9px] text-text-muted" key={item}>{item}</span>)}</div>}
  </div>
}

function AvatarCard({ avatar, active, onSelect }: { avatar: UGCAvatar; active: boolean; onSelect: () => void }) {
  return <button className={`ugc-avatar-card group text-left ${active ? 'ugc-avatar-card-active' : ''}`} onClick={onSelect} type="button">
    <div className="relative aspect-[4/5] overflow-hidden rounded-[18px] border border-white/10 bg-[#081824]">
      <AvatarPortrait avatar={avatar} />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-3 pt-12">
        <strong className="block text-xs">{avatar.name}</strong>
        <span className="mt-0.5 block text-[9px] text-white/65">{avatar.category} · {avatar.ageBand}</span>
      </div>
      {active && <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full border border-brand-cyan/50 bg-brand-teal text-[#02130f] shadow-[0_0_26px_rgba(45,212,191,.42)]"><Check className="size-4" /></span>}
      {!avatar.referenceReady && <span className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/50 px-2 py-1 text-[8px] text-white/70 backdrop-blur">Prepared on first use</span>}
    </div>
  </button>
}

function CampaignProgress({ campaign }: { campaign: UGCCampaign }) {
  const ready = campaign.ads.filter((ad) => ad.status === 'READY').length
  const failed = campaign.ads.filter((ad) => ad.status === 'FAILED').length
  const percent = campaign.ads.length ? Math.round(((ready + failed) / campaign.ads.length) * 100) : 0
  const active = !terminal.has(campaign.status)
  return <Card className="ugc-depth-card overflow-hidden border-brand-cyan/25 bg-[radial-gradient(circle_at_90%_0%,rgba(45,212,191,.12),transparent_18rem),linear-gradient(145deg,rgba(6,31,45,.96),rgba(4,15,27,.98))] p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><span className="text-[9px] font-bold uppercase tracking-[.16em] text-brand-cyan">UGC production</span><h2 className="mt-1 text-xl font-semibold">{campaign.title}</h2><p className="mt-1 text-xs text-text-muted">{ready} of {campaign.ads.length} ready{failed ? ` · ${failed} failed` : ''}. You can leave this page while generation continues.</p></div><span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.13em] ${active ? 'border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan' : campaign.status === 'READY' ? 'border-brand-green/25 bg-brand-green/10 text-brand-green' : 'border-brand-amber/25 bg-brand-amber/10 text-brand-amber'}`}>{active && <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" />}{campaign.status.replaceAll('_', ' ')}</span></div>
    <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/7"><div className="h-full rounded-full bg-gradient-to-r from-brand-teal via-brand-cyan to-emerald-300 transition-all duration-500" style={{ width: `${percent}%` }} /></div>
    <div className="mt-4 grid gap-2 text-[10px] text-text-muted sm:grid-cols-4"><span>{campaign.duration}s each</span><span>{campaign.quality === 'PREMIUM' ? 'Premium' : 'Standard'} quality</span><span>720p vertical</span><span>{campaign.totalCredits.toLocaleString()} credits reserved</span></div>
  </Card>
}

function AdCard({ ad, asset, onEdit, onSchedule }: { ad: UGCAd; asset?: MediaAsset; onEdit: () => void; onSchedule: () => void }) {
  const processing = ['QUEUED','RENDERING','RESERVING'].includes(ad.status)
  return <article className="ugc-video-card group overflow-hidden rounded-[22px] border border-border-soft bg-[linear-gradient(155deg,rgba(10,35,49,.96),rgba(4,15,27,.99))]">
    <div className="relative aspect-[9/16] overflow-hidden bg-[radial-gradient(circle_at_50%_20%,rgba(45,212,191,.16),transparent_16rem),linear-gradient(180deg,#0b2734,#04101c)]">
      {asset?.fileUrl ? <video className="size-full object-cover" controls playsInline preload="metadata" src={asset.fileUrl} /> : <div className="absolute inset-0 grid place-items-center"><div className="text-center">{processing ? <LoaderCircle className="mx-auto size-8 animate-spin text-brand-cyan motion-reduce:animate-none" /> : <Clapperboard className="mx-auto size-8 text-text-soft" />}<span className="mt-3 block text-[10px] text-text-muted">{processing ? 'Rendering your ad…' : ad.status === 'FAILED' ? 'Render failed' : 'Preparing preview'}</span></div></div>}
      <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[9px] font-bold text-white backdrop-blur">{ad.duration}s</span>
      <span className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[9px] font-bold backdrop-blur ${ad.status === 'READY' ? 'border-brand-green/30 bg-brand-green/15 text-brand-green' : ad.status === 'FAILED' ? 'border-brand-red/30 bg-brand-red/15 text-brand-red' : 'border-brand-cyan/25 bg-black/55 text-brand-cyan'}`}>{ad.status}</span>
    </div>
    <div className="p-4"><span className="text-[9px] font-bold uppercase tracking-[.15em] text-brand-cyan">{ad.angle || `Variation ${ad.sequence}`}</span><h3 className="mt-1 line-clamp-1 text-sm font-semibold">{ad.title}</h3><p className="mt-2 line-clamp-2 text-[10px] leading-4 text-text-muted">{ad.hook || ad.script}</p>
      <div className="mt-4 flex gap-2"><Button className="flex-1" disabled={processing} onClick={onEdit} size="sm"><WandSparkles className="size-3.5" />Edit</Button><Button className="flex-1" disabled={!asset || ad.status !== 'READY'} onClick={onSchedule} size="sm" variant="primary"><CalendarRange className="size-3.5" />Schedule</Button></div>
    </div>
  </article>
}

export function UGCStudioPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const overview = useQuery({ queryKey: ['ugc-studio-overview'], queryFn: getUGCOverview, staleTime: 15_000 })
  const [productUrl, setProductUrl] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [brand, setBrand] = useState<UGCBrandProfile | null>(null)
  const [creatorMode, setCreatorMode] = useState<'AUTO' | 'SELECTED'>('AUTO')
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [duration, setDuration] = useState<UGCDuration>(30)
  const [adCount, setAdCount] = useState<UGCAdCount>(5)
  const [quality, setQuality] = useState<UGCQuality>('STANDARD')
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null)
  const [showCreators, setShowCreators] = useState(false)
  const [showCustomAvatar, setShowCustomAvatar] = useState(false)
  const [avatarName, setAvatarName] = useState('')
  const [avatarPrompt, setAvatarPrompt] = useState('')
  const [error, setError] = useState('')

  const input = useMemo<CreateUGCCampaignInput>(() => ({
    brandProfileId: brand?.id || null,
    productUrl: brand ? '' : productUrl.trim(),
    productDescription: description.trim(),
    creatorMode,
    avatarId: creatorMode === 'SELECTED' ? avatarId : null,
    duration, adCount, quality, notes: notes.trim(),
  }), [brand, productUrl, description, creatorMode, avatarId, duration, adCount, quality, notes])

  const estimate = useQuery({
    queryKey: ['ugc-estimate', duration, adCount, quality],
    queryFn: () => estimateUGCCampaign(input),
    enabled: Boolean(overview.data),
    staleTime: 60_000,
  })

  const campaign = useQuery({
    queryKey: ['ugc-campaign', activeCampaignId],
    queryFn: () => getUGCCampaign(activeCampaignId!),
    enabled: Boolean(activeCampaignId),
    refetchInterval: (query) => {
      const value = query.state.data
      return value && terminal.has(value.status) ? false : 3500
    },
  })

  const media = useQuery({
    queryKey: ['media-library', 'ugc-studio', activeCampaignId],
    queryFn: fetchMediaLibrary,
    enabled: Boolean(campaign.data?.ads.some((ad) => ad.mediaAssetId)),
    refetchInterval: campaign.data && !terminal.has(campaign.data.status) ? 5000 : false,
  })
  const assetsById = useMemo(() => new Map((media.data?.assets || []).map((asset) => [asset.id, asset])), [media.data])

  useEffect(() => {
    if (campaign.data && terminal.has(campaign.data.status)) {
      void queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
      void queryClient.invalidateQueries({ queryKey: ['ai-studio-access'] })
    }
  }, [campaign.data, queryClient])

  const analyze = useMutation({
    mutationFn: () => analyzeUGCBrand(productUrl),
    onSuccess: (value) => { setBrand(value); setProductUrl(value.websiteUrl); setError(''); void queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] }) },
    onError: (value) => setError(value instanceof Error ? value.message : 'Website analysis failed.'),
  })

  const create = useMutation({
    mutationFn: () => createUGCCampaign(input),
    onSuccess: (value) => { setActiveCampaignId(value.id); setError(''); void queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] }) },
    onError: (value) => setError(value instanceof Error ? value.message : 'The UGC campaign could not be created.'),
  })

  const generateAvatar = useMutation({
    mutationFn: () => generateUGCAvatar({ name: avatarName, prompt: avatarPrompt }),
    onSuccess: (value) => {
      setCreatorMode('SELECTED'); setAvatarId(value.id); setShowCustomAvatar(false); setAvatarName(''); setAvatarPrompt('')
      void queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
    },
    onError: (value) => setError(value instanceof Error ? value.message : 'The custom creator could not be generated.'),
  })

  async function uploadAvatar(file: File | undefined) {
    if (!file) return
    try {
      const value = await uploadUGCAvatar(file)
      setCreatorMode('SELECTED'); setAvatarId(value.id); setShowCustomAvatar(false)
      await queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
    } catch (value) { setError(value instanceof Error ? value.message : 'Avatar upload failed.') }
  }

  function schedulerState(ads: UGCAd[]) {
    const selected = ads.filter((ad) => ad.status === 'READY' && ad.mediaAssetId).map((ad) => ({ ad, asset: assetsById.get(ad.mediaAssetId!) })).filter((value): value is { ad: UGCAd; asset: MediaAsset } => Boolean(value.asset))
    if (!selected.length) { setError('Wait for at least one finished UGC ad before scheduling.'); return null }
    return {
      mediaLibraryAssets: selected.map((value) => value.asset),
      aiMixedCampaign: {
        id: campaign.data?.id || selected[0].ad.campaignId,
        title: campaign.data?.title || 'UGC Campaign',
        posts: selected.map(({ ad }) => ({ id: ad.id, contentType: 'IMAGE' as const, caption: ad.caption || ad.script, mediaAssetId: ad.mediaAssetId! })),
      },
    }
  }

  function scheduleAds(ads: UGCAd[]) {
    const state = schedulerState(ads)
    if (state) navigate('/bulk-scheduler', { state })
  }

  const avatars = overview.data?.avatars || []
  const selectedAvatar = avatars.find((avatar) => avatar.id === avatarId) || null
  const currentCampaign = campaign.data || overview.data?.campaigns.find((item) => item.id === activeCampaignId)
  const canCreate = Boolean((brand || productUrl.trim() || description.trim()) && (creatorMode === 'AUTO' || avatarId) && !create.isPending)
  const remaining = overview.data?.credits.remaining || 0

  return <div className="ugc-studio-shell">
    <section className="ugc-hero relative overflow-hidden rounded-[30px] border border-brand-cyan/20 p-5 shadow-[0_30px_90px_rgba(0,0,0,.32)] sm:p-7">
      <div className="ugc-hero-orb ugc-hero-orb-a" /><div className="ugc-hero-orb ugc-hero-orb-b" />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(310px,.72fr)] lg:items-center">
        <div><Link className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-text-muted hover:text-white" to="/ai-content-studio"><ArrowLeft className="size-3.5" />AI Content Studio</Link>
          <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-brand-purple/25 bg-brand-purple/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-[#c4b5fd]"><WandSparkles className="size-3.5" />UGC Studio</span>
          <h1 className="mt-4 max-w-3xl text-[clamp(2.25rem,5vw,4.6rem)] font-bold leading-[.96] tracking-[-.055em]">Your product in. <span className="bg-gradient-to-r from-brand-teal via-brand-cyan to-emerald-300 bg-clip-text text-transparent">Ready-to-post UGC out.</span></h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-text-muted sm:text-[15px]">Give INXSocial your website or product. We handle the research, creative angles, scripts, creators, scenes, voice, captions and final 720p videos — then send them straight to your scheduler.</p>
          <div className="mt-6 flex flex-wrap gap-2">{['Automatic creative direction','50+ reusable creators','15 / 30 / 60 sec','1–20 variations','Scheduler ready'].map((item) => <span className="rounded-full border border-white/10 bg-white/[.035] px-3 py-1.5 text-[9px] text-text-muted" key={item}>{item}</span>)}</div>
        </div>
        <div aria-hidden="true" className="ugc-hero-stage">
          <div className="ugc-phone ugc-phone-back"><span className="ugc-phone-glow" /><UserRound className="size-12 text-brand-purple/60" /></div>
          <div className="ugc-phone ugc-phone-front"><div className="ugc-phone-screen"><span className="grid size-14 place-items-center rounded-full border border-brand-cyan/35 bg-brand-cyan/10"><CirclePlay className="size-7 text-brand-cyan" /></span><strong>UGC ready</strong><small>30 sec · 720p</small></div></div>
          <div className="ugc-float-chip ugc-chip-one"><Sparkles className="size-3" />Auto script</div>
          <div className="ugc-float-chip ugc-chip-two"><UsersRound className="size-3" />Creator match</div>
          <div className="ugc-float-chip ugc-chip-three"><CalendarRange className="size-3" />Schedule</div>
        </div>
      </div>
    </section>

    {currentCampaign && <div className="mt-5"><CampaignProgress campaign={currentCampaign} /></div>}

    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,.55fr)]">
      <Card className="ugc-depth-card relative overflow-hidden border-brand-teal/20 bg-[linear-gradient(145deg,rgba(7,31,44,.97),rgba(4,15,27,.99))] p-5 sm:p-6">
        <div aria-hidden="true" className="absolute -right-20 -top-24 size-72 rounded-full bg-brand-teal/[.07] blur-3xl" />
        <div className="relative"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-brand-teal/30 bg-brand-teal/10 text-brand-cyan"><Globe2 className="size-5" /></span><div><span className="text-[9px] font-bold uppercase tracking-[.16em] text-brand-cyan">1 · Product or brand</span><h2 className="mt-1 text-lg font-semibold">What are we creating ads for?</h2><p className="mt-1 text-[11px] leading-5 text-text-muted">Paste a public website and we will learn the offer automatically, or describe it yourself.</p></div></div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row"><input className="ugc-input flex-1" onChange={(event) => { setProductUrl(event.target.value); if (brand && event.target.value !== brand.websiteUrl) setBrand(null) }} placeholder="https://yourbrand.com/product" value={productUrl} /><Button disabled={!productUrl.trim() || analyze.isPending} onClick={() => analyze.mutate()}>{analyze.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}Analyze</Button></div>
          <textarea className="ugc-input mt-3 min-h-24 w-full resize-y" onChange={(event) => setDescription(event.target.value)} placeholder="Optional: add anything the website does not explain — offer details, launch context or product notes." value={description} />
          {brand && <div className="mt-4"><BrandCard brand={brand} /></div>}
          {!!overview.data?.brands.length && !brand && <div className="mt-4"><span className="text-[9px] font-bold uppercase tracking-[.14em] text-text-soft">Recent brands</span><div className="mt-2 flex flex-wrap gap-2">{overview.data.brands.slice(0,5).map((item) => <button className="rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-[10px] text-text-muted transition hover:border-brand-cyan/30 hover:text-white" key={item.id} onClick={() => { setBrand(item); setProductUrl(item.websiteUrl) }} type="button">{item.name}</button>)}</div></div>}
        </div>
      </Card>

      <Card className="ugc-depth-card border-brand-purple/20 bg-[linear-gradient(145deg,rgba(19,24,53,.95),rgba(5,15,28,.99))] p-5 sm:p-6">
        <span className="text-[9px] font-bold uppercase tracking-[.16em] text-[#c4b5fd]">Campaign summary</span>
        <div className="mt-4 space-y-3 text-xs"><div className="flex items-center justify-between"><span className="text-text-muted">Duration</span><strong>{duration}s</strong></div><div className="flex items-center justify-between"><span className="text-text-muted">Variations</span><strong>{adCount}</strong></div><div className="flex items-center justify-between"><span className="text-text-muted">Quality</span><strong>{quality === 'PREMIUM' ? 'Premium' : 'Standard'}</strong></div><div className="flex items-center justify-between"><span className="text-text-muted">Creator</span><strong className="max-w-[160px] truncate">{creatorMode === 'AUTO' ? 'Auto match' : selectedAvatar?.name || 'Choose creator'}</strong></div></div>
        <div className="mt-5"><CreditEstimate credits={estimate.data?.credits ?? null} loading={estimate.isFetching} remaining={remaining} /></div>
        <Button className="mt-4 w-full min-h-12 shadow-[0_14px_34px_rgba(20,184,166,.18)]" disabled={!canCreate || Boolean(estimate.data && remaining < estimate.data.credits)} onClick={() => create.mutate()} variant="primary">{create.isPending ? <><LoaderCircle className="size-4 animate-spin" />Planning your campaign…</> : <><WandSparkles className="size-4" />Generate {adCount} UGC Ad{adCount === 1 ? '' : 's'} <ArrowRight className="size-4" /></>}</Button>
        <p className="mt-2 text-center text-[9px] leading-4 text-text-soft">Generation continues safely in the background if you leave this screen.</p>
      </Card>
    </div>

    <Card className="ugc-depth-card mt-5 overflow-hidden p-5 sm:p-6">
      <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-brand-amber/25 bg-brand-amber/10 text-brand-amber"><UserRound className="size-5" /></span><div className="min-w-0 flex-1"><span className="text-[9px] font-bold uppercase tracking-[.16em] text-brand-amber">2 · Creator</span><h2 className="mt-1 text-lg font-semibold">Choose a creator — or let AI decide.</h2><p className="mt-1 text-[11px] leading-5 text-text-muted">INXSocial creators are reusable and do not add an avatar-generation charge. Auto can vary creators across a campaign where it improves the result.</p></div><Button onClick={() => setShowCreators((value) => !value)} size="sm">{showCreators ? 'Hide library' : 'Browse creators'} <ChevronRight className={`size-3.5 transition-transform ${showCreators ? 'rotate-90' : ''}`} /></Button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button className={`ugc-auto-creator rounded-[20px] border p-4 text-left ${creatorMode === 'AUTO' ? 'border-brand-cyan/55 bg-brand-cyan/[.08]' : 'border-white/10 bg-white/[.025]'}`} onClick={() => { setCreatorMode('AUTO'); setAvatarId(null) }} type="button"><span className="grid size-10 place-items-center rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan"><Sparkles className="size-4" /></span><strong className="mt-4 block text-sm">Auto creator</strong><span className="mt-1 block text-[10px] leading-4 text-text-muted">AI matches the campaign angle and audience to the best creator.</span></button>
        {selectedAvatar && <div className="ugc-selected-creator flex items-center gap-3 rounded-[20px] border border-brand-cyan/40 bg-brand-cyan/[.06] p-3"><div className="size-16 shrink-0 overflow-hidden rounded-2xl"><AvatarPortrait avatar={selectedAvatar} /></div><div className="min-w-0"><span className="text-[9px] font-bold uppercase tracking-[.14em] text-brand-cyan">Selected</span><strong className="mt-1 block truncate text-sm">{selectedAvatar.name}</strong><span className="text-[9px] text-text-muted">{selectedAvatar.category} · {selectedAvatar.ageBand}</span></div></div>}
        <button className="rounded-[20px] border border-dashed border-brand-purple/30 bg-brand-purple/[.035] p-4 text-left transition hover:border-brand-purple/55 hover:bg-brand-purple/[.07]" onClick={() => setShowCustomAvatar(true)} type="button"><span className="grid size-10 place-items-center rounded-xl border border-brand-purple/30 bg-brand-purple/10 text-[#c4b5fd]"><Plus className="size-4" /></span><strong className="mt-4 block text-sm">My creator</strong><span className="mt-1 block text-[10px] leading-4 text-text-muted">Upload a portrait or generate a reusable creator for 5 credits.</span></button>
      </div>
      {showCreators && <div className="mt-5 border-t border-border-soft pt-5"><div className="mb-3 flex items-center justify-between"><div><strong className="text-sm">INXSocial creator library</strong><p className="mt-1 text-[10px] text-text-muted">{overview.data?.options.systemAvatarCount || 50}+ built-in creators · free to reuse</p></div></div><div className="ugc-avatar-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8">{avatars.filter((avatar) => avatar.scope === 'SYSTEM').map((avatar) => <AvatarCard active={creatorMode === 'SELECTED' && avatar.id === avatarId} avatar={avatar} key={avatar.id} onSelect={() => { setCreatorMode('SELECTED'); setAvatarId(avatar.id) }} />)}</div>{avatars.some((avatar) => avatar.scope === 'USER') && <><h3 className="mt-6 text-sm font-semibold">My creators</h3><div className="ugc-avatar-grid mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8">{avatars.filter((avatar) => avatar.scope === 'USER').map((avatar) => <AvatarCard active={creatorMode === 'SELECTED' && avatar.id === avatarId} avatar={avatar} key={avatar.id} onSelect={() => { setCreatorMode('SELECTED'); setAvatarId(avatar.id) }} />)}</div></>}</div>}
    </Card>

    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <Card className="ugc-depth-card p-5 sm:p-6"><span className="text-[9px] font-bold uppercase tracking-[.16em] text-brand-cyan">3 · Length & variations</span><h2 className="mt-1 text-lg font-semibold">How much UGC do you want?</h2><div className="mt-5"><span className="text-[10px] font-semibold text-text-muted">Video length</span><div className="mt-2 grid grid-cols-3 gap-2">{durations.map((value) => <Choice current={duration} key={value} onClick={setDuration} value={value}><strong className="block text-sm">{value}s</strong><span className="mt-1 block text-[8px] text-text-soft">{value === 15 ? 'Quick hook' : value === 30 ? 'Best all-round' : 'Full story'}</span></Choice>)}</div></div><div className="mt-5"><span className="text-[10px] font-semibold text-text-muted">Number of ads</span><div className="mt-2 grid grid-cols-5 gap-2">{adCounts.map((value) => <Choice current={adCount} key={value} onClick={setAdCount} value={value}><strong className="text-sm">{value}</strong></Choice>)}</div></div></Card>
      <Card className="ugc-depth-card p-5 sm:p-6"><span className="text-[9px] font-bold uppercase tracking-[.16em] text-brand-purple">4 · Generation quality</span><h2 className="mt-1 text-lg font-semibold">Keep it simple.</h2><div className="mt-5 grid gap-3 sm:grid-cols-2"><button className={`ugc-quality-card ${quality === 'STANDARD' ? 'ugc-quality-active' : ''}`} onClick={() => setQuality('STANDARD')} type="button"><span className="grid size-10 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><Film className="size-4" /></span><strong className="mt-3 block text-sm">Standard</strong><span className="mt-1 block text-[10px] leading-4 text-text-muted">High-quality creator and product UGC, automatically routed for the best fit.</span></button><button className={`ugc-quality-card ${quality === 'PREMIUM' ? 'ugc-quality-premium-active' : ''}`} onClick={() => setQuality('PREMIUM')} type="button"><span className="grid size-10 place-items-center rounded-xl border border-brand-purple/30 bg-brand-purple/10 text-[#c4b5fd]"><Crown className="size-4" /></span><strong className="mt-3 block text-sm">Premium</strong><span className="mt-1 block text-[10px] leading-4 text-text-muted">Advanced generation for complex movement, product interaction and demanding scenes.</span></button></div><textarea className="ugc-input mt-4 min-h-20 w-full resize-y" onChange={(event) => setNotes(event.target.value)} placeholder="Optional: anything specific to include or avoid?" value={notes} /></Card>
    </div>

    {error && <div className="mt-5 flex items-start gap-3 rounded-2xl border border-brand-red/30 bg-brand-red/[.06] p-4 text-xs text-brand-red"><X className="mt-0.5 size-4 shrink-0" />{error}</div>}

    {currentCampaign && <section className="mt-6"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><span className="text-[9px] font-bold uppercase tracking-[.16em] text-brand-cyan">Campaign output</span><h2 className="mt-1 text-xl font-semibold">Your UGC ads</h2><p className="mt-1 text-[11px] text-text-muted">Ready ads can be scheduled immediately. Open Edit only when you want to change something.</p></div><Button disabled={!currentCampaign.ads.some((ad) => ad.status === 'READY' && assetsById.has(ad.mediaAssetId || ''))} onClick={() => scheduleAds(currentCampaign.ads)} variant="primary"><CalendarRange className="size-4" />Schedule all ready ads</Button></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{currentCampaign.ads.map((ad) => <AdCard ad={ad} asset={ad.mediaAssetId ? assetsById.get(ad.mediaAssetId) : undefined} key={ad.id} onEdit={() => navigate(`/ai-content-studio/ugc/${ad.id}/edit`)} onSchedule={() => scheduleAds([ad])} />)}</div></section>}

    {!!overview.data?.campaigns.length && <section className="mt-7"><div className="mb-4 flex items-end justify-between"><div><span className="text-[9px] font-bold uppercase tracking-[.16em] text-text-soft">Workspace</span><h2 className="mt-1 text-lg font-semibold">Recent UGC campaigns</h2></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{overview.data.campaigns.slice(0,6).map((item) => <button className="ugc-depth-card group rounded-2xl border border-border-soft bg-white/[.025] p-4 text-left transition hover:border-brand-cyan/30" key={item.id} onClick={() => setActiveCampaignId(item.id)} type="button"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-sm">{item.title}</strong><span className="mt-1 block text-[9px] text-text-soft">{item.adCount} ads · {item.duration}s · {item.quality === 'PREMIUM' ? 'Premium' : 'Standard'}</span></div><span className="rounded-full border border-white/10 bg-black/15 px-2 py-1 text-[8px] font-bold text-text-muted">{item.status}</span></div><div className="mt-4 flex items-center justify-between text-[10px] text-text-muted"><span>{item.totalCredits.toLocaleString()} credits</span><span className="flex items-center gap-1 text-brand-cyan">Open <ArrowRight className="size-3 transition-transform group-hover:translate-x-1" /></span></div></button>)}</div></section>}

    {showCustomAvatar && <div className="fixed inset-0 z-[150] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCustomAvatar(false) }}><div className="ugc-modal-panel w-full max-w-xl rounded-[28px] border border-brand-purple/25 bg-[radial-gradient(circle_at_85%_5%,rgba(139,92,246,.16),transparent_18rem),linear-gradient(145deg,#091927,#050e19)] p-5 shadow-[0_35px_100px_rgba(0,0,0,.6)] sm:p-6"><div className="flex items-start justify-between gap-3"><div><span className="text-[9px] font-bold uppercase tracking-[.16em] text-[#c4b5fd]">My creators</span><h2 className="mt-1 text-xl font-semibold">Add a reusable creator</h2><p className="mt-1 text-[11px] leading-5 text-text-muted">Upload a portrait for free, or generate an original AI creator for 5 credits. Once saved, reuse is free.</p></div><button className="rounded-xl p-2 text-text-muted hover:bg-white/5 hover:text-white" onClick={() => setShowCustomAvatar(false)} type="button"><X className="size-4" /></button></div><div className="mt-5 rounded-2xl border border-white/10 bg-white/[.025] p-4"><strong className="text-xs">Upload portrait</strong><label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-brand-cyan/25 bg-brand-cyan/[.035] px-4 py-6 text-xs text-text-muted transition hover:border-brand-cyan/50 hover:text-white"><Upload className="size-4" />Choose PNG, JPEG or WebP<input accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void uploadAvatar(event.target.files?.[0])} type="file" /></label></div><div className="my-4 flex items-center gap-3 text-[9px] text-text-soft"><span className="h-px flex-1 bg-white/10" />OR GENERATE<span className="h-px flex-1 bg-white/10" /></div><div className="space-y-3"><input className="ugc-input w-full" onChange={(event) => setAvatarName(event.target.value)} placeholder="Creator name" value={avatarName} /><textarea className="ugc-input min-h-24 w-full resize-y" onChange={(event) => setAvatarPrompt(event.target.value)} placeholder="Describe the creator: age range, style, appearance, niche..." value={avatarPrompt} /><Button className="w-full" disabled={avatarName.trim().length < 2 || avatarPrompt.trim().length < 8 || generateAvatar.isPending} onClick={() => generateAvatar.mutate()} variant="primary">{generateAvatar.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}Generate creator · 5 credits</Button></div></div></div>}
  </div>
}
