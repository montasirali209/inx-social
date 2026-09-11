import { ImageIcon } from 'lucide-react'
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
      {post.thumbnailUrl ? <img alt="" className={`${compact ? 'size-7' : 'size-10'} shrink-0 rounded-md object-cover`} loading="lazy" src={post.thumbnailUrl} /> : <span className={`${compact ? 'size-7' : 'size-10'} grid shrink-0 place-items-center rounded-md border border-border-soft bg-panel-hover/55 text-text-soft`}><ImageIcon className={compact ? 'size-3.5' : 'size-4'} /></span>}
      <span className="min-w-0 flex-1"><time className="shrink-0 text-[9px] font-semibold text-text-muted" dateTime={post.occurredAt}>{post.time}</time><strong className={`block truncate font-medium text-text-main ${compact ? 'text-[10px]' : 'mt-1 text-xs'}`}>{post.title}</strong>{!compact && <small className="mt-1 block truncate text-[10px] text-text-soft">{post.pageName}</small>}</span>
      {!compact && <StatusBadge compact status={statusMap[post.status]} />}
      <PlatformIcon className={`${compact ? 'size-5' : 'size-6'} ml-auto shrink-0 rounded-full shadow-none`} platform={post.platform} />
    </button>
  )
}
