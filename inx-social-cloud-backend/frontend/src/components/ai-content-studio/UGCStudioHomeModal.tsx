import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight, CalendarRange, CheckCircle2, Clapperboard, Clock3, Coins, Copy, Film,
  LoaderCircle, Pencil, Play, Plus, Sparkles, Trash2, UsersRound, X,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchMediaLibrary } from '../../lib/media-library-api'
import {
  deleteUGCCampaign,
  fetchUGCAvatarImage,
  fetchUGCSampleVideo,
  getUGCOverview,
} from '../../lib/ugc-studio-api'
import type { MediaAsset } from '../../types/media-library'
import type { UGCAvatar, UGCCampaign, UGCSampleVideo } from '../../types/ugc-studio'
import { Button } from '../ui/Button'
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
  onCreate: (seed?: UGCCampaign) => void
  onToast: (message: string) => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const previousReady = useRef<Set<string>>(new Set())
  const [filter, setFilter] = useState<'ALL' | 'READY' | 'RENDERING' | 'FAILED'>('ALL')

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

  function scheduleCampaign(campaign: UGCCampaign) {
    const ready = campaign.ads
      .filter((ad) => ad.status === 'READY' && ad.mediaAssetId)
      .map((ad) => ({ ad, asset: assetsById.get(ad.mediaAssetId!) }))
      .filter((item): item is { ad: typeof campaign.ads[number]; asset: MediaAsset } => Boolean(item.asset))
    if (!ready.length) { onToast('No finished UGC videos are available to schedule yet.'); return }
    onClose()
    navigate('/bulk-scheduler', {
      state: {
        mediaLibraryAssets: ready.map((item) => item.asset),
        aiMixedCampaign: {
          id: campaign.id,
          title: campaign.title,
          posts: ready.map(({ ad }) => ({ id: ad.id, contentType: 'IMAGE' as const, caption: ad.caption || ad.script, mediaAssetId: ad.mediaAssetId! })),
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
        <section className="ugc-home-hero">
          <div className="relative z-10 max-w-2xl">
            <span className="ugc-home-kicker"><Sparkles className="size-3.5" />CREATOR CAMPAIGNS</span>
            <h1>Turn an offer into believable social video.</h1>
            <p>Use a website, product photos or a short brief. INXSocial builds the creative direction, creator, script, scenes and final 720p UGC for you.</p>
            <Button className="mt-5 min-h-11 px-5" onClick={() => onCreate()} variant="primary"><Plus className="size-4" />Create new UGC ad <ArrowRight className="size-4" /></Button>
          </div>
          <div aria-hidden="true" className="ugc-home-hero-stack">
            <div className="ugc-home-phone ugc-home-phone-a"><UsersRound className="size-8" /><span>Avatar</span></div>
            <div className="ugc-home-phone ugc-home-phone-b"><Play className="size-8" /><span>Product</span></div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="ugc-home-stat"><CheckCircle2 className="size-4 text-brand-green" /><div><strong>{data?.stats.ready ?? 0}</strong><span>Ready videos</span></div></div>
          <div className="ugc-home-stat"><Clock3 className="size-4 text-brand-cyan" /><div><strong>{data?.stats.rendering ?? 0}</strong><span>Rendering now</span></div></div>
          <div className="ugc-home-stat"><UsersRound className="size-4 text-[#c4b5fd]" /><div><strong>{data?.options.featuredAvatarCount ?? featured.length}</strong><span>Featured creators</span></div></div>
        </section>

        <section className="mt-7">
          <div className="ugc-home-section-head">
            <div><span>YOUR WORKSPACE</span><h3>Your UGC videos</h3><p>Generation continues here even after you leave the creation wizard.</p></div>
            <div className="ugc-home-filter">
              {(['ALL','READY','RENDERING','FAILED'] as const).map((value) => <button className={filter === value ? 'active' : ''} key={value} onClick={() => setFilter(value)} type="button">{value === 'ALL' ? 'All' : value === 'RENDERING' ? 'Rendering' : value[0] + value.slice(1).toLowerCase()}</button>)}
            </div>
          </div>

          {overview.isLoading ? <div className="ugc-home-empty"><LoaderCircle className="size-7 animate-spin text-brand-cyan" /><span>Loading your UGC workspace…</span></div> :
            campaigns.length ? <div className="ugc-home-campaign-grid">{campaigns.map((campaign) => {
              const first = campaign.ads[0]
              const asset = first?.mediaAssetId ? assetsById.get(first.mediaAssetId) : undefined
              const busy = activeStatuses.has(campaign.status)
              return <article className="ugc-home-campaign" key={campaign.id}>
                <div className="ugc-home-campaign-preview">
                  {asset?.fileUrl ? <video className="size-full object-cover" controls playsInline preload="metadata" src={asset.fileUrl} /> :
                    <div className="absolute inset-0 grid place-items-center"><div className="text-center">{busy ? <LoaderCircle className="mx-auto size-7 animate-spin text-brand-cyan" /> : <Clapperboard className="mx-auto size-7 text-text-soft" />}<span className="mt-2 block text-[9px] text-text-muted">{busy ? 'Rendering in background…' : campaign.status}</span></div></div>}
                  <span className="ugc-home-duration">{campaign.duration}s</span>
                  <span className={`ugc-home-status ${campaign.status.toLowerCase()}`}>{statusLabel(campaign.status)}</span>
                </div>
                <div className="ugc-home-campaign-copy">
                  <span className="ugc-home-meta">{campaign.resolvedType === 'PRODUCT_SHOWCASE' ? 'Product showcase' : 'Avatar explainer'} · {campaign.quality === 'PREMIUM' ? 'Premium' : 'Standard'} · {campaign.adCount} variation{campaign.adCount === 1 ? '' : 's'}</span>
                  <strong>{campaign.title}</strong>
                  <p>{first?.hook || first?.angle || 'Creator-native UGC campaign'}</p>
                  {campaign.ads.length > 1 && <div className="ugc-home-variation-list">{campaign.ads.map((ad) => <div key={ad.id}><span>V{ad.sequence} · {statusLabel(ad.status)}</span><button disabled={activeStatuses.has(ad.status)} onClick={() => { onClose(); navigate(`/ai-content-studio/ugc/${ad.id}/edit`) }} type="button">Edit</button></div>)}</div>}
                  <div className="ugc-home-actions">
                    <Button disabled={!first || activeStatuses.has(first.status)} onClick={() => { onClose(); navigate(`/ai-content-studio/ugc/${first.id}/edit`) }} size="sm"><Pencil className="size-3.5" />Edit</Button>
                    <Button disabled={!campaign.ads.some((ad) => ad.status === 'READY')} onClick={() => scheduleCampaign(campaign)} size="sm" variant="primary"><CalendarRange className="size-3.5" />Schedule</Button>
                    <button aria-label="Create similar campaign" className="ugc-home-icon-action" onClick={() => onCreate(campaign)} title="Create similar" type="button"><Copy className="size-3.5" /></button>
                    <button aria-label="Delete campaign" className="ugc-home-icon-action danger" disabled={busy || remove.isPending} onClick={() => { if (window.confirm('Remove this UGC campaign from your studio?')) remove.mutate(campaign.id) }} title="Delete" type="button"><Trash2 className="size-3.5" /></button>
                  </div>
                </div>
              </article>
            })}</div> : <div className="ugc-home-empty"><Film className="size-7 text-text-soft" /><strong>No UGC campaigns yet.</strong><span>Create your first campaign and it will stay here while it renders.</span><Button onClick={() => onCreate()} size="sm" variant="primary"><Plus className="size-3.5" />Create UGC</Button></div>}
        </section>

        <section className="mt-8">
          <div className="ugc-home-section-head"><div><span>QUALITY SHOWCASE</span><h3>See what INXSocial can create</h3><p>Approved examples from our own UGC generation tests.</p></div></div>
          {data?.samples.length ? <div className="ugc-home-samples">{data.samples.map((sample) => <SampleVideo key={sample.id} sample={sample} />)}</div> :
            <div className="ugc-home-demo-empty"><Play className="size-5 text-brand-cyan" /><div><strong>Demo library ready.</strong><p>Approved test renders uploaded to your UGC sample storage will appear here automatically.</p></div></div>}
        </section>

        <section className="mt-8">
          <div className="ugc-home-section-head"><div><span>CREATOR LIBRARY</span><h3>Realistic reusable creators</h3><p>Featured creators are prepared once, then reused without an extra avatar-generation charge.</p></div><span className="text-[9px] text-text-soft">{featured.length} featured</span></div>
          <div className="ugc-home-creators">{featured.slice(0, 20).map((avatar) => <article className="ugc-home-creator" key={avatar.id}><div className="aspect-[4/5] overflow-hidden rounded-[15px]"><ProtectedAvatar avatar={avatar} /></div><strong>{avatar.name}</strong><span>{avatar.category} · {avatar.ageBand}</span></article>)}</div>
        </section>
      </div>
    </section>
  </div>, document.body)
}
