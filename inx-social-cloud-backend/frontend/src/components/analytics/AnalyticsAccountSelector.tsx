import { Radio, ShieldCheck } from 'lucide-react'
import type { ConnectedIdentity } from '../../lib/connections-api'
import { platformMeta } from '../../data/connectedAccountsData'
import { SocialPlatformIcon } from '../ui/SocialPlatformIcon'

export type AnalyticsAccount = ConnectedIdentity & { analyticsKey: string }

type Props = {
  accounts: AnalyticsAccount[]
  value: string | null
  isLive: boolean
  loading?: boolean
  isPending?: boolean
  needsRepair?: boolean
  onChange: (key: string) => void
}

export function AnalyticsAccountSelector({ accounts, value, isLive, loading = false, isPending = false, needsRepair = false, onChange }: Props) {
  return <section className="analytics-selector relative overflow-hidden rounded-panel border border-border-soft bg-[radial-gradient(circle_at_82%_-40%,rgba(22,196,181,.10),transparent_34%),linear-gradient(145deg,rgba(8,28,39,.92),rgba(4,18,28,.96))] px-3 py-3 shadow-[0_14px_34px_rgba(0,0,0,.18),inset_0_1px_0_rgba(255,255,255,.025)] sm:px-4">
    <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 size-44 rounded-full bg-brand-cyan/[.06] blur-3xl" />
    <div className="relative flex flex-wrap items-center gap-3">
      <span className="relative grid size-9 shrink-0 place-items-center rounded-xl border border-brand-teal/20 bg-brand-teal/10 text-brand-cyan">
        <ShieldCheck className="size-4.5" />
        <span className={`absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-panel ${loading ? 'bg-text-soft' : isLive ? 'animate-pulse bg-brand-green motion-reduce:animate-none' : needsRepair || isPending ? 'bg-brand-amber' : 'animate-pulse bg-brand-amber motion-reduce:animate-none'}`} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">Analytics scope</h2>
          <span className="rounded-full border border-brand-teal/15 bg-brand-teal/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[.12em] text-brand-cyan">1 account at a time</span>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${loading ? 'border-white/10 bg-white/[.03] text-text-muted' : isLive ? 'border-brand-green/15 bg-brand-green/8 text-brand-green' : 'border-brand-amber/20 bg-brand-amber/8 text-brand-amber'}`}>
            <Radio className={`size-3 ${!loading && !isLive && !needsRepair && !isPending ? 'animate-pulse motion-reduce:animate-none' : ''}`} />
            {loading ? 'Preparing' : isLive ? 'Live' : needsRepair ? 'Access refresh needed' : isPending ? 'Metrics pending' : 'Syncing'}
          </span>
        </div>
        <p className="mt-0.5 hidden text-[11px] text-text-muted sm:block">Choose one connected account. Analytics below always belongs to that exact account.</p>
      </div>
      <span className="hidden text-[10px] uppercase tracking-[.16em] text-text-soft lg:block">{accounts.length} connected account{accounts.length === 1 ? '' : 's'}</span>
    </div>

    <div className="scrollbar-thin relative mt-3 flex gap-2 overflow-x-auto border-t border-white/[.055] pt-3 pb-1 sm:flex-wrap sm:overflow-visible" role="radiogroup" aria-label="Choose analytics account">
      {accounts.map(account => {
        const active = value === account.analyticsKey
        return <button
          aria-checked={active}
          className={`group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-2.5 pr-3 text-left transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan ${active ? 'border-brand-cyan/55 bg-brand-cyan/12 text-white shadow-[0_0_22px_rgba(45,212,191,.12)]' : 'border-white/10 bg-white/[.025] text-text-muted hover:border-brand-cyan/25 hover:bg-white/[.04] hover:text-white'}`}
          disabled={loading}
          key={account.analyticsKey}
          onClick={() => onChange(account.analyticsKey)}
          role="radio"
          type="button"
        >
          <span className={`grid size-8 shrink-0 place-items-center rounded-full border ${active ? 'border-brand-cyan/35 bg-bg/75' : 'border-white/10 bg-bg/60'}`}>
            <SocialPlatformIcon className="size-5 rounded-full shadow-none" platform={account.platform} />
          </span>
          <span className="min-w-0">
            <strong className="block max-w-36 truncate text-[11px] font-semibold text-current">{account.displayName}</strong>
            <small className="block max-w-36 truncate text-[9px] text-text-soft">{platformMeta[account.platform].label}{account.username ? ` · ${account.username.startsWith('@') ? account.username : `@${account.username}`}` : ''}</small>
          </span>
          <span className={`ml-1 size-2 rounded-full ${active ? 'bg-brand-cyan shadow-[0_0_9px_rgba(45,212,191,.8)]' : 'bg-white/15'}`} />
        </button>
      })}
      {!accounts.length && <span className="py-2 text-xs text-text-soft">No connected accounts available.</span>}
    </div>
  </section>
}
