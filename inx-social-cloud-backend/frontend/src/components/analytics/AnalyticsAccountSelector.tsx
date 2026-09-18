import { Check, ChevronDown, Layers3, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { customerFacingPlatforms, platformMeta } from '../../data/connectedAccountsData'
import type { ConnectedIdentity } from '../../lib/connections-api'
import type { SocialPlatform } from '../../types/settings'
import { SocialPlatformIcon } from '../ui/SocialPlatformIcon'

export type AnalyticsAccount = ConnectedIdentity & { analyticsKey: string }

type Props = {
  accounts: AnalyticsAccount[]
  values: string[]
  isLive: boolean
  loading?: boolean
  onChange: (keys: string[]) => void
}

const MAX_ANALYTICS_SOURCES = 3

function Avatar({ account }: { account: AnalyticsAccount }) {
  return <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-bg/75 shadow-[0_8px_20px_rgba(0,0,0,.25)]">
    <SocialPlatformIcon className="absolute inset-1 size-7 rounded-lg shadow-none" platform={account.platform} />
    {account.avatarUrl ? <img alt="" className="relative z-10 size-full object-cover" onError={event => { event.currentTarget.style.display = 'none' }} src={account.avatarUrl} /> : null}
  </span>
}

export function AnalyticsAccountSelector({ accounts, values, isLive, loading = false, onChange }: Props) {
  const [platformFilter, setPlatformFilter] = useState<'all' | SocialPlatform>('all')
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selected = useMemo(() => new Set(values), [values])
  const selectedAccounts = accounts.filter(account => selected.has(account.analyticsKey))
  const platformCount = new Set(accounts.map(account => account.platform)).size
  const visibleAccounts = platformFilter === 'all' ? accounts : accounts.filter(account => account.platform === platformFilter)
  const atLimit = selectedAccounts.length >= MAX_ANALYTICS_SOURCES

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  function toggleAccount(key: string) {
    const next = new Set(values)
    if (next.has(key)) {
      if (next.size === 1) return
      next.delete(key)
    } else {
      if (next.size >= MAX_ANALYTICS_SOURCES) return
      next.add(key)
    }
    onChange([...next].slice(0, MAX_ANALYTICS_SOURCES))
    setOpen(false)
  }

  function filter(platform: 'all' | SocialPlatform) {
    setPlatformFilter(platform)
    setOpen(false)
  }

  const selectedLabel = selectedAccounts.length
    ? selectedAccounts.map(account => account.displayName).join(', ')
    : loading ? 'Preparing connected accounts…' : 'Choose an account'

  return <section className="analytics-selector relative rounded-card border border-border-soft bg-[radial-gradient(circle_at_82%_-40%,rgba(22,196,181,.13),transparent_36%),linear-gradient(145deg,rgba(10,32,43,.9),rgba(5,21,31,.94))] p-3 shadow-[0_16px_38px_rgba(0,0,0,.2),inset_0_1px_0_rgba(255,255,255,.03)] sm:p-4">
    <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 size-44 rounded-full bg-brand-cyan/[.06] blur-3xl" />
    <div className="relative flex flex-wrap items-center gap-3">
      <span className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-brand-teal/20 bg-brand-teal/10 text-brand-cyan"><ShieldCheck className="size-5" /><span className={`absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-panel ${loading ? 'bg-text-soft' : isLive ? 'animate-pulse bg-brand-green motion-reduce:animate-none' : 'bg-brand-amber'}`} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold">Analytics sources</h2><span className="rounded-full border border-brand-teal/15 bg-brand-teal/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[.14em] text-brand-cyan">{selectedAccounts.length}/{MAX_ANALYTICS_SOURCES} selected</span><span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${loading ? 'border-white/10 bg-white/[.03] text-text-muted' : 'border-brand-green/15 bg-brand-green/8 text-brand-green'}`}><span className={`size-1.5 rounded-full ${loading ? 'bg-text-soft' : 'animate-pulse bg-brand-green motion-reduce:animate-none'}`} />{loading ? 'Preparing' : 'Live'}</span></div>
        <p className="mt-0.5 text-xs text-text-muted">Select 1–3 accounts for a clearer comparison. Use the platform buttons to filter the account list.</p>
      </div>
      <span className="hidden text-[10px] uppercase tracking-[.16em] text-text-soft lg:block">{accounts.length} account{accounts.length === 1 ? '' : 's'} · {platformCount} platform{platformCount === 1 ? '' : 's'}</span>
    </div>

    <div className="relative mt-3 flex flex-wrap gap-1.5 border-t border-white/[.055] pt-3">
      <button aria-pressed={platformFilter === 'all'} className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-[10px] font-semibold transition ${platformFilter === 'all' ? 'border-brand-cyan/40 bg-brand-cyan/12 text-brand-cyan shadow-[0_0_20px_rgba(34,211,238,.08)]' : 'border-white/10 bg-white/[.025] text-text-muted hover:border-brand-cyan/25 hover:text-white'}`} onClick={() => filter('all')} type="button"><Layers3 className="size-3.5" />All accounts</button>
      {customerFacingPlatforms.map(platform => {
        const platformAccounts = accounts.filter(account => account.platform === platform)
        if (!platformAccounts.length) return null
        const active = platformFilter === platform
        return <button aria-pressed={active} className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold transition ${active ? 'border-brand-teal/35 bg-brand-teal/10 text-white' : 'border-white/10 bg-white/[.025] text-text-muted hover:border-brand-teal/25 hover:text-white'}`} key={platform} onClick={() => filter(platform)} type="button"><SocialPlatformIcon className="size-4 rounded-md shadow-none" platform={platform} />{platformMeta[platform].label}<span className="text-text-soft">{platformAccounts.length}</span></button>
      })}
    </div>

    <div className="relative mt-3" ref={dropdownRef}>
      <button aria-expanded={open} aria-haspopup="listbox" className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-white/[.08] bg-bg/45 px-3 text-left transition duration-200 hover:border-brand-cyan/25 hover:bg-white/[.025] focus-visible:outline-2 focus-visible:outline-brand-cyan disabled:cursor-wait disabled:opacity-80" disabled={loading} onClick={() => setOpen(value => !value)} type="button">
        <span className="min-w-0 flex-1"><span className="block text-[9px] uppercase tracking-[.14em] text-text-soft">Selected accounts</span><strong className="mt-0.5 block truncate text-xs text-text-main">{selectedLabel}</strong></span>
        <span className="rounded-full border border-brand-cyan/20 bg-brand-cyan/8 px-2 py-1 text-[9px] font-semibold text-brand-cyan">{selectedAccounts.length}/{MAX_ANALYTICS_SOURCES}</span>
        <ChevronDown className={`size-4 text-text-soft transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <div aria-hidden={!open} className={`analytics-source-picker-menu absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-border-soft bg-panel shadow-panel transition-[opacity,transform] duration-200 ease-out ${open ? 'pointer-events-auto translate-y-0 scale-[1] opacity-100' : 'pointer-events-none -translate-y-1 scale-[.985] opacity-0'}`} role="listbox">
        <div className="flex items-center justify-between border-b border-border-soft px-3 py-2 text-[9px] text-text-soft">
          <span>{platformFilter === 'all' ? 'Showing all connected accounts' : `Showing ${platformMeta[platformFilter].label} accounts`}</span>
          <span>{atLimit ? 'Maximum 3 selected' : `Choose up to ${MAX_ANALYTICS_SOURCES}`}</span>
        </div>
        <div className="scrollbar-thin max-h-72 overflow-y-auto p-2">
          {visibleAccounts.map(account => {
            const active = selected.has(account.analyticsKey)
            const disabled = !active && atLimit
            return <button aria-selected={active} className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition duration-150 ${active ? 'border-brand-cyan/25 bg-brand-cyan/8' : 'border-transparent hover:border-white/[.07] hover:bg-white/[.025]'} ${disabled ? 'cursor-not-allowed opacity-45' : ''}`} disabled={disabled} key={account.analyticsKey} onClick={() => toggleAccount(account.analyticsKey)} role="option" type="button">
              <Avatar account={account} />
              <span className="min-w-0 flex-1"><strong className="block truncate text-xs text-text-main">{account.displayName}</strong><span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] text-text-muted"><SocialPlatformIcon className="size-3.5 rounded-[4px] shadow-none" platform={account.platform} /><span className="truncate">{platformMeta[account.platform].label}{account.username ? ` · ${account.username.startsWith('@') ? account.username : `@${account.username}`}` : ''}</span></span></span>
              <span className={`grid size-5 shrink-0 place-items-center rounded-full border transition ${active ? 'border-brand-cyan/50 bg-brand-cyan text-[#04222a]' : 'border-white/15 text-transparent'}`}><Check className="size-3" /></span>
            </button>
          })}
          {!visibleAccounts.length && <p className="px-3 py-8 text-center text-xs text-text-soft">No connected accounts for this platform.</p>}
        </div>
      </div>
    </div>
  </section>
}
