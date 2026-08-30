import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, CalendarDays, CalendarRange, CheckCircle2, FileText, RefreshCw } from 'lucide-react'
import { ApiError } from '../../lib/api-client'
import { buildActivitySeries, fetchDashboardView } from '../../lib/dashboard-api'
import { DashboardAccountSelector } from './DashboardAccountSelector'
import { EngagementOverviewCard } from './EngagementOverviewCard'
import { PlatformDonutChart } from './PlatformDonutChart'
import { PublishingActivityChart } from './PublishingActivityChart'
import { RecentPostsCard } from './RecentPostsCard'
import { StatCard } from './StatCard'
import { TopPerformingContentCard } from './TopPerformingContentCard'
import { UpcomingScheduleCard } from './UpcomingScheduleCard'

const statIcons = [FileText, CheckCircle2, CalendarDays, AlertTriangle, Activity]
const analyticsAccountStorageKey = 'inx-dashboard-analytics-account'

function savedAnalyticsAccount() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(analyticsAccountStorageKey) || ''
}

function DashboardSkeleton() {
  return (
    <div aria-label="Loading dashboard" className="space-y-4" role="status">
      <div className="flex gap-3 overflow-hidden md:grid md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div className="h-28 min-w-52 animate-pulse rounded-card bg-panel motion-reduce:animate-none" key={index} />)}</div>
      <div className="grid gap-4 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div className="h-[350px] animate-pulse rounded-card bg-panel motion-reduce:animate-none" key={index} />)}</div>
      <div className="grid gap-4 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div className="h-[290px] animate-pulse rounded-card bg-panel motion-reduce:animate-none" key={index} />)}</div>
    </div>
  )
}

export function DashboardPage() {
  const [rangeDays, setRangeDays] = useState(7)
  const [analyticsAccountId, setAnalyticsAccountId] = useState(savedAnalyticsAccount)
  const dashboard = useQuery({
    queryKey: ['dashboard-view', rangeDays, analyticsAccountId],
    queryFn: () => fetchDashboardView(rangeDays, analyticsAccountId || null),
    placeholderData: (previousData) => previousData,
    refetchInterval: 60_000,
  })

  useEffect(() => {
    const pages = dashboard.data?.overview.pages.filter((page) => page.status !== 'REVOKED') || []
    if (!pages.length || pages.some((page) => page.id === analyticsAccountId)) return
    const fallbackId = pages[0].id
    setAnalyticsAccountId(fallbackId)
    window.localStorage.setItem(analyticsAccountStorageKey, fallbackId)
  }, [analyticsAccountId, dashboard.data?.overview.pages])

  function selectAnalyticsAccount(pageId: string) {
    setAnalyticsAccountId(pageId)
    window.localStorage.setItem(analyticsAccountStorageKey, pageId)
  }

  const activity = useMemo(() => buildActivitySeries(dashboard.data?.jobs || [], rangeDays), [dashboard.data?.jobs, rangeDays])

  if (dashboard.isPending) return <DashboardSkeleton />
  if (dashboard.isError) {
    const sessionRequired = dashboard.error instanceof ApiError && dashboard.error.status === 401
    return (
      <section className="mx-auto grid min-h-[60vh] max-w-2xl place-items-center text-center">
        <div className="rounded-panel border border-brand-red/25 bg-panel p-7 shadow-panel">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-red/10 text-brand-red"><AlertTriangle aria-hidden="true" className="size-6" /></span>
          <h1 className="mt-5 text-xl font-semibold">{sessionRequired ? 'Sign in to open your dashboard' : 'Dashboard data is unavailable'}</h1>
          <p className="mt-2 text-sm leading-6 text-text-muted">{sessionRequired ? 'Your existing INX Social session is required to load private publishing data.' : dashboard.error.message}</p>
          {sessionRequired ? <a className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/studio/">Open sign in</a> : <button className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={() => dashboard.refetch()} type="button"><RefreshCw aria-hidden="true" className="size-4" /> Retry</button>}
        </div>
      </section>
    )
  }

  const data = dashboard.data
  return (
    <div className="dashboard-canvas space-y-4">
      <DashboardAccountSelector
        isRefreshing={dashboard.isFetching}
        onChange={selectAnalyticsAccount}
        onRefresh={() => dashboard.refetch()}
        pages={data.overview.pages}
        value={analyticsAccountId}
      />

      <section aria-label="Publishing overview" className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-3 xl:grid-cols-6">
        {data.stats.map((stat, index) => <StatCard data={stat} icon={statIcons[index]} key={stat.label} />)}
        <label className="interactive-surface flex min-h-[112px] min-w-[205px] flex-col justify-between rounded-card border p-4 md:min-w-0"><span className="text-xs font-medium text-text-muted">Dashboard period</span><span className="relative"><CalendarRange aria-hidden="true" className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-brand-cyan" /><select className="min-h-10 w-full appearance-none border-0 bg-transparent pl-6 pr-2 text-sm font-semibold text-text-main focus:outline-none" onChange={(event) => setRangeDays(Number(event.target.value))} value={rangeDays}><option value={7}>Last 7 Days</option><option value={30}>Last 30 Days</option><option value={90}>Last 90 Days</option></select></span></label>
      </section>

      <section aria-label="Publishing analytics" className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,.95fr)_minmax(340px,1.2fr)]">
        <PublishingActivityChart onRangeChange={setRangeDays} points={activity} rangeDays={rangeDays} />
        <PlatformDonutChart metrics={data.platformMetrics} />
        <RecentPostsCard posts={data.recentPosts} />
      </section>

      <section aria-label="Content performance and schedule" className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,.95fr)_minmax(0,1fr)_minmax(340px,1.15fr)]">
        <EngagementOverviewCard metrics={data.platformMetrics} />
        <TopPerformingContentCard items={data.topContent} />
        <UpcomingScheduleCard jobs={data.upcoming} />
      </section>
    </div>
  )
}
