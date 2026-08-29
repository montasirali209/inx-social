import { BarChart3, CalendarPlus, FilePlus2, UploadCloud } from 'lucide-react'
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
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
        {actions.map(({ label, href, icon: Icon }) => (
          <a className="group flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-border-soft bg-bg-soft/55 px-2 text-center text-[11px] font-semibold text-text-muted transition duration-200 hover:border-brand-blue/35 hover:bg-panel-hover/55 hover:text-text-main focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan" href={href} key={label}>
            <Icon aria-hidden="true" className="size-5 text-[#68aeff] transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none" />
            {label}
          </a>
        ))}
      </div>
    </DashboardCard>
  )
}
