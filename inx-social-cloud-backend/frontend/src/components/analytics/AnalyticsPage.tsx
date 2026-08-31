import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarDays, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildAnalyticsView } from '../../data/analyticsData'
import { fetchFacebookDashboardAnalytics, fetchStudioOverview, selectDashboardAnalyticsPage } from '../../lib/dashboard-api'
import type { AnalyticsTab, PerformancePoint } from '../../types/analytics'
import { DashboardAccountSelector } from '../dashboard/DashboardAccountSelector'
import { Button } from '../ui/Button'
import { AnalyticsSkeleton, AnalyticsCard, AnalyticsCardHeader, UnavailableState } from './AnalyticsPrimitives'
import { AnalyticsStatCard } from './AnalyticsStatCard'
import { AnalyticsTabs } from './AnalyticsTabs'
import { AudienceDemographicsCard, AudienceGrowthCard } from './AudienceCards'
import { BestTimeToPostCard } from './BestTimeToPostCard'
import { EngagementByPlatformCard } from './EngagementByPlatformCard'
import { ExportReportButton } from './ExportReportButton'
import { PerformanceOverTimeCard } from './PerformanceOverTimeCard'
import { TopPerformingPostsCard } from './TopPerformingPostsCard'

const accountKey = 'inx-social-analytics-account-v1'
function savedAccount() { return window.localStorage.getItem(accountKey) || '' }

function aggregate(points: PerformancePoint[], interval: 'daily' | 'weekly' | 'monthly') {
  if (interval === 'daily') return points
  const chunk = interval === 'weekly' ? 7 : Math.max(1, points.length)
  const result: PerformancePoint[] = []
  for (let index = 0; index < points.length; index += chunk) {
    const group = points.slice(index, index + chunk)
    result.push({ date: group[0].date, label: interval === 'weekly' ? `${group[0].label}–${group.at(-1)?.label}` : group.at(-1)?.label || group[0].label, views: group.reduce((sum, item) => sum + item.views, 0), engagements: group.reduce((sum, item) => sum + item.engagements, 0), linkClicks: group.reduce((sum, item) => sum + item.linkClicks, 0), followers: group.reduce((sum, item) => sum + item.followers, 0) })
  }
  return result
}

export function AnalyticsPage() {
  const queryClient = useQueryClient()
  const [accountId, setAccountId] = useState(savedAccount)
  const [days, setDays] = useState(30)
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview')
  const [interval, setInterval] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [forceRefreshing, setForceRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const overview = useQuery({ queryKey: ['studio-overview'], queryFn: fetchStudioOverview, staleTime: 60_000 })
  const pages = useMemo(() => (overview.data?.pages || []).filter((page) => page.status !== 'REVOKED'), [overview.data?.pages])
  const selected = selectDashboardAnalyticsPage(pages, accountId)
  const selectedId = selected?.id || ''
  const queryKey = ['analytics-workspace', selectedId, days]
  const analytics = useQuery({ queryKey, queryFn: () => fetchFacebookDashboardAnalytics(selectedId, days), enabled: Boolean(selectedId), retry: 1, staleTime: 10 * 60_000 })
  const view = useMemo(() => analytics.data ? buildAnalyticsView(analytics.data, days) : null, [analytics.data, days])
  const chartPoints = useMemo(() => view ? aggregate(view.performance, interval) : [], [view, interval])

  function selectAccount(id: string) { window.localStorage.setItem(accountKey, id); setAccountId(id) }
  async function refresh() {
    if (!selectedId) return
    setForceRefreshing(true)
    setRefreshError('')
    try {
      const data = await fetchFacebookDashboardAnalytics(selectedId, days, true)
      queryClient.setQueryData(queryKey, data)
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : 'Analytics refresh failed.')
    } finally {
      setForceRefreshing(false)
    }
  }

  if (overview.isLoading) return <AnalyticsSkeleton />
  if (!pages.length) return <div className="grid min-h-[55vh] place-items-center rounded-panel border border-border-soft bg-panel/70 p-8 text-center"><span><AlertTriangle className="mx-auto size-9 text-brand-amber" /><h2 className="mt-4 text-lg font-semibold">Connect a Page to unlock Analytics</h2><p className="mx-auto mt-2 max-w-md text-sm text-text-muted">Analytics needs a connected Facebook Page with the approved engagement and insights permissions.</p><a className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-brand-teal px-4 text-sm font-semibold text-white" href="/studio/?view=pages">Manage connected accounts</a></span></div>

  return <div className="dashboard-canvas space-y-4 pb-8">
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]"><DashboardAccountSelector contextLabel="Analytics" isRefreshing={analytics.isFetching || forceRefreshing} onChange={selectAccount} onRefresh={() => void refresh()} pages={pages} value={selectedId} /><div className="flex flex-col gap-2 sm:flex-row xl:flex-col"><label className="rounded-xl border border-border-soft bg-panel/70 px-3 py-2"><span className="block text-[9px] uppercase tracking-wider text-text-soft">Analytics period</span><select className="mt-1 min-h-7 min-w-40 bg-transparent text-xs font-semibold outline-none" onChange={(event) => setDays(Number(event.target.value))} value={days}><option value={7}>Last 7 Days</option><option value={30}>Last 30 Days</option><option value={90}>Last 90 Days</option></select></label>{view && <ExportReportButton view={view} />}</div></div>
    <AnalyticsTabs active={activeTab} onChange={setActiveTab} />
    {refreshError && <div className="rounded-xl border border-brand-red/25 bg-brand-red/8 px-4 py-3 text-[11px] text-brand-red">{refreshError}</div>}
    {analytics.isLoading && <AnalyticsSkeleton />}
    {analytics.isError && <div className="rounded-panel border border-brand-red/25 bg-brand-red/8 p-6"><h2 className="font-semibold">Analytics could not be loaded</h2><p className="mt-2 text-xs leading-5 text-text-muted">{analytics.error instanceof Error ? analytics.error.message : 'Reconnect this Page or try again.'}</p><div className="mt-4 flex gap-2"><Button onClick={() => void analytics.refetch()} type="button"><RefreshCw className="size-4" />Retry</Button><a className="inline-flex min-h-10 items-center rounded-xl border border-border-soft px-4 text-xs" href="/studio/?view=pages">Reconnect Page</a></div></div>}
    {view && <>
      <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 xl:grid-cols-6">{view.stats.map((stat) => <AnalyticsStatCard key={stat.id} stat={stat} />)}</div>
      {!view.source.summary.posts && !view.source.summary.followers && !view.source.summary.totalInteractions && !view.source.summary.postViews ? <div className="rounded-panel border border-dashed border-border-soft p-8 text-center"><strong>No analytics data yet.</strong><p className="mt-2 text-xs text-text-muted">Publish or schedule your first post to start tracking performance.</p><div className="mt-4 flex justify-center gap-2"><Link className="rounded-xl bg-brand-teal px-4 py-2 text-xs font-semibold text-white" to="/posts">Create New Post</Link><Link className="rounded-xl border border-border-soft px-4 py-2 text-xs" to="/content-calendar">Open Content Calendar</Link></div></div> : <>
      {view.lowData && <div className="rounded-xl border border-brand-amber/20 bg-brand-amber/8 px-4 py-3 text-[11px] text-brand-amber">Analytics are just starting. More insight will appear as this Page publishes additional content.</div>}
      {activeTab === 'overview' && <><div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(270px,.72fr)_minmax(300px,.82fr)]"><PerformanceOverTimeCard interval={interval} points={chartPoints} setInterval={setInterval} /><EngagementByPlatformCard total={view.totalEngagements} /><TopPerformingPostsCard onViewAll={() => setActiveTab('content_performance')} posts={view.topPosts} /></div><div className="grid items-stretch gap-4 xl:grid-cols-[minmax(280px,.75fr)_minmax(280px,.75fr)_minmax(0,1.5fr)]"><AudienceGrowthCard points={view.performance} total={view.audienceGrowth} /><AudienceDemographicsCard /><BestTimeToPostCard cells={view.heatmap} /></div></>}
      {activeTab === 'content_performance' && <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.75fr)]"><PerformanceOverTimeCard interval={interval} points={chartPoints} setInterval={setInterval} /><TopPerformingPostsCard onViewAll={() => {}} posts={view.topPosts} /></div>}
      {activeTab === 'audience' && <div className="grid gap-4 lg:grid-cols-2"><AudienceGrowthCard points={view.performance} total={view.audienceGrowth} /><AudienceDemographicsCard /></div>}
      {activeTab === 'engagement' && <><div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,.7fr)]"><PerformanceOverTimeCard interval={interval} points={chartPoints} setInterval={setInterval} /><EngagementByPlatformCard total={view.totalEngagements} /></div><BestTimeToPostCard cells={view.heatmap} /></>}
      {activeTab === 'reach' && <PerformanceOverTimeCard interval={interval} points={chartPoints} setInterval={setInterval} />}
      {activeTab === 'videos' && <TopPerformingPostsCard onViewAll={() => {}} posts={view.topPosts.filter((post) => /video/i.test(post.contentType))} />}
      {['stories', 'competitors'].includes(activeTab) && <AnalyticsCard><UnavailableState detail={`${activeTab === 'stories' ? 'Story' : 'Competitor'} analytics are not returned by the currently connected Facebook Page integration. This view will activate when a supported platform supplies verified data.`} title={`${activeTab === 'stories' ? 'Stories' : 'Competitors'} data unavailable`} /></AnalyticsCard>}
      {activeTab === 'reports' && <AnalyticsCard><AnalyticsCardHeader description="Export the selected Page and date range without including credentials or private access tokens." title="Analytics Reports" /><div className="grid min-h-56 place-items-center p-6 text-center"><span><CalendarDays className="mx-auto size-8 text-brand-cyan" /><strong className="mt-3 block">Report ready for {view.source.page.name}</strong><p className="mt-2 text-xs text-text-muted">Data fetched {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(view.source.fetchedAt))}</p><div className="mt-4 inline-block"><ExportReportButton view={view} /></div></span></div></AnalyticsCard>}
      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-soft bg-panel/55 px-4 py-3 text-[10px] text-text-soft"><span>Analytics use your account timezone. Source: live Meta API for {view.source.page.name}.</span><span>Updated {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(view.source.fetchedAt))} {view.source.cache?.hit ? '· cached safely' : ''}</span></footer>
      </>}
    </>}
  </div>
}
