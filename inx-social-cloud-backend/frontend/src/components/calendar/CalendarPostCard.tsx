import type { CalendarPost } from '../../types/calendar'
import type { VideoStatus } from '../../types/dashboard'
import { PlatformIcon } from '../dashboard/PlatformIcon'
import { StatusBadge } from '../dashboard/StatusBadge'

const statusMap: Record<CalendarPost['status'], VideoStatus> = {
  scheduled: 'scheduled',
  published: 'published',
  draft: 'ready',
  needs_review: 'pending_review',
  failed: 'failed',
}

export function CalendarPostCard({ post, compact = false, onSelect }: { post: CalendarPost; compact?: boolean; onSelect?: (post: CalendarPost) => void }) {
  return (
    <button className={`group/post flex w-full min-w-0 items-center gap-2 rounded-lg border border-border-soft bg-black/20 text-left transition hover:-translate-y-0.5 hover:border-brand-cyan/35 hover:bg-panel-hover/70 focus-visible:outline-2 focus-visible:outline-brand-cyan motion-reduce:transition-none ${compact ? 'px-2 py-1.5' : 'p-2.5'}`} onClick={() => onSelect?.(post)} type="button">
      {post.thumbnailUrl ? <img alt="" className={`${compact ? 'size-7' : 'size-10'} shrink-0 rounded-md object-cover`} loading="lazy" src={post.thumbnailUrl} /> : <PlatformIcon className={compact ? 'size-6' : 'size-8'} platform={post.platform} />}
      <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5"><time className="shrink-0 text-[9px] font-semibold text-text-muted" dateTime={post.occurredAt}>{post.time}</time>{post.thumbnailUrl && <PlatformIcon className="size-4" platform={post.platform} />}</span><strong className={`block truncate font-medium text-text-main ${compact ? 'text-[10px]' : 'mt-1 text-xs'}`}>{post.title}</strong>{!compact && <small className="mt-1 block truncate text-[10px] text-text-soft">{post.pageName}</small>}</span>
      {!compact && <StatusBadge compact status={statusMap[post.status]} />}
    </button>
  )
}
