import { platformOrder, platformPresentation } from '../../data/dashboardData'
import type { PlatformMetric } from '../../types/dashboard'
import { ChartCard } from './ChartCard'
import { PlatformIcon } from './PlatformIcon'

function donutBackground(metrics: PlatformMetric[]) {
  const total = metrics.reduce((sum, metric) => sum + metric.posts, 0)
  if (!total) return 'conic-gradient(rgba(148,163,184,.12) 0 100%)'
  let current = 0
  return `conic-gradient(${metrics.filter((metric) => metric.posts > 0).map((metric) => {
    const start = current
    current += metric.posts / total * 100
    return `${platformPresentation[metric.platform].colour} ${start}% ${current}%`
  }).join(',')})`
}

export function PlatformDonutChart({ metrics }: { metrics: PlatformMetric[] }) {
  const ordered = platformOrder.map((platform) => metrics.find((metric) => metric.platform === platform) || { platform, posts: 0, engagement: null })
  const total = ordered.reduce((sum, metric) => sum + metric.posts, 0)
  return (
    <ChartCard className="min-h-[350px]" title="Posts by Platform">
      <div className="grid min-h-[292px] items-center gap-5 px-5 pb-5 sm:grid-cols-[minmax(150px,210px)_1fr]">
        <div className="relative mx-auto aspect-square w-full max-w-[205px] rounded-full p-[28px] shadow-[0_20px_50px_rgba(0,0,0,.35)]" style={{ background: donutBackground(ordered) }}>
          <div className="grid size-full place-items-center rounded-full border border-white/8 bg-panel shadow-[inset_0_10px_30px_rgba(0,0,0,.35)]"><span className="text-center"><strong className="block text-3xl tracking-[-0.05em]">{total}</strong><small className="text-text-muted">Total</small></span></div>
        </div>
        <ul className="grid gap-2.5">
          {ordered.map((metric) => {
            const percent = total ? metric.posts / total * 100 : 0
            return <li className="flex items-center gap-2 text-xs" key={metric.platform}><PlatformIcon className="size-5" platform={metric.platform} /><span className="min-w-0 flex-1 truncate text-text-muted">{platformPresentation[metric.platform].label}</span><strong className="font-medium">{metric.posts}</strong><span className="w-12 text-right text-text-soft">({percent.toFixed(1)}%)</span></li>
          })}
        </ul>
      </div>
    </ChartCard>
  )
}
