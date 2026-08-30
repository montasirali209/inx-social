import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, CalendarDays, CalendarRange, CheckCircle2, FileText, RefreshCw } from 'lucide-react'
import { ApiError } from '../../lib/api-client'
import {
  buildActivitySeries,
  buildDashboardView,
  fetchDashboardJobs,
  fetchFacebookDashboardAnalytics,
  fetchStudioOverview,
} from '../../lib/dashboard-api'
import { DashboardAccountSelector } from './DashboardAccountSelector'
import { EngagementOverviewCard } from './EngagementOverviewCard'
import { PlatformDonutChart } from './PlatformDonutChart'
import { PublishingActivityCard } from './PublishingActivityCard'
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
    <div aria-label="Loading dashboard workspace" className="space-y-4" role="status">
      <div className="h-20 animate-pulse rounded-card bg-panel motion-reduce:animate-none" />
      <div className="flex gap-3 overflow-hidden md:grid md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div className="h-28 min-w-52 animate-pulse rounded-card bg-panel motion-reduce:animate-none" key={index} />)}</div>
      <div className="h-[420px] animate-pulse rounded-card bg-panel motion-reduce:animate-none" />
    </div>
  )
}

export function DashboardPage() {
  const [rangeDays, setRangeDays] = useState(30)
  const [analyticsAccountId, setAnalyticsAccountId] = useState(savedAnalyticsAccount)
  const overview = useQuery({
    queryKey: ['studio-overview'],
    queryFn: fetchStudioOverview,
    refetchInterval: 60_000,
  })
  const jobs = useQuery({
    queryKey: ['dashboard-jobs'],
    queryFn: fetchDashboardJobs,
    refetchInterval: 60_000,
  })

  const availablePages = overview.data?.pages.filter((page) => page.status !== 'REVOKED') || []
  const resolvedAnalyticsAccountId = availablePages.some((page) => page.id === analyticsAccountId)
    ? analyticsAccountId
    : (availablePages[0]?.id || '')

  const analytics = useQuery({
    queryKey: ['facebook-dashboard-analytics', resolvedAnalyticsAccountId, rangeDays],
    queryFn: () => fetchFacebookDashboardAnalytics(resolvedAnalyticsAccountId, rangeDays),
    enabled: Boolean(resolvedAnalyticsAccountId),
    refetchInterval: 15 * 60_000,
    retry: 1,
  })

  const scopedJobs = useMemo(
    () => (jobs.data || []).filter((job) => job.page?.id === resolvedAnalyticsAccountId),
    [jobs.data, resolvedAnalyticsAccountId],
  )
  const liveActivityByDate = useMemo(() => {
    const posts: Record<string, number> = {}
    const engagement: Record<string, number> = {}
    for (const post of analytics.data?.content || []) {
      if (!post.createdTime) continue
      const timestamp = new Date(post.createdTime)
      if (Number.isNaN(timestamp.getTime())) continue
      const key = timestamp.toISOString().slice(0, 10)
      posts[key] = (posts[key] || 0) + 1
      engagement[key] = (engagement[key] || 0) + (
        post.insights?.totalInteractions
        ?? post.reactions + post.comments + post.shares
      )
    }
    return { posts, engagement }
  }, [analytics.data])
  const engagementByDate = liveActivityByDate.engagement
  const activity = useMemo(
    () => buildActivitySeries(scopedJobs, rangeDays).map((point) => {
      const key = new Date(point.date).toISOString().slice(0, 10)
      return { ...point, published: Math.max(point.published, liveActivityByDate.posts[key] || 0) }
    }),
    [liveActivityByDate.posts, rangeDays, scopedJobs],
  )
  const previousActivity = useMemo(() => {
    const previousEnd = new Date()
    previousEnd.setDate(previousEnd.getDate() - rangeDays)
    return buildActivitySeries(scopedJobs, rangeDays, previousEnd)
  }, [rangeDays, scopedJobs])
  const data = useMemo(() => (
    overview.data && jobs.data
      ? buildDashboardView(overview.data, scopedJobs, new Date(), analytics.data || null)
      : null
  ), [analytics.data, jobs.data, overview.data, scopedJobs])

  function selectAnalyticsAccount(pageId: string) {
    setAnalyticsAccountId(pageId)
    window.localStorage.setItem(analyticsAccountStorageKey, pageId)
  }

  function refreshDashboard() {
    void Promise.all([overview.refetch(), jobs.refetch(), analytics.refetch()])
  }

  if ((overview.isPending || jobs.isPending) && !data) return <DashboardSkeleton />
  const coreError = overview.error || jobs.error
  if (coreError || !data) {
    const sessionRequired = coreError instanceof ApiError && coreError.status === 401
    return (
      <section className="mx-auto grid min-h-[60vh] max-w-2xl place-items-center text-center">
        <div className="rounded-panel border border-brand-red/25 bg-panel p-7 shadow-panel">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-red/10 text-brand-red"><AlertTriangle aria-hidden="true" className="size-6" /></span>
          <h1 className="mt-5 text-xl font-semibold">{sessionRequired ? 'Sign in to open your dashboard' : 'Dashboard data is unavailable'}</h1>
          <p className="mt-2 text-sm leading-6 text-text-muted">{sessionRequired ? 'Your existing INX Social session is required to load private publishing data.' : coreError?.message}</p>
          {sessionRequired
            ? <a className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/studio/">Open sign in</a>
            : <button className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={refreshDashboard} type="button"><RefreshCw aria-hidden="true" className="size-4" /> Retry</button>}
        </div>
      </section>
    )
  }

  return (
    <div className="dashboard-canvas space-y-4">
      <DashboardAccountSelector
        isRefreshing={overview.isFetching || jobs.isFetching || analytics.isFetching}
        onChange={selectAnalyticsAccount}
        onRefresh={refreshDashboard}
        pages={data.overview.pages}
        value={resolvedAnalyticsAccountId}
      />

      <section aria-label="Publishing overview" className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-3 xl:grid-cols-6">
        {data.stats.map((stat, index) => <StatCard data={stat} icon={statIcons[index]} key={stat.label} />)}
        <label className="interactive-surface flex min-h-[112px] min-w-[205px] flex-col justify-between rounded-card border p-4 md:min-w-0"><span className="text-xs font-medium text-text-muted">Dashboard period</span><span className="relative"><CalendarRange aria-hidden="true" className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-brand-cyan" /><select className="min-h-10 w-full appearance-none border-0 bg-transparent pl-6 pr-2 text-sm font-semibold text-text-main focus:outline-none" onChange={(event) => setRangeDays(Number(event.target.value))} value={rangeDays}><option value={7}>Last 7 Days</option><option value={30}>Last 30 Days</option><option value={90}>Last 90 Days</option></select></span></label>
      </section>

      <PublishingActivityCard
        engagementByDate={engagementByDate}
        loading={jobs.isFetching && !jobs.data}
        onRangeChange={setRangeDays}
        points={activity}
        previousPoints={previousActivity}
        rangeDays={rangeDays}
      />

      <section aria-label="Platform and recent publishing analytics" className="grid items-stretch gap-4 xl:grid-cols-[minmax(320px,.8fr)_minmax(0,1.6fr)]">
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
