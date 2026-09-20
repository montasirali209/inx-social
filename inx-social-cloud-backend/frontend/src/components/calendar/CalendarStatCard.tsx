import type { LucideIcon } from 'lucide-react'
import type { CalendarStat } from '../../types/calendar'

const tones = {
  green: 'border-brand-green/20 from-brand-green/10 text-brand-green',
  teal: 'border-brand-cyan/20 from-brand-cyan/10 text-brand-cyan',
  amber: 'border-brand-amber/20 from-brand-amber/10 text-brand-amber',
  purple: 'border-brand-purple/20 from-brand-purple/10 text-[#b9a2ff]',
  red: 'border-brand-red/20 from-brand-red/10 text-brand-red',
}

function StatContent({ stat, Icon }: { stat: CalendarStat; Icon: LucideIcon }) {
  return <div className="flex items-start gap-3">
    <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-current/15 bg-current/10"><Icon aria-hidden="true" className="size-5" /></span>
    <span className="min-w-0 text-left"><small className="block truncate text-xs text-text-muted">{stat.label}</small><strong className="mt-1 block text-2xl leading-none text-text-main">{stat.value}</strong><span className="mt-2 block truncate text-[10px] font-medium text-current">{stat.detail}</span></span>
  </div>
}

export function CalendarStatCard({ stat, icon: Icon, onClick }: { stat: CalendarStat; icon: LucideIcon; onClick?: () => void }) {
  const className = `interactive-surface min-w-56 rounded-card border bg-gradient-to-br ${tones[stat.tone]} to-transparent p-4 sm:min-w-0`
  if (!onClick) return <article className={className}><StatContent Icon={Icon} stat={stat} /></article>

  return <button
    aria-label={`Open ${stat.label}: ${stat.value}`}
    className={`${className} w-full cursor-pointer text-left transition hover:-translate-y-0.5 hover:border-current/35 focus-visible:outline-2 focus-visible:outline-brand-cyan motion-reduce:transform-none`}
    onClick={onClick}
    type="button"
  >
    <StatContent Icon={Icon} stat={stat} />
  </button>
}
