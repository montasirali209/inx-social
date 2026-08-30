import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  CreditCard,
  FilePlus2,
  FileText,
  Images,
  LayoutDashboard,
  Sparkles,
  Settings,
  UsersRound,
  X,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import type { StudioOverview } from '../../types/dashboard'
import { useUiStore } from '../../store/ui-store'
import { PlanCard } from '../dashboard/PlanCard'
import { Button } from '../ui/Button'

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard, reactPath: '/' },
  { label: 'Bulk Scheduler', icon: CalendarRange, reactPath: '/bulk-scheduler' },
  { label: 'Content Calendar', icon: CalendarDays, reactPath: '/content-calendar' },
  { label: 'Posts', icon: FileText, reactPath: '/posts' },
  { label: 'Media Library', icon: Images, reactPath: '/media-library' },
  { label: 'AI Content Studio', icon: Sparkles, legacyView: 'agent' },
  { label: 'Analytics', icon: BarChart3, legacyView: 'analytics' },
  { label: 'Settings', icon: Settings, legacyView: 'settings' },
  { label: 'Connected Accounts', icon: UsersRound, legacyView: 'pages' },
  { label: 'Billing & Plans', icon: CreditCard, externalPath: '/portal/#overview' },
]

const itemClasses = 'interactive-nav group relative flex min-h-10 items-center gap-3 overflow-hidden rounded-xl border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan md:justify-center md:px-2 xl:justify-start xl:px-3'

export function Sidebar({ overview }: { overview?: StudioOverview }) {
  const open = useUiStore((state) => state.mobileNavigationOpen)
  const setOpen = useUiStore((state) => state.setMobileNavigationOpen)

  return (
    <>
      {open && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} type="button" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col overflow-hidden border-r border-border-soft bg-[radial-gradient(circle_at_10%_8%,rgba(20,184,166,0.13),transparent_19rem),linear-gradient(180deg,rgba(3,17,30,0.99),rgba(2,12,22,0.99))] p-3 shadow-[18px_0_70px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-transform duration-200 ease-out before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(120deg,rgba(255,255,255,0.025),transparent_38%)] motion-reduce:transition-none md:w-[88px] md:translate-x-0 xl:w-[264px] ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex min-h-14 items-center justify-between gap-2 px-2 md:justify-center xl:justify-between">
          <img alt="INX Social" className="h-auto w-[178px] object-contain md:w-12 xl:w-[178px]" src="/assets/inx-social-wordmark.png" />
          <Button aria-label="Close navigation" className="size-10 px-0 md:hidden" onClick={() => setOpen(false)} variant="ghost"><X aria-hidden="true" className="size-5" /></Button>
        </div>

        <NavLink className="group mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand-cyan/45 bg-gradient-to-r from-brand-blue to-[#0f8f7f] px-4 text-sm font-bold text-white shadow-[0_14px_34px_rgba(20,184,166,0.2)] transition duration-200 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan motion-reduce:transition-none" onClick={() => setOpen(false)} to="/posts">
          <FilePlus2 aria-hidden="true" className="size-5 shrink-0 transition group-hover:rotate-6 motion-reduce:transition-none" />
          <span className="md:hidden xl:inline">Create New Post</span>
        </NavLink>

        <nav aria-label="Main navigation" className="mt-3 flex flex-1 flex-col gap-1 overflow-y-auto">
          {navigation.map(({ label, icon: Icon, reactPath, legacyView, externalPath }) => {
            const content = <><Icon aria-hidden="true" className="size-[19px] shrink-0" /><span className="min-w-0 flex-1 truncate md:hidden xl:block">{label}</span></>
            if (reactPath) {
              return <NavLink className={({ isActive }) => `${itemClasses} ${isActive ? 'border-brand-cyan/50 bg-gradient-to-r from-brand-blue/22 to-brand-cyan/5 text-text-main shadow-glow-blue before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-brand-cyan before:shadow-[0_0_12px_#2dd4bf]' : 'border-transparent text-text-muted hover:border-white/5 hover:bg-panel-hover/55 hover:text-text-main'}`} end key={label} onClick={() => setOpen(false)} to={reactPath}>{content}</NavLink>
            }
            return <a className={`${itemClasses} border-transparent text-text-muted hover:border-white/5 hover:bg-panel-hover/55 hover:text-text-main`} href={externalPath || `/studio/?view=${legacyView}`} key={label} title={label}>{content}</a>
          })}
        </nav>

        <div className="mt-4 hidden xl:block"><PlanCard overview={overview} /></div>
      </aside>
    </>
  )
}
