import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import type { ConnectedPage } from '../../types/dashboard'

type DashboardAccountSelectorProps = {
  pages: ConnectedPage[]
  value: string
  isRefreshing: boolean
  onChange: (pageId: string) => void
  onRefresh: () => void
  contextLabel?: string
}

function PageAvatar({ page, size = 'large' }: { page: ConnectedPage; size?: 'large' | 'small' }) {
  const dimension = size === 'large' ? 'size-11' : 'size-9'
  const fallback = page.facebookPageName.trim().slice(0, 1).toUpperCase() || 'P'
  return (
    <span className={`relative grid ${dimension} shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-emerald-400/25 to-teal-500/10 text-sm font-bold text-white shadow-[0_10px_24px_rgba(0,0,0,.24)]`}>
      {page.facebookPagePicture
        ? <img alt="" className="size-full object-cover" src={page.facebookPagePicture} />
        : fallback}
    </span>
  )
}

export function DashboardAccountSelector({
  pages,
  value,
  isRefreshing,
  onChange,
  onRefresh,
  contextLabel = 'Dashboard',
}: DashboardAccountSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const availablePages = useMemo(() => pages.filter((page) => page.status !== 'REVOKED'), [pages])
  const selected = availablePages.find((page) => page.id === value) || availablePages[0] || null
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return availablePages
    return availablePages.filter((page) => [
      page.facebookPageName,
      page.facebookPageUsername,
      page.facebookCategory,
    ].some((entry) => entry?.toLowerCase().includes(term)))
  }, [availablePages, search])

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        rootRef.current?.querySelector<HTMLButtonElement>('[data-selector-trigger]')?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  function select(pageId: string) {
    onChange(pageId)
    setOpen(false)
    setSearch('')
  }

  return (
    <section className="relative z-20 overflow-visible rounded-card border border-emerald-300/15 bg-gradient-to-r from-panel via-panel to-emerald-950/20 p-3 shadow-[0_18px_55px_rgba(0,0,0,.24),0_0_32px_rgba(20,184,166,.05)] sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-300 shadow-[0_0_24px_rgba(34,197,94,.12)]">
            <ShieldCheck aria-hidden="true" className="size-5" />
            <span className="absolute -right-1 -top-1 size-2.5 animate-pulse rounded-full border-2 border-panel bg-emerald-400 motion-reduce:animate-none" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-text-main">Analytics account</h2>
              <span className="rounded-full border border-teal-300/15 bg-teal-400/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-300">{contextLabel} only</span>
            </div>
            <p className="mt-0.5 text-xs text-text-muted">Choose which connected Page supplies the performance data below.</p>
          </div>
        </div>

        <div className="flex min-w-0 items-stretch gap-2" ref={rootRef}>
          <div className="relative min-w-0 flex-1 sm:min-w-[360px]">
            <button
              aria-expanded={open}
              aria-haspopup="listbox"
              className="group flex min-h-14 w-full items-center gap-3 rounded-xl border border-emerald-300/20 bg-bg/65 px-3 text-left shadow-inner transition duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-300/45 hover:bg-panel-hover/65 hover:shadow-[0_14px_34px_rgba(0,0,0,.3),0_0_28px_rgba(20,184,166,.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transform-none motion-reduce:transition-none"
              data-selector-trigger
              disabled={!selected}
              onClick={() => setOpen((current) => !current)}
              type="button"
            >
              {selected ? <PageAvatar page={selected} /> : <span className="grid size-11 place-items-center rounded-xl bg-white/5 text-text-soft">—</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-text-main">{selected?.facebookPageName || 'No connected Pages'}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                  <span className="grid size-4 place-items-center rounded-full bg-[#1877f2] text-[10px] font-bold text-white">f</span>
                  Facebook Page
                  {selected?.facebookPageUsername ? <span className="truncate text-text-soft">· @{selected.facebookPageUsername}</span> : null}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="hidden items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-300 sm:flex">
                  <span className="size-1.5 rounded-full bg-emerald-400" /> Live
                </span>
                <ChevronDown aria-hidden="true" className={`size-4 text-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
              </span>
            </button>

            {open ? (
              <div className="absolute right-0 top-[calc(100%+.65rem)] z-50 w-full min-w-[min(92vw,420px)] origin-top-right rounded-2xl border border-emerald-300/20 bg-[#061721]/98 p-2 shadow-[0_28px_90px_rgba(0,0,0,.58),0_0_45px_rgba(20,184,166,.12)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3 px-2 pb-2 pt-1">
                  <div>
                    <p className="text-xs font-semibold text-text-main">Connected analytics sources</p>
                    <p className="text-[11px] text-text-soft">{availablePages.length} Facebook Page{availablePages.length === 1 ? '' : 's'} available</p>
                  </div>
                  <span className="rounded-full border border-[#1877f2]/25 bg-[#1877f2]/10 px-2 py-1 text-[10px] font-semibold text-blue-300">Facebook {availablePages.length}</span>
                </div>

                {availablePages.length > 5 ? (
                  <label className="relative mb-2 block">
                    <span className="sr-only">Search connected Pages</span>
                    <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-soft" />
                    <input
                      autoFocus
                      className="min-h-10 w-full rounded-xl border border-white/10 bg-bg/75 pl-9 pr-3 text-sm text-text-main placeholder:text-text-soft focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search connected Pages…"
                      value={search}
                    />
                  </label>
                ) : null}

                <div aria-label="Connected Pages" className="scrollbar-thin max-h-72 space-y-1 overflow-y-auto" role="listbox">
                  {filtered.map((page) => {
                    const isSelected = page.id === selected?.id
                    return (
                      <button
                        aria-selected={isSelected}
                        className={`group/option flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 text-left transition duration-200 focus-visible:outline-2 focus-visible:outline-brand-cyan motion-reduce:transition-none ${isSelected ? 'border-emerald-300/35 bg-emerald-400/10 shadow-[inset_3px_0_0_#2dd4bf,0_0_22px_rgba(20,184,166,.08)]' : 'border-transparent hover:border-white/10 hover:bg-white/[.045]'}`}
                        key={page.id}
                        onClick={() => select(page.id)}
                        role="option"
                        type="button"
                      >
                        <PageAvatar page={page} size="small" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-text-main">{page.facebookPageName}</span>
                          <span className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-text-muted">
                            <span className="grid size-3.5 place-items-center rounded-full bg-[#1877f2] text-[9px] font-bold text-white">f</span>
                            {page.facebookCategory || 'Facebook Page'}
                            <span className="text-emerald-400">· Connected</span>
                          </span>
                        </span>
                        <span className={`grid size-6 place-items-center rounded-full border transition ${isSelected ? 'border-emerald-300/40 bg-emerald-400 text-[#032018]' : 'border-white/15 text-transparent group-hover/option:border-white/30'}`}>
                          <Check aria-hidden="true" className="size-3.5" />
                        </span>
                      </button>
                    )
                  })}
                  {!filtered.length ? <p className="px-3 py-8 text-center text-xs text-text-muted">No connected Page matches that search.</p> : null}
                </div>
                <p className="border-t border-white/8 px-2 pb-1 pt-2 text-[10px] leading-4 text-text-soft">This choice affects {contextLabel} analytics only. It does not change destinations in Posts, Bulk Scheduler or AI Content Studio.</p>
              </div>
            ) : null}
          </div>

          <button
            aria-label="Refresh analytics for selected Page"
            className="grid min-w-12 place-items-center rounded-xl border border-emerald-300/20 bg-bg/65 text-emerald-300 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300/45 hover:bg-emerald-400/10 hover:shadow-[0_0_26px_rgba(20,184,166,.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan disabled:cursor-wait disabled:opacity-60 motion-reduce:transform-none motion-reduce:transition-none"
            disabled={!selected || isRefreshing}
            onClick={onRefresh}
            type="button"
          >
            <RefreshCw aria-hidden="true" className={`size-4 ${isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          </button>
        </div>
      </div>
    </section>
  )
}
