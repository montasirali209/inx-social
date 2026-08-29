import { ArrowUpRight, Trophy } from 'lucide-react'
import type { TopContentItem } from '../../types/dashboard'
import { ChartCard } from './ChartCard'
import { PostThumbnail } from './PostThumbnail'

export function TopPerformingContentCard({ items }: { items: TopContentItem[] }) {
  const rankedItems = items.filter((item) => item.engagement !== null)
  return (
    <ChartCard
      action={<a aria-label="Open Analytics" className="rounded-lg border border-border-soft px-2.5 py-1.5 text-[10px] text-text-muted transition hover:border-brand-cyan/45 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/studio/?view=analytics">Last 7 Days</a>}
      className="min-h-[290px]"
      title="Top Performing Content"
    >
      {rankedItems.length ? <ol className="divide-y divide-border-soft px-4 pb-2">
        {rankedItems.map((item, index) => <li className="flex items-center gap-3 py-2" key={item.id}><span className="w-4 text-center text-[10px] font-semibold text-text-soft">{index + 1}</span><PostThumbnail className="size-10" src={item.thumbnailUrl} title={item.title} /><strong className="min-w-0 flex-1 truncate text-xs font-medium">{item.title}</strong><span className="text-xs font-semibold text-brand-cyan">{item.engagement?.toLocaleString('en-GB')}</span></li>)}
      </ol> : <div className="grid min-h-[225px] place-items-center px-6 text-center"><span><Trophy aria-hidden="true" className="mx-auto size-7 text-brand-cyan" /><strong className="mt-3 block text-sm">Performance ranking is waiting</strong><small className="mt-1 block max-w-xs leading-5 text-text-muted">Published content will be ranked when live engagement is available.</small><a className="mt-3 inline-flex items-center gap-1 text-xs text-brand-cyan" href="/studio/?view=analytics">Open Analytics <ArrowUpRight aria-hidden="true" className="size-3" /></a></span></div>}
    </ChartCard>
  )
}
