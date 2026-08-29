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
        <ul className="grid gap-2.5 p-4 sm:grid-cols-2 2xl:grid-cols-2">
          {pages.slice(0, 6).map((page) => (
            <li className="group/page min-w-0 rounded-xl border border-border-soft bg-bg-soft/48 p-3 transition duration-200 hover:-translate-y-0.5 hover:border-[#1877f2]/35 hover:bg-[#1877f2]/[0.065] motion-reduce:transition-none" key={page.id}>
              <div className="flex items-center gap-3">
                <span className="relative grid size-11 shrink-0 place-items-center rounded-full border border-[#4a9cff]/30 bg-gradient-to-br from-[#2991ff] to-[#0758bd] text-sm font-bold text-white shadow-[0_0_20px_rgba(24,119,242,0.18)]" title={page.facebookPageName}><span aria-hidden="true" className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full border-2 border-panel bg-white text-[10px] font-black text-[#1877f2]">f</span>{initials(page.facebookPageName)}</span>
                <span className="min-w-0"><strong className="block truncate text-xs" title={page.facebookPageName}>{page.facebookPageName}</strong><small className="mt-1 flex items-center gap-1 text-[10px] text-brand-green"><CheckCircle2 aria-hidden="true" className="size-3" /> Connected & active</small></span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  )
}
