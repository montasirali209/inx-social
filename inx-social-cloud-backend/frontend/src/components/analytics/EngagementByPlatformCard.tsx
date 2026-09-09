import { formatAnalyticsValue } from '../../data/analyticsData'
import type { PlatformAnalytics } from '../../types/dashboard'
import { PlatformIcon } from '../dashboard/PlatformIcon'
import { AnalyticsCard, AnalyticsCardHeader } from './AnalyticsPrimitives'

const labels: Record<PlatformAnalytics['platform'], string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
}

export function EngagementByPlatformCard({ total, platform }: { total: number; platform: PlatformAnalytics['platform'] }) {
  return <AnalyticsCard><AnalyticsCardHeader description={`Verified interactions returned by the selected ${labels[platform]} account.`} title="Engagement by Platform" /><div className="grid items-center gap-5 px-5 pb-5 sm:grid-cols-[minmax(150px,190px)_1fr] xl:grid-cols-1 2xl:grid-cols-[minmax(140px,180px)_1fr]"><div className="analytics-donut relative mx-auto aspect-square w-full max-w-[190px] rounded-full bg-[conic-gradient(#14b8a6_0_100%)] p-7 shadow-[0_20px_55px_rgba(0,0,0,.4)]"><div className="grid size-full place-items-center rounded-full border border-white/8 bg-panel shadow-[inset_0_12px_30px_rgba(0,0,0,.4)]"><span className="text-center"><strong className="block text-2xl">{formatAnalyticsValue(total, 'compact')}</strong><small className="text-[10px] text-text-muted">Interactions</small></span></div></div><ul className="grid gap-2 text-[10px]"><li className="flex items-center gap-2"><PlatformIcon className="size-5" platform={platform} /><span className="flex-1 text-text-muted">{labels[platform]}</span><strong>{formatAnalyticsValue(total, 'compact')}</strong><span className="text-text-soft">Selected</span></li><li className="rounded-lg border border-border-soft bg-bg/30 px-2.5 py-2 text-text-soft">Switch the Analytics account above to inspect another connected platform independently.</li></ul></div></AnalyticsCard>
}
