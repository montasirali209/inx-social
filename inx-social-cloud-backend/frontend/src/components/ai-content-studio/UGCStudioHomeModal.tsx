import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarRange, Clapperboard, Clock3, Coins, Copy, Film,
  LoaderCircle, Pencil, Play, Plus, Sparkles, Trash2, UsersRound, X,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadUGCEditor } from '../../route-preload'
import { fetchMediaLibrary } from '../../lib/media-library-api'
import {
  deleteUGCCampaign,
  fetchUGCAvatarImage,
  fetchUGCSampleVideo,
  getUGCOverview,
  trackUGCStudioEvent,
} from '../../lib/ugc-studio-api'
import type { MediaAsset } from '../../types/media-library'
import type { CreateUGCCampaignInput, UGCAvatar, UGCCampaign, UGCSampleVideo } from '../../types/ugc-studio'
import { Button } from '../ui/Button'
import { UGCAgentHero } from './UGCAgentHero'
import { UGCAgentModal } from './UGCAgentModal'
import { UGCVideoLightbox } from './UGCVideoPlayer'
import './ugc-studio-home.css'

const activeStatuses = new Set(['RESERVING', 'QUEUED', 'RENDERING', 'PLANNING'])

function ProtectedAvatar({ avatar }: { avatar: UGCAvatar }) {
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
  return url
    ? <img alt="" className="size-full object-cover" src={url} />
    : <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_50%_25%,rgba(45,212,191,.16),transparent_6rem),#0a1d29] text-sm font-bold text-brand-cyan">{avatar.name.slice(0,1)}</div>
}

function SampleVideo({ sample }: { sample: UGCSampleVideo }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    let created: string | null = null
    void fetchUGCSampleVideo(sample).then((value) => {
      if (!value) return
      if (!active) { URL.revokeObjectURL(value); return }
      created = value
      setUrl(value)
    })
    return () => { active = false; if (created) URL.revokeObjectURL(created) }
  }, [sample])
  return <article className="ugc-home-sample">
    <div className="relative aspect-[9/16] overflow-hidden rounded-[18px] bg-[#06121d]">
      {url ? <video className="size-full object-cover" controls playsInline preload="metadata" src={url} /> : <div className="absolute inset-0 grid place-items-center"><LoaderCircle className="size-6 animate-spin text-brand-cyan" /></div>}
      <span className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/55 px-2 py-1 text-[8px] font-bold text-white backdrop-blur">{sample.duration}s</span>
      <span className="absolute right-2 top-2 rounded-full border border-brand-cyan/20 bg-black/55 px-2 py-1 text-[8px] font-bold text-brand-cyan backdrop-blur">{sample.quality === 'PREMIUM' ? 'Premium' : 'Standard'}</span>
    </div>
    <strong className="mt-2 block truncate text-[11px]">{sample.title}</strong>
    <span className="mt-1 block text-[8px] text-text-soft">{sample.campaignType === 'PRODUCT_SHOWCASE' ? 'Product showcase' : 'Avatar explainer'}</span>
  </article>
}

function statusLabel(status: string) {
  if (status === 'PARTIAL') return 'Partially ready'
  return status.slice(0,1) + status.slice(1).toLowerCase()
}

export function UGCStudioHomeModal({
  open,
  onClose,
  onCreate,
  onToast,
}: {
  open: boolean
  onClose: () => void
  onCreate: (seed?: UGCCampaign, draft?: Partial<CreateUGCCampaignInput>) => void
  onToast: (message: string) => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const previousReady = useRef<Set<string>>(new Set())
  const [filter, setFilter] = useState<'ALL' | 'READY' | 'RENDERING' | 'FAILED'>('ALL')
  const [selectedAdIds, setSelectedAdIds] = useState<string[]>([])
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(null)
  const [agentCreator, setAgentCreator] = useState<UGCAvatar | null>(null)
  const [creatorChoice, setCreatorChoice] = useState<UGCAvatar | null>(null)
  const [agentOpen, setAgentOpen] = useState(false)
  const [agentInitialPrompt, setAgentInitialPrompt] = useState('')
  const [agentSessionKey, setAgentSessionKey] = useState(0)

  const overview = useQuery({
    queryKey: ['ugc-studio-overview'],
    queryFn: getUGCOverview,
    enabled: open,
    staleTime: 3_000,
    refetchInterval: (query) => query.state.data?.campaigns.some((campaign) => activeStatuses.has(campaign.status)) ? 3500 : 12_000,
  })
  const media = useQuery({
    queryKey: ['media-library', 'ugc-home'],
    queryFn: fetchMediaLibrary,
    enabled: open,
    staleTime: 4_000,
    refetchInterval: overview.data?.campaigns.some((campaign) => activeStatuses.has(campaign.status)) ? 5000 : false,
  })

  useEffect(() => {
    if (!open) return
    void trackUGCStudioEvent({ event: 'STUDIO_OPENED', stage: 'home' })
    // Warm the editor chunk while the UGC workspace is already open. This both
    // removes the click-time delay and keeps the editor module in memory across
    // a later deployment while this tab remains open.
    void loadUGCEditor().catch(() => undefined)
  }, [open])

  useEffect(() => {
    if (!open) return
    const bodyOverflow = document.body.style.overflow
    const htmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = bodyOverflow
      document.documentElement.style.overflow = htmlOverflow
    }
  }, [open])

  useEffect(() => {
    if (!overview.data) return
    const readyNow = new Set(
      overview.data.campaigns.flatMap((campaign) => campaign.ads).filter((ad) => ad.status === 'READY').map((ad) => ad.id),
    )
    if (previousReady.current.size) {
      const newlyReady = [...readyNow].filter((id) => !previousReady.current.has(id))
      if (newlyReady.length) onToast(newlyReady.length === 1 ? 'Your UGC ad is ready.' : `${newlyReady.length} UGC ads are ready.`)
    }
    previousReady.current = readyNow
  }, [overview.data, onToast])

  const remove = useMutation({
    mutationFn: deleteUGCCampaign,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
      onToast('UGC campaign removed from your studio.')
    },
    onError: (error) => onToast(error instanceof Error ? error.message : 'Campaign could not be removed.'),
  })

  const assetsById = useMemo(() => new Map((media.data?.assets || []).map((asset) => [asset.id, asset])), [media.data])
  const campaigns = useMemo(() => {
    const source = overview.data?.campaigns || []
    if (filter === 'ALL') return source
    if (filter === 'READY') return source.filter((campaign) => campaign.ads.some((ad) => ad.status === 'READY'))
    if (filter === 'FAILED') return source.filter((campaign) => campaign.status === 'FAILED' || campaign.ads.some((ad) => ad.status === 'FAILED'))
    return source.filter((campaign) => activeStatuses.has(campaign.status) || campaign.ads.some((ad) => activeStatuses.has(ad.status)))
  }, [overview.data?.campaigns, filter])

  const readyVideos = useMemo(() => (overview.data?.campaigns || []).flatMap((campaign) =>
    campaign.ads
      .filter((ad) => ad.status === 'READY' && ad.mediaAssetId && ad.qualityControl?.publishable)
      .map((ad) => ({ campaign, ad, asset: assetsById.get(ad.mediaAssetId!) }))
      .filter((item): item is { campaign: UGCCampaign; ad: UGCCampaign['ads'][number]; asset: MediaAsset } => Boolean(item.asset))
  ), [assetsById, overview.data?.campaigns])

  const selectedVideos = useMemo(() => readyVideos.filter((item) => selectedAdIds.includes(item.ad.id)), [readyVideos, selectedAdIds])

  function openAgent(initialPrompt = '') {
    setAgentInitialPrompt(initialPrompt)
    setAgentSessionKey((value) => value + 1)
    setAgentOpen(true)
    void trackUGCStudioEvent({ event: 'CREATE_STARTED', stage: 'agent', metadata: { entry: initialPrompt ? 'PROMPT' : 'OPEN' } })
  }

  function startCreation(seed?: UGCCampaign) {
    void trackUGCStudioEvent({
      event: 'CREATE_STARTED',
      stage: 'home',
      campaignId: seed?.id || null,
      metadata: seed ? { sourceType: seed.sourceType, campaignType: seed.campaignType, quality: seed.quality, duration: seed.duration, adCount: seed.adCount } : {},
    })
    onCreate(seed)
  }

  function toggleVideo(adId: string) {
    setSelectedAdIds((current) => current.includes(adId) ? current.filter((id) => id !== adId) : [...current, adId])
  }

  function toggleCampaignReady(campaign: UGCCampaign) {
    const ids = readyVideos.filter((item) => item.campaign.id === campaign.id).map((item) => item.ad.id)
    if (!ids.length) return
    setSelectedAdIds((current) => {
      const currentSet = new Set(current)
      const allSelected = ids.every((id) => currentSet.has(id))
      ids.forEach((id) => allSelected ? currentSet.delete(id) : currentSet.add(id))
      return [...currentSet]
    })
  }

  function scheduleSelected() {
    const selected = selectedVideos
    if (!selected.length) { onToast('Select at least one finished UGC video first.'); return }

    void trackUGCStudioEvent({
      event: 'SCHEDULER_HANDOFF',
      stage: 'home',
      campaignId: selected.length === 1 ? selected[0].campaign.id : null,
      metadata: {
        readyCount: selected.length,
        variationCount: selected.length,
        selectionMode: selected.length === 1 ? 'SINGLE_POST' : 'BULK',
      },
    })

    onClose()
    if (selected.length === 1) {
      const item = selected[0]
      navigate('/posts', {
        state: {
          standardComposer: true,
          mediaLibraryAsset: item.asset,
          ugcCaption: item.ad.caption || item.ad.script,
          ugcTitle: item.ad.title,
          ugcCampaign: item.campaign.title,
        },
      })
      return
    }

    navigate('/bulk-scheduler', {
      state: {
        mediaLibraryAssets: selected.map((item) => item.asset),
        aiMixedCampaign: {
          id: 'ugc-selection-' + Date.now(),
          title: selected.length + ' selected UGC videos',
          posts: selected.map(({ ad }) => ({
            id: ad.id,
            contentType: 'VIDEO' as const,
            caption: ad.caption || ad.script,
            mediaAssetId: ad.mediaAssetId!,
          })),
        },
      },
    })
  }

  if (!open) return null
  const data = overview.data
  const featured = data?.featuredAvatars || []

  return createPortal(<div className="ugc-home-backdrop">
    <section aria-label="UGC Ad Studio" aria-modal="true" className="ugc-home-panel" role="dialog">
      <header className="ugc-home-header">
        <div><span className="ugc-home-eyebrow">UGC AD STUDIO</span><h2>Your creator ads, in one place.</h2><p>Create, monitor, edit and schedule UGC without leaving INXSocial.</p></div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-xl border border-brand-amber/20 bg-brand-amber/[.06] px-3 py-2 text-[10px] text-brand-amber sm:inline-flex"><Coins className="mr-1.5 size-3.5" />{data?.credits.remaining?.toLocaleString() ?? '—'} credits</span>
          <button aria-label="Close UGC Studio" className="ugc-home-close" onClick={onClose} type="button"><X className="size-4" /></button>
        </div>
      </header>

      <div className="ugc-home-body">
        <UGCAgentHero
          featuredCreator={featured[0] || null}
          onClearCreator={() => setAgentCreator(null)}
          onManualSetup={(draft) => onCreate(undefined, draft)}
          onOpenAgent={(prompt) => openAgent(prompt || '')}
          selectedCreator={agentCreator}
        />

        <section className="ugc-home-kpis" aria-label="UGC Studio overview">
          <article className="ugc-home-kpi ready">
            <span className="ugc-home-kpi-icon"><Play className="size-4 fill-current" /></span>
            <div><strong>{data?.stats.ready ?? 0}</strong><h3>Ready videos</h3><p>Your completed UGC ads are ready to view, edit or schedule.</p></div>
          </article>
          <article className="ugc-home-kpi rendering">
            <span className="ugc-home-kpi-icon"><Clock3 className="size-4" /></span>
            <div><strong>{data?.stats.rendering ?? 0}</strong><h3>Rendering now</h3><p>Your videos are being generated. We’ll notify you when they’re ready.</p></div>
          </article>
          <article className="ugc-home-kpi creators">
            <span className="ugc-home-kpi-icon"><UsersRound className="size-4" /></span>
            <div><strong>100+</strong><h3>Featured creators</h3><p>Creator styles ready for your next campaign.</p></div>
            <div className="ugc-home-kpi-avatars" aria-hidden="true">
              {featured.slice(0,3).map((avatar) => <span key={avatar.id}><ProtectedAvatar avatar={avatar} /></span>)}
              <b>100+</b>
            </div>
          </article>
        </section>

        <section className="mt-7" id="ugc-workspace">
          <div className="ugc-home-section-head">
            <div><span>YOUR WORKSPACE</span><h3>Your UGC videos</h3><p>Generation continues here even after you leave the creation wizard.</p></div>
            <div className="ugc-home-filter">
              {(['ALL','READY','RENDERING','FAILED'] as const).map((value) => <button className={filter === value ? 'active' : ''} key={value} onClick={() => setFilter(value)} type="button">{value === 'ALL' ? 'All' : value === 'RENDERING' ? 'Rendering' : value[0] + value.slice(1).toLowerCase()}</button>)}
            </div>
          </div>
          <div className="ugc-home-selection-bar">
            <div><strong>{selectedVideos.length ? `${selectedVideos.length} video${selectedVideos.length === 1 ? '' : 's'} selected` : 'Select ready videos to publish'}</strong><span>{selectedVideos.length === 1 ? 'Schedule Now opens the normal Post composer.' : selectedVideos.length > 1 ? 'Schedule Now opens Bulk Scheduler with each video and its caption.' : 'Choose one video for a normal post, or multiple videos for bulk scheduling.'}</span></div>
            <div className="flex items-center gap-2">
              {selectedVideos.length > 0 && <button className="ugc-home-selection-clear" onClick={() => setSelectedAdIds([])} type="button">Clear</button>}
              <Button disabled={!selectedVideos.length} onClick={scheduleSelected} size="sm" variant="primary"><CalendarRange className="size-3.5" />Schedule Now{selectedVideos.length ? ` (${selectedVideos.length})` : ''}</Button>
            </div>
          </div>

          {overview.isLoading ? <div className="ugc-home-empty"><LoaderCircle className="size-7 animate-spin text-brand-cyan" /><span>Loading your UGC workspace…</span></div> :
            campaigns.length ? <div className="ugc-home-campaign-grid">{campaigns.map((campaign) => {
              const first = campaign.ads[0]
              const previewAd = campaign.ads.find((ad) => ad.qualityControl?.publishable && ad.mediaAssetId) || first
              const activeAd = campaign.ads.find((ad) => activeStatuses.has(ad.status))
              const asset = previewAd?.mediaAssetId ? assetsById.get(previewAd.mediaAssetId) : undefined
              const busy = activeStatuses.has(campaign.status) || Boolean(activeAd)
              const campaignProgress = campaign.ads.length
                ? Math.round(campaign.ads.reduce((sum, ad) => sum + Number(ad.progress || 0), 0) / campaign.ads.length)
                : 0
              const readyCampaignIds = readyVideos.filter((item) => item.campaign.id === campaign.id).map((item) => item.ad.id)
              const allCampaignReadySelected = Boolean(readyCampaignIds.length) && readyCampaignIds.every((id) => selectedAdIds.includes(id))
              return <article className={`ugc-home-campaign ${readyCampaignIds.some((id) => selectedAdIds.includes(id)) ? 'selected' : ''}`} key={campaign.id}>
                <div className="ugc-home-campaign-preview">
                  {asset?.fileUrl ? <button
                    aria-label={`Open ${campaign.title} video preview`}
                    className="group absolute inset-0 cursor-zoom-in"
                    onClick={() => setPreview({ src: asset.fileUrl!, title: campaign.title })}
                    type="button"
                  >
                    <video className="size-full object-cover" muted playsInline preload="metadata" src={asset.fileUrl} />
                    <span className="absolute inset-0 grid place-items-center bg-black/5 transition group-hover:bg-black/20"><span className="grid size-11 place-items-center rounded-full border border-white/20 bg-black/55 text-white shadow-xl backdrop-blur"><Play className="ml-0.5 size-5 fill-current" /></span></span>
                    <span className="absolute bottom-2 right-2 rounded-lg border border-white/10 bg-black/55 px-2 py-1 text-[8px] font-semibold text-white/85 backdrop-blur">Open player</span>
                  </button> :
                    <div className="absolute inset-0 grid place-items-center px-3"><div className="w-full text-center">{busy ? <LoaderCircle className="mx-auto size-7 animate-spin text-brand-cyan" /> : <Clapperboard className="mx-auto size-7 text-text-soft" />}<strong className="mt-2 block text-[9px] text-brand-cyan">{busy ? (activeAd?.stageLabel || 'Preparing render') : campaign.status}</strong><span className="mt-1 block text-[8px] text-text-muted">{busy ? `${campaignProgress}% complete${activeAd?.stageDetail ? ` · ${activeAd.stageDetail}` : ''}` : ''}</span>{busy && <div className="mx-auto mt-3 h-1.5 w-4/5 overflow-hidden rounded-full bg-white/[.07]"><span className="block h-full rounded-full bg-brand-cyan transition-[width] duration-500" style={{ width: `${Math.max(4,campaignProgress)}%` }} /></div>}</div></div>}
                  <span className="ugc-home-duration">{campaign.duration}s</span>
                  <span className={`ugc-home-status ${campaign.status.toLowerCase()}`}>{statusLabel(campaign.status)}</span>
                </div>
                <div className="ugc-home-campaign-copy">
                  <div className="flex items-start justify-between gap-2"><span className="ugc-home-meta">{campaign.resolvedType === 'PRODUCT_SHOWCASE' ? 'Product showcase' : 'Avatar explainer'} · {campaign.quality === 'PREMIUM' ? 'Premium' : 'Standard'} · {campaign.adCount} variation{campaign.adCount === 1 ? '' : 's'}</span>{readyCampaignIds.length > 0 && <label className="ugc-home-select-control"><input checked={allCampaignReadySelected} onChange={() => toggleCampaignReady(campaign)} type="checkbox" /><span>{campaign.ads.length === 1 ? 'Select' : 'Select ready'}</span></label>}</div>
                  <strong>{campaign.title}</strong>
                  <p>{first?.hook || first?.angle || 'Creator-native UGC campaign'}</p>
                  {busy && activeAd && <div className="mt-3 rounded-xl border border-brand-cyan/15 bg-brand-cyan/[.035] p-2.5"><div className="flex items-center justify-between gap-2 text-[8px]"><strong className="text-brand-cyan">{activeAd.stageLabel}</strong><span className="text-text-muted">{activeAd.progress}%</span></div><div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[.07]"><span className="block h-full rounded-full bg-brand-cyan transition-[width] duration-500" style={{ width: `${Math.max(4,activeAd.progress)}%` }} /></div>{activeAd.stageDetail && <span className="mt-1.5 block text-[8px] text-text-soft">{activeAd.stageDetail}</span>}</div>}
                  {campaign.ads.length > 1 && <div className="ugc-home-variation-list">{campaign.ads.map((ad) => {
                    const selectable = Boolean(ad.status === 'READY' && ad.mediaAssetId && ad.qualityControl?.publishable && assetsById.has(ad.mediaAssetId))
                    return <div className={selectedAdIds.includes(ad.id) ? 'selected' : ''} key={ad.id}><label className="ugc-home-variation-select"><input checked={selectedAdIds.includes(ad.id)} disabled={!selectable} onChange={() => selectable && toggleVideo(ad.id)} type="checkbox" /><span>V{ad.sequence} · {activeStatuses.has(ad.status) ? `${ad.stageLabel} · ${ad.progress}%` : statusLabel(ad.status)}</span></label><button disabled={activeStatuses.has(ad.status)} onClick={() => {
                      void loadUGCEditor().then(() => {
                        onClose()
                        navigate(`/ai-content-studio/ugc/${ad.id}/edit`)
                      })
                    }} type="button">Edit</button></div>
                  })}</div>}
                  <div className="ugc-home-actions">
                    <Button disabled={!first || activeStatuses.has(first.status)} onClick={() => {
                      if (!first) return
                      void loadUGCEditor().then(() => {
                        onClose()
                        navigate(`/ai-content-studio/ugc/${first.id}/edit`)
                      })
                    }} size="sm"><Pencil className="size-3.5" />Edit</Button>
                    <Button disabled={!readyCampaignIds.length} onClick={() => toggleCampaignReady(campaign)} size="sm" variant={allCampaignReadySelected ? 'primary' : 'secondary'}>{allCampaignReadySelected ? 'Selected' : campaign.ads.length === 1 ? 'Select video' : 'Select ready'}</Button>
                    <button aria-label="Create similar campaign" className="ugc-home-icon-action" onClick={() => startCreation(campaign)} title="Create similar" type="button"><Copy className="size-3.5" /></button>
                    <button aria-label="Delete campaign" className="ugc-home-icon-action danger" disabled={busy || remove.isPending} onClick={() => { if (window.confirm('Remove this UGC campaign from your studio?')) remove.mutate(campaign.id) }} title="Delete" type="button"><Trash2 className="size-3.5" /></button>
                  </div>
                </div>
              </article>
            })}</div> : <div className="ugc-home-empty"><Film className="size-7 text-text-soft" /><strong>No UGC campaigns yet.</strong><span>Create your first campaign and it will stay here while it renders.</span><Button onClick={() => openAgent('')} size="sm" variant="primary"><Plus className="size-3.5" />Create UGC</Button></div>}
        </section>

        <section className="mt-8">
          <div className="ugc-home-section-head"><div><span>QUALITY SHOWCASE</span><h3>See what INXSocial can create</h3><p>Approved examples from our own UGC generation tests.</p></div></div>
          {data?.samples.length ? <div className="ugc-home-samples">{data.samples.map((sample) => <SampleVideo key={sample.id} sample={sample} />)}</div> :
            <div className="ugc-home-demo-empty"><Play className="size-5 text-brand-cyan" /><div><strong>Demo library ready.</strong><p>Approved test renders uploaded to your UGC sample storage will appear here automatically.</p></div></div>}
        </section>

        <section className="mt-8">
          <div className="ugc-home-section-head"><div><span>CREATOR LIBRARY</span><h3>Realistic reusable creators</h3><p>Choose a creator to start an ad with them, or let the UGC Agent cast automatically.</p></div><span className="text-[9px] text-text-soft">100+ featured</span></div>
          <div className="ugc-home-creators">{featured.slice(0, 100).map((avatar) => <button aria-label={`Create a UGC ad with ${avatar.name}`} className={`ugc-home-creator ${agentCreator?.id === avatar.id ? 'selected' : ''}`} key={avatar.id} onClick={() => setCreatorChoice(avatar)} type="button"><div className="aspect-[4/5] overflow-hidden rounded-[15px]"><ProtectedAvatar avatar={avatar} /></div><strong>{avatar.name}</strong><span>{avatar.category} · {avatar.ageBand}</span><em>{agentCreator?.id === avatar.id ? 'Selected' : 'Use creator'}</em></button>)}</div>
        </section>
      </div>
    </section>
    {creatorChoice && <div className="ugc-creator-choice-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreatorChoice(null) }} role="presentation">
      <section aria-label={`Use ${creatorChoice.name} for a UGC ad`} aria-modal="true" className="ugc-creator-choice" role="dialog">
        <button aria-label="Close creator selection" className="ugc-creator-choice-close" onClick={() => setCreatorChoice(null)} type="button"><X className="size-4" /></button>
        <div className="ugc-creator-choice-image"><ProtectedAvatar avatar={creatorChoice} /></div>
        <span className="ugc-home-eyebrow">FEATURED CREATOR</span>
        <h3>Create an ad with {creatorChoice.name}?</h3>
        <p>{creatorChoice.category} · {creatorChoice.ageBand} · {creatorChoice.locale}. The UGC Agent will keep this creator selected while it plans your ad.</p>
        <div className="ugc-creator-choice-actions">
          <Button onClick={() => setCreatorChoice(null)} size="sm" variant="secondary">Cancel</Button>
          <Button onClick={() => {
            const creator = creatorChoice
            setAgentCreator(creator)
            setCreatorChoice(null)
            openAgent(`I want to create a UGC ad using ${creator.name} as the creator.`)
          }} size="sm" variant="primary"><Sparkles className="size-3.5" />Create an ad with {creatorChoice.name}</Button>
        </div>
      </section>
    </div>}
    {agentOpen && <UGCAgentModal
      avatars={featured}
      initialPrompt={agentInitialPrompt}
      key={agentSessionKey}
      onCampaignCreated={() => {
        void queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
        window.requestAnimationFrame(() => document.getElementById('ugc-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      }}
      onClose={() => setAgentOpen(false)}
      onCreatorChange={setAgentCreator}
      onManualSetup={(draft) => { setAgentOpen(false); onCreate(undefined, draft) }}
      onToast={onToast}
      selectedCreator={agentCreator}
    />}
    <UGCVideoLightbox onClose={() => setPreview(null)} open={Boolean(preview)} src={preview?.src || null} title={preview?.title} />
  </div>, document.body)
}
