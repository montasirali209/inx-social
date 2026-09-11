import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarCheck2, CheckCircle2, FilePenLine, RefreshCw, Send, UsersRound, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../lib/api-client'
import { deleteCalendarPost, fetchCalendarData, rescheduleCalendarPost } from '../../lib/calendar-api'
import { availableSlotsForDate, buildCalendarDays, formatMonth, monthKeyInTimezone, shiftMonth } from '../../lib/calendar-utils'
import { zonedDateTimeToIso } from '../../lib/bulk-scheduler-utils'
import { fetchFacebookDashboardAnalytics } from '../../lib/dashboard-api'
import { calculateBestPostTime } from '../../lib/posts-analytics'
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

function CalendarSkeleton() {
  return <div aria-label="Loading Content Calendar" className="space-y-4" role="status"><div className="flex gap-3 overflow-hidden md:grid md:grid-cols-3 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div className="h-28 min-w-56 animate-pulse rounded-card bg-panel motion-reduce:animate-none" key={index} />)}</div><div className="h-12 animate-pulse rounded-card bg-panel motion-reduce:animate-none" /><div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]"><div className="h-[680px] animate-pulse rounded-panel bg-panel motion-reduce:animate-none" /><div className="h-[620px] animate-pulse rounded-panel bg-panel motion-reduce:animate-none" /></div></div>
}

export function ContentCalendarPage() {
  const timezone = useUiStore((state) => state.timezone)
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
    queryKey: ['content-calendar', timezone, pageId, monthKey],
    queryFn: () => fetchCalendarData(timezone, pageId, monthKey),
    placeholderData: (previous) => previous,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })
  useEffect(() => {
    const refresh = () => { void calendar.refetch() }
    window.addEventListener('inx-social:refresh', refresh)
    return () => window.removeEventListener('inx-social:refresh', refresh)
  }, [calendar])
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
      setNotice(completedAction === 'delete' ? 'Post deleted from Facebook and INXSocial.' : 'Facebook schedule updated successfully.')
      await calendar.refetch()
    },
    onError: error => setActionError(error instanceof Error ? error.message : 'The calendar action could not be completed.'),
  })

  const visiblePosts = useMemo(() => (calendar.data?.posts || []).filter((post) => {
    if (platform !== 'all' && post.platform !== platform) return false
    if (pageId && post.pageId !== pageId) return false
    if (status !== 'all' && post.status !== status) return false
    if (search && !`${post.title} ${post.pageName}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [calendar.data?.posts, pageId, platform, search, status])
  const monthPosts = useMemo(() => visiblePosts.filter((post) => post.date.startsWith(monthKey)), [monthKey, visiblePosts])
  const days = useMemo(() => buildCalendarDays(monthKey, visiblePosts, selectedDate, todayKey), [monthKey, selectedDate, todayKey, visiblePosts])
  const selectedPosts = useMemo(() => visiblePosts.filter((post) => post.date === selectedDate).sort((left, right) => left.time.localeCompare(right.time)), [selectedDate, visiblePosts])
  const slots = useMemo(() => availableSlotsForDate(calendar.data?.posts || [], selectedDate), [calendar.data?.posts, selectedDate])
  const recommendationPage = useMemo(() => {
    const pages = calendar.data?.pages || []
    const savedAnalyticsPage = window.localStorage.getItem('inx-social-analytics-account-v1') || ''
    const preferredId = pageId || savedAnalyticsPage || selectedPosts[0]?.pageId || ''
    return pages.find((page) => page.id === preferredId) || pages[0] || null
  }, [calendar.data?.pages, pageId, selectedPosts])
  const recommendationAnalytics = useQuery({
    queryKey: ['analytics-workspace', recommendationPage?.id, 90],
    queryFn: () => fetchFacebookDashboardAnalytics(recommendationPage!.id, 90),
    enabled: Boolean(recommendationPage),
    retry: 1,
    staleTime: 10 * 60_000,
  })
  const bestTime = useMemo<BestTimeInsight>(() => {
    if (!recommendationPage) return { available: false, label: 'Choose a destination', time: null, detail: 'Connect or select a Page to calculate its strongest publishing time.' }
    if (recommendationAnalytics.isError) return { available: false, label: 'Analytics unavailable', time: null, detail: `Live timing data for ${recommendationPage.facebookPageName} could not be loaded.` }
    return calculateBestPostTime(recommendationAnalytics.data)
  }, [recommendationAnalytics.data, recommendationAnalytics.isError, recommendationPage])

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

  if (calendar.isPending) return <CalendarSkeleton />
  if (calendar.isError) {
    const sessionRequired = calendar.error instanceof ApiError && calendar.error.status === 401
    return <section className="grid min-h-[60vh] place-items-center"><div className="max-w-lg rounded-panel border border-brand-red/25 bg-panel p-7 text-center shadow-panel"><AlertTriangle className="mx-auto size-8 text-brand-red" /><h1 className="mt-4 text-xl font-semibold">{sessionRequired ? 'Sign in to open Content Calendar' : 'Content Calendar is unavailable'}</h1><p className="mt-2 text-sm text-text-muted">{sessionRequired ? 'Your private INX Social session is required.' : calendar.error.message}</p>{sessionRequired ? <a className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand-blue px-5 text-sm font-semibold" href="/portal/login.html?return=/app/">Open sign in</a> : <button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-3 text-sm font-semibold" onClick={() => calendar.refetch()} type="button"><RefreshCw className="size-4" /> Retry</button>}</div></section>
  }

  return <div className="dashboard-canvas">
    <section aria-label="Calendar status" className="mb-4 flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-3 xl:grid-cols-5">{calendar.data.stats.map((stat, index) => <CalendarStatCard icon={statIcons[index]} key={stat.label} stat={stat} />)}</section>
    <CalendarToolbar isRefreshing={calendar.isFetching} monthKey={monthKey} onNext={() => chooseMonth(1)} onPage={setPageId} onPlatform={setPlatform} onPrevious={() => chooseMonth(-1)} onRefresh={() => void calendar.refetch()} onSearch={setSearch} onStatus={setStatus} onView={setView} pageId={pageId} pages={calendar.data.pages} platform={platform} search={search} status={status} view={view} />
    {calendar.data.syncWarnings.length > 0 && <div className="mb-4 flex items-start gap-2 rounded-xl border border-brand-amber/20 bg-brand-amber/5 px-3 py-2 text-[10px] leading-4 text-text-muted"><AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-brand-amber" /><span>INX Social loaded saved calendar data. {calendar.data.syncWarnings.length} connected Page schedule could not be refreshed from Meta during this request.</span></div>}
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
      {view === 'calendar' ? <CalendarGrid days={days} monthLabel={formatMonth(monthKey)} onSelectDate={chooseDate} onSelectPost={openPost} onToday={chooseToday} /> : <CalendarAgenda onSelectDate={chooseDate} onSelectPost={openPost} posts={monthPosts} />}
      <SelectedDatePanel bestTime={bestTime} bestTimeLoading={recommendationAnalytics.isLoading} busyPostId={calendarAction.isPending ? action?.post.id || null : null} date={selectedDate} onDeletePost={openDelete} onOpenPost={openPost} onReschedulePost={openReschedule} onSelectTime={setSelectedTime} posts={selectedPosts} selectedTime={selectedTime} slots={slots} />
    </div>
    <CalendarPostActionDialog action={action?.type || 'reschedule'} busy={calendarAction.isPending} date={actionDate} error={actionError} onClose={() => { if (!calendarAction.isPending) setAction(null) }} onConfirm={() => calendarAction.mutate()} onDate={setActionDate} onTime={setActionTime} post={action?.post || null} time={actionTime} />
    {notice && <div className="fixed bottom-5 right-5 z-[110] flex max-w-sm items-center gap-3 rounded-xl border border-brand-green/25 bg-[#071923] px-4 py-3 text-xs shadow-2xl"><CheckCircle2 className="size-4 shrink-0 text-brand-green" /><span>{notice}</span><button aria-label="Dismiss" className="ml-1 text-text-soft hover:text-white" onClick={() => setNotice(null)} type="button"><X className="size-3.5" /></button></div>}
  </div>
}
