import { formatAnalyticsValue } from '../../data/analyticsData'
import type { PerformancePoint } from '../../types/analytics'
import { AnalyticsCard, AnalyticsCardHeader, UnavailableState } from './AnalyticsPrimitives'

export function AudienceGrowthCard({ points, total }: { points: PerformancePoint[]; total: number | null }) {
  const maximum = Math.max(1, ...points.map((point) => point.followers))
  return <AnalyticsCard><AnalyticsCardHeader description="Daily Page follows returned by Meta when read_insights supports this metric." title="Audience Growth" />{total === null ? <UnavailableState detail="Reconnect the Page after read_insights is approved, or wait until Meta returns Page follow data." title="Audience growth unavailable" /> : <div className="px-5 pb-5"><strong className="text-2xl">{formatAnalyticsValue(total, 'compact')}</strong><p className="mt-1 text-[10px] text-text-muted">New follows in this period</p><div className="mt-5 flex h-40 items-end gap-1 border-b border-border-soft">{points.map((point) => <span className="group relative min-w-0 flex-1 rounded-t bg-gradient-to-t from-brand-teal/55 to-brand-cyan transition hover:brightness-125" key={point.date} style={{ height: `${Math.max(2, point.followers / maximum * 100)}%` }}><span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-bg px-2 py-1 text-[9px] shadow-panel group-hover:block">{point.label}: {point.followers}</span></span>)}</div><div className="mt-2 flex justify-between text-[9px] text-text-soft"><span>{points[0]?.label}</span><span>{points.at(-1)?.label}</span></div></div>}</AnalyticsCard>
}

export function AudienceDemographicsCard() {
  return <AnalyticsCard><AnalyticsCardHeader description="Audience gender and age are not returned by the current Facebook Page Insights integration." title="Audience Demographics" /><UnavailableState detail="INX Social will show real gender and age breakdowns here when a connected platform provides these metrics. No estimated demographic data is displayed." title="Demographics unavailable from Meta" /></AnalyticsCard>
}
