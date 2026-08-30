import { MoreVertical } from 'lucide-react'
import type { CalendarPost } from '../../types/calendar'
import type { VideoStatus } from '../../types/dashboard'
import { PlatformIcon } from '../dashboard/PlatformIcon'
import { StatusBadge } from '../dashboard/StatusBadge'

const statuses: Record<CalendarPost['status'], VideoStatus> = { scheduled: 'scheduled', published: 'published', draft: 'ready', needs_review: 'pending_review', failed: 'failed' }

export function ScheduledVideoCard({ post }: { post: CalendarPost }) {
  return <article className="flex min-w-0 items-center gap-2 rounded-xl border border-border-soft bg-black/15 p-2 transition hover:border-brand-cyan/30 hover:bg-panel-hover/40">
    {post.thumbnailUrl ? <img alt="" className="size-9 shrink-0 rounded-lg object-cover" loading="lazy" src={post.thumbnailUrl} /> : <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-panel-hover"><PlatformIcon className="size-6" platform={post.platform} /></span>}
    <PlatformIcon className="size-5" platform={post.platform} />
    <span className="min-w-0 flex-1"><strong className="block truncate text-[11px]">{post.title}</strong><small className="mt-0.5 block truncate text-[9px] text-text-soft">{post.time} · {post.pageName}</small></span>
    <StatusBadge compact status={statuses[post.status]} />
    <button aria-label={`More options for ${post.title}`} className="grid size-7 shrink-0 place-items-center rounded-lg text-text-soft hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" type="button"><MoreVertical aria-hidden="true" className="size-3.5" /></button>
  </article>
}
