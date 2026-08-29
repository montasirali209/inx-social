import type { PublishingActivityPoint } from '../../types/dashboard'
import { ChartCard } from './ChartCard'

const series = [
  { key: 'published' as const, label: 'Published', colour: '#2dd4bf' },
  { key: 'scheduled' as const, label: 'Scheduled', colour: '#3b82f6' },
  { key: 'failed' as const, label: 'Failed', colour: '#ef4444' },
]

function linePath(points: PublishingActivityPoint[], key: 'published' | 'scheduled' | 'failed', maximum: number) {
  if (!points.length) return ''
  return points.map((point, index) => {
    const x = 58 + (index / Math.max(1, points.length - 1)) * 612
    const y = 226 - (point[key] / maximum) * 168
    return `${index ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
}

export function PublishingActivityChart({ points, rangeDays, onRangeChange }: {
  points: PublishingActivityPoint[]
  rangeDays: number
  onRangeChange: (days: number) => void
}) {
  const maximum = Math.max(4, ...points.flatMap((point) => [point.published, point.scheduled, point.failed]))
  const labelPoints = points.length > 10 ? points.filter((_, index) => index % Math.ceil(points.length / 7) === 0 || index === points.length - 1) : points
  const total = points.reduce((sum, point) => sum + point.published + point.scheduled + point.failed, 0)

  return (
    <ChartCard
      action={<label className="relative"><span className="sr-only">Publishing activity range</span><select className="min-h-9 rounded-lg border border-border-soft bg-bg/55 px-3 text-xs text-text-main focus:border-brand-cyan focus:outline-none" onChange={(event) => onRangeChange(Number(event.target.value))} value={rangeDays}><option value={7}>Last 7 Days</option><option value={30}>Last 30 Days</option><option value={90}>Last 90 Days</option></select></label>}
      className="min-h-[350px]"
      title="Publishing Activity"
    >
      <div className="flex flex-wrap justify-center gap-6 px-4 pb-1 text-[11px] text-text-muted">
        {series.map((item) => <span className="inline-flex items-center gap-2" key={item.key}><span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: item.colour }} />{item.label}</span>)}
      </div>
      <div className="relative px-3 pb-3">
        <svg aria-label="Publishing activity chart" className="h-[260px] w-full" role="img" viewBox="0 0 700 270">
          <defs>
            <linearGradient id="publishedArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2dd4bf" stopOpacity=".22" /><stop offset="1" stopColor="#2dd4bf" stopOpacity="0" /></linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((row) => {
            const y = 58 + row * 42
            const value = Math.round(maximum - row * maximum / 4)
            return <g key={row}><line stroke="rgba(148,163,184,.12)" x1="58" x2="670" y1={y} y2={y} /><text fill="#64748b" fontSize="10" textAnchor="end" x="48" y={y + 4}>{value}</text></g>
          })}
          {points.length > 1 && <path d={`${linePath(points, 'published', maximum)} L 670 226 L 58 226 Z`} fill="url(#publishedArea)" />}
          {series.map((item) => <path d={linePath(points, item.key, maximum)} fill="none" key={item.key} stroke={item.colour} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />)}
          {series.flatMap((item) => points.map((point, index) => {
            const x = 58 + (index / Math.max(1, points.length - 1)) * 612
            const y = 226 - (point[item.key] / maximum) * 168
            return <circle cx={x} cy={y} fill={item.colour} key={`${item.key}-${point.date}`} r="2.5"><title>{`${point.label}: ${item.label} ${point[item.key]}`}</title></circle>
          }))}
          {labelPoints.map((point) => {
            const index = points.indexOf(point)
            const x = 58 + (index / Math.max(1, points.length - 1)) * 612
            return <text fill="#64748b" fontSize="9" key={point.date} textAnchor="middle" x={x} y="250">{point.label}</text>
          })}
        </svg>
        {total === 0 && <div className="pointer-events-none absolute inset-0 grid place-items-center pb-7"><span className="rounded-full border border-border-soft bg-bg/80 px-4 py-2 text-xs text-text-muted backdrop-blur">No publishing activity in this period</span></div>}
      </div>
    </ChartCard>
  )
}

