import { Bot, CalendarClock, Folder, FolderOpen, Image, Send, SlidersHorizontal, Upload, X } from 'lucide-react'
import { emptyMediaFilters, systemFolders, type MediaFilters } from '../../data/mediaLibraryData'
import type { MediaAsset, MediaFolder } from '../../types/media-library'
import { Button } from '../ui/Button'

type Props = {
  assets: MediaAsset[]; folders: MediaFolder[]; active: string; filters: MediaFilters; open: boolean
  onActive: (id: string) => void; onFilters: (filters: MediaFilters) => void; onClose: () => void; onCreateFolder: () => void
}

const icons = { all: FolderOpen, brand_assets: Image, ai_generated: Bot, uploaded: Upload, scheduled: CalendarClock, published: Send }
export function FolderPanel(props: Props) {
  function count(id: string) {
    if (id === 'all') return props.assets.length
    if (id === 'brand_assets') return props.assets.filter(asset => asset.collection === 'brand_assets').length
    if (id === 'ai_generated') return props.assets.filter(asset => asset.source === 'ai_generated').length
    if (id === 'uploaded') return props.assets.filter(asset => asset.collection === 'uploaded_media').length
    return props.assets.filter(asset => asset.status === id).length
  }
  function update<K extends keyof MediaFilters>(key: K, value: MediaFilters[K]) { props.onFilters({ ...props.filters, [key]: value }) }
  const hasFilters = Object.values(props.filters).some(value => value !== 'all')
  const selectClass = 'min-h-10 rounded-xl border border-border-soft bg-bg/35 px-3 text-[10px] text-text-muted outline-none focus:border-brand-cyan'
  const content = <aside className="h-full rounded-panel border border-border-soft bg-panel/75 p-4 shadow-panel">
    <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Folders & Filters</h2><div className="flex gap-1"><button aria-label="Create folder" className="rounded-lg p-2 text-brand-cyan hover:bg-brand-cyan/10 focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={props.onCreateFolder} type="button"><Folder className="size-4" /></button><button aria-label="Close filters" className="rounded-lg p-2 text-text-muted hover:bg-white/5 2xl:hidden" onClick={props.onClose} type="button"><X className="size-4" /></button></div></div>
    <nav aria-label="Media folders" className="mt-3 space-y-1">{systemFolders.map(item => { const Icon = icons[item.id as keyof typeof icons]; return <button className={`flex min-h-10 w-full items-center gap-2 rounded-xl border px-3 text-left text-[11px] transition focus-visible:outline-2 focus-visible:outline-brand-cyan ${props.active === item.id ? 'border-brand-cyan/35 bg-brand-cyan/10 text-brand-cyan' : 'border-transparent text-text-muted hover:bg-white/4 hover:text-white'}`} key={item.id} onClick={() => props.onActive(item.id)} type="button"><Icon className="size-4" /><span className="flex-1 truncate">{item.label}</span><span className="text-[9px]">{count(item.id)}</span></button>})}{props.folders.map(folder => <button className={`flex min-h-10 w-full items-center gap-2 rounded-xl border px-3 text-left text-[11px] transition focus-visible:outline-2 focus-visible:outline-brand-cyan ${props.active === folder.id ? 'border-brand-cyan/35 bg-brand-cyan/10 text-brand-cyan' : 'border-transparent text-text-muted hover:bg-white/4 hover:text-white'}`} key={folder.id} onClick={() => props.onActive(folder.id)} type="button"><Folder className="size-4" /><span className="flex-1 truncate">{folder.name}</span><span className="text-[9px]">{folder.count}</span></button>)}</nav>
    <div className="my-4 border-t border-border-soft" />
    <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs font-semibold"><SlidersHorizontal className="size-4 text-brand-cyan" />Filters</span><button className="text-[9px] font-semibold text-brand-cyan disabled:opacity-40" disabled={!hasFilters} onClick={() => props.onFilters(emptyMediaFilters)} type="button">Clear all</button></div>
    <div className="mt-3 grid gap-2">
      <select aria-label="Type" className={selectClass} onChange={event => update('type', event.target.value as MediaFilters['type'])} value={props.filters.type}><option value="all">Type · All</option><option value="image">Images</option><option value="video">Videos</option><option value="gif">GIFs</option></select>
      <select aria-label="Platform size" className={selectClass} onChange={event => update('platformSize', event.target.value as MediaFilters['platformSize'])} value={props.filters.platformSize}><option value="all">Platform Size · All</option><option value="square">Square</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option><option value="unknown">Size not reported</option></select>
      <select aria-label="Source" className={selectClass} onChange={event => update('source', event.target.value as MediaFilters['source'])} value={props.filters.source}><option value="all">Source · All</option><option value="uploaded">Uploaded</option><option value="ai_generated">AI Generated</option><option value="imported">Imported</option></select>
      <select aria-label="Status" className={selectClass} onChange={event => update('status', event.target.value as MediaFilters['status'])} value={props.filters.status}><option value="all">Status · All</option><option value="unused">Unused</option><option value="used">Used</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="needs_review">Needs Review</option></select>
      <select aria-label="Date added" className={selectClass} onChange={event => update('dateAdded', event.target.value as MediaFilters['dateAdded'])} value={props.filters.dateAdded}><option value="all">Date Added · Any time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select>
    </div>
    <Button className="mt-3 w-full" onClick={props.onClose} type="button" variant="ghost">Apply Filters</Button>
  </aside>
  return <>{props.open && <button aria-label="Close filters" className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm 2xl:hidden" onClick={props.onClose} type="button" />}<div className={`fixed inset-y-3 left-3 z-50 w-[min(310px,calc(100vw-24px))] transition-transform 2xl:static 2xl:z-auto 2xl:block 2xl:w-auto 2xl:translate-x-0 ${props.open ? 'translate-x-0' : '-translate-x-[110%]'}`}>{content}</div></>
}
