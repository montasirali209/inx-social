import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, FilePlus2, ListVideo, RefreshCw, ShieldCheck, Video } from 'lucide-react'
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
    <div className="dashboard-canvas">
      <header className="hero-stage px-5 py-5 sm:px-7 lg:px-8">
        <div className="relative z-[1] flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-[#66b3ff]">Welcome back, {displayName}</p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/20 bg-brand-green/8 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-green"><span className="size-1.5 rounded-full bg-brand-green shadow-[0_0_10px_#22c55e]" /> Workspace live</span>
            </div>
            <h1 className="mt-2 max-w-4xl text-2xl font-semibold tracking-[-0.04em] sm:text-3xl lg:text-[2.25rem] lg:leading-[1.08]">Your video scheduling workspace</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted sm:text-base">Plan, schedule, and publish videos seamlessly across all your platforms.</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-muted">
              <span className="inline-flex items-center gap-2 rounded-lg border border-white/7 bg-black/15 px-3 py-2"><ShieldCheck aria-hidden="true" className="size-4 text-brand-green" /> {data.overview.pages.length} connected {data.overview.pages.length === 1 ? 'Page' : 'Pages'}</span>
              <span className="inline-flex items-center gap-2 rounded-lg border border-white/7 bg-black/15 px-3 py-2"><ListVideo aria-hidden="true" className="size-4 text-brand-purple" /> {data.queue.length} in publishing queue</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
            <time className="hidden min-h-11 items-center gap-2 rounded-xl border border-border-soft bg-bg/55 px-3 text-xs font-semibold text-text-muted backdrop-blur sm:inline-flex"><Clock3 aria-hidden="true" className="size-4 text-brand-cyan" /> {weekLabel()}</time>
            <button aria-label="Refresh dashboard" className="grid size-11 place-items-center rounded-xl border border-border-soft bg-bg/55 text-text-muted backdrop-blur transition hover:border-brand-blue/45 hover:bg-brand-blue/10 hover:text-text-main focus-visible:outline-2 focus-visible:outline-brand-cyan" disabled={dashboard.isFetching} onClick={() => dashboard.refetch()} type="button"><RefreshCw aria-hidden="true" className={`size-4 ${dashboard.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} /></button>
            <a className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-blue/45 bg-gradient-to-r from-brand-blue to-[#1769d4] px-4 text-sm font-semibold text-white shadow-glow-blue transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan motion-reduce:transition-none" href="/studio/?view=posts"><FilePlus2 aria-hidden="true" className="size-4" /> Create post</a>
          </div>
        </div>
      </header>

      <section aria-label="Publishing overview" className="mt-4 flex gap-3.5 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-3 xl:grid-cols-5">
        {data.stats.map((stat, index) => <StatCard data={stat} icon={statIcons[index]} key={stat.label} />)}
      </section>

      <div className="mt-4"><WorkflowStepper summary={data.overview.summary} /></div>

      <div className="mt-4 grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_430px]">
        <PublishingQueueTable jobs={data.queue} />
        <aside aria-label="Dashboard details" className="dashboard-details grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
          <UpcomingScheduleCard jobs={data.upcoming} />
          <ConnectedPagesCard pages={data.overview.pages} />
          <UploadProgressCard job={data.activeTransfer} />
          <QuickActionsCard />
        </aside>
      </div>
    </div>
  )
}
