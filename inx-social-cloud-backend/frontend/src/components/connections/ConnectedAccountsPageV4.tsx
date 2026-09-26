import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  Eye,
  Grid2X2,
  Link2,
  List,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { customerFacingPlatforms, platformMeta, type Platform } from '../../data/connectedAccountsData'
import { relativeSyncTime } from '../../data/settingsData'
import {
  connectPostForMePlatform,
  disconnectSocialConnection,
  fetchConnectionsWorkspace,
  flattenConnectedIdentities,
  syncPostForMeConnections,
  type ConnectedIdentity,
} from '../../lib/connections-api'
import { fetchDashboardJobs } from '../../lib/dashboard-api'
import { useUiStore } from '../../store/ui-store'
import { Button } from '../ui/Button'
import { SocialPlatformIcon, type SocialPlatformName } from '../ui/SocialPlatformIcon'

type UiPlatform = Exclude<Platform, 'google_business'>
type ConnectionStatus =
  | 'connected'
  | 'syncing'
  | 'expiring_soon'
  | 'permission_issue'
  | 'reconnect_required'
  | 'not_connected'

type ViewMode = 'grid' | 'list'
type ToastState = { tone: 'success' | 'error' | 'info'; message: string } | null

type AccountModel = {
  id: string
  connectionId: string | null
  platform: UiPlatform
  platformLabel: string
  accountName: string
  handle?: string
  accountType: string
  followers?: number
  subscribers?: number
  avatarUrl?: string | null
  status: ConnectionStatus
  lastSyncAt?: string | null
  connectedAt?: string | null
  publishingEnabled: boolean
  schedulerEnabled: boolean
  analyticsEnabled: boolean
  tokenStatus: string
  permissions: string[]
  detail: string
  identity?: ConnectedIdentity
}

type ActivityItem = {
  id: string
  platform: UiPlatform
  accountName?: string
  message: string
  createdAt: string
  status: 'success' | 'warning' | 'error' | 'info'
}

const allUiPlatforms: UiPlatform[] = [...customerFacingPlatforms]
const connectTiles: UiPlatform[] = [...allUiPlatforms]

function isGatewayPlatform(platform: UiPlatform): platform is UiPlatform {
  return allUiPlatforms.includes(platform)
}

function metaFor(platform: UiPlatform) {
  return platformMeta[platform]
}

function labelFor(platform: UiPlatform) {
  return metaFor(platform).label
}

function platformHome(platform: UiPlatform) {
  const urls: Record<UiPlatform, string> = {
    facebook: 'https://www.facebook.com/',
    instagram: 'https://www.instagram.com/',
    linkedin: 'https://www.linkedin.com/',
    tiktok: 'https://www.tiktok.com/',
    youtube: 'https://www.youtube.com/',
    x: 'https://x.com/',
    pinterest: 'https://www.pinterest.com/',
    threads: 'https://www.threads.net/',
    bluesky: 'https://bsky.app/',
  }
  return urls[platform]
}

function platformIconName(platform: UiPlatform): SocialPlatformName {
  return platform as SocialPlatformName
}

function readNumber(metadata: Record<string, unknown> | undefined, keys: string[]) {
  if (!metadata) return undefined
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  }
  return undefined
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function metricLabel(account: AccountModel) {
  if (typeof account.subscribers === 'number') return `${formatCount(account.subscribers)} subscribers`
  if (typeof account.followers === 'number') return `${formatCount(account.followers)} followers`
  return account.accountType
}

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`
  return value.toLocaleString('en-GB')
}

function statusFrom(identity: ConnectedIdentity, rawConnectionStatus?: string | null, lastError?: string | null): ConnectionStatus {
  const status = String(rawConnectionStatus || '').toLowerCase()
  const error = String(lastError || '').toLowerCase()
  if (status.includes('sync')) return 'syncing'
  if (error.includes('expire') || error.includes('token')) return 'reconnect_required'
  if (error.includes('permission') || error.includes('scope')) return 'permission_issue'
  if (identity.status === 'attention') return 'reconnect_required'
  return 'connected'
}

function toAccountModel(identity: ConnectedIdentity, workspace: Awaited<ReturnType<typeof fetchConnectionsWorkspace>>): AccountModel {
  const connection = identity.connectionId ? workspace.connections.find((item) => item.id === identity.connectionId) : undefined
  const profile = connection?.profiles.find((item) => item.id === identity.id)
  const metadata = profile?.metadata
  const followers = readNumber(metadata, ['followers', 'followersCount', 'followerCount', 'followers_count', 'fanCount'])
  const subscribers = identity.platform === 'youtube'
    ? readNumber(metadata, ['subscribers', 'subscriberCount', 'subscribersCount', 'subscriber_count'])
    : undefined
  const capabilities = profile?.capabilities || {}
  const status = statusFrom(identity, connection?.status, connection?.lastError)
  const accountType = profile?.profileType ? titleCase(profile.profileType) : identity.platform === 'youtube' ? 'Channel' : 'Profile'
  const publishingEnabled = capabilities.publishing ?? capabilities.publish ?? true
  const analyticsEnabled = capabilities.analytics ?? capabilities.insights ?? ['facebook', 'instagram', 'youtube', 'linkedin', 'pinterest', 'tiktok', 'x'].includes(identity.platform)
  const schedulerEnabled = capabilities.scheduler ?? publishingEnabled
  const permissions = [
    publishingEnabled ? 'Publishing' : null,
    schedulerEnabled ? 'Scheduling' : null,
    analyticsEnabled ? 'Analytics / insights' : null,
  ].filter((value): value is string => Boolean(value))

  return {
    id: identity.id,
    connectionId: identity.connectionId,
    platform: identity.platform,
    platformLabel: labelFor(identity.platform),
    accountName: identity.displayName,
    handle: identity.username || undefined,
    accountType,
    followers,
    subscribers,
    avatarUrl: identity.avatarUrl,
    status,
    lastSyncAt: identity.lastSyncedAt,
    connectedAt: identity.connectedAt,
    publishingEnabled,
    schedulerEnabled,
    analyticsEnabled,
    tokenStatus: status === 'connected' ? 'Healthy' : status === 'syncing' ? 'Refreshing' : 'Needs attention',
    permissions,
    detail: identity.detail,
    identity,
  }
}

function Modal({ title, subtitle, onClose, children, maxWidth = 'max-w-xl' }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; maxWidth?: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label={title}>
      <section className={`max-h-[calc(100dvh-1.5rem)] w-full ${maxWidth} overflow-y-auto rounded-2xl border border-border-soft bg-[#061622] p-4 shadow-[0_28px_90px_rgba(0,0,0,.55)] sm:p-5`}>
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em]">{title}</h2>
            {subtitle && <p className="mt-1 text-xs leading-5 text-text-muted">{subtitle}</p>}
          </div>
          <button aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-xl border border-transparent text-text-muted transition hover:border-border-soft hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={onClose} type="button"><X className="size-4" /></button>
        </header>
        {children}
      </section>
    </div>
  )
}

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return (
    <div className={`fixed inset-0 z-50 flex items-end justify-end transition-[background-color,backdrop-filter] duration-300 sm:items-stretch ${entered ? 'bg-black/62 backdrop-blur-[5px]' : 'bg-black/0 backdrop-blur-0'}`} role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close drawer" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <section className={`relative z-10 max-h-[90dvh] w-full overflow-y-auto rounded-t-[1.65rem] border border-brand-teal/18 bg-[linear-gradient(155deg,rgba(7,28,40,.985),rgba(4,17,29,.995))] shadow-[-38px_0_100px_rgba(0,0,0,.5),-1px_0_30px_rgba(20,184,166,.06)] transition-[transform,opacity] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] sm:max-h-none sm:max-w-[32rem] sm:rounded-none sm:border-y-0 sm:border-r-0 ${entered ? 'translate-y-0 opacity-100 sm:translate-x-0' : 'translate-y-full opacity-70 sm:translate-x-full sm:translate-y-0'}`}>
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-brand-teal/12 bg-[#061622]/88 p-5 backdrop-blur-2xl">
          <div>
            <span className="text-[9px] font-semibold uppercase tracking-[.18em] text-brand-teal">Connected account</span>
            <h2 className="mt-1 text-base font-semibold">{title}</h2>
          </div>
          <button aria-label="Close" className="grid size-9 place-items-center rounded-xl border border-transparent text-text-muted transition duration-200 hover:rotate-3 hover:border-brand-teal/20 hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={onClose} type="button"><X className="size-4" /></button>
        </header>
        {children}
      </section>
    </div>
  )
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(onClose, toast.tone === 'error' ? 6500 : 3500)
    return () => window.clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null
  const tone = toast.tone === 'success'
    ? 'border-brand-green/35 bg-[#06261f] text-emerald-50'
    : toast.tone === 'error'
      ? 'border-brand-red/35 bg-[#2a1015] text-rose-50'
      : 'border-brand-cyan/35 bg-[#062330] text-cyan-50'
  return (
    <div className={`fixed bottom-3 left-3 right-3 z-[70] flex max-w-none items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm ${tone}`} role="status">
      {toast.tone === 'success' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-green" /> : toast.tone === 'error' ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-brand-red" /> : <Activity className="mt-0.5 size-4 shrink-0 text-brand-cyan" />}
      <span className="leading-5">{toast.message}</span>
      <button aria-label="Dismiss notification" className="ml-auto text-current/60 hover:text-current" onClick={onClose} type="button"><X className="size-4" /></button>
    </div>
  )
}

function PlatformIcon({ platform, size = 'md', className = '' }: { platform: UiPlatform; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: '!size-8', md: '!size-10', lg: '!size-12' }
  return <SocialPlatformIcon className={`${sizes[size]} ${className}`} platform={platformIconName(platform)} />
}

function AccountStatusBadge({ status }: { status: ConnectionStatus }) {
  const labels: Record<ConnectionStatus, string> = {
    connected: 'Connected',
    syncing: 'Syncing',
    expiring_soon: 'Expiring Soon',
    permission_issue: 'Permission Issue',
    reconnect_required: 'Reconnect Required',
    not_connected: 'Not Connected',
  }
  const styles: Record<ConnectionStatus, string> = {
    connected: 'border-brand-green/25 bg-brand-green/10 text-emerald-300',
    syncing: 'border-brand-cyan/25 bg-brand-cyan/10 text-cyan-300',
    expiring_soon: 'border-brand-amber/25 bg-brand-amber/10 text-amber-300',
    permission_issue: 'border-brand-amber/25 bg-brand-amber/10 text-amber-300',
    reconnect_required: 'border-brand-red/25 bg-brand-red/10 text-rose-300',
    not_connected: 'border-white/8 bg-white/[.035] text-text-soft',
  }
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${styles[status]}`}><span className="size-1.5 rounded-full bg-current" />{labels[status]}</span>
}

type TrendTone = 'positive' | 'negative' | 'neutral'

function DataSparkline({ values, tone = 'neutral' }: { values: number[]; tone?: TrendTone }) {
  const safe = values.length ? values : [0, 0]
  const min = Math.min(...safe)
  const max = Math.max(...safe)
  const span = Math.max(1, max - min)
  const points = safe.map((value, index) => {
    const x = safe.length === 1 ? 40 : 3 + (index / (safe.length - 1)) * 74
    const y = 34 - ((value - min) / span) * 27
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const stroke = tone === 'negative' ? '#f59e0b' : tone === 'positive' ? '#2dd4bf' : '#64748b'
  return (
    <svg aria-hidden="true" className="h-8 w-[4.6rem] overflow-visible" viewBox="0 0 80 40">
      <polyline fill="none" points={points} stroke={stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      {safe.map((value, index) => {
        const [x, y] = points.split(' ')[index].split(',')
        return <circle cx={x} cy={y} fill={stroke} key={`${index}:${value}`} opacity={index === safe.length - 1 ? 1 : .42} r={index === safe.length - 1 ? 2.4 : 1.25} />
      })}
    </svg>
  )
}

function ActivityBars({ active, total }: { active: number; total: number }) {
  const count = Math.max(1, total)
  return (
    <div aria-label={`${active} of ${total} platforms active`} className="flex h-8 items-end gap-1" role="img">
      {Array.from({ length: count }, (_, index) => {
        const enabled = index < active
        return <span className={`w-1.5 rounded-full transition-all duration-300 ${enabled ? 'bg-gradient-to-t from-brand-teal/45 to-brand-cyan shadow-[0_0_10px_rgba(34,211,238,.12)]' : 'bg-white/8'}`} key={index} style={{ height: `${enabled ? 36 + ((index * 13) % 52) : 20}%` }} />
      })}
    </div>
  )
}

function HealthRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div aria-label={`${clamped}% connection health`} className="relative size-10 rounded-full p-[4px]" role="img" style={{ background: `conic-gradient(#2dd4bf 0 ${clamped}%, rgba(148,163,184,.12) ${clamped}% 100%)` }}>
      <div className="size-full rounded-full bg-[#091b28] shadow-[inset_0_0_12px_rgba(0,0,0,.35)]" />
    </div>
  )
}

function StatCard({ icon, title, value, supporting, tone = 'neutral', visual }: { icon: ReactNode; title: string; value: string; supporting: string; tone?: TrendTone; visual: ReactNode }) {
  const supportTone = tone === 'positive' ? 'text-emerald-300' : tone === 'negative' ? 'text-amber-300' : 'text-text-muted'
  return (
    <article className="group relative min-w-0 overflow-hidden rounded-xl border border-border-soft bg-[linear-gradient(145deg,rgba(9,27,41,.88),rgba(4,16,27,.95))] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_10px_28px_rgba(0,0,0,.11)] transition-[transform,border-color,box-shadow,background-color] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-1 hover:scale-[1.008] hover:border-brand-teal/30 hover:shadow-[0_18px_38px_rgba(0,0,0,.18),0_0_28px_rgba(20,184,166,.04),inset_0_1px_0_rgba(255,255,255,.035)] focus-within:border-brand-cyan/45 sm:min-w-0">
      <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 size-24 rounded-full bg-brand-teal/[.035] blur-xl transition duration-500 group-hover:scale-125 group-hover:bg-brand-teal/[.07]" />
      <div className="relative flex items-start justify-between gap-3">
        <span className="grid size-8 place-items-center rounded-lg border border-brand-cyan/18 bg-gradient-to-br from-brand-cyan/10 to-brand-teal/4 text-brand-cyan transition duration-300 group-hover:-rotate-3 group-hover:scale-105 group-hover:border-brand-teal/32 group-hover:shadow-[0_0_20px_rgba(20,184,166,.08)]">{icon}</span>
        <div className="transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">{visual}</div>
      </div>
      <div className="relative mt-2.5">
        <p className="text-[10px] font-medium text-text-muted">{title}</p>
        <strong className="mt-0.5 block text-xl font-semibold tracking-[-0.035em] text-white">{value}</strong>
        <p className={`mt-1 text-[10px] font-medium ${supportTone}`}>{supporting}</p>
      </div>
    </article>
  )
}

function ConnectedAccountsHeader() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border-soft bg-[linear-gradient(110deg,rgba(5,15,29,.96),rgba(6,24,36,.9))] px-5 py-4 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-36 size-80 rounded-full border border-brand-teal/10 bg-[radial-gradient(circle_at_35%_65%,rgba(20,184,166,.16),rgba(5,15,29,.03)_52%,transparent_68%)] shadow-[inset_0_0_70px_rgba(34,211,238,.05)]" />
      <div aria-hidden="true" className="pointer-events-none absolute right-16 top-5 size-1 rounded-full bg-brand-cyan/60 shadow-[0_0_12px_#22d3ee]" />
      <div className="relative">
        <h1 className="text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">Connected Accounts</h1>
        <p className="mt-1 text-sm text-text-muted">Manage all your connected social destinations in one place.</p>
      </div>
    </section>
  )
}

function ConnectedAccountsStats({ total, addedThisMonth, activePlatforms, platformTotal, postsThisWeek, postsPreviousWeek, postSeries, accountSeries, health }: { total: number; addedThisMonth: number; activePlatforms: number; platformTotal: number; postsThisWeek: number; postsPreviousWeek: number; postSeries: number[]; accountSeries: number[]; health: number }) {
  const postDelta = postsThisWeek - postsPreviousWeek
  const postTone: TrendTone = postDelta > 0 ? 'positive' : postDelta < 0 ? 'negative' : 'neutral'
  const postText = postsThisWeek === 0 && postsPreviousWeek === 0
    ? 'No posts published this week'
    : postDelta === 0
      ? 'No change from last week'
      : postsPreviousWeek === 0
        ? `${postsThisWeek} published this week`
        : `${postDelta > 0 ? '+' : ''}${Math.round((postDelta / postsPreviousWeek) * 100)}% from last week`
  const accountTone: TrendTone = addedThisMonth > 0 ? 'positive' : 'neutral'
  const healthTone: TrendTone = health === 100 ? 'positive' : health >= 80 ? 'neutral' : 'negative'
  const healthText = total ? (health === 100 ? 'All connections healthy' : `${health}% of connections healthy`) : 'Connect your first account'

  return (
    <section className="grid grid-cols-2 gap-2 pb-1 xl:grid-cols-4">
      <StatCard icon={<UsersRound className="size-4" />} supporting={addedThisMonth ? `+${addedThisMonth} this month` : 'No change this month'} title="Total Connected Accounts" tone={accountTone} value={String(total)} visual={<DataSparkline tone={accountTone} values={accountSeries} />} />
      <StatCard icon={<Sparkles className="size-4" />} supporting={activePlatforms ? `${activePlatforms} active platform${activePlatforms === 1 ? '' : 's'}` : 'Connect a platform to begin'} title="Active Platforms" tone={activePlatforms ? 'positive' : 'neutral'} value={`${activePlatforms} / ${platformTotal}`} visual={<ActivityBars active={activePlatforms} total={platformTotal} />} />
      <StatCard icon={<BarChart3 className="size-4" />} supporting={postText} title="Posts This Week" tone={postTone} value={String(postsThisWeek)} visual={<DataSparkline tone={postTone} values={postSeries} />} />
      <StatCard icon={<ShieldCheck className="size-4" />} supporting={healthText} title="Connection Health" tone={healthTone} value={`${health}%`} visual={<HealthRing value={health} />} />
    </section>
  )
}

function PlatformFilter({ value, onChange }: { value: 'all' | UiPlatform; onChange: (value: 'all' | UiPlatform) => void }) {
  return (
    <label className="relative">
      <span className="sr-only">Filter by platform</span>
      <select className="min-h-10 appearance-none rounded-xl border border-border-soft bg-bg/45 pl-3 pr-9 text-xs text-text-main outline-none transition hover:border-brand-cyan/30 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/10" onChange={(event) => onChange(event.target.value as 'all' | UiPlatform)} value={value}>
        <option value="all">All Platforms</option>
        {allUiPlatforms.map((platform) => <option key={platform} value={platform}>{labelFor(platform)}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-text-soft" />
    </label>
  )
}

function StatusFilter({ value, onChange }: { value: 'all' | ConnectionStatus; onChange: (value: 'all' | ConnectionStatus) => void }) {
  const options: Array<[ConnectionStatus, string]> = [
    ['connected', 'Connected'],
    ['syncing', 'Syncing'],
    ['expiring_soon', 'Expiring Soon'],
    ['permission_issue', 'Permission Issue'],
    ['reconnect_required', 'Reconnect Required'],
    ['not_connected', 'Not Connected'],
  ]
  return (
    <label className="relative">
      <span className="sr-only">Filter by status</span>
      <select className="min-h-10 appearance-none rounded-xl border border-border-soft bg-bg/45 pl-3 pr-9 text-xs text-text-main outline-none transition hover:border-brand-cyan/30 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/10" onChange={(event) => onChange(event.target.value as 'all' | ConnectionStatus)} value={value}>
        <option value="all">All Statuses</option>
        {options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-text-soft" />
    </label>
  )
}

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  return (
    <div className="flex rounded-xl border border-border-soft bg-bg/40 p-1" role="group" aria-label="Account view">
      <button aria-pressed={value === 'grid'} className={`grid size-8 place-items-center rounded-lg transition focus-visible:outline-2 focus-visible:outline-brand-cyan ${value === 'grid' ? 'bg-brand-teal/15 text-brand-cyan' : 'text-text-muted hover:text-white'}`} onClick={() => onChange('grid')} type="button"><Grid2X2 className="size-4" /></button>
      <button aria-pressed={value === 'list'} className={`grid size-8 place-items-center rounded-lg transition focus-visible:outline-2 focus-visible:outline-brand-cyan ${value === 'list' ? 'bg-brand-teal/15 text-brand-cyan' : 'text-text-muted hover:text-white'}`} onClick={() => onChange('list')} type="button"><List className="size-4" /></button>
    </div>
  )
}

function RefreshConnectionButton({ refreshing, disabled, onRefresh }: { refreshing: boolean; disabled?: boolean; onRefresh: () => void }) {
  return (
    <Button aria-label={refreshing ? 'Refreshing connection' : 'Refresh connection'} disabled={refreshing || disabled} onClick={onRefresh} size="sm" variant="secondary">
      {refreshing ? <LoaderCircle className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
      <span className="hidden sm:inline">{refreshing ? 'Refreshing' : 'Refresh'}</span>
    </Button>
  )
}

function ConnectionActionsMenu({ account, onView, onRefresh, onReconnect, onPermissions, onDisconnect }: { account: AccountModel; onView: () => void; onRefresh: () => void; onReconnect: () => void; onPermissions: () => void; onDisconnect: () => void }) {
  const connected = account.status !== 'not_connected'
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const trigger = triggerRef.current
      const menu = menuRef.current
      if (!trigger || !menu) return
      const triggerRect = trigger.getBoundingClientRect()
      const menuRect = menu.getBoundingClientRect()
      const gutter = 8
      const left = Math.min(
        window.innerWidth - menuRect.width - gutter,
        Math.max(gutter, triggerRect.right - menuRect.width),
      )
      const roomBelow = window.innerHeight - triggerRect.bottom
      const top = roomBelow >= menuRect.height + gutter
        ? triggerRect.bottom + gutter
        : Math.max(gutter, triggerRect.top - menuRect.height - gutter)
      setPosition({ top, left })
    }

    const frame = window.requestAnimationFrame(updatePosition)
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  const closeAnd = (action: () => void) => {
    setOpen(false)
    action()
  }

  return <>
    <button
      aria-expanded={open}
      aria-haspopup="menu"
      aria-label={`More actions for ${account.accountName}`}
      className="grid size-9 place-items-center rounded-lg border border-border-soft bg-bg/35 text-text-muted transition hover:border-brand-cyan/30 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan"
      onClick={() => {
        setPosition(null)
        setOpen((value) => !value)
      }}
      ref={triggerRef}
      type="button"
    >
      <MoreHorizontal className="size-4" />
    </button>
    {open && createPortal(
      <div
        className="fixed z-[500] w-52 rounded-xl border border-border-soft bg-[#071925] p-1.5 text-xs shadow-[0_24px_70px_rgba(0,0,0,.62)]"
        ref={menuRef}
        role="menu"
        style={{
          left: position?.left ?? 0,
          top: position?.top ?? 0,
          visibility: position ? 'visible' : 'hidden',
        }}
      >
        <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-text-muted hover:bg-white/5 hover:text-white" onClick={() => closeAnd(onView)} role="menuitem" type="button"><Eye className="size-3.5" />View account</button>
        {connected && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-text-muted hover:bg-white/5 hover:text-white" onClick={() => closeAnd(onRefresh)} role="menuitem" type="button"><RefreshCw className="size-3.5" />Sync now</button>}
        {connected && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-text-muted hover:bg-white/5 hover:text-white" onClick={() => closeAnd(onReconnect)} role="menuitem" type="button"><Link2 className="size-3.5" />Reconnect</button>}
        {connected && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-text-muted hover:bg-white/5 hover:text-white" onClick={() => closeAnd(onPermissions)} role="menuitem" type="button"><ShieldCheck className="size-3.5" />View permissions</button>}
        <a className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-text-muted hover:bg-white/5 hover:text-white" href={platformHome(account.platform)} onClick={() => setOpen(false)} rel="noreferrer" role="menuitem" target="_blank"><ExternalLink className="size-3.5" />Open on platform</a>
        {connected && <><div className="my-1 border-t border-border-soft" /><button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-rose-300 hover:bg-brand-red/10 hover:text-rose-200" onClick={() => closeAnd(onDisconnect)} role="menuitem" type="button"><Trash2 className="size-3.5" />Disconnect</button></>}
      </div>,
      document.body,
    )}
  </>
}

function PlatformCard({ account, refreshing, onView, onRefresh, onReconnect, onDisconnect, onConnect }: { account: AccountModel; refreshing: boolean; onView: () => void; onRefresh: () => void; onReconnect: () => void; onDisconnect: () => void; onConnect: () => void }) {
  const connected = account.status !== 'not_connected'
  return (
    <article className="group relative z-0 min-h-[132px] overflow-visible rounded-xl border border-border-soft bg-[linear-gradient(150deg,rgba(12,32,47,.84),rgba(5,15,29,.95))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.018)] transition-[transform,border-color,box-shadow,background-color] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-1 hover:scale-[1.006] hover:border-brand-teal/30 hover:bg-panel-hover/38 hover:shadow-[0_14px_30px_rgba(0,0,0,.16),0_0_24px_rgba(20,184,166,.035)] focus-within:z-[70] focus-within:border-brand-cyan/40">
      <div className="flex items-start gap-3">
        <PlatformIcon platform={account.platform} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <strong className="block truncate text-sm text-white">{account.platformLabel}</strong>
              <p className="mt-0.5 truncate text-xs text-text-main">{account.accountName}</p>
            </div>
            <AccountStatusBadge status={account.status} />
          </div>
          <p className="mt-1 truncate text-[11px] text-text-muted">{account.handle || metricLabel(account)}</p>
          {account.handle && <p className="mt-0.5 truncate text-[10px] text-text-soft">{metricLabel(account)}</p>}
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        {connected ? <>
          <Button className="min-w-0 flex-1" onClick={onView} size="sm" variant="secondary"><Eye className="size-3.5" />View</Button>
          <RefreshConnectionButton onRefresh={onRefresh} refreshing={refreshing} />
          <ConnectionActionsMenu account={account} onDisconnect={onDisconnect} onPermissions={onView} onReconnect={onReconnect} onRefresh={onRefresh} onView={onView} />
        </> : <Button className="w-full" disabled={!isGatewayPlatform(account.platform)} onClick={onConnect} size="sm" variant="secondary"><Plus className="size-3.5" />{isGatewayPlatform(account.platform) ? 'Connect Account' : 'Not available yet'}</Button>}
      </div>
    </article>
  )
}

function PlatformListRow({ account, refreshing, onView, onRefresh, onReconnect, onDisconnect, onConnect }: { account: AccountModel; refreshing: boolean; onView: () => void; onRefresh: () => void; onReconnect: () => void; onDisconnect: () => void; onConnect: () => void }) {
  const connected = account.status !== 'not_connected'
  return (
    <article className="relative z-0 grid gap-3 border-b border-border-soft px-4 py-3 last:border-b-0 hover:bg-white/[.015] focus-within:z-[70] sm:grid-cols-[1.2fr_1.1fr_.8fr_.65fr_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3"><PlatformIcon platform={account.platform} size="sm" /><div className="min-w-0"><strong className="block truncate text-sm">{account.platformLabel}</strong><span className="block truncate text-[11px] text-text-muted">{account.accountType}</span></div></div>
      <div className="min-w-0"><p className="truncate text-xs font-medium">{account.accountName}</p><p className="truncate text-[11px] text-text-muted">{account.handle || '—'}</p></div>
      <AccountStatusBadge status={account.status} />
      <div className="text-[11px] text-text-muted"><span className="block">{metricLabel(account)}</span><span className="block">{account.lastSyncAt ? relativeSyncTime(account.lastSyncAt) : 'Never synced'}</span></div>
      <div className="flex items-center justify-end gap-2">
        {connected ? <><Button onClick={onView} size="sm" variant="secondary"><Eye className="size-3.5" /></Button><RefreshConnectionButton onRefresh={onRefresh} refreshing={refreshing} /><ConnectionActionsMenu account={account} onDisconnect={onDisconnect} onPermissions={onView} onReconnect={onReconnect} onRefresh={onRefresh} onView={onView} /></> : <Button disabled={!isGatewayPlatform(account.platform)} onClick={onConnect} size="sm" variant="secondary">Connect</Button>}
      </div>
    </article>
  )
}

function EmptyState({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="grid min-h-64 place-items-center p-8 text-center">
      <div className="max-w-md">
        <Link2 className="mx-auto size-9 text-text-soft" />
        <strong className="mt-4 block text-base">No social accounts connected yet.</strong>
        <p className="mt-2 text-sm leading-6 text-text-muted">Connect your first social platform to start publishing, scheduling and analysing content.</p>
        <Button className="mt-5" onClick={onConnect}><Plus className="size-4" />Connect Account</Button>
      </div>
    </div>
  )
}

function MorePlatformsCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="group min-h-[154px] rounded-xl border border-dashed border-border-soft bg-white/[.015] p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-teal/35 hover:bg-brand-teal/[.035] focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={onOpen} type="button">
      <span className="grid size-10 place-items-center rounded-xl border border-border-soft bg-bg/50 text-brand-cyan"><MoreHorizontal className="size-5" /></span>
      <strong className="mt-3 block text-sm">More Platforms</strong>
      <p className="mt-1 text-xs leading-5 text-text-muted">Explore additional social networks and connection options.</p>
      <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-cyan">View all <ExternalLink className="size-3" /></span>
    </button>
  )
}

function ConnectedPlatformsSection({ accounts, viewMode, search, platformFilter, statusFilter, refreshingId, onSearch, onPlatformFilter, onStatusFilter, onViewMode, onView, onRefresh, onReconnect, onDisconnect, onConnect, onMorePlatforms }: {
  accounts: AccountModel[]
  viewMode: ViewMode
  search: string
  platformFilter: 'all' | UiPlatform
  statusFilter: 'all' | ConnectionStatus
  refreshingId: string | null
  onSearch: (value: string) => void
  onPlatformFilter: (value: 'all' | UiPlatform) => void
  onStatusFilter: (value: 'all' | ConnectionStatus) => void
  onViewMode: (value: ViewMode) => void
  onView: (account: AccountModel) => void
  onRefresh: (account: AccountModel) => void
  onReconnect: (account: AccountModel) => void
  onDisconnect: (account: AccountModel) => void
  onConnect: (platform?: UiPlatform) => void
  onMorePlatforms: () => void
}) {
  return (
    <section className="relative overflow-visible rounded-2xl border border-border-soft bg-panel/42 shadow-[inset_0_1px_0_rgba(255,255,255,.018)] backdrop-blur-xl">
      <header className="border-b border-border-soft px-3 py-3">
        <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-end 2xl:justify-between">
          <div>
            <h2 className="text-base font-semibold">All Connected Platforms</h2>
            <p className="mt-1 text-xs text-text-muted">Your connected social accounts and their status.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[180px] flex-1 sm:flex-none">
              <span className="sr-only">Search accounts</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
              <input className="min-h-10 w-full rounded-xl border border-border-soft bg-bg/45 pl-9 pr-3 text-xs outline-none transition placeholder:text-text-soft hover:border-brand-cyan/25 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/10 sm:w-48" onChange={(event) => onSearch(event.target.value)} placeholder="Search accounts..." type="search" value={search} />
            </label>
            <PlatformFilter onChange={onPlatformFilter} value={platformFilter} />
            <StatusFilter onChange={onStatusFilter} value={statusFilter} />
            <ViewToggle onChange={onViewMode} value={viewMode} />
          </div>
        </div>
      </header>

      {!accounts.length ? <EmptyState onConnect={() => onConnect()} /> : viewMode === 'grid' ? (
        <div className="grid gap-2 p-2.5 sm:grid-cols-2 2xl:grid-cols-3">
          {accounts.map((account) => <PlatformCard account={account} key={account.id} onConnect={() => onConnect(account.platform)} onDisconnect={() => onDisconnect(account)} onReconnect={() => onReconnect(account)} onRefresh={() => onRefresh(account)} onView={() => onView(account)} refreshing={refreshingId === account.id} />)}
          <MorePlatformsCard onOpen={onMorePlatforms} />
        </div>
      ) : (
        <div>
          <div className="hidden grid-cols-[1.2fr_1.1fr_.8fr_.65fr_auto] gap-3 border-b border-border-soft bg-white/[.015] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-soft sm:grid"><span>Platform</span><span>Account</span><span>Status</span><span>Followers / Sync</span><span className="text-right">Actions</span></div>
          {accounts.map((account) => <PlatformListRow account={account} key={account.id} onConnect={() => onConnect(account.platform)} onDisconnect={() => onDisconnect(account)} onReconnect={() => onReconnect(account)} onRefresh={() => onRefresh(account)} onView={() => onView(account)} refreshing={refreshingId === account.id} />)}
        </div>
      )}
    </section>
  )
}

function ConnectionActivityItem({ item }: { item: ActivityItem }) {
  const dot = item.status === 'success' ? 'bg-brand-green' : item.status === 'warning' ? 'bg-brand-amber' : item.status === 'error' ? 'bg-brand-red' : 'bg-brand-cyan'
  return (
    <div className="relative flex gap-3 pb-4 last:pb-0">
      <span className={`absolute -left-[18px] top-4 size-2 rounded-full ${dot} shadow-[0_0_12px_currentColor]`} />
      <PlatformIcon platform={item.platform} size="sm" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-text-main">{item.message}</p>
        <p className="mt-0.5 truncate text-[11px] text-text-muted">{item.accountName || labelFor(item.platform)}</p>
        <p className="mt-0.5 text-[10px] text-text-soft">{relativeSyncTime(item.createdAt)}</p>
      </div>
    </div>
  )
}

function ConnectionActivityPanel({ items, onViewAll }: { items: ActivityItem[]; onViewAll: () => void }) {
  return (
    <aside className="rounded-2xl border border-border-soft bg-panel/45 p-4 backdrop-blur-xl">
      <header className="flex items-start justify-between gap-3">
        <div><h2 className="text-base font-semibold">Connection Activity</h2><p className="mt-1 text-xs text-text-muted">Live updates from your accounts.</p></div>
        <button className="text-[11px] font-semibold text-brand-cyan hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={onViewAll} type="button">View All →</button>
      </header>
      {items.length ? <div className="ml-1 mt-5 border-l border-brand-teal/20 pl-5">{items.slice(0, 6).map((item) => <ConnectionActivityItem item={item} key={item.id} />)}</div> : <div className="mt-5 rounded-xl border border-dashed border-border-soft p-5 text-center text-xs text-text-muted">No connection activity yet.</div>}
    </aside>
  )
}

function ConnectPlatformTile({ platform, available, onConnect }: { platform: UiPlatform; available: boolean; onConnect: () => void }) {
  return (
    <button className="group relative flex min-h-[78px] min-w-[82px] flex-col items-center justify-center rounded-xl border border-transparent bg-transparent px-2 py-2 text-center [perspective:500px] transition-[transform,background-color,border-color] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-1 hover:border-brand-teal/10 hover:bg-brand-teal/[.025] focus-visible:outline-2 focus-visible:outline-brand-cyan disabled:cursor-not-allowed disabled:opacity-45" disabled={!available} onClick={onConnect} type="button">
      <span className="relative grid place-items-center transition-[transform,filter] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:[transform:rotateX(8deg)_rotateY(-8deg)_translateY(-2px)_scale(1.12)] group-hover:drop-shadow-[0_10px_18px_rgba(20,184,166,.22)]">
        <span aria-hidden="true" className="absolute size-11 rounded-full bg-brand-teal/0 blur-xl transition duration-300 group-hover:bg-brand-teal/16" />
        <PlatformIcon className="relative" platform={platform} size="sm" />
      </span>
      <strong className="mt-2 text-[10px] transition-colors duration-200 group-hover:text-white">{labelFor(platform)}</strong>
      <span className="mt-0.5 text-[9px] font-semibold text-brand-cyan/90 transition group-hover:text-cyan-200">{available ? 'Connect' : 'Unavailable'}</span>
    </button>
  )
}

function ConnectNewAccountSection({ configured, onConnect, onMore }: { configured: boolean; onConnect: (platform: UiPlatform) => void; onMore: () => void }) {
  return (
    <section className="group relative overflow-hidden rounded-2xl border border-border-soft bg-[linear-gradient(105deg,rgba(9,28,42,.72),rgba(5,15,29,.9))] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.02)] transition duration-300 hover:border-brand-teal/18">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 size-52 rounded-full bg-brand-teal/[.025] blur-3xl transition duration-500 group-hover:bg-brand-teal/[.05]" />
      <div className="relative flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-sm font-semibold">Connect a new account</h2><p className="mt-0.5 text-[11px] text-text-muted">Expand your reach. Connect more platforms and grow faster.</p></div>
        <p className="hidden text-[10px] font-semibold italic text-brand-teal/75 lg:block">More platforms. Bigger possibilities.</p>
      </div>
      <div className="relative mt-2.5 flex gap-1 overflow-x-auto pb-1 xl:grid xl:grid-cols-10 xl:overflow-visible">
        {connectTiles.map((platform) => <ConnectPlatformTile available={configured && isGatewayPlatform(platform)} key={platform} onConnect={() => onConnect(platform)} platform={platform} />)}
        <button className="group/more flex min-h-[78px] min-w-[82px] flex-col items-center justify-center rounded-xl border border-transparent bg-transparent px-2 py-2 text-center transition duration-300 hover:-translate-y-1 hover:border-brand-teal/10 hover:bg-brand-teal/[.025] focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={onMore} type="button"><span className="grid size-8 place-items-center rounded-full border border-brand-teal/18 bg-brand-teal/[.04] transition duration-300 group-hover/more:rotate-6 group-hover/more:scale-110 group-hover/more:border-brand-teal/35 group-hover/more:shadow-[0_0_20px_rgba(20,184,166,.1)]"><MoreHorizontal className="size-4 text-brand-cyan" /></span><strong className="mt-2 text-[10px]">More Platforms</strong><span className="mt-0.5 text-[9px] font-semibold text-brand-cyan">View All</span></button>
      </div>
    </section>
  )
}

function DetailValue({ label, value, ok }: { label: string; value: ReactNode; ok?: boolean }) {
  return <div className="group flex items-center justify-between gap-4 rounded-xl border border-border-soft bg-bg/24 px-3 py-2.5 transition duration-200 hover:border-brand-teal/18 hover:bg-brand-teal/[.025]"><span className="text-[11px] text-text-muted">{label}</span><span className={`text-right text-xs font-medium transition-colors ${ok === true ? 'text-emerald-300' : ok === false ? 'text-rose-300' : 'text-text-main'}`}>{value}</span></div>
}

function AccountDetailsDrawer({ account, refreshing, onClose, onRefresh, onReconnect, onDisconnect }: { account: AccountModel; refreshing: boolean; onClose: () => void; onRefresh: () => void; onReconnect: () => void; onDisconnect: () => void }) {
  return (
    <Drawer onClose={onClose} title="Account details">
      <div className="p-5">
        <div className="relative overflow-hidden rounded-2xl border border-brand-teal/24 bg-[linear-gradient(135deg,rgba(20,184,166,.09),rgba(7,25,37,.74))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_16px_38px_rgba(0,0,0,.12)]">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-brand-cyan/[.05] blur-2xl" />
          <div className="relative flex items-start gap-3">
          <PlatformIcon platform={account.platform} size="lg" />
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="truncate text-base">{account.accountName}</strong><AccountStatusBadge status={account.status} /></div><p className="mt-1 text-xs text-text-muted">{account.platformLabel}{account.handle ? ` · ${account.handle}` : ''}</p><p className="mt-1 text-[11px] text-text-soft">{metricLabel(account)}</p></div>
          </div>
        </div>

        {account.status === 'reconnect_required' && <div className="mt-4 rounded-xl border border-brand-red/25 bg-brand-red/[.06] p-3"><strong className="text-xs text-rose-200">Reconnect required.</strong><p className="mt-1 text-xs leading-5 text-text-muted">This connection needs renewed permissions before INXSocial can publish or sync data.</p><Button className="mt-3" onClick={onReconnect} size="sm">Reconnect</Button></div>}

        <div className="mt-5 grid gap-2">
          <DetailValue label="Platform" value={account.platformLabel} />
          <DetailValue label="Profile / page type" value={account.accountType} />
          <DetailValue label="Handle" value={account.handle || 'Not supplied'} />
          <DetailValue label="Followers / subscribers" value={metricLabel(account)} />
          <DetailValue label="Publishing enabled" ok={account.publishingEnabled} value={account.publishingEnabled ? 'Enabled' : 'Disabled'} />
          <DetailValue label="Analytics enabled" ok={account.analyticsEnabled} value={account.analyticsEnabled ? 'Enabled' : 'Disabled'} />
          <DetailValue label="Scheduler enabled" ok={account.schedulerEnabled} value={account.schedulerEnabled ? 'Enabled' : 'Disabled'} />
          <DetailValue label="Last sync" value={account.lastSyncAt ? relativeSyncTime(account.lastSyncAt) : 'Not yet synced'} />
          <DetailValue label="Token status" ok={account.status === 'connected'} value={account.tokenStatus} />
        </div>

        <section className="mt-5 rounded-xl border border-border-soft bg-bg/25 p-4">
          <h3 className="text-xs font-semibold">Connected destinations</h3>
          <div className="mt-3 flex items-center gap-3"><PlatformIcon platform={account.platform} size="sm" /><div><p className="text-xs font-medium">{account.accountName}</p><p className="text-[10px] text-text-muted">{account.handle || account.accountType}</p></div></div>
        </section>

        <section className="mt-4 rounded-xl border border-border-soft bg-bg/25 p-4">
          <h3 className="text-xs font-semibold">Permissions</h3>
          {account.permissions.length ? <div className="mt-3 flex flex-wrap gap-2">{account.permissions.map((permission) => <span className="inline-flex items-center gap-1 rounded-full border border-brand-teal/20 bg-brand-teal/[.06] px-2 py-1 text-[10px] text-emerald-200" key={permission}><Check className="size-3" />{permission}</span>)}</div> : <p className="mt-2 text-xs text-text-muted">No active permissions.</p>}
        </section>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <RefreshConnectionButton onRefresh={onRefresh} refreshing={refreshing} />
          <Button onClick={onReconnect} size="sm" variant="secondary"><Link2 className="size-3.5" />Reconnect</Button>
          <a className="inline-flex min-h-9 items-center justify-center gap-2 rounded-control border border-border-strong bg-bg-panel-alt px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:border-accent-blue/60 hover:bg-bg-elevated focus-visible:outline-2 focus-visible:outline-brand-cyan" href={platformHome(account.platform)} rel="noreferrer" target="_blank"><ExternalLink className="size-3.5" />Open platform</a>
          <Button className="border-brand-red/20 text-rose-300 hover:bg-brand-red/10" onClick={onDisconnect} size="sm" variant="secondary"><Trash2 className="size-3.5" />Disconnect</Button>
        </div>
      </div>
    </Drawer>
  )
}

function DisconnectAccountModal({ account, pending, onCancel, onConfirm }: { account: AccountModel; pending: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal onClose={onCancel} subtitle="This action changes publishing availability for this destination." title={`Disconnect ${account.accountName}?`}>
      <div className="mt-5 rounded-xl border border-brand-red/20 bg-brand-red/[.055] p-4">
        <p className="text-sm leading-6 text-text-muted">Disconnecting this account will stop future publishing, scheduling and analytics sync for this connection.</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button disabled={pending} onClick={onCancel} variant="secondary">Cancel</Button>
        <Button className="border-brand-red bg-brand-red text-white hover:bg-red-500" disabled={pending} onClick={onConfirm}>{pending ? <><LoaderCircle className="size-4 animate-spin" />Disconnecting…</> : 'Disconnect account'}</Button>
      </div>
    </Modal>
  )
}

function DestinationSelector({ accounts }: { accounts: AccountModel[] }) {
  return (
    <section className="mt-4 rounded-xl border border-border-soft bg-bg/25 p-4">
      <h3 className="text-xs font-semibold">Authorised destinations</h3>
      <p className="mt-1 text-[11px] leading-5 text-text-muted">The current social gateway returns authorised destinations as one secure connection. They become available to INXSocial together.</p>
      <div className="mt-3 grid gap-2">
        {accounts.map((account) => <label className="flex items-center gap-3 rounded-lg border border-border-soft bg-bg/30 px-3 py-2" key={account.id}><input checked className="accent-brand-teal" disabled readOnly type="checkbox" /><PlatformIcon platform={account.platform} size="sm" /><span className="min-w-0"><strong className="block truncate text-xs">{account.accountName}</strong><span className="block truncate text-[10px] text-text-muted">{account.handle || account.accountType}</span></span></label>)}
      </div>
    </section>
  )
}

function ConnectAccountModal({ open, selectedPlatform, configured, connectedAccounts, pending, blueskyHandle, blueskyAppPassword, onClose, onSelect, onBlueskyHandle, onBlueskyAppPassword, onContinue }: {
  open: boolean
  selectedPlatform: UiPlatform | null
  configured: boolean
  connectedAccounts: AccountModel[]
  pending: boolean
  blueskyHandle: string
  blueskyAppPassword: string
  onClose: () => void
  onSelect: (platform: UiPlatform | null) => void
  onBlueskyHandle: (value: string) => void
  onBlueskyAppPassword: (value: string) => void
  onContinue: () => void
}) {
  if (!open) return null
  const selected = selectedPlatform
  const available = selected ? configured && isGatewayPlatform(selected) : false
  const destinations = selected ? connectedAccounts.filter((account) => account.platform === selected) : []

  return (
    <Modal maxWidth="max-w-2xl" onClose={onClose} subtitle="Connect through the secure INXSocial backend. Platform credentials and API secrets are never stored in frontend code." title={selected ? `Connect ${labelFor(selected)}` : 'Connect Account'}>
      {!selected ? (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {connectTiles.map((platform) => {
            const enabled = configured && isGatewayPlatform(platform)
            return <button className="flex items-center gap-3 rounded-xl border border-border-soft bg-bg/30 p-3 text-left transition hover:border-brand-teal/30 hover:bg-panel-hover/35 focus-visible:outline-2 focus-visible:outline-brand-cyan disabled:cursor-not-allowed disabled:opacity-55" disabled={!enabled} key={platform} onClick={() => onSelect(platform)} type="button"><PlatformIcon platform={platform} /><span className="min-w-0 flex-1"><strong className="block text-sm">{labelFor(platform)}</strong><small className="mt-0.5 block text-[11px] text-text-muted">{enabled ? 'Secure connection available' : 'Not enabled by the current gateway'}</small></span><Plus className="size-4 text-brand-cyan" /></button>
          })}
        </div>
      ) : (
        <div className="mt-5">
          <div className="flex items-start gap-3 rounded-xl border border-brand-teal/20 bg-brand-teal/[.045] p-4"><PlatformIcon platform={selected} size="lg" /><div><strong className="text-sm">{labelFor(selected)}</strong><p className="mt-1 text-xs leading-5 text-text-muted">{metaFor(selected).description}</p></div></div>

          {available ? <>
            <section className="mt-4 rounded-xl border border-border-soft bg-bg/25 p-4">
              <h3 className="text-xs font-semibold">What INXSocial will access</h3>
              <div className="mt-3 grid gap-2 text-xs text-text-muted sm:grid-cols-3">
                <span className="flex items-center gap-2"><Check className="size-3.5 text-brand-green" />Publishing</span>
                <span className="flex items-center gap-2"><Check className="size-3.5 text-brand-green" />Scheduling</span>
                <span className="flex items-center gap-2"><Check className="size-3.5 text-brand-green" />Supported analytics</span>
              </div>
            </section>

            {selected === 'bluesky' && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs"><span className="mb-1.5 block text-text-muted">Bluesky handle</span><input autoComplete="username" className="min-h-11 w-full rounded-xl border border-border-soft bg-bg/45 px-3 outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/10" onChange={(event) => onBlueskyHandle(event.target.value)} placeholder="name.bsky.social" value={blueskyHandle} /></label><label className="text-xs"><span className="mb-1.5 block text-text-muted">App password</span><input autoComplete="off" className="min-h-11 w-full rounded-xl border border-border-soft bg-bg/45 px-3 outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/10" onChange={(event) => onBlueskyAppPassword(event.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx" type="password" value={blueskyAppPassword} /></label></div>}

            {destinations.length > 0 && <DestinationSelector accounts={destinations} />}
            <p className="mt-4 text-[11px] leading-5 text-text-muted">Continue opens the platform's official authorisation flow. After authentication INXSocial refreshes the available destinations automatically.</p>
          </> : <div className="mt-4 rounded-xl border border-brand-amber/25 bg-brand-amber/[.055] p-4"><div className="flex gap-3"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand-amber" /><div><strong className="text-xs text-amber-200">Connection unavailable</strong><p className="mt-1 text-xs leading-5 text-text-muted">This network is not enabled by the current production social gateway, so INXSocial will not start a fake or incomplete connection flow.</p></div></div></div>}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button disabled={pending} onClick={() => onSelect(null)} variant="secondary">Cancel</Button>
            <Button disabled={!available || pending || (selected === 'bluesky' && (!blueskyHandle.trim() || !blueskyAppPassword.trim()))} onClick={onContinue}>{pending ? <><LoaderCircle className="size-4 animate-spin" />Authorising…</> : 'Continue'}</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function ActivityDrawer({ items, onClose }: { items: ActivityItem[]; onClose: () => void }) {
  const [platform, setPlatform] = useState<'all' | UiPlatform>('all')
  const [status, setStatus] = useState<'all' | ActivityItem['status']>('all')
  const filtered = items.filter((item) => (platform === 'all' || item.platform === platform) && (status === 'all' || item.status === status))
  return (
    <Drawer onClose={onClose} title="Connection Activity">
      <div className="p-5">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="relative"><span className="sr-only">Filter activity platform</span><select className="min-h-10 w-full appearance-none rounded-xl border border-border-soft bg-bg/40 px-3 pr-9 text-xs outline-none focus:border-brand-cyan" onChange={(event) => setPlatform(event.target.value as 'all' | UiPlatform)} value={platform}><option value="all">All platforms</option>{allUiPlatforms.map((item) => <option key={item} value={item}>{labelFor(item)}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-text-soft" /></label>
          <label className="relative"><span className="sr-only">Filter activity status</span><select className="min-h-10 w-full appearance-none rounded-xl border border-border-soft bg-bg/40 px-3 pr-9 text-xs outline-none focus:border-brand-cyan" onChange={(event) => setStatus(event.target.value as 'all' | ActivityItem['status'])} value={status}><option value="all">All statuses</option><option value="success">Success</option><option value="info">Info</option><option value="warning">Warning</option><option value="error">Error</option></select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-text-soft" /></label>
        </div>
        {filtered.length ? <div className="ml-1 mt-5 border-l border-brand-teal/20 pl-5">{filtered.map((item) => <ConnectionActivityItem item={item} key={item.id} />)}</div> : <div className="mt-5 rounded-xl border border-dashed border-border-soft p-6 text-center text-xs text-text-muted">No activity matches these filters.</div>}
      </div>
    </Drawer>
  )
}

function MorePlatformsModal({ configured, onClose, onConnect }: { configured: boolean; onClose: () => void; onConnect: (platform: UiPlatform) => void }) {
  return (
    <Modal maxWidth="max-w-2xl" onClose={onClose} subtitle="Networks enabled by the live publishing gateway can be connected immediately." title="More Platforms">
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {allUiPlatforms.map((platform) => {
          const available = configured && isGatewayPlatform(platform)
          return <button className="flex items-center gap-3 rounded-xl border border-border-soft bg-bg/30 p-3 text-left transition hover:border-brand-teal/30 focus-visible:outline-2 focus-visible:outline-brand-cyan disabled:cursor-not-allowed disabled:opacity-55" disabled={!available} key={platform} onClick={() => onConnect(platform)} type="button"><PlatformIcon platform={platform} /><span className="min-w-0 flex-1"><strong className="block text-sm">{labelFor(platform)}</strong><small className="mt-0.5 block text-[11px] text-text-muted">{available ? 'Available now' : 'Not enabled by current gateway'}</small></span>{available ? <Plus className="size-4 text-brand-cyan" /> : <span className="rounded-full border border-white/8 px-2 py-1 text-[9px] text-text-soft">Unavailable</span>}</button>
        })}
      </div>
    </Modal>
  )
}

export function ConnectedAccountsPage() {
  const queryClient = useQueryClient()
  const globalSearch = useUiStore((state) => state.connectionsSearch)
  const setGlobalSearch = useUiStore((state) => state.setConnectionsSearch)
  const workspace = useQuery({ queryKey: ['connections-workspace'], queryFn: fetchConnectionsWorkspace, refetchInterval: 60_000 })
  const jobs = useQuery({ queryKey: ['connected-accounts-jobs'], queryFn: fetchDashboardJobs, staleTime: 60_000 })

  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [platformFilter, setPlatformFilter] = useState<'all' | UiPlatform>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | ConnectionStatus>('all')
  const [selectedAccount, setSelectedAccount] = useState<AccountModel | null>(null)
  const [disconnecting, setDisconnecting] = useState<AccountModel | null>(null)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [connectOpen, setConnectOpen] = useState(false)
  const [connectPlatform, setConnectPlatform] = useState<UiPlatform | null>(null)
  const [morePlatformsOpen, setMorePlatformsOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [blueskyHandle, setBlueskyHandle] = useState('')
  const [blueskyAppPassword, setBlueskyAppPassword] = useState('')

  const identities = useMemo(() => workspace.data ? flattenConnectedIdentities(workspace.data) : [], [workspace.data])
  const accounts = useMemo(() => workspace.data ? identities.map((identity) => toAccountModel(identity, workspace.data)) : [], [identities, workspace.data])
  const configured = workspace.data ? Object.values(workspace.data.providers || {}).some((provider) => provider?.providerEngine === 'POST_FOR_ME' && provider.configured) : true

  const addedThisMonth = useMemo(() => {
    const now = new Date()
    return accounts.filter((account) => {
      if (!account.connectedAt) return false
      const date = new Date(account.connectedAt)
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
    }).length
  }, [accounts])

  const activePlatforms = new Set(accounts.filter((account) => account.status === 'connected' || account.status === 'syncing').map((account) => account.platform)).size
  const healthyCount = accounts.filter((account) => account.status === 'connected' || account.status === 'syncing').length
  const health = accounts.length ? Math.round((healthyCount / accounts.length) * 100) : 0

  const weeklyPosts = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const day = 24 * 60 * 60 * 1000
    const data = (jobs.data || []).filter((job) => job.status === 'PUBLISHED')
    const occurredAt = (job: (typeof data)[number]) => job.completedAt || job.updatedAt || job.createdAt
    const daily = Array.from({ length: 7 }, (_, index) => {
      const start = startOfToday - ((6 - index) * day)
      const end = start + day
      return data.filter((job) => {
        const value = occurredAt(job)
        const timestamp = value ? new Date(value).getTime() : Number.NaN
        return Number.isFinite(timestamp) && timestamp >= start && timestamp < end
      }).length
    })
    const current = daily.reduce((sum, value) => sum + value, 0)
    const previousStart = startOfToday - (13 * day)
    const previousEnd = startOfToday - (6 * day)
    const previous = data.filter((job) => {
      const value = occurredAt(job)
      const timestamp = value ? new Date(value).getTime() : Number.NaN
      return Number.isFinite(timestamp) && timestamp >= previousStart && timestamp < previousEnd
    }).length
    return { current, previous, daily }
  }, [jobs.data])

  const accountSeries = useMemo(() => {
    const now = new Date()
    const day = 24 * 60 * 60 * 1000
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - (35 * day)
    const buckets = Array(6).fill(0) as number[]
    let baseline = 0
    accounts.forEach((account) => {
      if (!account.connectedAt) return
      const timestamp = new Date(account.connectedAt).getTime()
      if (!Number.isFinite(timestamp)) return
      if (timestamp < start) baseline += 1
      else {
        const bucket = Math.min(5, Math.max(0, Math.floor((timestamp - start) / (7 * day))))
        buckets[bucket] += 1
      }
    })
    return buckets.map((_, index) => baseline + buckets.slice(0, index + 1).reduce((sum, value) => sum + value, 0))
  }, [accounts])

  const activities = useMemo<ActivityItem[]>(() => accounts
    .map((account) => ({
      id: `activity:${account.platform}:${account.id}`,
      platform: account.platform,
      accountName: account.handle || account.accountName,
      message: account.status === 'connected'
        ? `${account.platformLabel} sync completed`
        : account.status === 'syncing'
          ? `${account.platformLabel} connection syncing`
          : `${account.platformLabel} connection needs attention`,
      createdAt: account.lastSyncAt || account.connectedAt || new Date().toISOString(),
      status: account.status === 'connected' ? 'success' as const : account.status === 'syncing' ? 'info' as const : 'warning' as const,
    }))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()), [accounts])

  const visibleAccounts = useMemo(() => {
    const term = globalSearch.trim().toLowerCase()
    return accounts.filter((account) => {
      const matchesSearch = !term || `${account.platformLabel} ${account.accountName} ${account.handle || ''} ${account.accountType}`.toLowerCase().includes(term)
      const matchesPlatform = platformFilter === 'all' || account.platform === platformFilter
      const matchesStatus = statusFilter === 'all' || account.status === statusFilter
      return matchesSearch && matchesPlatform && matchesStatus
    })
  }, [accounts, globalSearch, platformFilter, statusFilter])

  const refreshWorkspace = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['connections-workspace'] }),
      queryClient.invalidateQueries({ queryKey: ['studio-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['settings-workspace'] }),
      queryClient.invalidateQueries({ queryKey: ['posts-workspace'] }),
      queryClient.invalidateQueries({ queryKey: ['connected-accounts-jobs'] }),
    ])
  }

  const connectMutation = useMutation({
    mutationFn: async (platform: UiPlatform) => {
      if (!configured) throw new Error('Social connection gateway is not configured.')
      if (!isGatewayPlatform(platform)) throw new Error(`${labelFor(platform)} is not enabled by the current production gateway.`)
      const input = platform === 'bluesky' ? { handle: blueskyHandle.trim(), appPassword: blueskyAppPassword.trim() } : {}
      if (platform === 'bluesky' && (!input.handle || !input.appPassword)) throw new Error('Enter your Bluesky handle and app password first.')
      return connectPostForMePlatform(platform, input)
    },
    onSuccess: async (_, platform) => {
      await syncPostForMeConnections()
      await refreshWorkspace()
      setConnectOpen(false)
      setConnectPlatform(null)
      setBlueskyAppPassword('')
      setToast({ tone: 'success', message: 'Account connected successfully.' })
      void platform
    },
    onError: (error) => setToast({ tone: 'error', message: error instanceof Error ? error.message : 'The account could not be connected.' }),
  })

  const disconnectMutation = useMutation({
    mutationFn: async (account: AccountModel) => {
      if (!account.connectionId) throw new Error('This connection cannot be removed from this screen.')
      return disconnectSocialConnection(account.connectionId)
    },
    onSuccess: async () => {
      await refreshWorkspace()
      setDisconnecting(null)
      setSelectedAccount(null)
      setToast({ tone: 'success', message: 'Account disconnected.' })
    },
    onError: (error) => setToast({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to disconnect this account.' }),
  })

  async function refreshAccount(account: AccountModel) {
    if (account.status === 'not_connected') return
    setRefreshingId(account.id)
    try {
      await syncPostForMeConnections()
      await refreshWorkspace()
      setToast({ tone: 'success', message: 'Account refreshed successfully.' })
    } catch {
      setToast({ tone: 'error', message: 'Unable to refresh this connection.' })
    } finally {
      setRefreshingId(null)
    }
  }

  function openConnect(platform?: UiPlatform) {
    setMorePlatformsOpen(false)
    setConnectPlatform(platform || null)
    setConnectOpen(true)
  }

  function reconnect(account: AccountModel) {
    if (!isGatewayPlatform(account.platform)) {
      setToast({ tone: 'error', message: `${account.platformLabel} is not enabled by the current production gateway.` })
      return
    }
    setSelectedAccount(null)
    openConnect(account.platform)
  }

  return (
    <div className="space-y-3 pb-8">
      <ConnectedAccountsHeader />
      {workspace.isError && <section className="flex flex-col gap-3 rounded-xl border border-brand-red/25 bg-brand-red/[.055] px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"><span>Connected-account data could not refresh. The connection workspace remains available.</span><Button onClick={() => void workspace.refetch()} size="sm">Retry account data</Button></section>}

      {!configured && <section className="rounded-xl border border-brand-amber/25 bg-brand-amber/[.055] px-4 py-3"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand-amber" /><div><strong className="text-xs text-amber-200">Connection gateway requires configuration</strong><p className="mt-1 text-xs leading-5 text-text-muted">Connect actions remain disabled until the server-side social publishing gateway is configured. No OAuth secrets are exposed in the browser.</p></div></div></section>}

      <ConnectedAccountsStats accountSeries={accountSeries} activePlatforms={activePlatforms} addedThisMonth={addedThisMonth} health={health} platformTotal={allUiPlatforms.length} postSeries={weeklyPosts.daily} postsPreviousWeek={weeklyPosts.previous} postsThisWeek={weeklyPosts.current} total={accounts.length} />

      <ConnectNewAccountSection configured={configured} onConnect={openConnect} onMore={() => setMorePlatformsOpen(true)} />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <ConnectedPlatformsSection
          accounts={visibleAccounts}
          onConnect={openConnect}
          onDisconnect={setDisconnecting}
          onMorePlatforms={() => setMorePlatformsOpen(true)}
          onPlatformFilter={setPlatformFilter}
          onReconnect={reconnect}
          onRefresh={(account) => void refreshAccount(account)}
          onSearch={setGlobalSearch}
          onStatusFilter={setStatusFilter}
          onView={setSelectedAccount}
          onViewMode={setViewMode}
          platformFilter={platformFilter}
          refreshingId={refreshingId}
          search={globalSearch}
          statusFilter={statusFilter}
          viewMode={viewMode}
        />
        <ConnectionActivityPanel items={activities} onViewAll={() => setActivityOpen(true)} />
      </div>

      {selectedAccount && <AccountDetailsDrawer account={selectedAccount} onClose={() => setSelectedAccount(null)} onDisconnect={() => setDisconnecting(selectedAccount)} onReconnect={() => reconnect(selectedAccount)} onRefresh={() => void refreshAccount(selectedAccount)} refreshing={refreshingId === selectedAccount.id} />}
      {disconnecting && <DisconnectAccountModal account={disconnecting} onCancel={() => setDisconnecting(null)} onConfirm={() => disconnectMutation.mutate(disconnecting)} pending={disconnectMutation.isPending} />}
      {activityOpen && <ActivityDrawer items={activities} onClose={() => setActivityOpen(false)} />}
      {morePlatformsOpen && <MorePlatformsModal configured={configured} onClose={() => setMorePlatformsOpen(false)} onConnect={openConnect} />}
      <ConnectAccountModal
        blueskyAppPassword={blueskyAppPassword}
        blueskyHandle={blueskyHandle}
        configured={configured}
        connectedAccounts={accounts}
        onBlueskyAppPassword={setBlueskyAppPassword}
        onBlueskyHandle={setBlueskyHandle}
        onClose={() => { if (!connectMutation.isPending) { setConnectOpen(false); setConnectPlatform(null); setBlueskyAppPassword('') } }}
        onContinue={() => { if (connectPlatform) connectMutation.mutate(connectPlatform) }}
        onSelect={setConnectPlatform}
        open={connectOpen}
        pending={connectMutation.isPending}
        selectedPlatform={connectPlatform}
      />
      <Toast onClose={() => setToast(null)} toast={toast} />
    </div>
  )
}
