import { ArrowUpRight, Trophy } from 'lucide-react'
import { formatAnalyticsValue } from '../../data/analyticsData'
import type { TopPost } from '../../types/analytics'
import type { PlatformAnalytics } from '../../types/dashboard'
import { PlatformIcon } from '../dashboard/PlatformIcon'
import { PostThumbnail } from '../dashboard/PostThumbnail'
import { AnalyticsCard, AnalyticsCardHeader, UnavailableState } from './AnalyticsPrimitives'

export function TopPerformingPostsCard({ posts, onViewAll, platform }: { posts: TopPost[]; onViewAll: () => void; platform: PlatformAnalytics['platform'] }) {
  return (
    <AnalyticsCard>
      <AnalyticsCardHeader
        action={<button className="rounded-lg border border-border-soft bg-bg/30 px-2.5 py-1.5 text-[10px] font-semibold text-brand-cyan transition hover:border-brand-teal/30 hover:bg-brand-teal/8 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={onViewAll} type="button">View all</button>}
        description="Ranked using live reactions, comments, shares and available post clicks."
        title="Top Performing Posts"
      />
      {posts.length ? (
        <div className="space-y-2 px-4 pb-4 sm:px-5">
          {posts.slice(0, 5).map((post, index) => {
            const row = (
              <>
                <span className={`grid size-7 shrink-0 place-items-center rounded-lg border text-[10px] font-bold ${index === 0 ? 'border-brand-amber/30 bg-brand-amber/10 text-brand-amber' : 'border-border-soft bg-panel/60 text-text-soft'}`}>{index === 0 ? <Trophy aria-hidden="true" className="size-3.5" /> : index + 1}</span>
                <PostThumbnail className="size-12 rounded-xl" src={post.thumbnailUrl} title={post.title} />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-xs font-semibold text-text-main">{post.title}</strong>
                  <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-text-soft">
                    <span>{post.date ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(post.date)) : 'Date unavailable'}</span>
                    <span aria-hidden="true" className="size-1 rounded-full bg-border-strong" />
                    <span className="capitalize">{post.contentType || 'Post'}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2.5">
                  <PlatformIcon className="size-7 rounded-lg" platform={platform} />
                  <span className="min-w-[78px] rounded-lg border border-border-soft bg-panel/55 px-2.5 py-1.5 text-right shadow-[inset_0_1px_0_rgba(255,255,255,.02)]">
                    <strong className="block text-sm leading-4 text-text-main">{formatAnalyticsValue(post.engagements, 'compact')}</strong>
                    <small className="text-[8px] uppercase tracking-[.08em] text-text-muted">Interactions</small>
                  </span>
                  {post.permalinkUrl ? <ArrowUpRight aria-hidden="true" className="size-3.5 text-text-soft transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-cyan" /> : null}
                </span>
              </>
            )
            const className = "group grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border-soft bg-[linear-gradient(145deg,rgba(8,29,40,.72),rgba(4,18,27,.58))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.018)] transition-[transform,border-color,background-color,box-shadow] duration-150 hover:scale-[1.003] hover:border-brand-teal/22 hover:bg-panel/65 hover:shadow-[0_8px_22px_rgba(0,0,0,.14),inset_0_1px_0_rgba(255,255,255,.025)] focus-visible:outline-2 focus-visible:outline-brand-cyan motion-reduce:transform-none"
            return post.permalinkUrl ? <a className={className} href={post.permalinkUrl} key={post.id} rel="noreferrer" target="_blank">{row}</a> : <div className={className} key={post.id}>{row}</div>
          })}
        </div>
      ) : <UnavailableState detail="Published content will appear here after the selected platform returns posts for this period." title="No published posts in this period" />}
    </AnalyticsCard>
  )
}
