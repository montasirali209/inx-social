import { Menu } from 'lucide-react'
import type { StudioOverview } from '../../types/dashboard'
import { useUiStore } from '../../store/ui-store'
import { Button } from '../ui/Button'

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'IN'
}

export function Topbar({ overview }: { overview?: StudioOverview }) {
  const setOpen = useUiStore((state) => state.setMobileNavigationOpen)
  const name = overview?.user.name || overview?.user.businessName || 'INX Social account'
  return (
    <header className="sticky top-0 z-20 flex min-h-[72px] items-center justify-between gap-4 border-b border-border-soft bg-bg/80 px-4 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-2xl sm:px-6 xl:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Button aria-label="Open navigation" className="size-10 shrink-0 px-0 md:hidden" onClick={() => setOpen(true)} variant="ghost"><Menu aria-hidden="true" className="size-5" /></Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold sm:text-base">INX Social</p>
          <p className="truncate text-xs text-text-muted">Video Scheduler</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-right sm:block"><strong className="block max-w-52 truncate text-sm">{name}</strong><small className="text-text-muted">{overview?.license.plan ? `${overview.license.plan} · ${overview.license.allowed ? 'Active' : 'Action required'}` : 'Loading account…'}</small></span>
        <span aria-hidden="true" className="grid size-10 place-items-center rounded-full border border-brand-blue/45 bg-gradient-to-br from-brand-blue/20 to-brand-cyan/8 text-sm font-bold text-brand-cyan shadow-glow-blue">{initials(name)}</span>
      </div>
    </header>
  )
}
