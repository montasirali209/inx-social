import { CalendarClock, CircleX, Send } from 'lucide-react'
import type { ActivityTone } from '../../data/publishingActivityData'

export type ActivitySummary = {
  label: string
  value: number
  change: string
  direction: 'up' | 'down' | 'neutral'
  tone: ActivityTone
}

const presentation = {
  published: {
    icon: Send,
    border: 'border-teal-300/30',
    surface: 'from-teal-400/10 to-transparent',
    iconSurface: 'bg-teal-400/12 text-teal-300',
    accent: 'text-teal-300',
  },
  scheduled: {
    icon: CalendarClock,
    border: 'border-blue-400/25',
    surface: 'from-blue-500/10 to-transparent',
    iconSurface: 'bg-blue-500/12 text-blue-300',
    accent: 'text-blue-300',
  },
  failed: {
    icon: CircleX,
    border: 'border-red-400/25',
    surface: 'from-red-500/10 to-transparent',
    iconSurface: 'bg-red-500/12 text-red-300',
    accent: 'text-red-300',
  },
} as const

export function ActivitySummaryCard({ summary }: { summary: ActivitySummary }) {
  const style = presentation[summary.tone]
  const Icon = style.icon
  const arrow = summary.direction === 'up' ? '↗' : summary.direction === 'down' ? '↘' : '→'

  return (
    <article className={`group min-w-[220px] flex-1 rounded-2xl border bg-gradient-to-br ${style.border} ${style.surface} p-4 shadow-[inset_0_1px_rgba(255,255,255,.035)] transition duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(0,0,0,.26)] motion-reduce:transform-none motion-reduce:transition-none`}>
      <div className="flex items-center gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${style.iconSurface} transition duration-200 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none`}>
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-main">{summary.label}</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <strong className="text-3xl font-semibold tracking-tight text-white">{summary.value}</strong>
            <span className={`pb-1 text-xs font-semibold ${style.accent}`}>{arrow} {summary.change}</span>
          </div>
        </div>
      </div>
      <p className="mt-2 text-right text-[11px] text-text-soft">vs previous period</p>
    </article>
  )
}
