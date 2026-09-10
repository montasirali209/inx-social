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
  return <span className={`relative grid ${small ? 'size-9' : 'size-11'} shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-bg/70 text-xs font-black shadow-[0_8px_20px_rgba(0,0,0,.2)]`}>
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

  return <section className="analytics-selector relative z-20 overflow-visible rounded-card border border-border-soft bg-[linear-gradient(145deg,rgba(10,32,43,.88),rgba(5,21,31,.92))] p-3 shadow-[0_16px_38px_rgba(0,0,0,.2),inset_0_1px_0_rgba(255,255,255,.025)] sm:p-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-brand-teal/20 bg-brand-teal/10 text-brand-cyan"><ShieldCheck className="size-5" /><span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-panel bg-brand-green" /></span>
        <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold">Analytics account</h2><span className="rounded-full border border-brand-teal/15 bg-brand-teal/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[.14em] text-brand-cyan">{platformCount} platform{platformCount === 1 ? '' : 's'}</span></div><p className="mt-0.5 text-xs text-text-muted">Choose any connected account. Analytics switches to that platform's verified data source.</p></div>
      </div>
      <div className="flex min-w-0 items-stretch gap-2" ref={rootRef}>
        <div className="relative min-w-0 flex-1 sm:min-w-[360px]">
          <button aria-expanded={open} aria-haspopup="listbox" className="group flex min-h-14 w-full items-center gap-3 rounded-xl border border-border-soft bg-bg/65 px-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.02)] transition-[transform,border-color,background-color,box-shadow] duration-150 hover:scale-[1.006] hover:border-brand-teal/30 hover:bg-panel-hover/65 hover:shadow-[0_10px_24px_rgba(0,0,0,.2),inset_0_1px_0_rgba(255,255,255,.025)] focus-visible:outline-2 focus-visible:outline-brand-cyan disabled:hover:scale-100 motion-reduce:transform-none" disabled={!selected} onClick={() => setOpen(v => !v)} type="button">
            {selected ? <Avatar account={selected} /> : <span className="grid size-11 place-items-center rounded-xl bg-white/5">—</span>}
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{selected?.displayName || 'No connected accounts'}</strong>{selected && <span className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted"><span className={`grid size-4 place-items-center rounded-full text-[9px] font-black ${platformMeta[selected.platform].className}`}>{platformMeta[selected.platform].mark}</span>{platformMeta[selected.platform].label}{selected.username ? <span className="truncate text-text-soft">· {selected.username.startsWith('@') ? selected.username : `@${selected.username}`}</span> : null}</span>}</span>
            <span className="flex items-center gap-2"><span className="hidden rounded-full border border-brand-teal/12 bg-brand-teal/8 px-2 py-1 text-[10px] font-semibold text-brand-cyan sm:block">Live source</span><ChevronDown className={`size-4 text-text-muted transition ${open ? 'rotate-180' : ''}`} /></span>
          </button>
          {open && <div className="absolute right-0 top-[calc(100%+.65rem)] z-50 w-full min-w-[min(92vw,440px)] rounded-2xl border border-border-soft bg-[#061721]/98 p-2 shadow-[0_24px_70px_rgba(0,0,0,.52)] backdrop-blur-xl">
            <div className="px-2 pb-2 pt-1"><p className="text-xs font-semibold">Connected analytics sources</p><p className="text-[11px] text-text-soft">{accounts.length} account{accounts.length === 1 ? '' : 's'} across {platformCount} platform{platformCount === 1 ? '' : 's'}</p></div>
            {accounts.length > 5 && <label className="relative mb-2 block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-soft" /><input autoFocus className="min-h-10 w-full rounded-xl border border-white/10 bg-bg/75 pl-9 pr-3 text-sm outline-none focus:border-brand-cyan" onChange={event => setSearch(event.target.value)} placeholder="Search accounts or platforms…" value={search} /></label>}
            <div className="scrollbar-thin max-h-80 space-y-1 overflow-y-auto" role="listbox">{filtered.map(account => { const active = account.analyticsKey === selected?.analyticsKey; return <button aria-selected={active} className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 text-left transition-[transform,border-color,background-color] duration-150 ${active ? 'border-brand-teal/30 bg-brand-teal/10 shadow-[inset_3px_0_0_#14b8a6]' : 'border-transparent hover:scale-[1.004] hover:border-white/10 hover:bg-white/[.045]'}`} key={account.analyticsKey} onClick={() => { onChange(account.analyticsKey); setOpen(false); setSearch('') }} role="option" type="button"><Avatar account={account} small /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{account.displayName}</strong><small className="mt-0.5 flex items-center gap-1.5 text-text-muted"><span className={`grid size-3.5 place-items-center rounded-full text-[8px] font-black ${platformMeta[account.platform].className}`}>{platformMeta[account.platform].mark}</span>{platformMeta[account.platform].label}<span className="text-brand-green">· Connected</span></small></span><span className={`grid size-6 place-items-center rounded-full border ${active ? 'border-brand-teal/35 bg-brand-teal text-[#032018]' : 'border-white/15 text-transparent'}`}><Check className="size-3.5" /></span></button> })}{!filtered.length && <p className="px-3 py-8 text-center text-xs text-text-muted">No account matches that search.</p>}</div>
            <p className="border-t border-white/8 px-2 pb-1 pt-2 text-[10px] leading-4 text-text-soft">This changes Analytics only. It does not alter publishing destinations elsewhere in INXSocial.</p>
          </div>}
        </div>
        <button aria-label="Refresh analytics for selected account" className="grid min-w-12 place-items-center rounded-xl border border-border-soft bg-bg/65 text-brand-cyan shadow-[inset_0_1px_0_rgba(255,255,255,.02)] transition-[transform,border-color,background-color,box-shadow] duration-150 hover:scale-[1.035] hover:border-brand-teal/30 hover:bg-brand-teal/8 hover:shadow-[0_8px_20px_rgba(0,0,0,.2)] disabled:hover:scale-100 motion-reduce:transform-none" disabled={!selected || isRefreshing} onClick={onRefresh} type="button"><RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} /></button>
      </div>
    </div>
  </section>
}
