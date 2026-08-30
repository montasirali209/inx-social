import { CalendarDays } from 'lucide-react'
import { formatDateKey } from '../../lib/calendar-utils'
import type { CalendarPost } from '../../types/calendar'
import { CalendarPostCard } from './CalendarPostCard'

export function CalendarAgenda({ posts, onSelectDate, onSelectPost }: { posts: CalendarPost[]; onSelectDate: (date: string) => void; onSelectPost: (post: CalendarPost) => void }) {
  const grouped = [...posts].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt)).reduce((result, post) => {
    const items = result.get(post.date) || []
    items.push(post)
    result.set(post.date, items)
    return result
  }, new Map<string, CalendarPost[]>())
  if (!posts.length) return <section className="interactive-surface grid min-h-72 place-items-center rounded-panel border p-6 text-center"><span><CalendarDays aria-hidden="true" className="mx-auto size-8 text-brand-cyan" /><strong className="mt-3 block">No content matches this view</strong><small className="mt-1 text-text-muted">Change a filter or schedule new content.</small></span></section>
  return <section className="interactive-surface overflow-hidden rounded-panel border"><div className="divide-y divide-border-soft">{[...grouped.entries()].map(([date, items]) => <article className="grid gap-3 p-4 sm:grid-cols-[150px_1fr]" key={date}><button className="self-start text-left focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={() => onSelectDate(date)} type="button"><strong className="block text-sm">{formatDateKey(date, { weekday: 'short', day: 'numeric', month: 'short' })}</strong><small className="text-text-muted">{items.length} item{items.length === 1 ? '' : 's'}</small></button><div className="grid gap-2">{items.map((post) => <CalendarPostCard key={post.id} onSelect={onSelectPost} post={post} />)}</div></article>)}</div></section>
}
