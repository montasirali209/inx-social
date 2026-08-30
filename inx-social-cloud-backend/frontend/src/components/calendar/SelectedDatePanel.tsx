import { CalendarClock } from 'lucide-react'
import { formatDateKey } from '../../lib/calendar-utils'
import type { AvailableSlot, CalendarPost } from '../../types/calendar'
import { AvailableSlotsCard } from './AvailableSlotsCard'
import { BestTimeCard } from './BestTimeCard'
import { CalendarQuickActionsCard } from './CalendarQuickActionsCard'
import { ScheduledVideoCard } from './ScheduledVideoCard'

export function SelectedDatePanel({ date, posts, slots, selectedTime, onSelectTime }: { date: string; posts: CalendarPost[]; slots: AvailableSlot[]; selectedTime: string; onSelectTime: (time: string) => void }) {
  return <aside className="grid min-w-0 content-start gap-3 xl:sticky xl:top-[94px]">
    <section className="interactive-surface overflow-hidden rounded-panel border">
      <header className="border-b border-border-soft bg-gradient-to-br from-brand-cyan/[0.07] to-transparent p-4"><small className="text-[10px] font-semibold text-text-muted">Selected Date</small><h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">{formatDateKey(date)}</h2><p className="mt-1 text-xs text-text-muted">{formatDateKey(date, { weekday: 'long' })}</p><span className="mt-2 inline-flex rounded-full border border-brand-cyan/20 bg-brand-cyan/8 px-2.5 py-1 text-[10px] font-semibold text-brand-cyan">{posts.length} post{posts.length === 1 ? '' : 's'} retained</span></header>
      <div className="p-3.5"><h3 className="mb-2.5 text-xs font-semibold">Scheduled Content</h3>{posts.length ? <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 scrollbar-thin">{posts.map((post) => <ScheduledVideoCard key={post.id} post={post} />)}</div> : <div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-border-soft bg-black/10 p-4 text-center"><span><CalendarClock aria-hidden="true" className="mx-auto size-5 text-brand-cyan" /><strong className="mt-2 block text-xs">This date is available</strong><small className="mt-1 block text-[10px] text-text-muted">Choose a time slot to prepare new content.</small></span></div>}</div>
    </section>
    <BestTimeCard />
    <AvailableSlotsCard onSelect={onSelectTime} selectedTime={selectedTime} slots={slots} />
    <CalendarQuickActionsCard date={date} time={selectedTime} />
  </aside>
}
