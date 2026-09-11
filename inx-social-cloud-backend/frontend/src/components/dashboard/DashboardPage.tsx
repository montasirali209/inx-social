import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, CalendarClock, Files, RefreshCw, Send, UsersRound } from 'lucide-react'
import { ApiError } from '../../lib/api-client'
import { fetchAnalyticsForSource, fetchAnalyticsSources } from '../../lib/analytics-api'
import { buildActivitySeries, buildDashboardView, fetchDashboardJobs } from '../../lib/dashboard-api'
import type { DashboardAnalyticsEntry } from '../../types/dashboard'
import { AIStudioPromoCard } from './AIStudioPromoCard'
import { PlatformDonutChart } from './PlatformDonutChart'
import { PublishingActivityCard } from './PublishingActivityCard'
import { QuickActionsCard } from './QuickActionsCard'
import { RecentPostsCard } from './RecentPostsCard'
import { StatCard } from './StatCard'
import { TopPerformingContentCard } from './TopPerformingContentCard'
import { UpcomingScheduleCard } from './UpcomingScheduleCard'

const statIcons = [Send, CalendarClock, Files, AlertTriangle, Activity, UsersRound]
const dashboardAnalyticsDays = 30

type DashboardAnalyticsResult = {
  entries: DashboardAnalyticsEntry[]
  failures: Array<{ platform: string; sourceName: string; message: string }>
}

function DashboardSkeleton() {
  return (
    <div aria-label="Loading dashboard workspace" className="space-y-3" role="status">
      <div className="flex gap-3 overflow-hidden md:grid md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => <div className="h-24 min-w-48 animate-pulse rounded-card bg-panel motion-reduce:animate-none" key={index} />)}
      </div>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.9fr)_minmax(300px,.85fr)]">
        <div className="h-64 animate-pulse rounded-card bg-panel motion-reduce:animate-none" />
        <div className="h-64 animate-pulse rounded-card bg-panel motion-reduce:animate-none" />
      </div>
      <div className="h-56 animate-pulse rounded-card bg-panel motion-reduce:animate-none" />
    </div>
  )
}

export function DashboardPage() {
  const [activityRangeDays, setActivityRangeDays] = useState(14)
  const sources = useQuery({
    queryKey: ['dashboard-all-account-sources'],
    queryFn: fetchAnalyticsSources,
    refetchInterval: 60_000,
  })
  const jobs = useQuery({
    queryKey: ['dashboard-jobs'],
    queryFn: fetchDashboardJobs,
    refetchInterval: 60_000,
  })

  const accounts = sources.data?.accounts || []
  const accountKey = accounts.map((account) => account.analyticsKey).sort().join('|')
  const analytics = useQuery<DashboardAnalyticsResult>({
    queryKey: ['dashboard-all-account-analytics', dashboardAnalyticsDays, accountKey],
    enabled: accounts.length > 0,
    refetchInterval: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const results = await Promise.all(accounts.map(async (account) => {
        try {
          const platformAnalytics = await fetchAnalyticsForSource(account, dashboardAnalyticsDays)
          return {
            ok: true as const,
            entry: {
              accountId: account.id,
              platform: account.platform,
              sourceName: account.displayName,
              analytics: platformAnalytics,
            } satisfies DashboardAnalyticsEntry,
          }
        } catch (error) {
          return {
            ok: false as const,
            failure: {
              platform: account.platform,
              sourceName: account.displayName,
              message: error instanceof Error ? error.message : 'Live data is temporarily unavailable.',
            },
          }
        }
      }))
      return {
        entries: results.flatMap((result) => result.ok ? [result.entry] : []),
        failures: results.flatMap((result) => result.ok ? [] : [result.failure]),
      }
    },
  })

  const analyticsEntries = analytics.data?.entries || []
  const data = useMemo(() => (
    sources.data && jobs.data
      ? buildDashboardView(sources.data.overview, jobs.data, new Date(), analyticsEntries, accounts.length)
      : null
  ), [accounts.length, analyticsEntries, jobs.data, sources.data])
  const activity = useMemo(
    () => buildActivitySeries(jobs.data || [], activityRangeDays, new Date(), analyticsEntries),
    [activityRangeDays, analyticsEntries, jobs.data],
  )

  function refreshDashboard() {
    void Promise.all([sources.refetch(), jobs.refetch(), analytics.refetch()])
  }

  if ((sources.isPending || jobs.isPending) && !data) return <DashboardSkeleton />
  const coreError = sources.error || jobs.error
  if (coreError || !data) {
    const sessionRequired = coreError instanceof ApiError && coreError.status === 401
    return (
      <section className="mx-auto grid min-h-[60vh] max-w-2xl place-items-center text-center">
        <div className="rounded-panel border border-brand-red/25 bg-panel p-7 shadow-panel">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-red/10 text-brand-red"><AlertTriangle aria-hidden="true" className="size-6" /></span>
          <h1 className="mt-5 text-xl font-semibold">{sessionRequired ? 'Sign in to open your dashboard' : 'Dashboard data is unavailable'}</h1>
          <p className="mt-2 text-sm leading-6 text-text-muted">{sessionRequired ? 'Your existing INX Social session is required to load private publishing data.' : coreError?.message}</p>
          {sessionRequired
            ? <a className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/portal/login.html?return=/app/">Open sign in</a>
            : <button className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={refreshDashboard} type="button"><RefreshCw aria-hidden="true" className="size-4" /> Retry</button>}
        </div>
      </section>
    )
  }

  const failures = analytics.data?.failures || []
  const analyticsLoading = accounts.length > 0 && analytics.isPending

  return (
    <div className="dashboard-canvas grid gap-3 2xl:min-h-0 2xl:grid-rows-[auto_minmax(250px,1.12fr)_minmax(215px,.96fr)_auto]">
      {failures.length ? (
        <div className="flex min-h-9 items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-400/[.06] px-3 text-[11px] text-amber-100" role="status">
          <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">Live insights unavailable for {failures.map((failure) => failure.sourceName).join(', ')}. Data from the other connected accounts is still live.</span>
        </div>
      ) : null}

      <section aria-label="All-account publishing overview" className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible xl:grid-cols-6">
        {data.stats.map((stat, index) => <StatCard data={stat} icon={statIcons[index]} key={stat.label} />)}
      </section>

      <section aria-label="Workspace publishing activity" className="grid min-h-0 items-stretch gap-3 xl:grid-cols-[minmax(0,1.9fr)_minmax(300px,.85fr)]">
        <PublishingActivityCard
          loading={analyticsLoading || (jobs.isFetching && !jobs.data)}
          onRangeChange={setActivityRangeDays}
          points={activity}
          rangeDays={activityRangeDays}
        />
        <PlatformDonutChart metrics={data.platformMetrics} />
      </section>

      <section aria-label="Recent workspace activity" className="grid min-h-0 items-stretch gap-3 xl:grid-cols-3">
        <RecentPostsCard posts={data.recentPosts} />
        <UpcomingScheduleCard jobs={data.upcoming} />
        <TopPerformingContentCard items={data.topContent} />
      </section>

      <section aria-label="Dashboard shortcuts" className="grid gap-3 xl:grid-cols-[minmax(0,.95fr)_minmax(0,1.35fr)]">
        <QuickActionsCard />
        <AIStudioPromoCard overview={data.overview} />
      </section>
    </div>
  )
}
