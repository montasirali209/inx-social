import { Check, ChevronDown, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { platformMeta } from '../../data/connectedAccountsData'
import type { ConnectedIdentity } from '../../lib/connections-api'

export type AnalyticsAccount = ConnectedIdentity & { analyticsKey: string }

type Props = {
  accounts: AnalyticsAccount[]
  value: string
  isRefreshing: boolean
  onChange: (key: string) => void
  onRefresh: () => void
}

function Avatar({ account, small = false }: { account: AnalyticsAccount; small?: boolean }) {
  const meta = platformMeta[account.platform]
  return <span className={`relative grid ${small ? 'size-9' : 'size-11'} shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-bg/70 text-xs font-black shadow-[0_10px_24px_rgba(0,0,0,.24)]`}>
    {account.avatarUrl ? <img alt="" className="size-full object-cover" src={account.avatarUrl} /> : <span className={`grid size-full place-items-center ${meta.className}`}>{meta.mark}</span>}
  </span>
}

export function AnalyticsAccountSelector({ accounts, value, isRefreshing, onChange, onRefresh }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = accounts.find(account => account.analyticsKey === value) || accounts[0] || null
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return accounts
    return accounts.filter(account => `${account.displayName} ${account.username || ''} ${platformMeta[account.platform].label}`.toLowerCase().includes(term))
  }, [accounts, search])
  const platformCount = new Set(accounts.map(account => account.platform)).size

  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [])

  return <section className="analytics-selector relative z-20 overflow-visible rounded-card border border-emerald-300/15 bg-gradient-to-r from-panel via-panel to-emerald-950/20 p-3 shadow-[0_18px_55px_rgba(0,0,0,.24),0_0_32px_rgba(20,184,166,.05)] sm:p-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-300 shadow-[0_0_24px_rgba(34,197,94,.12)]"><ShieldCheck className="size-5" /><span className="absolute -right-1 -top-1 size-2.5 animate-pulse rounded-full border-2 border-panel bg-emerald-400 motion-reduce:animate-none" /></span>
        <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold">Analytics account</h2><span className="rounded-full border border-teal-300/15 bg-teal-400/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[.14em] text-teal-300">{platformCount} platform{platformCount === 1 ? '' : 's'}</span></div><p className="mt-0.5 text-xs text-text-muted">Choose any connected account. Analytics switches to that platform's verified data source.</p></div>
      </div>
      <div className="flex min-w-0 items-stretch gap-2" ref={rootRef}>
        <div className="relative min-w-0 flex-1 sm:min-w-[360px]">
          <button aria-expanded={open} aria-haspopup="listbox" className="group flex min-h-14 w-full items-center gap-3 rounded-xl border border-emerald-300/20 bg-bg/65 px-3 text-left shadow-inner transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300/45 hover:bg-panel-hover/65 hover:shadow-[0_14px_34px_rgba(0,0,0,.3),0_0_28px_rgba(20,184,166,.1)] focus-visible:outline-2 focus-visible:outline-brand-cyan" disabled={!selected} onClick={() => setOpen(v => !v)} type="button">
            {selected ? <Avatar account={selected} /> : <span className="grid size-11 place-items-center rounded-xl bg-white/5">—</span>}
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{selected?.displayName || 'No connected accounts'}</strong>{selected && <span className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted"><span className={`grid size-4 place-items-center rounded-full text-[9px] font-black ${platformMeta[selected.platform].className}`}>{platformMeta[selected.platform].mark}</span>{platformMeta[selected.platform].label}{selected.username ? <span className="truncate text-text-soft">· {selected.username.startsWith('@') ? selected.username : `@${selected.username}`}</span> : null}</span>}</span>
            <span className="flex items-center gap-2"><span className="hidden rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-300 sm:block">Live source</span><ChevronDown className={`size-4 text-text-muted transition ${open ? 'rotate-180' : ''}`} /></span>
          </button>
          {open && <div className="absolute right-0 top-[calc(100%+.65rem)] z-50 w-full min-w-[min(92vw,440px)] rounded-2xl border border-emerald-300/20 bg-[#061721]/98 p-2 shadow-[0_28px_90px_rgba(0,0,0,.58),0_0_45px_rgba(20,184,166,.12)] backdrop-blur-xl">
            <div className="px-2 pb-2 pt-1"><p className="text-xs font-semibold">Connected analytics sources</p><p className="text-[11px] text-text-soft">{accounts.length} account{accounts.length === 1 ? '' : 's'} across {platformCount} platform{platformCount === 1 ? '' : 's'}</p></div>
            {accounts.length > 5 && <label className="relative mb-2 block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-soft" /><input autoFocus className="min-h-10 w-full rounded-xl border border-white/10 bg-bg/75 pl-9 pr-3 text-sm outline-none focus:border-brand-cyan" onChange={event => setSearch(event.target.value)} placeholder="Search accounts or platforms…" value={search} /></label>}
            <div className="scrollbar-thin max-h-80 space-y-1 overflow-y-auto" role="listbox">{filtered.map(account => { const active = account.analyticsKey === selected?.analyticsKey; return <button aria-selected={active} className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 text-left transition ${active ? 'border-emerald-300/35 bg-emerald-400/10 shadow-[inset_3px_0_0_#2dd4bf]' : 'border-transparent hover:border-white/10 hover:bg-white/[.045]'}`} key={account.analyticsKey} onClick={() => { onChange(account.analyticsKey); setOpen(false); setSearch('') }} role="option" type="button"><Avatar account={account} small /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{account.displayName}</strong><small className="mt-0.5 flex items-center gap-1.5 text-text-muted"><span className={`grid size-3.5 place-items-center rounded-full text-[8px] font-black ${platformMeta[account.platform].className}`}>{platformMeta[account.platform].mark}</span>{platformMeta[account.platform].label}<span className="text-emerald-400">· Connected</span></small></span><span className={`grid size-6 place-items-center rounded-full border ${active ? 'border-emerald-300/40 bg-emerald-400 text-[#032018]' : 'border-white/15 text-transparent'}`}><Check className="size-3.5" /></span></button> })}{!filtered.length && <p className="px-3 py-8 text-center text-xs text-text-muted">No account matches that search.</p>}</div>
            <p className="border-t border-white/8 px-2 pb-1 pt-2 text-[10px] leading-4 text-text-soft">This changes Analytics only. It does not alter publishing destinations elsewhere in INXSocial.</p>
          </div>}
        </div>
        <button aria-label="Refresh analytics for selected account" className="grid min-w-12 place-items-center rounded-xl border border-emerald-300/20 bg-bg/65 text-emerald-300 transition hover:-translate-y-0.5 hover:border-emerald-300/45 hover:bg-emerald-400/10 hover:shadow-[0_0_26px_rgba(20,184,166,.12)]" disabled={!selected || isRefreshing} onClick={onRefresh} type="button"><RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} /></button>
      </div>
    </div>
  </section>
}
