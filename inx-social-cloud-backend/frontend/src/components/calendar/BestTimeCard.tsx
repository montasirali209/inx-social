import { BarChart3 } from 'lucide-react'
import type { BestTimeInsight } from '../../types/posts'

export function BestTimeCard({ insight, isLoading, onUseTime }: { insight: BestTimeInsight; isLoading: boolean; onUseTime: (time: string) => void }) {
  return <section className="rounded-card border border-border-soft bg-panel/55 p-3.5">
    <div className="flex items-center justify-between gap-3"><span><h3 className="text-xs font-semibold">Best Time to Post</h3><strong className="mt-1.5 block text-lg">{isLoading ? 'Checking live analytics…' : insight.label}</strong><p className="mt-1 text-[10px] leading-4 text-text-muted">{isLoading ? 'Calculating from the selected Page’s published content and engagement.' : insight.detail}</p></span><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-cyan/10 text-brand-cyan"><BarChart3 aria-hidden="true" className="size-5" /></span></div>
    <div className="mt-3 flex flex-wrap items-center gap-3">{insight.available && insight.time ? <button className="rounded-lg border border-brand-cyan/25 bg-brand-cyan/10 px-2.5 py-1.5 text-[10px] font-semibold text-brand-cyan hover:border-brand-cyan/55 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={() => onUseTime(insight.time!)} type="button">Use {insight.time}</button> : null}<a className="inline-flex text-[10px] font-semibold text-brand-cyan hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/app/analytics">Open live Analytics →</a></div>
  </section>
}
