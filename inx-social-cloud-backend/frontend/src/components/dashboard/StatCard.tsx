import type { LucideIcon } from 'lucide-react'
import type { StatCardData } from '../../types/dashboard'

const toneStyles: Record<StatCardData['tone'], { icon: string; line: string }> = {
  blue: { icon: 'border-brand-blue/20 bg-brand-blue/10 text-[#62a9ff]', line: 'from-brand-blue/80' },
  cyan: { icon: 'border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan', line: 'from-brand-cyan/80' },
  green: { icon: 'border-brand-green/20 bg-brand-green/10 text-brand-green', line: 'from-brand-green/80' },
  purple: { icon: 'border-brand-purple/20 bg-brand-purple/10 text-[#bd9bff]', line: 'from-brand-purple/80' },
  amber: { icon: 'border-brand-amber/20 bg-brand-amber/10 text-brand-amber', line: 'from-brand-amber/80' },
  red: { icon: 'border-brand-red/20 bg-brand-red/10 text-[#ff7f89]', line: 'from-brand-red/80' },
}

export function StatCard({ data, icon: Icon }: { data: StatCardData; icon: LucideIcon }) {
  const style = toneStyles[data.tone]
  return (
    <article className="relative min-w-[220px] overflow-hidden rounded-card border border-border-soft bg-panel/88 p-4 shadow-panel backdrop-blur-xl md:min-w-0">
      <div className={`absolute inset-x-0 bottom-0 h-px bg-gradient-to-r ${style.line} to-transparent`} />
      <div className="flex items-start gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl border ${style.icon}`}>
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-muted">{data.label}</p>
          <strong className="mt-1 block text-3xl font-semibold tracking-[-0.04em] text-text-main">{data.value}</strong>
          <p className="mt-1 truncate text-xs text-text-soft">{data.detail}</p>
        </div>
      </div>
    </article>
  )
}
