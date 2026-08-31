import { CalendarClock, FileEdit, Image, MapPin, PencilLine, Trash2, X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ConnectedPage } from '../../types/dashboard'
import type { PostDraft } from '../../types/posts'
import { Button } from '../ui/Button'
import { PlatformIcon, PostsStatusBadge } from './PostPrimitives'

type Props = {
  drafts: PostDraft[]
  pages: ConnectedPage[]
  onClose: () => void
  onDelete: (id: string) => void
  onLoad: (draft: PostDraft) => void
}

function displayDate(value: string | null) {
  if (!value) return 'No publishing time selected'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'No publishing time selected' : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function DraftLibraryModal({ drafts, pages, onClose, onDelete, onLoad }: Props) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', closeOnEscape) }
  }, [onClose])

  return createPortal(
    <div className="posts-modal-backdrop fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-[#020914]/82 p-4 backdrop-blur-md" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
      <section aria-labelledby="draft-library-title" aria-modal="true" className="posts-modal-panel my-auto flex max-h-[min(820px,calc(100vh-2rem))] w-full max-w-5xl flex-col overflow-hidden rounded-panel border border-brand-cyan/30 bg-panel shadow-[0_35px_130px_rgba(0,0,0,.72),0_0_70px_rgba(20,184,166,.13)]" role="dialog">
        <header className="relative overflow-hidden border-b border-border-soft bg-gradient-to-br from-brand-cyan/[0.12] via-panel to-panel px-5 py-5 sm:px-6">
          <div className="absolute -right-10 -top-16 size-52 rounded-full border border-brand-cyan/15 bg-brand-cyan/[0.05]" />
          <button aria-label="Close Draft Library" className="absolute right-4 top-4 rounded-xl border border-border-soft bg-bg/45 p-2 text-text-muted transition hover:border-brand-cyan/35 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={onClose} type="button"><X className="size-4" /></button>
          <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-brand-amber/25 bg-brand-amber/10 text-brand-amber"><FileEdit className="size-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold" id="draft-library-title">Draft Library</h2><span className="rounded-full border border-brand-cyan/20 bg-brand-cyan/8 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-brand-cyan">This browser</span></div><p className="mt-1 text-xs text-text-muted">Continue unfinished posts without losing your caption, destinations or schedule settings.</p></div></div>
        </header>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {drafts.length ? <div className="grid gap-3 md:grid-cols-2">{drafts.map((draft) => {
            const destinations = draft.selectedDestinationIds.map((id) => pages.find((page) => page.id === id)).filter((page): page is ConnectedPage => Boolean(page))
            return <article className="group rounded-2xl border border-border-soft bg-bg/30 p-4 transition-colors hover:border-brand-cyan/35 hover:bg-brand-cyan/[0.035]" key={draft.id}>
              <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand-amber/20 bg-brand-amber/8 text-brand-amber"><FileEdit className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-sm">{draft.title || 'Untitled draft'}</strong><p className="mt-1 line-clamp-2 min-h-8 text-[11px] leading-4 text-text-muted">{draft.caption || 'No caption added yet.'}</p></div><PostsStatusBadge status="draft" /></div></div></div>
              <div className="mt-4 grid gap-2 rounded-xl border border-border-soft bg-panel-soft/45 p-3 text-[10px] text-text-muted sm:grid-cols-2"><span className="flex min-w-0 items-center gap-2"><CalendarClock className="size-3.5 shrink-0 text-brand-cyan" /><span className="truncate">{displayDate(draft.scheduledAt)}</span></span><span className="flex min-w-0 items-center gap-2"><Image className="size-3.5 shrink-0 text-brand-cyan" /><span className="truncate">{draft.mediaFileName || 'No media attached'}</span></span><span className="flex min-w-0 items-center gap-2 sm:col-span-2"><MapPin className="size-3.5 shrink-0 text-brand-cyan" /><span className="truncate">{destinations.length ? destinations.map((page) => page.facebookPageName).join(' · ') : 'No destinations selected'}</span></span></div>
              <div className="mt-3 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><PlatformIcon className="size-5 text-[8px]" platform="facebook" />{destinations.length > 0 && <span className="text-[10px] text-text-muted">{destinations.length} destination{destinations.length === 1 ? '' : 's'}</span>}<span className="text-[9px] text-text-soft">Saved {displayDate(draft.createdAt)}</span></div><div className="flex shrink-0 gap-2"><button aria-label={`Delete ${draft.title || 'untitled draft'}`} className="rounded-lg border border-border-soft p-2 text-text-muted transition hover:border-brand-red/35 hover:bg-brand-red/10 hover:text-brand-red focus-visible:outline-2 focus-visible:outline-brand-red" onClick={() => onDelete(draft.id)} type="button"><Trash2 className="size-3.5" /></button><Button className="min-h-8 px-3 py-1.5 text-[10px]" onClick={() => onLoad(draft)} type="button" variant="primary"><PencilLine className="size-3.5" />Continue editing</Button></div></div>
            </article>
          })}</div> : <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-border-soft bg-bg/20 p-8 text-center"><span><span className="mx-auto grid size-14 place-items-center rounded-2xl border border-brand-amber/20 bg-brand-amber/8 text-brand-amber"><FileEdit className="size-6" /></span><strong className="mt-4 block">No saved drafts yet</strong><p className="mt-2 max-w-sm text-xs leading-5 text-text-muted">Write a title or caption, then choose Save as Draft in the composer. It will appear here instantly.</p><Button className="mt-5" onClick={onClose} type="button" variant="primary">Return to composer</Button></span></div>}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-soft bg-bg/20 px-5 py-3 text-[10px] text-text-soft sm:px-6"><span>{drafts.length} saved draft{drafts.length === 1 ? '' : 's'} · stored on this browser</span><button className="rounded-lg px-3 py-2 text-text-muted transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={onClose} type="button">Close</button></footer>
      </section>
    </div>,
    document.body,
  )
}
