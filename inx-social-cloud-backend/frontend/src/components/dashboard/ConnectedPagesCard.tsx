import { ArrowUpRight, CheckCircle2, Link2 } from 'lucide-react'
import type { ConnectedPage } from '../../types/dashboard'
import { DashboardCard } from './DashboardCard'

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'FB'
}

export function ConnectedPagesCard({ pages }: { pages: ConnectedPage[] }) {
  return (
    <DashboardCard
      action={<a className="inline-flex items-center gap-1 text-xs font-semibold text-[#6db2ff] hover:text-brand-cyan focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/studio/?view=pages">Manage <ArrowUpRight aria-hidden="true" className="size-3.5" /></a>}
      title="Connected Pages"
    >
      {pages.length === 0 ? (
        <div className="flex min-h-24 items-center gap-3 px-4 py-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-amber/10 text-brand-amber"><Link2 aria-hidden="true" className="size-5" /></span>
          <div><strong className="text-sm">No connected Pages</strong><p className="mt-1 text-xs text-text-muted">Connect Facebook to begin scheduling.</p></div>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
          {pages.slice(0, 6).map((page) => (
            <li className="min-w-0 rounded-xl border border-border-soft bg-bg-soft/55 p-3" key={page.id}>
              <div className="flex items-center gap-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#1877f2] text-[11px] font-bold text-white" title={page.facebookPageName}>{initials(page.facebookPageName)}</span>
                <span className="min-w-0"><strong className="block truncate text-xs">{page.facebookPageName}</strong><small className="mt-0.5 flex items-center gap-1 text-[10px] text-brand-green"><CheckCircle2 aria-hidden="true" className="size-3" /> Connected</small></span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  )
}
