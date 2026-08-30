import type { PublishingActivityPoint } from '../../types/dashboard'
import { publishingActivitySeries } from '../../data/publishingActivityData'

export function ActivityTooltip({ point, leftPercent }: {
  point: PublishingActivityPoint
  leftPercent: number
}) {
  const alignRight = leftPercent > 68
  return (
    <div
      className={`pointer-events-none absolute top-3 z-20 min-w-44 rounded-xl border border-teal-300/18 bg-[#071923]/96 p-3 shadow-[0_22px_55px_rgba(0,0,0,.52),0_0_28px_rgba(20,184,166,.08)] backdrop-blur-xl ${alignRight ? '-translate-x-full' : ''}`}
      style={{ left: `${leftPercent}%` }}
    >
      <p className="mb-2 text-xs font-semibold text-text-main">{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(point.date))}</p>
      <dl className="space-y-1.5">
        {publishingActivitySeries.map((series) => (
          <div className="flex items-center justify-between gap-5 text-xs" key={series.key}>
            <dt className="flex items-center gap-2 text-text-muted"><span className="size-2 rounded-full" style={{ backgroundColor: series.colour }} />{series.label}</dt>
            <dd className="font-semibold text-text-main">{point[series.key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
