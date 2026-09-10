import { Check, ChevronRight, Search, SlidersHorizontal, UsersRound, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { platforms } from '../../data/postsData'
import type { Destination, Platform } from '../../types/posts'
import { Button } from '../ui/Button'
import { PanelHeading, PlatformIcon } from './PostPrimitives'

type DestinationMode = 'post' | 'batch'
type Props = {
  destinations: Destination[]
  selectedIds: string[]
  setSelectedIds: (ids: string[]) => void
  mode?: DestinationMode
  plannedPlatforms?: Platform[]
}

const copy = {
  post: {
    title: 'Choose Destinations',
    selectedSubtitle: 'Selection saved for this post only. Change it at any time.',
    emptySubtitle: 'Choose one or many connected accounts for this post.',
    modalDescription: 'Connected profiles are listed by platform. Unavailable publishers explain what remains to be enabled.',
  },
  batch: {
    title: 'Publishing destinations',
    selectedSubtitle: 'Selection saved for this batch only. Change it at any time.',
    emptySubtitle: 'Choose one or many connected accounts for this batch.',
    modalDescription: 'Connected profiles are listed by platform. Your selection applies only to this Bulk Scheduler batch.',
  },
} as const

export function DestinationSelector({ destinations, selectedIds, setSelectedIds, mode = 'post', plannedPlatforms = [] }: Props) {
  const [open, setOpen] = useState(false)
  const [activePlatform, setActivePlatform] = useState<'all' | Platform>('all')
  const [search, setSearch] = useState('')
  const closeModal = useCallback(() => setOpen(false), [])
  const selectedDestinations = destinations.filter((destination) => selectedIds.includes(destination.id))
  const labels = copy[mode]

  return <>
    <section className={`interactive-surface rounded-panel border border-brand-cyan/20 p-4 sm:p-5 ${mode === 'post' ? 'mt-5' : ''}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <PanelHeading step={2} subtitle={selectedDestinations.length ? labels.selectedSubtitle : labels.emptySubtitle} title={labels.title} />
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center lg:max-w-3xl lg:justify-end">
          <div className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border-soft bg-bg/30 px-3 py-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-cyan/10 text-brand-cyan"><UsersRound className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-xs">{selectedDestinations.length ? `${selectedDestinations.length} destination${selectedDestinations.length === 1 ? '' : 's'} selected` : 'No destinations selected'}</strong>
              <p className="mt-0.5 truncate text-[10px] text-text-muted">{selectedDestinations.length ? selectedDestinations.map((destination) => destination.name).join(' · ') : 'Open the selector to choose connected accounts.'}</p>
            </div>
            <div className="hidden -space-x-2 sm:flex">
              {selectedDestinations.slice(0, 4).map((destination) => <span className="relative" key={destination.id}><img alt={destination.name} className="size-8 rounded-full border-2 border-panel object-cover" src={destination.avatarUrl || '/assets/inx-social-mark.png'} /><PlatformIcon className="absolute -bottom-1 -right-1 size-4 rounded-full" platform={destination.platform} /></span>)}
              {selectedDestinations.length > 4 && <span className="grid size-8 place-items-center rounded-full border-2 border-panel bg-panel-soft text-[9px] text-text-muted">+{selectedDestinations.length - 4}</span>}
            </div>
          </div>
          <Button className="shrink-0 sm:min-w-44" onClick={() => setOpen(true)} type="button" variant="primary">{selectedDestinations.length ? 'Change selection' : 'Choose destinations'}<ChevronRight className="size-4" /></Button>
        </div>
      </div>
    </section>
    {open && <DestinationModal activePlatform={activePlatform} destinations={destinations} labels={labels} onActivePlatform={setActivePlatform} onClose={closeModal} plannedPlatforms={plannedPlatforms} search={search} selectedIds={selectedIds} setSearch={setSearch} setSelectedIds={setSelectedIds} />}
  </>
}

type ModalProps = Omit<Props, 'mode'> & {
  activePlatform: 'all' | Platform
  onActivePlatform: (platform: 'all' | Platform) => void
  search: string
  setSearch: (value: string) => void
  onClose: () => void
  labels: typeof copy[DestinationMode]
}

function DestinationModal({ destinations, selectedIds, setSelectedIds, activePlatform, onActivePlatform, search, setSearch, onClose, labels, plannedPlatforms = [] }: ModalProps) {
  const matchingDestinations = useMemo(() => {
    const query = search.toLowerCase().trim()
    return destinations.filter((destination) => `${destination.name} ${destination.handle || ''} ${destination.type}`.toLowerCase().includes(query))
  }, [destinations, search])
  const visibleDestinations = activePlatform === 'all' ? matchingDestinations : matchingDestinations.filter((destination) => destination.platform === activePlatform)
  const selectedDestinations = destinations.filter((destination) => selectedIds.includes(destination.id))
  const activePlatformLabel = activePlatform === 'all' ? 'Platform' : platforms.find((platform) => platform.id === activePlatform)?.label || activePlatform
  const activePlatformPlanned = activePlatform !== 'all' && plannedPlatforms.includes(activePlatform)

  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', escape)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', escape)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  function toggle(id: string) {
    setSelectedIds(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id])
  }

  function selectVisible() {
    setSelectedIds([...new Set([...selectedIds, ...visibleDestinations.filter((destination) => destination.connected).map((destination) => destination.id)])])
  }

  return createPortal(
    <div className="posts-modal-backdrop fixed inset-0 z-[85] grid place-items-center overflow-y-auto bg-[#020914]/80 p-3 backdrop-blur-md sm:p-6" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
      <section aria-labelledby="destination-modal-title" aria-modal="true" className="posts-modal-panel my-auto flex max-h-[min(860px,92vh)] w-full max-w-6xl flex-col overflow-hidden rounded-panel border border-brand-cyan/30 bg-panel shadow-[0_32px_130px_rgba(0,0,0,.68),0_0_75px_rgba(20,184,166,.12)]" role="dialog">
        <header className="flex items-start justify-between gap-4 border-b border-border-soft bg-gradient-to-br from-brand-cyan/[0.1] via-panel to-panel p-5 sm:p-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-brand-cyan">Step 2 · Session selection</p>
            <h2 className="mt-1 text-xl font-semibold" id="destination-modal-title">Choose publishing destinations</h2>
            <p className="mt-1 text-xs text-text-muted">{labels.modalDescription}</p>
          </div>
          <button aria-label="Close destination selector" className="rounded-xl border border-border-soft bg-bg/45 p-2 text-text-muted transition hover:border-brand-cyan/35 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={onClose} type="button"><X className="size-4" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-2" role="tablist">
            {[{ id: 'all' as const, label: 'All' }, ...platforms].map((item) => {
              const count = item.id === 'all' ? destinations.length : destinations.filter((destination) => destination.platform === item.id).length
              return <button aria-selected={activePlatform === item.id} className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[10px] font-semibold transition focus-visible:outline-2 focus-visible:outline-brand-cyan ${activePlatform === item.id ? 'border-brand-cyan/55 bg-brand-cyan/12 text-brand-cyan' : 'border-border-soft bg-bg/25 text-text-muted hover:text-white'}`} key={item.id} onClick={() => onActivePlatform(item.id)} role="tab" type="button">{item.id !== 'all' && <PlatformIcon className="size-[18px] rounded-md shadow-none" platform={item.id} />}{item.label}<span className="rounded-full bg-white/6 px-1.5 py-0.5 text-[9px]">{count}</span></button>
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="relative min-w-52 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-soft" /><input aria-label="Search publishing destinations" className="min-h-11 w-full rounded-xl border border-border-soft bg-bg/35 pl-9 pr-3 text-xs outline-none placeholder:text-text-soft focus:border-brand-cyan" onChange={(event) => setSearch(event.target.value)} placeholder="Search accounts or profiles…" value={search} /></label>
            <Button aria-label="Filter destinations" className="size-11 px-0" type="button" variant="ghost"><SlidersHorizontal className="size-4" /></Button>
            <Button className="text-[10px]" disabled={!visibleDestinations.some((destination) => destination.connected)} onClick={selectVisible} type="button">Select All Visible</Button>
            <Button className="text-[10px]" disabled={!selectedIds.length} onClick={() => setSelectedIds([])} type="button" variant="ghost">Clear all</Button>
          </div>
          {visibleDestinations.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visibleDestinations.map((destination) => {
            const isSelected = selectedIds.includes(destination.id)
            return <label className={`group relative flex items-center gap-3 rounded-2xl border p-3.5 transition duration-200 focus-within:outline-2 focus-within:outline-brand-cyan ${isSelected ? 'border-brand-cyan/60 bg-brand-cyan/[0.09]' : 'border-border-soft bg-bg/25'} ${destination.connected ? 'cursor-pointer hover:-translate-y-0.5 hover:border-brand-cyan/25' : 'cursor-not-allowed opacity-70'}`} key={destination.id} title={destination.disabledReason || undefined}>
              <input checked={isSelected} className="peer sr-only" disabled={!destination.connected} onChange={() => toggle(destination.id)} type="checkbox" />
              <span className={`grid size-5 shrink-0 place-items-center rounded-md border ${isSelected ? 'border-brand-cyan bg-brand-cyan text-bg' : 'border-white/20 bg-bg/40'}`}>{isSelected && <Check className="size-3.5" />}</span>
              <span className="relative shrink-0"><img alt="" className="size-11 rounded-full border border-white/10 object-cover" src={destination.avatarUrl || '/assets/inx-social-mark.png'} /><PlatformIcon className="absolute -bottom-1 -right-1 size-5 rounded-full" platform={destination.platform} /></span>
              <span className="min-w-0"><strong className="block truncate text-xs">{destination.name}</strong><span className="mt-0.5 block truncate text-[10px] text-text-muted">{destination.handle ? `${destination.handle} · ` : ''}{destination.type}</span><span className={`mt-1 inline-flex items-center gap-1 text-[9px] ${destination.connected ? 'text-brand-green' : 'text-brand-amber'}`}><i className="size-1.5 rounded-full bg-current" />{destination.connected ? 'Ready to publish' : destination.platform === 'facebook' ? 'Reconnect required' : destination.disabledReason}</span></span>
            </label>
          })}</div> : <div className="mt-4 rounded-2xl border border-dashed border-border-soft bg-bg/20 p-10 text-center"><PlatformIcon className="mx-auto" platform={activePlatform === 'all' ? 'facebook' : activePlatform} /><strong className="mt-3 block text-sm">{activePlatformPlanned ? `${activePlatformLabel} publishing is not available yet` : 'No matching connected profiles'}</strong><p className="mt-1 text-xs text-text-muted">{activePlatformPlanned ? `${activePlatformLabel} is prepared in INXSocial's platform architecture but publishing is not live yet.` : activePlatform === 'all' || activePlatform === 'facebook' ? 'Connect an account or change your search.' : 'No profile is connected yet; this connector still needs authorization.'}</p></div>}
        </div>
        <footer className="flex flex-col gap-3 border-t border-border-soft bg-bg/35 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-3"><strong className="shrink-0 text-xs text-brand-cyan">{selectedIds.length} selected</strong><div className="flex -space-x-2">{selectedDestinations.slice(0, 5).map((destination) => <img alt={destination.name} className="size-7 rounded-full border-2 border-panel object-cover" key={destination.id} src={destination.avatarUrl || '/assets/inx-social-mark.png'} />)}{selectedDestinations.length > 5 && <span className="grid size-7 place-items-center rounded-full border-2 border-panel bg-panel-soft text-[9px]">+{selectedDestinations.length - 5}</span>}</div></div>
          <Button className="sm:min-w-36" onClick={onClose} type="button" variant="primary"><Check className="size-4" />Done</Button>
        </footer>
      </section>
    </div>, document.body)
}
