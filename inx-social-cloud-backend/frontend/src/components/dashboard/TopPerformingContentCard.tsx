import { Heart, MessageCircle, Share2, Trophy } from 'lucide-react'
import type { TopContentItem } from '../../types/dashboard'
import { ChartCard } from './ChartCard'
import { PlatformIcon } from './PlatformIcon'
import { PostThumbnail } from './PostThumbnail'

function metricLabel(value: number) {
  return new Intl.NumberFormat('en-GB', { notation: value >= 1_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value)
}

export function TopPerformingContentCard({ items }: { items: TopContentItem[] }) {
  const rankedItems = items.filter((item) => item.engagement !== null)
  return (
    <ChartCard
      action={<a aria-label="Open detailed Analytics" className="rounded-lg border border-border-soft px-2 py-1 text-[9px] text-text-muted transition hover:border-brand-cyan/45 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/app/analytics">Last 30 days</a>}
      className="min-h-[215px]"
      title="Top Performing Content"
    >
      {rankedItems.length ? <ol className="divide-y divide-border-soft px-3 pb-1">
        {rankedItems.map((item, index) => <li className="flex min-w-0 items-center gap-2 py-2" key={item.id}>
          <span className="w-4 shrink-0 text-center text-[10px] font-semibold text-text-soft">{index + 1}</span>
          <PostThumbnail className="size-9" src={item.thumbnailUrl} title={item.title} />
          <span className="min-w-0 flex-1"><strong className="block truncate text-[11px] font-medium">{item.title}</strong><small className="mt-0.5 flex items-center gap-1.5 truncate text-[9px] text-text-soft"><PlatformIcon className="size-4" platform={item.platform} />{item.sourceName || 'Connected account'}</small></span>
          {item.metrics ? <span className="hidden shrink-0 items-center gap-2 xl:flex" aria-label={`${item.metrics.interactions.toLocaleString('en-GB')} total interactions`} title={`Total interactions: ${item.metrics.interactions.toLocaleString('en-GB')}`}>
            <span className="inline-flex items-center gap-1 text-[9px] text-rose-300"><Heart aria-hidden="true" className="size-3" />{metricLabel(item.metrics.likes)}</span>
            <span className="inline-flex items-center gap-1 text-[9px] text-text-muted"><MessageCircle aria-hidden="true" className="size-3" />{metricLabel(item.metrics.comments)}</span>
            <span className="inline-flex items-center gap-1 text-[9px] text-text-muted"><Share2 aria-hidden="true" className="size-3" />{metricLabel(item.metrics.shares)}</span>
          </span> : <span className="text-[10px] font-semibold text-brand-cyan" title="Total interactions">{metricLabel(item.engagement || 0)} interactions</span>}
        </li>)}
      </ol> : <div className="grid min-h-[165px] place-items-center px-6 text-center"><span><Trophy aria-hidden="true" className="mx-auto size-6 text-brand-cyan" /><strong className="mt-2 block text-sm">Performance ranking is waiting</strong><small className="mt-1 block max-w-xs leading-5 text-text-muted">Live likes, comments and shares from connected accounts will rank content here.</small></span></div>}
    </ChartCard>
  )
}
