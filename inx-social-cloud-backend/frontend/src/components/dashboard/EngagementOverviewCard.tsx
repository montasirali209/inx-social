import { ArrowUpRight, BarChart3 } from 'lucide-react'
import { platformOrder, platformPresentation } from '../../data/dashboardData'
import type { PlatformMetric } from '../../types/dashboard'
import { ChartCard } from './ChartCard'
import { PlatformIcon } from './PlatformIcon'

export function EngagementOverviewCard({ metrics }: { metrics: PlatformMetric[] }) {
  const liveValues = metrics.filter((metric) => metric.engagement !== null)
  const total = liveValues.length ? liveValues.reduce((sum, metric) => sum + (metric.engagement || 0), 0) : null
  return (
    <ChartCard
      action={<a aria-label="Open Analytics" className="rounded-lg border border-border-soft px-2.5 py-1.5 text-[10px] text-text-muted transition hover:border-brand-cyan/45 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/studio/?view=analytics">Live Analytics</a>}
      className="min-h-[290px]"
      title="Engagement Overview"
    >
      <div className="px-5 pb-5">
        <div className="flex items-end justify-between gap-4">
          <span><strong className="block text-3xl tracking-[-0.04em]">{total === null ? '—' : total.toLocaleString('en-GB')}</strong><small className="text-text-muted">Total Engagement</small></span>
          {total === null ? <a className="inline-flex items-center gap-1 text-xs font-medium text-brand-cyan hover:text-white" href="/studio/?view=analytics">Check availability <ArrowUpRight aria-hidden="true" className="size-3.5" /></a> : null}
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {platformOrder.map((platform) => {
            const metric = metrics.find((item) => item.platform === platform)
            return <div className="rounded-xl border border-border-soft bg-black/12 p-2.5 text-center transition hover:-translate-y-0.5 hover:border-brand-cyan/35" key={platform}><PlatformIcon className="mx-auto size-8" platform={platform} /><strong className="mt-2 block text-xs">{metric?.engagement === null || metric?.engagement === undefined ? '—' : metric.engagement.toLocaleString('en-GB')}</strong><span className="sr-only">{platformPresentation[platform].label} engagement</span></div>
          })}
        </div>
        {total === null && <p className="mt-4 flex items-start gap-2 rounded-lg border border-brand-cyan/15 bg-brand-cyan/5 px-3 py-2 text-[10px] leading-4 text-text-muted"><BarChart3 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-brand-cyan" /> Engagement appears only when the connected platform returns permitted live analytics.</p>}
      </div>
    </ChartCard>
  )
}

