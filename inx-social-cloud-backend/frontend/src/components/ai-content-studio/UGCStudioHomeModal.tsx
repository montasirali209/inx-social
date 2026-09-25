import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowRight, CalendarRange, Clapperboard, Clock3, Coins, Copy, Download, Film,
  LoaderCircle, Pencil, Play, Plus, Trash2, UsersRound, X,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadUGCEditor } from '../../route-preload'
import { downloadMediaAsset, fetchMediaLibrary } from '../../lib/media-library-api'
import { deleteAIDraft, getRecentAIDrafts } from '../../lib/ai-content-studio-api'
import {
  deleteUGCCampaign,
  getUGCOverview,
  trackUGCStudioEvent,
} from '../../lib/ugc-studio-api'
import type { MediaAsset } from '../../types/media-library'
import type { UGCBrandProfile, UGCCampaign, UGCWizardDraftSeed } from '../../types/ugc-studio'
import { Button } from '../ui/Button'
import { UGCAgentHero } from './UGCAgentHero'
import { UGCVideoLightbox } from './UGCVideoPlayer'
import './ugc-studio-home.css'

const activeStatuses = new Set(['RESERVING', 'QUEUED', 'RENDERING', 'PLANNING'])

function CampaignPreviewMedia({ asset }: { asset: MediaAsset }) {
  const [ready, setReady] = useState(false)
  useEffect(() => { setReady(false) }, [asset.fileUrl])
  return <div className="ugc-home-live-preview" aria-hidden="true">
    <video
      className={ready ? 'ready' : ''}
      muted
      onError={() => setReady(false)}
      onLoadedData={() => setReady(true)}
      playsInline
      preload="auto"
      src={asset.fileUrl}
    />
    {!ready && <span className="ugc-home-live-preview-loading"><LoaderCircle className="size-5 animate-spin text-brand-cyan" /></span>}
  </div>
}

function firstBrandReferenceUrl(brands: UGCBrandProfile[]) {
  for (const brand of brands) {
    for (const reference of brand.brandReferences || []) {
      const value = typeof reference === 'string' ? reference : reference?.url
      if (value && /^https?:\/\//i.test(value)) return value
    }
  }
  return null
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
  onCreate: (seed?: UGCCampaign, draft?: UGCWizardDraftSeed) => void
  onToast: (message: string) => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const previousReady = useRef<Set<string>>(new Set())
  const [filter, setFilter] = useState<'ALL' | 'READY' | 'RENDERING' | 'FAILED'>('ALL')
  const [selectedAdIds, setSelectedAdIds] = useState<string[]>([])
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const workspaceRef = useRef<HTMLElement | null>(null)
  const [workspaceColumns, setWorkspaceColumns] = useState(3)
  const [workspaceOffset, setWorkspaceOffset] = useState(0)

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
  const drafts = useQuery({
    queryKey: ['ugc-drafts'],
    queryFn: getRecentAIDrafts,
    enabled: open,
    staleTime: 2_000,
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
    const bodyOverscroll = document.body.style.overscrollBehavior
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    return () => {
      document.body.style.overflow = bodyOverflow
      document.body.style.overscrollBehavior = bodyOverscroll
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

  const removeDraft = useMutation({
    mutationFn: deleteAIDraft,
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['ugc-drafts'] }) },
    onError: (error) => onToast(error instanceof Error ? error.message : 'Draft could not be removed.'),
  })

  const assetsById = useMemo(() => new Map((media.data?.assets || []).map((asset) => [asset.id, asset])), [media.data])
  const campaigns = useMemo(() => {
    const source = overview.data?.campaigns || []
    if (filter === 'ALL') return source
    if (filter === 'READY') return source.filter((campaign) => campaign.ads.some((ad) => ad.status === 'READY'))
    if (filter === 'FAILED') return source.filter((campaign) => campaign.status === 'FAILED' || campaign.ads.some((ad) => ad.status === 'FAILED'))
    return source.filter((campaign) => activeStatuses.has(campaign.status) || campaign.ads.some((ad) => activeStatuses.has(ad.status)))
  }, [overview.data?.campaigns, filter])

  const campaignRows = useMemo(() => {
    const rows: UGCCampaign[][] = []
    for (let index = 0; index < campaigns.length; index += workspaceColumns) {
      rows.push(campaigns.slice(index, index + workspaceColumns))
    }
    return rows
  }, [campaigns, workspaceColumns])

  const ugcDrafts = useMemo(() => (drafts.data || []).filter((draft) => {
    const asset = draft.asset as unknown as { kind?: string } | null
    return draft.contentType === 'ugc_ad' && asset?.kind === 'ugc_wizard'
  }), [drafts.data])

  useEffect(() => {
    if (!open) return
    const body = bodyRef.current
    if (!body) return
    const update = () => {
      const width = body.clientWidth
      setWorkspaceColumns(width < 760 ? 1 : width < 1180 ? 2 : 3)
      setWorkspaceOffset(workspaceRef.current?.offsetTop || 0)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(body)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [open, ugcDrafts.length, overview.isLoading])

  const rowVirtualizer = useVirtualizer({
    count: campaignRows.length,
    getScrollElement: () => bodyRef.current,
    estimateSize: () => 196,
    gap: 13,
    overscan: 2,
    scrollMargin: workspaceOffset,
  })

  useEffect(() => {
    rowVirtualizer.measure()
  }, [rowVirtualizer, workspaceColumns, filter])

  function resumeDraft(draft: (typeof ugcDrafts)[number]) {
    const asset = (draft.asset || {}) as unknown as UGCWizardDraftSeed
    onCreate(undefined, { ...asset, draftId: draft.id })
  }

  const readyVideos = useMemo(() => (overview.data?.campaigns || []).flatMap((campaign) =>
    campaign.ads
      .filter((ad) => ad.status === 'READY' && ad.mediaAssetId && ad.qualityControl?.publishable)
      .map((ad) => ({ campaign, ad, asset: assetsById.get(ad.mediaAssetId!) }))
      .filter((item): item is { campaign: UGCCampaign; ad: UGCCampaign['ads'][number]; asset: MediaAsset } => Boolean(item.asset))
  ), [assetsById, overview.data?.campaigns])

  const selectedVideos = useMemo(() => readyVideos.filter((item) => selectedAdIds.includes(item.ad.id)), [readyVideos, selectedAdIds])

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

  function renderCampaignCard(campaign: UGCCampaign) {
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
                    <CampaignPreviewMedia asset={asset} />
                    <span className="absolute inset-0 grid place-items-center bg-black/10 transition group-hover:bg-black/20"><span className="grid size-11 place-items-center rounded-full border border-white/20 bg-black/70 text-white shadow-lg"><Play className="ml-0.5 size-5 fill-current" /></span></span>
                    <span className="absolute bottom-2 right-2 rounded-lg border border-white/10 bg-black/70 px-2 py-1 text-[8px] font-semibold text-white/85">Open player</span>
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
                    const variationAsset = ad.mediaAssetId ? assetcampaigns.length ? <div className="ugc-home-campaign-virtual" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => <div
                className="ugc-home-campaign-row"
                data-index={virtualRow.index}
                key={virtualRow.key}
                ref={rowVirtualizer.measureElement}
                style={{
                  gridTemplateColumns: `repeat(${workspaceColumns}, minmax(0, 1fr))`,
                  transform: `translateY(${virtualRow.start - workspaceOffset}px)`,
                }}
              >{campaignRows[virtualRow.index]?.map(renderCampaignCard)}</div>)}
            </div> : <div className="ugc-home-empty">((campaign) => {
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
                    {asset.thumbnailUrl ? <img alt="" className="size-full object-cover" loading="lazy" src={asset.thumbnailUrl} /> : <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(45,212,191,.16),transparent_9rem),#06131d]" />}
                    <span className="absolute inset-0 grid place-items-center bg-black/10 transition group-hover:bg-black/20"><span className="grid size-11 place-items-center rounded-full border border-white/20 bg-black/70 text-white shadow-lg"><Play className="ml-0.5 size-5 fill-current" /></span></span>
                    <span className="absolute bottom-2 right-2 rounded-lg border border-white/10 bg-black/70 px-2 py-1 text-[8px] font-semibold text-white/85">Open player</span>
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
                    const variationAsset = ad.mediaAssetId ? assetsById.get(ad.mediaAssetId) : undefined
                    return <div className={selectedAdIds.includes(ad.id) ? 'selected' : ''} key={ad.id}><label className="ugc-home-variation-select"><input checked={selectedAdIds.includes(ad.id)} disabled={!selectable} onChange={() => selectable && toggleVideo(ad.id)} type="checkbox" /><span>V{ad.sequence} · {activeStatuses.has(ad.status) ? `${ad.stageLabel} · ${ad.progress}%` : statusLabel(ad.status)}</span></label><span className="ugc-home-variation-actions">{variationAsset && ad.status === 'READY' && <button aria-label={`Download variation ${ad.sequence}`} onClick={() => void downloadMediaAsset(variationAsset).catch((error) => onToast(error instanceof Error ? error.message : 'Download failed.'))} title="Download" type="button"><Download className="size-3" /></button>}<button disabled={activeStatuses.has(ad.status)} onClick={() => {
                      void loadUGCEditor().then(() => {
                        onClose()
                        navigate(`/ai-content-studio/ugc/${ad.id}/edit`)
                      })
                    }} type="button">Edit</button></span></div>
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
                    {asset && previewAd?.status === 'READY' && <button aria-label="Download video" className="ugc-home-icon-action" onClick={() => void downloadMediaAsset(asset).catch((error) => onToast(error instanceof Error ? error.message : 'Download failed.'))} title="Download" type="button"><Download className="size-3.5" /></button>}
                    <button aria-label="Create similar campaign" className="ugc-home-icon-action" onClick={() => startCreation(campaign)} title="Create similar" type="button"><Copy className="size-3.5" /></button>
                    <button aria-label="Delete campaign" className="ugc-home-icon-action danger" disabled={busy || remove.isPending} onClick={() => { if (window.confirm('Remove this UGC campaign from your studio?')) remove.mutate(campaign.id) }} title="Delete" type="button"><Trash2 className="size-3.5" /></button>
                  </div>
                </div>
              </article>
            })}</div> : <div className="ugc-home-empty"><Film className="size-7 text-text-soft" /><strong>No UGC campaigns yet.</strong><span>Create your first campaign and it will stay here while it renders.</span><Button onClick={() => onCreate()} size="sm" variant="primary"><Plus className="size-3.5" />Create UGC</Button></div>}
        </section>



      </div>
    </section>
    <UGCVideoLightbox onClose={() => setPreview(null)} open={Boolean(preview)} src={preview?.src || null} title={preview?.title} />
  </div>, document.body)
}
