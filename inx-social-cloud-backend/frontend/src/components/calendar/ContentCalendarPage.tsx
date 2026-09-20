import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarCheck2, CheckCircle2, FilePenLine, RefreshCw, Send, UsersRound, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../lib/api-client'
import { fetchAnalyticsForSource, fetchAnalyticsSources } from '../../lib/analytics-api'
import { deleteCalendarPost, fetchCalendarData, mergeCalendarFeedData, rescheduleCalendarPost, type CalendarFeedEntry } from '../../lib/calendar-api'
import { availableSlotsForDate, buildCalendarDays, formatMonth, monthKeyInTimezone, shiftMonth } from '../../lib/calendar-utils'
import { zonedDateTimeToIso } from '../../lib/bulk-scheduler-utils'
import { calculateBestPostTime } from '../../lib/posts-analytics'
import { readSessionCache, writeSessionCache } from '../../lib/session-cache'
import { useUiStore } from '../../store/ui-store'
import type { CalendarPost, CalendarPostStatus } from '../../types/calendar'
import type { Platform } from '../../types/dashboard'
import type { BestTimeInsight } from '../../types/posts'
import { CalendarAgenda } from './CalendarAgenda'
import { CalendarGrid } from './CalendarGrid'
import { CalendarStatCard } from './CalendarStatCard'
import { CalendarToolbar, type CalendarView } from './CalendarToolbar'
import { CalendarPostActionDialog } from './CalendarPostActionDialog'
import { SelectedDatePanel } from './SelectedDatePanel'

const statIcons = [CalendarCheck2, Send, FilePenLine, AlertTriangle, UsersRound]
const calendarSourcesCacheKey = 'inx-social-cache:calendar-sources-v1'

function calendarCacheKey(timezone: string) {
  return `inx-social-cache:calendar:${encodeURIComponent(timezone)}`
}

function calendarFeedCacheKey(accountKey: string) {
  return `inx-social-cache:calendar-feed:${encodeURIComponent(accountKey)}:90`
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

function CalendarSkeleton() {
  const stats = [
    ['🗓️', 'Scheduled This Week'],
    ['🚀', 'Published This Month'],
    ['📝', 'Drafts'],
    ['⚠️', 'Needs Review'],
    ['🔗', 'Connected Accounts'],
  ] as const
  return <div aria-label="Loading Content Calendar" className="space-y-4" role="status">
    <div className="flex gap-3 overflow-hidden md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{stats.map(([emoji, label], index) => <div className="min-h-28 min-w-56 rounded-card border border-border-soft bg-panel/70 p-4 md:min-w-0" key={label}><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl border border-white/[.07] bg-white/[.025] text-lg motion-safe:animate-bounce" style={{ animationDelay: `${index * 80}ms` }}>{emoji}</span><span><small className="block text-[10px] text-text-muted">{label}</small><strong className="mt-1 block text-sm">Updating…</strong></span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border-soft"><span className="block h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-brand-teal/60 to-brand-cyan motion-reduce:animate-none" /></div></div>)}</div>
    <div className="h-12 rounded-card border border-border-soft bg-panel/70 p-3"><div className="h-full animate-pulse rounded-lg bg-white/[.025] motion-reduce:animate-none" /></div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]"><div className="min-h-[620px] rounded-panel border border-border-soft bg-panel/70 p-5"><div className="flex items-center justify-between"><strong className="text-sm">Content Calendar</strong><span className="text-2xl motion-safe:animate-pulse">📅</span></div><div className="mt-8 grid min-h-[500px] place-items-center rounded-xl border border-dashed border-border-soft bg-bg/20"><span className="text-center"><span className="block text-3xl motion-safe:animate-bounce">⏳</span><small className="mt-2 block text-[10px] text-text-soft">Loading your publishing schedule</small></span></div></div><div className="min-h-[420px] rounded-panel border border-border-soft bg-panel/70 p-4"><strong className="text-sm">Selected Date</strong><div className="mt-4 space-y-3">{Array.from({ length: 4 }, (_, index) => <div className="h-16 animate-pulse rounded-xl bg-white/[.025] motion-reduce:animate-none" key={index} />)}</div></div></div>
  </div>
}

export function ContentCalendarPage() {
  const timezone = useUiStore(state => state.timezone)
  const todayKey = useMemo(() => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone }).format(new Date()), [timezone])
  const [monthKey, setMonthKey] = useState(() => monthKeyInTimezone(new Date(), timezone))
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [selectedTime, setSelectedTime] = useState('')
  const [platform, setPlatform] = useState<Platform | 'all'>('all')
  const [pageId, setPageId] = useState('')
  const [status, setStatus] = useState<CalendarPostStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<CalendarView>(() => window.matchMedia('(max-width: 767px)').matches ? 'list' : 'calendar')
  const [action, setAction] = useState<{ type: 'reschedule' | 'delete'; post: CalendarPost } | null>(null)
  const [actionDate, setActionDate] = useState('')
  const [actionTime, setActionTime] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const calendar = useQuery({
    queryKey: ['content-calendar', 'publishing-queue', timezone],
    queryFn: async () => {
      const result = await fetchCalendarData(timezone)
      writeSessionCache(calendarCacheKey(timezone), result)
      return result
    },
    initialData: () => readSessionCache<Awaited<ReturnType<typeof fetchCalendarData>>>(calendarCacheKey(timezone)),
    initialDataUpdatedAt: 0,
    placeholderData: previous => previous,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    staleTime: 20_000,
  })
  const analyticsSources = useQuery({
    queryKey: ['calendar-analytics-sources', 'post-for-me'],
    queryFn: async () => {
      const result = await fetchAnalyticsSources()
      writeSessionCache(calendarSourcesCacheKey, result)
      return result
    },
    initialData: () => readSessionCache<Awaited<ReturnType<typeof fetchAnalyticsSources>>>(calendarSourcesCacheKey),
    initialDataUpdatedAt: 0,
    placeholderData: previous => previous,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
  const feedAccounts = useMemo(() => analyticsSources.data?.accounts || [], [analyticsSources.data?.accounts])
  const feedAccountKey = feedAccounts.map(account => account.analyticsKey).sort().join('|')
  const accountFeed = useQuery<{ entries: CalendarFeedEntry[]; failures: string[] }>({
    queryKey: ['calendar-account-feed', feedAccountKey, 90],
    enabled: feedAccounts.length > 0,
    initialData: () => feedAccountKey ? readSessionCache<{ entries: CalendarFeedEntry[]; failures: string[] }>(calendarFeedCacheKey(feedAccountKey)) : undefined,
    initialDataUpdatedAt: 0,
    placeholderData: previous => previous,
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      const rows = await mapWithConcurrency(feedAccounts, 3, async account => {
        try {
          return { ok: true as const, entry: { account, analytics: await fetchAnalyticsForSource(account, 90) } satisfies CalendarFeedEntry }
        } catch (error) {
          return { ok: false as const, failure: `${account.displayName}: ${error instanceof Error ? error.message : 'Could not refresh account history.'}` }
        }
      })
      const result = {
        entries: rows.flatMap(row => row.ok ? [row.entry] : []),
        failures: rows.flatMap(row => row.ok ? [] : [row.failure]),
      }
      writeSessionCache(calendarFeedCacheKey(feedAccountKey), result)
      return result
    },
  })
  useEffect(() => {
    const refresh = () => { void Promise.all([calendar.refetch(), analyticsSources.refetch(), accountFeed.refetch()]) }
    window.addEventListener('inx-social:refresh', refresh)
    return () => window.removeEventListener('inx-social:refresh', refresh)
  }, [accountFeed, analyticsSources, calendar])
  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 4500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const calendarAction = useMutation({
    mutationFn: async () => {
      if (!action) throw new Error('Choose scheduled content first.')
      if (action.type === 'delete') return deleteCalendarPost(action.post)
      return rescheduleCalendarPost(action.post, zonedDateTimeToIso(actionDate, actionTime, timezone))
    },
    onSuccess: async () => {
      const completedAction = action?.type
      setAction(null)
      setActionError(null)
      setNotice(completedAction === 'delete' ? 'Post removed from the schedule.' : 'Schedule updated successfully.')
      await calendar.refetch()
    },
    onError: error => setActionError(error instanceof Error ? error.message : 'The calendar action could not be completed.'),
  })

  const calendarData = useMemo(() => calendar.data
    ? mergeCalendarFeedData(calendar.data, accountFeed.data?.entries || [], timezone, new Date())
    : null, [accountFeed.data?.entries, calendar.data, timezone])
  const visiblePosts = useMemo(() => (calendarData?.posts || []).filter(post => {
    if (platform !== 'all' && post.platform !== platform) return false
    if (pageId && post.pageId !== pageId) return false
    if (status !== 'all' && post.status !== status) return false
    if (search && !`${post.title} ${post.pageName}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [calendarData?.posts, pageId, platform, search, status])
  const monthPosts = useMemo(() => visiblePosts.filter(post => post.date.startsWith(monthKey)), [monthKey, visiblePosts])
  const days = useMemo(() => buildCalendarDays(monthKey, visiblePosts, selectedDate, todayKey), [monthKey, selectedDate, todayKey, visiblePosts])
  const selectedPosts = useMemo(() => visiblePosts.filter(post => post.date === selectedDate).sort((left, right) => left.time.localeCompare(right.time)), [selectedDate, visiblePosts])
  const slots = useMemo(() => availableSlotsForDate(calendarData?.posts || [], selectedDate), [calendarData?.posts, selectedDate])
  const recommendationAccount = useMemo(() => {
    const accounts = feedAccounts
    const preferredId = pageId || selectedPosts[0]?.pageId || ''
    return accounts.find(account => account.id === preferredId) || accounts[0] || null
  }, [feedAccounts, pageId, selectedPosts])
  const recommendationAnalytics = recommendationAccount
    ? accountFeed.data?.entries.find(entry => entry.account.analyticsKey === recommendationAccount.analyticsKey)?.analytics
    : undefined
  const recommendationFailed = Boolean(recommendationAccount && accountFeed.data?.failures.some(failure => failure.startsWith(`${recommendationAccount.displayName}:`)))
  const bestTime = useMemo<BestTimeInsight>(() => {
    if (!recommendationAccount) return { available: false, label: 'Choose a destination', time: null, detail: 'Connect or select an account to calculate its strongest publishing time.' }
    if (recommendationFailed) return { available: false, label: 'Analytics unavailable', time: null, detail: `Timing data for ${recommendationAccount.displayName} could not be loaded.` }
    return calculateBestPostTime(recommendationAnalytics)
  }, [recommendationAccount, recommendationAnalytics, recommendationFailed])
  const calendarStats = calendarData?.stats || []

  const chooseDate = (date: string) => { setSelectedDate(date); setSelectedTime('') }
  const chooseMonth = (offset: number) => { const next = shiftMonth(monthKey, offset); setMonthKey(next); chooseDate(`${next}-01`) }
  const chooseToday = () => { const current = monthKeyInTimezone(new Date(), timezone); setMonthKey(current); chooseDate(todayKey) }
  const openPost = (post: CalendarPost) => {
    chooseDate(post.date)
    if (post.platformUrl) window.open(post.platformUrl, '_blank', 'noopener,noreferrer')
  }
  const openReschedule = (post: CalendarPost) => {
    setAction({ type: 'reschedule', post })
    setActionDate(post.date)
    setActionTime(post.time)
    setActionError(null)
  }
  const openDelete = (post: CalendarPost) => {
    setAction({ type: 'delete', post })
    setActionDate('')
    setActionTime('')
    setActionError(null)
  }

  if (calendar.isPending || (feedAccounts.length > 0 && accountFeed.isPending && !accountFeed.data)) return <CalendarSkeleton />
  if (calendar.isError) {
    const currentError = calendar.error
    const sessionRequired = currentError instanceof ApiError && currentError.status === 401
    return <section className="grid min-h-[60vh] place-items-center"><div className="max-w-lg rounded-panel border border-brand-red/25 bg-panel p-7 text-center shadow-panel"><AlertTriangle className="mx-auto size-8 text-brand-red" /><h1 className="mt-4 text-xl font-semibold">{sessionRequired ? 'Sign in to open Content Calendar' : 'Content Calendar is unavailable'}</h1><p className="mt-2 text-sm text-text-muted">{sessionRequired ? 'Your private INX Social session is required.' : currentError?.message}</p>{sessionRequired ? <a className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand-blue px-5 text-sm font-semibold" href="/portal/login.html?return=/app/">Open sign in</a> : <button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-3 text-sm font-semibold" onClick={() => void calendar.refetch()} type="button"><RefreshCw className="size-4" /> Retry</button>}</div></section>
  }

  return <div className="dashboard-canvas">
    <section aria-label="Calendar publishing status" className="mb-4 flex items-start gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-3 xl:grid-cols-5">{calendarStats.map((stat, index) => <CalendarStatCard icon={statIcons[index]} key={stat.label} stat={stat} />)}</section>
    <CalendarToolbar destinations={calendarData?.destinations || []} monthKey={monthKey} onNext={() => chooseMonth(1)} onPage={setPageId} onPlatform={setPlatform} onPrevious={() => chooseMonth(-1)} onSearch={setSearch} onStatus={setStatus} onView={setView} pageId={pageId} platform={platform} search={search} status={status} view={view} />
    {((calendarData?.syncWarnings.length || 0) > 0 || (accountFeed.data?.failures.length || 0) > 0) && <div className="mb-4 flex items-start gap-2 rounded-xl border border-brand-amber/20 bg-brand-amber/5 px-3 py-2 text-[10px] leading-4 text-text-muted"><AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-brand-amber" /><span>Some connected-account history could not refresh. Available calendar content is still shown.</span></div>}
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
      {view === 'calendar' ? <CalendarGrid days={days} monthLabel={formatMonth(monthKey)} onNextMonth={() => chooseMonth(1)} onPreviousMonth={() => chooseMonth(-1)} onSelectDate={chooseDate} onSelectPost={openPost} onToday={chooseToday} /> : <CalendarAgenda onSelectDate={chooseDate} onSelectPost={openPost} posts={monthPosts} />}
      <SelectedDatePanel bestTime={bestTime} bestTimeLoading={accountFeed.isFetching && !recommendationAnalytics} busyPostId={calendarAction.isPending ? action?.post.id || null : null} canSchedule={selectedDate >= todayKey} date={selectedDate} onDeletePost={openDelete} onOpenPost={openPost} onReschedulePost={openReschedule} onSelectTime={setSelectedTime} posts={selectedPosts} selectedTime={selectedTime} slots={slots} />
    </div>
    <CalendarPostActionDialog action={action?.type || 'reschedule'} busy={calendarAction.isPending} date={actionDate} error={actionError} onClose={() => { if (!calendarAction.isPending) setAction(null) }} onConfirm={() => calendarAction.mutate()} onDate={setActionDate} onTime={setActionTime} post={action?.post || null} time={actionTime} />
    {notice && <div className="fixed bottom-5 right-5 z-[110] flex max-w-sm items-center gap-3 rounded-xl border border-brand-green/25 bg-[#071923] px-4 py-3 text-xs shadow-2xl"><CheckCircle2 className="size-4 shrink-0 text-brand-green" /><span>{notice}</span><button aria-label="Dismiss" className="ml-1 text-text-soft hover:text-white" onClick={() => setNotice(null)} type="button"><X className="size-3.5" /></button></div>}
  </div>
}
