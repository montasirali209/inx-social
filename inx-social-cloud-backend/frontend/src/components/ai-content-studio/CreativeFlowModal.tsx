import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarRange,
  Check,
  ChevronRight,
  CircleDot,
  Eye,
  Globe2,
  Image as ImageIcon,
  Loader2,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  WandSparkles,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { uploadPostStudioReference } from '../../lib/ai-post-studio-api'
import {
  analyzeCreativeFlow,
  getCreativeFlowRender,
  handoffCreativeFlowCampaign,
  planCreativeFlow,
  regenerateCreativeFlowPost,
  retryCreativeFlowRender,
  startCreativeFlowRender,
  type CreativeFlowAnalysis,
  type CreativeFlowConcept,
  type CreativeFlowRenderCampaign,
  type CreativeFlowStrategy,
} from '../../lib/creative-flow-api'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { CreativeFlowCanvas, type CreativeFlowAsset } from './CreativeFlowCanvas'

type CreativeFlowView = 'setup' | 'progress' | 'results' | 'render'
type CampaignGoal = 'auto' | 'sales' | 'traffic' | 'awareness' | 'launch'
type CreativeStyle = 'auto' | 'performance' | 'minimal' | 'lifestyle' | 'editorial'

const IMAGE_CREDITS = 10

const stage2Progress = [
  { label: 'Preparing product sources', detail: 'Securely preparing the website and supplied product references.' },
  { label: 'Understanding product & brand', detail: 'Reading verified website evidence and visible product/brand details.' },
  { label: 'Building campaign strategy', detail: 'Creating the audience, pillars, guardrails and creative direction.' },
  { label: 'Planning creative matrix', detail: 'Producing distinct angles, hooks and visual concepts before rendering.' },
]

export function CreativeFlowLaunchCard({ onOpen }: { onOpen: () => void }) {
  return <Card className="group relative overflow-hidden border-brand-cyan/25 p-0 transition duration-300 hover:border-brand-cyan/45 hover:shadow-[0_20px_56px_rgba(15,23,42,.10)]">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_86%_18%,rgba(45,212,191,.12),transparent_22rem),radial-gradient(circle_at_94%_90%,rgba(139,92,246,.08),transparent_20rem)]" />
    <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)] lg:items-center">
      <div className="flex min-w-0 items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan shadow-[0_14px_34px_rgba(20,184,166,.12)]"><WandSparkles className="size-5" /></span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[.17em] text-brand-cyan">Creative Flow</span>
            <span className="rounded-full border border-brand-purple/20 bg-brand-purple/[.07] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.12em] text-brand-purple">Stage 4</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight sm:text-xl">Turn one product into a complete visual campaign.</h2>
          <p className="mt-2 max-w-3xl text-[11px] leading-5 text-text-muted">Analyse the real product, build a creative matrix, generate distinct branded visuals, approve the ones you want, then hand the campaign into Bulk Scheduler.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-[9px] text-text-soft">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-white px-2.5 py-1"><Package className="size-3 text-brand-cyan" />Verified product context</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-white px-2.5 py-1"><Target className="size-3 text-brand-purple" />Real AI strategy</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-white px-2.5 py-1"><ImageIcon className="size-3 text-brand-green" />Background rendering</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-white px-2.5 py-1"><ShieldCheck className="size-3 text-brand-cyan" />Media Library saved</span>
          </div>
          <Button className="mt-5" onClick={onOpen} size="sm" variant="primary"><Sparkles className="size-3.5" />Open Creative Flow <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" /></Button>
        </div>
      </div>

      <div aria-hidden="true" className="relative hidden min-h-[170px] lg:block">
        <div className="absolute left-[5%] top-[48px] w-[104px] rounded-2xl border border-border-soft bg-white p-3 shadow-[0_14px_38px_rgba(15,23,42,.08)] transition duration-300 group-hover:-translate-x-1">
          <span className="grid size-8 place-items-center rounded-xl bg-brand-cyan/[.09] text-brand-cyan"><Package className="size-4" /></span>
          <strong className="mt-2 block text-[9px]">Product</strong><span className="mt-1 block h-1.5 w-12 rounded-full bg-slate-100" />
        </div>
        <div className="absolute left-[36%] top-[24px] w-[112px] rounded-2xl border border-border-soft bg-white p-3 shadow-[0_14px_38px_rgba(15,23,42,.08)] transition duration-300 group-hover:-translate-y-1">
          <span className="grid size-8 place-items-center rounded-xl bg-brand-purple/[.09] text-brand-purple"><Target className="size-4" /></span>
          <strong className="mt-2 block text-[9px]">Strategy</strong><div className="mt-2 flex gap-1"><i className="h-1.5 w-7 rounded-full bg-brand-purple/20" /><i className="h-1.5 w-5 rounded-full bg-brand-cyan/20" /></div>
        </div>
        <div className="absolute right-[5%] top-[48px] w-[118px] rounded-2xl border border-brand-cyan/20 bg-white p-3 shadow-[0_18px_44px_rgba(20,184,166,.10)] transition duration-300 group-hover:translate-x-1">
          <span className="grid size-8 place-items-center rounded-xl bg-brand-green/[.09] text-brand-green"><ImageIcon className="size-4" /></span>
          <strong className="mt-2 block text-[9px]">Real creatives</strong><div className="mt-2 grid grid-cols-3 gap-1"><i className="h-7 rounded-md bg-brand-cyan/10" /><i className="h-7 rounded-md bg-brand-purple/10" /><i className="h-7 rounded-md bg-brand-green/10" /></div>
        </div>
        <span className="absolute left-[27%] top-[82px] h-px w-[42px] bg-brand-cyan/25" /><ChevronRight className="absolute left-[32%] top-[76px] size-3 text-brand-cyan/45" />
        <span className="absolute right-[30%] top-[82px] h-px w-[42px] bg-brand-cyan/25" /><ChevronRight className="absolute right-[28%] top-[76px] size-3 text-brand-cyan/45" />
      </div>
    </div>
  </Card>
}

export function CreativeFlowModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [view, setView] = useState<CreativeFlowView>('setup')
  const [website, setWebsite] = useState('')
  const [productName, setProductName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['Instagram', 'Facebook'])
  const [creativeCount, setCreativeCount] = useState<number>(20)
  const [customCount, setCustomCount] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [goal, setGoal] = useState<CampaignGoal>('auto')
  const [style, setStyle] = useState<CreativeStyle>('auto')
  const [audience, setAudience] = useState('')
  const [assets, setAssets] = useState<CreativeFlowAsset[]>([])
  const [referenceAssetIds, setReferenceAssetIds] = useState<string[]>([])
  const [progressIndex, setProgressIndex] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [analysis, setAnalysis] = useState<CreativeFlowAnalysis | null>(null)
  const [strategy, setStrategy] = useState<CreativeFlowStrategy | null>(null)
  const [selectedConcepts, setSelectedConcepts] = useState<Set<number>>(new Set())
  const [runError, setRunError] = useState('')
  const [running, setRunning] = useState(false)
  const [renderConfirm, setRenderConfirm] = useState(false)
  const [renderBusy, setRenderBusy] = useState(false)
  const [renderError, setRenderError] = useState('')
  const [renderCampaign, setRenderCampaign] = useState<CreativeFlowRenderCampaign | null>(null)
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set())
  const [approvedPostIds, setApprovedPostIds] = useState<Set<string>>(new Set())
  const [handoffBusy, setHandoffBusy] = useState(false)
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null)
  const approvalInitialisedForCampaign = useRef('')
  const dialogRef = useRef<HTMLElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  const resolvedCount = Math.max(1, Math.min(50, Number(customCount || creativeCount) || 20))
  const canGenerate = Boolean(prompt.trim() || productName.trim() || website.trim() || assets.length)

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !running && !renderBusy && !handoffBusy) {
        event.preventDefault()
        if (lightbox) setLightbox(null)
        else if (renderConfirm) setRenderConfirm(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    const timer = window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>('button, input, textarea')?.focus(), 0)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
      previousFocus.current?.focus()
    }
  }, [open, onClose, running, renderBusy, handoffBusy, renderConfirm, lightbox])

  const renderCampaignId = renderCampaign?.id || ''
  const renderCampaignStatus = renderCampaign?.status || ''

  useEffect(() => {
    if (!open || view !== 'render' || !renderCampaignId || renderCampaignStatus !== 'GENERATING_IMAGES') return
    let active = true
    const refresh = async () => {
      try {
        const next = await getCreativeFlowRender(renderCampaignId)
        if (active) setRenderCampaign(next)
      } catch (caught) {
        if (active) setRenderError(caught instanceof Error ? caught.message : 'Could not refresh Creative Flow progress.')
      }
    }
    const timer = window.setInterval(() => void refresh(), 2500)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [open, view, renderCampaignId, renderCampaignStatus])

  useEffect(() => {
    if (!renderCampaign || renderCampaign.status === 'GENERATING_IMAGES') return
    if (approvalInitialisedForCampaign.current === renderCampaign.id) return
    const readyIds = renderCampaign.posts.filter((post) => Boolean(post.mediaAsset?.url)).map((post) => post.id)
    if (!readyIds.length) return
    approvalInitialisedForCampaign.current = renderCampaign.id
    setApprovedPostIds(new Set(readyIds))
  }, [renderCampaign])

  if (!open) return null

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((current) => current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform])
  }

  const addAssets = (files: File[]) => {
    const next = files
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, Math.max(0, 8 - assets.length))
      .map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        url: URL.createObjectURL(file),
        file,
      }))
    setAssets((current) => [...current, ...next].slice(0, 8))
    setRunError('')
  }

  const removeAsset = (id: string) => {
    setAssets((current) => {
      const target = current.find((asset) => asset.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return current.filter((asset) => asset.id !== id)
    })
  }

  const closeFlow = () => {
    if (running || renderBusy || handoffBusy) return
    assets.forEach((asset) => URL.revokeObjectURL(asset.url))
    setAssets([])
    onClose()
  }

  const resetFlow = () => {
    if (running || renderBusy || handoffBusy) return
    setView('setup')
    setProgressIndex(0)
    setUploadProgress(0)
    setAnalysis(null)
    setStrategy(null)
    setSelectedConcepts(new Set())
    setRenderCampaign(null)
    setApprovedPostIds(new Set())
    approvalInitialisedForCampaign.current = ''
    setRenderError('')
    setRunError('')
  }

  const campaignPrompt = () => prompt.trim() || `Create a varied, credible social marketing campaign for ${productName.trim() || website.trim() || 'this product'}.`

  const beginStage2 = async () => {
    if (!canGenerate || running) return
    setView('progress')
    setRunning(true)
    setProgressIndex(0)
    setUploadProgress(0)
    setRunError('')
    setAnalysis(null)
    setStrategy(null)
    setSelectedConcepts(new Set())

    try {
      const referenceIds: string[] = []
      for (let index = 0; index < assets.length; index += 1) {
        const asset = assets[index]
        if (asset.file.size > 20 * 1024 * 1024) throw new Error(`${asset.name} is larger than the 20 MB reference limit.`)
        if (asset.referenceId) {
          referenceIds.push(asset.referenceId)
          continue
        }
        const stored = await uploadPostStudioReference(asset.file, (percent) => {
          const overall = Math.round(((index + percent / 100) / Math.max(1, assets.length)) * 100)
          setUploadProgress(overall)
        })
        referenceIds.push(stored.id)
        setAssets((current) => current.map((item) => item.id === asset.id ? { ...item, referenceId: stored.id } : item))
      }

      setReferenceAssetIds(referenceIds)
      setUploadProgress(100)
      setProgressIndex(1)
      const analysed = await analyzeCreativeFlow({
        website: website.trim(),
        productName: productName.trim(),
        prompt: campaignPrompt(),
        audience: audience.trim(),
        referenceAssetIds: referenceIds,
      })
      setAnalysis(analysed)
      if (!productName.trim() && analysed.sourceAnalysis.productName) setProductName(analysed.sourceAnalysis.productName)

      setProgressIndex(2)
      const plannedPromise = planCreativeFlow({
        productName: productName.trim() || analysed.sourceAnalysis.productName,
        prompt: campaignPrompt(),
        platforms: selectedPlatforms,
        creativeCount: resolvedCount,
        goal,
        style,
        audience,
        sourceAnalysis: analysed.sourceAnalysis,
      })

      const conceptTimer = window.setTimeout(() => setProgressIndex(3), 650)
      const planned = await plannedPromise
      window.clearTimeout(conceptTimer)
      setProgressIndex(3)
      setStrategy(planned)
      setSelectedConcepts(new Set(planned.concepts.map((concept) => concept.sequence)))
      setView('results')
    } catch (caught) {
      setRunError(caught instanceof Error ? caught.message : 'Creative Flow could not build the strategy.')
    } finally {
      setRunning(false)
    }
  }

  const rerunStrategy = async () => {
    if (!analysis || running) return
    setView('progress')
    setRunning(true)
    setProgressIndex(2)
    setRunError('')
    try {
      const conceptTimer = window.setTimeout(() => setProgressIndex(3), 650)
      const planned = await planCreativeFlow({
        productName: productName.trim() || analysis.sourceAnalysis.productName,
        prompt: campaignPrompt(),
        platforms: selectedPlatforms,
        creativeCount: resolvedCount,
        goal,
        style,
        audience,
        sourceAnalysis: analysis.sourceAnalysis,
      })
      window.clearTimeout(conceptTimer)
      setStrategy(planned)
      setSelectedConcepts(new Set(planned.concepts.map((concept) => concept.sequence)))
      setView('results')
    } catch (caught) {
      setRunError(caught instanceof Error ? caught.message : 'Creative Flow could not rebuild the strategy.')
    } finally {
      setRunning(false)
    }
  }

  const keptConcepts = () => (strategy?.concepts || []).filter((concept) => selectedConcepts.has(concept.sequence))

  const beginStage3 = async () => {
    if (!analysis || !strategy || !selectedConcepts.size || renderBusy) return
    setRenderBusy(true)
    setRenderError('')
    setRenderConfirm(false)
    try {
      const response = await startCreativeFlowRender({
        website: website.trim(),
        productName: productName.trim() || analysis.sourceAnalysis.productName,
        prompt: campaignPrompt(),
        platforms: selectedPlatforms,
        goal,
        style,
        audience,
        referenceAssetIds,
        sourceAnalysis: analysis.sourceAnalysis,
        brandPack: analysis.brandPack,
        strategy: strategy.strategy,
        concepts: keptConcepts(),
      })
      setRenderCampaign(response.campaign)
      setApprovedPostIds(new Set())
      approvalInitialisedForCampaign.current = ''
      setView('render')
    } catch (caught) {
      setRenderError(caught instanceof Error ? caught.message : 'Creative Flow could not start image generation.')
    } finally {
      setRenderBusy(false)
    }
  }

  const retryMissing = async () => {
    if (!renderCampaign || renderBusy) return
    setRenderBusy(true)
    setRenderError('')
    try {
      setRenderCampaign(await retryCreativeFlowRender(renderCampaign.id))
    } catch (caught) {
      setRenderError(caught instanceof Error ? caught.message : 'Creative Flow could not retry missing creatives.')
    } finally {
      setRenderBusy(false)
    }
  }

  const regeneratePost = async (postId: string) => {
    if (!renderCampaign || regenerating.has(postId)) return
    setRegenerating((current) => new Set(current).add(postId))
    setRenderError('')
    try {
      setRenderCampaign(await regenerateCreativeFlowPost(renderCampaign.id, postId))
    } catch (caught) {
      setRenderError(caught instanceof Error ? caught.message : 'Creative Flow could not regenerate this creative.')
    } finally {
      setRegenerating((current) => {
        const next = new Set(current)
        next.delete(postId)
        return next
      })
    }
  }

  const sendApprovedToBulkScheduler = async () => {
    if (!renderCampaign || !approvedPostIds.size || handoffBusy) return
    setHandoffBusy(true)
    setRenderError('')
    try {
      const response = await handoffCreativeFlowCampaign(renderCampaign.id, [...approvedPostIds])
      navigate('/bulk-scheduler', { state: { aiCampaignId: response.campaign.id } })
    } catch (caught) {
      setRenderError(caught instanceof Error ? caught.message : 'Creative Flow could not hand the approved campaign to Bulk Scheduler.')
      setHandoffBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[360] bg-slate-950/55 p-2 backdrop-blur-md sm:p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) closeFlow() }}>
      <section aria-labelledby="creative-flow-title" aria-modal="true" className="mx-auto flex h-[calc(100dvh-1rem)] w-full max-w-[1280px] flex-col overflow-hidden rounded-[24px] border border-brand-cyan/25 bg-[#f8fafc] shadow-[0_38px_130px_rgba(15,23,42,.32)] sm:h-[calc(100dvh-2rem)]" ref={dialogRef} role="dialog">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-soft bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-brand-cyan/25 bg-brand-cyan/[.08] text-brand-cyan"><WandSparkles className="size-4.5" /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2"><h2 className="truncate text-base font-semibold sm:text-lg" id="creative-flow-title">Creative Flow</h2><span className="hidden rounded-full border border-brand-purple/20 bg-brand-purple/[.06] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.12em] text-brand-purple sm:inline">Stage 4 preview</span></div>
              <p className="mt-0.5 hidden text-[10px] text-text-muted sm:block">Product understanding, strategy, generation, approval and Bulk Scheduler handoff are now connected.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view !== 'setup' && view !== 'render' && <Button disabled={running || renderBusy || handoffBusy} onClick={resetFlow} size="sm" variant="ghost"><ArrowLeft className="size-3.5" />Back to flow</Button>}
            {view === 'render' && strategy && analysis && <Button disabled={renderBusy || handoffBusy} onClick={() => setView('results')} size="sm" variant="ghost"><ArrowLeft className="size-3.5" />Strategy</Button>}
            <button aria-label="Close Creative Flow" className="grid size-9 place-items-center rounded-xl border border-border-soft bg-white text-text-muted transition hover:text-text-main disabled:opacity-40" disabled={running || renderBusy || handoffBusy} onClick={closeFlow} type="button"><X className="size-4" /></button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {view === 'setup' && <CreativeFlowCanvas
            advancedOpen={advancedOpen}
            assets={assets}
            audience={audience}
            canRun={canGenerate}
            creativeCount={creativeCount}
            customCount={customCount}
            goal={goal}
            productName={productName}
            prompt={prompt}
            selectedPlatforms={selectedPlatforms}
            style={style}
            website={website}
            onAddAssets={addAssets}
            onAdvancedToggle={() => setAdvancedOpen((current) => !current)}
            onAudienceChange={setAudience}
            onCreativeCountChange={setCreativeCount}
            onCustomCountChange={setCustomCount}
            onGoalChange={(value) => setGoal(value as CampaignGoal)}
            onProductNameChange={setProductName}
            onPromptChange={setPrompt}
            onRemoveAsset={removeAsset}
            onRun={() => void beginStage2()}
            onStyleChange={(value) => setStyle(value as CreativeStyle)}
            onTogglePlatform={togglePlatform}
            onWebsiteChange={setWebsite}
          />}

          {view === 'progress' && <PlanningProgress
            assetsCount={assets.length}
            error={runError}
            progressIndex={progressIndex}
            running={running}
            uploadProgress={uploadProgress}
            onEdit={resetFlow}
            onRetry={() => void beginStage2()}
          />}

          {view === 'results' && strategy && analysis && <StrategyResults
            analysis={analysis}
            productName={productName}
            selectedConcepts={selectedConcepts}
            strategy={strategy}
            renderError={renderError}
            renderBusy={renderBusy}
            onBack={resetFlow}
            onGenerate={() => setRenderConfirm(true)}
            onOpenRender={() => renderCampaign && setView('render')}
            onRerun={() => void rerunStrategy()}
            hasRender={Boolean(renderCampaign)}
            onToggleConcept={(sequence) => setSelectedConcepts((current) => {
              const next = new Set(current)
              if (next.has(sequence)) next.delete(sequence)
              else next.add(sequence)
              return next
            })}
          />}

          {view === 'render' && renderCampaign && <RenderWorkspace
            approvedPostIds={approvedPostIds}
            campaign={renderCampaign}
            error={renderError}
            handoffBusy={handoffBusy}
            regenerating={regenerating}
            retryBusy={renderBusy}
            onApproveAll={() => setApprovedPostIds(new Set(renderCampaign.posts.filter((post) => Boolean(post.mediaAsset?.url)).map((post) => post.id)))}
            onClearApprovals={() => setApprovedPostIds(new Set())}
            onHandoff={() => void sendApprovedToBulkScheduler()}
            onOpenImage={(url, label) => setLightbox({ url, label })}
            onRegenerate={(postId) => void regeneratePost(postId)}
            onRetry={() => void retryMissing()}
            onToggleApproved={(postId) => setApprovedPostIds((current) => {
              const next = new Set(current)
              if (next.has(postId)) next.delete(postId)
              else next.add(postId)
              return next
            })}
          />}
        </div>
      </section>

      {renderConfirm && strategy && analysis && <RenderConfirmation
        count={selectedConcepts.size}
        productName={productName || analysis.sourceAnalysis.productName || strategy.strategy.campaignTitle}
        busy={renderBusy}
        onCancel={() => setRenderConfirm(false)}
        onConfirm={() => void beginStage3()}
      />}

      {lightbox && <div className="fixed inset-0 z-[420] grid place-items-center bg-slate-950/90 p-4 backdrop-blur-lg" onMouseDown={(event) => { if (event.currentTarget === event.target) setLightbox(null) }}>
        <div className="relative max-h-[94dvh] max-w-[94vw] overflow-hidden rounded-[22px] border border-white/15 bg-black shadow-[0_40px_130px_rgba(0,0,0,.65)]">
          <button aria-label="Close creative preview" className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-xl bg-black/65 text-white" onClick={() => setLightbox(null)} type="button"><X className="size-4" /></button>
          <img alt={lightbox.label} className="max-h-[92dvh] max-w-[92vw] object-contain" src={lightbox.url} />
        </div>
      </div>}
    </div>,
    document.body,
  )
}

function PlanningProgress({ assetsCount, error, progressIndex, running, uploadProgress, onEdit, onRetry }: {
  assetsCount: number
  error: string
  progressIndex: number
  running: boolean
  uploadProgress: number
  onEdit: () => void
  onRetry: () => void
}) {
  return <div className="mx-auto flex min-h-full w-full max-w-[940px] items-center p-4 sm:p-8">
    <div className="w-full rounded-[26px] border border-border-soft bg-white p-5 shadow-[0_26px_80px_rgba(15,23,42,.08)] sm:p-8">
      <div className="mx-auto max-w-2xl text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-[20px] border border-brand-cyan/25 bg-brand-cyan/[.08] text-brand-cyan">{running ? <Loader2 className="size-6 animate-spin motion-reduce:animate-none" /> : error ? <AlertTriangle className="size-6 text-brand-amber" /> : <Check className="size-6 text-brand-green" />}</span>
        <span className="mt-5 block text-[9px] font-bold uppercase tracking-[.16em] text-brand-cyan">Creative Flow · Planning</span>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{error ? 'Strategy needs another try' : 'Understanding and planning your campaign'}</h3>
        <p className="mt-2 text-xs leading-5 text-text-muted">{error || 'Source analysis and campaign strategy happen before any paid image render.'}</p>
      </div>

      <div className="mx-auto mt-8 max-w-2xl space-y-2.5">{stage2Progress.map((stage, index) => {
        const done = !error && index < progressIndex
        const active = !error && index === progressIndex
        return <div className={`flex items-center gap-3 rounded-2xl border p-3.5 transition duration-300 ${done ? 'border-brand-green/20 bg-brand-green/[.035]' : active ? 'border-brand-cyan/30 bg-brand-cyan/[.045] shadow-[0_10px_26px_rgba(20,184,166,.07)]' : 'border-border-soft bg-slate-50/70'}`} key={stage.label}>
          <span className={`grid size-9 shrink-0 place-items-center rounded-xl border ${done ? 'border-brand-green/25 bg-brand-green/10 text-brand-green' : active ? 'border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan' : 'border-border-soft bg-white text-text-soft'}`}>{done ? <Check className="size-4" /> : active ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <CircleDot className="size-3.5" />}</span>
          <div className="min-w-0 flex-1"><strong className="block text-xs">{stage.label}</strong><span className="mt-0.5 block text-[9px] leading-4 text-text-muted">{stage.detail}</span></div>
          {index === 0 && assetsCount > 0 && active && <span className="shrink-0 rounded-full border border-brand-cyan/20 bg-white px-2.5 py-1 text-[9px] font-semibold text-brand-cyan">{uploadProgress}%</span>}
        </div>
      })}</div>

      {error && <div className="mx-auto mt-5 flex max-w-2xl justify-center gap-2"><Button onClick={onEdit}>Edit flow</Button><Button onClick={onRetry} variant="primary"><RefreshCw className="size-3.5" />Retry</Button></div>}
    </div>
  </div>
}

function StrategyResults({ analysis, productName, selectedConcepts, strategy, renderError, renderBusy, hasRender, onBack, onGenerate, onOpenRender, onRerun, onToggleConcept }: {
  analysis: CreativeFlowAnalysis
  productName: string
  selectedConcepts: Set<number>
  strategy: CreativeFlowStrategy
  renderError: string
  renderBusy: boolean
  hasRender: boolean
  onBack: () => void
  onGenerate: () => void
  onOpenRender: () => void
  onRerun: () => void
  onToggleConcept: (sequence: number) => void
}) {
  const source = analysis.sourceAnalysis
  const brand = analysis.brandPack
  const creditCost = selectedConcepts.size * IMAGE_CREDITS
  return <div className="mx-auto w-full max-w-[1200px] p-4 sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <span className="text-[9px] font-bold uppercase tracking-[.16em] text-brand-green">Strategy ready</span>
        <h3 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{strategy.strategy.campaignTitle}</h3>
        <p className="mt-1 max-w-3xl text-[10px] leading-5 text-text-muted">Choose the concepts worth rendering. Every kept concept becomes its own branded image and is saved automatically to Media Library.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onBack} size="sm">Edit flow</Button>
        <Button onClick={onRerun} size="sm"><RefreshCw className="size-3.5" />Regenerate strategy</Button>
        {hasRender && <Button onClick={onOpenRender} size="sm"><Eye className="size-3.5" />Open render</Button>}
        <Button disabled={!selectedConcepts.size || renderBusy} onClick={onGenerate} size="sm" variant="primary"><ImageIcon className="size-3.5" />Generate {selectedConcepts.size} · {creditCost} credits</Button>
      </div>
    </div>

    {renderError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[10px] text-red-700">{renderError}</div>}

    <div className="mt-5 grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
      <section className="rounded-[20px] border border-border-soft bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,.05)] sm:p-5">
        <div className="flex items-start justify-between gap-3"><div><span className="text-[8px] font-bold uppercase tracking-[.14em] text-brand-cyan">Product understanding</span><h4 className="mt-1 text-sm font-semibold">{source.productName || brand.brandName || productName || 'Product context'}</h4></div><span className={`rounded-full border px-2 py-1 text-[8px] font-bold ${brand.confidence === 'high' ? 'border-brand-green/25 bg-brand-green/[.06] text-brand-green' : brand.confidence === 'medium' ? 'border-brand-amber/25 bg-brand-amber/[.06] text-brand-amber' : 'border-border-soft bg-slate-50 text-text-muted'}`}>{brand.confidence} brand confidence</span></div>
        {source.summary && <p className="mt-3 text-[10px] leading-5 text-text-muted">{source.summary}</p>}
        {analysis.analysedUrl && <div className="mt-3 flex items-start gap-2 rounded-xl border border-border-soft bg-slate-50 p-3"><Globe2 className="mt-0.5 size-3.5 shrink-0 text-brand-cyan" /><div className="min-w-0"><strong className="block truncate text-[9px]">{analysis.analysedUrl.title || analysis.analysedUrl.url}</strong><span className="mt-0.5 block truncate text-[8px] text-text-soft">{analysis.analysedUrl.url}</span></div></div>}
        {brand.colors.length > 0 && <div className="mt-4"><span className="text-[8px] font-bold uppercase tracking-[.12em] text-text-soft">Extracted palette</span><div className="mt-2 flex flex-wrap gap-2">{brand.colors.map((color) => <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-white px-2 py-1 text-[8px] text-text-muted" key={color}><i className="size-3 rounded-full border border-black/10" style={{ backgroundColor: color }} />{color}</span>)}</div></div>}
        {source.verifiedClaims.length > 0 && <div className="mt-4"><span className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.12em] text-text-soft"><BadgeCheck className="size-3 text-brand-green" />Verified claims</span><ul className="mt-2 space-y-1.5 text-[9px] leading-4 text-text-muted">{source.verifiedClaims.slice(0, 5).map((item) => <li key={item}>• {item}</li>)}</ul></div>}
      </section>

      <section className="rounded-[20px] border border-border-soft bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,.05)] sm:p-5">
        <span className="text-[8px] font-bold uppercase tracking-[.14em] text-brand-purple">Campaign strategy</span>
        <p className="mt-2 text-[10px] leading-5 text-text-muted">{strategy.strategy.strategySummary}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border-soft bg-slate-50 p-3"><span className="text-[8px] font-bold uppercase tracking-[.12em] text-text-soft">Audience</span><p className="mt-1.5 text-[9px] leading-4 text-text-muted">{strategy.strategy.audienceSummary || 'AI-selected from the supplied brief and source context.'}</p></div>
          <div className="rounded-xl border border-border-soft bg-slate-50 p-3"><span className="text-[8px] font-bold uppercase tracking-[.12em] text-text-soft">Brand handling</span><p className="mt-1.5 text-[9px] leading-4 text-text-muted">{brand.lockLogo ? 'Official logo detected. The exact website logo is locked for rendering.' : 'No verified full logo lock. Creative Flow will not invent one.'}</p></div>
        </div>
        {strategy.strategy.contentPillars.length > 0 && <div className="mt-4"><span className="text-[8px] font-bold uppercase tracking-[.12em] text-text-soft">Content pillars</span><div className="mt-2 flex flex-wrap gap-1.5">{strategy.strategy.contentPillars.map((item) => <span className="rounded-full border border-brand-purple/15 bg-brand-purple/[.035] px-2.5 py-1 text-[8px] text-text-muted" key={item}>{item}</span>)}</div></div>}
        {strategy.strategy.claimGuardrails.length > 0 && <div className="mt-4 rounded-xl border border-brand-amber/20 bg-brand-amber/[.04] p-3"><span className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.12em] text-brand-amber"><AlertTriangle className="size-3" />Claim guardrails</span><ul className="mt-1.5 space-y-1 text-[8px] leading-4 text-text-muted">{strategy.strategy.claimGuardrails.slice(0, 4).map((item) => <li key={item}>• {item}</li>)}</ul></div>}
      </section>
    </div>

    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><span className="text-[8px] font-bold uppercase tracking-[.14em] text-brand-cyan">Creative matrix</span><h4 className="mt-1 text-lg font-semibold">{strategy.concepts.length} planned creatives</h4><p className="mt-1 text-[9px] text-text-muted">Keep or remove concepts before paid rendering. Every card has a different strategic angle.</p></div><span className="rounded-full border border-brand-green/20 bg-brand-green/[.05] px-3 py-1.5 text-[9px] font-semibold text-brand-green">{selectedConcepts.size} kept · {creditCost} credits</span></div>

    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{strategy.concepts.map((concept) => <ConceptCard concept={concept} kept={selectedConcepts.has(concept.sequence)} key={concept.sequence} onToggle={() => onToggleConcept(concept.sequence)} />)}</div>
  </div>
}

function ConceptCard({ concept, kept, onToggle }: { concept: CreativeFlowConcept; kept: boolean; onToggle: () => void }) {
  const evidenceLabel = concept.evidenceBasis === 'verified_source' ? 'Verified source' : concept.evidenceBasis === 'user_brief' ? 'Customer brief' : 'Brand-safe'
  return <article className={`rounded-[18px] border bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,.045)] transition ${kept ? 'border-brand-cyan/30 ring-1 ring-brand-cyan/[.06]' : 'border-border-soft opacity-60'}`}>
    <div className="flex items-start justify-between gap-3"><span className="rounded-full border border-border-soft bg-slate-50 px-2 py-1 text-[8px] font-bold uppercase tracking-[.1em] text-text-soft">Concept {String(concept.sequence).padStart(2, '0')}</span><button className={`rounded-lg border px-2.5 py-1.5 text-[8px] font-semibold transition ${kept ? 'border-brand-green/25 bg-brand-green/[.06] text-brand-green' : 'border-border-soft bg-slate-50 text-text-muted'}`} onClick={onToggle} type="button">{kept ? 'Keep' : 'Removed'}</button></div>
    <span className="mt-4 block text-[8px] font-bold uppercase tracking-[.13em] text-brand-purple">{concept.angle}</span>
    <h5 className="mt-1.5 text-base font-semibold leading-tight tracking-[-.02em]">{concept.hook}</h5>
    <p className="mt-2 text-[9px] leading-4 text-text-muted">{concept.message}</p>
    <div className="mt-3 rounded-xl border border-border-soft bg-slate-50 p-3"><span className="text-[8px] font-bold uppercase tracking-[.11em] text-text-soft">Visual direction</span><p className="mt-1 text-[9px] leading-4 text-text-muted">{concept.visualStyle}</p></div>
    <div className="mt-3 flex flex-wrap gap-1.5"><span className="rounded-full border border-border-soft bg-white px-2 py-1 text-[8px] text-text-soft">{evidenceLabel}</span>{concept.platformApproach && <span className="rounded-full border border-border-soft bg-white px-2 py-1 text-[8px] text-text-soft">{concept.platformApproach}</span>}</div>
  </article>
}

function RenderConfirmation({ count, productName, busy, onCancel, onConfirm }: {
  count: number
  productName: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const credits = count * IMAGE_CREDITS
  return <div className="fixed inset-0 z-[410] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
    <section aria-modal="true" className="w-full max-w-lg rounded-[24px] border border-brand-cyan/25 bg-white p-6 shadow-[0_36px_100px_rgba(15,23,42,.35)]" role="dialog">
      <span className="grid size-12 place-items-center rounded-2xl border border-brand-cyan/25 bg-brand-cyan/[.08] text-brand-cyan"><ImageIcon className="size-5" /></span>
      <span className="mt-5 block text-[9px] font-bold uppercase tracking-[.15em] text-brand-cyan">Start Stage 4</span>
      <h3 className="mt-1 text-xl font-semibold">Generate {count} real creatives?</h3>
      <p className="mt-2 text-[10px] leading-5 text-text-muted">Creative Flow will render {count} distinct images for <strong className="text-text-main">{productName}</strong>. The maximum planned charge is <strong className="text-text-main">{credits} AI credits</strong> at {IMAGE_CREDITS} credits per completed creative.</p>
      <div className="mt-4 rounded-xl border border-brand-green/15 bg-brand-green/[.035] p-3 text-[9px] leading-4 text-text-muted">Each completed image is saved directly to Media Library. Failed renders refund their reserved credits automatically. You may close the window after generation starts; the server continues the campaign in the background.</div>
      <div className="mt-5 flex justify-end gap-2"><Button disabled={busy} onClick={onCancel}>Cancel</Button><Button disabled={busy} onClick={onConfirm} variant="primary">{busy ? <Loader2 className="size-3.5 animate-spin" /> : <WandSparkles className="size-3.5" />}Generate · {credits} credits</Button></div>
    </section>
  </div>
}

function RenderWorkspace({ approvedPostIds, campaign, error, handoffBusy, regenerating, retryBusy, onApproveAll, onClearApprovals, onHandoff, onOpenImage, onRegenerate, onRetry, onToggleApproved }: {
  approvedPostIds: Set<string>
  campaign: CreativeFlowRenderCampaign
  error: string
  handoffBusy: boolean
  regenerating: Set<string>
  retryBusy: boolean
  onApproveAll: () => void
  onClearApprovals: () => void
  onHandoff: () => void
  onOpenImage: (url: string, label: string) => void
  onRegenerate: (postId: string) => void
  onRetry: () => void
  onToggleApproved: (postId: string) => void
}) {
  const ready = campaign.posts.filter((post) => Boolean(post.mediaAsset?.url)).length
  const missing = Math.max(0, campaign.imagePostCount - ready)
  const running = campaign.status === 'GENERATING_IMAGES'
  const partial = campaign.status === 'PARTIAL'
  const complete = campaign.status === 'READY' && missing === 0

  return <div className="mx-auto w-full max-w-[1200px] p-4 sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <span className={`text-[9px] font-bold uppercase tracking-[.16em] ${complete ? 'text-brand-green' : partial ? 'text-brand-amber' : 'text-brand-cyan'}`}>{complete ? 'Campaign rendered' : partial ? 'Render needs review' : 'Rendering in background'}</span>
        <h3 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{campaign.title}</h3>
        <p className="mt-1 text-[10px] leading-5 text-text-muted">{ready}/{campaign.imagePostCount} creatives ready · completed images are already in Media Library.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border-soft bg-white px-3 py-1.5 text-[9px] font-semibold text-text-muted">{ready * campaign.creativeFlow.creditsPerCreative} credits completed</span>
        {running && <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/20 bg-brand-cyan/[.05] px-3 py-1.5 text-[9px] font-semibold text-brand-cyan"><Loader2 className="size-3 animate-spin" />Generating</span>}
        {partial && missing > 0 && <Button disabled={retryBusy || handoffBusy} onClick={onRetry} size="sm"><RefreshCw className={`size-3.5 ${retryBusy ? 'animate-spin' : ''}`} />Retry {missing} missing · {missing * campaign.creativeFlow.creditsPerCreative} credits</Button>}
        {ready > 0 && <Button disabled={!approvedPostIds.size || handoffBusy} onClick={onHandoff} size="sm" variant="primary">{handoffBusy ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarRange className="size-3.5" />}Send {approvedPostIds.size} approved to Bulk Scheduler</Button>}
      </div>
    </div>

    {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[10px] text-red-700">{error}</div>}

    <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-brand-cyan transition-all duration-500" style={{ width: `${campaign.imagePostCount ? Math.round((ready / campaign.imagePostCount) * 100) : 0}%` }} /></div>

    {ready > 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-soft bg-white p-3">
      <div><strong className="text-[10px]">{approvedPostIds.size} of {ready} completed creatives approved</strong><p className="mt-0.5 text-[8px] text-text-soft">Only approved creatives are copied into the standard campaign sent to Bulk Scheduler.</p></div>
      <div className="flex gap-2"><Button disabled={handoffBusy} onClick={onApproveAll} size="sm">Approve all</Button><Button disabled={handoffBusy || !approvedPostIds.size} onClick={onClearApprovals} size="sm">Clear</Button></div>
    </div>}

    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{campaign.posts.map((post) => {
      const asset = post.mediaAsset
      const busy = regenerating.has(post.id)
      const imageUrl = asset?.thumbnailUrl || asset?.url || ''
      return <article className="overflow-hidden rounded-[18px] border border-border-soft bg-white shadow-[0_12px_34px_rgba(15,23,42,.06)]" key={post.id}>
        <div className="relative aspect-[4/5] overflow-hidden bg-[linear-gradient(145deg,#f8fafc,#eef2f7)]">
          {imageUrl ? <button aria-label={`Open creative ${post.sequence}`} className="size-full cursor-zoom-in" onClick={() => onOpenImage(asset?.url || imageUrl, post.hook || `Creative ${post.sequence}`)} type="button"><img alt={post.hook || `Creative ${post.sequence}`} className="size-full object-cover" src={imageUrl} /></button> : <div className="grid size-full place-items-center p-6 text-center"><div><span className="mx-auto grid size-11 place-items-center rounded-2xl border border-brand-cyan/20 bg-white text-brand-cyan">{running ? <Loader2 className="size-5 animate-spin" /> : <ImageIcon className="size-5" />}</span><strong className="mt-3 block text-[10px]">{running ? 'Rendering creative…' : 'Image not completed'}</strong><span className="mt-1 block text-[8px] text-text-soft">{running ? 'The background queue is still working.' : 'Retry the missing renders from the top.'}</span></div></div>}
          <span className="absolute left-2.5 top-2.5 rounded-full border border-white/30 bg-black/55 px-2 py-1 text-[8px] font-bold text-white backdrop-blur">#{String(post.sequence).padStart(2, '0')}</span>
          {imageUrl && <span className="absolute right-2.5 top-2.5 rounded-full border border-white/30 bg-black/55 px-2 py-1 text-[8px] font-bold text-white backdrop-blur">Media Library</span>}
        </div>
        <div className="p-3.5">
          <span className="text-[8px] font-bold uppercase tracking-[.12em] text-brand-purple">{post.pillar || 'Creative angle'}</span>
          <h4 className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4">{post.hook || 'Campaign creative'}</h4>
          <p className="mt-1.5 line-clamp-2 text-[8px] leading-4 text-text-muted">{post.caption}</p>
          <div className="mt-3 flex gap-2">
            {imageUrl && <button className={`min-h-9 flex-1 rounded-xl border px-3 text-[9px] font-semibold transition ${approvedPostIds.has(post.id) ? 'border-brand-green/25 bg-brand-green/[.06] text-brand-green' : 'border-border-soft bg-white text-text-muted hover:border-brand-cyan/30'}`} disabled={handoffBusy} onClick={() => onToggleApproved(post.id)} type="button">{approvedPostIds.has(post.id) ? <><Check className="mr-1 inline size-3" />Approved</> : 'Approve'}</button>}
            {imageUrl && <Button disabled={busy || running || handoffBusy} onClick={() => onRegenerate(post.id)} size="sm">{busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}Regenerate · {campaign.creativeFlow.creditsPerCreative}</Button>}
            {imageUrl && <button aria-label="View full creative" className="grid size-9 place-items-center rounded-xl border border-border-soft text-text-muted hover:text-text-main" onClick={() => onOpenImage(asset?.url || imageUrl, post.hook || `Creative ${post.sequence}`)} type="button"><Eye className="size-3.5" /></button>}
          </div>
        </div>
      </article>
    })}</div>

    <div className="mt-6 rounded-[18px] border border-dashed border-brand-cyan/25 bg-white p-4 text-center"><strong className="text-xs">Stage 4 completes the campaign handoff.</strong><p className="mt-1 text-[9px] leading-4 text-text-muted">Approve the finished creatives and send them into the standard INXSocial campaign workflow. Bulk Scheduler keeps control of accounts, dates, times, ordering, scheduling and cancellations; Creative Flow does not auto-publish.</p></div>
  </div>
}
