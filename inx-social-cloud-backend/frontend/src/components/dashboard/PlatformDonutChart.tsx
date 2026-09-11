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
  const visible = ordered.filter((metric) => metric.posts > 0)

  return (
    <ChartCard className="min-h-[250px]" title="Posts by Platform">
      <div className="grid min-h-[200px] items-center gap-3 px-3 pb-3 sm:grid-cols-[minmax(120px,155px)_1fr] xl:grid-cols-1 2xl:grid-cols-[minmax(120px,145px)_1fr]">
        <div className="relative mx-auto aspect-square w-full max-w-[145px] rounded-full p-[20px] shadow-[0_18px_42px_rgba(0,0,0,.32)] transition duration-500 hover:scale-[1.03] motion-reduce:transition-none" style={{ background: donutBackground(ordered) }}>
          <div className="grid size-full place-items-center rounded-full border border-white/8 bg-panel shadow-[inset_0_10px_30px_rgba(0,0,0,.35)]"><span className="text-center"><strong className="block text-2xl tracking-[-0.05em]">{total.toLocaleString('en-GB')}</strong><small className="text-[9px] text-text-muted">Total Posts</small></span></div>
        </div>
        {visible.length ? <ul className="grid gap-1.5">
          {visible.map((metric) => {
            const percent = total ? metric.posts / total * 100 : 0
            return <li className="flex items-center gap-2 text-[10px]" key={metric.platform}><PlatformIcon className="size-[18px]" platform={metric.platform} /><span className="min-w-0 flex-1 truncate text-text-muted">{platformPresentation[metric.platform].label}</span><strong className="font-medium">{metric.posts.toLocaleString('en-GB')}</strong><span className="w-9 text-right text-text-soft">{Math.round(percent)}%</span></li>
          })}
        </ul> : <p className="text-center text-[11px] leading-5 text-text-muted">No live platform post data yet.</p>}
      </div>
    </ChartCard>
  )
}
