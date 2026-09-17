import { Check, Layers3, ShieldCheck } from 'lucide-react'
import { useMemo } from 'react'
import { customerFacingPlatforms, platformMeta } from '../../data/connectedAccountsData'
import type { ConnectedIdentity } from '../../lib/connections-api'
import type { SocialPlatform } from '../../types/settings'
import { SocialPlatformIcon } from '../ui/SocialPlatformIcon'

export type AnalyticsAccount = ConnectedIdentity & { analyticsKey: string }

type Props = {
  accounts: AnalyticsAccount[]
  values: string[]
  isLive: boolean
  onChange: (keys: string[]) => void
}

function Avatar({ account }: { account: AnalyticsAccount }) {
  return <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-bg/75 shadow-[0_8px_20px_rgba(0,0,0,.25)]">
    {account.avatarUrl ? <img alt="" className="size-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none' }} src={account.avatarUrl} /> : null}
    <SocialPlatformIcon className="absolute inset-1 size-7 rounded-lg shadow-none" platform={account.platform} />
  </span>
}

export function AnalyticsAccountSelector({ accounts, values, isLive, onChange }: Props) {
  const selected = useMemo(() => new Set(values), [values])
  const platformCount = new Set(accounts.map(account => account.platform)).size
  const selectedAccounts = accounts.filter(account => selected.has(account.analyticsKey))
  const allSelected = accounts.length > 0 && selectedAccounts.length === accounts.length

  function setAll() {
    onChange(accounts.map(account => account.analyticsKey))
  }

  function toggleAccount(key: string) {
    const next = new Set(values)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    if (!next.size && accounts.length) next.add(accounts[0].analyticsKey)
    onChange([...next])
  }

  function togglePlatform(platform: SocialPlatform) {
    const platformKeys = accounts.filter(account => account.platform === platform).map(account => account.analyticsKey)
    if (!platformKeys.length) return
    const next = new Set(values)
    const fullySelected = platformKeys.every(key => next.has(key))
    platformKeys.forEach(key => fullySelected ? next.delete(key) : next.add(key))
    if (!next.size && accounts.length) next.add(accounts[0].analyticsKey)
    onChange([...next])
  }

  return <section className="analytics-selector relative overflow-hidden rounded-card border border-border-soft bg-[radial-gradient(circle_at_82%_-40%,rgba(22,196,181,.13),transparent_36%),linear-gradient(145deg,rgba(10,32,43,.9),rgba(5,21,31,.94))] p-3 shadow-[0_16px_38px_rgba(0,0,0,.2),inset_0_1px_0_rgba(255,255,255,.03)] sm:p-4">
    <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 size-44 rounded-full bg-brand-cyan/[.06] blur-3xl" />
    <div className="relative flex flex-wrap items-center gap-3">
      <span className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-brand-teal/20 bg-brand-teal/10 text-brand-cyan"><ShieldCheck className="size-5" /><span className={`absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-panel ${isLive ? 'animate-pulse bg-brand-green motion-reduce:animate-none' : 'bg-brand-amber'}`} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold">Analytics sources</h2><span className="rounded-full border border-brand-teal/15 bg-brand-teal/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[.14em] text-brand-cyan">{selectedAccounts.length}/{accounts.length} selected</span><span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/15 bg-brand-green/8 px-2 py-0.5 text-[10px] font-semibold text-brand-green"><span className="size-1.5 animate-pulse rounded-full bg-brand-green motion-reduce:animate-none" />Live</span></div>
        <p className="mt-0.5 text-xs text-text-muted">Select one account, multiple accounts, a whole platform, or everything. INXSocial combines live metrics from Post for Me.</p>
      </div>
      <span className="hidden text-[10px] uppercase tracking-[.16em] text-text-soft lg:block">{platformCount} platform{platformCount === 1 ? '' : 's'}</span>
    </div>

    <div className="relative mt-3 flex flex-wrap gap-1.5 border-t border-white/[.055] pt-3">
      <button aria-pressed={allSelected} className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-[10px] font-semibold transition ${allSelected ? 'border-brand-cyan/40 bg-brand-cyan/12 text-brand-cyan shadow-[0_0_20px_rgba(34,211,238,.08)]' : 'border-white/10 bg-white/[.025] text-text-muted hover:border-brand-cyan/25 hover:text-white'}`} onClick={setAll} type="button"><Layers3 className="size-3.5" />All accounts</button>
      {customerFacingPlatforms.map(platform => {
        const platformAccounts = accounts.filter(account => account.platform === platform)
        if (!platformAccounts.length) return null
        const active = platformAccounts.every(account => selected.has(account.analyticsKey))
        return <button aria-pressed={active} className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold transition ${active ? 'border-brand-teal/35 bg-brand-teal/10 text-white' : 'border-white/10 bg-white/[.025] text-text-muted hover:border-brand-teal/25 hover:text-white'}`} key={platform} onClick={() => togglePlatform(platform)} type="button"><SocialPlatformIcon className="size-4 rounded-md shadow-none" platform={platform} />{platformMeta[platform].label}<span className="text-text-soft">{platformAccounts.length}</span></button>
      })}
    </div>

    <div className="scrollbar-thin relative mt-3 flex gap-2 overflow-x-auto pb-1">
      {accounts.map(account => {
        const active = selected.has(account.analyticsKey)
        return <button aria-pressed={active} className={`group relative flex min-h-[62px] min-w-[205px] max-w-[260px] items-center gap-2.5 overflow-hidden rounded-xl border px-2.5 text-left transition duration-200 ${active ? 'border-brand-cyan/30 bg-[linear-gradient(135deg,rgba(20,184,166,.13),rgba(29,78,216,.08))] shadow-[0_10px_26px_rgba(0,0,0,.2),inset_0_1px_rgba(255,255,255,.035)]' : 'border-white/[.07] bg-bg/45 hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[.035] motion-reduce:transform-none'}`} key={account.analyticsKey} onClick={() => toggleAccount(account.analyticsKey)} type="button">
          <span aria-hidden="true" className={`absolute inset-x-5 -bottom-px h-px bg-gradient-to-r from-transparent via-brand-cyan/80 to-transparent transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`} />
          <Avatar account={account} />
          <span className="min-w-0 flex-1"><strong className="block truncate text-xs text-text-main">{account.displayName}</strong><span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] text-text-muted"><SocialPlatformIcon className="size-3.5 rounded-[4px] shadow-none" platform={account.platform} /><span className="truncate">{platformMeta[account.platform].label}{account.username ? ` · ${account.username.startsWith('@') ? account.username : `@${account.username}`}` : ''}</span></span></span>
          <span className={`grid size-5 shrink-0 place-items-center rounded-full border transition ${active ? 'border-brand-cyan/50 bg-brand-cyan text-[#04222a]' : 'border-white/15 text-transparent'}`}><Check className="size-3" /></span>
        </button>
      })}
    </div>
  </section>
}
