import { Clapperboard, Image, Images, Play, Sparkles, UserRound } from 'lucide-react'
import type { AIContentType } from '../../types/ai-content-studio'

export function AIStudioHeroArtwork() {
  return <div aria-hidden="true" className="relative hidden min-h-[260px] items-center justify-center lg:flex">
    <div className="absolute left-[4%] top-[18%] size-40 rounded-full bg-brand-cyan/[.08] blur-3xl" />
    <div className="absolute bottom-[12%] right-[4%] size-32 rounded-full bg-brand-purple/[.08] blur-3xl" />

    <div className="absolute left-[4%] top-[28%] w-[132px] -rotate-6 rounded-[22px] border border-border-soft bg-white p-3 shadow-[0_16px_38px_rgba(15,23,42,.08)]">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-xl bg-brand-purple/10 text-brand-purple"><Sparkles className="size-3.5" /></span>
        <span className="text-[8px] font-semibold text-text-muted">Creative brief</span>
      </div>
      <div className="mt-3 space-y-2">
        <span className="block h-2 w-full rounded-full bg-slate-100" />
        <span className="block h-2 w-4/5 rounded-full bg-slate-100" />
        <span className="block h-2 w-3/5 rounded-full bg-brand-purple/10" />
      </div>
    </div>

    <div className="relative z-10 w-[176px] rotate-[3deg] overflow-hidden rounded-[26px] border border-brand-cyan/20 bg-white p-3.5 shadow-[0_24px_60px_rgba(15,23,42,.14)] transition-transform duration-500 ease-out hover:-translate-y-1 hover:rotate-1 motion-reduce:transform-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[8px] font-bold text-text-main"><span className="grid size-5 place-items-center rounded-lg bg-brand-teal/10 text-brand-cyan"><Sparkles className="size-3" /></span>INXSocial</div>
        <span className="rounded-full border border-brand-green/20 bg-brand-green/10 px-2 py-0.5 text-[6px] font-bold text-brand-green">READY</span>
      </div>
      <div className="mt-3 overflow-hidden rounded-[18px] border border-brand-cyan/15 bg-[radial-gradient(circle_at_72%_20%,rgba(34,211,238,.20),transparent_4rem),linear-gradient(145deg,#ecfeff,#f8fafc)] p-3">
        <div className="grid h-[88px] place-items-center rounded-xl border border-white bg-white/80 shadow-sm">
          <div className="text-center">
            <span className="mx-auto grid size-9 place-items-center rounded-2xl bg-brand-cyan/10 text-brand-cyan"><Image className="size-4" /></span>
            <strong className="mt-2 block text-[10px] text-text-main">Content generated</strong>
            <span className="mt-1 block text-[7px] text-text-muted">Ready to review</span>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">{['Create', 'Refine', 'Post'].map((label) => <span className="rounded-lg border border-border-soft bg-slate-50 px-1.5 py-1.5 text-center text-[7px] font-medium text-text-muted" key={label}>{label}</span>)}</div>
    </div>

    <div className="absolute right-[2%] top-[24%] w-[126px] rotate-6 rounded-[22px] border border-brand-teal/20 bg-white p-3 shadow-[0_16px_38px_rgba(15,23,42,.08)]">
      <span className="text-[7px] font-bold uppercase tracking-[.13em] text-brand-cyan">Workflow</span>
      <div className="mt-3 space-y-2">
        {['Create', 'Review', 'Schedule'].map((label, index) => <div className="flex items-center gap-2" key={label}>
          <span className="grid size-5 place-items-center rounded-full border border-brand-teal/20 bg-brand-teal/10 text-[7px] font-bold text-brand-cyan">{index + 1}</span>
          <span className="text-[8px] font-medium text-text-main">{label}</span>
        </div>)}
      </div>
    </div>
  </div>
}

function ImagePreview() {
  return <div className="absolute right-4 top-4 h-24 w-24 rotate-2 overflow-hidden rounded-[20px] border border-brand-teal/20 bg-white p-2 shadow-[0_14px_32px_rgba(15,23,42,.10)] transition-all duration-500 ease-out group-hover:-translate-y-1.5 group-hover:rotate-3 motion-reduce:transform-none">
    <div className="relative h-full overflow-hidden rounded-[14px] border border-brand-cyan/10 bg-[radial-gradient(circle_at_72%_20%,rgba(34,211,238,.28),transparent_3rem),linear-gradient(150deg,#ecfeff,#f0fdfa_52%,#f8fafc)]">
      <span className="absolute left-2 top-2 grid size-6 place-items-center rounded-lg bg-white/90 text-brand-cyan shadow-sm"><Image className="size-3" /></span>
      <span className="absolute bottom-2 left-2 right-2 h-2 rounded-full bg-white/90 shadow-sm"><span className="block h-full w-2/3 rounded-full bg-brand-cyan/35" /></span>
    </div>
  </div>
}

function CarouselPreview() {
  return <div className="absolute right-3 top-5 flex items-end gap-1.5 transition-transform duration-500 ease-out group-hover:-translate-y-1.5 motion-reduce:transform-none">
    <div className="h-24 w-16 -rotate-3 rounded-[16px] border border-brand-purple/20 bg-white p-2 shadow-[0_12px_28px_rgba(76,29,149,.10)]">
      <span className="grid size-6 place-items-center rounded-lg bg-brand-purple/10 text-brand-purple"><Images className="size-3" /></span>
      <span className="mt-3 block h-2 rounded-full bg-brand-purple/15" /><span className="mt-1.5 block h-2 w-3/4 rounded-full bg-slate-100" />
    </div>
    <div className="h-20 w-12 rotate-1 rounded-[14px] border border-brand-cyan/15 bg-[linear-gradient(145deg,#ecfeff,#fff)] p-2 shadow-sm"><span className="block h-full rounded-lg bg-white/80" /></div>
    <div className="h-16 w-10 rotate-3 rounded-[12px] border border-brand-teal/15 bg-[linear-gradient(145deg,#ecfdf9,#fff)] p-1.5 shadow-sm"><span className="block h-full rounded-md bg-white/80" /></div>
  </div>
}

function VideoCardPreview() {
  return <div className="absolute right-4 top-5 h-20 w-32 overflow-hidden rounded-[18px] border border-brand-cyan/20 bg-white p-2 shadow-[0_14px_32px_rgba(15,23,42,.10)] transition-all duration-500 ease-out group-hover:-translate-y-1.5 group-hover:scale-[1.02] motion-reduce:transform-none">
    <div className="relative h-full overflow-hidden rounded-[12px] border border-brand-cyan/10 bg-[radial-gradient(circle_at_72%_30%,rgba(34,211,238,.24),transparent_4rem),linear-gradient(145deg,#ecfeff,#f8fafc)]">
      <span className="absolute inset-0 grid place-items-center"><span className="grid size-9 place-items-center rounded-full border border-brand-cyan/20 bg-white text-brand-cyan shadow-sm"><Play className="ml-0.5 size-4 fill-current" /></span></span>
      <span className="absolute bottom-1.5 right-1.5 rounded-full border border-border-soft bg-white px-1.5 py-0.5 text-[7px] font-medium text-text-muted">0:15</span>
    </div>
  </div>
}

function UGCPreview() {
  return <div className="absolute right-3 top-4 h-24 w-24 -rotate-2 overflow-hidden rounded-[20px] border border-brand-amber/20 bg-white p-2 shadow-[0_14px_32px_rgba(15,23,42,.10)] transition-all duration-500 ease-out group-hover:-translate-y-1.5 group-hover:rotate-0 motion-reduce:transform-none">
    <div className="relative h-full rounded-[14px] border border-brand-amber/10 bg-[linear-gradient(145deg,#fff7ed,#fff)] p-2">
      <span className="grid size-8 place-items-center rounded-full border border-brand-amber/20 bg-white text-brand-amber shadow-sm"><UserRound className="size-4" /></span>
      <span className="mt-2 block h-2 rounded-full bg-brand-amber/15" />
      <span className="mt-1.5 block h-2 w-3/4 rounded-full bg-slate-100" />
      <span className="absolute bottom-2 right-2 rounded-full border border-brand-green/20 bg-brand-green/10 px-1.5 py-0.5 text-[6px] font-bold text-brand-green">UGC</span>
    </div>
  </div>
}

export function AIWorkflowArtwork({ type }: { type: AIContentType }) {
  if (type === 'image_post') return <ImagePreview />
  if (type === 'carousel_post') return <CarouselPreview />
  if (type === 'short_video') return <VideoCardPreview />
  return <UGCPreview />
}

export function AIWorkflowMiniIcon({ type }: { type: AIContentType }) {
  if (type === 'image_post') return <Image className="size-5" />
  if (type === 'carousel_post') return <Images className="size-5" />
  if (type === 'short_video') return <Clapperboard className="size-5" />
  return <UserRound className="size-5" />
}
