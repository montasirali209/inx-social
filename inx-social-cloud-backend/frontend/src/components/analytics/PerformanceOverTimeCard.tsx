import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { PerformancePoint } from '../../types/analytics'
import { formatAnalyticsValue } from '../../data/analyticsData'
import { AnalyticsCard, AnalyticsCardHeader } from './AnalyticsPrimitives'

type SeriesKey = 'views' | 'engagements' | 'linkClicks' | 'followers'
const series: Array<{ key: SeriesKey; label: string; colour: string }> = [
  { key: 'views', label: 'Content Views', colour: '#3b82f6' },
  { key: 'engagements', label: 'Engagements', colour: '#2dd4bf' },
  { key: 'linkClicks', label: 'Link Clicks', colour: '#f59e0b' },
  { key: 'followers', label: 'New Followers', colour: '#a855f7' },
]
const plot = { left: 58, right: 942, top: 20, bottom: 238 }

function pointX(index: number, count: number) {
  if (count <= 1) return (plot.left + plot.right) / 2
  return plot.left + index / (count - 1) * (plot.right - plot.left)
}

function linePoints(points: PerformancePoint[], key: SeriesKey, maximum: number) {
  return points.map((point, index) => `${pointX(index, points.length)},${plot.bottom - point[key] / maximum * (plot.bottom - plot.top)}`).join(' ')
}

export function PerformanceOverTimeCard({ points, interval, setInterval }: { points: PerformancePoint[]; interval: 'daily' | 'weekly' | 'monthly'; setInterval: (value: 'daily' | 'weekly' | 'monthly') => void }) {
  const [active, setActive] = useState<number | null>(null)
  const maximumValue = Math.max(1, ...points.flatMap((point) => series.map((item) => point[item.key])))
  const maximum = Math.ceil(maximumValue / 5) * 5 || 5
  const labelEvery = Math.max(1, Math.ceil(points.length / 7))
  function track(event: ReactPointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const viewX = (event.clientX - bounds.left) / bounds.width * 1000
    const ratio = Math.max(0, Math.min(1, (viewX - plot.left) / (plot.right - plot.left)))
    setActive(Math.round(ratio * Math.max(0, points.length - 1)))
  }
  const activePoint = active === null ? null : points[active]
  const totals = series.map((item) => ({ ...item, value: points.reduce((sum, point) => sum + point[item.key], 0) }))
  return <AnalyticsCard>
    <AnalyticsCardHeader action={<select aria-label="Performance chart interval" className="min-h-9 rounded-xl border border-border-soft bg-bg/45 px-3 text-[10px] outline-none focus:border-brand-cyan" onChange={(event) => setInterval(event.target.value as 'daily' | 'weekly' | 'monthly')} value={interval}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>} description="Live Page and published-post metrics returned for the selected period." title="Performance Over Time" />
    <div className="relative px-3 sm:px-5">{activePoint && <div className="pointer-events-none absolute right-6 top-2 z-10 rounded-xl border border-brand-cyan/20 bg-bg/95 p-3 text-[10px] shadow-panel"><strong>{activePoint.label}</strong>{series.map((item) => <span className="mt-1 flex items-center justify-between gap-8 text-text-muted" key={item.key}><span><i className="mr-1.5 inline-block size-2 rounded-full" style={{ backgroundColor: item.colour }} />{item.label}</span><b className="text-white">{formatAnalyticsValue(activePoint[item.key], 'compact')}</b></span>)}</div>}
      <svg aria-label="Performance over time chart" className="h-[260px] w-full touch-pan-y sm:h-[310px]" onPointerLeave={() => setActive(null)} onPointerMove={track} preserveAspectRatio="none" role="img" viewBox="0 0 1000 275">
        {Array.from({ length: 6 }, (_, index) => { const y = plot.top + index * (plot.bottom - plot.top) / 5; const value = maximum - index * maximum / 5; return <g key={index}><line stroke="rgba(148,163,184,.11)" strokeDasharray="4 5" x1={plot.left} x2={plot.right} y1={y} y2={y} /><text fill="#64748b" fontSize="10" textAnchor="end" x={plot.left - 10} y={y + 4}>{formatAnalyticsValue(value, 'compact')}</text></g> })}
        {series.map((item) => <g key={item.key}><polyline fill="none" opacity=".18" points={linePoints(points, item.key, maximum)} stroke={item.colour} strokeLinecap="round" strokeLinejoin="round" strokeWidth="6" /><polyline fill="none" points={linePoints(points, item.key, maximum)} stroke={item.colour} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />{points.length === 1 && <circle cx={pointX(0, 1)} cy={plot.bottom - points[0][item.key] / maximum * (plot.bottom - plot.top)} fill={item.colour} r="4" />}</g>)}
        {active !== null && <line stroke="rgba(45,212,191,.45)" strokeDasharray="4 4" x1={pointX(active, points.length)} x2={pointX(active, points.length)} y1={plot.top} y2={plot.bottom} />}
        {points.map((point, index) => index % labelEvery === 0 || index === points.length - 1 ? <text fill="#64748b" fontSize="10" key={point.date} textAnchor={points.length === 1 ? 'middle' : index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'} x={pointX(index, points.length)} y="262">{point.label}</text> : null)}
      </svg>
      <div className="flex flex-wrap justify-center gap-5 pb-3 text-[10px] text-text-muted">{series.map((item) => <span className="flex items-center gap-2" key={item.key}><i className="h-0.5 w-5" style={{ backgroundColor: item.colour }} />{item.label}</span>)}</div>
    </div>
    <div className="grid grid-cols-2 border-t border-border-soft sm:grid-cols-4">{totals.map((item) => <div className="border-border-soft p-3 sm:border-r last:border-r-0" key={item.key}><span className="text-[9px] text-text-muted">{item.label}</span><strong className="mt-1 block text-sm" style={{ color: item.colour }}>{formatAnalyticsValue(item.value, 'compact')}</strong></div>)}</div>
  </AnalyticsCard>
}
