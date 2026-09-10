import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Clapperboard,
  Coins,
  Image,
  Images,
  LockKeyhole,
  Megaphone,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchStudioOverview } from '../../lib/dashboard-api'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Modal } from '../billing/BillingPrimitives'

const creationTypes = [
  {
    id: 'image-post',
    icon: Image,
    eyebrow: 'Single visual',
    title: 'Image Post',
    description: 'Create a ready-to-publish post with a generated visual, caption, hashtags and alt text.',
    detail: 'Best for announcements, promotions, tips and everyday branded content.',
    previewClass: 'from-cyan-400/20 via-sky-500/10 to-transparent',
    iconClass: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-200',
  },
  {
    id: 'carousel-post',
    icon: Images,
    eyebrow: '3–8 coordinated slides',
    title: 'Carousel Post',
    description: 'Build a multi-slide story with one caption, coordinated visuals and individual slide copy.',
    detail: 'Best for explainers, step-by-step posts, launches and educational content.',
    previewClass: 'from-violet-400/20 via-brand-purple/10 to-transparent',
    iconClass: 'border-violet-400/25 bg-violet-400/10 text-violet-200',
  },
  {
    id: 'short-video',
    icon: Clapperboard,
    eyebrow: 'Short social video',
    title: 'Short Video / Reel',
    description: 'Create a short-form social video with the caption and publishing copy prepared alongside it.',
    detail: 'Built for feeds, Reels and Stories — not long-form video production.',
    previewClass: 'from-emerald-400/20 via-teal-500/10 to-transparent',
    iconClass: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
  },
  {
    id: 'ugc-ad',
    icon: Megaphone,
    eyebrow: 'Creator-style promotion',
    title: 'UGC Ad Post',
    description: 'Create creator-style promotional content around a product, service or campaign brief.',
    detail: 'Designed for short UGC-style social ads with a clear hook, message and call to action.',
    previewClass: 'from-amber-400/20 via-orange-500/10 to-transparent',
    iconClass: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  },
]

export function AiContentStudioPage() {
  const overview = useQuery({ queryKey: ['studio-overview'], queryFn: fetchStudioOverview, staleTime: 30_000 })
  const [upgradeOpen, setUpgradeOpen] = useState(true)
  const access = overview.data?.features?.aiContentStudio
  const allowed = Boolean(access?.allowed)

  if (overview.isLoading) {
    return <div className="grid gap-4 md:grid-cols-2">{creationTypes.map(({ title }) => <Card className="h-72 animate-pulse bg-panel-soft/60" key={title}><span className="sr-only">Loading {title}</span></Card>)}</div>
  }

  const requestAccess = () => {
    if (!allowed) setUpgradeOpen(true)
  }

  return <>
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_85%_10%,rgba(45,212,191,.12),transparent_24rem),radial-gradient(circle_at_10%_0%,rgba(99,102,241,.16),transparent_28rem),linear-gradient(145deg,rgba(10,27,45,.98),rgba(5,15,29,.99))] p-6 shadow-panel sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full border border-white/5 bg-white/[.015]" />
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-purple/25 bg-brand-purple/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-[#c4b5fd]"><Sparkles className="size-3.5" />AI Content Studio</span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Create the post. We prepare the content.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">Choose the post format you need. INXSocial will create the media and publishing copy together, ready to continue into Posts for page selection and scheduling.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3.5 py-2.5 text-xs text-text-muted"><Coins className="size-4 text-brand-amber" /><span>AI credits will be shown before generation</span></div>
          <Link to="/billing"><Button>View Plus plan</Button></Link>
        </div>
      </div>
    </section>

    <section className="mt-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><h3 className="text-lg font-semibold">What do you want to create?</h3><p className="mt-1 text-xs leading-5 text-text-muted">Four focused workflows. No standalone AI model playground.</p></div>
        <span className="text-[11px] font-medium text-text-muted">Generated content will continue into the Posts workflow.</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {creationTypes.map(({ icon: Icon, eyebrow, title, description, detail, previewClass, iconClass }) => (
          <Card className={`group relative min-h-[286px] overflow-hidden border-white/10 p-0 transition duration-200 ${allowed ? 'hover:-translate-y-0.5 hover:border-white/20 hover:shadow-xl' : 'opacity-65'}`} key={title}>
            <div className={`absolute inset-x-0 top-0 h-32 bg-gradient-to-br ${previewClass}`} />
            <div className="relative flex h-full min-h-[286px] flex-col p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <span className={`grid size-12 place-items-center rounded-2xl border ${iconClass}`}><Icon className="size-5" /></span>
                {!allowed && <span className="inline-flex items-center gap-1 rounded-full border border-brand-amber/20 bg-brand-amber/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-amber"><LockKeyhole className="size-3" />Plus</span>}
              </div>
              <span className="mt-6 text-[10px] font-bold uppercase tracking-[.16em] text-text-muted">{eyebrow}</span>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-text-muted">{description}</p>
              <p className="mt-3 text-xs leading-5 text-text-muted/80">{detail}</p>
              <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                <span className="text-[11px] font-medium text-text-muted">Credit cost shown before generation</span>
                <Button onClick={requestAccess} variant="primary">Create <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>

    <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
      <Card className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><span className="text-[10px] font-bold uppercase tracking-[.16em] text-text-muted">Workflow</span><h3 className="mt-2 text-lg font-semibold">Create here. Publish from Posts.</h3></div><span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200">Connected flow</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ['1', 'Create', 'Generate the media and publishing copy together.'],
            ['2', 'Review', 'Edit the result before it leaves AI Content Studio.'],
            ['3', 'Continue to Posts', 'Select pages, date and time, then publish or schedule.'],
          ].map(([step, title, text]) => <div className="rounded-2xl border border-white/8 bg-white/[.025] p-4" key={step}><span className="grid size-7 place-items-center rounded-full bg-white/8 text-[11px] font-bold">{step}</span><b className="mt-3 block text-sm">{title}</b><p className="mt-1 text-xs leading-5 text-text-muted">{text}</p></div>)}
        </div>
      </Card>
      <Card className="p-5 sm:p-6">
        <span className="text-[10px] font-bold uppercase tracking-[.16em] text-text-muted">Coming with generation</span>
        <h3 className="mt-2 text-lg font-semibold">Credits & top-ups</h3>
        <p className="mt-2 text-xs leading-5 text-text-muted">Plus customers will receive monthly AI Studio credits. Every generation will show its credit cost first, with optional top-ups when the included allowance runs out.</p>
        <Link className="mt-5 inline-flex" to="/billing"><Button>Billing & Plans <ArrowRight className="size-4" /></Button></Link>
      </Card>
    </section>

    <Modal footer={<><Button onClick={() => setUpgradeOpen(false)}>Not now</Button><Link to="/billing"><Button variant="primary">View Plus plan</Button></Link></>} onClose={() => setUpgradeOpen(false)} open={!allowed && upgradeOpen} title="Upgrade to access AI Content Studio">
      <div className="rounded-2xl border border-brand-purple/25 bg-brand-purple/8 p-5"><Sparkles className="size-7 text-[#c4b5fd]" /><p className="mt-3 text-sm leading-6 text-text-muted">AI Content Studio is a Plus feature for creating complete Image Posts, Carousel Posts, Short Video / Reel Posts and UGC Ad Posts before continuing to the normal publishing workflow.</p></div>
    </Modal>
  </>
}
