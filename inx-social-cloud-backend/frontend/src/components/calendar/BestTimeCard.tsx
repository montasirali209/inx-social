import { BarChart3 } from 'lucide-react'

export function BestTimeCard() {
  return <section className="rounded-card border border-border-soft bg-panel/55 p-3.5">
    <div className="flex items-center justify-between gap-3"><span><h3 className="text-xs font-semibold">Best Time To Post</h3><strong className="mt-1.5 block text-lg">Analytics required</strong><p className="mt-1 text-[10px] leading-4 text-text-muted">A recommendation appears only when the selected account returns sufficient live engagement history.</p></span><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-cyan/10 text-brand-cyan"><BarChart3 aria-hidden="true" className="size-5" /></span></div>
    <a className="mt-3 inline-flex text-[10px] font-semibold text-brand-cyan hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/app/analytics">Open live Analytics →</a>
  </section>
}
