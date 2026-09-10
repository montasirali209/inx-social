import type { ReactNode } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronRight,
  Clapperboard,
  Coins,
  Copy,
  Crown,
  FileImage,
  History,
  Image,
  Images,
  LockKeyhole,
  Megaphone,
  MoreVertical,
  Palette,
  Play,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AIDraft, AIContentType, AIPlanAccess, GenerationHistoryItem, GenerationStatus } from '../../types/ai-content-studio'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Drawer, Modal } from '../billing/BillingPrimitives'
import { AIStudioHeroArtwork, AIWorkflowArtwork } from './AIStudioVisuals'

export type WorkflowDefinition = {
  type: AIContentType
  label: string
  title: string
  description: string
  useCases: string[]
  credits: string
  icon: LucideIcon
  tone: 'teal' | 'purple' | 'cyan' | 'amber'
}

export const workflowDefinitions: WorkflowDefinition[] = [
  {
    type: 'image_post',
    label: 'Single Visual',
    title: 'Image Post',
    description: 'Create a ready-to-publish post with a generated visual, caption, hashtags and alt text.',
    useCases: ['Social posts', 'Announcements', 'Brand content'],
    credits: '5 credits',
    icon: Image,
    tone: 'teal',
  },
  {
    type: 'carousel_post',
    label: 'Multi-Slide',
    title: 'Carousel Post',
    description: 'Build a multi-slide story with one caption, coordinated visuals and individual slide copy.',
    useCases: ['Tips & how-tos', 'Product launches', 'Educational'],
    credits: '10–20 credits',
    icon: Images,
    tone: 'purple',
  },
  {
    type: 'short_video',
    label: 'Short Social Video',
    title: 'Short Video / Reel',
    description: 'Create short-form social video with captions and publishing copy prepared alongside it.',
    useCases: ['Reels & Stories', 'Product demos', 'Tips & insights'],
    credits: '15–35 credits',
    icon: Clapperboard,
    tone: 'cyan',
  },
  {
    type: 'ugc_ad',
    label: 'Creator-Style Promotion',
    title: 'UGC Ad Post',
    description: 'Create creator-style promotional content around a product, service or campaign brief.',
    useCases: ['Product ads', 'Testimonials', 'Campaigns'],
    credits: '25–50 credits',
    icon: Megaphone,
    tone: 'amber',
  },
]

const toneClasses = {
  teal: {
    card: 'border-brand-teal/25 bg-[radial-gradient(circle_at_88%_11%,rgba(20,184,166,.18),transparent_15rem),linear-gradient(150deg,rgba(7,38,44,.92),rgba(5,19,31,.98))] hover:border-brand-teal/50',
    icon: 'border-brand-teal/35 bg-brand-teal/10 text-brand-cyan',
    glow: 'from-brand-teal/20 via-brand-cyan/5 to-transparent',
  },
  purple: {
    card: 'border-brand-purple/25 bg-[radial-gradient(circle_at_88%_11%,rgba(139,92,246,.20),transparent_15rem),linear-gradient(150deg,rgba(24,25,65,.94),rgba(6,19,32,.98))] hover:border-brand-purple/50',
    icon: 'border-brand-purple/35 bg-brand-purple/10 text-[#c4b5fd]',
    glow: 'from-brand-purple/20 via-[#7c3aed]/5 to-transparent',
  },
  cyan: {
    card: 'border-brand-cyan/25 bg-[radial-gradient(circle_at_88%_11%,rgba(34,211,238,.16),transparent_15rem),linear-gradient(150deg,rgba(3,39,52,.94),rgba(5,19,31,.98))] hover:border-brand-cyan/50',
    icon: 'border-brand-cyan/35 bg-brand-cyan/10 text-brand-cyan',
    glow: 'from-brand-cyan/20 via-brand-teal/5 to-transparent',
  },
  amber: {
    card: 'border-brand-amber/25 bg-[radial-gradient(circle_at_88%_11%,rgba(245,158,11,.16),transparent_15rem),linear-gradient(150deg,rgba(47,39,11,.88),rgba(6,19,30,.98))] hover:border-brand-amber/50',
    icon: 'border-brand-amber/35 bg-brand-amber/10 text-brand-amber',
    glow: 'from-brand-amber/20 via-orange-400/5 to-transparent',
  },
} as const

export function AIPlanCreditCard({ access }: { access: AIPlanAccess }) {
  const used = access.creditsLimit !== null && access.creditsRemaining !== null
    ? Math.max(0, access.creditsLimit - access.creditsRemaining)
    : null
  const percent = used !== null && access.creditsLimit
    ? Math.min(100, Math.round((used / access.creditsLimit) * 100))
    : null

  return <Card className="min-w-0 border-brand-teal/25 bg-[linear-gradient(145deg,rgba(4,43,52,.94),rgba(6,24,38,.98))] p-5 shadow-[0_24px_70px_rgba(0,0,0,.28)] xl:w-[360px] xl:shrink-0">
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-cyan"><Crown className="size-4" />Plus Plan</span>
      <span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[.14em] ${access.studioEnabled ? 'border-brand-green/25 bg-brand-green/10 text-brand-green' : 'border-brand-amber/25 bg-brand-amber/10 text-brand-amber'}`}>{access.studioEnabled ? 'Active' : 'Locked'}</span>
    </div>

    <div className="mt-4">
      {access.unlimitedCredits ? <><strong className="text-3xl tracking-tight">Unlimited</strong><span className="mt-1 block text-xs text-text-muted">AI generation allowance</span></> : access.creditsConfigured ? <><strong className="text-3xl tracking-tight">{(access.creditsRemaining ?? 0).toLocaleString()}</strong><span className="mt-1 block text-xs text-text-muted">AI credits remaining</span></> : <><strong className="text-xl tracking-tight">Credit wallet pending</strong><span className="mt-1 block text-xs leading-5 text-text-muted">The live monthly balance will appear here when the credit service is enabled.</span></>}
    </div>

    {percent !== null && <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between text-[10px] text-text-muted"><span>{used?.toLocaleString()} used</span><span>{percent}% used</span></div>
      <div aria-label={`${percent}% of monthly AI credits used`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent} className="h-2 overflow-hidden rounded-full bg-white/8" role="progressbar"><div className="h-full rounded-full bg-gradient-to-r from-brand-teal to-brand-cyan transition-all" style={{ width: `${percent}%` }} /></div>
    </div>}

    <div className="mt-4 grid gap-2 text-[11px] text-text-muted sm:grid-cols-2 xl:grid-cols-1">
      <span className="flex items-center gap-2"><Check className="size-3.5 text-brand-green" />{access.unlimitedCredits ? 'Unlimited generation' : access.creditsConfigured ? '500 monthly AI Studio credits' : 'Monthly credit wallet'}</span>
      <span className="flex items-center gap-2"><Check className="size-3.5 text-brand-green" />Commercial use</span>
      <span className="flex items-center gap-2"><Check className="size-3.5 text-brand-green" />Priority processing</span>
    </div>

    <Link className="mt-4 block" to="/billing"><Button className="w-full" variant="primary">Billing & Plans <ArrowRight className="size-4" /></Button></Link>
  </Card>
}

const heroSteps: Array<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: Sparkles, title: 'Create with AI', text: 'Generate on-brand content in seconds' },
  { icon: BadgeCheck, title: 'Review & refine', text: 'Edit, adjust and perfect your content' },
  { icon: Send, title: 'Send to Posts', text: 'Choose pages, date and time to schedule' },
]

export function AIStudioHero({ access }: { access: AIPlanAccess }) {
  return <section className="relative overflow-hidden rounded-[28px] border border-brand-cyan/20 bg-[radial-gradient(circle_at_80%_5%,rgba(34,211,238,.10),transparent_25rem),radial-gradient(circle_at_12%_0%,rgba(20,184,166,.12),transparent_28rem),linear-gradient(145deg,rgba(6,28,45,.99),rgba(4,14,27,.99))] p-5 shadow-[0_28px_80px_rgba(0,0,0,.28)] sm:p-7">
    <div className="pointer-events-none absolute -right-12 -top-24 size-80 rounded-full border border-brand-cyan/10 bg-brand-cyan/[.025]" />
    <div className="relative grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(230px,.58fr)_360px] xl:items-stretch">
      <div className="min-w-0">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-purple/25 bg-brand-purple/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-[#c4b5fd]"><Sparkles className="size-3.5" />AI Content Studio</span>
        <h2 className="mt-5 max-w-4xl text-[clamp(2rem,4vw,3.65rem)] font-bold leading-[1.02] tracking-[-.045em]">Turn ideas into <span className="bg-gradient-to-r from-brand-teal via-brand-cyan to-emerald-300 bg-clip-text text-transparent">scroll-stopping content.</span></h2>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-text-muted sm:text-[15px]">Create images, carousels, videos and UGC-style ads with AI, then send them directly to your Posts workflow for scheduling.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {heroSteps.map(({ icon: StepIcon, title, text }, index) => <div className="relative flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[.025] p-3.5" key={title}>
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand-teal/25 bg-brand-teal/10 text-brand-cyan"><StepIcon className="size-4" /></span>
            <span className="min-w-0"><strong className="block text-xs">{title}</strong><span className="mt-1 block text-[10px] leading-4 text-text-muted">{text}</span></span>
            {index < heroSteps.length - 1 && <ChevronRight className="absolute -right-2 top-1/2 hidden size-4 -translate-y-1/2 text-brand-teal/50 sm:block" />}
          </div>)}
        </div>
      </div>
      <AIStudioHeroArtwork />
      <AIPlanCreditCard access={access} />
    </div>
  </section>
}

export function AIWorkflowCard({ definition, enabled, onCreate }: { definition: WorkflowDefinition; enabled: boolean; onCreate: (type: AIContentType) => void }) {
  const Icon = definition.icon
  const tone = toneClasses[definition.tone]
  return <Card className={`group relative min-h-[326px] overflow-hidden p-0 transition duration-200 ${tone.card} ${enabled ? 'hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(0,0,0,.3)]' : 'opacity-65'}`}>
    <div className={`pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-br ${tone.glow}`} />
    <AIWorkflowArtwork type={definition.type} />
    <div className="relative flex min-h-[326px] flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span className={`grid size-12 place-items-center rounded-2xl border ${tone.icon}`}><Icon className="size-5" /></span>
        {!enabled && <span className="inline-flex items-center gap-1 rounded-full border border-brand-amber/25 bg-brand-amber/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-brand-amber"><LockKeyhole className="size-3" />Plus</span>}
      </div>
      <span className="mt-6 text-[9px] font-bold uppercase tracking-[.18em] text-text-muted">{definition.label}</span>
      <h3 className="mt-2 text-xl font-semibold tracking-tight">{definition.title}</h3>
      <p className="mt-2 max-w-[88%] text-xs leading-5 text-text-muted">{definition.description}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">{definition.useCases.map((item) => <span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[9px] text-text-muted" key={item}>{item}</span>)}</div>
      <div className="mt-auto flex items-end justify-between gap-3 pt-6">
        <div><span className="flex items-center gap-1.5 text-xs font-semibold"><Coins className="size-3.5 text-brand-amber" />{definition.credits}</span><span className="mt-1 block text-[9px] text-text-soft">depending on generation settings</span></div>
        <Button aria-label={`Create ${definition.title}`} onClick={() => onCreate(definition.type)} variant="primary">Create <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></Button>
      </div>
    </div>
  </Card>
}

export function ImagePostCard(props: Omit<Parameters<typeof AIWorkflowCard>[0], 'definition'>) { return <AIWorkflowCard {...props} definition={workflowDefinitions[0]} /> }
export function CarouselPostCard(props: Omit<Parameters<typeof AIWorkflowCard>[0], 'definition'>) { return <AIWorkflowCard {...props} definition={workflowDefinitions[1]} /> }
export function ShortVideoCard(props: Omit<Parameters<typeof AIWorkflowCard>[0], 'definition'>) { return <AIWorkflowCard {...props} definition={workflowDefinitions[2]} /> }
export function UGCAdCard(props: Omit<Parameters<typeof AIWorkflowCard>[0], 'definition'>) { return <AIWorkflowCard {...props} definition={workflowDefinitions[3]} /> }

export function CreditCostPreview({ credits, remaining, unlimited, configured }: { credits: number; remaining: number | null; unlimited: boolean; configured: boolean }) {
  const insufficient = configured && !unlimited && remaining !== null && remaining < credits
  return <div className={`rounded-2xl border p-4 ${insufficient ? 'border-brand-red/30 bg-brand-red/[.06]' : 'border-brand-teal/25 bg-brand-teal/[.045]'}`}>
    <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-xs font-semibold"><Coins className={`size-4 ${insufficient ? 'text-brand-red' : 'text-brand-amber'}`} />Estimated credit cost</span><strong className="text-lg">{credits}</strong></div>
    <p className="mt-1.5 text-[10px] leading-4 text-text-muted">This generation will use approximately {credits} credit{credits === 1 ? '' : 's'}. The backend validates and returns the final charge before the balance is updated.</p>
    {insufficient && <div className="mt-3"><strong className="text-xs text-brand-red">Not enough AI credits.</strong><div className="mt-2 flex flex-wrap gap-2"><Link to="/billing"><Button size="sm">View Plus usage</Button></Link><Link to="/billing"><Button size="sm" variant="primary">Billing & Plans</Button></Link></div></div>}
  </div>
}

const stageText: Record<GenerationStatus, string> = {
  idle: 'Ready to generate',
  preparing: 'Preparing prompt',
  generating: 'Generating media',
  processing: 'Finalising content',
  completed: 'Content generated successfully',
  failed: 'Generation failed',
  cancelled: 'Generation cancelled',
}

export function GenerationProgress({ status, message }: { status: GenerationStatus; message?: string }) {
  const active = ['preparing', 'generating', 'processing'].includes(status)
  return <div aria-live="polite" className="rounded-2xl border border-border-soft bg-bg/35 p-4">
    <div className="flex items-center gap-3"><span className={`grid size-9 place-items-center rounded-xl border ${status === 'failed' ? 'border-brand-red/30 bg-brand-red/10 text-brand-red' : status === 'completed' ? 'border-brand-green/30 bg-brand-green/10 text-brand-green' : 'border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan'}`}>{active ? <span className="size-2.5 animate-pulse rounded-full bg-current motion-reduce:animate-none" /> : status === 'completed' ? <Check className="size-4" /> : status === 'cancelled' ? <X className="size-4" /> : <Sparkles className="size-4" />}</span><span><strong className="block text-xs">{stageText[status]}</strong>{message && <span className="mt-1 block text-[10px] leading-4 text-text-muted">{message}</span>}</span></div>
  </div>
}

function draftIcon(type: AIContentType) {
  if (type === 'image_post') return FileImage
  if (type === 'carousel_post') return Images
  if (type === 'short_video') return Clapperboard
  return Megaphone
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function AIDraftCard({ draft, onOpen, onSend, onDuplicate, onDelete }: { draft: AIDraft; onOpen: (draft: AIDraft) => void; onSend: (draft: AIDraft) => void; onDuplicate: (draft: AIDraft) => void; onDelete: (draft: AIDraft) => void }) {
  const Icon = draftIcon(draft.contentType)
  return <article className="group relative w-[190px] shrink-0 overflow-hidden rounded-2xl border border-border-soft bg-bg/35 transition hover:border-brand-cyan/30 sm:w-[220px]">
    <button className="block w-full text-left focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={() => onOpen(draft)} type="button">
      <div className="relative aspect-[16/9] overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,.16),transparent_10rem),linear-gradient(145deg,rgba(13,40,55,.9),rgba(5,15,29,.96))]">{draft.thumbnailUrl ? <img alt="" className="size-full object-cover" src={draft.thumbnailUrl} /> : <Icon className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 text-brand-cyan/70" />}{draft.contentType === 'short_video' || draft.contentType === 'ugc_ad' ? <span className="absolute inset-0 grid place-items-center"><span className="grid size-9 place-items-center rounded-full border border-white/25 bg-black/40"><Play className="ml-0.5 size-4 fill-white text-white" /></span></span> : null}</div>
      <div className="p-3"><strong className="block truncate text-xs">{draft.title}</strong><span className="mt-1 block text-[9px] text-text-soft">Edited {relativeTime(draft.updatedAt)}</span></div>
    </button>
    <details className="absolute right-2 top-2">
      <summary aria-label={`Actions for ${draft.title}`} className="grid size-8 cursor-pointer list-none place-items-center rounded-lg border border-white/10 bg-black/55 text-white backdrop-blur transition hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-brand-cyan"><MoreVertical className="size-4" /></summary>
      <div className="absolute right-0 z-20 mt-1 w-40 rounded-xl border border-border-soft bg-panel p-1.5 shadow-panel">
        <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] text-text-muted hover:bg-white/5 hover:text-white" onClick={() => onOpen(draft)} type="button"><Sparkles className="size-3.5" />Continue editing</button>
        <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] text-text-muted hover:bg-white/5 hover:text-white" onClick={() => onSend(draft)} type="button"><Send className="size-3.5" />Send to Posts</button>
        <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] text-text-muted hover:bg-white/5 hover:text-white" onClick={() => onDuplicate(draft)} type="button"><Copy className="size-3.5" />Duplicate</button>
        <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] text-brand-red hover:bg-brand-red/10" onClick={() => onDelete(draft)} type="button"><Trash2 className="size-3.5" />Delete</button>
      </div>
    </details>
  </article>
}

export function RecentDrafts({ drafts, onOpen, onSend, onDuplicate, onDelete, onViewAll }: { drafts: AIDraft[]; onOpen: (draft: AIDraft) => void; onSend: (draft: AIDraft) => void; onDuplicate: (draft: AIDraft) => void; onDelete: (draft: AIDraft) => void; onViewAll: () => void }) {
  return <Card className="min-w-0 p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3"><div><span className="text-[9px] font-bold uppercase tracking-[.16em] text-text-soft">Workspace</span><h3 className="mt-1 text-sm font-semibold">Recent Drafts</h3></div><Button onClick={onViewAll} size="sm" variant="ghost">View all <ArrowRight className="size-3.5" /></Button></div>
    {drafts.length ? <div className="scrollbar-thin mt-4 flex gap-3 overflow-x-auto pb-2">{drafts.map((draft) => <AIDraftCard draft={draft} key={draft.id} onDelete={onDelete} onDuplicate={onDuplicate} onOpen={onOpen} onSend={onSend} />)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-border-soft bg-bg/25 p-5 text-center"><Sparkles className="mx-auto size-5 text-brand-cyan" /><p className="mt-2 text-xs font-medium">Your AI drafts will appear here.</p><p className="mt-1 text-[10px] text-text-muted">Create a post and save it before continuing to Posts.</p></div>}
  </Card>
}

export function BrandSafetyCard({ brandKitName }: { brandKitName?: string | null }) {
  return <Card className="p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-brand-teal/30 bg-brand-teal/10 text-brand-cyan"><ShieldCheck className="size-5" /></span><div><h3 className="text-sm font-semibold">Brand-safe, on-brand content</h3><p className="mt-1 text-[10px] leading-4 text-text-muted">Use your brand settings to keep generated content consistent across formats.</p>{brandKitName && <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/20 bg-brand-cyan/[.05] px-2.5 py-1 text-[9px] text-brand-cyan"><Palette className="size-3" />Active Brand Kit: {brandKitName}</span>}</div></div>
      <Link to="/settings"><Button size="sm">Manage Brand Settings</Button></Link>
    </div>
    <div className="mt-4 grid gap-2 border-t border-border-soft pt-4 text-[10px] text-text-muted sm:grid-cols-4">{['Original content', 'Brand aligned', 'Platform safe', 'Commercial use allowed'].map((item) => <span className="flex items-center gap-1.5" key={item}><Check className="size-3.5 text-brand-green" />{item}</span>)}</div>
  </Card>
}

export function CreditsCard({ topUpsSupported = false }: { topUpsSupported?: boolean }) {
  return <Card className="p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-brand-amber/30 bg-brand-amber/10 text-brand-amber"><Coins className="size-5" /></span><div><h3 className="text-sm font-semibold">Need more credits?</h3><p className="mt-1 text-[10px] leading-4 text-text-muted">{topUpsSupported ? 'Upgrade or top up anytime to keep creating.' : 'Manage your Plus plan and AI allowance from Billing & Plans.'}</p></div></div><Link to="/billing"><Button size="sm" variant="primary">{topUpsSupported ? 'Buy credits' : 'Manage Plus Plan'} <ArrowRight className="size-3.5" /></Button></Link></div>
  </Card>
}

export function LockedPlanState({ plan, onUpgrade }: { plan: 'trial' | 'pro'; onUpgrade: () => void }) {
  return <section className="mx-auto max-w-5xl overflow-hidden rounded-[30px] border border-brand-purple/25 bg-[radial-gradient(circle_at_80%_0%,rgba(139,92,246,.16),transparent_28rem),linear-gradient(145deg,rgba(10,27,45,.98),rgba(5,15,29,.99))] p-6 text-center shadow-panel sm:p-10">
    <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-brand-purple/30 bg-brand-purple/10 text-[#c4b5fd]"><LockKeyhole className="size-6" /></span>
    <span className="mt-5 inline-flex rounded-full border border-brand-purple/25 bg-brand-purple/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[.16em] text-[#c4b5fd]">Plus exclusive</span>
    <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Unlock the full AI Content Studio.</h2>
    <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-text-muted">Your {plan === 'pro' ? 'Pro' : 'Trial'} plan keeps generation controls locked. {plan === 'pro' ? 'You can still use AI caption writing and enhancement from Posts.' : 'Trial includes the normal publishing workflow without AI Studio generation.'}</p>
    <div className="mx-auto mt-6 grid max-w-3xl gap-3 text-left sm:grid-cols-2">{['500 AI Studio credits each billing period', 'Image post generation', '3–10 slide carousel generation', 'Short Video / Reel creation', 'UGC-style ad creation', 'Media Library + Posts handoff'].map((item) => <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[.025] p-3 text-xs" key={item}><Check className="size-4 shrink-0 text-brand-green" />{item}</div>)}</div>
    <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row"><Button onClick={onUpgrade} variant="primary"><Crown className="size-4" />Upgrade to Plus</Button><Link to="/billing"><Button>Compare plans</Button></Link></div>
  </section>
}

export function UpgradeToPlusModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <Modal footer={<><Button onClick={onClose}>Not now</Button><Link to="/billing"><Button variant="primary">Upgrade to Plus</Button></Link></>} onClose={onClose} open={open} title="AI Content Studio is a Plus feature">
    <div className="rounded-2xl border border-brand-purple/25 bg-brand-purple/8 p-5"><Crown className="size-7 text-[#c4b5fd]" /><h3 className="mt-3 text-base font-semibold">Create complete social posts with AI</h3><p className="mt-2 text-sm leading-6 text-text-muted">Plus includes 500 AI Studio credits each billing period and unlocks Image Posts, Carousels, Short Video / Reels and UGC Ad Posts. Generated content is reviewed here, saved to Media Library, then sent to Posts for destination selection and scheduling.</p></div>
  </Modal>
}

export function GenerationHistoryDrawer({ open, onClose, history }: { open: boolean; onClose: () => void; history: GenerationHistoryItem[] }) {
  return <Drawer onClose={onClose} open={open} title="AI generation history">
    <div className="space-y-3">{history.length ? history.map((item) => <article className="rounded-2xl border border-border-soft bg-bg/35 p-4" key={item.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="text-[9px] font-bold uppercase tracking-[.15em] text-text-soft">{item.type.replaceAll('_', ' ')}</span><p className="mt-1 line-clamp-3 text-xs leading-5 text-text-muted">{item.prompt}</p></div><span className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${item.status === 'completed' ? 'border-brand-green/25 bg-brand-green/10 text-brand-green' : item.status === 'failed' ? 'border-brand-red/25 bg-brand-red/10 text-brand-red' : 'border-border-soft bg-white/5 text-text-muted'}`}>{item.status}</span></div><div className="mt-3 flex items-center justify-between text-[9px] text-text-soft"><span>{new Date(item.createdAt).toLocaleString()}</span><span>{item.creditsUsed} credits</span></div></article>) : <div className="rounded-2xl border border-dashed border-border-soft p-6 text-center"><History className="mx-auto size-5 text-text-soft" /><p className="mt-2 text-xs text-text-muted">No generation history yet.</p></div>}</div>
  </Drawer>
}

export function StudioToast({ message, onClose }: { message: string | null; onClose: () => void }) {
  if (!message) return null
  return <div aria-live="polite" className="fixed bottom-5 right-5 z-[120] flex max-w-sm items-start gap-3 rounded-2xl border border-brand-teal/30 bg-panel/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,.45)] backdrop-blur-xl"><Check className="mt-0.5 size-4 shrink-0 text-brand-green" /><span className="text-xs leading-5">{message}</span><button aria-label="Dismiss notification" className="rounded p-1 text-text-muted hover:text-white" onClick={onClose} type="button"><X className="size-3.5" /></button></div>
}

export function StudioSectionHeading({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="text-lg font-semibold tracking-tight">{title}</h3><p className="mt-1 text-[11px] leading-5 text-text-muted">{text}</p></div>{action}</div>
}
