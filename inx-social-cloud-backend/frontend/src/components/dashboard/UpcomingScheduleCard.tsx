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
        <div className="flex min-h-28 items-center gap-3 px-4 py-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-blue/10 text-[#65adff]"><CalendarClock aria-hidden="true" className="size-5" /></span>
          <div><strong className="text-sm">No upcoming videos</strong><p className="mt-1 text-xs leading-5 text-text-muted">Scheduled videos will appear here.</p></div>
        </div>
      ) : (
        <ul className="divide-y divide-border-soft px-4">
          {jobs.map((job) => (
            <li className="flex items-center gap-3 py-3" key={job.id}>
              <time className="w-10 shrink-0 text-center" dateTime={job.scheduledAt ?? undefined}>
                <span className="block text-[10px] font-semibold uppercase text-text-soft">{new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(new Date(job.scheduledAt!))}</span>
                <strong className="block text-lg leading-5">{new Date(job.scheduledAt!).getDate()}</strong>
              </time>
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border-soft bg-bg-soft text-brand-cyan"><Film aria-hidden="true" className="size-4" /></span>
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
