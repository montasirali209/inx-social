import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, CircleDot, Clock3, Filter, Layers3, List, Radio, Search, UploadCloud, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { platformOrder, platformPresentation } from '../../data/dashboardData'
import { calendarRangeLabel } from '../../lib/calendar-utils'
import type { CalendarDestination, CalendarPostStatus } from '../../types/calendar'
import type { Platform } from '../../types/dashboard'
import { PlatformIcon } from '../dashboard/PlatformIcon'
import { CalendarFilterMenu, type CalendarFilterOption } from './CalendarFilterMenu'

export type CalendarView = 'calendar' | 'list'

export function CalendarToolbar({ monthKey, destinations, platform, pageId, status, search, view, onPrevious, onNext, onPlatform, onPage, onStatus, onSearch, onView }: {
  monthKey: string; destinations: CalendarDestination[]; platform: Platform | 'all'; pageId: string; status: CalendarPostStatus | 'all'; search: string; view: CalendarView
  onPrevious: () => void; onNext: () => void; onPlatform: (value: Platform | 'all') => void; onPage: (value: string) => void; onStatus: (value: CalendarPostStatus | 'all') => void; onSearch: (value: string) => void; onView: (value: CalendarView) => void
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const control = 'min-h-10 rounded-xl border border-border-soft bg-panel/75 px-3 text-xs text-text-main transition focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/10'
  const platformOptions = useMemo<CalendarFilterOption<Platform | 'all'>[]>(() => [
    { value: 'all', label: 'Every platform', description: 'Show every Post for Me destination', icon: <span className="grid size-7 place-items-center rounded-lg bg-brand-blue/12 text-brand-blue"><Layers3 className="size-3.5" /></span> },
    ...platformOrder.map(item => ({ value: item, label: platformPresentation[item].label, description: 'Live connected publishing destination', icon: <PlatformIcon className="size-7 rounded-full" platform={item} /> })),
  ], [])
  const destinationOptions = useMemo<CalendarFilterOption<string>[]>(() => [
    { value: '', label: 'All connected accounts', description: `${destinations.length} destination${destinations.length === 1 ? '' : 's'} available`, icon: <span className="grid size-7 place-items-center rounded-lg bg-brand-teal/12 text-brand-teal"><UsersRound className="size-3.5" /></span> },
    ...destinations.map(destination => ({
      value: destination.id,
      label: destination.name,
      description: `${platformPresentation[destination.platform].label}${destination.username ? ` · ${destination.username.startsWith('@') ? destination.username : `@${destination.username}`}` : ''}`,
      icon: destination.avatarUrl ? <img alt="" className="size-7 rounded-full object-cover" src={destination.avatarUrl} /> : <PlatformIcon className="size-7 rounded-full" platform={destination.platform} />,
    })),
  ], [destinations])
  const statusOptions = useMemo<CalendarFilterOption<CalendarPostStatus | 'all'>[]>(() => [
    { value: 'all', label: 'Upcoming only', description: 'Content still waiting to publish', icon: <span className="grid size-7 place-items-center rounded-lg bg-brand-amber/12 text-brand-amber"><CircleDot className="size-3.5" /></span> },
    { value: 'scheduled', label: 'Scheduled', description: 'Waiting for publishing time', icon: <span className="grid size-7 place-items-center rounded-lg bg-brand-cyan/12 text-brand-cyan"><Clock3 className="size-3.5" /></span> },
    { value: 'needs_review', label: 'Needs review', description: 'Action needed before publishing', icon: <span className="grid size-7 place-items-center rounded-lg bg-brand-amber/12 text-brand-amber"><AlertTriangle className="size-3.5" /></span> },
  ], [])
  return (
    <section aria-label="Calendar controls" className="relative z-30 mb-4 rounded-panel border border-border-soft bg-panel/55 p-2.5 shadow-panel backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-h-10 items-center rounded-xl border border-border-soft bg-panel/75"><span className="flex items-center gap-2 px-3 text-xs font-semibold"><CalendarDays aria-hidden="true" className="size-4 text-brand-cyan" />{calendarRangeLabel(monthKey)}</span><button aria-label="Previous month" className="grid size-10 place-items-center border-l border-border-soft hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={onPrevious} type="button"><ChevronLeft className="size-4" /></button><button aria-label="Next month" className="grid size-10 place-items-center border-l border-border-soft hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={onNext} type="button"><ChevronRight className="size-4" /></button></div>
        <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-green/15 bg-brand-green/[.055] px-3 text-[10px] font-semibold text-brand-green"><Radio className="size-3.5 animate-pulse motion-reduce:animate-none" />Live schedule</span>
        <button className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-xl border border-border-soft px-3 text-xs font-semibold md:hidden" onClick={() => setFiltersOpen(value => !value)} type="button"><Filter aria-hidden="true" className="size-4" /> Filters</button>
        <div className={`${filtersOpen ? 'flex' : 'hidden'} w-full flex-wrap gap-2 md:flex md:w-auto md:flex-1`}>
          <CalendarFilterMenu kind="platform" onChange={onPlatform} options={platformOptions} value={platform} />
          <CalendarFilterMenu kind="page" onChange={onPage} options={destinationOptions} value={pageId} />
          <CalendarFilterMenu kind="status" onChange={onStatus} options={statusOptions} value={status} />
          <label className="relative min-w-44 flex-1"><span className="sr-only">Search posts</span><Search aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-soft" /><input className={`${control} w-full pr-9`} onChange={event => onSearch(event.target.value)} placeholder="Search posts…" type="search" value={search} /></label>
        </div>
        <div className="flex min-h-10 rounded-xl border border-border-soft bg-panel/75 p-1"><button aria-pressed={view === 'calendar'} className={`inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-brand-cyan ${view === 'calendar' ? 'border border-brand-cyan/45 bg-brand-cyan/10 text-brand-cyan' : 'text-text-muted hover:text-white'}`} onClick={() => onView('calendar')} type="button"><CalendarDays className="size-3.5" /> Calendar</button><button aria-pressed={view === 'list'} className={`inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-brand-cyan ${view === 'list' ? 'border border-brand-cyan/45 bg-brand-cyan/10 text-brand-cyan' : 'text-text-muted hover:text-white'}`} onClick={() => onView('list')} type="button"><List className="size-3.5" /> List</button></div>
        <a className="inline-flex min-h-10 items-center rounded-xl bg-gradient-to-r from-brand-blue to-[#0f8f7f] px-4 text-xs font-bold text-white shadow-glow-blue transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/app/posts">+ Schedule Content</a>
        <Link className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border-soft bg-panel/75 px-3 text-xs font-semibold transition hover:border-brand-cyan/40 hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-brand-cyan" to="/bulk-scheduler"><UploadCloud aria-hidden="true" className="size-4" /> Import Batch</Link>
      </div>
    </section>
  )
}
