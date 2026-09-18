import { useId, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { PerformancePoint } from '../../types/analytics'
import { formatAnalyticsValue } from '../../data/analyticsData'
import { AnalyticsCard, AnalyticsCardHeader } from './AnalyticsPrimitives'

type SeriesKey = 'views' | 'engagements' | 'linkClicks' | 'followers'
const metricSeries: Array<{ key: SeriesKey; label: string; totalLabel: string; colour: string }> = [
  { key: 'views', label: 'Current views', totalLabel: 'Current views', colour: '#3b82f6' },
  { key: 'engagements', label: 'Interactions', totalLabel: 'Interactions', colour: '#2dd4bf' },
  { key: 'linkClicks', label: 'Clicks', totalLabel: 'Clicks', colour: '#f59e0b' },
]
const plot = { left: 62, right: 944, top: 24, bottom: 242 }

function pointX(index: number, count: number) {
  if (count <= 1) return (plot.left + plot.right) / 2
  return plot.left + index / (count - 1) * (plot.right - plot.left)
}

function pointY(value: number, maximum: number) {
  return plot.bottom - value / maximum * (plot.bottom - plot.top)
}

function clampY(value: number) {
  return Math.max(plot.top, Math.min(plot.bottom, value))
}

function smoothPath(points: PerformancePoint[], key: SeriesKey, maximum: number) {
  if (!points.length) return ''
  const coordinates = points.map((point, index) => ({ x: pointX(index, points.length), y: pointY(point[key], maximum) }))
  if (coordinates.length === 1) return `M ${coordinates[0].x} ${coordinates[0].y}`
  if (coordinates.length === 2) return `M ${coordinates[0].x} ${coordinates[0].y} L ${coordinates[1].x} ${coordinates[1].y}`

  const tension = 0.82
  let path = `M ${coordinates[0].x} ${coordinates[0].y}`
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const p0 = coordinates[index - 1] || coordinates[index]
    const p1 = coordinates[index]
    const p2 = coordinates[index + 1]
    const p3 = coordinates[index + 2] || p2
    const cp1x = p1.x + (p2.x - p0.x) / 6 * tension
    const cp1y = clampY(p1.y + (p2.y - p0.y) / 6 * tension)
    const cp2x = p2.x - (p3.x - p1.x) / 6 * tension
    const cp2y = clampY(p2.y - (p3.y - p1.y) / 6 * tension)
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return path
}

function areaPath(points: PerformancePoint[], key: SeriesKey, maximum: number) {
  if (!points.length) return ''
  return `${smoothPath(points, key, maximum)} L ${pointX(points.length - 1, points.length)} ${plot.bottom} L ${pointX(0, points.length)} ${plot.bottom} Z`
}

function exactDate(point: PerformancePoint) {
  const date = new Date(`${point.date}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return point.label
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function axisDate(point: PerformancePoint, interval: 'daily' | 'weekly' | 'monthly') {
  if (interval === 'weekly') return point.label
  const date = new Date(`${point.date}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return point.label
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date)
}

export function PerformanceOverTimeCard({
  points,
  interval,
  setInterval,
}: {
  points: PerformancePoint[]
  interval: 'daily' | 'weekly' | 'monthly'
  setInterval: (value: 'daily' | 'weekly' | 'monthly') => void
}) {
  const [active, setActive] = useState<number | null>(null)
  const gradientId = useId().replace(/:/g, '')
  const maximumValue = Math.max(1, ...points.flatMap(point => metricSeries.map(item => point[item.key])))
  const roughStep = maximumValue / 5
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(1, roughStep))))
  const niceStep = Math.max(1, Math.ceil(roughStep / magnitude) * magnitude)
  const maximum = Math.max(5, niceStep * 5)
  const labelEvery = Math.max(1, Math.ceil(points.length / 6))
  const activeSeries = useMemo(() => metricSeries.filter(item => points.some(point => point[item.key] !== 0)), [metricSeries, points])
  const renderedSeries = activeSeries.length ? activeSeries : [metricSeries[0]]

  function track(event: ReactPointerEvent<SVGSVGElement>) {
    if (!points.length) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const viewX = (event.clientX - bounds.left) / bounds.width * 1000
    const ratio = Math.max(0, Math.min(1, (viewX - plot.left) / (plot.right - plot.left)))
    setActive(Math.round(ratio * Math.max(0, points.length - 1)))
  }

  const activePoint = active === null ? null : points[active]
  const activeX = active === null ? null : pointX(active, points.length)
  const tooltipLeft = activeX === null ? 50 : Math.min(83, Math.max(17, activeX / 10))
  const totals = metricSeries.map(item => ({ ...item, value: points.reduce((sum, point) => sum + point[item.key], 0) }))

  return <AnalyticsCard>
    <AnalyticsCardHeader
      action={<select aria-label="Performance chart interval" className="min-h-9 rounded-xl border border-border-soft bg-bg/45 px-3 text-[10px] outline-none focus:border-brand-cyan" onChange={event => setInterval(event.target.value as 'daily' | 'weekly' | 'monthly')} value={interval}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>}
      description="Shows the latest verified performance of posts published in the selected period."
      title="Content Performance by Publish Date"
    />

    <div className="relative px-3 sm:px-5">
      <div className="mb-1 mt-2 flex items-center justify-between px-1 text-[9px] text-text-soft"><span>Verified performance grouped by post publish date</span><span className="hidden sm:inline">Hover for exact post-date performance</span></div>

      {activePoint && <div className="pointer-events-none absolute top-8 z-20 w-[218px] -translate-x-1/2 rounded-xl border border-brand-cyan/20 bg-[#061923]/[.97] p-3 text-[10px] shadow-[0_18px_50px_rgba(0,0,0,.45),0_0_0_1px_rgba(45,212,191,.04)] backdrop-blur-xl" style={{ left: `${tooltipLeft}%` }}>
        <div className="border-b border-white/[.07] pb-2"><strong className="block text-[11px] text-white">{interval === 'weekly' ? activePoint.label : exactDate(activePoint)}</strong><span className="mt-0.5 block text-[9px] text-text-soft">Latest totals for posts published on this date</span></div>
        <div className="mt-2 space-y-1.5">{metricSeries.map(item => <span className="flex items-center justify-between gap-6 text-text-muted" key={item.key}><span className="flex items-center gap-1.5"><i className="inline-block size-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: item.colour, color: item.colour }} />{item.label}</span><b className="text-white">{formatAnalyticsValue(activePoint[item.key], 'compact')}</b></span>)}</div>
      </div>}

      <svg aria-label="Performance over time chart" className="h-[280px] w-full touch-pan-y sm:h-[330px]" onPointerLeave={() => setActive(null)} onPointerMove={track} preserveAspectRatio="none" role="img" viewBox="0 0 1000 282">
        <defs>
          <linearGradient id={`${gradientId}-views-area`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity=".2" />
            <stop offset="72%" stopColor="#3b82f6" stopOpacity=".035" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <filter id={`${gradientId}-glow`} height="180%" width="180%" x="-40%" y="-40%">
            <feGaussianBlur result="blur" stdDeviation="2.5" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <rect fill="rgba(2,12,18,.13)" height={plot.bottom - plot.top} rx="10" width={plot.right - plot.left} x={plot.left} y={plot.top} />
        {Array.from({ length: 6 }, (_, index) => {
          const y = plot.top + index * (plot.bottom - plot.top) / 5
          const value = maximum - index * maximum / 5
          return <g key={index}><line stroke="rgba(148,163,184,.10)" strokeDasharray="3 6" x1={plot.left} x2={plot.right} y1={y} y2={y} /><text fill="#64748b" fontSize="9" textAnchor="end" x={plot.left - 11} y={y + 3}>{formatAnalyticsValue(value, 'compact')}</text></g>
        })}

        {points.length > 1 && points.some(point => point.views > 0) && <path d={areaPath(points, 'views', maximum)} fill={`url(#${gradientId}-views-area)`} />}
        {renderedSeries.map((item, seriesIndex) => <g key={item.key}>
          <path d={smoothPath(points, item.key, maximum)} fill="none" opacity=".13" stroke={item.colour} strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" />
          <path className="analytics-line-draw" d={smoothPath(points, item.key, maximum)} fill="none" stroke={item.colour} strokeLinecap="round" strokeLinejoin="round" strokeWidth={item.key === 'views' ? 2.25 : 1.8} style={{ animationDelay: `${seriesIndex * 90}ms` }} />
        </g>)}

        {active !== null && activePoint && activeX !== null && <>
          <line stroke="rgba(45,212,191,.52)" strokeDasharray="3 4" x1={activeX} x2={activeX} y1={plot.top} y2={plot.bottom} />
          {renderedSeries.map(item => <g key={item.key}><circle cx={activeX} cy={pointY(activePoint[item.key], maximum)} fill="#061923" r="5.5" stroke={item.colour} strokeWidth="2" /><circle cx={activeX} cy={pointY(activePoint[item.key], maximum)} fill={item.colour} filter={`url(#${gradientId}-glow)`} r="2.4" /></g>)}
        </>}

        {points.map((point, index) => index % labelEvery === 0 || index === points.length - 1 ? <g key={`${point.date}-axis`}><line stroke="rgba(148,163,184,.10)" x1={pointX(index, points.length)} x2={pointX(index, points.length)} y1={plot.bottom} y2={plot.bottom + 5} /><text fill="#718096" fontSize="9" textAnchor={points.length === 1 ? 'middle' : index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'} x={pointX(index, points.length)} y="266">{axisDate(point, interval)}</text></g> : null)}
      </svg>

      <div className="flex flex-wrap justify-center gap-5 pb-3 text-[10px] text-text-muted">{renderedSeries.map(item => <span className="flex items-center gap-2" key={item.key}><i className="h-0.5 w-5 rounded-full" style={{ backgroundColor: item.colour, boxShadow: `0 0 8px ${item.colour}55` }} />{item.label}</span>)}</div>
    </div>
    <div className="grid grid-cols-2 border-t border-border-soft sm:grid-cols-4">{totals.map(item => <div className="border-border-soft p-3 sm:border-r last:border-r-0" key={item.key}><span className="text-[9px] text-text-muted">{item.totalLabel}</span><strong className="mt-1 block text-sm" style={{ color: item.colour }}>{formatAnalyticsValue(item.value, 'compact')}</strong></div>)}</div>
  </AnalyticsCard>
}
