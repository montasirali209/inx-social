import { ArrowRight, Eye, Files } from 'lucide-react'
import { formatSchedule } from '../../lib/dashboard-format'
import { useUiStore } from '../../store/ui-store'
import type { SocialPost } from '../../types/dashboard'
import { ChartCard } from './ChartCard'
import { PlatformIcon } from './PlatformIcon'
import { PostThumbnail } from './PostThumbnail'
import { StatusBadge } from './StatusBadge'

export function RecentPostsCard({ posts }: { posts: SocialPost[] }) {
  const timezone = useUiStore((state) => state.timezone)
  return (
    <ChartCard
      action={<a className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-cyan transition hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/studio/?view=posts">View All Posts <ArrowRight aria-hidden="true" className="size-3.5" /></a>}
      className="min-h-[350px]"
      title="Recent Posts"
    >
      {posts.length ? (
        <ul className="divide-y divide-border-soft px-4 pb-2">
          {posts.map((post) => <li className="group flex min-w-0 items-center gap-3 py-2.5" key={post.id}>
            <PostThumbnail src={post.thumbnailUrl} title={post.title} />
            <span className="min-w-0 flex-1"><strong className="block truncate text-xs font-medium text-text-main">{post.title}</strong><small className="mt-1 block truncate text-[10px] text-text-soft">{formatSchedule(post.occurredAt, 'full', timezone)}</small></span>
            <span className="hidden items-center gap-1.5 sm:flex">{post.platforms.map((platform) => <PlatformIcon className="size-5" key={platform} platform={platform} />)}</span>
            <StatusBadge compact status={post.status} />
            <span className="hidden min-w-11 items-center justify-end gap-1 text-[10px] text-text-muted xl:flex"><Eye aria-hidden="true" className="size-3" />{post.engagement === null ? '—' : post.engagement.toLocaleString('en-GB')}</span>
          </li>)}
        </ul>
      ) : <div className="grid min-h-[285px] place-items-center px-6 text-center"><span><Files aria-hidden="true" className="mx-auto size-7 text-brand-cyan" /><strong className="mt-3 block text-sm">No posts yet</strong><small className="mt-1 block text-text-muted">Published and scheduled posts will appear here.</small></span></div>}
    </ChartCard>
  )
}
