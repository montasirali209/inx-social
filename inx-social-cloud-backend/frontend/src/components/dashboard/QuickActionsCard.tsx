import { ArrowUpRight, BarChart3, CalendarPlus, FilePlus2, UploadCloud } from 'lucide-react'
import { DashboardCard } from './DashboardCard'

const actions = [
  { label: 'Upload Video', href: '/studio/?view=reels', icon: UploadCloud },
  { label: 'Schedule Video', href: '/studio/?view=reels', icon: CalendarPlus },
  { label: 'Create Post', href: '/studio/?view=posts', icon: FilePlus2 },
  { label: 'View Analytics', href: '/app/analytics', icon: BarChart3 },
]

export function QuickActionsCard() {
  return (
    <DashboardCard title="Quick Actions">
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
        {actions.map(({ label, href, icon: Icon }) => (
          <a className="group relative flex min-h-20 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-border-soft bg-bg-soft/48 p-2 text-center text-[10px] font-semibold text-text-muted transition duration-200 hover:-translate-y-1 hover:border-brand-blue/40 hover:bg-brand-blue/[0.075] hover:text-text-main hover:shadow-glow-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan motion-reduce:transition-none" href={href} key={label}>
            <span className="grid size-9 place-items-center rounded-xl border border-brand-blue/20 bg-brand-blue/10 text-[#68aeff] transition duration-200 group-hover:scale-105 group-hover:bg-brand-blue/18 motion-reduce:transition-none"><Icon aria-hidden="true" className="size-4.5" /></span>
            <span className="flex items-center justify-center gap-1"><span>{label}</span><ArrowUpRight aria-hidden="true" className="size-3 shrink-0 opacity-45 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100 motion-reduce:transition-none" /></span>
          </a>
        ))}
      </div>
    </DashboardCard>
  )
}
