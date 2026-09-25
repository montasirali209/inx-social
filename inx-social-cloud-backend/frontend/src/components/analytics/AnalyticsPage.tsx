import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarDays, Radio } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { buildAnalyticsView } from '../../data/analyticsData'
import { fetchAnalyticsForSource, fetchAnalyticsSources, type AnalyticsSourceAccount } from '../../lib/analytics-api'
import { connectPostForMePlatform, syncPostForMeConnections } from '../../lib/connections-api'
import { readSessionCache, writeSessionCache } from '../../lib/session-cache'
import type { AnalyticsTab } from '../../types/analytics'
import type { Platform, PlatformAnalytics } from '../../types/dashboard'
import { AnalyticsAccountSelector, type AnalyticsAccount } from './AnalyticsAccountSelector'
import { AnalyticsWorkspaceSkeleton, AnalyticsCard, AnalyticsCardHeader } from './AnalyticsPrimitives'
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

const selectionKey = 'inx-social-analytics-source-v5'
const legacySelectionKey = 'inx-social-analytics-sources-v4'
const analyticsSourcesCacheKey = 'inx-social-cache:analytics-sources-v1'

function analyticsWorkspaceCacheKey(scope: string, days: number) {
  return `inx-social-cache:analytics:${encodeURIComponent(scope)}:${days}`
}

function savedSelection() {
  const direct = window.localStorage.getItem(selectionKey)
  if (direct) return direct
  try {
    const legacy = JSON.parse(window.localStorage.getItem(legacySelectionKey) || '[]')
    return Array.isArray(legacy) && legacy.length ? String(legacy[0]) : null
  } catch {
    return null
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

export function AnalyticsPage() {
  const queryClient = useQueryClient()
  const [selectedKey, setSelectedKey] = useState<string | null>(savedSelection)
  const [days, setDays] = useState(30)
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview')
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const [repairingAccess, setRepairingAccess] = useState(false)
  const [repairError, setRepairError] = useState('')
  const forcedSelections = useRef(new Set<string>())

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
  const selectedAccount = useMemo(() => {
    if (!accounts.length) return null
    return accounts.find(account => account.analyticsKey === selectedKey) || accounts[0]!
  }, [accounts, selectedKey])
  const selectedScopeKey = selectedAccount?.analyticsKey || ''
  const analyticsQueryKey = ['analytics-workspace', 'post-for-me', selectedScopeKey, days] as const

  async function loadAnalytics(force = false): Promise<LiveAnalyticsData> {
    if (!selectedAccount) throw new Error('Choose a connected account to view Analytics.')
    const source = await fetchAnalyticsForSource(selectedAccount, days, 'full', force)
    if (selectedAccount.platform === 'x' && source.provider?.ownershipVerified !== true) {
      return { analytics: source, results: [{ account: selectedAccount, analytics: source }], failures: [] }
    }
    const result = { analytics: source, results: [{ account: selectedAccount, analytics: source }], failures: [] }
    writeSessionCache(analyticsWorkspaceCacheKey(selectedScopeKey, days), result)
    return result
  }

  const analytics = useQuery<LiveAnalyticsData>({
    queryKey: analyticsQueryKey,
    enabled: Boolean(selectedAccount),
    refetchInterval: (query) => {
      const data = query.state.data as LiveAnalyticsData | undefined
      const states = data?.results?.map(result => String(result.analytics?.provider?.cacheState || '')) || []
      if (data?.analytics?.provider?.repairRequired) return false
      if (states.includes('refreshing')) return 2_000
      if (states.includes('partial')) return 15_000
      if (states.includes('stale')) return 60_000
      return 5 * 60_000
    },
    refetchOnWindowFocus: false,
    retry: 0,
    staleTime: 2 * 60_000,
    initialData: () => {
      const cached = selectedScopeKey ? readSessionCache<LiveAnalyticsData>(analyticsWorkspaceCacheKey(selectedScopeKey, days)) : undefined
      return cached?.results.some(result => result.account.analyticsKey !== selectedScopeKey) ? undefined : cached
    },
    initialDataUpdatedAt: 0,
    queryFn: () => {
      const selection = `${selectedScopeKey}:${days}`
      const force = !forcedSelections.current.has(selection)
      forcedSelections.current.add(selection)
      return loadAnalytics(force)
    },
  })

  const view = useMemo(() => analytics.data ? buildAnalyticsView(analytics.data.analytics, days) : null, [analytics.data, days])
  const chartPoints = useMemo(() => view?.publishedPerformance || [], [view])
  const breakdown = useMemo<EngagementPlatformRow[]>(() => {
    if (!selectedAccount || !analytics.data) return []
    return [{ platform: selectedAccount.platform as Platform, total: Number(analytics.data.analytics.summary.totalInteractions || 0), accounts: 1 }]
  }, [analytics.data, selectedAccount])

  function changeSelection(key: string) {
    if (key === selectedScopeKey) return
    setSelectedKey(key)
    setRepairError('')
    window.localStorage.setItem(selectionKey, key)
    setActiveTab('overview')
  }

  async function refreshAnalyticsNow() {
    if (!selectedAccount || manualRefreshing) return
    setManualRefreshing(true)
    try {
      const result = await loadAnalytics(true)
      queryClient.setQueryData<LiveAnalyticsData>(analyticsQueryKey, result)
    } finally {
      setManualRefreshing(false)
    }
  }

  async function repairAnalyticsAccess() {
    if (!selectedAccount || repairingAccess) return
    setRepairingAccess(true)
    setRepairError('')
    try {
      await connectPostForMePlatform(selectedAccount.platform)
      await syncPostForMeConnections()
      await sources.refetch()
      const result = await loadAnalytics(true)
      queryClient.setQueryData<LiveAnalyticsData>(analyticsQueryKey, result)
      forcedSelections.current.add(`${selectedScopeKey}:${days}`)
    } catch (error) {
      setRepairError(error instanceof Error ? error.message : 'Analytics access could not be refreshed.')
    } finally {
      setRepairingAccess(false)
    }
  }


  if (!sources.isLoading && !accounts.length) return <div className="grid min-h-[55vh] place-items-center rounded-panel border border-border-soft bg-panel/70 p-8 text-center"><span><AlertTriangle className="mx-auto size-9 text-brand-amber" /><h2 className="mt-4 text-lg font-semibold">Connect an account to unlock Analytics</h2><p className="mx-auto mt-2 max-w-md text-sm text-text-muted">Connect any supported social network to view live content performance and engagement metrics.</p><a className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-brand-teal px-4 text-sm font-semibold text-white" href="/app/connected-accounts">Manage connected accounts</a></span></div>

  const selectorAccounts = accounts as unknown as AnalyticsAccount[]
  const singleSource = selectedAccount
  const sourceName = singleSource?.displayName || (singleSource ? platformNames[singleSource.platform as Platform] : 'Selected account')
  const noVerifiedMetrics = Boolean(view && !view.source.capabilities?.pageInsights.available)
  const partialMetrics = Boolean(view && (noVerifiedMetrics || analytics.data?.results.some(result => result.analytics?.provider?.cacheState === 'partial')))
  const lastUpdated = view ? new Intl.DateTimeFormat('en-GB', { timeStyle: 'medium' }).format(new Date(view.source.fetchedAt)) : ''
  const providerMetricSources = analytics.data?.results || []
  const backgroundRefreshing = Boolean(analytics.data?.results?.some(result => result.analytics?.provider?.cacheState === 'refreshing'))
  const providerRepairRequired = Boolean(view?.source.provider?.repairRequired)
  const providerSourceState = view?.source.provider?.sourceState
  const selectedIsSyncing = !view || manualRefreshing
  const quietRefresh = Boolean(view && !manualRefreshing && (analytics.isFetching || backgroundRefreshing))
  const repairTitle = providerSourceState === 'ownership_mismatch'
    ? 'The X analytics feed does not match this connected account.'
    : 'The connected account returned no analytics feed.'
  const repairDetail = providerSourceState === 'ownership_mismatch'
    ? 'INXSocial rejected unrelated X posts instead of showing another account’s data. Refresh X analytics access once to repair the account/feed mapping.'
    : 'This is not a slow sync. Refresh analytics access once to re-authorize the feed permission; publishing access and existing scheduled posts are preserved.'

  const syncLabel = providerRepairRequired && !selectedIsSyncing
    ? `Analytics access needs refresh · Last check ${lastUpdated || 'just now'}`
    : selectedIsSyncing
      ? `Updating ${sourceName} · ${lastUpdated ? `Last sync ${lastUpdated}` : 'Fetching latest metrics'}`
      : partialMetrics
        ? `Metrics pending · Last check ${lastUpdated || 'just now'}`
        : quietRefresh
          ? `Last sync · ${lastUpdated || 'Checking latest'}`
          : `Last sync · ${lastUpdated || 'Waiting'}`

  return <div className="analytics-fluid-canvas dashboard-canvas space-y-4 pb-8">
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
      <AnalyticsAccountSelector accounts={selectorAccounts} isLive={Boolean(view) && !analytics.isError && !partialMetrics} isPending={partialMetrics && !providerRepairRequired} loading={sources.isLoading} needsRepair={providerRepairRequired && !selectedIsSyncing} onChange={changeSelection} value={selectedScopeKey || null} />
      <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
        <label className="rounded-xl border border-border-soft bg-panel/70 px-3 py-2"><span className="block text-[9px] uppercase tracking-wider text-text-soft">Analytics period</span><select className="mt-1 min-h-7 w-full min-w-0 bg-transparent text-xs font-semibold outline-none sm:min-w-40" onChange={(event) => setDays(Number(event.target.value))} value={days}><option value={7}>Last 7 Days</option><option value={30}>Last 30 Days</option><option value={90}>Last 90 Days</option></select></label>
        {view && !noVerifiedMetrics && <ExportReportButton view={view} />}
        <div className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-[10px] ${providerRepairRequired && !selectedIsSyncing ? 'border-brand-amber/25 bg-brand-amber/[.06] text-brand-amber' : selectedIsSyncing ? 'border-brand-cyan/20 bg-brand-cyan/[.06] text-brand-cyan' : partialMetrics ? 'border-brand-amber/20 bg-brand-amber/[.05] text-brand-amber' : 'border-brand-green/15 bg-brand-green/[.055] text-brand-green'}`}><Radio className={`size-3.5 ${selectedIsSyncing ? 'animate-pulse motion-reduce:animate-none' : ''}`} /><span>{syncLabel}</span></div>
      </div>
    </div>

    <AnalyticsTabs active={activeTab} onChange={setActiveTab} />
    {view && !noVerifiedMetrics && <AnalyticsScopeNotice analytics={view.source} sourceName={sourceName} />}

    {analytics.data?.failures.length ? <div className="rounded-xl border border-brand-amber/20 bg-brand-amber/8 px-4 py-3 text-[11px] text-brand-amber">Some live metrics could not refresh for {analytics.data.failures.map(failure => failure.account.displayName).join(', ')}. INXSocial has kept the other verified sources and will retry automatically.</div> : null}
    {analytics.isError && <div className="rounded-xl border border-brand-amber/20 bg-brand-amber/8 px-4 py-3 text-[11px] text-brand-amber"><strong>Analytics sync is taking longer than expected.</strong> The workspace will stay in its normal layout and retry automatically. <button className="ml-2 font-semibold text-brand-cyan underline underline-offset-2" onClick={() => void refreshAnalyticsNow()} type="button">Retry now</button></div>}
    {providerRepairRequired && !selectedIsSyncing && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-amber/25 bg-brand-amber/[.07] px-4 py-3 text-[11px] text-brand-amber">
      <span className="min-w-0"><strong className="block text-text-main">{repairTitle}</strong><span className="mt-0.5 block text-text-muted">{repairDetail}</span>{repairError && <span className="mt-1 block text-brand-red">{repairError}</span>}</span>
      <button className="inline-flex min-h-9 items-center rounded-xl border border-brand-amber/30 bg-brand-amber/10 px-3 font-semibold text-brand-amber transition hover:bg-brand-amber/15 disabled:cursor-wait disabled:opacity-60" disabled={repairingAccess} onClick={() => void repairAnalyticsAccess()} type="button">{repairingAccess ? 'Refreshing access…' : `Refresh ${platformNames[selectedAccount!.platform as Platform]} analytics access`}</button>
    </div>}

    {(!view || noVerifiedMetrics) && <AnalyticsWorkspaceSkeleton active={selectedIsSyncing} />}

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
