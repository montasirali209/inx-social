import { Activity, ChevronDown, DatabaseZap } from 'lucide-react'
import type { PlatformAnalytics } from '../../types/dashboard'
import type { AnalyticsSourceAccount } from '../../lib/analytics-api'
import { PlatformIcon } from '../dashboard/PlatformIcon'
import { AnalyticsCard, AnalyticsCardHeader, UnavailableState } from './AnalyticsPrimitives'

export type ProviderMetricsSource = {
  account: AnalyticsSourceAccount
  analytics: PlatformAnalytics
}

function metricLabel(key: string) {
  return key
    .replace(/\./g, ' › ')
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, value => value.toUpperCase())
}

function formatMetric(value: number) {
  if (!Number.isFinite(value)) return '—'
  const absolute = Math.abs(value)
  if (absolute >= 1000) return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
  if (Number.isInteger(value)) return value.toLocaleString('en-GB')
  return value.toLocaleString('en-GB', { maximumFractionDigits: 4 })
}

export function ProviderMetricsCard({ sources }: { sources: ProviderMetricsSource[] }) {
  const withMetrics = sources.filter(source => (source.analytics.provider?.metricSummary?.length || 0) > 0)
  return <AnalyticsCard>
    <AnalyticsCardHeader
      description="Every numeric analytics field returned by Post for Me is retained here, including platform-specific video, click, reach, watch-time and organic metrics."
      title="Provider Metrics"
    />
    {withMetrics.length ? <div className="space-y-2 px-4 pb-4 sm:px-5">
      {withMetrics.map(({ account, analytics }) => {
        const metrics = analytics.provider?.metricSummary || []
        return <details className="group overflow-hidden rounded-xl border border-border-soft bg-[linear-gradient(145deg,rgba(7,29,40,.72),rgba(4,18,27,.48))]" key={account.analyticsKey} open={withMetrics.length === 1}>
          <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3 transition hover:bg-white/[.025] focus-visible:outline-2 focus-visible:outline-brand-cyan">
            <PlatformIcon className="size-8 rounded-xl" platform={account.platform} />
            <span className="min-w-0 flex-1"><strong className="block truncate text-xs">{account.displayName}</strong><small className="mt-0.5 block text-[9px] text-text-muted">{metrics.length} Post for Me metric field{metrics.length === 1 ? '' : 's'} · {analytics.provider?.postsWithMetrics || 0} measured post{analytics.provider?.postsWithMetrics === 1 ? '' : 's'}</small></span>
            <span className="inline-flex items-center gap-1 rounded-full border border-brand-teal/15 bg-brand-teal/7 px-2 py-1 text-[9px] font-semibold text-brand-cyan"><DatabaseZap className="size-3" />Live</span>
            <ChevronDown className="size-4 text-text-soft transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-border-soft p-3">
            <div className="scrollbar-thin max-h-[330px] overflow-auto rounded-lg border border-white/[.045] bg-bg/25">
              <table className="w-full min-w-[560px] border-collapse text-left text-[10px]">
                <thead className="sticky top-0 z-10 bg-[#071923]/95 text-text-soft backdrop-blur"><tr><th className="px-3 py-2 font-medium">Metric returned by provider</th><th className="px-3 py-2 text-right font-medium">Value</th><th className="px-3 py-2 text-right font-medium">Aggregation</th><th className="px-3 py-2 text-right font-medium">Samples</th></tr></thead>
                <tbody>{metrics.map(metric => <tr className="border-t border-white/[.04] hover:bg-white/[.02]" key={metric.key}><td className="max-w-[460px] px-3 py-2 text-text-muted"><span className="inline-flex items-center gap-1.5"><Activity className="size-3 shrink-0 text-brand-cyan/70" />{metricLabel(metric.key)}</span></td><td className="px-3 py-2 text-right font-semibold text-text-main">{formatMetric(metric.value)}</td><td className="px-3 py-2 text-right capitalize text-text-soft">{metric.aggregation}</td><td className="px-3 py-2 text-right text-text-soft">{metric.samples}</td></tr>)}</tbody>
              </table>
            </div>
            <p className="mt-2 text-[9px] leading-4 text-text-soft">Count-like fields are summed across posts in the selected period. Rate, percentage and average fields are averaged. The original per-post provider metric object is retained with each analytics item.</p>
          </div>
        </details>
      })}
    </div> : <UnavailableState detail="Post for Me has not returned numeric provider metrics for the selected sources yet. Feed content will continue to auto-update." title="Provider metrics are not available yet" />}
  </AnalyticsCard>
}
