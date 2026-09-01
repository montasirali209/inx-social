import { AlertTriangle, CalendarClock, Check, ClipboardList, Image, PencilLine, RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { matchesPostLibraryView, requiresMediaReattachment, type PostLibraryView } from '../../lib/posts-reuse'
import type { DashboardJob } from '../../types/dashboard'
import { Button } from '../ui/Button'
import { PlatformIcon, PostsStatusBadge } from './PostPrimitives'

type Props = {
  jobs: DashboardJob[]
  initialView: PostLibraryView
  loadingExternal?: boolean
  onClose: () => void
  onReuse: (job: DashboardJob) => void
}

const tabs: Array<{ id: PostLibraryView; label: string }> = [
  { id: 'all', label: 'All Posts' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'published', label: 'Published' },
  { id: 'needs_review', label: 'Needs Review' },
]

function status(job: DashboardJob) {
  if (job.status === 'PUBLISHED') return 'published' as const
  if (job.status === 'SCHEDULED') return 'scheduled' as const
  if (job.status === 'FAILED' || job.status === 'CANCELLED') return 'failed' as const
  return 'needs_review' as const
}

function displayDate(value: string | null) {
  if (!value) return 'Published immediately'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Publishing time unavailable' : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function tabCount(jobs: DashboardJob[], view: PostLibraryView) {
  return jobs.filter((job) => matchesPostLibraryView(job, view)).length
}

export function PostReuseModal({ jobs, initialView, loadingExternal = false, onClose, onReuse }: Props) {
  const [view, setView] = useState<PostLibraryView>(initialView)
  const visibleJobs = useMemo(() => jobs.filter((job) => matchesPostLibraryView(job, view)), [jobs, view])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', closeOnEscape) }
  }, [onClose])

  return createPortal(
    <div className="posts-modal-backdrop fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-[#020914]/82 p-4 backdrop-blur-md" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
      <section aria-labelledby="reuse-library-title" aria-modal="true" className="posts-modal-panel my-auto flex min-h-0 max-h-[min(840px,calc(100dvh-2rem))] w-full max-w-6xl flex-col overflow-hidden rounded-panel border border-brand-cyan/30 bg-panel shadow-[0_35px_130px_rgba(0,0,0,.72),0_0_70px_rgba(20,184,166,.13)]" role="dialog">
        <header className="relative shrink-0 overflow-hidden border-b border-border-soft bg-gradient-to-br from-brand-cyan/[0.12] via-panel to-panel px-5 py-5 sm:px-6">
          <div className="absolute -right-10 -top-16 size-52 rounded-full border border-brand-cyan/15 bg-brand-cyan/[0.05]" />
          <button aria-label="Close reuse library" className="absolute right-4 top-4 rounded-xl border border-border-soft bg-bg/45 p-2 text-text-muted transition hover:border-brand-cyan/35 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={onClose} type="button"><X className="size-4" /></button>
          <div className="flex items-start gap-3 pr-12"><span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><RotateCcw className="size-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold" id="reuse-library-title">Reuse a post</h2><span className="rounded-full border border-brand-green/20 bg-brand-green/8 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-brand-green">No duplicate media</span>{loadingExternal && <span className="animate-pulse rounded-full border border-brand-cyan/20 bg-brand-cyan/8 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-brand-cyan motion-reduce:animate-none">Syncing Meta</span>}</div><p className="mt-1 max-w-2xl text-xs leading-5 text-text-muted">Reopen INXSocial records or posts discovered directly on connected Facebook Pages, then choose new destinations and a new time.</p></div></div>
        </header>

        <nav aria-label="Post library filters" className="scrollbar-thin flex shrink-0 gap-2 overflow-x-auto border-b border-border-soft bg-bg/25 px-4 py-3 sm:px-6">
          {tabs.map((tab) => <button aria-pressed={view === tab.id} className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-xl border px-3 text-[10px] font-semibold transition focus-visible:outline-2 focus-visible:outline-brand-cyan ${view === tab.id ? 'border-brand-cyan/50 bg-brand-cyan/12 text-brand-cyan' : 'border-border-soft bg-panel/50 text-text-muted hover:border-brand-cyan/25 hover:text-white'}`} key={tab.id} onClick={() => setView(tab.id)} type="button">{tab.label}<span className="rounded-full bg-white/6 px-1.5 py-0.5 text-[9px]">{tabCount(jobs, tab.id)}</span></button>)}
        </nav>

        <div className="scrollbar-thin min-h-0 flex-1 overscroll-contain overflow-y-auto p-4 sm:p-6">
          {visibleJobs.length ? <div className="grid gap-3 lg:grid-cols-2">{visibleJobs.map((job) => {
            const mediaRequired = requiresMediaReattachment(job)
            const external = job.id.startsWith('meta:')
            return <article className="group rounded-2xl border border-border-soft bg-bg/30 p-4 transition-colors hover:border-brand-cyan/35 hover:bg-brand-cyan/[0.035]" key={job.id}>
              <div className="flex items-start gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl border ${mediaRequired ? 'border-brand-purple/20 bg-brand-purple/8 text-brand-purple' : 'border-brand-cyan/20 bg-brand-cyan/8 text-brand-cyan'}`}>{mediaRequired ? <Image className="size-4" /> : <ClipboardList className="size-4" />}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-sm">{job.title || job.caption || job.localFileName || 'Untitled post'}</strong><p className="mt-1 line-clamp-2 min-h-8 text-[11px] leading-4 text-text-muted">{job.caption || 'No reusable caption was retained for this record.'}</p></div><PostsStatusBadge status={status(job)} /></div></div></div>
              <div className="mt-4 grid gap-2 rounded-xl border border-border-soft bg-panel-soft/45 p-3 text-[10px] text-text-muted sm:grid-cols-2"><span className="flex min-w-0 items-center gap-2"><CalendarClock className="size-3.5 shrink-0 text-brand-cyan" /><span className="truncate">{displayDate(job.scheduledAt || job.completedAt)}</span></span><span className="flex min-w-0 items-center gap-2"><PlatformIcon className="size-5 text-[8px]" platform="facebook" /><span className="truncate">{job.page?.facebookPageName || 'Disconnected Facebook Page'}</span></span><span className={`flex min-w-0 items-center gap-2 sm:col-span-2 ${mediaRequired ? 'text-brand-amber' : 'text-brand-green'}`}>{mediaRequired ? <AlertTriangle className="size-3.5 shrink-0" /> : <Check className="size-3.5 shrink-0" />}<span>{mediaRequired ? `${job.localFileName || 'Original media'} was streamed temporarily; select it again or choose a Media Library asset.` : 'Text and publishing settings can be restored immediately.'}</span></span></div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-[9px] text-text-soft">{external ? 'Discovered on Meta' : 'Created in INXSocial'} · {displayDate(job.createdAt)}</span><Button className="min-h-8 px-3 py-1.5 text-[10px]" onClick={() => onReuse(job)} type="button" variant="primary"><PencilLine className="size-3.5" />Reuse in composer</Button></div>
            </article>
          })}</div> : <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-border-soft bg-bg/20 p-8 text-center"><span><span className="mx-auto grid size-14 place-items-center rounded-2xl border border-brand-cyan/20 bg-brand-cyan/8 text-brand-cyan"><RotateCcw className="size-6" /></span><strong className="mt-4 block">No {tabs.find((tab) => tab.id === view)?.label.toLowerCase()} yet</strong><p className="mt-2 max-w-sm text-xs leading-5 text-text-muted">Publishing records will appear here as soon as you create, schedule or publish content with INXSocial.</p><Button className="mt-5" onClick={onClose} type="button" variant="primary">Return to composer</Button></span></div>}
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border-soft bg-bg/20 px-5 py-3 text-[10px] text-text-soft sm:px-6"><span>Reuse restores metadata only · persistent media stays in Media Library</span><button className="rounded-lg px-3 py-2 text-text-muted transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={onClose} type="button">Close</button></footer>
      </section>
    </div>,
    document.body,
  )
}
