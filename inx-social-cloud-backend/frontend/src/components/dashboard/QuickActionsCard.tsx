import { BarChart3, CalendarDays, FilePlus2, ImageUp } from 'lucide-react'
import { DashboardCard } from './DashboardCard'

const actions = [
  { label: 'Open Calendar', detail: 'View your schedule', href: '/app/content-calendar', icon: CalendarDays },
  { label: 'Schedule Content', detail: 'Create and schedule', href: '/app/posts', icon: FilePlus2 },
  { label: 'Upload Media', detail: 'Add to library', href: '/app/media-library?upload=1', icon: ImageUp },
  { label: 'View Analytics', detail: 'See detailed insights', href: '/app/analytics', icon: BarChart3 },
]

export function QuickActionsCard() {
  return (
    <DashboardCard className="min-h-[92px]" title="Quick Actions">
      <div className="grid grid-cols-2 gap-2 p-2.5 sm:grid-cols-4">
        {actions.map(({ label, detail, href, icon: Icon }) => (
          <a className="group flex min-h-12 items-center gap-2 rounded-xl border border-border-soft bg-bg-soft/48 px-2.5 py-2 text-left transition duration-200 hover:-translate-y-0.5 hover:border-brand-cyan/30 hover:bg-brand-cyan/[.055] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan motion-reduce:transform-none motion-reduce:transition-none" href={href} key={label}>
            <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-brand-cyan/18 bg-brand-cyan/[.08] text-brand-cyan transition group-hover:scale-105 motion-reduce:transition-none"><Icon aria-hidden="true" className="size-4" /></span>
            <span className="min-w-0"><strong className="block truncate text-[10px] font-semibold text-text-main">{label}</strong><small className="hidden truncate text-[8px] text-text-soft 2xl:block">{detail}</small></span>
          </a>
        ))}
      </div>
    </DashboardCard>
  )
}
