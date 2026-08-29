import { ArrowRight, CalendarClock } from 'lucide-react'
import { formatSchedule, jobTitle } from '../../lib/dashboard-format'
import { useUiStore } from '../../store/ui-store'
import type { DashboardJob } from '../../types/dashboard'
import { DashboardCard } from './DashboardCard'
import { PlatformIcon } from './PlatformIcon'
import { StatusBadge } from './StatusBadge'

export function UpcomingScheduleCard({ jobs }: { jobs: DashboardJob[] }) {
  const timezone = useUiStore((state) => state.timezone)
  return (
    <DashboardCard
      action={<a className="inline-flex items-center gap-1 text-xs font-semibold text-brand-cyan hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/studio/?view=calendar">View Calendar <ArrowRight aria-hidden="true" className="size-3.5" /></a>}
      className="min-h-[290px]"
      title="Upcoming Schedule"
    >
      {jobs.length === 0 ? (
        <div className="relative flex min-h-24 items-center gap-3 overflow-hidden px-4 py-3.5">
          <span aria-hidden="true" className="absolute -right-8 top-1/2 size-28 -translate-y-1/2 rounded-full border border-brand-blue/10 bg-brand-blue/[0.025]" />
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-brand-blue/20 bg-brand-blue/10 text-[#65adff] shadow-glow-blue"><CalendarClock aria-hidden="true" className="icon-float size-5" /></span>
          <div className="relative"><strong className="text-sm">Your schedule is open</strong><p className="mt-1 max-w-[250px] text-xs leading-5 text-text-muted">No upcoming videos yet. Choose a future slot when your next video is ready.</p></div>
        </div>
      ) : (
        <ul className="divide-y divide-border-soft px-4 pb-2">
          {jobs.map((job) => (
            <li className="group/item flex items-center gap-3 py-2.5 transition hover:translate-x-0.5 motion-reduce:transition-none" key={job.id}>
              <time className="w-10 shrink-0 text-center" dateTime={job.scheduledAt ?? undefined}>
                <span className="block text-[10px] font-semibold uppercase text-text-soft">{new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: timezone }).format(new Date(job.scheduledAt!))}</span>
                <strong className="block text-lg leading-5">{new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: timezone }).format(new Date(job.scheduledAt!))}</strong>
              </time>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-xs font-semibold">{jobTitle(job)}</strong>
                <small className="mt-1 block truncate text-[11px] text-text-muted">{formatSchedule(job.scheduledAt, 'time', timezone)}</small>
              </span>
              <PlatformIcon className="size-5" platform="facebook" />
              <StatusBadge compact status="scheduled" />
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  )
}
