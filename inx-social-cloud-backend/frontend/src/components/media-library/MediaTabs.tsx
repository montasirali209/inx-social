import { mediaTabs } from '../../data/mediaLibraryData'
import type { MediaAsset, MediaTabId } from '../../types/media-library'

export function MediaTabs({ active, assets, onChange }: { active: MediaTabId; assets: MediaAsset[]; onChange: (value: MediaTabId) => void }) {
  function count(tab: MediaTabId) {
    if (tab === 'all') return assets.length
    if (tab === 'videos') return assets.filter(asset => asset.type === 'video').length
    if (tab === 'images') return assets.filter(asset => asset.type !== 'video').length
    if (tab === 'ai_generated') return assets.filter(asset => asset.source === 'ai_generated').length
    if (tab === 'brand_assets') return assets.filter(asset => asset.collection === 'brand_assets').length
    return assets.filter(asset => asset.status === tab).length
  }
  return <div className="scrollbar-thin flex gap-1.5 overflow-x-auto" role="tablist">{mediaTabs.map(tab => <button aria-selected={active === tab.id} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-[10px] font-semibold transition focus-visible:outline-2 focus-visible:outline-brand-cyan ${active === tab.id ? 'border-brand-cyan/45 bg-brand-cyan/12 text-brand-cyan' : 'border-transparent bg-bg/20 text-text-muted hover:border-border-soft hover:text-white'}`} key={tab.id} onClick={() => onChange(tab.id)} role="tab" type="button">{tab.label}<span className="rounded-full bg-white/6 px-1.5 py-0.5 text-[8px]">{count(tab.id)}</span></button>)}</div>
}
