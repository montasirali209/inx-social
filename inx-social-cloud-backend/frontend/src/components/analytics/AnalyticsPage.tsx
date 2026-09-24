import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, FileText, Radio, RefreshCw, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buildAnalyticsView } from '../../data/analyticsData'
import { fetchAnalyticsForSource, fetchAnalyticsSources, mergeAnalyticsResults, type AnalyticsSourceAccount } from '../../lib/analytics-api'
import { connectPostForMePlatform } from '../../lib/connections-api'
import { readSessionCache, writeSessionCache } from '../../lib/session-cache'
import type { AnalyticsTab } from '../../types/analytics'
import type { Platform, PlatformAnalytics } from '../../types/dashboard'
import { AnalyticsAccountSelector, type AnalyticsAccount } from './AnalyticsAccountSelector'
import { AnalyticsKpiSkeleton, AnalyticsCard, AnalyticsCardHeader } from './AnalyticsPrimitives'
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

function ConnectedContentCard({ analytics }: { analytics: PlatformAnalytics }) {
  const content = [...analytics.content]
    .filter(post => post.createdTime)
    .sort((left, right) => String(right.createdTime || '').localeCompare(String(left.createdTime || '')))
    .slice(0, 5)

  return <AnalyticsCard>
    <AnalyticsCardHeader
      description="Connected posts are shown here while performance metrics finish syncing. They are not ranked until verified metrics are available."
      title="Connected Content"
    />
    {content.length ? <div className="space-y-2 px-4 pb-4 sm:px-5">
      {content.map(post => <a
        className="flex min-w-0 items-center gap-3 rounded-xl border border-border-soft bg-bg/25 px-3 py-2.5 transition hover:border-brand-cyan/25 hover:bg-white/[.025]"
        href={post.permalinkUrl || undefined}
        key={post.id}
        rel="noreferrer"
        target={post.permalinkUrl ? '_blank' : undefined}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand-cyan/15 bg-brand-cyan/[.06] text-brand-cyan"><FileText className="size-4" /></span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-xs text-text-main">{post.message.trim().split(/\n/)[0]?.slice(0, 110) || `${post.contentType || 'Social'} post`}</strong>
          <small className="mt-1 block text-[9px] capitalize text-text-soft">{post.contentType || 'post'} · {post.createdTime ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(post.createdTime)) : 'Date unavailable'}</small>
        </span>
        <CheckCircle2 className="size-4 shrink-0 text-brand-green" />
      </a>)}
    </div> : <div className="grid min-h-32 place-items-center px-5 pb-5 text-center text-xs text-text-soft">No connected posts fall inside this date range yet.</div>}
  </AnalyticsCard>
}

export function AnalyticsPage() {
  const queryClient = useQueryClient()
  const [selectedKeys, setSelectedKeys] = useState<string[]>(savedSelection)
  const [days, setDays] = useState(30)
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview')
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)

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
  const analyticsQueryKey = ['analytics-workspace', 'post-for-me', selectedScopeKey, days] as const

  async function loadAnalytics(force = false): Promise<LiveAnalyticsData> {
    const settled = await mapWithConcurrency(selectedAccounts, 2, async account => {
      try {
        const source = await fetchAnalyticsForSource(account, days, 'full', force)
        if (account.platform === 'x' && source.provider?.ownershipVerified !== true) throw new Error('X post ownership is being verified. Please refresh shortly.')
        return { ok: true as const, account, analytics: source }
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
  }

  const analytics = useQuery<LiveAnalyticsData>({
    queryKey: analyticsQueryKey,
    enabled: selectedAccounts.length > 0,
    refetchInterval: (query) => {
      const data = query.state.data as LiveAnalyticsData | undefined
      const states = data?.results?.map(result => String(result.analytics?.provider?.cacheState || '')) || []
      if (states.includes('refreshing')) return 3_000
      if (states.includes('partial')) return 30_000
      if (states.includes('stale')) return 60_000
      return 5 * 60_000
    },
    refetchOnWindowFocus: false,
    retry: 0,
    staleTime: 2 * 60_000,
    initialData: () => {
      const cached = selectedScopeKey ? readSessionCache<LiveAnalyticsData>(analyticsWorkspaceCacheKey(selectedScopeKey, days)) : undefined
      return cached?.results.some(result => result.account.platform === 'x' && result.analytics.provider?.ownershipVerified !== true) ? undefined : cached
    },
    initialDataUpdatedAt: 0,
    queryFn: () => loadAnalytics(false),
  })

  const view = useMemo(() => analytics.data ? buildAnalyticsView(analytics.data.analytics, days) : null, [analytics.data, days])
  const chartPoints = useMemo(() => view?.publishedPerformance || [], [view])
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

  async function refreshAnalyticsNow() {
    if (!selectedAccounts.length || manualRefreshing) return
    setManualRefreshing(true)
    try {
      const result = await loadAnalytics(true)
      queryClient.setQueryData<LiveAnalyticsData>(analyticsQueryKey, result)
    } finally {
      setManualRefreshing(false)
    }
  }

  async function reconnectFacebookAnalytics() {
    if (reconnecting) return
    setReconnecting(true)
    try {
      await connectPostForMePlatform('facebook')
      await sources.refetch()
      const result = await loadAnalytics(true)
      queryClient.setQueryData<LiveAnalyticsData>(analyticsQueryKey, result)
    } finally {
      setReconnecting(false)
    }
  }

  if (!sources.isLoading && !accounts.length) return <div className="grid min-h-[55vh] place-items-center rounded-panel border border-border-soft bg-panel/70 p-8 text-center"><span><AlertTriangle className="mx-auto size-9 text-brand-amber" /><h2 className="mt-4 text-lg font-semibold">Connect an account to unlock Analytics</h2><p className="mx-auto mt-2 max-w-md text-sm text-text-muted">Connect any supported social network to view live content performance and engagement metrics.</p><a className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-brand-teal px-4 text-sm font-semibold text-white" href="/app/connected-accounts">Manage connected accounts</a></span></div>

  const selectorAccounts = accounts as unknown as AnalyticsAccount[]
  const singleSource = selectedAccounts.length === 1 ? selectedAccounts[0] : null
  const sourceName = singleSource ? platformNames[singleSource.platform as Platform] : `${selectedAccounts.length} selected accounts`
  const noVerifiedMetrics = Boolean(view && !view.source.capabilities?.pageInsights.available)
  const partialMetrics = Boolean(view && (noVerifiedMetrics || analytics.data?.results.some(result => result.analytics?.provider?.cacheState === 'partial')))
  const lastUpdated = view ? new Intl.DateTimeFormat('en-GB', { timeStyle: 'medium' }).format(new Date(view.source.fetchedAt)) : ''
  const providerMetricSources = analytics.data?.results || []
  const backgroundRefreshing = Boolean(analytics.data?.results?.some(result => result.analytics?.provider?.cacheState === 'refreshing'))
  const connectedFeedPosts = Number(view?.source.provider?.feedPosts ?? view?.source.content.length ?? 0)
  const periodPosts = Number(view?.source.provider?.periodPosts ?? view?.source.summary.posts ?? 0)
  const measuredPosts = Number(view?.source.provider?.postsWithMetrics || 0)
  const feedAvailable = connectedFeedPosts > 0
  const unverifiedXPosts = Boolean(singleSource?.platform === 'x' && Number(view?.source.provider?.unverifiedFeedPosts || 0) > 0 && !feedAvailable)
  const reconnectHint = Boolean(singleSource?.platform === 'facebook' && measuredPosts === 0)

  const syncLabel = analytics.isFetching || manualRefreshing
    ? `Checking latest · Last sync ${lastUpdated || 'Waiting'}`
    : backgroundRefreshing
      ? `Refreshing in background · Last sync ${lastUpdated || 'Waiting'}`
      : partialMetrics
        ? `Connected · Metrics pending · ${lastUpdated || 'Waiting'}`
        : `Last sync · ${lastUpdated || 'Waiting'}`

  return <div className="analytics-fluid-canvas dashboard-canvas space-y-4 pb-8">
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
      <AnalyticsAccountSelector accounts={selectorAccounts} isLive={Boolean(view) && !analytics.isError && !partialMetrics} loading={sources.isLoading} onChange={changeSelection} values={effectiveSelectedKeys} />
      <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
        <label className="rounded-xl border border-border-soft bg-panel/70 px-3 py-2"><span className="block text-[9px] uppercase tracking-wider text-text-soft">Analytics period</span><select className="mt-1 min-h-7 w-full min-w-0 bg-transparent text-xs font-semibold outline-none sm:min-w-40" onChange={(event) => setDays(Number(event.target.value))} value={days}><option value={7}>Last 7 Days</option><option value={30}>Last 30 Days</option><option value={90}>Last 90 Days</option></select></label>
        {view && !noVerifiedMetrics && <ExportReportButton view={view} />}
        <div className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-[10px] ${partialMetrics ? 'border-brand-amber/25 bg-brand-amber/[.06] text-brand-amber' : analytics.isFetching || backgroundRefreshing || manualRefreshing ? 'border-brand-cyan/20 bg-brand-cyan/[.06] text-brand-cyan' : 'border-brand-green/15 bg-brand-green/[.055] text-brand-green'}`}><Radio className={`size-3.5 ${analytics.isFetching || backgroundRefreshing || manualRefreshing ? 'animate-pulse motion-reduce:animate-none' : ''}`} /><span>{syncLabel}</span></div>
      </div>
    </div>

    {!noVerifiedMetrics && <AnalyticsTabs active={activeTab} onChange={setActiveTab} />}
    {view && !noVerifiedMetrics && <AnalyticsScopeNotice analytics={view.source} sourceName={sourceName} />}

    {analytics.data?.failures.length ? <div className="rounded-xl border border-brand-amber/20 bg-brand-amber/8 px-4 py-3 text-[11px] text-brand-amber">Some live metrics could not refresh for {analytics.data.failures.map(failure => failure.account.displayName).join(', ')}. INXSocial has kept the other verified sources and will retry automatically.</div> : null}
    {(sources.isLoading || analytics.isLoading) && !view && <AnalyticsKpiSkeleton />}
    {analytics.isError && view && <div className="rounded-xl border border-brand-amber/20 bg-brand-amber/8 px-4 py-3 text-[11px] text-brand-amber"><strong>Live refresh delayed.</strong> INXSocial is keeping the last verified analytics visible and will retry automatically instead of replacing the workspace with an error state.</div>}
    {analytics.isError && !view && <div className="rounded-panel border border-brand-red/25 bg-brand-red/8 p-6"><h2 className="font-semibold">Analytics could not be loaded</h2><p className="mt-2 text-xs leading-5 text-text-muted">{analytics.error instanceof Error ? analytics.error.message : 'Reconnect this account or try again.'}</p><a className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-border-soft px-4 text-xs" href="/app/connected-accounts">Review connected accounts</a></div>}

    {view && noVerifiedMetrics && <div className="analytics-data-transition space-y-4" key={`partial-${selectedScopeKey}-${days}`}>
      {(analytics.isFetching || backgroundRefreshing || manualRefreshing) && <AnalyticsKpiSkeleton />}
      <section className="relative overflow-hidden rounded-panel border border-brand-amber/20 bg-[radial-gradient(circle_at_12%_0%,rgba(245,158,11,.10),transparent_28rem),linear-gradient(135deg,rgba(9,28,39,.97),rgba(4,18,28,.98))] p-5 shadow-panel sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full border border-brand-cyan/[.08] bg-brand-cyan/[.025]" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-brand-amber/25 bg-brand-amber/10 text-brand-amber"><ShieldCheck className="size-5" /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight text-text-main">{unverifiedXPosts ? 'X feed contains posts from other accounts.' : feedAvailable ? 'Connected. Performance metrics are syncing.' : 'Connection active. Content feed needs attention.'}</h2>
                <span className="rounded-full border border-brand-amber/25 bg-brand-amber/8 px-2 py-1 text-[9px] font-semibold uppercase tracking-[.12em] text-brand-amber">Metrics pending</span>
              </div>
              <p className="mt-2 max-w-3xl text-xs leading-5 text-text-muted">
                {unverifiedXPosts
                  ? <>The provider returned reposts or posts without proof they were published by {singleSource?.displayName || 'this account'}. INXSocial has excluded their metrics from this account. We will show your own posts when the connected feed supplies verifiable account-owned content.</>
                  : feedAvailable
                  ? <>INXSocial can read the connected content for {sourceName}, but the provider has not returned verified performance metrics for this connection yet. We keep this state separate from real zero performance and retry it automatically.</>
                  : <>The social account is connected, but its provider feed returned no posts to INXSocial. Without feed items there is nothing reliable to measure, so the dashboard now shows a recovery state instead of fake zero analytics.</>}
              </p>
              {reconnectHint && <p className="mt-2 max-w-3xl text-[11px] leading-5 text-text-soft">{feedAvailable ? 'If this is an older Facebook connection, reconnect it once so Facebook can grant the current Insights permission.' : 'For Facebook, this commonly means the existing OAuth connection needs the current feed/Insights permission. Reconnect once, then INXSocial will immediately resync the feed and metrics.'}</p>}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 px-4 text-xs font-semibold text-brand-cyan transition hover:bg-brand-cyan/15 disabled:cursor-wait disabled:opacity-60" disabled={manualRefreshing || analytics.isFetching} onClick={() => void refreshAnalyticsNow()} type="button"><RefreshCw className={`size-4 ${manualRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} />{manualRefreshing ? 'Refreshing…' : 'Refresh analytics'}</button>
            {reconnectHint && <button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-amber/30 bg-brand-amber/8 px-4 text-xs font-semibold text-brand-amber transition hover:bg-brand-amber/12 disabled:cursor-wait disabled:opacity-60" disabled={reconnecting} onClick={() => void reconnectFacebookAnalytics()} type="button"><RefreshCw className={`size-4 ${reconnecting ? 'animate-spin motion-reduce:animate-none' : ''}`} />{reconnecting ? 'Reconnecting…' : 'Reconnect Facebook'}</button>}
            <a className="inline-flex min-h-10 items-center rounded-xl border border-border-soft bg-panel/60 px-4 text-xs font-semibold text-text-main transition hover:border-brand-cyan/25 hover:bg-panel-hover/70" href="/app/connected-accounts">Review connection</a>
            {feedAvailable && periodPosts === 0 && days < 90 && <button className="inline-flex min-h-10 items-center rounded-xl border border-border-soft px-4 text-xs font-semibold text-text-muted transition hover:border-brand-cyan/25 hover:text-white" onClick={() => setDays(90)} type="button">View 90 days</button>}
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            { label: 'Connected content', value: connectedFeedPosts, detail: 'Posts returned by source', icon: CheckCircle2 },
            { label: `In last ${days} days`, value: periodPosts, detail: 'Posts inside this report', icon: CalendarDays },
            { label: 'Measured posts', value: measuredPosts, detail: measuredPosts ? 'Metrics verified' : 'Awaiting provider metrics', icon: Radio },
            { label: 'Selected accounts', value: selectedAccounts.length, detail: selectedAccounts.length === 1 ? sourceName : 'Combined scope', icon: Clock3 },
          ].map(({ label, value, detail, icon: Icon }) => <div className="rounded-xl border border-white/10 bg-white/[.035] p-3" key={label}><span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.04em] text-text-muted"><Icon className="size-3.5 text-brand-cyan" />{label}</span><strong className="mt-2 block text-xl text-text-main">{value.toLocaleString('en-GB')}</strong><small className="mt-1 block truncate text-[11px] text-text-muted">{detail}</small></div>)}
        </div>
      </section>

      {periodPosts > 0 ? <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)]"><ConnectedContentCard analytics={view.source} /><PublishingRhythmCard analytics={view.source} days={days} /></div> : <AnalyticsCard><AnalyticsCardHeader description="The account connection is active. Performance cards will appear only when verified metrics exist for the selected reporting window." title="No zero-filled analytics" /><div className="grid min-h-40 place-items-center px-6 pb-6 text-center"><span><CalendarDays className="mx-auto size-7 text-brand-cyan" /><strong className="mt-3 block text-sm">{unverifiedXPosts ? 'No account-owned X posts could be verified' : `No posts inside the selected ${days}-day window`}</strong><p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-text-muted">{unverifiedXPosts ? 'Other people’s posts and reposts are excluded from your analytics. Refresh after your connected X account publishes original content.' : 'Choose a wider reporting period or wait for new content. INXSocial no longer presents unavailable metrics as genuine zero performance.'}</p></span></div></AnalyticsCard>}

      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-soft bg-panel/55 px-4 py-3 text-[10px] text-text-soft"><span>Connection health and content availability for {sourceName}.</span><span>Partial sources retry automatically · Last provider response {lastUpdated || 'Waiting'}</span></footer>
    </div>}

    {view && !noVerifiedMetrics && <div className="analytics-data-transition space-y-4" key={`${selectedScopeKey}-${days}`}>
      <div className="grid grid-cols-2 gap-2 pb-1 sm:gap-3 xl:grid-cols-6">{view.stats.map(stat => <AnalyticsStatCard key={stat.id} stat={stat} />)}</div>
      {view.lowData && <div className="rounded-xl border border-brand-amber/20 bg-brand-amber/8 px-4 py-3 text-[11px] text-brand-amber">Analytics are just starting. More insight will appear as the selected accounts publish additional content.</div>}
      {activeTab === 'overview' && <><div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,2.15fr)_minmax(280px,.62fr)]"><PerformanceOverTimeCard compact days={days} points={chartPoints} /><EngagementByPlatformCard breakdown={breakdown} compact total={view.totalEngagements} /></div><div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(260px,.75fr)_minmax(300px,.9fr)]"><TopPerformingPostsCard onViewAll={() => setActiveTab('content_performance')} platform={view.source.platform} posts={view.topPosts} /><ContentEfficiencyCard analytics={view.source} /><PublishingRhythmCard analytics={view.source} days={days} /></div><BestTimeToPostCard cells={view.heatmap} /><ProviderMetricsCard sources={providerMetricSources} /></>}
      {activeTab === 'content_performance' && <><div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.75fr)]"><PerformanceOverTimeCard days={days} points={chartPoints} /><TopPerformingPostsCard onViewAll={() => {}} platform={view.source.platform} posts={view.topPosts} /></div><ProviderMetricsCard sources={providerMetricSources} /></>}
      {activeTab === 'audience' && <><div className="grid gap-4 lg:grid-cols-2"><ContentEfficiencyCard analytics={view.source} /><PublishingRhythmCard analytics={view.source} days={days} /></div><BestTimeToPostCard cells={view.heatmap} /></>}
      {activeTab === 'engagement' && <><div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,.7fr)]"><PerformanceOverTimeCard days={days} points={chartPoints} /><EngagementByPlatformCard breakdown={breakdown} total={view.totalEngagements} /></div><BestTimeToPostCard cells={view.heatmap} /></>}
      {activeTab === 'reach' && <><PerformanceOverTimeCard days={days} points={chartPoints} /><ProviderMetricsCard sources={providerMetricSources} /></>}
      {activeTab === 'videos' && <><TopPerformingPostsCard onViewAll={() => {}} platform={view.source.platform} posts={view.topPosts.filter(post => /video|reel/i.test(post.contentType))} /><ProviderMetricsCard sources={providerMetricSources} /></>}
      {activeTab === 'reports' && <AnalyticsCard><AnalyticsCardHeader description="Export the currently selected live account scope and date range without including credentials or access tokens." title="Analytics Reports" /><div className="grid min-h-56 place-items-center p-6 text-center"><span><CalendarDays className="mx-auto size-8 text-brand-cyan" /><strong className="mt-3 block">Report ready for {sourceName}</strong><p className="mt-2 text-xs text-text-muted">Live data fetched {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(view.source.fetchedAt))}</p><div className="mt-4 inline-block"><ExportReportButton view={view} /></div></span></div></AnalyticsCard>}
      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-soft bg-panel/55 px-4 py-3 text-[10px] text-text-soft"><span>Current post-performance analytics for {sourceName}.</span><span>Latest metrics refresh every 5 minutes · Last sync {lastUpdated}</span></footer>
    </div>}
  </div>
}
