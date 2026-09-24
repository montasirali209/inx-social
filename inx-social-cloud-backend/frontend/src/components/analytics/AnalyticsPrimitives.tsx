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

export function AnalyticsKpiSkeleton() {
  return <div aria-label="Loading Analytics metrics" className="scrollbar-thin flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 xl:grid-cols-6" role="status">
    {loadingStats.map(([emoji, label], index) => <div className="relative min-w-[205px] min-h-28 overflow-hidden rounded-card border border-border-soft bg-panel/70 p-3" key={label}>
      <div aria-hidden="true" className="absolute -right-5 -top-5 size-16 rounded-full bg-brand-cyan/[.05] blur-2xl" />
      <div className="relative flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg border border-white/[.07] bg-white/[.025] text-base motion-safe:animate-bounce" style={{ animationDelay: `${index * 90}ms` }}>{emoji}</span><span className="text-[10px] font-semibold text-text-muted">{label}</span></div>
      <strong className="relative mt-3 block text-sm text-text-main">Updating…</strong>
      <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-border-soft"><span className="block h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-brand-teal/60 to-brand-cyan motion-reduce:animate-none" /></div>
      <small className="relative mt-2 block text-[9px] text-text-soft">Fetching latest metrics</small>
    </div>)}
  </div>
}


function LoadingPanel({ title, className = '', rows = 3 }: { title: string; className?: string; rows?: number }) {
  return <AnalyticsCard className={`bg-panel/70 ${className}`}>
    <AnalyticsCardHeader title={title} description="Latest account analytics are being synchronized." />
    <div className="space-y-3 px-4 pb-5 sm:px-5">
      {Array.from({ length: rows }, (_, index) => <div className="overflow-hidden rounded-lg border border-white/[.05] bg-white/[.02] p-3" key={index}>
        <div className="h-2.5 w-2/5 animate-pulse rounded-full bg-white/[.08] motion-reduce:animate-none" />
        <div className="mt-2 h-2 w-4/5 animate-pulse rounded-full bg-white/[.045] motion-reduce:animate-none" style={{ animationDelay: `${index * 100}ms` }} />
      </div>)}
    </div>
  </AnalyticsCard>
}

export function AnalyticsWorkspaceSkeleton() {
  return <div aria-label="Synchronizing Analytics workspace" className="analytics-data-transition space-y-4" role="status">
    <AnalyticsKpiSkeleton />
    <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,2.15fr)_minmax(280px,.62fr)]">
      <AnalyticsCard className="min-h-[360px] bg-panel/70">
        <AnalyticsCardHeader title="Content Performance by Publish Date" description="Latest post performance is being synchronized." />
        <div className="relative mx-4 mb-5 h-[260px] overflow-hidden rounded-xl border border-white/[.05] bg-bg/25 sm:mx-5">
          <div className="absolute inset-x-5 bottom-7 top-5 flex items-end gap-2">
            {[18, 26, 21, 38, 31, 44, 35, 58, 49, 72, 60, 84, 52].map((height, index) => <span className="min-w-0 flex-1 animate-pulse rounded-t-sm bg-gradient-to-t from-brand-cyan/55 to-brand-blue/20 motion-reduce:animate-none" key={index} style={{ height: `${height}%`, animationDelay: `${index * 70}ms` }} />)}
          </div>
          <span className="absolute bottom-3 left-5 text-[9px] text-text-soft">Updating latest account performance…</span>
        </div>
      </AnalyticsCard>
      <LoadingPanel className="min-h-[360px]" rows={4} title="Engagement by Platform" />
    </div>
    <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(260px,.75fr)_minmax(300px,.9fr)]">
      <LoadingPanel title="Top Performing Posts" />
      <LoadingPanel title="Content Efficiency" rows={2} />
      <LoadingPanel title="Publishing Rhythm" rows={2} />
    </div>
  </div>
}
