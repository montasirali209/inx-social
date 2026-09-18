import { Info } from 'lucide-react'
import type { ReactNode } from 'react'

export function AnalyticsCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`analytics-fluid-card interactive-surface min-w-0 overflow-hidden rounded-panel border ${className}`}>{children}</section>
}

export function AnalyticsCardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <header className="relative z-[2] flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5"><div><div className="flex items-center gap-2"><h2 className="text-sm font-semibold">{title}</h2><span className="group relative"><button aria-label={`About ${title}`} className="rounded-full text-text-soft hover:text-brand-cyan focus-visible:outline-2 focus-visible:outline-brand-cyan" type="button"><Info className="size-3.5" /></button><span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-56 -translate-x-1/2 rounded-lg border border-border-soft bg-bg/95 p-2 text-[10px] font-normal leading-4 text-text-muted shadow-panel group-hover:block group-focus-within:block">{description || `Live ${title.toLowerCase()} for the selected connected account.`}</span></span></div>{description && <p className="mt-1 text-[10px] text-text-muted">{description}</p>}</div>{action}</header>
}

export function UnavailableState({ title, detail }: { title: string; detail: string }) {
  return <div className="relative z-[2] grid min-h-52 place-items-center p-6 text-center"><span><Info className="mx-auto size-7 text-brand-amber" /><strong className="mt-3 block text-sm">{title}</strong><p className="mx-auto mt-2 max-w-sm text-[11px] leading-5 text-text-muted">{detail}</p></span></div>
}

const loadingStats = [
  ['👀', 'Post views'],
  ['💬', 'Engagement'],
  ['✨', 'Interactions'],
  ['❤️', 'Engaged posts'],
  ['📝', 'Published posts'],
  ['⚡', 'Content insights'],
] as const

export function AnalyticsSkeleton() {
  return <div aria-label="Loading Analytics" className="space-y-4" role="status">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {loadingStats.map(([emoji, label], index) => <div className="relative min-h-28 overflow-hidden rounded-card border border-border-soft bg-panel/70 p-3" key={label}>
        <div aria-hidden="true" className="absolute -right-5 -top-5 size-16 rounded-full bg-brand-cyan/[.05] blur-2xl" />
        <div className="relative flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg border border-white/[.07] bg-white/[.025] text-base motion-safe:animate-bounce" style={{ animationDelay: `${index * 90}ms` }}>{emoji}</span><span className="text-[10px] font-semibold text-text-muted">{label}</span></div>
        <strong className="relative mt-3 block text-sm text-text-main">Updating…</strong>
        <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-border-soft"><span className="block h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-brand-teal/60 to-brand-cyan motion-reduce:animate-none" /></div>
        <small className="relative mt-2 block text-[9px] text-text-soft">Fetching latest metrics</small>
      </div>)}
    </div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,.72fr)]">
      <div className="relative min-h-[310px] overflow-hidden rounded-panel border border-border-soft bg-panel/70 p-5">
        <div className="flex items-center justify-between"><span><strong className="block text-sm">Post Performance Trend</strong><small className="mt-1 block text-[10px] text-text-muted">Preparing your latest trend data</small></span><span className="text-2xl motion-safe:animate-pulse">📈</span></div>
        <div className="mt-8 grid h-44 place-items-center rounded-xl border border-dashed border-border-soft bg-bg/20"><span className="text-center"><span className="block text-3xl motion-safe:animate-bounce">⏳</span><strong className="mt-3 block text-xs">Bringing your analytics together</strong><small className="mt-1 block text-[10px] text-text-soft">This normally takes a few seconds.</small></span></div>
      </div>
      <div className="min-h-[310px] rounded-panel border border-border-soft bg-panel/70 p-5"><strong className="text-sm">Engagement by Platform</strong><div className="mt-8 grid place-items-center"><div className="grid size-36 place-items-center rounded-full border-[14px] border-brand-teal/10"><span className="text-center"><span className="block text-2xl motion-safe:animate-spin">✨</span><small className="mt-2 block text-[9px] text-text-soft">Loading</small></span></div></div></div>
    </div>
  </div>
}
