import {
  Check,
  ChevronDown,
  Globe2,
  Image as ImageIcon,
  Layers3,
  Minus,
  Package,
  Palette,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react'
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Button } from '../ui/Button'

export type CreativeFlowNodeId = 'product' | 'brief' | 'platforms' | 'strategy' | 'generate' | 'review'

export type CreativeFlowAsset = {
  id: string
  name: string
  url: string
  file: File
  referenceId?: string
}

type Position = { x: number; y: number }

type Props = {
  website: string
  productName: string
  prompt: string
  selectedPlatforms: string[]
  creativeCount: number
  customCount: string
  advancedOpen: boolean
  goal: string
  style: string
  audience: string
  assets: CreativeFlowAsset[]
  onWebsiteChange: (value: string) => void
  onProductNameChange: (value: string) => void
  onPromptChange: (value: string) => void
  onTogglePlatform: (platform: string) => void
  onCreativeCountChange: (value: number) => void
  onCustomCountChange: (value: string) => void
  onAdvancedToggle: () => void
  onGoalChange: (value: string) => void
  onStyleChange: (value: string) => void
  onAudienceChange: (value: string) => void
  onAddAssets: (files: File[]) => void
  onRemoveAsset: (id: string) => void
  onRun: () => void
  canRun: boolean
}

const NODE_W = 210
const NODE_H = 116
const canvasWidth = 1180
const canvasHeight = 650

const defaultPositions: Record<CreativeFlowNodeId, Position> = {
  product: { x: 36, y: 240 },
  brief: { x: 272, y: 115 },
  platforms: { x: 272, y: 365 },
  strategy: { x: 505, y: 240 },
  generate: { x: 732, y: 240 },
  review: { x: 955, y: 240 },
}

const connections: Array<[CreativeFlowNodeId, CreativeFlowNodeId]> = [
  ['product', 'brief'],
  ['product', 'platforms'],
  ['brief', 'strategy'],
  ['platforms', 'strategy'],
  ['strategy', 'generate'],
  ['generate', 'review'],
]

const platforms = ['Facebook', 'Instagram', 'X', 'LinkedIn'] as const
const counts = [5, 10, 20, 50] as const

export function CreativeFlowCanvas(props: Props) {
  const [positions, setPositions] = useState(defaultPositions)
  const [selectedNode, setSelectedNode] = useState<CreativeFlowNodeId>('product')
  const [zoom, setZoom] = useState(0.86)
  const [dragging, setDragging] = useState<CreativeFlowNodeId | null>(null)
  const dragRef = useRef<{ id: CreativeFlowNodeId; pointerId: number; offsetX: number; offsetY: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const resolvedCount = Math.max(1, Math.min(50, Number(props.customCount || props.creativeCount) || 20))

  const connectionPaths = useMemo(() => connections.map(([from, to]) => {
    const a = positions[from]
    const b = positions[to]
    const x1 = a.x + NODE_W
    const y1 = a.y + NODE_H / 2
    const x2 = b.x
    const y2 = b.y + NODE_H / 2
    const bend = Math.max(60, Math.abs(x2 - x1) * .48)
    return {
      key: `${from}-${to}`,
      path: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
    }
  }), [positions])

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, id: CreativeFlowNodeId) => {
    if (event.button !== 0) return
    const canvas = canvasRef.current
    if (!canvas) return
    event.preventDefault()
    event.stopPropagation()
    const bounds = canvas.getBoundingClientRect()
    const node = positions[id]
    dragRef.current = {
      id,
      pointerId: event.pointerId,
      offsetX: (event.clientX - bounds.left) / zoom - node.x,
      offsetY: (event.clientY - bounds.top) / zoom - node.y,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDragging(id)
    setSelectedNode(id)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    const canvas = canvasRef.current
    if (!drag || !canvas || drag.pointerId !== event.pointerId) return
    const bounds = canvas.getBoundingClientRect()
    const nextX = Math.max(16, Math.min(canvasWidth - NODE_W - 16, (event.clientX - bounds.left) / zoom - drag.offsetX))
    const nextY = Math.max(16, Math.min(canvasHeight - NODE_H - 16, (event.clientY - bounds.top) / zoom - drag.offsetY))
    setPositions((current) => ({ ...current, [drag.id]: { x: nextX, y: nextY } }))
  }

  const finishDrag = () => {
    dragRef.current = null
    setDragging(null)
  }

  const resetCanvas = () => {
    setPositions(defaultPositions)
    setZoom(0.86)
    setSelectedNode('product')
  }

  return <div className="grid min-h-[620px] lg:grid-cols-[minmax(0,1fr)_330px]">
    <input accept="image/png,image/jpeg,image/webp" className="sr-only" multiple onChange={(event) => { props.onAddAssets(Array.from(event.target.files || [])); event.target.value = '' }} ref={fileInput} type="file" />
    <div className="relative min-w-0 overflow-hidden border-b border-border-soft bg-[#f5f7fb] lg:border-b-0 lg:border-r">
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-xl border border-border-soft bg-white/95 p-1.5 shadow-sm backdrop-blur">
        <button aria-label="Zoom out" className="grid size-8 place-items-center rounded-lg text-text-muted transition hover:bg-slate-100 hover:text-text-main" onClick={() => setZoom((value) => Math.max(.62, Number((value - .08).toFixed(2))))} type="button"><Minus className="size-3.5" /></button>
        <span className="min-w-10 text-center text-[9px] font-semibold text-text-soft">{Math.round(zoom * 100)}%</span>
        <button aria-label="Zoom in" className="grid size-8 place-items-center rounded-lg text-text-muted transition hover:bg-slate-100 hover:text-text-main" onClick={() => setZoom((value) => Math.min(1.15, Number((value + .08).toFixed(2))))} type="button"><Plus className="size-3.5" /></button>
        <span className="mx-1 h-5 w-px bg-border-soft" />
        <button aria-label="Reset canvas" className="grid size-8 place-items-center rounded-lg text-text-muted transition hover:bg-slate-100 hover:text-text-main" onClick={resetCanvas} type="button"><RotateCcw className="size-3.5" /></button>
      </div>

      <div className="absolute right-4 top-4 z-20 hidden rounded-xl border border-brand-cyan/20 bg-white/95 px-3 py-2 text-[9px] text-text-muted shadow-sm backdrop-blur sm:block">
        <strong className="text-text-main">Drag nodes</strong> · Click a node to edit
      </div>

      <div className="h-[620px] overflow-auto">
        <div
          className="relative origin-top-left"
          ref={canvasRef}
          style={{
            width: canvasWidth,
            height: canvasHeight,
            transform: `scale(${zoom})`,
            backgroundImage: 'radial-gradient(circle, rgba(148,163,184,.32) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        >
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible">
            <defs>
              <linearGradient id="creative-flow-line" x1="0" x2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity=".35" />
                <stop offset="60%" stopColor="#22d3ee" stopOpacity=".78" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity=".5" />
              </linearGradient>
              <filter id="creative-flow-glow">
                <feGaussianBlur stdDeviation="2.2" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {connectionPaths.map((connection, index) => <g key={connection.key}>
              <path d={connection.path} fill="none" stroke="rgba(148,163,184,.35)" strokeWidth="6" />
              <path d={connection.path} fill="none" filter="url(#creative-flow-glow)" stroke="url(#creative-flow-line)" strokeDasharray="8 10" strokeLinecap="round" strokeWidth="2.4">
                <animate attributeName="stroke-dashoffset" dur={`${2.7 + index * .16}s`} from="36" repeatCount="indefinite" to="0" />
              </path>
            </g>)}
          </svg>

          <FlowNode
            active={selectedNode === 'product'}
            dragging={dragging === 'product'}
            icon={Package}
            id="product"
            label="Product"
            position={positions.product}
            status={props.productName || props.website || props.assets.length ? 'Ready' : 'Add source'}
            summary={props.productName || props.website || (props.assets.length ? `${props.assets.length} asset${props.assets.length === 1 ? '' : 's'}` : 'Website, name or images')}
            tone="teal"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finishDrag}
            onSelect={setSelectedNode}
          />
          <FlowNode active={selectedNode === 'brief'} dragging={dragging === 'brief'} icon={Sparkles} id="brief" label="Campaign brief" position={positions.brief} status={props.prompt.trim() ? 'Ready' : 'Needs brief'} summary={props.prompt.trim() || 'Describe what you want'} tone="purple" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishDrag} onSelect={setSelectedNode} />
          <FlowNode active={selectedNode === 'platforms'} dragging={dragging === 'platforms'} icon={Send} id="platforms" label="Platforms" position={positions.platforms} status={props.selectedPlatforms.length ? `${props.selectedPlatforms.length} selected` : 'Auto'} summary={props.selectedPlatforms.length ? props.selectedPlatforms.join(', ') : 'Platform-neutral'} tone="green" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishDrag} onSelect={setSelectedNode} />
          <FlowNode active={selectedNode === 'strategy'} dragging={dragging === 'strategy'} icon={Target} id="strategy" label="Creative strategy" position={positions.strategy} status="AI Recommended" summary={props.goal === 'auto' ? 'Angles, hooks and styles' : `${props.goal} · ${props.style}`} tone="purple" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishDrag} onSelect={setSelectedNode} />
          <FlowNode active={selectedNode === 'generate'} dragging={dragging === 'generate'} icon={WandSparkles} id="generate" label="Generate creatives" position={positions.generate} status={`${resolvedCount} outputs`} summary="Distinct campaign concepts" tone="teal" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishDrag} onSelect={setSelectedNode} />
          <FlowNode active={selectedNode === 'review'} dragging={dragging === 'review'} icon={ImageIcon} id="review" label="Review campaign" position={positions.review} status="Final step" summary="Approve, edit, regenerate" tone="green" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishDrag} onSelect={setSelectedNode} />
        </div>
      </div>
    </div>

    <aside className="min-h-0 bg-white">
      <div className="border-b border-border-soft px-4 py-3">
        <span className="text-[8px] font-bold uppercase tracking-[.15em] text-brand-cyan">Node settings</span>
        <h3 className="mt-1 text-sm font-semibold">{nodeTitle(selectedNode)}</h3>
        <p className="mt-1 text-[9px] leading-4 text-text-muted">{nodeHelp(selectedNode)}</p>
      </div>
      <div className="scrollbar-thin max-h-[540px] overflow-y-auto p-4">
        {selectedNode === 'product' && <ProductEditor {...props} onChooseFiles={() => fileInput.current?.click()} />}
        {selectedNode === 'brief' && <BriefEditor prompt={props.prompt} onChange={props.onPromptChange} />}
        {selectedNode === 'platforms' && <PlatformEditor selected={props.selectedPlatforms} onToggle={props.onTogglePlatform} />}
        {selectedNode === 'strategy' && <StrategyEditor {...props} />}
        {selectedNode === 'generate' && <GenerateEditor creativeCount={props.creativeCount} customCount={props.customCount} onCreativeCountChange={props.onCreativeCountChange} onCustomCountChange={props.onCustomCountChange} />}
        {selectedNode === 'review' && <ReviewEditor />}
      </div>
      <div className="border-t border-border-soft p-4">
        <div className="mb-3 rounded-xl border border-brand-purple/15 bg-brand-purple/[.035] p-3 text-[9px] leading-4 text-text-muted"><strong className="text-text-main">Stage 4 preview.</strong> Product analysis, strategy, image generation and campaign handoff are real. Scheduling and publishing stay under Bulk Scheduler control.</div>
        <Button className="w-full" disabled={!props.canRun} onClick={props.onRun} variant="primary"><WandSparkles className="size-4" />Run Creative Flow</Button>
      </div>
    </aside>
  </div>
}

function FlowNode(props: {
  id: CreativeFlowNodeId
  label: string
  summary: string
  status: string
  icon: typeof Package
  tone: 'teal' | 'purple' | 'green'
  position: Position
  active: boolean
  dragging: boolean
  onSelect: (id: CreativeFlowNodeId) => void
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, id: CreativeFlowNodeId) => void
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerUp: () => void
}) {
  const tone = props.tone === 'teal'
    ? 'border-brand-cyan/30 bg-brand-cyan/[.08] text-brand-cyan'
    : props.tone === 'purple'
      ? 'border-brand-purple/25 bg-brand-purple/[.07] text-brand-purple'
      : 'border-brand-green/25 bg-brand-green/[.07] text-brand-green'
  const Icon = props.icon
  return <button
    className={`absolute z-10 h-[116px] w-[210px] touch-none select-none rounded-[18px] border bg-white p-3.5 text-left shadow-[0_16px_40px_rgba(15,23,42,.10)] transition-[border-color,box-shadow,transform] duration-150 ${props.active ? 'border-brand-cyan/55 ring-4 ring-brand-cyan/[.08]' : 'border-border-soft hover:border-brand-cyan/35'} ${props.dragging ? 'scale-[1.025] cursor-grabbing shadow-[0_24px_54px_rgba(15,23,42,.18)]' : 'cursor-grab'}`}
    onClick={() => props.onSelect(props.id)}
    onPointerCancel={props.onPointerUp}
    onPointerDown={(event) => props.onPointerDown(event, props.id)}
    onPointerMove={props.onPointerMove}
    onPointerUp={props.onPointerUp}
    style={{ left: props.position.x, top: props.position.y }}
    type="button"
  >
    <span className="absolute -left-[7px] top-1/2 size-3.5 -translate-y-1/2 rounded-full border-2 border-white bg-slate-300 shadow-sm" />
    <span className="absolute -right-[7px] top-1/2 size-3.5 -translate-y-1/2 rounded-full border-2 border-white bg-brand-cyan shadow-sm" />
    <span className="flex items-start justify-between gap-2"><span className={`grid size-9 place-items-center rounded-xl border ${tone}`}><Icon className="size-4" /></span><span className="rounded-full border border-border-soft bg-slate-50 px-2 py-1 text-[8px] font-semibold text-text-soft">{props.status}</span></span>
    <strong className="mt-3 block truncate text-[11px]">{props.label}</strong>
    <span className="mt-1 block truncate text-[9px] text-text-muted">{props.summary}</span>
  </button>
}

function ProductEditor(props: Props & { onChooseFiles: () => void }) {
  return <div className="space-y-4">
    <label className="block"><span className="text-[9px] font-semibold text-text-muted">Website URL</span><div className="relative mt-1.5"><Globe2 className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-soft" /><input className="min-h-10 w-full rounded-xl border border-border-soft bg-slate-50 pl-9 pr-3 text-[10px] outline-none focus:border-brand-cyan focus:bg-white" onChange={(event) => props.onWebsiteChange(event.target.value)} placeholder="https://yourbrand.com" value={props.website} /></div></label>
    <label className="block"><span className="text-[9px] font-semibold text-text-muted">Product name</span><input className="mt-1.5 min-h-10 w-full rounded-xl border border-border-soft bg-slate-50 px-3 text-[10px] outline-none focus:border-brand-cyan focus:bg-white" onChange={(event) => props.onProductNameChange(event.target.value)} placeholder="e.g. INXSocial" value={props.productName} /></label>
    <div><div className="flex items-center justify-between"><span className="text-[9px] font-semibold text-text-muted">Product images / logo</span><span className="text-[8px] text-text-soft">{props.assets.length}/8</span></div>
      <div className="mt-2 grid grid-cols-4 gap-2">{props.assets.map((asset) => <figure className="group relative aspect-square overflow-hidden rounded-lg border border-border-soft bg-slate-50" key={asset.id}><img alt="" className="size-full object-cover" src={asset.url} /><button aria-label={`Remove ${asset.name}`} className="absolute right-1 top-1 grid size-5 place-items-center rounded-md bg-black/65 text-white opacity-0 transition group-hover:opacity-100" onClick={(event) => { event.stopPropagation(); props.onRemoveAsset(asset.id) }} type="button"><X className="size-2.5" /></button></figure>)}
        {props.assets.length < 8 && <button className="grid aspect-square place-items-center rounded-lg border border-dashed border-brand-cyan/30 bg-brand-cyan/[.025] text-brand-cyan" onClick={props.onChooseFiles} type="button"><Upload className="size-3.5" /></button>}</div>
    </div>
  </div>
}

function BriefEditor({ prompt, onChange }: { prompt: string; onChange: (value: string) => void }) {
  return <div><label className="block"><span className="text-[9px] font-semibold text-text-muted">Campaign brief</span><textarea className="mt-1.5 min-h-44 w-full resize-y rounded-xl border border-border-soft bg-slate-50 p-3 text-[10px] leading-5 outline-none focus:border-brand-cyan focus:bg-white" onChange={(event) => onChange(event.target.value)} placeholder="Create a campaign for our product focused on small businesses. Make it modern, useful and credible..." value={prompt} /></label><p className="mt-2 text-[8px] leading-4 text-text-soft">Normal language is enough. Strategy is handled in the next node.</p></div>
}

function PlatformEditor({ selected, onToggle }: { selected: string[]; onToggle: (value: string) => void }) {
  return <div><span className="text-[9px] font-semibold text-text-muted">Destinations</span><div className="mt-2 grid grid-cols-2 gap-2">{platforms.map((platform) => { const active = selected.includes(platform); return <button aria-pressed={active} className={`rounded-xl border px-3 py-2.5 text-[9px] font-semibold transition ${active ? 'border-brand-cyan/40 bg-brand-cyan/[.07] text-brand-teal' : 'border-border-soft bg-slate-50 text-text-muted'}`} key={platform} onClick={() => onToggle(platform)} type="button">{active && <Check className="mr-1 inline size-3" />}{platform}</button> })}</div><p className="mt-3 text-[8px] leading-4 text-text-soft">If none are selected, Creative Flow prepares platform-neutral concepts.</p></div>
}

function StrategyEditor(props: Props) {
  return <div>
    <div className="rounded-xl border border-brand-purple/15 bg-brand-purple/[.035] p-3"><div className="flex items-center gap-2"><Target className="size-3.5 text-brand-purple" /><strong className="text-[10px]">AI Recommended</strong></div><p className="mt-1.5 text-[8px] leading-4 text-text-muted">Creative Flow plans distinct angles, hooks and visual directions before generation.</p></div>
    <button aria-expanded={props.advancedOpen} className="mt-3 flex w-full items-center justify-between rounded-xl border border-border-soft bg-slate-50 p-3 text-left" onClick={props.onAdvancedToggle} type="button"><span className="flex items-center gap-2 text-[9px] font-semibold"><Palette className="size-3.5 text-text-soft" />Advanced options</span><ChevronDown className={`size-3.5 text-text-soft transition ${props.advancedOpen ? 'rotate-180' : ''}`} /></button>
    {props.advancedOpen && <div className="mt-3 space-y-3">
      <label className="block"><span className="text-[9px] font-semibold text-text-muted">Campaign goal</span><select className="mt-1.5 min-h-10 w-full rounded-xl border border-border-soft bg-white px-3 text-[10px] outline-none focus:border-brand-cyan" onChange={(event) => props.onGoalChange(event.target.value)} value={props.goal}><option value="auto">AI Recommended</option><option value="sales">Sales</option><option value="traffic">Traffic</option><option value="awareness">Awareness</option><option value="launch">Product launch</option></select></label>
      <label className="block"><span className="text-[9px] font-semibold text-text-muted">Creative style</span><select className="mt-1.5 min-h-10 w-full rounded-xl border border-border-soft bg-white px-3 text-[10px] outline-none focus:border-brand-cyan" onChange={(event) => props.onStyleChange(event.target.value)} value={props.style}><option value="auto">AI Recommended</option><option value="performance">Performance ads</option><option value="minimal">Minimal</option><option value="lifestyle">Lifestyle</option><option value="editorial">Editorial / infographic</option></select></label>
      <label className="block"><span className="text-[9px] font-semibold text-text-muted">Audience</span><input className="mt-1.5 min-h-10 w-full rounded-xl border border-border-soft bg-white px-3 text-[10px] outline-none focus:border-brand-cyan" onChange={(event) => props.onAudienceChange(event.target.value)} placeholder="AI Recommended" value={props.audience} /></label>
    </div>}
  </div>
}

function GenerateEditor({ creativeCount, customCount, onCreativeCountChange, onCustomCountChange }: Pick<Props, 'creativeCount' | 'customCount' | 'onCreativeCountChange' | 'onCustomCountChange'>) {
  return <div><span className="text-[9px] font-semibold text-text-muted">How many creatives?</span><div className="mt-2 grid grid-cols-4 gap-2">{counts.map((count) => <button aria-pressed={!customCount && creativeCount === count} className={`rounded-xl border px-2 py-2.5 text-[9px] font-semibold ${!customCount && creativeCount === count ? 'border-brand-cyan/40 bg-brand-cyan/[.07] text-brand-teal' : 'border-border-soft bg-slate-50 text-text-muted'}`} key={count} onClick={() => { onCreativeCountChange(count); onCustomCountChange('') }} type="button">{count}</button>)}</div><label className="mt-3 block"><span className="text-[9px] font-semibold text-text-muted">Custom amount</span><input className="mt-1.5 min-h-10 w-full rounded-xl border border-border-soft bg-slate-50 px-3 text-[10px] outline-none focus:border-brand-cyan focus:bg-white" max={50} min={1} onChange={(event) => onCustomCountChange(event.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="1–50" value={customCount} /></label><div className="mt-4 rounded-xl border border-border-soft bg-slate-50 p-3 text-[8px] leading-4 text-text-muted"><Layers3 className="mb-2 size-4 text-brand-cyan" />Each output will come from a different creative concept instead of repeating one layout.</div></div>
}

function ReviewEditor() {
  return <div className="space-y-3"><div className="rounded-xl border border-brand-green/20 bg-brand-green/[.04] p-3"><strong className="flex items-center gap-2 text-[10px]"><Check className="size-3.5 text-brand-green" />Review before publishing</strong><p className="mt-1.5 text-[8px] leading-4 text-text-muted">Approve, edit, regenerate or create variations before handing the campaign to Bulk Scheduler.</p></div><div className="rounded-xl border border-border-soft bg-slate-50 p-3 text-[8px] leading-4 text-text-muted">Generated creatives can be reviewed, approved and handed to Bulk Scheduler. Creative Flow never auto-publishes.</div></div>
}

function nodeTitle(id: CreativeFlowNodeId) {
  if (id === 'product') return 'Product source'
  if (id === 'brief') return 'Campaign brief'
  if (id === 'platforms') return 'Platforms'
  if (id === 'strategy') return 'Creative strategy'
  if (id === 'generate') return 'Generation'
  return 'Review campaign'
}

function nodeHelp(id: CreativeFlowNodeId) {
  if (id === 'product') return 'Give Creative Flow enough context to understand what you are marketing.'
  if (id === 'brief') return 'Describe the campaign in normal language.'
  if (id === 'platforms') return 'Choose the platforms this campaign should fit.'
  if (id === 'strategy') return 'AI plans varied creative angles. Advanced controls are optional.'
  if (id === 'generate') return 'Choose how many different concepts you want.'
  return 'Review the generated campaign before sending it anywhere.'
}
