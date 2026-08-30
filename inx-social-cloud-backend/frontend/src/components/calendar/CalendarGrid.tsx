import { CalendarDays } from 'lucide-react'
import { calendarWeekdays } from '../../data/calendarData'
import type { CalendarDay, CalendarPost } from '../../types/calendar'
import { CalendarDayCell } from './CalendarDayCell'

export function CalendarGrid({ days, monthLabel, onSelectDate, onSelectPost, onToday }: { days: CalendarDay[]; monthLabel: string; onSelectDate: (date: string) => void; onSelectPost: (post: CalendarPost) => void; onToday: () => void }) {
  const hasPosts = days.some((day) => day.posts.length)
  return (
    <section className="interactive-surface min-w-0 overflow-hidden rounded-panel border">
      <header className="flex items-center justify-between border-b border-border-soft px-4 py-3"><h2 className="text-base font-semibold">{monthLabel}</h2><button className="min-h-9 rounded-lg border border-border-soft bg-black/15 px-3 text-xs font-semibold transition hover:border-brand-cyan/40 focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={onToday} type="button">Today</button></header>
      <div className="grid grid-cols-7 border-b border-border-soft bg-black/12">{calendarWeekdays.map((day) => <span className="py-2 text-center text-[10px] font-semibold text-text-muted" key={day}>{day}</span>)}</div>
      <div className="relative grid grid-cols-7 overflow-hidden">
        {days.map((day) => <CalendarDayCell day={day} key={day.date} onSelectDate={onSelectDate} onSelectPost={onSelectPost} />)}
        {!hasPosts && <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center"><span className="rounded-xl border border-border-soft bg-bg/90 px-5 py-3 text-center shadow-panel backdrop-blur"><CalendarDays aria-hidden="true" className="mx-auto size-5 text-brand-cyan" /><strong className="mt-2 block text-xs">No content in this month</strong><small className="mt-1 block text-[10px] text-text-muted">Empty dates remain available for scheduling.</small></span></div>}
      </div>
    </section>
  )
}
