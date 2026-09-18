import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarDays, Radio } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buildAnalyticsView } from '../../data/analyticsData'
import { aggregatePerformance } from '../../data/analyticsAggregation'
import { fetchAnalyticsForSource, fetchAnalyticsSources, mergeAnalyticsResults, type AnalyticsSourceAccount } from '../../lib/analytics-api'
import { readSessionCache, writeSessionCache } from '../../lib/session-cache'
import type { AnalyticsTab } from '../../types/analytics'
import type { Platform, PlatformAnalytics } from '../../types/dashboard'
import { AnalyticsAccountSelector, type AnalyticsAccount } from './AnalyticsAccountSelector'
import { AnalyticsSkeleton, AnalyticsCard, AnalyticsCardHeader, UnavailableState } from './AnalyticsPrimitives'
import { AnalyticsStatCard } from './AnalyticsStatCard'
import { AnalyticsScopeNotice } from './AnalyticsScopeNotice'
import { AnalyticsTabs } from './AnalyticsTabs'
import { ContentEfficiencyCard, PublishingRhythmCard } from './ContentInsightsCards'
import { BestTimeToPostCard } from './BestTimeToPostCard'
import { EngagementByPlatformCard, type EngagementPlatformRow } from './EngagementByPlatformCard'
import { ExportReportButton } from './ExportReportButton'
import { PerformanceOverTimeCard } from './PerformanceOverTimeCard'
import { ProviderMetricsCard } from './ProviderMetricsCard'
import { TopPerformingPostsCard } from './TopPerformingPostsCard'
import './analytics-motion.css'

const selectionKey = 'inx-social-analytics-sources-v4'
const analyticsSourcesCacheKey = 'inx-social-cache:analytics-sources-v1'
const MAX_ANALYTICS_SOURCES = 3

function analyticsWorkspaceCacheKey(scope: string, days: number) {
  return `inx-social-cache:analytics:${encodeURIComponent(scope)}:${days}`
}

function savedSelection() {
  try {
    const value = JSON.parse(window.localStorage.getItem(selectionKey) || '[]')
    return Array.isArray(value) ? value.map(String).slice(0, MAX_ANALYTICS_SOURCES) : []
  } catch {
    return []
  }
}

const platformNames: Record<Platform, string> = {
  facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', tiktok: 'TikTok', youtube: 'YouTube', pinterest: 'Pinterest', threads: 'Threads', bluesky: 'Bluesky', x: 'X',
}

type LiveAnalyticsData = {
  analytics: PlatformAnalytics
  results: Array<{ account: AnalyticsSourceAccount; analytics: PlatformAnalytics }>
  failures: Array<{ account: AnalyticsSourceAccount; message: string }>
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

export function AnalyticsPage() {
  const [selectedKeys, setSelectedKeys] = useState<string[]>(savedSelection)
  const [days, setDays] = useState(30)
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview')
  const [interval, setInterval] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [chartMode, setChartMode] = useState<'content' | 'trend'>('content')
  const sources = useQuery({
    queryKey: ['analytics-sources', 'post-for-me'],
    queryFn: async () => {
      const result = await fetchAnalyticsSources()
      writeSessionCache(analyticsSourcesCacheKey, result)
      return result
    },
    initialData: () => readSessionCache<Awaited<ReturnType<typeof fetchAnalyticsSources>>>(analyticsSourcesCacheKey),
    initialDataUpdatedAt: 0,
    staleTime: 20_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  })
  const accounts = useMemo(() => sources.data?.accounts || [], [sources.data?.accounts])
  const effectiveSelectedKeys = useMemo(() => {
    if (!accounts.length) return []
    const validKeys = new Set(accounts.map(account => account.analyticsKey))
    const validSelected = selectedKeys.filter(key => validKeys.has(key))
    return validSelected.length ? validSelected.slice(0, MAX_ANALYTICS_SOURCES) : accounts.slice(0, 1).map(account => account.analyticsKey)
  }, [accounts, selectedKeys])
  const selectedAccounts = useMemo(() => {
    const values = new Set(effectiveSelectedKeys)
    return accounts.filter(account => values.has(account.analyticsKey))
  }, [accounts, effectiveSelectedKeys])
  const selectedScopeKey = selectedAccounts.map(account => account.analyticsKey).sort().join('|')

  const analytics = useQuery<LiveAnalyticsData>({
    queryKey: ['analytics-workspace', 'post-for-me', selectedScopeKey, days],
    enabled: selectedAccounts.length > 0,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 0,
    staleTime: 2 * 60_000,
    initialData: () => selectedScopeKey ? readSessionCache<LiveAnalyticsData>(analyticsWorkspaceCacheKey(selectedScopeKey, days)) : undefined,
    initialDataUpdatedAt: 0,
    queryFn: async () => {
      const settled = await mapWithConcurrency(selectedAccounts, 2, async account => {
        try {
          return { ok: true as const, account, analytics: await fetchAnalyticsForSource(account, days) }
        } catch (error) {
          return { ok: false as const, account, message: error instanceof Error ? error.message : 'Live analytics could not be loaded.' }
        }
      })
      const successes = settled.flatMap(result => result.ok ? [{ account: result.account, analytics: result.analytics }] : [])
      const failures = settled.flatMap(result => result.ok ? [] : [{ account: result.account, message: result.message }])
      if (!successes.length) throw new Error(failures[0]?.message || 'Live analytics could not be loaded for the selected sources.')
      const merged = mergeAnalyticsResults(successes.map(result => result.analytics), successes.map(result => result.account), days)
      if (!merged) throw new Error('No analytics data was returned for the selected sources.')
      const result = { analytics: merged, results: successes, failures }
      writeSessionCache(analyticsWorkspaceCacheKey(selectedScopeKey, days), result)
      return result
    },
  })

  const view = useMemo(() => analytics.data ? buildAnalyticsView(analytics.data.analytics, days) : null, [analytics.data, days])
  const trackedPerformance = useMemo(() => {
    if (!view) return []
    const startedAt = view.source.tracking?.startedAt?.slice(0, 10)
    return startedAt ? view.performance.filter(point => point.date >= startedAt) : view.performance
  }, [view])
  const chartBase = useMemo(() => {
    if (!view) return []
    return chartMode === 'content' ? view.publishedPerformance : trackedPerformance
  }, [chartMode, trackedPerformance, view])
  const chartPoints = useMemo(() => interval === 'monthly' ? chartBase : aggregatePerformance(chartBase, interval), [chartBase, interval])
  const breakdown = useMemo<EngagementPlatformRow[]>(() => {
    const values = new Map<Platform, EngagementPlatformRow>()
    analytics.data?.results.forEach(({ account, analytics: result }) => {
      const existing = values.get(account.platform) || { platform: account.platform as Platform, total: 0, accounts: 0 }
      existing.total += Number(result.summary.totalInteractions || 0)
      existing.accounts += 1
      values.set(account.platform as Platform, existing)
    })
    return [...values.values()]
  }, [analytics.data?.results])

  function changeSelection(keys: string[]) {
    const next = [...new Set(keys)].slice(0, MAX_ANALYTICS_SOURCES)
    setSelectedKeys(next)
    window.localStorage.setItem(selectionKey, JSON.stringify(next))
  }

  if (sources.isLoading) return <AnalyticsSkeleton />
  if (!accounts.length) return <div className="grid min-h-[55vh] place-items-center rounded-panel border border-border-soft bg-panel/70 p-8 text-center"><span><AlertTriangle className="mx-auto size-9 text-brand-amber" /><h2 className="mt-4 text-lg font-semibold">Connect an account to unlock Analytics</h2><p className="mx-auto mt-2 max-w-md text-sm text-text-muted">Connect any supported social network to view live content performance and engagement metrics.</p><a className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-brand-teal px-4 text-sm font-semibold text-white" href="/app/connected-accounts">Manage connected accounts</a></span></div>

  const selectorAccounts = accounts as unknown as AnalyticsAccount[]
  const singleSource = selectedAccounts.length === 1 ? selectedAccounts[0] : null
  const sourceName = singleSource ? platformNames[singleSource.platform as Platform] : `${selectedAccounts.length} selected accounts`
  const noVerifiedMetrics = Boolean(view && !view.source.capabilities?.pageInsights.available)
  const lastUpdated = view ? new Intl.DateTimeFormat('en-GB', { timeStyle: 'medium' }).format(new Date(view.source.fetchedAt)) : ''
  const providerMetricSources = analytics.data?.results || []

  return <div className="analytics-fluid-canvas dashboard-canvas space-y-4 pb-8">
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
      <AnalyticsAccountSelector accounts={selectorAccounts} isLive={!analytics.isError} onChange={changeSelection} values={effectiveSelectedKeys} />
      <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
        <label className="rounded-xl border border-border-soft bg-panel/70 px-3 py-2"><span className="block text-[9px] uppercase tracking-wider text-text-soft">Analytics period</span><select className="mt-1 min-h-7 min-w-40 bg-transparent text-xs font-semibold outline-none" onChange={(event) => setDays(Number(event.target.value))} value={days}><option value={7}>Last 7 Days</option><option value={30}>Last 30 Days</option><option value={90}>Last 90 Days</option></select></label>
        {view && <ExportReportButton view={view} />}
        <div className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-green/15 bg-brand-green/[.055] px-3 text-[10px] text-brand-green"><Radio className={`size-3.5 ${analytics.isFetching ? 'animate-pulse motion-reduce:animate-none' : ''}`} /><span>{analytics.isFetching ? 'Syncing live data…' : `Live · ${lastUpdated}`}</span></div>
      </div>
    </div>
    <AnalyticsTabs active={activeTab} onChange={setActiveTab} />
    {view && <AnalyticsScopeNotice analytics={view.source} sourceName={sourceName} />}
    {analytics.data?.failures.length ? <div className="rounded-xl border border-brand-amber/20 bg-brand-amber/8 px-4 py-3 text-[11px] text-brand-amber">Some live metrics could not refresh for {analytics.data.failures.map(failure => failure.account.displayName).join(', ')}. INXSocial has kept the other verified sources and will retry automatically.</div> : null}
    {analytics.isLoading && !view && <AnalyticsSkeleton />}
    {analytics.isError && view && <div className="rounded-xl border border-brand-amber/20 bg-brand-amber/8 px-4 py-3 text-[11px] text-brand-amber"><strong>Live refresh delayed.</strong> INXSocial is keeping the last verified analytics visible and will retry automatically instead of replacing the workspace with an error state.</div>}
    {analytics.isError && !view && <div className="rounded-panel border border-brand-red/25 bg-brand-red/8 p-6"><h2 className="font-semibold">Analytics could not be loaded</h2><p className="mt-2 text-xs leading-5 text-text-muted">{analytics.error instanceof Error ? analytics.error.message : 'Reconnect this account or try again.'}</p><a className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-border-soft px-4 text-xs" href="/app/connected-accounts">Review connected accounts</a></div>}
    {view && <div className="analytics-data-transition space-y-4" key={`${selectedScopeKey}-${days}`}>
      <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 xl:grid-cols-6">{view.stats.map(stat => <AnalyticsStatCard key={stat.id} stat={stat} />)}</div>
      {noVerifiedMetrics && <div className="rounded-xl border border-brand-amber/20 bg-brand-amber/8 px-4 py-3 text-[11px] text-brand-amber"><strong>{sourceName} analytics are partially available.</strong> {view.source.capabilities?.pageInsights.reason || 'Live metrics are not available for the selected content yet.'}</div>}
      {view.lowData && !noVerifiedMetrics && <div className="rounded-xl border border-brand-amber/20 bg-brand-amber/8 px-4 py-3 text-[11px] text-brand-amber">Analytics are just starting. More insight will appear as the selected accounts publish additional content.</div>}
      {activeTab === 'overview' && <><div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,.72fr)]"><PerformanceOverTimeCard interval={interval} mode={chartMode} onModeChange={setChartMode} points={chartPoints} setInterval={setInterval} tracking={view.source.tracking} /><EngagementByPlatformCard breakdown={breakdown} total={view.totalEngagements} /></div><div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(260px,.75fr)_minmax(300px,.9fr)]"><TopPerformingPostsCard onViewAll={() => setActiveTab('content_performance')} platform={view.source.platform} posts={view.topPosts} /><ContentEfficiencyCard analytics={view.source} /><PublishingRhythmCard analytics={view.source} days={days} /></div><BestTimeToPostCard cells={view.heatmap} /><ProviderMetricsCard sources={providerMetricSources} /></>}
      {activeTab === 'content_performance' && <><div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.75fr)]"><PerformanceOverTimeCard interval={interval} mode={chartMode} onModeChange={setChartMode} points={chartPoints} setInterval={setInterval} tracking={view.source.tracking} /><TopPerformingPostsCard onViewAll={() => {}} platform={view.source.platform} posts={view.topPosts} /></div><ProviderMetricsCard sources={providerMetricSources} /></>}
      {activeTab === 'audience' && <><div className="grid gap-4 lg:grid-cols-2"><ContentEfficiencyCard analytics={view.source} /><PublishingRhythmCard analytics={view.source} days={days} /></div><BestTimeToPostCard cells={view.heatmap} /></>}
      {activeTab === 'engagement' && <><div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,.7fr)]"><PerformanceOverTimeCard interval={interval} mode={chartMode} onModeChange={setChartMode} points={chartPoints} setInterval={setInterval} tracking={view.source.tracking} /><EngagementByPlatformCard breakdown={breakdown} total={view.totalEngagements} /></div><BestTimeToPostCard cells={view.heatmap} /></>}
      {activeTab === 'reach' && <><PerformanceOverTimeCard interval={interval} mode={chartMode} onModeChange={setChartMode} points={chartPoints} setInterval={setInterval} tracking={view.source.tracking} /><ProviderMetricsCard sources={providerMetricSources} /></>}
      {activeTab === 'videos' && <><TopPerformingPostsCard onViewAll={() => {}} platform={view.source.platform} posts={view.topPosts.filter(post => /video|reel/i.test(post.contentType))} /><ProviderMetricsCard sources={providerMetricSources} /></>}
      {['stories', 'competitors'].includes(activeTab) && <AnalyticsCard><UnavailableState detail={`${activeTab === 'stories' ? 'Story' : 'Competitor'} analytics are not available from the connected platform data currently returned to INXSocial. This view will activate when verified data is available.`} title={`${activeTab === 'stories' ? 'Stories' : 'Competitors'} data unavailable`} /></AnalyticsCard>}
      {activeTab === 'reports' && <AnalyticsCard><AnalyticsCardHeader description="Export the currently selected live account scope and date range without including credentials or access tokens." title="Analytics Reports" /><div className="grid min-h-56 place-items-center p-6 text-center"><span><CalendarDays className="mx-auto size-8 text-brand-cyan" /><strong className="mt-3 block">Report ready for {sourceName}</strong><p className="mt-2 text-xs text-text-muted">Live data fetched {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(view.source.fetchedAt))}</p><div className="mt-4 inline-block"><ExportReportButton view={view} /></div></span></div></AnalyticsCard>}
      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-soft bg-panel/55 px-4 py-3 text-[10px] text-text-soft"><span>Current post-performance analytics for {sourceName}.</span><span>Latest metrics refresh every 5 minutes · Last update {lastUpdated}</span></footer>
    </div>}
  </div>
}
