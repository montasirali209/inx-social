import type { Platform } from '../../types/bulk-scheduler'
import { PlatformMark } from './PlatformMark'

export type PlatformFilter = 'all' | Platform

const filters: Array<{ value: PlatformFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'x', label: 'X' },
]

type Props = {
  active: PlatformFilter
  counts: Record<PlatformFilter, number>
  onChange: (filter: PlatformFilter) => void
}

export function PlatformFilterTabs({ active, counts, onChange }: Props) {
  return (
    <div aria-label="Filter publishing destinations" className="scrollbar-thin flex gap-2 overflow-x-auto pb-1" role="tablist">
      {filters.map((filter) => {
        const selected = active === filter.value
        return (
          <button
            aria-selected={selected}
            className={`inline-flex min-h-10 min-w-[8.2rem] shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan motion-reduce:transition-none ${selected ? 'border-brand-blue/55 bg-brand-blue/18 text-white shadow-glow-blue' : 'border-border-soft bg-black/12 text-text-muted hover:border-brand-blue/35 hover:bg-panel-hover/55 hover:text-white'}`}
            key={filter.value}
            onClick={() => onChange(filter.value)}
            role="tab"
            type="button"
          >
            {filter.value !== 'all' && <PlatformMark platform={filter.value} size="sm" />}
            {filter.label}
            <span className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] text-text-muted">{counts[filter.value]}</span>
          </button>
        )
      })}
    </div>
  )
}
