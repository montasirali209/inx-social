import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleDot,
  Globe2,
  Image as ImageIcon,
  Layers3,
  Loader2,
  Package,
  Palette,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  WandSparkles,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { uploadPostStudioReference } from '../../lib/ai-post-studio-api'
import {
  analyzeCreativeFlow,
  planCreativeFlow,
  type CreativeFlowAnalysis,
  type CreativeFlowConcept,
  type CreativeFlowStrategy,
} from '../../lib/creative-flow-api'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { CreativeFlowCanvas, type CreativeFlowAsset } from './CreativeFlowCanvas'

type CreativeFlowView = 'setup' | 'progress' | 'results'
type CampaignGoal = 'auto' | 'sales' | 'traffic' | 'awareness' | 'launch'
type CreativeStyle = 'auto' | 'performance' | 'minimal' | 'lifestyle' | 'editorial'

const stage2Progress = [
  { label: 'Preparing product sources', detail: 'Securely preparing the website and supplied product references.' },
  { label: 'Understanding product & brand', detail: 'Reading verified website evidence and visible product/brand details.' },
  { label: 'Building campaign strategy', detail: 'Creating the audience, pillars, guardrails and creative direction.' },
  { label: 'Planning creative matrix', detail: 'Producing distinct angles, hooks and visual concepts before any image is rendered.' },
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
            <span className="rounded-full border border-brand-purple/20 bg-brand-purple/[.07] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.12em] text-brand-purple">Stage 2</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight sm:text-xl">Turn one product into a complete marketing campaign.</h2>
          <p className="mt-2 max-w-3xl text-[11px] leading-5 text-text-muted">Connect product context, campaign intent and platforms. Creative Flow now analyses the real source material and builds the creative strategy before generation.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-[9px] text-text-soft">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-white px-2.5 py-1"><Package className="size-3 text-brand-cyan" />Verified product context</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-white px-2.5 py-1"><Target className="size-3 text-brand-purple" />Real AI strategy</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-white px-2.5 py-1"><Layers3 className="size-3 text-brand-green" />5–50 concepts</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-white px-2.5 py-1"><ShieldCheck className="size-3 text-brand-cyan" />Claim guardrails</span>
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
          <strong className="mt-2 block text-[9px]">Creative matrix</strong><div className="mt-2 grid grid-cols-3 gap-1"><i className="h-7 rounded-md bg-brand-cyan/10" /><i className="h-7 rounded-md bg-brand-purple/10" /><i className="h-7 rounded-md bg-brand-green/10" /></div>
        </div>
        <span className="absolute left-[27%] top-[82px] h-px w-[42px] bg-brand-cyan/25" /><ChevronRight className="absolute left-[32%] top-[76px] size-3 text-brand-cyan/45" />
        <span className="absolute right-[30%] top-[82px] h-px w-[42px] bg-brand-cyan/25" /><ChevronRight className="absolute right-[28%] top-[76px] size-3 text-brand-cyan/45" />
      </div>
    </div>
  </Card>
}

export function CreativeFlowModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
  const [progressIndex, setProgressIndex] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [analysis, setAnalysis] = useState<CreativeFlowAnalysis | null>(null)
  const [strategy, setStrategy] = useState<CreativeFlowStrategy | null>(null)
  const [selectedConcepts, setSelectedConcepts] = useState<Set<number>>(new Set())
  const [runError, setRunError] = useState('')
  const [running, setRunning] = useState(false)
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
      if (event.key === 'Escape' && !running) {
        event.preventDefault()
        onClose()
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
  }, [open, onClose, running])

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
    if (running) return
    assets.forEach((asset) => URL.revokeObjectURL(asset.url))
    setAssets([])
    onClose()
  }

  const resetFlow = () => {
    if (running) return
    setView('setup')
    setProgressIndex(0)
    setUploadProgress(0)
    setAnalysis(null)
    setStrategy(null)
    setSelectedConcepts(new Set())
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

  return createPortal(
    <div className="fixed inset-0 z-[360] bg-slate-950/55 p-2 backdrop-blur-md sm:p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) closeFlow() }}>
      <section aria-labelledby="creative-flow-title" aria-modal="true" className="mx-auto flex h-[calc(100dvh-1rem)] w-full max-w-[1280px] flex-col overflow-hidden rounded-[24px] border border-brand-cyan/25 bg-[#f8fafc] shadow-[0_38px_130px_rgba(15,23,42,.32)] sm:h-[calc(100dvh-2rem)]" ref={dialogRef} role="dialog">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-soft bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-brand-cyan/25 bg-brand-cyan/[.08] text-brand-cyan"><WandSparkles className="size-4.5" /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2"><h2 className="truncate text-base font-semibold sm:text-lg" id="creative-flow-title">Creative Flow</h2><span className="hidden rounded-full border border-brand-purple/20 bg-brand-purple/[.06] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.12em] text-brand-purple sm:inline">Stage 2 preview</span></div>
              <p className="mt-0.5 hidden text-[10px] text-text-muted sm:block">Real product understanding and creative strategy. Rendering stays disabled until Stage 3.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view !== 'setup' && <Button disabled={running} onClick={resetFlow} size="sm" variant="ghost"><ArrowLeft className="size-3.5" />Back to flow</Button>}
            <button aria-label="Close Creative Flow" className="grid size-9 place-items-center rounded-xl border border-border-soft bg-white text-text-muted transition hover:text-text-main disabled:opacity-40" disabled={running} onClick={closeFlow} type="button"><X className="size-4" /></button>
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

          {view === 'progress' && <div className="mx-auto flex min-h-full w-full max-w-[940px] items-center p-4 sm:p-8">
            <div className="w-full rounded-[26px] border border-border-soft bg-white p-5 shadow-[0_26px_80px_rgba(15,23,42,.08)] sm:p-8">
              <div className="mx-auto max-w-2xl text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-[20px] border border-brand-cyan/25 bg-brand-cyan/[.08] text-brand-cyan">{running ? <Loader2 className="size-6 animate-spin motion-reduce:animate-none" /> : runError ? <AlertTriangle className="size-6 text-brand-amber" /> : <Check className="size-6 text-brand-green" />}</span>
                <span className="mt-5 block text-[9px] font-bold uppercase tracking-[.16em] text-brand-cyan">Creative Flow · Stage 2</span>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{runError ? 'Strategy needs another try' : 'Understanding and planning your campaign'}</h3>
                <p className="mt-2 text-xs leading-5 text-text-muted">{runError || 'This is real source analysis and campaign planning. No images are being generated and no AI credits are being deducted.'}</p>
              </div>

              <div className="mx-auto mt-8 max-w-2xl space-y-2.5">{stage2Progress.map((stage, index) => {
                const done = !runError && index < progressIndex
                const active = !runError && index === progressIndex
                return <div className={`flex items-center gap-3 rounded-2xl border p-3.5 transition duration-300 ${done ? 'border-brand-green/20 bg-brand-green/[.035]' : active ? 'border-brand-cyan/30 bg-brand-cyan/[.045] shadow-[0_10px_26px_rgba(20,184,166,.07)]' : 'border-border-soft bg-slate-50/70'}`} key={stage.label}>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl border ${done ? 'border-brand-green/25 bg-brand-green/10 text-brand-green' : active ? 'border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan' : 'border-border-soft bg-white text-text-soft'}`}>{done ? <Check className="size-4" /> : active ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <CircleDot className="size-3.5" />}</span>
                  <div className="min-w-0 flex-1"><strong className="block text-xs">{stage.label}</strong><span className="mt-0.5 block text-[9px] leading-4 text-text-muted">{stage.detail}</span></div>
                  {index === 0 && assets.length > 0 && active && <span className="shrink-0 rounded-full border border-brand-cyan/20 bg-white px-2.5 py-1 text-[9px] font-semibold text-brand-cyan">{uploadProgress}%</span>}
                </div>
              })}</div>

              <div className="mx-auto mt-4 grid max-w-2xl gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-border-soft bg-slate-50 p-3 text-[9px] leading-4 text-text-muted"><strong className="text-text-main">Stage 2 stops after planning.</strong><br />Image generation, captions, credits and publishing stay untouched.</div>
                <div className="rounded-xl border border-brand-green/15 bg-brand-green/[.035] p-3 text-[9px] leading-4 text-text-muted"><strong className="text-text-main">Source-safe.</strong><br />Unsupported statistics, testimonials and product claims are excluded from the strategy.</div>
              </div>

              {runError && <div className="mx-auto mt-5 flex max-w-2xl justify-center gap-2"><Button onClick={resetFlow}>Edit flow</Button><Button onClick={() => void beginStage2()} variant="primary"><RefreshCw className="size-3.5" />Retry</Button></div>}
            </div>
          </div>}

          {view === 'results' && strategy && analysis && <StrategyResults
            analysis={analysis}
            productName={productName}
            selectedConcepts={selectedConcepts}
            strategy={strategy}
            onBack={resetFlow}
            onRerun={() => void rerunStrategy()}
            onToggleConcept={(sequence) => setSelectedConcepts((current) => {
              const next = new Set(current)
              if (next.has(sequence)) next.delete(sequence)
              else next.add(sequence)
              return next
            })}
          />}
        </div>
      </section>
    </div>,
    document.body,
  )
}

function StrategyResults({ analysis, productName, selectedConcepts, strategy, onBack, onRerun, onToggleConcept }: {
  analysis: CreativeFlowAnalysis
  productName: string
  selectedConcepts: Set<number>
  strategy: CreativeFlowStrategy
  onBack: () => void
  onRerun: () => void
  onToggleConcept: (sequence: number) => void
}) {
  const source = analysis.sourceAnalysis
  const brand = analysis.brandPack
  return <div className="mx-auto w-full max-w-[1200px] p-4 sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <span className="text-[9px] font-bold uppercase tracking-[.16em] text-brand-green">Stage 2 strategy ready</span>
        <h3 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{strategy.strategy.campaignTitle}</h3>
        <p className="mt-1 max-w-3xl text-[10px] leading-5 text-text-muted">Creative Flow has analysed the supplied product context and planned {strategy.concepts.length} distinct concepts. Nothing has been rendered yet.</p>
      </div>
      <div className="flex flex-wrap gap-2"><Button onClick={onBack} size="sm">Edit flow</Button><Button onClick={onRerun} size="sm"><RefreshCw className="size-3.5" />Regenerate strategy</Button><Button disabled size="sm" variant="primary"><ImageIcon className="size-3.5" />Continue to generation · Stage 3</Button></div>
    </div>

    <div className="mt-5 grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
      <section className="rounded-[20px] border border-border-soft bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,.05)] sm:p-5">
        <div className="flex items-start justify-between gap-3"><div><span className="text-[8px] font-bold uppercase tracking-[.14em] text-brand-cyan">Product understanding</span><h4 className="mt-1 text-sm font-semibold">{source.productName || brand.brandName || productName || 'Product context'}</h4></div><span className={`rounded-full border px-2 py-1 text-[8px] font-bold ${brand.confidence === 'high' ? 'border-brand-green/25 bg-brand-green/[.06] text-brand-green' : brand.confidence === 'medium' ? 'border-brand-amber/25 bg-brand-amber/[.06] text-brand-amber' : 'border-border-soft bg-slate-50 text-text-muted'}`}>{brand.confidence} brand confidence</span></div>
        {source.summary && <p className="mt-3 text-[10px] leading-5 text-text-muted">{source.summary}</p>}
        {analysis.analysedUrl && <div className="mt-3 flex items-start gap-2 rounded-xl border border-border-soft bg-slate-50 p-3"><Globe2 className="mt-0.5 size-3.5 shrink-0 text-brand-cyan" /><div className="min-w-0"><strong className="block truncate text-[9px]">{analysis.analysedUrl.title || analysis.analysedUrl.url}</strong><span className="mt-0.5 block truncate text-[8px] text-text-soft">{analysis.analysedUrl.url}</span></div></div>}
        {brand.colors.length > 0 && <div className="mt-4"><span className="text-[8px] font-bold uppercase tracking-[.12em] text-text-soft">Extracted palette</span><div className="mt-2 flex flex-wrap gap-2">{brand.colors.map((color) => <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-white px-2 py-1 text-[8px] text-text-muted" key={color}><i className="size-3 rounded-full border border-black/10" style={{ backgroundColor: color }} />{color}</span>)}</div></div>}
        {source.verifiedClaims.length > 0 && <div className="mt-4"><span className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.12em] text-text-soft"><BadgeCheck className="size-3 text-brand-green" />Verified claims</span><ul className="mt-2 space-y-1.5 text-[9px] leading-4 text-text-muted">{source.verifiedClaims.slice(0, 5).map((item) => <li key={item}>• {item}</li>)}</ul></div>}
        {source.cautions.length > 0 && <div className="mt-4 rounded-xl border border-brand-amber/20 bg-brand-amber/[.04] p-3"><span className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.12em] text-brand-amber"><AlertTriangle className="size-3" />Guardrails</span><ul className="mt-1.5 space-y-1 text-[8px] leading-4 text-text-muted">{source.cautions.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}</ul></div>}
      </section>

      <section className="rounded-[20px] border border-border-soft bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,.05)] sm:p-5">
        <span className="text-[8px] font-bold uppercase tracking-[.14em] text-brand-purple">Campaign strategy</span>
        <p className="mt-2 text-[10px] leading-5 text-text-muted">{strategy.strategy.strategySummary}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border-soft bg-slate-50 p-3"><span className="text-[8px] font-bold uppercase tracking-[.12em] text-text-soft">Audience</span><p className="mt-1.5 text-[9px] leading-4 text-text-muted">{strategy.strategy.audienceSummary || 'AI-selected from the supplied brief and source context.'}</p></div>
          <div className="rounded-xl border border-border-soft bg-slate-50 p-3"><span className="text-[8px] font-bold uppercase tracking-[.12em] text-text-soft">Brand handling</span><p className="mt-1.5 text-[9px] leading-4 text-text-muted">{brand.lockLogo ? 'Official logo detected. Stage 3 will preserve it rather than inventing a replacement.' : 'No verified full logo lock yet. Creative Flow will not invent one.'}</p></div>
        </div>
        {strategy.strategy.contentPillars.length > 0 && <div className="mt-4"><span className="text-[8px] font-bold uppercase tracking-[.12em] text-text-soft">Content pillars</span><div className="mt-2 flex flex-wrap gap-1.5">{strategy.strategy.contentPillars.map((item) => <span className="rounded-full border border-brand-purple/15 bg-brand-purple/[.035] px-2.5 py-1 text-[8px] text-text-muted" key={item}>{item}</span>)}</div></div>}
        {strategy.strategy.creativePrinciples.length > 0 && <div className="mt-4"><span className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.12em] text-text-soft"><Palette className="size-3" />Creative principles</span><ul className="mt-2 grid gap-1.5 text-[9px] leading-4 text-text-muted sm:grid-cols-2">{strategy.strategy.creativePrinciples.map((item) => <li className="rounded-lg border border-border-soft bg-slate-50 px-2.5 py-2" key={item}>{item}</li>)}</ul></div>}
      </section>
    </div>

    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><span className="text-[8px] font-bold uppercase tracking-[.14em] text-brand-cyan">Creative matrix</span><h4 className="mt-1 text-lg font-semibold">{strategy.concepts.length} planned creatives</h4><p className="mt-1 text-[9px] text-text-muted">Keep or remove concepts before Stage 3. Every card has a different strategic angle.</p></div><span className="rounded-full border border-brand-green/20 bg-brand-green/[.05] px-3 py-1.5 text-[9px] font-semibold text-brand-green">{selectedConcepts.size} kept</span></div>

    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{strategy.concepts.map((concept) => <ConceptCard concept={concept} kept={selectedConcepts.has(concept.sequence)} key={concept.sequence} onToggle={() => onToggleConcept(concept.sequence)} />)}</div>

    <div className="mt-5 rounded-[18px] border border-dashed border-brand-cyan/25 bg-white p-4 text-center"><strong className="text-xs">Stage 2 ends here.</strong><p className="mt-1 text-[9px] leading-4 text-text-muted">Stage 3 will take the kept matrix rows, calculate credits, queue image generation, save completed assets and expose review/regeneration controls.</p></div>
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
    {concept.cta && <p className="mt-3 text-[8px] text-text-soft"><strong className="text-text-muted">CTA:</strong> {concept.cta}</p>}
  </article>
}
