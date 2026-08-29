import { ArrowUpRight, BarChart3, CalendarPlus, FilePlus2, UploadCloud } from 'lucide-react'
import { DashboardCard } from './DashboardCard'

const actions = [
  { label: 'Upload Video', href: '/studio/?view=reels', icon: UploadCloud },
  { label: 'Schedule Video', href: '/studio/?view=reels', icon: CalendarPlus },
  { label: 'Create Post', href: '/studio/?view=posts', icon: FilePlus2 },
  { label: 'View Analytics', href: '/studio/?view=analytics', icon: BarChart3 },
]

export function QuickActionsCard() {
  return (
    <DashboardCard title="Quick Actions">
      <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-2">
        {actions.map(({ label, href, icon: Icon }) => (
          <a className="group relative flex min-h-24 flex-col items-start justify-between overflow-hidden rounded-xl border border-border-soft bg-bg-soft/48 p-3 text-left text-xs font-semibold text-text-muted transition duration-200 hover:-translate-y-1 hover:border-brand-blue/40 hover:bg-brand-blue/[0.075] hover:text-text-main hover:shadow-glow-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan motion-reduce:transition-none" href={href} key={label}>
            <span className="grid size-10 place-items-center rounded-xl border border-brand-blue/20 bg-brand-blue/10 text-[#68aeff] transition duration-200 group-hover:scale-105 group-hover:bg-brand-blue/18 motion-reduce:transition-none"><Icon aria-hidden="true" className="size-5" /></span>
            <span className="flex w-full items-end justify-between gap-2"><span>{label}</span><ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0 opacity-45 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100 motion-reduce:transition-none" /></span>
          </a>
        ))}
      </div>
    </DashboardCard>
  )
}
