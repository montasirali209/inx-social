import { Check, Crown } from 'lucide-react'
import type { StudioOverview } from '../../types/dashboard'

export function PlanCard({ overview }: { overview: StudioOverview | undefined }) {
  const plan = overview?.license.plan || 'Account'
  const connected = overview?.pages.length ?? 0
  const limit = overview?.license.limits.pages
  return (
    <section className="overflow-hidden rounded-card border border-brand-blue/25 bg-[radial-gradient(circle_at_90%_10%,rgba(45,212,191,0.12),transparent_8rem),linear-gradient(145deg,rgba(20,184,166,0.1),rgba(7,25,35,0.96)_52%,rgba(16,185,129,0.05))] p-4 shadow-glow-blue">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-cyan">{plan} plan</p>
      <p className="mt-2.5 text-sm font-semibold">{overview?.license.allowed ? `You're on the ${plan} Plan` : 'Your publishing access needs attention'}</p>
      <ul className="mt-3 grid gap-2 text-[11px] text-text-muted"><li className="flex items-center gap-2"><Check aria-hidden="true" className="size-3.5 text-brand-cyan" /> {limit === null || limit === undefined ? 'Connected Pages included' : `${limit} connected Page allowance`}</li><li className="flex items-center gap-2"><Check aria-hidden="true" className="size-3.5 text-brand-cyan" /> {connected} currently connected</li><li className="flex items-center gap-2"><Check aria-hidden="true" className="size-3.5 text-brand-cyan" /> {overview?.license.allowed ? 'Publishing access active' : 'Action required'}</li></ul>
      <a className="mt-4 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-brand-blue/30 bg-brand-blue/8 px-3 text-xs font-semibold transition hover:-translate-y-0.5 hover:bg-brand-blue/16 focus-visible:outline-2 focus-visible:outline-brand-cyan motion-reduce:transition-none" href="/portal/#overview"><Crown aria-hidden="true" className="size-4 text-brand-cyan" /> Manage Plan</a>
    </section>
  )
}
