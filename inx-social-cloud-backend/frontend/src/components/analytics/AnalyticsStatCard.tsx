import { Activity, Eye, Heart, Link2, Send, UsersRound, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatAnalyticsValue } from '../../data/analyticsData'
import type { AnalyticsStat } from '../../types/analytics'

const icons: Record<string, LucideIcon> = { followers: UsersRound, views: Eye, 'engagement-rate': Heart, interactions: Activity, clicks: Link2, posts: Send }
const colours = { green: '#22c55e', blue: '#3b82f6', red: '#fb7185', purple: '#a855f7', amber: '#f59e0b', teal: '#2dd4bf' }
const toneClasses = { green: 'border-brand-green/20 bg-brand-green/8 text-brand-green', blue: 'border-brand-blue/20 bg-brand-blue/8 text-blue-400', red: 'border-brand-red/20 bg-brand-red/8 text-brand-red', purple: 'border-brand-purple/20 bg-brand-purple/8 text-purple-400', amber: 'border-brand-amber/20 bg-brand-amber/8 text-brand-amber', teal: 'border-brand-cyan/20 bg-brand-cyan/8 text-brand-cyan' }

function Sparkline({ values, colour }: { values: number[]; colour: string }) {
  const maximum = Math.max(1, ...values)
  const points = values.length > 1 ? values.map((value, index) => `${index / (values.length - 1) * 100},${28 - value / maximum * 24}`).join(' ') : ''
  return <svg aria-hidden="true" className="analytics-sparkline mt-2 h-8 w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 30"><line stroke="rgba(148,163,184,.1)" x1="0" x2="100" y1="28" y2="28" />{points && <><polyline className="analytics-line-draw" fill="none" points={points} stroke={colour} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /><polyline fill="none" opacity=".2" points={points} stroke={colour} strokeWidth="5" /></>}</svg>
}

function AnimatedNumber({ value: target, format }: { value: number; format: AnalyticsStat['format'] }) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [animated, setAnimated] = useState(0)
  useEffect(() => {
    if (reduceMotion) return
    const start = performance.now()
    let frame = 0
    const duration = 650
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimated(target * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, reduceMotion])
  return <strong className="analytics-kpi-value mt-1 block text-2xl tracking-tight">{formatAnalyticsValue(reduceMotion ? target : animated, format)}</strong>
}

export function AnalyticsStatCard({ stat }: { stat: AnalyticsStat }) {
  const Icon = icons[stat.id] || Eye
  return <article className="analytics-stat-card interactive-surface group min-w-[205px] rounded-card border p-4 focus-within:border-brand-cyan/40"><div className="flex items-start gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl border ${toneClasses[stat.tone]}`}><Icon className="size-5" /></span><div className="min-w-0 flex-1"><p className="truncate text-[11px] text-text-muted">{stat.label}</p>{stat.value === null ? <strong className="analytics-kpi-value mt-1 block text-sm tracking-tight text-text-soft">Unavailable</strong> : <AnimatedNumber format={stat.format} value={stat.value} />}<p className="mt-1 truncate text-[9px] text-text-soft" title={stat.availability || stat.detail}>{stat.detail}</p></div></div><Sparkline colour={colours[stat.tone]} values={stat.sparkline} /></article>
}
