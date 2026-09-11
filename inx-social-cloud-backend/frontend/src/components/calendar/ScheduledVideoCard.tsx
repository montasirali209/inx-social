import { CalendarClock, ExternalLink, ImageIcon, MoreVertical, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { CalendarPost } from '../../types/calendar'
import type { VideoStatus } from '../../types/dashboard'
import { PlatformIcon } from '../dashboard/PlatformIcon'
import { StatusBadge } from '../dashboard/StatusBadge'

const statuses: Record<CalendarPost['status'], VideoStatus> = { scheduled: 'scheduled', published: 'published', draft: 'ready', needs_review: 'pending_review', failed: 'failed' }

export function ScheduledVideoCard({ post, busy = false, onOpen, onReschedule, onDelete }: { post: CalendarPost; busy?: boolean; onOpen: (post: CalendarPost) => void; onReschedule: (post: CalendarPost) => void; onDelete: (post: CalendarPost) => void }) {
  const [open, setOpen] = useState(false)
  return <article className="min-w-0 rounded-xl border border-border-soft bg-black/15 p-2 transition hover:border-brand-cyan/30 hover:bg-panel-hover/40">
    <div className="flex min-w-0 items-center gap-2">
      <button aria-label={`Open ${post.title} on Facebook`} className="contents" disabled={!post.platformUrl} onClick={() => onOpen(post)} type="button">
        {post.thumbnailUrl ? <img alt="" className="size-9 shrink-0 rounded-lg object-cover" loading="lazy" src={post.thumbnailUrl} /> : <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border-soft bg-panel-hover/55 text-text-soft"><ImageIcon className="size-4" /></span>}
        <span className="min-w-0 flex-1 text-left"><strong className="block truncate text-[11px]">{post.title}</strong><small className="mt-0.5 block truncate text-[9px] text-text-soft">{post.time} · {post.pageName}</small></span>
      </button>
      <StatusBadge compact status={statuses[post.status]} />
      <PlatformIcon className="size-5 shrink-0 rounded-full shadow-none" platform={post.platform} />
      <button aria-expanded={open} aria-label={`More options for ${post.title}`} className="grid size-7 shrink-0 place-items-center rounded-lg text-text-soft hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" disabled={busy} onClick={() => setOpen(value => !value)} type="button"><MoreVertical aria-hidden="true" className="size-3.5" /></button>
    </div>
    {open && <div className="mt-2 grid gap-1 border-t border-border-soft pt-2">
      {post.platformUrl && <button className="flex min-h-8 items-center gap-2 rounded-lg px-2 text-left text-[10px] text-text-muted hover:bg-white/5 hover:text-white" onClick={() => { setOpen(false); onOpen(post) }} type="button"><ExternalLink className="size-3.5 text-brand-cyan" />Open on Facebook</button>}
      <button className="flex min-h-8 items-center gap-2 rounded-lg px-2 text-left text-[10px] text-text-muted hover:bg-white/5 hover:text-white" onClick={() => { setOpen(false); onReschedule(post) }} type="button"><CalendarClock className="size-3.5 text-brand-cyan" />Reschedule</button>
      <button className="flex min-h-8 items-center gap-2 rounded-lg px-2 text-left text-[10px] text-brand-red hover:bg-brand-red/10" onClick={() => { setOpen(false); onDelete(post) }} type="button"><Trash2 className="size-3.5" />Delete from Facebook & INXSocial</button>
    </div>}
  </article>
}
