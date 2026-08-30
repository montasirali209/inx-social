import { Bell, ChevronDown, Menu, RefreshCw } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import type { StudioOverview } from '../../types/dashboard'
import { useUiStore } from '../../store/ui-store'
import { Button } from '../ui/Button'

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'IN'
}

export function Topbar({ overview }: { overview?: StudioOverview }) {
  const setOpen = useUiStore((state) => state.setMobileNavigationOpen)
  const timezone = useUiStore((state) => state.timezone)
  const setTimezone = useUiStore((state) => state.setTimezone)
  const location = useLocation()
  const name = overview?.user.name || overview?.user.businessName || 'INX Social account'
  const dashboardRoute = location.pathname === '/'
  const calendarRoute = location.pathname === '/content-calendar'
  const workspaceTitle = dashboardRoute ? 'Dashboard' : calendarRoute ? 'Content Calendar' : 'INX Social'
  const workspaceSubtitle = dashboardRoute ? 'Overview of your social media publishing performance.' : calendarRoute ? 'Plan, schedule and manage your content across all platforms.' : 'Video Scheduler'

  return (
    <header className={`sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border-soft bg-bg/88 px-4 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-2xl sm:px-6 ${dashboardRoute || calendarRoute ? 'min-h-[78px]' : 'min-h-16'}`}>
      <div className="flex min-w-0 items-center gap-3">
        <Button aria-label="Open navigation" className="size-10 shrink-0 px-0 md:hidden" onClick={() => setOpen(true)} variant="ghost"><Menu aria-hidden="true" className="size-5" /></Button>
        <div className="min-w-0">
          <p className={`truncate font-semibold tracking-[-0.03em] ${dashboardRoute || calendarRoute ? 'text-xl sm:text-2xl' : 'text-sm sm:text-base'}`}>{workspaceTitle}</p>
          <p className="truncate text-xs text-text-muted">{workspaceSubtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {(dashboardRoute || calendarRoute) && <label className="relative hidden sm:block"><span className="sr-only">Workspace timezone</span><select className="min-h-10 min-w-52 appearance-none rounded-xl border border-border-soft bg-panel/70 pl-3 pr-9 text-xs text-text-main focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/15" onChange={(event) => setTimezone(event.target.value)} value={timezone}><option value="Europe/London">Timezone · Europe/London</option><option value="UTC">Timezone · UTC</option><option value="America/New_York">Timezone · America/New York</option><option value="Asia/Dhaka">Timezone · Asia/Dhaka</option></select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-text-soft" /></label>}
        {calendarRoute && <label className="relative hidden md:block"><span className="sr-only">Theme</span><select className="min-h-10 appearance-none rounded-xl border border-border-soft bg-panel/70 pl-3 pr-8 text-xs text-text-main focus:border-brand-cyan focus:outline-none" defaultValue="midnight"><option value="midnight">Theme · Midnight</option></select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-soft" /></label>}
        {calendarRoute && <button aria-label="Refresh Content Calendar" className="hidden min-h-10 items-center gap-2 rounded-xl border border-border-soft bg-panel/70 px-3 text-xs font-semibold text-text-muted transition hover:border-brand-cyan/40 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan lg:inline-flex" onClick={() => window.dispatchEvent(new CustomEvent('inx-social:refresh'))} type="button"><RefreshCw aria-hidden="true" className="size-4" /> Refresh</button>}
        {(dashboardRoute || calendarRoute) && <a aria-label={overview?.summary.failed ? `${overview.summary.failed} publishing items need attention` : 'Open publishing notifications'} className="relative grid size-10 place-items-center rounded-xl border border-border-soft bg-panel/70 text-text-muted transition hover:border-brand-cyan/40 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/studio/?view=posts"><Bell aria-hidden="true" className="size-4.5" />{Boolean(overview?.summary.failed) && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-brand-red shadow-[0_0_8px_#ef4444]" />}</a>}
        <details className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl p-1.5 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand-cyan">
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-full border border-brand-blue/45 bg-gradient-to-br from-brand-blue/20 to-brand-cyan/8 text-xs font-bold text-brand-cyan shadow-glow-blue">{initials(name)}</span>
            <span className="hidden text-left lg:block"><strong className="block max-w-44 truncate text-xs">{name}</strong><small className="text-[10px] text-text-muted">{overview?.license.plan || 'Account'}</small></span>
            <ChevronDown aria-hidden="true" className="hidden size-3 text-text-soft transition group-open:rotate-180 lg:block" />
          </summary>
          <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border-soft bg-panel p-2 shadow-panel"><a className="block rounded-lg px-3 py-2 text-xs text-text-muted hover:bg-panel-hover hover:text-white" href="/studio/?view=settings">Account settings</a><a className="block rounded-lg px-3 py-2 text-xs text-text-muted hover:bg-panel-hover hover:text-white" href="/portal/#overview">Billing & plan</a></div>
        </details>
      </div>
    </header>
  )
}
