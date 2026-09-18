import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, CalendarClock, Files, RefreshCw, Send, UsersRound } from 'lucide-react'
import { ApiError } from '../../lib/api-client'
import { fetchAnalyticsForSource, fetchAnalyticsSources } from '../../lib/analytics-api'
import { buildActivitySeries, buildDashboardView, fetchDashboardJobs } from '../../lib/dashboard-api'
import { fetchUniversalPublishingKpis, universalPublishingKpiQueryKey } from '../../lib/universal-publishing-kpis'
import { readSessionCache, writeSessionCache } from '../../lib/session-cache'
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
const dashboardSourcesCacheKey = 'inx-social-cache:dashboard-sources-v1'
const dashboardJobsCacheKey = 'inx-social-cache:dashboard-jobs-v1'
const dashboardKpisCacheKey = 'inx-social-cache:dashboard-kpis-v1'

function dashboardAnalyticsCacheKey(accountKey: string) {
  return `inx-social-cache:dashboard-analytics:${encodeURIComponent(accountKey)}:${dashboardAnalyticsDays}`
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  if (!items.length) return []
  const results = new Array<R>(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index]!)
    }
  })
  await Promise.all(runners)
  return results
}

type DashboardAnalyticsResult = {
  entries: DashboardAnalyticsEntry[]
  failures: Array<{ platform: string; sourceName: string; message: string }>
}

function DashboardSkeleton() {
  const stats = [
    ['🚀', 'Published'],
    ['🗓️', 'Scheduled'],
    ['📝', 'Drafts'],
    ['⚠️', 'Needs Review'],
    ['💬', 'Engagement'],
    ['🔗', 'Connected Accounts'],
  ] as const
  return (
    <div aria-label="Loading dashboard workspace" className="dashboard-canvas grid content-start gap-3" role="status">
      <section className="flex items-start gap-3 overflow-hidden md:grid md:grid-cols-3 xl:grid-cols-6">
        {stats.map(([emoji, label], index) => <div className="relative min-h-[92px] min-w-48 overflow-hidden rounded-card border border-border-soft bg-panel/70 p-3 md:min-w-0" key={label}>
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl border border-white/[.07] bg-white/[.025] text-lg motion-safe:animate-bounce" style={{ animationDelay: `${index * 80}ms` }}>{emoji}</span><span><small className="block text-[10px] font-semibold text-text-muted">{label}</small><strong className="mt-1 block text-sm">Updating…</strong></span></div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border-soft"><span className="block h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-brand-teal/60 to-brand-cyan motion-reduce:animate-none" /></div>
        </div>)}
      </section>
      <section className="grid min-h-[250px] gap-3 xl:grid-cols-[minmax(0,1.9fr)_minmax(300px,.85fr)]">
        <div className="rounded-card border border-border-soft bg-panel/70 p-5"><div className="flex justify-between"><span><strong className="block text-sm">Publishing Activity</strong><small className="mt-1 block text-[10px] text-text-muted">Loading your latest workspace activity</small></span><span className="text-2xl motion-safe:animate-pulse">📊</span></div><div className="mt-8 grid h-36 place-items-center rounded-xl border border-dashed border-border-soft bg-bg/20"><span className="text-center"><span className="block text-3xl motion-safe:animate-bounce">⏳</span><small className="mt-2 block text-[10px] text-text-soft">Syncing posts and insights</small></span></div></div>
        <div className="rounded-card border border-border-soft bg-panel/70 p-5"><strong className="text-sm">Posts by Platform</strong><div className="mt-8 grid place-items-center"><div className="grid size-32 place-items-center rounded-full border-[13px] border-brand-teal/10"><span className="text-2xl motion-safe:animate-spin">✨</span></div></div></div>
      </section>
      <section className="grid min-h-[190px] gap-3 xl:grid-cols-3">{['Recent Posts', 'Upcoming Schedule', 'Top Performing Content'].map(label => <div className="rounded-card border border-border-soft bg-panel/70 p-4" key={label}><strong className="text-sm">{label}</strong><div className="mt-4 space-y-2">{Array.from({ length: 3 }, (_, i) => <div className="h-10 animate-pulse rounded-lg bg-white/[.025] motion-reduce:animate-none" key={i} />)}</div></div>)}</section>
    </div>
  )
}

export function DashboardPage() {
  const [activityRangeDays, setActivityRangeDays] = useState(14)
  const sources = useQuery({
    queryKey: ['dashboard-all-account-sources'],
    queryFn: async () => {
      const result = await fetchAnalyticsSources()
      writeSessionCache(dashboardSourcesCacheKey, result)
      return result
    },
    initialData: () => readSessionCache<Awaited<ReturnType<typeof fetchAnalyticsSources>>>(dashboardSourcesCacheKey),
    initialDataUpdatedAt: 0,
    placeholderData: previous => previous,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
  const jobs = useQuery({
    queryKey: ['dashboard-jobs', 'post-for-me'],
    queryFn: async () => {
      const result = await fetchDashboardJobs()
      writeSessionCache(dashboardJobsCacheKey, result)
      return result
    },
    initialData: () => readSessionCache<Awaited<ReturnType<typeof fetchDashboardJobs>>>(dashboardJobsCacheKey),
    initialDataUpdatedAt: 0,
    placeholderData: previous => previous,
    staleTime: 20_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
  const universalKpis = useQuery({
    queryKey: universalPublishingKpiQueryKey,
    queryFn: async () => {
      const result = await fetchUniversalPublishingKpis()
      writeSessionCache(dashboardKpisCacheKey, result)
      return result
    },
    initialData: () => readSessionCache<Awaited<ReturnType<typeof fetchUniversalPublishingKpis>>>(dashboardKpisCacheKey),
    initialDataUpdatedAt: 0,
    placeholderData: previous => previous,
    staleTime: 20_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })

  const accounts = sources.data?.accounts || []
  const accountKey = accounts.map((account) => account.analyticsKey).sort().join('|')
  const analytics = useQuery<DashboardAnalyticsResult>({
    queryKey: ['dashboard-all-account-analytics', 'post-for-me', dashboardAnalyticsDays, accountKey],
    enabled: accounts.length > 0,
    initialData: () => accountKey ? readSessionCache<DashboardAnalyticsResult>(dashboardAnalyticsCacheKey(accountKey)) : undefined,
    initialDataUpdatedAt: 0,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60_000,
    retry: false,
    queryFn: async () => {
      const results = await mapWithConcurrency(accounts, 3, async (account) => {
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
      })
      const result = {
        entries: results.flatMap((item) => item.ok ? [item.entry] : []),
        failures: results.flatMap((item) => item.ok ? [] : [item.failure]),
      }
      writeSessionCache(dashboardAnalyticsCacheKey(accountKey), result)
      return result
    },
  })

  const analyticsEntries = useMemo(() => analytics.data?.entries || [], [analytics.data?.entries])
  const data = useMemo(() => (
    sources.data && jobs.data
      ? buildDashboardView(sources.data.overview, jobs.data, new Date(), analyticsEntries, accounts.length)
      : null
  ), [accounts.length, analyticsEntries, jobs.data, sources.data])
  const activity = useMemo(
    () => buildActivitySeries(jobs.data || [], activityRangeDays, new Date(), analyticsEntries),
    [activityRangeDays, analyticsEntries, jobs.data],
  )
  const dashboardStats = useMemo(() => {
    if (!data) return []
    const universal = universalKpis.data
    return [
      { ...data.stats[0], label: 'Published', value: universal?.published ?? data.stats[0].value, detail: 'Published via INXSocial' },
      { ...data.stats[1], label: 'Scheduled', value: universal?.scheduled ?? data.stats[1].value, detail: 'Future publishing slots' },
      { ...data.stats[2], label: 'Drafts', value: universal?.drafts ?? data.stats[2].value, detail: 'Saved unfinished posts' },
      { ...data.stats[3], label: 'Needs Review', value: universal?.needsReview ?? data.stats[3].value, detail: 'Action required' },
      data.stats[4],
      { ...data.stats[5], label: 'Connected Accounts', value: universal?.connectedAccounts ?? accounts.length, detail: 'Across all active platforms' },
    ]
  }, [accounts.length, data, universalKpis.data])

  function refreshDashboard() {
    void Promise.all([sources.refetch(), jobs.refetch(), analytics.refetch(), universalKpis.refetch()])
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
    <div className="dashboard-canvas grid content-start gap-3">
      {failures.length ? (
        <div className="flex min-h-9 items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-400/[.06] px-3 text-[11px] text-amber-100" role="status">
          <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">Live insights unavailable for {failures.map((failure) => failure.sourceName).join(', ')}. Data from the other connected accounts is still live.</span>
        </div>
      ) : null}

      <section aria-label="Universal publishing overview" className="flex items-start gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible xl:grid-cols-6">
        {dashboardStats.map((stat, index) => <StatCard data={stat} icon={statIcons[index]} key={stat.label} />)}
      </section>

      <section aria-label="Workspace publishing activity" className="grid min-h-[250px] items-stretch gap-3 xl:grid-cols-[minmax(0,1.9fr)_minmax(300px,.85fr)]">
        <PublishingActivityCard
          loading={analyticsLoading || (jobs.isFetching && !jobs.data)}
          onRangeChange={setActivityRangeDays}
          points={activity}
          rangeDays={activityRangeDays}
        />
        <PlatformDonutChart metrics={data.platformMetrics} />
      </section>

      <section aria-label="Recent workspace activity" className="grid min-h-[215px] items-stretch gap-3 xl:grid-cols-3">
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
