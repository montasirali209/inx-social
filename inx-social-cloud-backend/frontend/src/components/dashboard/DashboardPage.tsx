import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, ListVideo, RefreshCw, Video } from 'lucide-react'
import { ApiError } from '../../lib/api-client'
import { fetchDashboardView } from '../../lib/dashboard-api'
import { ConnectedPagesCard } from './ConnectedPagesCard'
import { PublishingQueueTable } from './PublishingQueueTable'
import { QuickActionsCard } from './QuickActionsCard'
import { StatCard } from './StatCard'
import { UpcomingScheduleCard } from './UpcomingScheduleCard'
import { UploadProgressCard } from './UploadProgressCard'
import { WorkflowStepper } from './WorkflowStepper'

const statIcons = [Video, CalendarClock, ListVideo, CheckCircle2, AlertTriangle]

function weekLabel() {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const formatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
  return `${formatter.format(start)} – ${formatter.format(end)}`
}

function DashboardSkeleton() {
  return <div aria-label="Loading dashboard" className="space-y-5" role="status"><div className="h-24 animate-pulse rounded-panel bg-panel motion-reduce:animate-none" /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div className="h-32 animate-pulse rounded-card bg-panel motion-reduce:animate-none" key={index} />)}</div><div className="h-28 animate-pulse rounded-panel bg-panel motion-reduce:animate-none" /><div className="h-96 animate-pulse rounded-panel bg-panel motion-reduce:animate-none" /></div>
}

export function DashboardPage() {
  const dashboard = useQuery({
    queryKey: ['dashboard-view'],
    queryFn: fetchDashboardView,
    refetchInterval: 60_000,
  })

  if (dashboard.isPending) return <DashboardSkeleton />
  if (dashboard.isError) {
    const sessionRequired = dashboard.error instanceof ApiError && dashboard.error.status === 401
    return (
      <section className="mx-auto grid min-h-[60vh] max-w-2xl place-items-center text-center">
        <div className="rounded-panel border border-brand-red/25 bg-panel p-7 shadow-panel">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-red/10 text-brand-red"><AlertTriangle aria-hidden="true" className="size-6" /></span>
          <h1 className="mt-5 text-xl font-semibold">{sessionRequired ? 'Sign in to open your dashboard' : 'Dashboard data is unavailable'}</h1>
          <p className="mt-2 text-sm leading-6 text-text-muted">{sessionRequired ? 'Your existing INX Social session is required to load private publishing data.' : dashboard.error.message}</p>
          {sessionRequired ? <a className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan" href="/studio/">Open sign in</a> : <button className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan" onClick={() => dashboard.refetch()} type="button"><RefreshCw aria-hidden="true" className="size-4" /> Retry</button>}
        </div>
      </section>
    )
  }

  const data = dashboard.data
  const displayName = data.overview.user.name?.split(/\s+/)[0] || data.overview.user.businessName || 'there'

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#66b3ff]">Welcome back, {displayName}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl lg:text-4xl">Your video scheduling workspace</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted sm:text-base">Plan, schedule, and publish videos seamlessly across all your platforms.</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <time className="hidden min-h-10 items-center gap-2 rounded-xl border border-border-soft bg-panel/75 px-3 text-xs font-semibold text-text-muted sm:inline-flex"><Clock3 aria-hidden="true" className="size-4 text-brand-cyan" /> {weekLabel()}</time>
          <button aria-label="Refresh dashboard" className="grid size-10 place-items-center rounded-xl border border-border-soft bg-panel/75 text-text-muted transition hover:border-brand-blue/35 hover:text-text-main focus-visible:outline-2 focus-visible:outline-brand-cyan" disabled={dashboard.isFetching} onClick={() => dashboard.refetch()} type="button"><RefreshCw aria-hidden="true" className={`size-4 ${dashboard.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} /></button>
        </div>
      </header>

      <section aria-label="Publishing overview" className="mt-5 flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-3 xl:grid-cols-5">
        {data.stats.map((stat, index) => <StatCard data={stat} icon={statIcons[index]} key={stat.label} />)}
      </section>

      <div className="mt-5"><WorkflowStepper summary={data.overview.summary} /></div>

      <div className="mt-5 grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <PublishingQueueTable jobs={data.queue} />
        <aside aria-label="Dashboard details" className="grid gap-5 md:grid-cols-2 2xl:grid-cols-1">
          <UpcomingScheduleCard jobs={data.upcoming} />
          <ConnectedPagesCard pages={data.overview.pages} />
          <UploadProgressCard job={data.activeTransfer} />
          <QuickActionsCard />
        </aside>
      </div>
    </div>
  )
}
