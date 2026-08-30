import { CalendarDays, ChevronLeft, ChevronRight, Filter, List, Search, UploadCloud } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { platformOrder, platformPresentation } from '../../data/dashboardData'
import { calendarRangeLabel } from '../../lib/calendar-utils'
import type { CalendarPostStatus } from '../../types/calendar'
import type { ConnectedPage, Platform } from '../../types/dashboard'

export type CalendarView = 'calendar' | 'list'

export function CalendarToolbar({ monthKey, pages, platform, pageId, status, search, view, onPrevious, onNext, onPlatform, onPage, onStatus, onSearch, onView }: {
  monthKey: string; pages: ConnectedPage[]; platform: Platform | 'all'; pageId: string; status: CalendarPostStatus | 'all'; search: string; view: CalendarView
  onPrevious: () => void; onNext: () => void; onPlatform: (value: Platform | 'all') => void; onPage: (value: string) => void; onStatus: (value: CalendarPostStatus | 'all') => void; onSearch: (value: string) => void; onView: (value: CalendarView) => void
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const control = 'min-h-10 rounded-xl border border-border-soft bg-panel/75 px-3 text-xs text-text-main transition focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/10'
  return (
    <section aria-label="Calendar controls" className="mb-4 rounded-panel border border-border-soft bg-panel/55 p-2.5 shadow-panel backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-h-10 items-center rounded-xl border border-border-soft bg-panel/75"><span className="flex items-center gap-2 px-3 text-xs font-semibold"><CalendarDays aria-hidden="true" className="size-4 text-brand-cyan" />{calendarRangeLabel(monthKey)}</span><button aria-label="Previous month" className="grid size-10 place-items-center border-l border-border-soft hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={onPrevious} type="button"><ChevronLeft className="size-4" /></button><button aria-label="Next month" className="grid size-10 place-items-center border-l border-border-soft hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={onNext} type="button"><ChevronRight className="size-4" /></button></div>
        <button className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-xl border border-border-soft px-3 text-xs font-semibold md:hidden" onClick={() => setFiltersOpen((value) => !value)} type="button"><Filter aria-hidden="true" className="size-4" /> Filters</button>
        <div className={`${filtersOpen ? 'flex' : 'hidden'} w-full flex-wrap gap-2 md:flex md:w-auto md:flex-1`}>
          <select aria-label="Platform filter" className={`${control} min-w-36`} onChange={(event) => onPlatform(event.target.value as Platform | 'all')} value={platform}><option value="all">All Platforms</option>{platformOrder.map((item) => <option key={item} value={item}>{platformPresentation[item].label}{item === 'facebook' ? '' : ' · planned'}</option>)}</select>
          <select aria-label="Page filter" className={`${control} min-w-32`} onChange={(event) => onPage(event.target.value)} value={pageId}><option value="">All Pages</option>{pages.map((page) => <option key={page.id} value={page.id}>{page.facebookPageName}</option>)}</select>
          <select aria-label="Status filter" className={`${control} min-w-32`} onChange={(event) => onStatus(event.target.value as CalendarPostStatus | 'all')} value={status}><option value="all">All Statuses</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="draft">Draft</option><option value="needs_review">Needs Review</option><option value="failed">Failed</option></select>
          <label className="relative min-w-44 flex-1"><span className="sr-only">Search posts</span><Search aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-soft" /><input className={`${control} w-full pr-9`} onChange={(event) => onSearch(event.target.value)} placeholder="Search posts…" type="search" value={search} /></label>
        </div>
        <div className="flex min-h-10 rounded-xl border border-border-soft bg-panel/75 p-1"><button aria-pressed={view === 'calendar'} className={`inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-brand-cyan ${view === 'calendar' ? 'border border-brand-cyan/45 bg-brand-cyan/10 text-brand-cyan' : 'text-text-muted hover:text-white'}`} onClick={() => onView('calendar')} type="button"><CalendarDays className="size-3.5" /> Calendar</button><button aria-pressed={view === 'list'} className={`inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-brand-cyan ${view === 'list' ? 'border border-brand-cyan/45 bg-brand-cyan/10 text-brand-cyan' : 'text-text-muted hover:text-white'}`} onClick={() => onView('list')} type="button"><List className="size-3.5" /> List</button></div>
        <a className="inline-flex min-h-10 items-center rounded-xl bg-gradient-to-r from-brand-blue to-[#0f8f7f] px-4 text-xs font-bold text-white shadow-glow-blue transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/studio/?view=posts">+ Schedule Content</a>
        <Link className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border-soft bg-panel/75 px-3 text-xs font-semibold transition hover:border-brand-cyan/40 hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-brand-cyan" to="/bulk-scheduler"><UploadCloud aria-hidden="true" className="size-4" /> Import Batch</Link>
      </div>
    </section>
  )
}
