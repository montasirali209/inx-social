import { Info } from 'lucide-react'
import type { ReactNode } from 'react'

export function AnalyticsCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`interactive-surface min-w-0 overflow-hidden rounded-panel border ${className}`}>{children}</section>
}

export function AnalyticsCardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <header className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5"><div><div className="flex items-center gap-2"><h2 className="text-sm font-semibold">{title}</h2><span className="group relative"><button aria-label={`About ${title}`} className="rounded-full text-text-soft hover:text-brand-cyan focus-visible:outline-2 focus-visible:outline-brand-cyan" type="button"><Info className="size-3.5" /></button><span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-56 -translate-x-1/2 rounded-lg border border-border-soft bg-bg/95 p-2 text-[10px] font-normal leading-4 text-text-muted shadow-panel group-hover:block group-focus-within:block">{description || `Live ${title.toLowerCase()} for the selected connected account.`}</span></span></div>{description && <p className="mt-1 text-[10px] text-text-muted">{description}</p>}</div>{action}</header>
}

export function UnavailableState({ title, detail }: { title: string; detail: string }) {
  return <div className="grid min-h-52 place-items-center p-6 text-center"><span><Info className="mx-auto size-7 text-brand-amber" /><strong className="mt-3 block text-sm">{title}</strong><p className="mx-auto mt-2 max-w-sm text-[11px] leading-5 text-text-muted">{detail}</p></span></div>
}

export function AnalyticsSkeleton() {
  return <div aria-label="Loading Analytics" className="space-y-4"><div className="h-24 animate-pulse rounded-panel border border-border-soft bg-panel/70" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div className="h-36 animate-pulse rounded-card border border-border-soft bg-panel/70" key={index} />)}</div><div className="grid gap-4 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div className="h-80 animate-pulse rounded-panel border border-border-soft bg-panel/70" key={index} />)}</div></div>
}
