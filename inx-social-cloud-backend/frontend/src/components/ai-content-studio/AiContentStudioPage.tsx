import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, History, Send, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  deleteAIDraft,
  duplicateAIDraft,
  getAIStudioAccess,
  getBrandKits,
  getGenerationHistory,
  getRecentAIDrafts,
  saveAIDraft,
  saveGeneratedAssets,
  sendDraftToPosts,
} from '../../lib/ai-content-studio-api'
import type { AIDraft, AIContentType, GenerationHistoryItem } from '../../types/ai-content-studio'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Drawer } from '../billing/BillingPrimitives'
import {
  AIStudioHero,
  BrandSafetyCard,
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
import { GenerationModal } from './GenerationModal'

export function AiContentStudioPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeType, setActiveType] = useState<AIContentType | null>(null)
  const [editingDraft, setEditingDraft] = useState<AIDraft | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

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
  const brandKitsQuery = useQuery({
    queryKey: ['ai-studio-brand-kits'],
    queryFn: getBrandKits,
    staleTime: 60_000,
  })
  const historyQuery = useQuery({
    queryKey: ['ai-studio-history'],
    queryFn: getGenerationHistory,
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
  const activeBrandKit = useMemo(() => brandKitsQuery.data?.find((kit) => kit.active) || brandKitsQuery.data?.[0] || null, [brandKitsQuery.data])

  function openCreator(type: AIContentType) {
    if (!access?.studioEnabled) {
      setUpgradeOpen(true)
      return
    }
    setEditingDraft(null)
    setActiveType(type)
  }

  function openDraft(draft: AIDraft) {
    if (!access?.studioEnabled) {
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

  if (accessQuery.isLoading || !access) {
    return <div className="space-y-4"><Card className="h-72 animate-pulse bg-panel-soft/60" /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Card className="h-80 animate-pulse bg-panel-soft/60" key={index} />)}</div></div>
  }

  if (accessQuery.isError) {
    return <Card className="mx-auto max-w-3xl p-6 text-center"><Sparkles className="mx-auto size-7 text-brand-cyan" /><h2 className="mt-3 text-lg font-semibold">AI Content Studio could not load.</h2><p className="mt-2 text-xs leading-5 text-text-muted">{accessQuery.error instanceof Error ? accessQuery.error.message : 'The workspace is temporarily unavailable.'}</p><Button className="mt-4" onClick={() => void accessQuery.refetch()} variant="primary">Retry</Button></Card>
  }

  if (access.plan !== 'plus' || !access.studioEnabled) {
    return <>
      <LockedPlanState onUpgrade={() => setUpgradeOpen(true)} plan={access.plan === 'pro' ? 'pro' : 'trial'} />
      <UpgradeToPlusModal onClose={() => setUpgradeOpen(false)} open={upgradeOpen} />
    </>
  }

  return <>
    <AIStudioHero access={access} />

    <section className="mt-6">
      <StudioSectionHeading action={<Button onClick={() => setHistoryOpen(true)} size="sm"><History className="size-3.5" />Generation history</Button>} text="Choose a workflow below. Each creator is optimised for one social post format." title="What do you want to create?" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ImagePostCard enabled={access.studioEnabled} onCreate={openCreator} />
        <CarouselPostCard enabled={access.studioEnabled} onCreate={openCreator} />
        <ShortVideoCard enabled={access.studioEnabled} onCreate={openCreator} />
        <UGCAdCard enabled={access.studioEnabled} onCreate={openCreator} />
      </div>
    </section>

    <section className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><span className="text-[9px] font-bold uppercase tracking-[.16em] text-text-soft">Your creation workflow</span><h3 className="mt-1 text-sm font-semibold">From idea to scheduled post — all in one flow.</h3></div><Button onClick={() => openCreator('image_post')} size="sm" variant="primary">Start creating <ArrowRight className="size-3.5" /></Button></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ['1', 'Create', 'Generate media and publishing copy.'],
            ['2', 'Review', 'Edit the result before it leaves AI Content Studio.'],
            ['3', 'Continue to Posts', 'Select pages, date/time, then publish or schedule.'],
          ].map(([number, title, text]) => <div className="relative rounded-2xl border border-border-soft bg-bg/30 p-4" key={number}><span className="grid size-8 place-items-center rounded-full border border-brand-teal/30 bg-brand-teal/10 text-xs font-bold text-brand-cyan">{number}</span><strong className="mt-3 block text-xs">{title}</strong><p className="mt-1 text-[10px] leading-4 text-text-muted">{text}</p></div>)}
        </div>
      </Card>
      <RecentDrafts drafts={drafts} onDelete={(draft) => void removeDraft(draft)} onDuplicate={(draft) => void duplicateDraft(draft)} onOpen={openDraft} onSend={(draft) => void continueToPosts(draft)} onViewAll={() => setDraftsOpen(true)} />
    </section>

    <section className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
      <BrandSafetyCard brandKitName={activeBrandKit?.name} />
      <CreditsCard topUpsSupported={false} />
    </section>

    <GenerationModal access={access} initialDraft={editingDraft} onClose={() => { setActiveType(null); setEditingDraft(null) }} onContinue={(draft) => void continueToPosts(draft)} onSaved={(draft) => void onDraftSaved(draft)} onToast={setToast} open={Boolean(activeType)} type={activeType} />
    <UpgradeToPlusModal onClose={() => setUpgradeOpen(false)} open={upgradeOpen} />
    <GenerationHistoryDrawer history={(historyQuery.data || []) as GenerationHistoryItem[]} onClose={() => setHistoryOpen(false)} open={historyOpen} />
    <Drawer onClose={() => setDraftsOpen(false)} open={draftsOpen} title="AI Content Studio drafts">
      <div className="space-y-3">{drafts.length ? drafts.map((draft) => <article className="rounded-2xl border border-border-soft bg-bg/35 p-4" key={draft.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="text-[9px] font-bold uppercase tracking-[.15em] text-text-soft">{draft.contentType.replaceAll('_', ' ')}</span><h3 className="mt-1 truncate text-sm font-semibold">{draft.title}</h3><p className="mt-1 text-[10px] text-text-muted">Edited {new Date(draft.updatedAt).toLocaleString()}</p></div><span className="rounded-full border border-brand-green/20 bg-brand-green/10 px-2 py-1 text-[9px] font-semibold text-brand-green">{draft.status}</span></div><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => openDraft(draft)} size="sm">Open</Button><Button onClick={() => void continueToPosts(draft)} size="sm" variant="primary"><Send className="size-3.5" />Send to Posts</Button><Button onClick={() => void duplicateDraft(draft)} size="sm">Duplicate</Button><Button onClick={() => void removeDraft(draft)} size="sm" variant="ghost">Delete</Button></div></article>) : <div className="rounded-2xl border border-dashed border-border-soft p-6 text-center text-xs text-text-muted">No AI drafts yet.</div>}</div>
    </Drawer>
    <StudioToast message={toast} onClose={() => setToast(null)} />
  </>
}
