import { Files, Heart, MessageCircle, Share2 } from 'lucide-react'
import { formatSchedule } from '../../lib/dashboard-format'
import { useUiStore } from '../../store/ui-store'
import type { SocialPost } from '../../types/dashboard'
import { ChartCard } from './ChartCard'
import { PlatformIcon } from './PlatformIcon'
import { PostThumbnail } from './PostThumbnail'
import { StatusBadge } from './StatusBadge'

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Heart }) {
  return <span aria-label={`${value.toLocaleString('en-GB')} ${label}`} className="inline-flex items-center gap-1 text-[10px] text-text-muted" title={`${label}: ${value.toLocaleString('en-GB')}`}><Icon aria-hidden="true" className="size-3" />{value.toLocaleString('en-GB')}</span>
}

export function RecentPostsCard({ posts }: { posts: SocialPost[] }) {
  const timezone = useUiStore((state) => state.timezone)
  return (
    <ChartCard className="min-h-[215px]" title="Recent Posts">
      {posts.length ? (
        <ul className="divide-y divide-border-soft px-3 pb-1">
          {posts.map((post) => <li className="group flex min-w-0 items-center gap-2.5 py-2" key={post.id}>
            <PostThumbnail className="size-9" src={post.thumbnailUrl} title={post.title} />
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5"><PlatformIcon className="size-[18px]" platform={post.platforms[0]} /><strong className="block min-w-0 flex-1 truncate text-[11px] font-medium text-text-main">{post.title}</strong></span>
              <small className="mt-0.5 block truncate text-[9px] text-text-soft">{post.sourceName ? `${post.sourceName} · ` : ''}{formatSchedule(post.occurredAt, 'full', timezone)}</small>
            </span>
            <StatusBadge compact status={post.status} />
            {post.metrics ? <span className="hidden shrink-0 items-center gap-2.5 2xl:flex"><Metric icon={Heart} label="likes / reactions" value={post.metrics.likes} /><Metric icon={MessageCircle} label="comments" value={post.metrics.comments} /><Metric icon={Share2} label="shares" value={post.metrics.shares} /></span> : null}
          </li>)}
        </ul>
      ) : <div className="grid min-h-[165px] place-items-center px-6 text-center"><span><Files aria-hidden="true" className="mx-auto size-6 text-brand-cyan" /><strong className="mt-2 block text-sm">No publishing activity yet.</strong><small className="mt-1 block text-text-muted">Create or schedule your first post to start building your workspace.</small><a className="mt-3 inline-flex text-xs font-semibold text-brand-cyan focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/app/posts">Create New Post</a></span></div>}
    </ChartCard>
  )
}
