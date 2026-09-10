import { Activity, ArrowDownRight, ArrowUpRight, Minus, Radio, UsersRound } from 'lucide-react'
import { formatAnalyticsValue } from '../../data/analyticsData'
import type { PerformancePoint } from '../../types/analytics'
import type { PlatformAnalytics } from '../../types/dashboard'
import { AnalyticsCard, AnalyticsCardHeader, UnavailableState } from './AnalyticsPrimitives'

export function AudienceGrowthCard({ points, total }: { points: PerformancePoint[]; total: number | null }) {
  const maximum = Math.max(1, ...points.map(point => Math.abs(point.followers)))
  return <AnalyticsCard><AnalyticsCardHeader description="Follower or subscriber change returned by the selected platform for this period." title="Audience Growth" />{total === null ? <UnavailableState detail="This connected account did not return audience-growth data for the selected period." title="Audience growth unavailable" /> : <div className="px-5 pb-5"><strong className="text-2xl">{formatAnalyticsValue(total, 'compact')}</strong><p className="mt-1 text-[10px] text-text-muted">Net audience change in this period</p><div className="mt-5 flex h-40 items-end gap-1 border-b border-border-soft">{points.map((point, index) => <span className="analytics-rise-bar group relative min-w-0 flex-1 rounded-t bg-gradient-to-t from-brand-teal/55 to-brand-cyan transition hover:brightness-125" key={point.date} style={{ height: `${Math.max(2, Math.abs(point.followers) / maximum * 100)}%`, animationDelay: `${index * 24}ms` }}><span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-bg px-2 py-1 text-[9px] shadow-panel group-hover:block">{point.label}: {point.followers}</span></span>)}</div><div className="mt-2 flex justify-between text-[9px] text-text-soft"><span>{points[0]?.label}</span><span>{points.at(-1)?.label}</span></div></div>}</AnalyticsCard>
}

type AudiencePulseProps = {
  platform: PlatformAnalytics['platform']
  audience: number | null
  growth: number | null
  interactions: number
  contentCount: number
  days: number
}

function platformName(platform: PlatformAnalytics['platform']) {
  if (platform === 'youtube') return 'YouTube'
  if (platform === 'instagram') return 'Instagram'
  if (platform === 'linkedin') return 'LinkedIn'
  return 'Facebook'
}

function signedCompact(value: number | null) {
  if (value === null) return 'Unavailable'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${formatAnalyticsValue(value, 'compact')}`
}

function signedPercent(value: number | null) {
  if (value === null) return 'Unavailable'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(2)}%`
}

export function AudiencePulseCard({ platform, audience, growth, interactions, contentCount, days }: AudiencePulseProps) {
  const startAudience = audience !== null && growth !== null ? audience - growth : null
  const growthRate = startAudience !== null && startAudience > 0 && growth !== null ? (growth / startAudience) * 100 : null
  const interactionsPerThousand = audience !== null && audience > 0 ? (interactions / audience) * 1000 : null
  const weeklyPublishingPace = platform === 'youtube' ? null : days > 0 ? (contentCount / days) * 7 : null
  const TrendIcon = growth === null || growth === 0 ? Minus : growth > 0 ? ArrowUpRight : ArrowDownRight
  const trendLabel = growth === null ? 'Growth unavailable' : growth > 0 ? 'Audience increased' : growth < 0 ? 'Audience decreased' : 'Audience held steady'
  const audienceLabel = platform === 'youtube' ? 'Subscribers' : platform === 'linkedin' ? 'Followers / members' : 'Followers'
  const countLabel = platform === 'youtube' ? 'Channel videos' : 'Published content'

  return <AnalyticsCard>
    <AnalyticsCardHeader description={`A verified, cross-platform snapshot built from the ${platformName(platform)} metrics available for this account.`} title="Audience Pulse" />
    <div className="px-5 pb-5">
      <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <div className="analytics-audience-orb relative grid size-28 place-items-center rounded-full border border-brand-cyan/25 bg-bg/45 shadow-[inset_0_0_34px_rgba(45,212,191,.09),0_0_34px_rgba(20,184,166,.10)]">
          <UsersRound aria-hidden="true" className="absolute top-4 size-4 text-brand-cyan/75" />
          <strong className="mt-3 text-xl">{audience === null ? '—' : formatAnalyticsValue(audience, 'compact')}</strong>
          <small className="-mt-3 text-[8px] uppercase tracking-wider text-text-soft">{audienceLabel}</small>
        </div>
        <div className="rounded-xl border border-border-soft bg-bg/30 p-3">
          <div className="flex items-center gap-2"><span className={`grid size-8 place-items-center rounded-lg ${growth !== null && growth < 0 ? 'bg-brand-red/10 text-brand-red' : 'bg-brand-cyan/10 text-brand-cyan'}`}><TrendIcon aria-hidden="true" className="size-4" /></span><span><strong className="block text-sm">{trendLabel}</strong><small className="text-[9px] text-text-soft">Selected {days}-day period</small></span></div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border-soft"><span className="block h-full rounded-full bg-gradient-to-r from-brand-teal to-brand-cyan transition-all duration-500" style={{ width: `${growthRate === null ? 0 : Math.min(100, Math.max(5, Math.abs(growthRate) * 8))}%` }} /></div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border-soft bg-bg/30 p-3"><span className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-text-soft"><Activity className="size-3" />Net growth</span><strong className="mt-1.5 block text-lg">{signedCompact(growth)}</strong><small className="text-[9px] text-text-soft">Verified audience change</small></div>
        <div className="rounded-xl border border-border-soft bg-bg/30 p-3"><span className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-text-soft"><ArrowUpRight className="size-3" />Growth rate</span><strong className="mt-1.5 block text-lg">{signedPercent(growthRate)}</strong><small className="text-[9px] text-text-soft">Change vs period-start audience</small></div>
        <div className="rounded-xl border border-border-soft bg-bg/30 p-3"><span className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-text-soft"><Radio className="size-3" />Interactions / 1K</span><strong className="mt-1.5 block text-lg">{interactionsPerThousand === null ? 'Unavailable' : interactionsPerThousand.toFixed(interactionsPerThousand >= 100 ? 0 : 1)}</strong><small className="text-[9px] text-text-soft">Interactions per 1,000 audience</small></div>
        <div className="rounded-xl border border-border-soft bg-bg/30 p-3"><span className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-text-soft"><UsersRound className="size-3" />{countLabel}</span><strong className="mt-1.5 block text-lg">{formatAnalyticsValue(contentCount, 'integer')}</strong><small className="text-[9px] text-text-soft">{weeklyPublishingPace === null ? 'Verified platform total' : `${weeklyPublishingPace.toFixed(1)} per week in this period`}</small></div>
      </div>
    </div>
  </AnalyticsCard>
}
