import { Activity, Clock3, FileBarChart2, Layers3 } from 'lucide-react'
import type { PlatformAnalytics } from '../../types/dashboard'

function syncLabel(value?: string | null) {
  if (!value) return 'Waiting for sync'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Waiting for sync'
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date)
}

export function AnalyticsScopeNotice({
  analytics,
  sourceName,
}: {
  analytics: PlatformAnalytics
  sourceName: string
}) {

  return <section className="relative overflow-hidden rounded-panel border border-brand-cyan/15 bg-[radial-gradient(circle_at_0%_0%,rgba(34,211,238,.09),transparent_32%),linear-gradient(135deg,rgba(8,31,42,.92),rgba(5,20,30,.92))] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.025)] sm:px-5">
    <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-16 size-40 rounded-full bg-brand-teal/[.06] blur-3xl" />
    <div className="relative flex flex-col gap-3 xl:flex-row xl:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand-cyan/20 bg-brand-cyan/8 text-brand-cyan"><FileBarChart2 className="size-4.5" /></span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-xs text-text-main">Current post performance</strong>
            <span className="rounded-full border border-brand-green/15 bg-brand-green/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[.13em] text-brand-green">Live</span>
          </div>
          <p className="mt-1 max-w-4xl text-[10px] leading-5 text-text-muted">
            Latest verified performance for published posts from {sourceName}. Values update from the connected platform analytics source.
          </p>
        </div>
      </div>

      <div className="grid shrink-0 gap-2 sm:grid-cols-3 xl:w-[520px]">
        <span className="flex items-center gap-2 rounded-xl border border-white/[.06] bg-white/[.025] px-3 py-2">
          <Activity className="size-3.5 shrink-0 text-brand-cyan" />
          <span><b className="block text-[9px] font-semibold text-text-main">Post metrics</b><small className="block text-[8px] leading-4 text-text-soft">Latest views and engagement</small></span>
        </span>
        <span className="flex items-center gap-2 rounded-xl border border-white/[.06] bg-white/[.025] px-3 py-2">
          <Layers3 className="size-3.5 shrink-0 text-brand-teal" />
          <span><b className="block text-[9px] font-semibold text-text-main">Selected account</b><small className="block text-[8px] leading-4 text-text-soft">This account only</small></span>
        </span>
        <span className="flex items-center gap-2 rounded-xl border border-white/[.06] bg-white/[.025] px-3 py-2">
          <Clock3 className="size-3.5 shrink-0 text-brand-amber" />
          <span><b className="block text-[9px] font-semibold text-text-main">Last synced</b><small className="block text-[8px] leading-4 text-text-soft">{syncLabel(analytics.fetchedAt)}</small></span>
        </span>
      </div>
    </div>
  </section>
}
