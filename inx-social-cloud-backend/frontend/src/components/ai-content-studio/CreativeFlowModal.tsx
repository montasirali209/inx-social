import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  FileImage,
  Globe2,
  Image as ImageIcon,
  Layers3,
  Loader2,
  Megaphone,
  Package,
  Palette,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

type CreativeFlowView = 'setup' | 'progress' | 'results'
type CampaignGoal = 'auto' | 'sales' | 'traffic' | 'awareness' | 'launch'
type CreativeStyle = 'auto' | 'performance' | 'minimal' | 'lifestyle' | 'editorial'

type UploadedAsset = {
  id: string
  name: string
  url: string
}

type MockCreative = {
  id: string
  angle: string
  hook: string
  style: string
  caption: string
  approved: boolean
  tone: string
}

const platforms = ['Facebook', 'Instagram', 'X', 'LinkedIn'] as const
const countOptions = [5, 10, 20, 50] as const

const progressStages = [
  { label: 'Understanding product', detail: 'Reading the brief, website and supplied assets.' },
  { label: 'Building campaign strategy', detail: 'Choosing distinct angles for the selected platforms.' },
  { label: 'Planning creative concepts', detail: 'Creating a varied creative matrix before rendering.' },
  { label: 'Generating creatives', detail: 'Producing campaign visuals from separate concepts.' },
  { label: 'Writing captions', detail: 'Preparing platform-aware captions and hashtags.' },
  { label: 'Preparing campaign', detail: 'Organising everything for review.' },
]

const creativeAngles = [
  ['Problem → solution', 'Stop losing hours to repetitive social publishing.', 'Bold performance ad'],
  ['Product benefit', 'One place to create, organise and publish.', 'Minimal product hero'],
  ['Feature spotlight', 'Create. Schedule. Analyse. Without the tab chaos.', 'Product interface'],
  ['Educational', 'Three ways to simplify your weekly content workflow.', 'Editorial infographic'],
  ['Transformation', 'From scattered content to one organised campaign.', 'Before / after'],
  ['Speed', 'Turn one campaign idea into a complete content plan.', 'High-contrast ad'],
  ['Trust', 'Built for teams that need consistency without complexity.', 'Clean editorial'],
  ['Workflow', 'Plan once. Publish everywhere.', 'Process visual'],
  ['Audience pain', 'Still posting one channel at a time?', 'Problem-led ad'],
  ['Value', 'More campaign output from one clear brief.', 'Product-led visual'],
  ['Launch', 'Your next campaign, already organised.', 'Launch announcement'],
  ['Social proof structure', 'A campaign system designed around repeatable workflows.', 'Proof-led layout'],
]

const toneBackgrounds = [
  'from-[#ecfdf5] via-white to-[#dff9f4]',
  'from-[#f5f3ff] via-white to-[#ede9fe]',
  'from-[#eff6ff] via-white to-[#e0f2fe]',
  'from-[#fff7ed] via-white to-[#fef3c7]',
  'from-[#fdf2f8] via-white to-[#fae8ff]',
  'from-[#f0fdfa] via-white to-[#ccfbf1]',
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
            <span className="rounded-full border border-brand-purple/20 bg-brand-purple/[.07] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.12em] text-brand-purple">New</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight sm:text-xl">Turn one product into a complete marketing campaign.</h2>
          <p className="mt-2 max-w-3xl text-[11px] leading-5 text-text-muted">Add your product, tell INXSocial what you want, choose platforms and output count, then review a complete set of distinct campaign creatives.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-[9px] text-text-soft">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-white px-2.5 py-1"><Package className="size-3 text-brand-cyan" />Product source</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-white px-2.5 py-1"><Target className="size-3 text-brand-purple" />Creative strategy</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-white px-2.5 py-1"><Layers3 className="size-3 text-brand-green" />5–50 creatives</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-white px-2.5 py-1"><Send className="size-3 text-brand-cyan" />Campaign-ready</span>
          </div>
          <Button className="mt-5" onClick={onOpen} size="sm" variant="primary"><Sparkles className="size-3.5" />Open Creative Flow <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" /></Button>
        </div>
      </div>

      <div aria-hidden="true" className="relative hidden min-h-[170px] lg:block">
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-brand-cyan/25 to-transparent" />
        <div className="absolute left-[7%] top-[42px] w-[106px] rounded-2xl border border-border-soft bg-white p-3 shadow-[0_14px_38px_rgba(15,23,42,.08)] transition duration-300 group-hover:-translate-x-1">
          <span className="grid size-8 place-items-center rounded-xl bg-brand-cyan/[.09] text-brand-cyan"><Package className="size-4" /></span>
          <strong className="mt-2 block text-[9px]">Product</strong>
          <span className="mt-1 block h-1.5 w-12 rounded-full bg-slate-100" />
        </div>
        <div className="absolute left-[37%] top-[22px] w-[112px] rounded-2xl border border-border-soft bg-white p-3 shadow-[0_14px_38px_rgba(15,23,42,.08)] transition duration-300 group-hover:-translate-y-1">
          <span className="grid size-8 place-items-center rounded-xl bg-brand-purple/[.09] text-brand-purple"><Target className="size-4" /></span>
          <strong className="mt-2 block text-[9px]">Strategy</strong>
          <div className="mt-2 flex gap-1"><i className="h-1.5 w-7 rounded-full bg-brand-purple/20" /><i className="h-1.5 w-5 rounded-full bg-brand-cyan/20" /></div>
        </div>
        <div className="absolute right-[6%] top-[50px] w-[118px] rounded-2xl border border-brand-cyan/20 bg-white p-3 shadow-[0_18px_44px_rgba(20,184,166,.10)] transition duration-300 group-hover:translate-x-1">
          <span className="grid size-8 place-items-center rounded-xl bg-brand-green/[.09] text-brand-green"><ImageIcon className="size-4" /></span>
          <strong className="mt-2 block text-[9px]">Creatives</strong>
          <div className="mt-2 grid grid-cols-3 gap-1"><i className="h-7 rounded-md bg-brand-cyan/10" /><i className="h-7 rounded-md bg-brand-purple/10" /><i className="h-7 rounded-md bg-brand-green/10" /></div>
        </div>
        <span className="absolute left-[28%] top-[78px] h-px w-[42px] bg-brand-cyan/25" />
        <ChevronRight className="absolute left-[33%] top-[72px] size-3 text-brand-cyan/45" />
        <span className="absolute right-[29%] top-[78px] h-px w-[42px] bg-brand-cyan/25" />
        <ChevronRight className="absolute right-[27%] top-[72px] size-3 text-brand-cyan/45" />
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
  const [assets, setAssets] = useState<UploadedAsset[]>([])
  const [progressIndex, setProgressIndex] = useState(0)
  const [generatedCount, setGeneratedCount] = useState(0)
  const [approved, setApproved] = useState<Set<string>>(new Set())
  const dialogRef = useRef<HTMLElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const resolvedCount = Math.max(1, Math.min(100, Number(customCount || creativeCount) || 20))
  const mockCreatives = useMemo<MockCreative[]>(() => {
    const total = Math.min(resolvedCount, 12)
    const product = productName.trim() || 'your product'
    return Array.from({ length: total }, (_, index) => {
      const source = creativeAngles[index % creativeAngles.length]
      return {
        id: `creative-${index + 1}`,
        angle: source[0],
        hook: source[1].replace('your', product === 'your product' ? 'your' : product),
        style: source[2],
        caption: `A campaign-ready caption for ${product}, structured for ${selectedPlatforms.join(' + ') || 'social media'} with a clear hook, concise value and relevant hashtags.`,
        approved: false,
        tone: toneBackgrounds[index % toneBackgrounds.length],
      }
    })
  }, [productName, resolvedCount, selectedPlatforms])

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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
  }, [open, onClose])

  useEffect(() => {
    if (!open || view !== 'progress') return
    setProgressIndex(0)
    setGeneratedCount(0)

    const timers: number[] = []
    progressStages.forEach((_, index) => {
      timers.push(window.setTimeout(() => {
        setProgressIndex(index)
        if (index === 3) setGeneratedCount(Math.max(1, Math.round(resolvedCount * .25)))
        if (index === 4) setGeneratedCount(Math.max(2, Math.round(resolvedCount * .72)))
        if (index === 5) setGeneratedCount(resolvedCount)
      }, index * 850))
    })
    timers.push(window.setTimeout(() => setView('results'), progressStages.length * 850 + 550))

    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [open, resolvedCount, view])

  useEffect(() => {
    if (open) return
    setAssets((current) => {
      current.forEach((asset) => URL.revokeObjectURL(asset.url))
      return []
    })
  }, [open])

  if (!open) return null

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((current) => current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform])
  }

  const addAssets = (files: File[]) => {
    const next = files.filter((file) => file.type.startsWith('image/')).slice(0, Math.max(0, 8 - assets.length)).map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      url: URL.createObjectURL(file),
    }))
    setAssets((current) => [...current, ...next].slice(0, 8))
  }

  const removeAsset = (id: string) => {
    setAssets((current) => {
      const target = current.find((asset) => asset.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return current.filter((asset) => asset.id !== id)
    })
  }

  const resetFlow = () => {
    setView('setup')
    setProgressIndex(0)
    setGeneratedCount(0)
    setApproved(new Set())
  }

  const canGenerate = Boolean(prompt.trim() || productName.trim() || website.trim() || assets.length)

  return createPortal(
    <div className="fixed inset-0 z-[360] bg-slate-950/55 p-2 backdrop-blur-md sm:p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
      <section aria-labelledby="creative-flow-title" aria-modal="true" className="mx-auto flex h-[calc(100dvh-1rem)] w-full max-w-[1240px] flex-col overflow-hidden rounded-[24px] border border-brand-cyan/25 bg-[#f8fafc] shadow-[0_38px_130px_rgba(15,23,42,.32)] sm:h-[calc(100dvh-2rem)]" ref={dialogRef} role="dialog">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-soft bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-brand-cyan/25 bg-brand-cyan/[.08] text-brand-cyan"><WandSparkles className="size-4.5" /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-base font-semibold sm:text-lg" id="creative-flow-title">Creative Flow</h2>
                <span className="hidden rounded-full border border-brand-purple/20 bg-brand-purple/[.06] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.12em] text-brand-purple sm:inline">Stage 1 preview</span>
              </div>
              <p className="mt-0.5 hidden text-[10px] text-text-muted sm:block">Simple campaign creation first. Advanced controls stay optional.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view !== 'setup' && <Button onClick={resetFlow} size="sm" variant="ghost"><ArrowLeft className="size-3.5" />Start over</Button>}
            <button aria-label="Close Creative Flow" className="grid size-9 place-items-center rounded-xl border border-border-soft bg-white text-text-muted transition hover:text-text-main" onClick={onClose} type="button"><X className="size-4" /></button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {view === 'setup' && <div className="mx-auto grid w-full max-w-[1140px] gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_330px]">
            <main className="space-y-4">
              <section className="rounded-[20px] border border-border-soft bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,.045)] sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-cyan/[.08] text-brand-cyan"><Package className="size-4" /></span>
                  <div><h3 className="text-sm font-semibold">1. Add your product</h3><p className="mt-1 text-[10px] leading-4 text-text-muted">A website, product name or a few product images is enough to start.</p></div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block"><span className="text-[10px] font-semibold text-text-muted">Website URL <span className="font-normal text-text-soft">optional</span></span><div className="relative mt-1.5"><Globe2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-soft" /><input className="min-h-11 w-full rounded-xl border border-border-soft bg-slate-50 pl-10 pr-3 text-xs outline-none transition focus:border-brand-cyan focus:bg-white focus:ring-2 focus:ring-brand-cyan/10" onChange={(event) => setWebsite(event.target.value)} placeholder="https://yourbrand.com" type="url" value={website} /></div></label>
                  <label className="block"><span className="text-[10px] font-semibold text-text-muted">Product name <span className="font-normal text-text-soft">optional</span></span><input className="mt-1.5 min-h-11 w-full rounded-xl border border-border-soft bg-slate-50 px-3 text-xs outline-none transition focus:border-brand-cyan focus:bg-white focus:ring-2 focus:ring-brand-cyan/10" onChange={(event) => setProductName(event.target.value)} placeholder="e.g. INXSocial" value={productName} /></label>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between gap-3"><span className="text-[10px] font-semibold text-text-muted">Product images / logo <span className="font-normal text-text-soft">optional · up to 8</span></span>{assets.length > 0 && <span className="text-[9px] text-text-soft">{assets.length}/8</span>}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {assets.map((asset) => <figure className="group relative size-20 overflow-hidden rounded-xl border border-border-soft bg-slate-50" key={asset.id}><img alt="" className="size-full object-cover" src={asset.url} /><button aria-label={`Remove ${asset.name}`} className="absolute right-1 top-1 grid size-6 place-items-center rounded-lg bg-black/65 text-white opacity-0 transition group-hover:opacity-100" onClick={() => removeAsset(asset.id)} type="button"><X className="size-3" /></button></figure>)}
                    {assets.length < 8 && <button className="grid size-20 place-items-center rounded-xl border border-dashed border-brand-cyan/30 bg-brand-cyan/[.025] text-center text-brand-cyan transition hover:border-brand-cyan/55 hover:bg-brand-cyan/[.055]" onClick={() => fileInput.current?.click()} type="button"><span><Upload className="mx-auto size-4" /><span className="mt-1 block text-[8px] font-semibold">Add image</span></span></button>}
                  </div>
                  <input accept="image/png,image/jpeg,image/webp" className="sr-only" multiple onChange={(event) => { addAssets(Array.from(event.target.files || [])); event.target.value = '' }} ref={fileInput} type="file" />
                </div>
              </section>

              <section className="rounded-[20px] border border-border-soft bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,.045)] sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-purple/[.08] text-brand-purple"><Megaphone className="size-4" /></span>
                  <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">2. What do you want to create?</h3><p className="mt-1 text-[10px] leading-4 text-text-muted">Describe the campaign in normal language. Creative Flow handles the structure.</p></div>
                </div>
                <textarea className="mt-4 min-h-32 w-full resize-y rounded-2xl border border-border-soft bg-slate-50 p-3.5 text-xs leading-5 outline-none transition placeholder:text-text-soft focus:border-brand-cyan focus:bg-white focus:ring-2 focus:ring-brand-cyan/10" onChange={(event) => setPrompt(event.target.value)} placeholder="Example: Create a campaign for our social media scheduling product focused on small businesses. Make the visuals feel modern, useful and credible. Focus on saving time and managing every channel in one place." value={prompt} />
              </section>

              <section className="rounded-[20px] border border-border-soft bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,.045)] sm:p-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-brand-green/[.08] text-brand-green"><Send className="size-3.5" /></span><div><h3 className="text-xs font-semibold">3. Platforms</h3><p className="mt-0.5 text-[9px] text-text-muted">Choose where the campaign will be used.</p></div></div>
                    <div className="mt-3 flex flex-wrap gap-2">{platforms.map((platform) => {
                      const active = selectedPlatforms.includes(platform)
                      return <button aria-pressed={active} className={`rounded-full border px-3 py-2 text-[10px] font-semibold transition ${active ? 'border-brand-cyan/45 bg-brand-cyan/[.08] text-brand-teal' : 'border-border-soft bg-slate-50 text-text-muted hover:bg-white'}`} key={platform} onClick={() => togglePlatform(platform)} type="button">{active && <Check className="mr-1 inline size-3" />}{platform}</button>
                    })}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-brand-cyan/[.08] text-brand-cyan"><Layers3 className="size-3.5" /></span><div><h3 className="text-xs font-semibold">4. Number of creatives</h3><p className="mt-0.5 text-[9px] text-text-muted">Start small or build a full campaign set.</p></div></div>
                    <div className="mt-3 flex flex-wrap gap-2">{countOptions.map((count) => <button aria-pressed={!customCount && creativeCount === count} className={`min-w-12 rounded-xl border px-3 py-2 text-[10px] font-semibold transition ${!customCount && creativeCount === count ? 'border-brand-cyan/45 bg-brand-cyan/[.08] text-brand-teal' : 'border-border-soft bg-slate-50 text-text-muted'}`} key={count} onClick={() => { setCreativeCount(count); setCustomCount('') }} type="button">{count}</button>)}<input aria-label="Custom creative count" className="min-h-9 w-20 rounded-xl border border-border-soft bg-slate-50 px-2 text-center text-[10px] outline-none focus:border-brand-cyan focus:bg-white" max={100} min={1} onChange={(event) => setCustomCount(event.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="Custom" value={customCount} /></div>
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-[20px] border border-border-soft bg-white shadow-[0_10px_30px_rgba(15,23,42,.045)]">
                <button aria-expanded={advancedOpen} className="flex w-full items-center justify-between gap-3 p-4 text-left sm:p-5" onClick={() => setAdvancedOpen((current) => !current)} type="button"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-slate-100 text-text-muted"><Palette className="size-4" /></span><div><h3 className="text-sm font-semibold">Advanced options</h3><p className="mt-1 text-[10px] text-text-muted">Optional. AI Recommended works for most campaigns.</p></div></div><ChevronDown className={`size-4 text-text-soft transition-transform ${advancedOpen ? 'rotate-180' : ''}`} /></button>
                {advancedOpen && <div className="grid gap-4 border-t border-border-soft bg-slate-50/65 p-4 sm:grid-cols-3 sm:p-5">
                  <label><span className="text-[10px] font-semibold text-text-muted">Campaign goal</span><select className="mt-1.5 min-h-10 w-full rounded-xl border border-border-soft bg-white px-3 text-xs outline-none focus:border-brand-cyan" onChange={(event) => setGoal(event.target.value as CampaignGoal)} value={goal}><option value="auto">AI Recommended</option><option value="sales">Sales</option><option value="traffic">Traffic</option><option value="awareness">Awareness</option><option value="launch">Product launch</option></select></label>
                  <label><span className="text-[10px] font-semibold text-text-muted">Creative style</span><select className="mt-1.5 min-h-10 w-full rounded-xl border border-border-soft bg-white px-3 text-xs outline-none focus:border-brand-cyan" onChange={(event) => setStyle(event.target.value as CreativeStyle)} value={style}><option value="auto">AI Recommended</option><option value="performance">Performance ads</option><option value="minimal">Minimal</option><option value="lifestyle">Lifestyle</option><option value="editorial">Editorial / infographic</option></select></label>
                  <label><span className="text-[10px] font-semibold text-text-muted">Audience</span><input className="mt-1.5 min-h-10 w-full rounded-xl border border-border-soft bg-white px-3 text-xs outline-none focus:border-brand-cyan" onChange={(event) => setAudience(event.target.value)} placeholder="AI Recommended" value={audience} /></label>
                </div>}
              </section>
            </main>

            <aside className="lg:sticky lg:top-5 lg:self-start">
              <section className="rounded-[22px] border border-brand-cyan/20 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,.07)]">
                <div className="flex items-center justify-between gap-3"><div><span className="text-[8px] font-bold uppercase tracking-[.14em] text-brand-cyan">Campaign summary</span><h3 className="mt-1 text-sm font-semibold">Ready when you are</h3></div><span className="grid size-10 place-items-center rounded-2xl bg-brand-cyan/[.08] text-brand-cyan"><Sparkles className="size-4" /></span></div>
                <div className="mt-5 space-y-3">
                  <SummaryRow icon={Package} label="Product" value={productName.trim() || website.trim() || (assets.length ? `${assets.length} uploaded asset${assets.length === 1 ? '' : 's'}` : 'Not added yet')} />
                  <SummaryRow icon={Send} label="Platforms" value={selectedPlatforms.length ? selectedPlatforms.join(', ') : 'Platform-neutral'} />
                  <SummaryRow icon={Layers3} label="Output" value={`${resolvedCount} creatives`} />
                  <SummaryRow icon={Target} label="Goal" value={goal === 'auto' ? 'AI Recommended' : goal.replaceAll('_', ' ')} />
                </div>
                <div className="mt-5 rounded-2xl border border-brand-purple/15 bg-brand-purple/[.035] p-3.5"><div className="flex items-start gap-2"><CircleDot className="mt-0.5 size-3.5 shrink-0 text-brand-purple" /><p className="text-[9px] leading-4 text-text-muted"><strong className="text-text-main">Stage 1 UI preview.</strong> This demo uses sample concepts only. No provider requests, credits, database writes or publishing actions run from this screen.</p></div></div>
                <Button className="mt-5 w-full" disabled={!canGenerate} onClick={() => setView('progress')} variant="primary"><WandSparkles className="size-4" />Generate campaign</Button>
                {!canGenerate && <p className="mt-2 text-center text-[9px] text-text-soft">Add a product, website, image or campaign brief to continue.</p>}
              </section>
            </aside>
          </div>}

          {view === 'progress' && <div className="mx-auto flex min-h-full w-full max-w-[980px] items-center p-4 sm:p-8">
            <div className="w-full rounded-[26px] border border-border-soft bg-white p-5 shadow-[0_26px_80px_rgba(15,23,42,.08)] sm:p-8">
              <div className="mx-auto max-w-2xl text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-[20px] border border-brand-cyan/25 bg-brand-cyan/[.08] text-brand-cyan"><Loader2 className="size-6 animate-spin motion-reduce:animate-none" /></span>
                <span className="mt-5 block text-[9px] font-bold uppercase tracking-[.16em] text-brand-cyan">Creative Flow is working</span>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Building your campaign</h3>
                <p className="mt-2 text-xs leading-5 text-text-muted">A simple progress view for the customer. The production engine will eventually continue even if this window is closed.</p>
              </div>
              <div className="mx-auto mt-8 max-w-2xl space-y-2.5">{progressStages.map((stage, index) => {
                const done = index < progressIndex
                const active = index === progressIndex
                return <div className={`flex items-center gap-3 rounded-2xl border p-3.5 transition duration-300 ${done ? 'border-brand-green/20 bg-brand-green/[.035]' : active ? 'border-brand-cyan/30 bg-brand-cyan/[.045] shadow-[0_10px_26px_rgba(20,184,166,.07)]' : 'border-border-soft bg-slate-50/70'}`} key={stage.label}>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl border ${done ? 'border-brand-green/25 bg-brand-green/10 text-brand-green' : active ? 'border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan' : 'border-border-soft bg-white text-text-soft'}`}>{done ? <Check className="size-4" /> : active ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <CircleDot className="size-3.5" />}</span>
                  <div className="min-w-0 flex-1"><strong className="block text-xs">{stage.label}</strong><span className="mt-0.5 block text-[9px] leading-4 text-text-muted">{stage.detail}</span></div>
                  {index === 3 && (active || done) && <span className="shrink-0 rounded-full border border-brand-cyan/20 bg-white px-2.5 py-1 text-[9px] font-semibold text-brand-cyan">{generatedCount}/{resolvedCount}</span>}
                </div>
              })}</div>
            </div>
          </div>}

          {view === 'results' && <div className="mx-auto w-full max-w-[1180px] p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div><span className="text-[9px] font-bold uppercase tracking-[.16em] text-brand-green">Campaign ready</span><h3 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{resolvedCount} creative concepts prepared</h3><p className="mt-1 max-w-2xl text-[10px] leading-5 text-text-muted">Stage 1 uses visual placeholders so we can approve the gallery experience before connecting real generation.</p></div>
              <div className="flex flex-wrap gap-2"><Button onClick={resetFlow} size="sm"><RefreshCw className="size-3.5" />Adjust brief</Button><Button disabled size="sm" variant="primary"><Send className="size-3.5" />Add to campaign</Button></div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-[9px]"><span className="rounded-full border border-border-soft bg-white px-3 py-1.5">{resolvedCount} total</span><span className="rounded-full border border-brand-green/20 bg-brand-green/[.05] px-3 py-1.5 text-brand-green">{approved.size} approved</span><span className="rounded-full border border-brand-amber/20 bg-brand-amber/[.05] px-3 py-1.5 text-brand-amber">{Math.max(0, resolvedCount - approved.size)} to review</span><span className="ml-auto text-text-soft">Campaign handoff is intentionally disabled in Stage 1.</span></div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {mockCreatives.map((creative, index) => {
                const isApproved = approved.has(creative.id)
                return <article className={`group overflow-hidden rounded-[20px] border bg-white shadow-[0_12px_36px_rgba(15,23,42,.055)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_46px_rgba(15,23,42,.09)] ${isApproved ? 'border-brand-green/35 ring-1 ring-brand-green/10' : 'border-border-soft'}`} key={creative.id}>
                  <div className={`relative aspect-[4/5] overflow-hidden bg-gradient-to-br ${creative.tone} p-4`}>
                    <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(15,23,42,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,.025)_1px,transparent_1px)] [background-size:24px_24px]" />
                    <div className="relative flex h-full flex-col">
                      <div className="flex items-center justify-between gap-2"><span className="rounded-full border border-black/[.06] bg-white/85 px-2 py-1 text-[8px] font-bold uppercase tracking-[.11em] text-text-muted">Concept {String(index + 1).padStart(2, '0')}</span>{isApproved && <span className="grid size-7 place-items-center rounded-full bg-brand-green text-white shadow"><BadgeCheck className="size-3.5" /></span>}</div>
                      <div className="my-auto">
                        <span className="text-[9px] font-bold uppercase tracking-[.14em] text-brand-teal">{creative.angle}</span>
                        <h4 className="mt-2 max-w-[90%] text-xl font-semibold leading-[1.05] tracking-[-.035em] text-slate-900">{creative.hook}</h4>
                        <p className="mt-3 max-w-[85%] text-[9px] leading-4 text-slate-500">{creative.style}</p>
                      </div>
                      <div className="flex items-end justify-between"><span className="grid size-11 place-items-center rounded-2xl border border-white/80 bg-white/75 text-brand-cyan shadow-sm backdrop-blur"><ImageIcon className="size-4" /></span><span className="text-[8px] font-semibold text-slate-400">{productName || 'BRAND'}</span></div>
                    </div>
                  </div>
                  <div className="p-3.5">
                    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><strong className="block truncate text-[11px]">{creative.angle}</strong><span className="mt-1 block text-[9px] text-text-soft">{creative.style}</span></div><button className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[9px] font-semibold transition ${isApproved ? 'border-brand-green/25 bg-brand-green/[.07] text-brand-green' : 'border-border-soft bg-slate-50 text-text-muted hover:border-brand-cyan/30'}`} onClick={() => setApproved((current) => { const next = new Set(current); if (next.has(creative.id)) next.delete(creative.id); else next.add(creative.id); return next })} type="button">{isApproved ? 'Approved' : 'Approve'}</button></div>
                    <p className="mt-3 line-clamp-3 text-[9px] leading-4 text-text-muted">{creative.caption}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2"><Button disabled size="sm" variant="ghost">Edit</Button><Button disabled size="sm" variant="ghost">Variation</Button></div>
                  </div>
                </article>
              })}
            </div>
            {resolvedCount > mockCreatives.length && <div className="mt-4 rounded-2xl border border-dashed border-border-soft bg-white p-4 text-center text-[10px] text-text-muted">Showing {mockCreatives.length} gallery placeholders in Stage 1. The production gallery will support all {resolvedCount} generated creatives.</div>}
          </div>}
        </div>
      </section>
    </div>,
    document.body,
  )
}

function SummaryRow({ icon: Icon, label, value }: { icon: typeof Package; label: string; value: string }) {
  return <div className="flex items-start gap-3 rounded-xl border border-border-soft bg-slate-50 p-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-brand-cyan shadow-sm"><Icon className="size-3.5" /></span><div className="min-w-0"><span className="block text-[8px] font-bold uppercase tracking-[.12em] text-text-soft">{label}</span><strong className="mt-1 block truncate text-[10px] font-semibold capitalize">{value}</strong></div></div>
}
