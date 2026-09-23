import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, CircleHelp, LogOut, Menu, RefreshCw, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { StudioOverview } from '../../types/dashboard'
import { useUiStore } from '../../store/ui-store'
import { Button } from '../ui/Button'
import { NotificationCenter } from './NotificationCenter'

const workspaceRoutes = {
  '/': {
    title: 'Dashboard',
    subtitle: 'Here’s what’s happening across all your social media accounts.',
  },
  '/bulk-scheduler': {
    title: 'Bulk Scheduler',
    subtitle: 'Publish image and video batches across one or several connected social media platforms.',
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
  '/ai-content-studio': {
    title: 'AI Content Studio',
    subtitle: 'Create and refine campaign-ready content with AI-powered tools.',
  },
  '/analytics': {
    title: 'Analytics',
    subtitle: 'Track performance, engagement and growth across your connected platforms.',
  },
  '/settings': {
    title: 'Settings',
    subtitle: 'Control your workspace, publishing, scheduling and account preferences.',
  },
  '/connected-accounts': {
    title: 'Connected Accounts',
    subtitle: 'Manage all your connected social destinations in one place.',
  },
  '/billing': {
    title: 'Billing & Plans',
    subtitle: 'Manage your subscription, usage and billing details.',
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

function dashboardGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning! 👋'
  if (hour < 18) return 'Good afternoon! 👋'
  return 'Good evening! 👋'
}


function worldTimezones(currentTimezone: string) {
  const supportedValuesOf = (Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] }).supportedValuesOf
  const zones = supportedValuesOf ? supportedValuesOf('timeZone') : [
    'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos', 'America/Anchorage', 'America/Argentina/Buenos_Aires',
    'America/Bogota', 'America/Chicago', 'America/Denver', 'America/Halifax', 'America/Los_Angeles',
    'America/Mexico_City', 'America/New_York', 'America/Phoenix', 'America/Sao_Paulo', 'America/Toronto',
    'America/Vancouver', 'Asia/Baghdad', 'Asia/Bangkok', 'Asia/Dhaka', 'Asia/Dubai', 'Asia/Hong_Kong',
    'Asia/Jakarta', 'Asia/Jerusalem', 'Asia/Karachi', 'Asia/Kathmandu', 'Asia/Kolkata', 'Asia/Manila',
    'Asia/Riyadh', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Adelaide',
    'Australia/Brisbane', 'Australia/Melbourne', 'Australia/Perth', 'Australia/Sydney', 'Europe/Amsterdam',
    'Europe/Athens', 'Europe/Berlin', 'Europe/Istanbul', 'Europe/London', 'Europe/Madrid', 'Europe/Moscow',
    'Europe/Paris', 'Europe/Rome', 'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Honolulu',
  ]
  return Array.from(new Set(['UTC', currentTimezone, ...zones])).filter(Boolean).sort((left, right) => {
    if (left === 'UTC') return -1
    if (right === 'UTC') return 1
    return left.localeCompare(right)
  })
}

function timezoneLabel(timezone: string) {
  if (timezone === 'UTC') return 'UTC'
  return timezone.replace(/_/g, ' ')
}

export function Topbar({ overview }: { overview?: StudioOverview }) {
  const profileMenu = useRef<HTMLDetailsElement>(null)
  const setOpen = useUiStore((state) => state.setMobileNavigationOpen)
  const timezone = useUiStore((state) => state.timezone)
  const setTimezone = useUiStore((state) => state.setTimezone)
  const settingsSearch = useUiStore((state) => state.settingsSearch)
  const setSettingsSearch = useUiStore((state) => state.setSettingsSearch)
  const connectionsSearch = useUiStore((state) => state.connectionsSearch)
  const setConnectionsSearch = useUiStore((state) => state.setConnectionsSearch)
  const billingSearch = useUiStore((state) => state.billingSearch)
  const setBillingSearch = useUiStore((state) => state.setBillingSearch)
  const setBillingHelpOpen = useUiStore((state) => state.setBillingHelpOpen)
  const location = useLocation()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const name = overview?.user.name || overview?.user.businessName || 'INX Social account'
  const workspace = workspaceForPath(location.pathname)
  const dashboardRoute = location.pathname === '/'
  const settingsRoute = location.pathname === '/settings'
  const connectionsRoute = location.pathname === '/connected-accounts'
  const billingRoute = location.pathname === '/billing'
  const timezoneOptions = worldTimezones(timezone)

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (profileMenu.current?.open && !profileMenu.current.contains(event.target as Node)) profileMenu.current.open = false
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && profileMenu.current?.open) {
        profileMenu.current.open = false
        profileMenu.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  async function refreshWorkspace() {
    if (refreshing) return
    setRefreshing(true)
    try {
      await queryClient.invalidateQueries({ refetchType: 'active' })
    } finally {
      setRefreshing(false)
    }
  }

  function signOut() {
    window.localStorage.removeItem('inx-social-cloud-token')
    window.localStorage.removeItem('inxToken')
    queryClient.clear()
    window.location.assign('/')
  }

  return (
    <header className="sticky top-0 z-20 min-h-[64px] sm:min-h-[72px] lg:min-h-[78px] border-b border-border-soft bg-bg/88 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-2xl" data-design-standard="universal-workspace-topbar">
      <div className="flex min-h-[64px] w-full min-w-0 items-center justify-between gap-1.5 px-2.5 sm:min-h-[72px] sm:gap-3 sm:px-5 lg:min-h-[78px] xl:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
          <Button aria-label="Open navigation" className="size-9 shrink-0 px-0 sm:size-10 lg:hidden" onClick={() => setOpen(true)} variant="ghost"><Menu aria-hidden="true" className="size-5" /></Button>
          {connectionsRoute ? (
            <label className="relative min-w-0 flex-1 sm:max-w-[26rem]">
              <span className="sr-only">Search anything in connected accounts</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
              <input
                className="min-h-10 w-full rounded-xl border border-border-soft bg-panel/70 pl-10 pr-3 text-xs text-text-main placeholder:text-text-soft transition hover:border-brand-cyan/35 focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/15"
                onChange={(event) => setConnectionsSearch(event.target.value)}
                placeholder="Search anything..."
                type="search"
                value={connectionsSearch}
              />
            </label>
          ) : (
            <div className="min-w-0">
              <h1 className="max-w-[46vw] truncate text-base font-semibold tracking-[-0.03em] text-text-main sm:max-w-none sm:text-xl xl:text-2xl">{dashboardRoute ? dashboardGreeting() : workspace.title}</h1>
              <p className="hidden truncate text-[11px] text-text-muted sm:block xl:text-xs">{workspace.subtitle}</p>
            </div>
          )}
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2 lg:gap-2.5">
          {(settingsRoute || billingRoute) && <label className="relative hidden lg:block">
            <span className="sr-only">{settingsRoute ? 'Search settings' : 'Search billing'}</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            <input className="min-h-10 w-[clamp(12rem,24vw,20rem)] rounded-xl border border-border-soft bg-panel/70 pl-10 pr-3 text-xs text-text-main placeholder:text-text-soft transition hover:border-brand-cyan/35 focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/15" onChange={(event) => settingsRoute ? setSettingsSearch(event.target.value) : setBillingSearch(event.target.value)} placeholder={settingsRoute ? 'Search settings…' : 'Search billing…'} type="search" value={settingsRoute ? settingsSearch : billingSearch} />
          </label>}

          {!settingsRoute && !billingRoute && <label className="relative hidden lg:block">
            <span className="sr-only">Workspace timezone</span>
            <select className="min-h-10 min-w-52 max-w-[17rem] appearance-none rounded-xl border border-border-soft bg-panel/70 pl-3 pr-9 text-xs text-text-main transition hover:border-brand-cyan/35 focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/15" onChange={(event) => setTimezone(event.target.value)} value={timezone}>
              {timezoneOptions.map((zone) => <option key={zone} value={zone}>{`Timezone · ${timezoneLabel(zone)}`}</option>)}
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-text-soft" />
          </label>}

          <button aria-label={refreshing ? `Refreshing ${workspace.title}` : `Refresh ${workspace.title}`} className="inline-flex size-9 items-center justify-center gap-2 sm:size-10 rounded-xl border border-border-soft bg-panel/70 text-xs font-semibold text-text-muted transition duration-200 hover:-translate-y-0.5 hover:border-brand-cyan/40 hover:bg-panel-hover/80 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan disabled:cursor-wait disabled:opacity-70 motion-reduce:transform-none motion-reduce:transition-none 2xl:w-auto 2xl:px-3" disabled={refreshing} onClick={() => void refreshWorkspace()} type="button">
            <RefreshCw aria-hidden="true" className={`size-4 ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
            <span className="hidden 2xl:inline">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>

          <NotificationCenter overview={overview} />

          {billingRoute && <Button aria-label="Open billing help" className="hidden sm:inline-flex" onClick={() => setBillingHelpOpen(true)} size="sm" type="button"><CircleHelp aria-hidden="true" className="size-4" /><span className="hidden xl:inline">Billing Help</span></Button>}

          <details className="group relative" ref={profileMenu}>
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl p-1 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan sm:p-1.5">
              <span aria-hidden="true" className="grid size-8 place-items-center rounded-full sm:size-9 border border-brand-blue/45 bg-gradient-to-br from-brand-blue/20 to-brand-cyan/8 text-xs font-bold text-brand-cyan shadow-glow-blue">{initials(name)}</span>
              <span className="hidden text-left 2xl:block"><strong className="block max-w-40 truncate text-xs">{name}</strong><small className="text-[10px] uppercase tracking-wide text-text-muted">{overview?.license.plan || 'Account'}</small></span>
              <ChevronDown aria-hidden="true" className="hidden size-3 text-text-soft transition group-open:rotate-180 2xl:block" />
            </summary>
            <div className="notification-pop absolute right-0 top-full mt-2 w-48 rounded-xl border border-border-soft bg-panel p-2 shadow-panel">
              <a className="block rounded-lg px-3 py-2 text-xs text-text-muted transition hover:bg-panel-hover hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/app/settings" onClick={() => { if (profileMenu.current) profileMenu.current.open = false }}>Account</a>
              <a className="block rounded-lg px-3 py-2 text-xs text-text-muted transition hover:bg-panel-hover hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/app/settings" onClick={() => { if (profileMenu.current) profileMenu.current.open = false }}>Settings</a>
              <a className="block rounded-lg px-3 py-2 text-xs text-text-muted transition hover:bg-panel-hover hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/app/billing" onClick={() => { if (profileMenu.current) profileMenu.current.open = false }}>Billing</a>
              <div className="my-1 border-t border-border-soft" />
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[#fda4af] transition hover:bg-brand-red/10 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-red" onClick={signOut} type="button"><LogOut aria-hidden="true" className="size-3.5" />Sign out</button>
            </div>
          </details>
        </div>
      </div>
    </header>
  )
}
