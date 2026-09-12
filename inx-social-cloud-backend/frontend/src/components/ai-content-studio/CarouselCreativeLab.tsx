import { Layers3, Pencil, Sparkles } from 'lucide-react'

export function CarouselCreativeLab({ slides, refining = false }: { slides: number; refining?: boolean }) {
  return (
    <div className="relative grid min-h-[420px] overflow-hidden rounded-[20px] bg-[radial-gradient(circle_at_50%_34%,rgba(0,214,192,.12),transparent_35%),radial-gradient(circle_at_26%_72%,rgba(72,95,255,.1),transparent_28%)] px-4 py-8 text-center" aria-live="polite" aria-label={refining ? 'Refining carousel' : 'Generating carousel'}>
      <style>{`
        @keyframes inxLabFloat { 0%,100% { transform: translate3d(0,0,28px) rotate(-3deg); } 50% { transform: translate3d(0,-12px,42px) rotate(2deg); } }
        @keyframes inxLabBob { 0%,100% { transform: translateY(0) rotateY(-6deg); } 50% { transform: translateY(-7px) rotateY(6deg); } }
        @keyframes inxLabThink { 0%,100% { transform: translate3d(0,0,46px) scale(.9); opacity:.25; } 45% { transform: translate3d(8px,-14px,70px) scale(1.05); opacity:1; } }
        @keyframes inxLabSketch { 0%,100% { transform: rotate(-24deg) translateX(-2px); } 50% { transform: rotate(-10deg) translateX(12px); } }
        @keyframes inxLabDraw { 0% { transform: scaleX(.12); opacity:.35; } 55%,100% { transform: scaleX(1); opacity:1; } }
        @keyframes inxLabOrbit { from { transform: rotateZ(0deg) rotateX(68deg); } to { transform: rotateZ(360deg) rotateX(68deg); } }
        @keyframes inxLabPulse { 0%,100% { opacity:.35; transform: translateY(0); } 35% { opacity:1; transform: translateY(-2px); } }
        @keyframes inxLabBlink { 0%,44%,48%,100% { transform: scaleY(1); } 46% { transform: scaleY(.08); } }
        .inx-lab-scene { perspective: 900px; transform-style: preserve-3d; }
        .inx-lab-bot { animation: inxLabBob 3.2s ease-in-out infinite; transform-style: preserve-3d; }
        .inx-lab-card { animation: inxLabFloat 3.6s ease-in-out infinite; transform-style: preserve-3d; }
        .inx-lab-card:nth-child(2) { animation-delay:-1.1s; }
        .inx-lab-card:nth-child(3) { animation-delay:-2.2s; }
        .inx-lab-thought { animation: inxLabThink 2.8s ease-in-out infinite; }
        .inx-lab-thought:nth-child(2) { animation-delay:-.8s; }
        .inx-lab-thought:nth-child(3) { animation-delay:-1.6s; }
        .inx-lab-pencil { animation: inxLabSketch 1.05s ease-in-out infinite; transform-origin: 80% 80%; }
        .inx-lab-line { animation: inxLabDraw 1.7s ease-in-out infinite; transform-origin:left center; }
        .inx-lab-line:nth-child(2) { animation-delay:-.45s; }
        .inx-lab-line:nth-child(3) { animation-delay:-.9s; }
        .inx-lab-orbit { animation: inxLabOrbit 8s linear infinite; }
        .inx-lab-eye { animation: inxLabBlink 5.4s linear infinite; transform-origin:center; }
        .inx-lab-status { animation: inxLabPulse 2.4s ease-in-out infinite; }
        .inx-lab-status:nth-child(2) { animation-delay:-.8s; }
        .inx-lab-status:nth-child(3) { animation-delay:-1.6s; }
        @media (prefers-reduced-motion: reduce) { .inx-lab-bot,.inx-lab-card,.inx-lab-thought,.inx-lab-pencil,.inx-lab-line,.inx-lab-orbit,.inx-lab-eye,.inx-lab-status { animation:none !important; } }
      `}</style>

      <div className="inx-lab-scene relative mx-auto flex w-full max-w-[620px] items-center justify-center">
        <div className="inx-lab-orbit pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-cyan/15 shadow-[0_0_70px_rgba(0,214,192,.07)]" />

        <div className="inx-lab-card absolute left-[6%] top-[18%] hidden w-28 rounded-2xl border border-brand-cyan/20 bg-[#092131]/90 p-3 text-left shadow-[0_22px_60px_rgba(0,0,0,.36)] sm:block" style={{ transform: 'translateZ(34px) rotate(-5deg)' }}>
          <span className="text-[8px] font-bold uppercase tracking-[.13em] text-brand-cyan">Story</span>
          <div className="mt-2 h-1.5 w-16 rounded-full bg-brand-cyan/30" />
          <div className="mt-1.5 h-1.5 w-12 rounded-full bg-white/10" />
        </div>
        <div className="inx-lab-card absolute right-[4%] top-[14%] hidden w-28 rounded-2xl border border-violet-400/20 bg-[#111b35]/90 p-3 text-left shadow-[0_22px_60px_rgba(0,0,0,.36)] sm:block" style={{ transform: 'translateZ(42px) rotate(5deg)' }}>
          <span className="text-[8px] font-bold uppercase tracking-[.13em] text-violet-300">Layout</span>
          <div className="mt-2 grid grid-cols-2 gap-1"><span className="h-8 rounded-md bg-violet-400/10" /><span className="h-8 rounded-md bg-brand-cyan/10" /></div>
        </div>
        <div className="inx-lab-card absolute bottom-[13%] right-[10%] hidden w-24 rounded-2xl border border-brand-green/20 bg-[#08251f]/90 p-3 shadow-[0_22px_60px_rgba(0,0,0,.36)] sm:block" style={{ transform: 'translateZ(25px) rotate(3deg)' }}>
          <Layers3 className="mx-auto size-4 text-brand-green" />
          <strong className="mt-1 block text-[9px]">{slides} slides</strong>
        </div>

        <div className="inx-lab-bot relative z-10 mt-6" style={{ transformStyle: 'preserve-3d' }}>
          <div className="relative mx-auto h-28 w-32 rounded-[34px] border border-brand-cyan/35 bg-[linear-gradient(145deg,#173a4d,#071722_72%)] shadow-[inset_0_1px_0_rgba(255,255,255,.11),0_25px_80px_rgba(0,0,0,.55),0_0_45px_rgba(0,214,192,.1)]" style={{ transform: 'translateZ(58px)' }}>
            <div className="absolute left-1/2 top-[-24px] h-7 w-1 -translate-x-1/2 rounded-full bg-brand-cyan/60"><span className="absolute -left-[5px] -top-2 size-3 rounded-full border border-brand-cyan/60 bg-[#092636] shadow-[0_0_15px_rgba(0,214,192,.55)]" /></div>
            <div className="absolute inset-x-5 top-8 flex justify-between">
              <span className="inx-lab-eye h-3 w-7 rounded-full bg-brand-cyan shadow-[0_0_18px_rgba(0,214,192,.6)]" />
              <span className="inx-lab-eye h-3 w-7 rounded-full bg-brand-cyan shadow-[0_0_18px_rgba(0,214,192,.6)]" />
            </div>
            <div className="absolute bottom-6 left-1/2 h-2.5 w-10 -translate-x-1/2 rounded-b-full border-b-2 border-brand-cyan/65" />
            <span className="absolute -left-3 top-10 h-8 w-4 rounded-l-xl border border-brand-cyan/20 bg-[#0b2331]" />
            <span className="absolute -right-3 top-10 h-8 w-4 rounded-r-xl border border-brand-cyan/20 bg-[#0b2331]" />
          </div>

          <div className="relative mx-auto -mt-1 h-24 w-24 rounded-[26px] border border-brand-cyan/25 bg-[linear-gradient(145deg,#123449,#06131e)] shadow-[0_20px_60px_rgba(0,0,0,.45)]" style={{ transform: 'translateZ(38px)' }}>
            <div className="absolute left-1/2 top-5 grid size-10 -translate-x-1/2 place-items-center rounded-2xl border border-brand-cyan/30 bg-brand-cyan/10 shadow-[inset_0_0_22px_rgba(0,214,192,.08)]"><Sparkles className="size-5 text-brand-cyan" /></div>
          </div>

          <div className="absolute -right-14 bottom-1 h-20 w-16" style={{ transform: 'translateZ(65px)' }}>
            <div className="inx-lab-pencil absolute bottom-3 left-1 h-3 w-20 rounded-full bg-[linear-gradient(90deg,#ffd071,#f0a447)] shadow-[0_6px_16px_rgba(0,0,0,.35)]"><span className="absolute -right-2 top-0 h-0 w-0 border-b-[6px] border-l-[9px] border-t-[6px] border-b-transparent border-l-[#d7c4aa] border-t-transparent" /></div>
          </div>

          <div className="absolute -bottom-7 left-1/2 h-24 w-48 -translate-x-1/2 rounded-[20px] border border-white/10 bg-[linear-gradient(165deg,#f4f8fb,#cfe0e8)] p-4 text-left shadow-[0_24px_80px_rgba(0,0,0,.5)]" style={{ transform: 'translateZ(18px) rotateX(58deg)' }}>
            <span className="block h-2 w-20 rounded-full bg-[#1d7182]/25" />
            <span className="inx-lab-line mt-3 block h-1.5 w-36 rounded-full bg-[#164a59]/35" />
            <span className="inx-lab-line mt-2 block h-1.5 w-28 rounded-full bg-[#164a59]/25" />
            <span className="inx-lab-line mt-2 block h-1.5 w-32 rounded-full bg-[#164a59]/20" />
          </div>

          <div className="absolute -right-2 -top-14 flex items-end gap-2" style={{ transform: 'translateZ(75px)' }}>
            <span className="inx-lab-thought size-3 rounded-full border border-brand-cyan/30 bg-brand-cyan/10" />
            <span className="inx-lab-thought size-5 rounded-full border border-brand-cyan/30 bg-brand-cyan/10" />
            <span className="inx-lab-thought grid size-10 place-items-center rounded-full border border-brand-cyan/30 bg-[#0b2935] text-brand-cyan shadow-[0_0_28px_rgba(0,214,192,.12)]"><Pencil className="size-4" /></span>
          </div>
        </div>
      </div>

      <div className="relative z-20 mx-auto mt-7 max-w-lg">
        <h3 className="text-base font-bold">{refining ? 'Reworking your creative direction…' : 'Your carousel is taking shape…'}</h3>
        <p className="mx-auto mt-2 max-w-md text-[10px] leading-5 text-text-muted">{refining ? 'The current version is safe while AI sketches the requested changes and rebuilds a consistent sequence.' : `AI is planning the narrative, sketching the composition and keeping all ${slides} slides visually consistent.`}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="inx-lab-status rounded-full border border-brand-cyan/20 bg-brand-cyan/[.05] px-3 py-1.5 text-[9px] text-brand-cyan">Planning story</span>
          <span className="inx-lab-status rounded-full border border-violet-400/20 bg-violet-400/[.05] px-3 py-1.5 text-[9px] text-violet-200">Sketching layouts</span>
          <span className="inx-lab-status rounded-full border border-brand-green/20 bg-brand-green/[.05] px-3 py-1.5 text-[9px] text-brand-green">Polishing slides</span>
        </div>
      </div>
    </div>
  )
}
