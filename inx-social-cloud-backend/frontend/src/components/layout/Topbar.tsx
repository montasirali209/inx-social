import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Menu, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { StudioOverview } from '../../types/dashboard'
import { useUiStore } from '../../store/ui-store'
import { Button } from '../ui/Button'
import { NotificationCenter } from './NotificationCenter'

const workspaceRoutes = {
  '/': {
    title: 'Dashboard',
    subtitle: 'Overview of your social media publishing performance.',
  },
  '/bulk-scheduler': {
    title: 'Bulk Scheduler',
    subtitle: 'Publish video batches across one or several connected social media platforms.',
  },
  '/content-calendar': {
    title: 'Content Calendar',
    subtitle: 'Plan, schedule and manage your content across all platforms.',
  },
  '/posts': {
    title: 'Posts',
    subtitle: 'Create, schedule and manage content across your connected social destinations.',
  },
  '/media-library': {
    title: 'Media Library',
    subtitle: 'Store, organise and reuse your uploaded and AI-generated assets.',
  },
} as const

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'IN'
}

function workspaceForPath(pathname: string) {
  return workspaceRoutes[pathname as keyof typeof workspaceRoutes] || {
    title: 'INX Social',
    subtitle: 'Professional social publishing workspace.',
  }
}

export function Topbar({ overview }: { overview?: StudioOverview }) {
  const setOpen = useUiStore((state) => state.setMobileNavigationOpen)
  const timezone = useUiStore((state) => state.timezone)
  const setTimezone = useUiStore((state) => state.setTimezone)
  const location = useLocation()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const name = overview?.user.name || overview?.user.businessName || 'INX Social account'
  const workspace = workspaceForPath(location.pathname)

  async function refreshWorkspace() {
    if (refreshing) return
    setRefreshing(true)
    try {
      await queryClient.invalidateQueries({ refetchType: 'active' })
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <header
      className="sticky top-0 z-20 flex min-h-[78px] items-center justify-between gap-3 border-b border-border-soft bg-bg/88 px-3 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-2xl sm:px-5 xl:px-6"
      data-design-standard="universal-workspace-topbar"
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Button aria-label="Open navigation" className="size-10 shrink-0 px-0 md:hidden" onClick={() => setOpen(true)} variant="ghost"><Menu aria-hidden="true" className="size-5" /></Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-[-0.03em] text-text-main sm:text-xl xl:text-2xl">{workspace.title}</h1>
          <p className="hidden truncate text-[11px] text-text-muted sm:block xl:text-xs">{workspace.subtitle}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-2.5">
        <label className="relative hidden lg:block">
          <span className="sr-only">Workspace timezone</span>
          <select className="min-h-10 min-w-48 appearance-none rounded-xl border border-border-soft bg-panel/70 pl-3 pr-9 text-xs text-text-main transition hover:border-brand-cyan/35 focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/15" onChange={(event) => setTimezone(event.target.value)} value={timezone}>
            <option value="Europe/London">Timezone · Europe/London</option>
            <option value="UTC">Timezone · UTC</option>
            <option value="America/New_York">Timezone · America/New York</option>
            <option value="Asia/Dhaka">Timezone · Asia/Dhaka</option>
          </select>
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-text-soft" />
        </label>

        <label className="relative hidden xl:block">
          <span className="sr-only">Theme</span>
          <select className="min-h-10 appearance-none rounded-xl border border-border-soft bg-panel/70 pl-3 pr-8 text-xs text-text-main transition hover:border-brand-cyan/35 focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/15" defaultValue="midnight">
            <option value="midnight">Theme · Midnight</option>
          </select>
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-soft" />
        </label>

        <button
          aria-label={refreshing ? `Refreshing ${workspace.title}` : `Refresh ${workspace.title}`}
          className="inline-flex size-10 items-center justify-center gap-2 rounded-xl border border-border-soft bg-panel/70 text-xs font-semibold text-text-muted transition duration-200 hover:-translate-y-0.5 hover:border-brand-cyan/40 hover:bg-panel-hover/80 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan disabled:cursor-wait disabled:opacity-70 motion-reduce:transform-none motion-reduce:transition-none 2xl:w-auto 2xl:px-3"
          disabled={refreshing}
          onClick={() => void refreshWorkspace()}
          type="button"
        >
          <RefreshCw aria-hidden="true" className={`size-4 ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          <span className="hidden 2xl:inline">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
        </button>

        <NotificationCenter overview={overview} />

        <details className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl p-1 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan sm:p-1.5">
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-full border border-brand-blue/45 bg-gradient-to-br from-brand-blue/20 to-brand-cyan/8 text-xs font-bold text-brand-cyan shadow-glow-blue">{initials(name)}</span>
            <span className="hidden text-left 2xl:block"><strong className="block max-w-40 truncate text-xs">{name}</strong><small className="text-[10px] uppercase tracking-wide text-text-muted">{overview?.license.plan || 'Account'}</small></span>
            <ChevronDown aria-hidden="true" className="hidden size-3 text-text-soft transition group-open:rotate-180 2xl:block" />
          </summary>
          <div className="notification-pop absolute right-0 top-full mt-2 w-48 rounded-xl border border-border-soft bg-panel p-2 shadow-panel">
            <a className="block rounded-lg px-3 py-2 text-xs text-text-muted transition hover:bg-panel-hover hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/studio/?view=settings">Account settings</a>
            <a className="block rounded-lg px-3 py-2 text-xs text-text-muted transition hover:bg-panel-hover hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/portal/#overview">Billing & plan</a>
          </div>
        </details>
      </div>
    </header>
  )
}
