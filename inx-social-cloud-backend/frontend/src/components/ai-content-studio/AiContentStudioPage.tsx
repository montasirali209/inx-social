import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CalendarRange, FileText, History, Image as ImageIcon, Layers3, Megaphone, Send, Sparkles } from 'lucide-react'
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
  const requestedCampaign = searchParams.get('campaign') === 'new'
  const [activeType, setActiveType] = useState<AIContentType | null>(() => requestedVideoKind ? 'short_video' : null)
  const [editingDraft, setEditingDraft] = useState<AIDraft | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [campaignOpen, setCampaignOpen] = useState(requestedCampaign)

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
    if (type === 'ugc_ad') {
      navigate('/ai-content-studio/ugc')
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

  async function handoffCampaign(campaign: AIPostCampaign) {
    try {
      const imagePosts = campaign.posts.filter((post) => post.contentType === 'IMAGE')
      const missingImages = imagePosts.filter((post) => !post.mediaAssetId)
      if (missingImages.length) {
        throw new Error(`Create the remaining ${missingImages.length} campaign image${missingImages.length === 1 ? '' : 's'} before sending this campaign to Bulk Scheduler.`)
      }
      setCampaignOpen(false)
      navigate('/bulk-scheduler', { state: { aiCampaignId: campaign.id } })
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
      <Card className="ai-campaign-3d-card group relative overflow-hidden border-brand-cyan/25 bg-[radial-gradient(circle_at_82%_12%,rgba(45,212,191,.16),transparent_17rem),radial-gradient(circle_at_95%_85%,rgba(124,58,237,.13),transparent_19rem),linear-gradient(145deg,rgba(5,39,47,.96),rgba(7,21,39,.98))] p-0 transition duration-500 hover:border-brand-cyan/45">
        <div aria-hidden="true" className="ai-campaign-glow-drift absolute -right-16 -top-24 size-72 rounded-full bg-brand-cyan/[.08] blur-3xl" />
        <div aria-hidden="true" className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

        <div className="relative grid min-h-[205px] gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,.55fr)] lg:items-center">
          <div className="flex min-w-0 items-start gap-4">
            <span className="ai-campaign-soft-float grid size-12 shrink-0 place-items-center rounded-2xl border border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan shadow-[0_16px_38px_rgba(45,212,191,.13)]"><Megaphone className="size-5" /></span>
            <div className="min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-[.17em] text-brand-cyan">AI Post Campaign</span>
              <h2 className="mt-2 text-lg font-semibold tracking-tight sm:text-xl">Turn one campaign idea into 10–30 smart social posts.</h2>
              <p className="mt-2 max-w-3xl text-[11px] leading-5 text-text-muted">AI researches the brief, maps hooks and content pillars, then creates text-only, image-only or mixed campaigns ready for review and Bulk Scheduler.</p>
              <div className="mt-4 flex flex-wrap gap-2 text-[9px] text-text-soft">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/15 px-2.5 py-1"><FileText className="size-3 text-brand-cyan" />Text posts</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/15 px-2.5 py-1"><ImageIcon className="size-3 text-[#c4b5fd]" />Image posts</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/15 px-2.5 py-1"><Layers3 className="size-3 text-brand-green" />Mixed campaigns</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/15 px-2.5 py-1"><CalendarRange className="size-3 text-brand-cyan" />Bulk Scheduler</span>
              </div>
              <Button className="mt-5 min-w-[150px] shadow-[0_12px_30px_rgba(45,212,191,.12)]" onClick={() => setCampaignOpen(true)} size="sm" variant="primary"><Sparkles className="size-3.5" />Create campaign <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" /></Button>
            </div>
          </div>

          <div aria-hidden="true" className="relative mx-auto hidden h-[150px] w-full max-w-[310px] sm:block">
            <div className="absolute left-[14%] top-[28px] h-[100px] w-[145px] -rotate-[9deg] rounded-[20px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.045),rgba(6,24,38,.92))] shadow-[0_20px_50px_rgba(0,0,0,.28)] transition duration-500 group-hover:-translate-x-3 group-hover:-rotate-[13deg]">
              <span className="absolute left-4 top-4 grid size-8 place-items-center rounded-xl border border-brand-cyan/20 bg-brand-cyan/8 text-brand-cyan"><FileText className="size-3.5" /></span>
              <span className="absolute bottom-4 left-4 right-4 h-2 rounded-full bg-white/8"><span className="block h-full w-[62%] rounded-full bg-brand-cyan/45" /></span>
            </div>
            <div className="absolute right-[13%] top-[20px] h-[108px] w-[148px] rotate-[8deg] rounded-[20px] border border-brand-purple/20 bg-[linear-gradient(145deg,rgba(124,58,237,.13),rgba(6,20,34,.96))] shadow-[0_20px_55px_rgba(0,0,0,.32)] transition duration-500 group-hover:translate-x-3 group-hover:rotate-[12deg]">
              <span className="absolute left-4 top-4 grid size-8 place-items-center rounded-xl border border-brand-purple/25 bg-brand-purple/10 text-[#c4b5fd]"><ImageIcon className="size-3.5" /></span>
              <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-1"><span className="h-8 rounded-lg bg-brand-purple/12" /><span className="h-8 rounded-lg bg-brand-cyan/10" /><span className="h-8 rounded-lg bg-white/[.04]" /></div>
            </div>
            <div className="ai-campaign-soft-float absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[20px] border border-brand-cyan/30 bg-[linear-gradient(145deg,rgba(45,212,191,.17),rgba(5,25,39,.96))] text-brand-cyan shadow-[0_22px_65px_rgba(45,212,191,.16)]"><Sparkles className="size-5" /></div>
          </div>
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
