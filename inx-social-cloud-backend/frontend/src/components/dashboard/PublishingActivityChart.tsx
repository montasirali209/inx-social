import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { PublishingActivityPoint } from '../../types/dashboard'
import { ActivityTooltip } from './ActivityTooltip'

const plot = { left: 48, right: 952, top: 18, bottom: 184 }

function smoothPath(values: Array<{ x: number; y: number }>) {
  if (!values.length) return ''
  return values.slice(1).reduce((path, point, index) => {
    const previous = values[index]
    const middle = (previous.x + point.x) / 2
    return `${path} C ${middle.toFixed(1)} ${previous.y.toFixed(1)}, ${middle.toFixed(1)} ${point.y.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
  }, `M ${values[0].x.toFixed(1)} ${values[0].y.toFixed(1)}`)
}

function compact(value: number) {
  return new Intl.NumberFormat('en-GB', { notation: value >= 1_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value)
}

export function PublishingActivityChart({ points }: { points: PublishingActivityPoint[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const postMaximumValue = Math.max(1, ...points.flatMap((point) => [point.published, point.scheduled]))
  const postMaximum = Math.max(5, Math.ceil(postMaximumValue / 5) * 5)
  const engagementMaximumValue = Math.max(1, ...points.map((point) => point.engagement))
  const engagementMaximum = Math.max(10, Math.ceil(engagementMaximumValue / 10) * 10)
  const band = (plot.right - plot.left) / Math.max(1, points.length)
  const barWidth = Math.min(14, Math.max(4, band * .27))
  const labelEvery = Math.max(1, Math.ceil(points.length / 8))
  const engagementPoints = points.map((point, index) => ({
    x: plot.left + band * index + band / 2,
    y: plot.bottom - (point.engagement / engagementMaximum) * (plot.bottom - plot.top),
  }))
  const activePoint = activeIndex === null ? null : points[activeIndex]
  const activeX = activeIndex === null ? 0 : plot.left + band * activeIndex + band / 2
  const tooltipLeft = activeIndex === null ? 0 : 4 + ((activeX - plot.left) / (plot.right - plot.left)) * 92

  function trackPointer(event: ReactPointerEvent<SVGSVGElement>) {
    if (!points.length) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const viewX = ((event.clientX - bounds.left) / bounds.width) * 1000
    const ratio = Math.min(.9999, Math.max(0, (viewX - plot.left) / (plot.right - plot.left)))
    setActiveIndex(Math.min(points.length - 1, Math.floor(ratio * points.length)))
  }

  return (
    <div className="relative">
      {activePoint ? <ActivityTooltip leftPercent={tooltipLeft} point={activePoint} /> : null}
      <svg aria-label="Publishing activity chart showing published and scheduled posts with live engagement." className="h-[190px] w-full touch-pan-y 2xl:h-[205px]" onPointerLeave={() => setActiveIndex(null)} onPointerMove={trackPointer} preserveAspectRatio="none" role="img" viewBox="0 0 1000 222">
        <defs>
          <linearGradient id="publishedBar" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2dd4bf" /><stop offset="1" stopColor="#0f8f7f" /></linearGradient>
          <linearGradient id="scheduledBar" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3b82f6" /><stop offset="1" stopColor="#1d4ed8" /></linearGradient>
          <filter id="barGlow"><feGaussianBlur result="blur" stdDeviation="2.5" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        {Array.from({ length: 5 }, (_, index) => {
          const y = plot.top + index * ((plot.bottom - plot.top) / 4)
          const postValue = Math.round(postMaximum - index * (postMaximum / 4))
          const engagementValue = Math.round(engagementMaximum - index * (engagementMaximum / 4))
          return <g key={index}><line stroke="rgba(148,163,184,.12)" strokeDasharray="4 5" x1={plot.left} x2={plot.right} y1={y} y2={y} /><text fill="#64748b" fontSize="9" textAnchor="end" x={plot.left - 9} y={y + 3}>{postValue}</text><text fill="#64748b" fontSize="9" textAnchor="start" x={plot.right + 8} y={y + 3}>{compact(engagementValue)}</text></g>
        })}

        {points.map((point, index) => {
          const centerX = plot.left + band * index + band / 2
          const publishedHeight = (point.published / postMaximum) * (plot.bottom - plot.top)
          const scheduledHeight = (point.scheduled / postMaximum) * (plot.bottom - plot.top)
          return <g key={point.date} opacity={activeIndex === null || activeIndex === index ? 1 : .72}>
            <rect fill="url(#publishedBar)" filter="url(#barGlow)" height={publishedHeight} rx="2.5" width={barWidth} x={centerX - barWidth - 1.5} y={plot.bottom - publishedHeight} />
            <rect fill="url(#scheduledBar)" height={scheduledHeight} rx="2.5" width={barWidth} x={centerX + 1.5} y={plot.bottom - scheduledHeight} />
          </g>
        })}

        <path d={smoothPath(engagementPoints)} fill="none" stroke="rgba(248,250,252,.9)" strokeDasharray="3 4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        {engagementPoints.map((point, index) => <circle cx={point.x} cy={point.y} fill="#f8fafc" key={points[index].date} r={activeIndex === index ? 4 : 2.4} stroke={activeIndex === index ? '#2dd4bf' : '#071923'} strokeWidth="1.5" />)}

        {activeIndex !== null ? <line stroke="rgba(94,234,212,.35)" strokeDasharray="5 5" x1={activeX} x2={activeX} y1={plot.top} y2={plot.bottom} /> : null}

        {points.map((point, index) => ((index % labelEvery === 0 || index === points.length - 1)
          ? <text fill="#64748b" fontSize="9" key={point.date} textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'} x={plot.left + band * index + band / 2} y="205">{point.label}</text>
          : null))}
      </svg>

      <div aria-label="Chart legend" className="flex flex-wrap justify-center gap-x-5 gap-y-1 pt-0.5 text-[10px] text-text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-[#2dd4bf] shadow-[0_0_8px_#2dd4bf]" />Published</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-[#3b82f6]" />Scheduled</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-white" />Engagement</span>
      </div>
    </div>
  )
}
