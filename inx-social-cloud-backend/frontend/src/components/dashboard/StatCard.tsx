import type { LucideIcon } from 'lucide-react'
import type { StatCardData } from '../../types/dashboard'

const toneStyles: Record<StatCardData['tone'], { icon: string; line: string; glow: string; wash: string }> = {
  blue: { icon: 'border-white/10 bg-white/5 text-text-muted', line: 'from-brand-cyan', glow: 'bg-brand-cyan/12', wash: 'from-brand-cyan/5' },
  cyan: { icon: 'border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan', line: 'from-brand-cyan', glow: 'bg-brand-cyan/18', wash: 'from-brand-cyan/8' },
  green: { icon: 'border-brand-green/25 bg-brand-green/10 text-brand-green', line: 'from-brand-green', glow: 'bg-brand-green/18', wash: 'from-brand-green/8' },
  purple: { icon: 'border-brand-purple/25 bg-brand-purple/12 text-[#bd9bff]', line: 'from-brand-purple', glow: 'bg-brand-purple/20', wash: 'from-brand-purple/9' },
  amber: { icon: 'border-brand-amber/25 bg-brand-amber/10 text-brand-amber', line: 'from-brand-amber', glow: 'bg-brand-amber/18', wash: 'from-brand-amber/8' },
  red: { icon: 'border-brand-red/25 bg-brand-red/10 text-[#ff7f89]', line: 'from-brand-red', glow: 'bg-brand-red/18', wash: 'from-brand-red/8' },
}

export function StatCard({ data, icon: Icon }: { data: StatCardData; icon: LucideIcon }) {
  const style = toneStyles[data.tone]
  return (
    <article className="interactive-surface group relative min-w-[205px] overflow-hidden rounded-card border p-4 backdrop-blur-xl md:min-w-0">
      <div aria-hidden="true" className={`absolute -right-9 -top-10 size-28 rounded-full blur-3xl ${style.glow}`} />
      <div aria-hidden="true" className={`absolute inset-0 bg-gradient-to-br ${style.wash} via-transparent to-transparent opacity-75`} />
      <div className="relative flex items-start gap-3.5">
        <span className={`icon-float grid size-11 shrink-0 place-items-center rounded-xl border shadow-[inset_0_1px_rgba(255,255,255,0.08)] ${style.icon}`}>
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-muted">{data.label}</p>
          <span className="mt-1 flex items-end gap-2"><strong className="block text-[1.8rem] font-semibold leading-none tracking-[-0.05em] text-text-main">{data.value}</strong>{data.trend && <small className={data.trendDirection === 'down' ? 'text-brand-red' : data.trendDirection === 'up' ? 'text-brand-green' : 'text-text-soft'}>{data.trend}</small>}</span>
          <p className="mt-1.5 truncate text-xs text-text-soft transition-colors group-hover:text-text-muted">{data.detail}</p>
        </div>
      </div>
    </article>
  )
}
