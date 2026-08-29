import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  CreditCard,
  Film,
  Images,
  LayoutDashboard,
  ListVideo,
  Settings,
  UploadCloud,
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
  { label: 'Scheduler', icon: CalendarRange, legacyView: 'reels' },
  { label: 'Content Calendar', icon: CalendarDays, legacyView: 'calendar' },
  { label: 'Videos', icon: Film, legacyView: 'reels' },
  { label: 'Media Library', icon: Images, legacyView: 'media' },
  { label: 'Publishing Queue', icon: ListVideo, legacyView: 'reels' },
  { label: 'Analytics', icon: BarChart3, legacyView: 'analytics' },
  { label: 'Settings', icon: Settings, legacyView: 'settings' },
  { label: 'Connected Accounts', icon: UsersRound, legacyView: 'pages' },
  { label: 'Billing & Plans', icon: CreditCard, externalPath: '/portal/#overview' },
]

const itemClasses = 'interactive-nav group relative flex min-h-11 items-center gap-3 overflow-hidden rounded-xl border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan md:justify-center md:px-2 xl:justify-start xl:px-3'

export function Sidebar({ overview }: { overview?: StudioOverview }) {
  const open = useUiStore((state) => state.mobileNavigationOpen)
  const setOpen = useUiStore((state) => state.setMobileNavigationOpen)

  return (
    <>
      {open && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} type="button" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col overflow-hidden border-r border-border-soft bg-[radial-gradient(circle_at_10%_8%,rgba(36,135,255,0.14),transparent_19rem),linear-gradient(180deg,rgba(6,20,36,0.985),rgba(4,14,27,0.985))] p-3 shadow-[18px_0_70px_rgba(0,0,0,0.25)] backdrop-blur-xl transition-transform duration-200 ease-out before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(120deg,rgba(255,255,255,0.025),transparent_38%)] motion-reduce:transition-none md:w-[88px] md:translate-x-0 xl:w-[264px] ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex min-h-16 items-center justify-between gap-2 px-2 md:justify-center xl:justify-between">
          <img alt="INX Social" className="h-auto w-[178px] object-contain md:w-12 xl:w-[178px]" src="/assets/inx-social-wordmark.png" />
          <Button aria-label="Close navigation" className="size-10 px-0 md:hidden" onClick={() => setOpen(false)} variant="ghost"><X aria-hidden="true" className="size-5" /></Button>
        </div>

        <nav aria-label="Main navigation" className="mt-5 flex flex-1 flex-col gap-1.5 overflow-y-auto">
          {navigation.map(({ label, icon: Icon, reactPath, legacyView, externalPath }) => {
            const content = <><Icon aria-hidden="true" className="size-[19px] shrink-0" /><span className="min-w-0 flex-1 truncate md:hidden xl:block">{label}</span></>
            if (reactPath) {
              return <NavLink className={({ isActive }) => `${itemClasses} ${isActive ? 'border-brand-blue/50 bg-gradient-to-r from-brand-blue/20 to-brand-cyan/5 text-text-main shadow-glow-blue before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-brand-cyan before:shadow-[0_0_12px_#22d3ee]' : 'border-transparent text-text-muted hover:border-white/5 hover:bg-panel-hover/55 hover:text-text-main'}`} end key={label} onClick={() => setOpen(false)} to={reactPath}>{content}</NavLink>
            }
            return <a className={`${itemClasses} border-transparent text-text-muted hover:border-white/5 hover:bg-panel-hover/55 hover:text-text-main`} href={externalPath || `/studio/?view=${legacyView}`} key={label} title={label}>{content}</a>
          })}
        </nav>

        <div className="mt-4 hidden xl:block"><PlanCard overview={overview} /></div>
        <a aria-label="Upload video" className="mt-3 hidden min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-blue/30 bg-brand-blue/12 text-brand-cyan focus-visible:outline-2 focus-visible:outline-brand-cyan md:flex xl:hidden" href="/studio/?view=reels"><UploadCloud aria-hidden="true" className="size-5" /></a>
      </aside>
    </>
  )
}
