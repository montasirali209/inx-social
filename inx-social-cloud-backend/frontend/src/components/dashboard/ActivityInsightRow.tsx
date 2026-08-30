import { BarChart3, CalendarDays, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

export function ActivityInsightRow({
  publishedChange,
  mostActiveDay,
  mostActiveCount,
}: {
  publishedChange: string
  mostActiveDay: string
  mostActiveCount: number
}) {
  return (
    <div className="grid overflow-hidden rounded-2xl border border-border-soft bg-bg/35 md:grid-cols-3">
      <div className="flex items-center gap-3 border-b border-border-soft p-4 md:border-b-0 md:border-r">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-teal-400/10 text-teal-300"><Sparkles aria-hidden="true" className="size-5" /></span>
        <div>
          <p className="text-sm font-semibold text-text-main">Great job!</p>
          <p className="mt-1 text-xs leading-5 text-text-muted">Published activity is <span className="font-semibold text-teal-300">{publishedChange}</span> compared with the previous period.</p>
        </div>
      </div>
      <div className="flex items-center gap-3 border-b border-border-soft p-4 md:border-b-0 md:border-r">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-500/10 text-blue-300"><BarChart3 aria-hidden="true" className="size-5" /></span>
        <div>
          <p className="text-sm font-semibold text-text-main">Most active day</p>
          <p className="mt-1 text-sm font-semibold text-blue-300">{mostActiveDay}</p>
          <p className="mt-0.5 text-xs text-text-muted">{mostActiveCount} post{mostActiveCount === 1 ? '' : 's'} published</p>
        </div>
      </div>
      <div className="flex flex-col justify-center gap-2 p-4">
        <p className="text-sm font-semibold text-text-main">Quick Actions</p>
        <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-teal-300/20 bg-teal-400/8 px-4 text-sm font-semibold text-text-main transition duration-200 hover:-translate-y-0.5 hover:border-teal-300/40 hover:bg-teal-400/14 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan motion-reduce:transform-none motion-reduce:transition-none" to="/content-calendar">
          <CalendarDays aria-hidden="true" className="size-4 text-teal-300" />
          Open Calendar
        </Link>
      </div>
    </div>
  )
}
