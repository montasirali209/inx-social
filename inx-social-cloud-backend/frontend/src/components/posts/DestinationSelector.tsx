import { Check, Search, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { platforms } from '../../data/postsData'
import type { ConnectedPage } from '../../types/dashboard'
import type { Platform } from '../../types/posts'
import { Button } from '../ui/Button'
import { PanelHeading, PlatformIcon } from './PostPrimitives'

type Props = {
  pages: ConnectedPage[]
  selectedIds: string[]
  setSelectedIds: (ids: string[]) => void
}

function connected(page: ConnectedPage) { return page.status !== 'REVOKED' && page.status !== 'DISCONNECTED' }

export function DestinationSelector({ pages, selectedIds, setSelectedIds }: Props) {
  const [activePlatform, setActivePlatform] = useState<'all' | Platform>('all')
  const [search, setSearch] = useState('')
  const livePages = useMemo(() => pages.filter((page) => page.facebookPageName.toLowerCase().includes(search.toLowerCase().trim())), [pages, search])
  const visiblePages = activePlatform === 'all' || activePlatform === 'facebook' ? livePages : []
  const selectedPages = pages.filter((page) => selectedIds.includes(page.id))

  function toggle(id: string) { setSelectedIds(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]) }
  function selectVisible() { setSelectedIds([...new Set([...selectedIds, ...visiblePages.filter(connected).map((page) => page.id)])]) }

  return (
    <section className="interactive-surface rounded-panel border p-4 xl:p-5">
      <PanelHeading step={2} subtitle="Select every account that should receive this post." title="Choose Destinations" />
      <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-2" role="tablist">{[{ id: 'all' as const, label: 'All' }, ...platforms].map((item) => { const count = item.id === 'all' || item.id === 'facebook' ? pages.length : 0; return <button aria-selected={activePlatform === item.id} className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[10px] font-semibold transition focus-visible:outline-2 focus-visible:outline-brand-cyan ${activePlatform === item.id ? 'border-brand-cyan/55 bg-brand-cyan/12 text-brand-cyan' : 'border-border-soft bg-bg/25 text-text-muted hover:text-white'}`} key={item.id} onClick={() => setActivePlatform(item.id)} role="tab" type="button">{item.id !== 'all' && <PlatformIcon className="size-4 rounded text-[8px]" platform={item.id} />}{item.label}<span className="rounded-full bg-white/6 px-1.5 py-0.5 text-[9px]">{count}</span></button> })}</div>
      <div className="mt-2 flex flex-wrap gap-2"><label className="relative min-w-48 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-soft" /><input className="min-h-10 w-full rounded-xl border border-border-soft bg-bg/35 pl-9 pr-3 text-xs outline-none placeholder:text-text-soft focus:border-brand-cyan" onChange={(event) => setSearch(event.target.value)} placeholder="Search accounts or pages…" value={search} /></label><Button aria-label="Filter destinations" className="size-10 px-0" type="button" variant="ghost"><SlidersHorizontal className="size-4" /></Button><Button className="text-[10px]" disabled={!visiblePages.length} onClick={selectVisible} type="button">Select All Visible</Button><Button className="text-[10px]" disabled={!selectedIds.length} onClick={() => setSelectedIds([])} type="button" variant="ghost">Clear</Button></div>

      {visiblePages.length ? <div className="scrollbar-thin mt-3 grid max-h-[430px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{visiblePages.map((page) => { const isSelected = selectedIds.includes(page.id); const enabled = connected(page); return <label className={`group relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition duration-200 hover:-translate-y-0.5 focus-within:outline-2 focus-within:outline-brand-cyan ${isSelected ? 'border-brand-cyan/60 bg-brand-cyan/[0.08] shadow-[0_0_24px_rgba(45,212,191,0.08)]' : 'border-border-soft bg-bg/25 hover:border-brand-cyan/25'} ${enabled ? '' : 'cursor-not-allowed opacity-55'}`} key={page.id}><input checked={isSelected} className="peer sr-only" disabled={!enabled} onChange={() => toggle(page.id)} type="checkbox" /><span className={`grid size-5 shrink-0 place-items-center rounded-md border ${isSelected ? 'border-brand-cyan bg-brand-cyan text-bg' : 'border-white/20 bg-bg/40'}`}>{isSelected && <Check className="size-3.5" />}</span><span className="relative shrink-0"><img alt="" className="size-10 rounded-full border border-white/10 object-cover" src={page.facebookPagePicture || '/assets/inx-social-mark.png'} /><PlatformIcon className="absolute -bottom-1 -right-1 size-5 rounded-full" platform="facebook" /></span><span className="min-w-0"><strong className="block truncate text-xs">{page.facebookPageName}</strong><span className="mt-0.5 block truncate text-[10px] text-text-muted">Facebook Page{page.facebookCategory ? ` · ${page.facebookCategory}` : ''}</span><span className={`mt-1 inline-flex items-center gap-1 text-[9px] ${enabled ? 'text-brand-green' : 'text-brand-red'}`}><i className="size-1.5 rounded-full bg-current" />{enabled ? 'Connected' : 'Reconnect required'}</span></span></label> })}</div> : <div className="mt-3 rounded-xl border border-dashed border-border-soft bg-bg/20 p-7 text-center"><PlatformIcon className="mx-auto" platform={activePlatform === 'all' ? 'facebook' : activePlatform} /><strong className="mt-3 block text-xs">{activePlatform === 'all' || activePlatform === 'facebook' ? 'No connected Pages found' : `${platforms.find((item) => item.id === activePlatform)?.label} connector is planned`}</strong><p className="mt-1 text-[10px] text-text-muted">{activePlatform === 'all' || activePlatform === 'facebook' ? 'Connect a Facebook Page before publishing.' : 'This destination will appear here when its connector is enabled.'}</p></div>}

      <footer className="mt-3 flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-cyan/15 bg-brand-cyan/[0.035] px-3 py-2"><strong className="text-xs text-brand-cyan">{selectedIds.length} destination{selectedIds.length === 1 ? '' : 's'} selected</strong><div className="flex items-center gap-1">{selectedPages.slice(0, 5).map((page) => <img alt={page.facebookPageName} className="size-6 rounded-full border border-bg object-cover" key={page.id} src={page.facebookPagePicture || '/assets/inx-social-mark.png'} />)}{selectedPages.length > 5 && <span className="text-[10px] text-text-muted">+{selectedPages.length - 5}</span>}</div></footer>
    </section>
  )
}
