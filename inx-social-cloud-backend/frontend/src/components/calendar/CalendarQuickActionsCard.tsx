import { BarChart3, ChevronRight, FilePenLine, ImagePlus, PlusCircle } from 'lucide-react'

export function CalendarQuickActionsCard({ date, time }: { date: string; time: string }) {
  const scheduleUrl = `/studio/?view=posts&scheduleDate=${encodeURIComponent(date)}${time ? `&scheduleTime=${encodeURIComponent(time)}` : ''}`
  const actions = [
    { label: 'Schedule Content', href: scheduleUrl, icon: PlusCircle },
    { label: 'Create Draft', href: '/studio/?view=posts&draft=true', icon: FilePenLine },
    { label: 'Upload Media', href: '/studio/?view=media', icon: ImagePlus },
    { label: 'View Analytics', href: '/studio/?view=analytics', icon: BarChart3 },
  ]
  return <section className="overflow-hidden rounded-card border border-border-soft bg-panel/55"><h3 className="border-b border-border-soft px-3.5 py-3 text-xs font-semibold">Quick Actions</h3><nav aria-label="Selected date actions" className="divide-y divide-border-soft">{actions.map(({ label, href, icon: Icon }) => <a className="group flex min-h-10 items-center gap-2 px-3.5 text-[11px] text-text-muted transition hover:bg-panel-hover/45 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" href={href} key={label}><Icon aria-hidden="true" className="size-3.5 text-brand-cyan" /><span className="flex-1">{label}</span><ChevronRight aria-hidden="true" className="size-3 transition group-hover:translate-x-0.5" /></a>)}</nav></section>
}
