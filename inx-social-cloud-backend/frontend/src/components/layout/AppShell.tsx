import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  CreditCard,
  FileText,
  Images,
  LayoutDashboard,
  Menu,
  Settings,
  Sparkles,
  UploadCloud,
  UsersRound,
  X,
} from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { Button } from '../ui/Button'
import { useUiStore } from '../../store/ui-store'

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard, current: true },
  { label: 'Bulk Scheduler', icon: UploadCloud },
  { label: 'Content Calendar', icon: CalendarDays },
  { label: 'Posts', icon: FileText },
  { label: 'Media Library', icon: Images },
  { label: 'AI Content Studio', icon: Sparkles },
  { label: 'Analytics', icon: BarChart3 },
  { label: 'Settings', icon: Settings },
  { label: 'Connected Accounts', icon: UsersRound },
  { label: 'Billing & Plans', icon: CreditCard },
]

function Navigation() {
  return (
    <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1">
      {navigation.map(({ label, icon: Icon, current }) => (
        <button
          aria-current={current ? 'page' : undefined}
          className={`group flex min-h-11 items-center gap-3 rounded-control border px-3 text-left text-sm font-medium transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none ${current ? 'border-accent-blue/35 bg-accent-blue/12 text-text-primary' : 'border-transparent text-text-secondary hover:bg-bg-elevated hover:text-text-primary'}`}
          disabled={!current}
          key={label}
          type="button"
        >
          <Icon aria-hidden="true" className="size-[18px] shrink-0" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {current && <ChevronRight aria-hidden="true" className="size-4 text-accent-blue" />}
        </button>
      ))}
    </nav>
  )
}

export function AppShell() {
  const mobileNavigationOpen = useUiStore((state) => state.mobileNavigationOpen)
  const setMobileNavigationOpen = useUiStore((state) => state.setMobileNavigationOpen)

  return (
    <div className="min-h-dvh bg-bg-app text-text-primary">
      <a className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-accent-blue focus:px-4 focus:py-2 focus:text-white" href="#main-content">
        Skip to content
      </a>

      {mobileNavigationOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/65 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNavigationOpen(false)}
          type="button"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-border-subtle bg-bg-sidebar p-4 transition-transform duration-200 ease-out motion-reduce:transition-none lg:translate-x-0 ${mobileNavigationOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-7 flex min-h-14 items-center justify-between gap-3 px-2">
          <img alt="INX Social" className="h-auto w-[176px] object-contain" src="/assets/inx-social-wordmark.png" />
          <Button aria-label="Close navigation" className="size-10 px-0 lg:hidden" onClick={() => setMobileNavigationOpen(false)} variant="ghost">
            <X aria-hidden="true" className="size-5" />
          </Button>
        </div>
        <Navigation />
        <div className="mt-5 rounded-card border border-border-subtle bg-bg-elevated p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-cyan">Current experience</p>
          <p className="mt-2 text-sm leading-6 text-text-secondary">Existing workflows remain available while each React screen is verified.</p>
          <a className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-control border border-border-strong px-3 text-sm font-semibold text-text-primary transition-colors duration-200 ease-out hover:border-accent-blue/60 hover:bg-bg-panel-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue motion-reduce:transition-none" href="/studio/">
            Open current Studio
          </a>
        </div>
      </aside>

      <div className="lg:pl-[280px]">
        <header className="sticky top-0 z-20 flex min-h-[72px] items-center justify-between gap-4 border-b border-border-subtle bg-bg-app/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button aria-label="Open navigation" className="size-10 shrink-0 px-0 lg:hidden" onClick={() => setMobileNavigationOpen(true)} variant="ghost">
              <Menu aria-hidden="true" className="size-5" />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold sm:text-lg">INX Social</p>
              <p className="truncate text-xs text-text-secondary">Professional SaaS migration</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-right sm:block">
              <strong className="block text-sm">INX Social Admin</strong>
              <small className="text-text-secondary">Foundation preview</small>
            </span>
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-full border border-accent-blue/30 bg-accent-blue/12 text-sm font-bold text-accent-cyan">IA</span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
