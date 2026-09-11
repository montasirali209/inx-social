import type { LucideIcon } from 'lucide-react'
import type { StatCardData } from '../../types/dashboard'

const toneStyles: Record<StatCardData['tone'], { icon: string; glow: string; wash: string }> = {
  blue: { icon: 'border-brand-blue/25 bg-brand-blue/10 text-[#68aeff]', glow: 'bg-brand-blue/18', wash: 'from-brand-blue/8' },
  cyan: { icon: 'border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan', glow: 'bg-brand-cyan/18', wash: 'from-brand-cyan/8' },
  green: { icon: 'border-brand-green/25 bg-brand-green/10 text-brand-green', glow: 'bg-brand-green/18', wash: 'from-brand-green/8' },
  purple: { icon: 'border-brand-purple/25 bg-brand-purple/12 text-[#bd9bff]', glow: 'bg-brand-purple/20', wash: 'from-brand-purple/9' },
  amber: { icon: 'border-brand-amber/25 bg-brand-amber/10 text-brand-amber', glow: 'bg-brand-amber/18', wash: 'from-brand-amber/8' },
  red: { icon: 'border-brand-red/25 bg-brand-red/10 text-[#ff7f89]', glow: 'bg-brand-red/18', wash: 'from-brand-red/8' },
}

function displayValue(value: number | string) {
  if (typeof value !== 'number') return value
  if (Math.abs(value) < 1_000) return value.toLocaleString('en-GB')
  return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function StatCard({ data, icon: Icon }: { data: StatCardData; icon: LucideIcon }) {
  const style = toneStyles[data.tone]
  const content = (
    <>
      <div aria-hidden="true" className={`absolute -right-9 -top-10 size-28 rounded-full blur-3xl transition duration-500 group-hover:scale-125 ${style.glow}`} />
      <div aria-hidden="true" className={`absolute inset-0 bg-gradient-to-br ${style.wash} via-transparent to-transparent opacity-75`} />
      <div className="relative flex items-center gap-3">
        <span className={`icon-float grid size-10 shrink-0 place-items-center rounded-xl border shadow-[inset_0_1px_rgba(255,255,255,0.08)] ${style.icon}`}>
          <Icon aria-hidden="true" className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-text-muted">{data.label}</p>
          <span className="mt-1 flex items-end gap-2"><strong className="block text-[1.55rem] font-semibold leading-none tracking-[-0.05em] text-text-main">{displayValue(data.value)}</strong>{data.trend && <small className={data.trendDirection === 'down' ? 'text-brand-red' : data.trendDirection === 'up' ? 'text-brand-green' : 'text-text-soft'}>{data.trend}</small>}</span>
          <p className="mt-1 truncate text-[10px] text-text-soft transition-colors group-hover:text-text-muted">{data.detail}</p>
        </div>
      </div>
    </>
  )

  const classes = 'interactive-surface group relative min-h-[92px] min-w-[188px] overflow-hidden rounded-card border p-3 backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-brand-cyan/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan md:min-w-0 motion-reduce:transform-none motion-reduce:transition-none'

  return data.route
    ? <a className={classes} href={`/app${data.route}`}>{content}</a>
    : <article className={classes}>{content}</article>
}
