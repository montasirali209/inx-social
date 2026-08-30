import type { CalendarDay, CalendarPost } from '../../types/calendar'
import { CalendarPostCard } from './CalendarPostCard'

export function CalendarDayCell({ day, onSelectDate, onSelectPost }: { day: CalendarDay; onSelectDate: (date: string) => void; onSelectPost: (post: CalendarPost) => void }) {
  const shown = day.posts.slice(0, 3)
  return (
    <article className={`min-h-[126px] min-w-0 border-b border-r border-border-soft p-2 transition sm:min-h-[145px] ${day.isCurrentMonth ? 'bg-panel/30' : 'bg-black/12 opacity-55'} ${day.isSelected ? 'relative z-[1] bg-brand-cyan/[0.055] shadow-[inset_0_0_0_1px_#2dd4bf,0_0_24px_rgba(45,212,191,.12)]' : 'hover:bg-panel-hover/25'}`}>
      <button aria-label={`Select ${day.date}`} className={`grid size-7 place-items-center rounded-full text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-brand-cyan ${day.isSelected ? 'bg-brand-cyan text-[#03111e]' : day.isToday ? 'border border-brand-cyan text-brand-cyan' : 'text-text-muted hover:bg-white/5 hover:text-white'}`} onClick={() => onSelectDate(day.date)} type="button">{Number(day.date.slice(-2))}</button>
      <div className="mt-1.5 grid gap-1">
        {shown.map((post) => <CalendarPostCard compact key={post.id} onSelect={onSelectPost} post={post} />)}
        {day.posts.length > shown.length && <button className="px-1 text-left text-[9px] font-semibold text-brand-cyan hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={() => onSelectDate(day.date)} type="button">+{day.posts.length - shown.length} more</button>}
      </div>
    </article>
  )
}
