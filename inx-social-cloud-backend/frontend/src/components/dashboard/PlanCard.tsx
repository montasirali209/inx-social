import { Crown } from 'lucide-react'
import type { StudioOverview } from '../../types/dashboard'

export function PlanCard({ overview }: { overview: StudioOverview | undefined }) {
  const plan = overview?.license.plan || 'Account'
  const connected = overview?.pages.length ?? 0
  const limit = overview?.license.limits.pages
  const percentage = limit ? Math.min(100, Math.round((connected / limit) * 100)) : 0
  return (
    <section className="interactive-surface overflow-hidden rounded-card border border-brand-blue/25 bg-[radial-gradient(circle_at_90%_10%,rgba(139,92,246,0.18),transparent_8rem),linear-gradient(145deg,rgba(36,135,255,0.14),rgba(10,27,45,0.94)_52%,rgba(139,92,246,0.08))] p-4 shadow-glow-blue">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-cyan">{plan} plan</p>
      <p className="mt-3 text-sm font-semibold">{overview?.license.allowed ? 'Your publishing access is active' : 'Your publishing access needs attention'}</p>
      <p className="mt-2 text-xs leading-5 text-text-muted">{limit ? `${connected} of ${limit} connected Pages used.` : `${connected} connected Pages.`}</p>
      {limit && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8"><span className="block h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-blue" style={{ width: `${percentage}%` }} /></div>}
      <a className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-brand-blue/30 bg-brand-blue/10 px-3 text-xs font-semibold transition hover:-translate-y-0.5 hover:bg-brand-blue/18 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan motion-reduce:transition-none" href="/portal/#overview"><Crown aria-hidden="true" className="size-4 text-brand-cyan" /> Manage plan</a>
    </section>
  )
}
