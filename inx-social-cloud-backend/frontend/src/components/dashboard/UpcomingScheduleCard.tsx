import { ArrowUpRight, CalendarClock, Film } from 'lucide-react'
import { formatSchedule, jobTitle } from '../../lib/dashboard-format'
import type { DashboardJob } from '../../types/dashboard'
import { DashboardCard } from './DashboardCard'

export function UpcomingScheduleCard({ jobs }: { jobs: DashboardJob[] }) {
  return (
    <DashboardCard
      action={<a className="inline-flex items-center gap-1 text-xs font-semibold text-[#6db2ff] hover:text-brand-cyan focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/studio/?view=calendar">View calendar <ArrowUpRight aria-hidden="true" className="size-3.5" /></a>}
      title="Upcoming Schedule"
    >
      {jobs.length === 0 ? (
        <div className="relative flex min-h-24 items-center gap-3 overflow-hidden px-4 py-3.5">
          <span aria-hidden="true" className="absolute -right-8 top-1/2 size-28 -translate-y-1/2 rounded-full border border-brand-blue/10 bg-brand-blue/[0.025]" />
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-brand-blue/20 bg-brand-blue/10 text-[#65adff] shadow-glow-blue"><CalendarClock aria-hidden="true" className="icon-float size-5" /></span>
          <div className="relative"><strong className="text-sm">Your schedule is open</strong><p className="mt-1 max-w-[250px] text-xs leading-5 text-text-muted">No upcoming videos yet. Choose a future slot when your next video is ready.</p></div>
        </div>
      ) : (
        <ul className="divide-y divide-border-soft px-4">
          {jobs.map((job) => (
            <li className="group/item flex items-center gap-3 py-2.5 transition hover:translate-x-0.5 motion-reduce:transition-none" key={job.id}>
              <time className="w-10 shrink-0 text-center" dateTime={job.scheduledAt ?? undefined}>
                <span className="block text-[10px] font-semibold uppercase text-text-soft">{new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(new Date(job.scheduledAt!))}</span>
                <strong className="block text-lg leading-5">{new Date(job.scheduledAt!).getDate()}</strong>
              </time>
              <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-brand-blue/18 bg-gradient-to-br from-brand-blue/18 to-brand-cyan/7 text-brand-cyan"><Film aria-hidden="true" className="size-4" /><span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-brand-blue to-brand-cyan" /></span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-xs font-semibold">{jobTitle(job)}</strong>
                <small className="mt-1 block truncate text-[11px] text-text-muted">{formatSchedule(job.scheduledAt, 'time')} · {job.page?.facebookPageName || 'Facebook'}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  )
}
