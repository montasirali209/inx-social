import { Clapperboard, Image, Images, Play, Sparkles, UserRound } from 'lucide-react'
import type { AIContentType } from '../../types/ai-content-studio'

export function AIStudioHeroArtwork() {
  return <div aria-hidden="true" className="relative hidden min-h-[260px] items-center justify-center lg:flex">
    <div className="absolute left-[10%] top-[28%] h-[168px] w-[132px] -rotate-6 rounded-[24px] border border-brand-cyan/20 bg-[linear-gradient(145deg,rgba(34,211,238,.12),rgba(3,17,30,.96))] shadow-[0_26px_80px_rgba(0,0,0,.34)]" />
    <div className="absolute left-[22%] top-[18%] h-[184px] w-[145px] rotate-3 rounded-[24px] border border-brand-teal/30 bg-[linear-gradient(145deg,rgba(20,184,166,.16),rgba(3,17,30,.97))] shadow-[0_30px_90px_rgba(0,0,0,.42)]" />
    <div className="relative z-10 h-[210px] w-[166px] rotate-[7deg] overflow-hidden rounded-[26px] border border-brand-cyan/40 bg-[#071424] p-3 shadow-[0_35px_100px_rgba(0,0,0,.58),0_0_40px_rgba(34,211,238,.10)]">
      <div className="flex items-center gap-1.5 text-[8px] font-semibold text-white"><span className="grid size-4 place-items-center rounded bg-brand-teal/20 text-brand-cyan"><Sparkles className="size-2.5" /></span>INXSocial</div>
      <div className="mt-3 flex h-[126px] flex-col justify-end overflow-hidden rounded-[18px] border border-white/10 bg-[radial-gradient(circle_at_65%_18%,rgba(34,211,238,.25),transparent_4rem),linear-gradient(165deg,#12364b_0%,#0b2236_40%,#061523_65%,#07111d_100%)] p-3">
        <span className="mb-1 block h-10 rounded-t-[50%] bg-[linear-gradient(135deg,rgba(148,163,184,.55),rgba(15,23,42,.15))] blur-[.2px]" />
        <strong className="text-[17px] leading-[1.03] tracking-[-.04em]">Ideas today.<br />Impact <span className="text-brand-cyan">tomorrow.</span></strong>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">{['Create', 'Refine', 'Post'].map((label) => <span className="rounded-lg border border-white/8 bg-white/[.035] px-1.5 py-1 text-center text-[7px] text-text-muted" key={label}>{label}</span>)}</div>
    </div>
    <div className="absolute right-[1%] top-[20%] hidden rotate-[-7deg] text-[13px] font-medium italic leading-7 text-brand-cyan/90 2xl:block">Create.<br />Refine.<br />Schedule.<br />Grow.</div>
  </div>
}

function ImagePreview() {
  return <div className="absolute right-4 top-4 h-24 w-24 rotate-3 overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_70%_20%,rgba(34,211,238,.28),transparent_3rem),linear-gradient(150deg,#0c4a6e,#0b2236_48%,#07131f)] p-2 shadow-[0_18px_40px_rgba(0,0,0,.28)]"><div className="flex h-full items-end rounded-lg border border-white/8 bg-[linear-gradient(165deg,transparent_30%,rgba(148,163,184,.18)_31%,rgba(8,47,73,.5)_48%,rgba(3,12,22,.7)_70%)] p-2"><span className="text-[7px] italic text-white/80">Turn ideas<br />into visuals</span></div></div>
}

function CarouselPreview() {
  return <div className="absolute right-3 top-5 flex items-end gap-1"><div className="h-24 w-16 -rotate-2 rounded-lg border border-violet-300/35 bg-[linear-gradient(145deg,#13234a,#152141)] p-2 shadow-lg"><strong className="text-[10px] leading-[1.05] text-white">A<br />brighter<br />social<br /><span className="text-brand-cyan">tomorrow.</span></strong></div><div className="h-20 w-11 rotate-2 rounded-lg border border-white/15 bg-[linear-gradient(145deg,#21375b,#101829)]" /><div className="h-16 w-9 rotate-3 rounded-lg border border-white/15 bg-[linear-gradient(145deg,#4c1d95,#131d30)]" /></div>
}

function VideoCardPreview() {
  return <div className="absolute right-4 top-5 h-20 w-32 overflow-hidden rounded-xl border border-brand-cyan/20 bg-[radial-gradient(circle_at_70%_40%,rgba(34,211,238,.24),transparent_4rem),linear-gradient(145deg,#0b3147,#071625)] shadow-lg"><span className="absolute inset-0 grid place-items-center"><span className="grid size-9 place-items-center rounded-full border border-white/40 bg-black/30"><Play className="ml-0.5 size-4 fill-white text-white" /></span></span><span className="absolute bottom-1.5 right-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[7px] text-white">0:15</span></div>
}

function UGCPreview() {
  return <div className="absolute right-3 top-4 h-24 w-24 rotate-[-7deg] overflow-hidden rounded-xl border border-brand-amber/20 bg-[linear-gradient(145deg,#54440d,#1c2330_48%,#08121f)] shadow-lg"><div className="absolute left-1/2 top-1/2 h-16 w-10 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-[linear-gradient(145deg,#18181b,#050505)] shadow-[0_8px_18px_rgba(0,0,0,.45)]"><span className="absolute left-1/2 top-3 size-2 -translate-x-1/2 rounded-full border border-white/15 bg-brand-cyan/20" /></div><span className="absolute right-1 top-1 text-[6px] italic leading-3 text-white/75">Real<br />People.<br />Real<br />Results.</span></div>
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
