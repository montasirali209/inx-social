import { ArrowRight, Sparkles } from 'lucide-react'
import type { StudioOverview } from '../../types/dashboard'

export function AIStudioPromoCard({ overview }: { overview: StudioOverview }) {
  const studioAllowed = Boolean(overview.features?.aiContentStudio.allowed)
  const href = studioAllowed ? '/app/ai-content-studio' : '/app/billing'
  const label = studioAllowed ? 'Try AI Content Studio' : 'Upgrade to Plus'

  return (
    <section className="group relative flex min-h-[92px] items-center justify-between gap-4 overflow-hidden rounded-card border border-brand-cyan/20 bg-[radial-gradient(circle_at_85%_120%,rgba(34,211,238,.12),transparent_18rem),linear-gradient(120deg,rgba(9,31,43,.96),rgba(5,18,31,.98))] px-4 py-3 shadow-[0_18px_42px_rgba(0,0,0,.2)]">
      <div aria-hidden="true" className="absolute -bottom-16 right-16 h-24 w-72 rounded-[50%] border border-brand-cyan/10 opacity-70 transition duration-500 group-hover:scale-110 motion-reduce:transition-none" />
      <div className="relative flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan shadow-[0_0_24px_rgba(34,211,238,.08)]">
          <Sparkles aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-text-main">Pro tip: Use AI Content Studio to generate engaging post ideas tailored to your audience.</p>
          <p className="mt-1 text-[11px] text-text-muted">Create faster, save to Media Library, then schedule through Posts.</p>
        </div>
      </div>
      <a className="relative hidden min-h-10 shrink-0 items-center gap-2 rounded-xl border border-brand-cyan/30 bg-brand-cyan/8 px-4 text-xs font-semibold text-brand-cyan transition hover:border-brand-cyan/55 hover:bg-brand-cyan/14 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan sm:inline-flex" href={href}>
        {label}<ArrowRight aria-hidden="true" className="size-3.5 transition group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </a>
    </section>
  )
}
