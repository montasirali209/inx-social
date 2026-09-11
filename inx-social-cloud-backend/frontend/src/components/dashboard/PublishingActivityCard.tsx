import { CalendarDays, Info, LineChart } from 'lucide-react'
import type { PublishingActivityPoint } from '../../types/dashboard'
import { PublishingActivityChart } from './PublishingActivityChart'

function LoadingState() {
  return <div aria-label="Loading publishing activity" className="h-[190px] animate-pulse rounded-2xl bg-white/[.035] motion-reduce:animate-none" role="status" />
}

export function PublishingActivityCard({
  points,
  rangeDays,
  onRangeChange,
  loading = false,
}: {
  points: PublishingActivityPoint[]
  rangeDays: number
  onRangeChange: (days: number) => void
  loading?: boolean
}) {
  const hasActivity = points.some((point) => point.published || point.scheduled || point.engagement)

  return (
    <section className="group relative min-h-0 overflow-hidden rounded-panel border border-teal-300/18 bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,166,.08),transparent_28rem),linear-gradient(145deg,rgba(7,25,35,.98),rgba(5,18,31,.96))] p-3 shadow-[0_20px_55px_rgba(0,0,0,.27),0_0_42px_rgba(20,184,166,.05),inset_0_1px_rgba(255,255,255,.035)]">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full border border-teal-300/8 bg-teal-400/[.025] transition duration-700 group-hover:scale-110 motion-reduce:transition-none" />
      <header className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-text-main">Publishing Activity</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-400/[.07] px-2 py-0.5 text-[9px] font-semibold text-emerald-300"><span className="size-1.5 animate-pulse rounded-full bg-emerald-400 motion-reduce:animate-none" />All accounts</span>
            <button aria-label="About publishing activity" className="grid size-6 place-items-center rounded-full text-text-soft transition hover:bg-white/5 hover:text-teal-300 focus-visible:outline-2 focus-visible:outline-brand-cyan" title="Combined publishing and engagement across connected accounts. Deep performance analysis stays in Analytics." type="button"><Info aria-hidden="true" className="size-3.5" /></button>
          </div>
          <p className="mt-1 text-[11px] text-text-muted">Combined publishing and engagement across all connected platforms.</p>
        </div>
        <label className="relative shrink-0">
          <span className="sr-only">Publishing activity date range</span>
          <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-teal-300" />
          <select className="min-h-9 appearance-none rounded-xl border border-teal-300/18 bg-bg/65 py-1.5 pl-8 pr-7 text-[10px] font-semibold text-text-main transition hover:border-teal-300/35 focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/20" onChange={(event) => onRangeChange(Number(event.target.value))} value={rangeDays}>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </label>
      </header>

      <div className="relative mt-2">
        {loading ? <LoadingState /> : hasActivity ? (
          <PublishingActivityChart points={points} />
        ) : (
          <div className="grid min-h-[190px] place-items-center rounded-2xl border border-dashed border-teal-300/18 bg-bg/30 p-5 text-center">
            <div>
              <span className="mx-auto grid size-11 place-items-center rounded-xl bg-teal-400/10 text-teal-300"><LineChart aria-hidden="true" className="size-5" /></span>
              <h3 className="mt-3 text-sm font-semibold text-text-main">No publishing activity yet.</h3>
              <p className="mt-1 text-xs text-text-muted">Create or schedule your first post to start building your workspace.</p>
              <a className="mt-3 inline-flex min-h-9 items-center justify-center rounded-xl bg-gradient-to-r from-brand-blue to-[#0f8f7f] px-4 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan" href="/app/posts">Create New Post</a>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
