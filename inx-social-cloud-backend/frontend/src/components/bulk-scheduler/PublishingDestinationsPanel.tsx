import { Network, Search, Settings2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Destination, Platform, PlatformDefinition } from '../../types/bulk-scheduler'
import { Button } from '../ui/Button'
import { DestinationCard } from './DestinationCard'
import { PlatformFilterTabs, type PlatformFilter } from './PlatformFilterTabs'
import { platformName } from './platform-meta'

type Props = {
  destinations: Destination[]
  platforms: PlatformDefinition[]
  selectedIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
}

const trackedPlatforms: Platform[] = ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'x']

export function PublishingDestinationsPanel({ destinations, platforms, selectedIds, onSelectionChange }: Props) {
  const [filter, setFilter] = useState<PlatformFilter>('all')
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const counts = useMemo(() => {
    const result = { all: destinations.length, facebook: 0, instagram: 0, linkedin: 0, tiktok: 0, youtube: 0, x: 0 }
    destinations.forEach((destination) => { result[destination.platform] += 1 })
    return result
  }, [destinations])
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return destinations.filter((destination) => (
      (filter === 'all' || destination.platform === filter)
      && (!normalized || `${destination.name} ${destination.handle || ''} ${destination.type}`.toLowerCase().includes(normalized))
    ))
  }, [destinations, filter, query])
  const shown = expanded ? visible : visible.slice(0, 12)
  const selectedPlatforms = new Set(destinations.filter((destination) => selectedIds.has(destination.id)).map((destination) => destination.platform)).size
  const activePlatform = filter === 'all' ? null : platforms.find((platform) => platform.code === filter)

  const toggle = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(next)
  }
  const selectVisible = () => {
    const next = new Set(selectedIds)
    visible.filter((destination) => destination.connected).forEach((destination) => next.add(destination.id))
    onSelectionChange(next)
  }

  return (
    <section aria-labelledby="publishing-destinations-title" className="interactive-surface rounded-panel border p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-blue to-[#1558c9] text-white shadow-glow-blue"><Network aria-hidden="true" className="size-5" /></span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold" id="publishing-destinations-title">Publishing destinations</h2>
            <p className="mt-0.5 text-xs text-text-muted">Choose one or more connected accounts for this batch only.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-xl border border-border-soft bg-black/15 px-3 py-2 text-xs text-text-muted"><strong className="text-text-main">{selectedIds.size}</strong> destinations selected across <strong className="text-text-main">{selectedPlatforms}</strong> {selectedPlatforms === 1 ? 'platform' : 'platforms'}</span>
          <Button onClick={selectVisible} type="button">Select all visible</Button>
          <Button disabled={!selectedIds.size} onClick={() => onSelectionChange(new Set())} type="button" variant="ghost">Clear</Button>
          <a className="inline-flex min-h-10 items-center gap-2 rounded-control border border-border-strong bg-bg-panel-alt px-4 py-2 text-sm font-semibold text-text-main transition hover:border-brand-blue/60 hover:bg-bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan" href="/studio/?view=pages"><Settings2 aria-hidden="true" className="size-4" /> Manage connections</a>
        </div>
      </div>

      <div className="mt-4"><PlatformFilterTabs active={filter} counts={counts} onChange={(value) => { setFilter(value); setExpanded(false) }} /></div>

      {destinations.length >= 30 && (
        <label className="relative mt-3 block max-w-md">
          <span className="sr-only">Search destinations</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-soft" />
          <input className="min-h-10 w-full rounded-xl border border-border-soft bg-black/15 pl-10 pr-3 text-sm text-text-main placeholder:text-text-soft focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20" onChange={(event) => setQuery(event.target.value)} placeholder="Search destinations…" value={query} />
        </label>
      )}

      {shown.length ? (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {shown.map((destination) => <DestinationCard destination={destination} key={destination.id} onToggle={toggle} selected={selectedIds.has(destination.id)} />)}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-border-strong/70 bg-black/12 px-5 py-8 text-center">
          <Network aria-hidden="true" className="mx-auto size-7 text-brand-cyan" />
          <h3 className="mt-3 text-sm font-semibold">{filter === 'all' ? 'No connected destinations yet' : `${platformName(filter)} is not connected yet`}</h3>
          <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-text-muted">
            {activePlatform?.availability === 'PLANNED'
              ? `${activePlatform.label} publishing is prepared in the platform architecture but is not live in this Facebook-first release.`
              : 'Connect an account to make it available in this Bulk Scheduler session.'}
          </p>
        </div>
      )}

      {visible.length > 12 && (
        <button className="mx-auto mt-3 flex min-h-9 items-center text-xs font-semibold text-brand-cyan hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={() => setExpanded((value) => !value)} type="button">
          {expanded ? 'Show fewer destinations' : `Show ${visible.length - 12} more destinations`}
        </button>
      )}
      <p className="mt-3 text-[11px] text-text-soft">Selection stays local to this batch and never changes a global Page setting. Live now: {trackedPlatforms.filter((platform) => counts[platform] > 0).map(platformName).join(', ') || 'none'}.</p>
    </section>
  )
}
