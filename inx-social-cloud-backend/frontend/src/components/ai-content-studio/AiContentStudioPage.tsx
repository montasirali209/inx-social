import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarRange, History, Megaphone, Send, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  deleteAIDraft,
  duplicateAIDraft,
  getAIStudioAccess,
  getGenerationHistory,
  getRecentAIDrafts,
  saveAIDraft,
  saveGeneratedAssets,
  sendDraftToPosts,
} from '../../lib/ai-content-studio-api'
import type { AIDraft, AIContentType, AIPostCampaign, AIPlanAccess, GenerationHistoryItem } from '../../types/ai-content-studio'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Drawer } from '../billing/BillingPrimitives'
import {
  AIStudioHero,
  AIStudioHeroSkeleton,
  CarouselPostCard,
  CreditsCard,
  GenerationHistoryDrawer,
  ImagePostCard,
  LockedPlanState,
  RecentDrafts,
  ShortVideoCard,
  StudioSectionHeading,
  StudioToast,
  UGCAdCard,
  UpgradeToPlusModal,
} from './AIStudioPrimitives'
import { GenerationModalRouter } from './GenerationModalRouter'
import { AiPostCampaignModal } from './AiPostCampaignModal'
import { fetchMediaLibrary } from '../../lib/media-library-api'

const immediateAiAccess: AIPlanAccess = {
  plan: 'trial',
  studioEnabled: false,
  creditsRemaining: null,
  creditsLimit: null,
  unlimitedCredits: false,
  creditsConfigured: false,
  commercialUse: false,
  priorityProcessing: false,
}

export function AiContentStudioPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const requestedVideoKind = searchParams.get('videoStudio') === 'stock' ? 'stock' : searchParams.get('videoStudio') === 'generative' ? 'generative' : null
  const requestedGenerationId = searchParams.get('generation')
  const [activeType, setActiveType] = useState<AIContentType | null>(() => requestedVideoKind ? 'short_video' : null)
  const [editingDraft, setEditingDraft] = useState<AIDraft | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [campaignOpen, setCampaignOpen] = useState(false)

  const accessQuery = useQuery({
    queryKey: ['ai-studio-access'],
    queryFn: getAIStudioAccess,
    staleTime: 30_000,
  })
  const draftsQuery = useQuery({
    queryKey: ['ai-studio-drafts'],
    queryFn: getRecentAIDrafts,
    staleTime: 5_000,
  })
  const historyQuery = useQuery({
    queryKey: ['ai-studio-history'],
    queryFn: () => getGenerationHistory(),
    staleTime: 5_000,
    enabled: historyOpen,
  })

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const access = accessQuery.data
  const drafts = draftsQuery.data || []

  function openCreator(type: AIContentType) {
    if (!access) {
      setToast('Account access is still being checked. Try again in a moment.')
      return
    }
    if (!access.studioEnabled) {
      setUpgradeOpen(true)
      return
    }
    setEditingDraft(null)
    setActiveType(type)
  }

  function openDraft(draft: AIDraft) {
    if (!access) {
      setToast('Account access is still being checked. Try again in a moment.')
      return
    }
    if (!access.studioEnabled) {
      setUpgradeOpen(true)
      return
    }
    setEditingDraft(draft)
    setActiveType(draft.contentType)
    setDraftsOpen(false)
  }

  async function refreshStudio() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ai-studio-access'] }),
      queryClient.invalidateQueries({ queryKey: ['ai-studio-drafts'] }),
      queryClient.invalidateQueries({ queryKey: ['ai-studio-history'] }),
      queryClient.invalidateQueries({ queryKey: ['studio-overview'] }),
    ])
  }

  async function onDraftSaved(draft: AIDraft) {
    queryClient.setQueryData<AIDraft[]>(['ai-studio-drafts'], (current = []) => [draft, ...current.filter((item) => item.id !== draft.id)].slice(0, 8))
    await refreshStudio()
  }

  async function prepareDraftForPosts(draft: AIDraft) {
    let prepared = draft
    const hasStoredMedia = Boolean(draft.mediaLibraryAsset || draft.mediaLibraryAssets?.length)
    if (!hasStoredMedia && draft.asset) {
      const stored = await saveGeneratedAssets(draft.asset)
      prepared = { ...draft, mediaLibraryAsset: stored[0] || null, mediaLibraryAssets: stored, updatedAt: new Date().toISOString() }
      prepared = await saveAIDraft(prepared)
    }
    prepared = await sendDraftToPosts(prepared)
    return prepared
  }

  async function continueToPosts(draft: AIDraft) {
    try {
      const prepared = await prepareDraftForPosts(draft)
      setActiveType(null)
      setEditingDraft(null)
      navigate('/posts', { state: { aiDraft: prepared } })
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'The AI draft could not be prepared for Posts.')
    }
  }

  function campaignCaption(post: AIPostCampaign['posts'][number]) {
    const hashtags = post.hashtags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')
    return [post.caption.trim(), hashtags].filter(Boolean).join('\n\n')
  }

  async function handoffCampaign(campaign: AIPostCampaign) {
    try {
      const captions = campaign.posts.map(campaignCaption)

      if (campaign.contentMode === 'TEXT') {
        setCampaignOpen(false)
        navigate('/bulk-scheduler', {
          state: {
            aiPostCampaign: {
              id: campaign.id,
              title: campaign.title,
              contentMode: 'TEXT',
              captions,
              mediaAssetIds: [],
            },
          },
        })
        return
      }

      const imagePosts = campaign.posts.filter((post) => post.contentType === 'IMAGE')
      const ids = imagePosts.map((post) => post.mediaAssetId).filter((id): id is string => Boolean(id))
      if (ids.length !== imagePosts.length) throw new Error('Create the remaining campaign images before sending the full campaign to Bulk Scheduler.')

      const library = await fetchMediaLibrary()
      const assets = ids
        .map((id) => library.assets.find((asset) => asset.id === id))
        .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))
      if (assets.length !== ids.length) throw new Error('One or more campaign images could not be found in Media Library.')

      setCampaignOpen(false)

      if (campaign.contentMode === 'IMAGE') {
        navigate('/bulk-scheduler', {
          state: {
            mediaLibraryAssets: assets,
            aiCampaignCaptions: captions,
            aiCampaignTitle: campaign.title,
          },
        })
        return
      }

      navigate('/bulk-scheduler', {
        state: {
          mediaLibraryAssets: assets,
          aiMixedCampaign: {
            id: campaign.id,
            title: campaign.title,
            posts: campaign.posts.map((post) => ({
              id: post.id,
              contentType: post.contentType,
              caption: campaignCaption(post),
              mediaAssetId: post.mediaAssetId || null,
            })),
          },
        },
      })
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'The campaign could not be prepared for Bulk Scheduler.')
    }
  }

  async function duplicateDraft(draft: AIDraft) {
    try {
      const copy = await duplicateAIDraft(draft)
      queryClient.setQueryData<AIDraft[]>(['ai-studio-drafts'], (current = []) => [copy, ...current])
      setToast('AI draft duplicated.')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'The AI draft could not be duplicated.')
    }
  }

  async function removeDraft(draft: AIDraft) {
    try {
      await deleteAIDraft(draft.id)
      queryClient.setQueryData<AIDraft[]>(['ai-studio-drafts'], (current = []) => current.filter((item) => item.id !== draft.id))
      setToast('AI draft deleted.')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'The AI draft could not be deleted.')
    }
  }

  if (access && !access.studioEnabled) {
    return <>
      <LockedPlanState onUpgrade={() => setUpgradeOpen(true)} />
      <UpgradeToPlusModal onClose={() => setUpgradeOpen(false)} open={upgradeOpen} />
    </>
  }

  return <>
    {access ? <AIStudioHero access={access} /> : <AIStudioHeroSkeleton />}
    {accessQuery.isError && <Card className="mt-4 flex flex-col gap-3 border-brand-red/25 p-4 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs text-text-muted">{accessQuery.error instanceof Error ? accessQuery.error.message : 'AI account access could not refresh.'}</span><Button onClick={() => void accessQuery.refetch()} size="sm">Retry account access</Button></Card>}

    <section className="mt-6">
      <StudioSectionHeading action={<Button onClick={() => setHistoryOpen(true)} size="sm"><History className="size-3.5" />Generation history</Button>} text="Choose a workflow below. Each creator is optimised for one social post format." title="What do you want to create?" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ImagePostCard enabled={access?.studioEnabled ?? true} onCreate={openCreator} />
        <CarouselPostCard enabled={access?.studioEnabled ?? true} onCreate={openCreator} />
        <ShortVideoCard enabled={access?.studioEnabled ?? true} onCreate={openCreator} />
        <UGCAdCard enabled={access?.studioEnabled ?? true} onCreate={openCreator} />
      </div>
    </section>

    <section className="mt-4">
      <Card className="relative overflow-hidden border-brand-cyan/20 p-0">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(45,212,191,.12),transparent_35%),radial-gradient(circle_at_90%_90%,rgba(124,58,237,.10),transparent_34%)]" />
        <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><Megaphone className="size-5" /></span>
            <div className="min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-[.15em] text-brand-cyan">AI Post Campaign</span>
              <h2 className="mt-1 text-base font-semibold sm:text-lg">Turn one campaign idea into 10–30 review-ready posts.</h2>
              <p className="mt-1 max-w-3xl text-[11px] leading-5 text-text-muted">Add your goal and optional website. INXSocial analyses the context, creates content pillars, writes the campaign, lets you edit or regenerate every post, then hands the approved batch to Bulk Scheduler.</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[9px] text-text-soft"><span className="inline-flex items-center gap-1"><Sparkles className="size-3" />Strategy + copy</span><span className="inline-flex items-center gap-1"><CalendarRange className="size-3" />Bulk Scheduler handoff</span><span>Optional AI images after review</span></div>
            </div>
          </div>
          <Button className="shrink-0" onClick={() => setCampaignOpen(true)} size="sm" variant="primary"><Megaphone className="size-3.5" />Create campaign</Button>
        </div>
      </Card>
    </section>

    <section className="mt-4 min-w-0">
      <RecentDrafts drafts={drafts} onDelete={(draft) => void removeDraft(draft)} onDuplicate={(draft) => void duplicateDraft(draft)} onOpen={openDraft} onSend={(draft) => void continueToPosts(draft)} onViewAll={() => setDraftsOpen(true)} />
    </section>

    <section className="mt-4">
      <CreditsCard topUpsSupported={false} />
    </section>

    <AiPostCampaignModal onClose={() => setCampaignOpen(false)} onHandoff={(campaign) => void handoffCampaign(campaign)} onToast={setToast} open={campaignOpen} />
    <GenerationModalRouter access={access || immediateAiAccess} initialDraft={editingDraft} initialGenerationId={requestedGenerationId} initialVideoKind={requestedVideoKind} onClose={() => { setActiveType(null); setEditingDraft(null); if (requestedVideoKind || requestedGenerationId) setSearchParams({}, { replace: true }) }} onContinue={(draft) => void continueToPosts(draft)} onSaved={(draft) => void onDraftSaved(draft)} onToast={setToast} open={Boolean(activeType && access)} type={activeType} />
    <UpgradeToPlusModal onClose={() => setUpgradeOpen(false)} open={upgradeOpen} />
    <GenerationHistoryDrawer history={(historyQuery.data || []) as GenerationHistoryItem[]} onClose={() => setHistoryOpen(false)} open={historyOpen} />
    <Drawer onClose={() => setDraftsOpen(false)} open={draftsOpen} title="AI Content Studio drafts">
      <div className="space-y-3">{drafts.length ? drafts.map((draft) => <article className="rounded-2xl border border-border-soft bg-bg/35 p-4" key={draft.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="text-[9px] font-bold uppercase tracking-[.15em] text-text-soft">{draft.contentType.replaceAll('_', ' ')}</span><h3 className="mt-1 truncate text-sm font-semibold">{draft.title}</h3><p className="mt-1 text-[10px] text-text-muted">Edited {new Date(draft.updatedAt).toLocaleString()}</p></div><span className="rounded-full border border-brand-green/20 bg-brand-green/10 px-2 py-1 text-[9px] font-semibold text-brand-green">{draft.status}</span></div><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => openDraft(draft)} size="sm">Open</Button><Button onClick={() => void continueToPosts(draft)} size="sm" variant="primary"><Send className="size-3.5" />Send to Posts</Button><Button onClick={() => void duplicateDraft(draft)} size="sm">Duplicate</Button><Button onClick={() => void removeDraft(draft)} size="sm" variant="ghost">Delete</Button></div></article>) : <div className="rounded-2xl border border-dashed border-border-soft p-6 text-center text-xs text-text-muted">No AI drafts yet.</div>}</div>
    </Drawer>
    <StudioToast message={toast} onClose={() => setToast(null)} />
  </>
}
