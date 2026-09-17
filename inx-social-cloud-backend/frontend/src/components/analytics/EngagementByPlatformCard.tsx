import { formatAnalyticsValue } from '../../data/analyticsData'
import type { Platform } from '../../types/dashboard'
import { PlatformIcon } from '../dashboard/PlatformIcon'
import { AnalyticsCard, AnalyticsCardHeader } from './AnalyticsPrimitives'

const labels: Record<Platform, string> = {
  facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', tiktok: 'TikTok', youtube: 'YouTube', pinterest: 'Pinterest', threads: 'Threads', bluesky: 'Bluesky', x: 'X',
}

export type EngagementPlatformRow = { platform: Platform; total: number; accounts: number }

export function EngagementByPlatformCard({ total, breakdown }: { total: number; breakdown: EngagementPlatformRow[] }) {
  const rows = breakdown.filter(row => row.accounts > 0).sort((left, right) => right.total - left.total)
  const leading = rows[0]
  return <AnalyticsCard><AnalyticsCardHeader description="Verified interactions returned by the currently selected Post for Me sources." title="Engagement by Platform" /><div className="grid items-center gap-5 px-5 pb-5 sm:grid-cols-[minmax(150px,190px)_1fr] xl:grid-cols-1 2xl:grid-cols-[minmax(140px,180px)_1fr]"><div className="analytics-donut relative mx-auto aspect-square w-full max-w-[190px] rounded-full bg-[conic-gradient(#14b8a6_0_72%,#1d4ed8_72%_100%)] p-7 shadow-[0_20px_55px_rgba(0,0,0,.4)]"><div className="grid size-full place-items-center rounded-full border border-white/8 bg-panel shadow-[inset_0_12px_30px_rgba(0,0,0,.4)]"><span className="text-center"><strong className="block text-2xl">{formatAnalyticsValue(total, 'compact')}</strong><small className="text-[10px] text-text-muted">Interactions</small></span></div></div><ul className="scrollbar-thin grid max-h-[220px] gap-2 overflow-y-auto text-[10px]">{rows.map(row => <li className="flex items-center gap-2 rounded-lg border border-white/[.055] bg-bg/25 px-2.5 py-2" key={row.platform}><PlatformIcon className="size-5" platform={row.platform} /><span className="flex-1 text-text-muted">{labels[row.platform]}<small className="ml-1 text-text-soft">· {row.accounts} account{row.accounts === 1 ? '' : 's'}</small></span><strong>{formatAnalyticsValue(row.total, 'compact')}</strong></li>)}{!rows.length && <li className="rounded-lg border border-border-soft bg-bg/30 px-2.5 py-3 text-text-soft">No platform interaction metrics have been returned yet.</li>}{leading && rows.length > 1 ? <li className="px-1 text-text-soft">Highest current interaction volume: {labels[leading.platform]}.</li> : null}</ul></div></AnalyticsCard>
}
