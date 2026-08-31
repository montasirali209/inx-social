import { analyticsTabs } from '../../data/analyticsData'
import type { AnalyticsTab } from '../../types/analytics'

export function AnalyticsTabs({ active, onChange }: { active: AnalyticsTab; onChange: (tab: AnalyticsTab) => void }) {
  return <nav aria-label="Analytics views" className="scrollbar-thin flex overflow-x-auto rounded-card border border-border-soft bg-panel/70 px-2"><div className="flex min-w-max">{analyticsTabs.map(([id, label]) => <button aria-current={active === id ? 'page' : undefined} className={`relative min-h-12 px-4 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-cyan ${active === id ? 'text-brand-cyan after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-cyan after:shadow-[0_0_12px_#2dd4bf]' : 'text-text-muted hover:text-white'}`} key={id} onClick={() => onChange(id)} type="button">{label}</button>)}</div></nav>
}
