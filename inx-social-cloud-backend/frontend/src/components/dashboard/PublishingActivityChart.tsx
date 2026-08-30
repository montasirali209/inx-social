import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { publishingActivitySeries, type ActivitySeriesKey } from '../../data/publishingActivityData'
import type { PublishingActivityPoint } from '../../types/dashboard'
import { ActivityTooltip } from './ActivityTooltip'

const plot = { left: 58, right: 982, top: 22, bottom: 224 }

function coordinates(points: PublishingActivityPoint[], key: ActivitySeriesKey, maximum: number) {
  return points.map((point, index) => ({
    x: plot.left + (index / Math.max(1, points.length - 1)) * (plot.right - plot.left),
    y: plot.bottom - (point[key] / maximum) * (plot.bottom - plot.top),
  }))
}

function smoothPath(values: Array<{ x: number; y: number }>) {
  if (!values.length) return ''
  return values.slice(1).reduce((path, point, index) => {
    const previous = values[index]
    const middle = (previous.x + point.x) / 2
    return `${path} C ${middle.toFixed(1)} ${previous.y.toFixed(1)}, ${middle.toFixed(1)} ${point.y.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
  }, `M ${values[0].x.toFixed(1)} ${values[0].y.toFixed(1)}`)
}

export function PublishingActivityChart({ points }: { points: PublishingActivityPoint[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const maximumValue = Math.max(1, ...points.flatMap((point) => [point.published, point.scheduled, point.failed]))
  const maximum = Math.max(5, Math.ceil(maximumValue / 5) * 5)
  const labelEvery = Math.max(1, Math.ceil(points.length / 7))
  const activePoint = activeIndex === null ? null : points[activeIndex]
  const activeX = activeIndex === null
    ? 0
    : plot.left + (activeIndex / Math.max(1, points.length - 1)) * (plot.right - plot.left)
  const tooltipLeft = activeIndex === null ? 0 : 4 + (activeIndex / Math.max(1, points.length - 1)) * 92

  function trackPointer(event: ReactPointerEvent<SVGSVGElement>) {
    if (!points.length) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const viewX = ((event.clientX - bounds.left) / bounds.width) * 1000
    const ratio = Math.min(1, Math.max(0, (viewX - plot.left) / (plot.right - plot.left)))
    setActiveIndex(Math.round(ratio * Math.max(0, points.length - 1)))
  }

  return (
    <div className="relative">
      {activePoint ? <ActivityTooltip leftPercent={tooltipLeft} point={activePoint} /> : null}
      <svg
        aria-label="Publishing activity line chart. Move across the chart to inspect daily values."
        className="h-[250px] w-full touch-pan-y sm:h-[310px]"
        onPointerLeave={() => setActiveIndex(null)}
        onPointerMove={trackPointer}
        preserveAspectRatio="none"
        role="img"
        viewBox="0 0 1000 270"
      >
        <defs>
          <linearGradient id="activityPublishedArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#2dd4bf" stopOpacity=".23" />
            <stop offset="1" stopColor="#2dd4bf" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="activityScheduledArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3b82f6" stopOpacity=".14" />
            <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <filter id="activityGlow">
            <feGaussianBlur result="blur" stdDeviation="3" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {Array.from({ length: 6 }, (_, index) => {
          const y = plot.top + index * ((plot.bottom - plot.top) / 5)
          const value = Math.round(maximum - index * (maximum / 5))
          return (
            <g key={index}>
              <line stroke="rgba(148,163,184,.12)" strokeDasharray="4 5" x1={plot.left} x2={plot.right} y1={y} y2={y} />
              <text fill="#64748b" fontSize="10" textAnchor="end" x={plot.left - 12} y={y + 4}>{value}</text>
            </g>
          )
        })}

        {points.length > 1 ? publishingActivitySeries.slice(0, 2).map((series) => {
          const values = coordinates(points, series.key, maximum)
          const path = smoothPath(values)
          return <path d={`${path} L ${plot.right} ${plot.bottom} L ${plot.left} ${plot.bottom} Z`} fill={series.key === 'published' ? 'url(#activityPublishedArea)' : 'url(#activityScheduledArea)'} key={`${series.key}-area`} />
        }) : null}

        {publishingActivitySeries.map((series) => {
          const values = coordinates(points, series.key, maximum)
          return (
            <g key={series.key}>
              <path d={smoothPath(values)} fill="none" filter="url(#activityGlow)" opacity=".24" stroke={series.colour} strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
              <path d={smoothPath(values)} fill="none" stroke={series.colour} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" />
              {values.map((point, index) => (
                <circle cx={point.x} cy={point.y} fill={series.colour} key={`${series.key}-${points[index].date}`} opacity={points.length > 35 && activeIndex !== index ? 0 : 1} r={activeIndex === index ? 4.5 : 2.2} stroke={activeIndex === index ? '#dffcf7' : 'transparent'} strokeWidth="1.5" />
              ))}
            </g>
          )
        })}

        {activeIndex !== null ? (
          <line stroke="rgba(94,234,212,.4)" strokeDasharray="5 5" x1={activeX} x2={activeX} y1={plot.top} y2={plot.bottom} />
        ) : null}

        {points.map((point, index) => (
          (index % labelEvery === 0 || index === points.length - 1)
            ? <text fill="#64748b" fontSize="10" key={point.date} textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'} x={plot.left + (index / Math.max(1, points.length - 1)) * (plot.right - plot.left)} y="252">{point.label}</text>
            : null
        ))}
      </svg>

      <div aria-label="Chart legend" className="flex flex-wrap justify-center gap-x-7 gap-y-2 pt-1 text-xs text-text-muted">
        {publishingActivitySeries.map((series) => (
          <span className="inline-flex items-center gap-2" key={series.key}>
            <span className="h-0.5 w-6 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: series.colour, color: series.colour }} />
            {series.label}
          </span>
        ))}
      </div>
    </div>
  )
}
