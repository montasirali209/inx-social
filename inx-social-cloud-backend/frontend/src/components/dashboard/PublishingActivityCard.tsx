import { CalendarDays, Info, LineChart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { activityTotal, publishingActivitySeries } from '../../data/publishingActivityData'
import type { PublishingActivityPoint } from '../../types/dashboard'
import { ActivityInsightRow } from './ActivityInsightRow'
import { ActivitySummaryCard, type ActivitySummary } from './ActivitySummaryCard'
import { PublishingActivityChart } from './PublishingActivityChart'

function comparison(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) return { change: '0%', direction: 'neutral' as const }
    return { change: 'New', direction: 'up' as const }
  }
  const percent = Math.round(((current - previous) / previous) * 100)
  return {
    change: `${percent > 0 ? '+' : ''}${percent}%`,
    direction: percent > 0 ? 'up' as const : percent < 0 ? 'down' as const : 'neutral' as const,
  }
}

function summaries(points: PublishingActivityPoint[], previousPoints: PublishingActivityPoint[]): ActivitySummary[] {
  return publishingActivitySeries.map((series) => {
    const value = activityTotal(points, series.key)
    const previous = activityTotal(previousPoints, series.key)
    return {
      label: series.label,
      value,
      tone: series.key,
      ...comparison(value, previous),
    }
  })
}

function activityDateKey(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function mostActive(points: PublishingActivityPoint[], engagementByDate: Record<string, number>) {
  const hasLiveEngagement = Object.keys(engagementByDate).length > 0
  const point = points.reduce<PublishingActivityPoint | null>((winner, current) => {
    if (!winner) return current
    const currentEngagement = engagementByDate[activityDateKey(current.date)] || 0
    const winnerEngagement = engagementByDate[activityDateKey(winner.date)] || 0
    const currentScore = current.published * 10 + current.scheduled * 3 - current.failed + Math.log10(currentEngagement + 1) * 12
    const winnerScore = winner.published * 10 + winner.scheduled * 3 - winner.failed + Math.log10(winnerEngagement + 1) * 12
    return currentScore > winnerScore ? current : winner
  }, null)
  const liveEngagementTotal = Object.values(engagementByDate).reduce((total, value) => total + value, 0)
  if (!point || activityTotal(points) + liveEngagementTotal === 0) return { date: 'No activity yet', count: 0, engagement: hasLiveEngagement ? 0 : null }
  const pointDate = new Date(point.date)
  return {
    date: new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).format(pointDate),
    count: point.published,
    engagement: hasLiveEngagement ? engagementByDate[activityDateKey(point.date)] || 0 : null,
  }
}

function LoadingState() {
  return (
    <div aria-label="Loading publishing activity" className="space-y-4" role="status">
      <div className="flex gap-3 overflow-hidden md:grid md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => <div className="h-28 min-w-[220px] animate-pulse rounded-2xl bg-white/[.045] motion-reduce:animate-none" key={index} />)}
      </div>
      <div className="h-[280px] animate-pulse rounded-2xl bg-white/[.035] motion-reduce:animate-none" />
    </div>
  )
}

export function PublishingActivityCard({
  points,
  previousPoints,
  rangeDays,
  onRangeChange,
  engagementByDate = {},
  loading = false,
}: {
  points: PublishingActivityPoint[]
  previousPoints: PublishingActivityPoint[]
  rangeDays: number
  onRangeChange: (days: number) => void
  engagementByDate?: Record<string, number>
  loading?: boolean
}) {
  const cards = summaries(points, previousPoints)
  const total = activityTotal(points)
  const active = mostActive(points, engagementByDate)
  const published = cards.find((card) => card.tone === 'published')
  const publishedChange = published?.change || '0%'

  return (
    <section className="relative overflow-hidden rounded-panel border border-teal-300/20 bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,166,.09),transparent_31rem),linear-gradient(145deg,rgba(7,25,35,.98),rgba(5,18,31,.96))] p-4 shadow-[0_28px_75px_rgba(0,0,0,.32),0_0_55px_rgba(20,184,166,.07),inset_0_1px_rgba(255,255,255,.035)] sm:p-5">
      <div className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full border border-teal-300/8 bg-teal-400/[.025] blur-[1px]" />
      <header className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-text-main">Publishing Activity</h2>
            <button aria-label="About publishing activity" className="grid size-7 place-items-center rounded-full text-text-soft transition hover:bg-white/5 hover:text-teal-300 focus-visible:outline-2 focus-visible:outline-brand-cyan" title="Published, scheduled and failed activity for the selected period." type="button">
              <Info aria-hidden="true" className="size-4" />
            </button>
          </div>
          <p className="mt-1.5 text-sm text-text-muted">Track your content performance and publishing status over time.</p>
        </div>
        <label className="relative w-full sm:w-auto">
          <span className="sr-only">Publishing activity date range</span>
          <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-teal-300" />
          <select className="min-h-11 w-full appearance-none rounded-xl border border-teal-300/18 bg-bg/65 py-2 pl-10 pr-10 text-sm font-semibold text-text-main transition hover:border-teal-300/35 focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/20 sm:w-44" onChange={(event) => onRangeChange(Number(event.target.value))} value={rangeDays}>
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
        </label>
      </header>

      <div className="relative mt-5">
        {loading ? <LoadingState /> : (
          <>
            <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible">
              {cards.map((summary) => <ActivitySummaryCard key={summary.tone} summary={summary} />)}
            </div>

            {total === 0 ? (
              <div className="mt-5 grid min-h-72 place-items-center rounded-2xl border border-dashed border-teal-300/18 bg-bg/30 p-6 text-center">
                <div>
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-400/10 text-teal-300"><LineChart aria-hidden="true" className="size-7" /></span>
                  <h3 className="mt-4 text-base font-semibold text-text-main">No publishing activity yet.</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-muted">Create or schedule your first post to start tracking performance.</p>
                  <Link className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-blue to-[#0f8f7f] px-5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(20,184,166,.18)] transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan motion-reduce:transform-none motion-reduce:transition-none" to="/content-calendar"><CalendarDays aria-hidden="true" className="size-4" /> Open Calendar</Link>
                </div>
              </div>
            ) : (
              <>
                {total < 5 ? <p className="mt-4 rounded-xl border border-amber-300/15 bg-amber-400/8 px-4 py-3 text-xs leading-5 text-amber-100">Publishing activity is just starting. Schedule more content to unlock better trend insights.</p> : null}
                <div className="mt-3 rounded-2xl border border-white/[.035] bg-bg/18 px-1 py-3 sm:px-3">
                  <PublishingActivityChart points={points} />
                </div>
                <div className="mt-4">
                  <ActivityInsightRow mostActiveCount={active.count} mostActiveDate={active.date} mostActiveEngagement={active.engagement} publishedChange={publishedChange} />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}
