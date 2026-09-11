import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleHelp,
  Download,
  ExternalLink,
  Link2,
  LoaderCircle,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  connectionHelpTopics,
  platformMeta,
  supportedPlatforms,
  type ConnectionActivity,
  type ConnectionStatus,
  type Platform,
} from '../../data/connectedAccountsData'
import { relativeSyncTime } from '../../data/settingsData'
import {
  connectFacebook,
  connectInstagram,
  connectOAuthPlatform,
  disconnectAllConnections,
  disconnectFacebookPage,
  disconnectSocialConnection,
  fetchConnectionsWorkspace,
  flattenConnectedIdentities,
  type ConnectedIdentity,
} from '../../lib/connections-api'
import { useUiStore } from '../../store/ui-store'
import { Button } from '../ui/Button'
import { SocialPlatformIcon } from '../ui/SocialPlatformIcon'

type Tab = 'all' | 'platforms' | 'profiles' | 'advanced'
type Notice = { tone: 'success' | 'error'; message: string } | null

type ToggleState = {
  posts: boolean
  scheduler: boolean
  analytics: boolean
  primary: boolean
}

function PlatformIcon({ platform, size = 'md' }: { platform: Platform; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: '!size-8', md: '!size-10', lg: '!size-12' }
  return <SocialPlatformIcon className={sizes[size]} platform={platform} />
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const labels: Record<ConnectionStatus, string> = {
    connected: 'Connected',
    syncing: 'Syncing',
    expiring_soon: 'Expiring soon',
    disconnected: 'Disconnected',
    permission_issue: 'Permission issue',
    reconnect_required: 'Reconnect required',
  }
  const tones: Record<ConnectionStatus, string> = {
    connected: 'bg-brand-green/10 text-brand-green',
    syncing: 'bg-brand-cyan/10 text-brand-cyan',
    expiring_soon: 'bg-brand-amber/10 text-brand-amber',
    disconnected: 'bg-brand-red/10 text-brand-red',
    permission_issue: 'bg-brand-amber/10 text-brand-amber',
    reconnect_required: 'bg-brand-red/10 text-brand-red',
  }
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${tones[status]}`}><span className="size-1.5 rounded-full bg-current" />{labels[status]}</span>
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (next: boolean) => void }) {
  return (
    <button aria-checked={checked} aria-label={label} className={`relative h-6 w-11 rounded-full border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan ${checked ? 'border-brand-teal bg-brand-teal' : 'border-border-soft bg-bg'}`} onClick={() => onChange(!checked)} role="switch" type="button">
      <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-0.5'}`} />
    </button>
  )
}

function Modal({ children, onClose, panelClassName = '', title }: { children: React.ReactNode; onClose: () => void; panelClassName?: string; title: string }) {
  return (
    <div className="posts-modal-backdrop fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <section className={`posts-modal-panel max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-border-soft bg-[#071923] p-5 shadow-2xl ${panelClassName}`}>
        <header className="flex items-start justify-between gap-3"><h2 className="text-lg font-semibold">{title}</h2><button aria-label="Close dialog" className="grid size-9 place-items-center rounded-lg text-text-muted transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={onClose} type="button"><X className="size-4" /></button></header>
        {children}
      </section>
    </div>
  )
}

function EmptyState({ onConnect }: { onConnect: () => void }) {
  return <div className="grid min-h-72 place-items-center p-8 text-center"><div><Link2 className="mx-auto size-9 text-text-soft" /><strong className="mt-4 block text-base">No accounts connected yet.</strong><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-muted">Connect your first social platform to start publishing and scheduling content.</p><Button className="mt-5" onClick={onConnect}><Plus className="size-4" />Connect Account</Button></div></div>
}

export function ConnectedAccountsPage() {
  const queryClient = useQueryClient()
  const globalSearch = useUiStore((state) => state.connectionsSearch)
  const setGlobalSearch = useUiStore((state) => state.setConnectionsSearch)
  const workspace = useQuery({ queryKey: ['connections-workspace'], queryFn: fetchConnectionsWorkspace })
  const [tab, setTab] = useState<Tab>('all')
  const [notice, setNotice] = useState<Notice>(null)
  const [connectOpen, setConnectOpen] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null)
  const [managing, setManaging] = useState<ConnectedIdentity | null>(null)
  const [disconnecting, setDisconnecting] = useState<ConnectedIdentity | null>(null)
  const [disconnectAllOpen, setDisconnectAllOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [securityOpen, setSecurityOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [healthOpen, setHealthOpen] = useState(false)
  const [toggles, setToggles] = useState<Record<string, ToggleState>>({})

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), notice.tone === 'error' ? 8000 : 4500)
    return () => window.clearTimeout(timer)
  }, [notice])

  const identities = useMemo(() => workspace.data ? flattenConnectedIdentities(workspace.data) : [], [workspace.data])
  const filtered = useMemo(() => {
    const term = globalSearch.trim().toLowerCase()
    return identities.filter((identity) => !term || `${identity.displayName} ${identity.username || ''} ${identity.detail} ${identity.platform} ${identity.status}`.toLowerCase().includes(term))
  }, [identities, globalSearch])
  const counts = useMemo(() => Object.fromEntries((Object.keys(platformMeta) as Platform[]).map((platform) => [platform, identities.filter((identity) => identity.platform === platform).length])) as Record<Platform, number>, [identities])
  const connected = identities.filter((identity) => identity.status === 'connected').length
  const attention = identities.length - connected
  const platformCount = new Set(identities.map((identity) => identity.platform)).size
  const activities = useMemo<ConnectionActivity[]>(() => identities.slice(0, 12).map((identity) => ({
    id: identity.id,
    platform: identity.platform,
    accountName: identity.displayName,
    message: identity.status === 'connected' ? `${identity.displayName} is connected and available.` : `${identity.displayName} needs attention.`,
    status: identity.status === 'connected' ? 'success' : 'warning',
    createdAt: identity.lastSyncedAt || identity.connectedAt,
  })), [identities])

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['connections-workspace'] }),
      queryClient.invalidateQueries({ queryKey: ['studio-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['settings-workspace'] }),
    ])
  }

  const connectMutation = useMutation({
    mutationFn: async ({ platform }: { platform: Platform }) => {
      setNotice(null)
      if (platform === 'facebook') return connectFacebook()
      if (platform === 'instagram') return connectInstagram()
      if (platform === 'linkedin' || platform === 'youtube' || platform === 'x') return connectOAuthPlatform(platform)
      throw new Error(`${platformMeta[platform].label} is not available yet.`)
    },
    onSuccess: async (result, request) => {
      await refresh()
      setConnectOpen(false)
      setSelectedPlatform(null)
      setNotice({ tone: 'success', message: typeof result === 'object' && result && 'notice' in result ? String(result.notice) : `${platformMeta[request.platform].label} connected successfully.` })
    },
    onError: (error) => setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The account could not be connected.' }),
  })

  const disconnectMutation = useMutation({
    mutationFn: (identity: ConnectedIdentity) => identity.connectionId ? disconnectSocialConnection(identity.connectionId) : disconnectFacebookPage(identity.id),
    onSuccess: async () => {
      await refresh()
      setDisconnecting(null)
      setManaging(null)
      setNotice({ tone: 'success', message: 'The connection was removed.' })
    },
    onError: (error) => setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The connection could not be removed.' }),
  })

  const disconnectAllMutation = useMutation({
    mutationFn: async () => {
      if (!workspace.data) return { disconnected: 0 }
      return disconnectAllConnections(workspace.data)
    },
    onSuccess: async (result) => {
      await refresh()
      setDisconnectAllOpen(false)
      setManaging(null)
      setDisconnecting(null)
      setNotice({ tone: 'success', message: result.disconnected ? `Disconnected ${result.disconnected} connection${result.disconnected === 1 ? '' : 's'} from INXSocial.` : 'There were no connected accounts to remove.' })
    },
    onError: async (error) => {
      await refresh()
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Not every connection could be removed.' })
    },
  })

  const syncMutation = useMutation({
    mutationFn: refresh,
    onSuccess: () => setNotice({ tone: 'success', message: 'Connection data refreshed successfully.' }),
    onError: () => setNotice({ tone: 'error', message: 'The connection refresh could not complete.' }),
  })

  const defaultToggleState: ToggleState = { posts: true, scheduler: true, analytics: true, primary: false }
  const stateFor = (identity: ConnectedIdentity) => toggles[identity.id] || defaultToggleState
  const changeToggle = (identity: ConnectedIdentity, field: keyof ToggleState, next: boolean) => setToggles((current) => ({ ...current, [identity.id]: { ...(current[identity.id] || defaultToggleState), [field]: next } }))

  const downloadLogs = () => {
    const csv = ['Platform,Account,Event,Status,Time', ...activities.map((entry) => [platformMeta[entry.platform].label, entry.accountName, entry.message, entry.status, entry.createdAt].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'inx-social-connection-activity.csv'
    link.click()
    URL.revokeObjectURL(url)
    setNotice({ tone: 'success', message: 'Connection activity exported.' })
  }

  if (workspace.isLoading) return <div className="h-[38rem] animate-pulse rounded-2xl border border-border-soft bg-panel/55" />
  if (workspace.isError || !workspace.data) return <section className="rounded-2xl border border-brand-red/25 bg-brand-red/7 p-6"><h2 className="text-lg font-semibold">Connected accounts unavailable</h2><p className="mt-2 text-sm text-text-muted">{workspace.error instanceof Error ? workspace.error.message : 'Refresh and try again.'}</p><Button className="mt-4" onClick={() => void workspace.refetch()}>Try again</Button></section>

  const tabs: Array<[Tab, string]> = [['all', 'All Accounts'], ['platforms', 'Social Platforms'], ['profiles', 'Pages & Profiles'], ['advanced', 'Advanced']]

  return (
    <div className="space-y-4 pb-8">
      <label className="relative block sm:hidden"><span className="sr-only">Search accounts</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" /><input className="min-h-11 w-full rounded-xl border border-border-soft bg-panel/70 pl-10 pr-3 text-sm text-text-main placeholder:text-text-soft focus:border-brand-cyan focus:outline-none" onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Search accounts…" type="search" value={globalSearch} /></label>

      <div className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-panel/45 p-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Connected account sections" className="-mb-3 flex max-w-full overflow-x-auto"><div className="flex min-w-max gap-1">{tabs.map(([id, label]) => <button className={`border-b-2 px-3 py-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-brand-cyan ${tab === id ? 'border-brand-teal text-brand-teal' : 'border-transparent text-text-muted hover:text-white'}`} key={id} onClick={() => setTab(id)} type="button">{label}</button>)}</div></nav>
        <Button className="w-full sm:w-auto" onClick={() => { setSelectedPlatform(null); setConnectOpen(true) }}><Plus className="size-4" />Connect Account</Button>
      </div>

      {tab === 'all' && <>
        <section className="flex flex-col gap-4 rounded-2xl border border-brand-teal/20 bg-[linear-gradient(120deg,rgba(20,184,166,.08),rgba(15,36,52,.7))] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-xl bg-brand-teal/10 text-brand-teal"><ShieldCheck className="size-5" /></span><div><h2 className="font-semibold">Your accounts are secure</h2><p className="mt-1 text-sm text-text-muted">Connections use official platform authorisation and encrypted stored credentials.</p></div></div><Button onClick={() => setSecurityOpen(true)} variant="secondary">Learn more <ChevronRight className="size-4" /></Button></section>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
          <section className="overflow-hidden rounded-2xl border border-border-soft bg-panel/55 backdrop-blur-xl">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft p-4 sm:p-5"><div><div className="flex items-center gap-2"><h2 className="text-lg font-semibold">Connected Platforms</h2><span className="rounded-full bg-brand-teal/10 px-2 py-1 text-[10px] font-bold text-brand-teal">{platformCount} Connected</span></div><p className="mt-1 text-xs text-text-muted">Live accounts authorised for your INXSocial workspace.</p></div><Button disabled={syncMutation.isPending} onClick={() => syncMutation.mutate()} variant="secondary"><RefreshCw className={`size-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />Refresh</Button></header>
            {filtered.length ? <div className="divide-y divide-border-soft">{filtered.map((identity) => <article className="grid gap-3 p-4 transition hover:bg-panel-hover/35 lg:grid-cols-[1.1fr_1.4fr_.85fr_.85fr_auto] lg:items-center lg:gap-4 lg:px-5" key={`${identity.platform}-${identity.id}`}><div className="flex items-center gap-3"><PlatformIcon platform={identity.platform} /><span><strong className="block text-sm">{platformMeta[identity.platform].label}</strong><small className="text-xs text-text-muted">{identity.platform === 'facebook' ? 'Page' : identity.detail}</small></span></div><div className="min-w-0"><strong className="block truncate text-sm">{identity.displayName}</strong><small className="block truncate text-xs text-text-muted">{identity.username || 'Connected account'}</small></div><StatusBadge status={identity.status === 'connected' ? 'connected' : 'permission_issue'} /><span className="text-xs text-text-muted">{relativeSyncTime(identity.lastSyncedAt)}</span><div className="flex items-center gap-2"><Button onClick={() => setManaging(identity)} size="sm" variant="secondary">Manage</Button><button aria-label={`More actions for ${identity.displayName}`} className="grid size-9 place-items-center rounded-lg text-text-muted hover:bg-white/5" onClick={() => setDisconnecting(identity)} type="button"><MoreVertical className="size-4" /></button></div></article>)}</div> : <EmptyState onConnect={() => setConnectOpen(true)} />}
          </section>
          <aside className="space-y-4">
            <section className="rounded-2xl border border-border-soft bg-panel/55 p-5"><header className="flex items-center justify-between"><h2 className="font-semibold">Connection Overview</h2><button className="text-xs font-semibold text-brand-teal hover:text-brand-cyan" onClick={() => setHealthOpen(true)} type="button">View all</button></header><dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><dt className="text-text-muted">Active accounts</dt><dd className="font-semibold text-brand-green">{connected}</dd></div><div className="flex justify-between"><dt className="text-text-muted">Needs attention</dt><dd className={attention ? 'font-semibold text-brand-amber' : ''}>{attention}</dd></div><div className="flex justify-between"><dt className="text-text-muted">Connected platforms</dt><dd>{platformCount}</dd></div><div className="flex justify-between border-t border-border-soft pt-3"><dt className="text-text-muted">Total destinations</dt><dd>{identities.length}</dd></div></dl></section>
            <section className="rounded-2xl border border-border-soft bg-panel/55 p-5"><header className="flex items-center justify-between"><h2 className="font-semibold">Recent Activity</h2><button className="text-xs font-semibold text-brand-teal" onClick={() => setActivityOpen(true)} type="button">View all</button></header><div className="mt-3 space-y-3">{activities.slice(0, 5).map((activity) => <div className="flex items-center gap-2.5" key={activity.id}><PlatformIcon platform={activity.platform} size="sm" /><p className="min-w-0 flex-1 text-xs leading-5"><span className="block truncate">{activity.message}</span><small className="text-text-muted">{relativeSyncTime(activity.createdAt)}</small></p><Check className="size-4 text-brand-teal" /></div>)}</div></section>
            <section className="rounded-2xl border border-border-soft bg-[linear-gradient(145deg,rgba(20,184,166,.08),rgba(10,27,45,.9))] p-5"><CircleHelp className="size-6 text-brand-teal" /><h2 className="mt-3 font-semibold">Need help connecting?</h2><p className="mt-2 text-sm leading-6 text-text-muted">Learn how to connect and troubleshoot your social accounts.</p><Button className="mt-4" onClick={() => setHelpOpen(true)} size="sm" variant="secondary">View Help Center <ExternalLink className="size-3.5" /></Button></section>
          </aside>
        </div>
      </>}

      {tab === 'platforms' && <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{supportedPlatforms(counts).map((platform) => <article className="rounded-2xl border border-border-soft bg-panel/55 p-5 transition hover:-translate-y-0.5 hover:border-brand-teal/30" key={platform.platform}><div className="flex items-start justify-between gap-3"><PlatformIcon platform={platform.platform} size="lg" /><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${platform.available ? 'bg-brand-teal/10 text-brand-teal' : 'bg-white/5 text-text-muted'}`}>{platform.available ? `${platform.connectedCount} connected` : 'Coming soon'}</span></div><h2 className="mt-4 font-semibold">{platform.label}</h2><p className="mt-1 min-h-10 text-sm leading-5 text-text-muted">{platform.description}</p><div className="mt-4 flex flex-wrap gap-1.5">{platform.supportedContentTypes.map((type) => <span className="rounded-full border border-border-soft px-2 py-1 text-[10px] text-text-muted" key={type}>{type}</span>)}</div><Button className="mt-5 w-full" disabled={!platform.available} onClick={() => { setSelectedPlatform(platform.platform); setConnectOpen(true) }} variant={platform.connectedCount ? 'secondary' : 'primary'}>{platform.available ? platform.connectedCount ? 'Manage / add account' : 'Connect' : 'Not available yet'}</Button></article>)}</section>}

      {tab === 'profiles' && <section className="overflow-hidden rounded-2xl border border-border-soft bg-panel/55"><header className="border-b border-border-soft p-5"><h2 className="font-semibold">Pages & Profiles</h2><p className="mt-1 text-sm text-text-muted">Choose where each live connection can be used inside INXSocial.</p></header>{filtered.length ? <div className="divide-y divide-border-soft">{filtered.map((identity) => { const value = stateFor(identity); return <article className="grid gap-4 p-4 xl:grid-cols-[minmax(14rem,1.5fr)_9rem_repeat(4,minmax(7rem,.7fr))_auto] xl:items-center" key={identity.id}><div className="flex min-w-0 items-center gap-3"><PlatformIcon platform={identity.platform} /><span className="min-w-0"><strong className="block truncate">{identity.displayName}</strong><small className="block truncate text-text-muted">{identity.username || identity.detail}</small></span></div><span className="text-sm text-text-muted">{platformMeta[identity.platform].label}</span>{(['primary', 'posts', 'scheduler', 'analytics'] as const).map((field) => <label className="flex items-center justify-between gap-2 text-xs" key={field}>{field === 'primary' ? 'Default' : field === 'posts' ? 'Posts' : field === 'scheduler' ? 'Bulk Scheduler' : 'Analytics'} <Toggle checked={value[field]} label={`Toggle ${field} for ${identity.displayName}`} onChange={(next) => changeToggle(identity, field, next)} /></label>)}<Button onClick={() => setManaging(identity)} size="sm" variant="secondary">Details</Button></article> })}</div> : <EmptyState onConnect={() => setConnectOpen(true)} />}</section>}

      {tab === 'advanced' && <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,.7fr)]">
        <section className="rounded-2xl border border-border-soft bg-panel/55 p-5">
          <h2 className="font-semibold">Connection management</h2>
          <p className="mt-1 text-sm text-text-muted">Useful workspace controls for reviewing, refreshing and exporting your connected accounts.</p>
          <div className="mt-5 divide-y divide-border-soft">
            <div className="flex flex-wrap items-center justify-between gap-3 py-4"><div><strong className="text-sm">Refresh connected accounts</strong><p className="mt-1 text-xs text-text-muted">Reload the latest account, Page and profile status shown in INXSocial.</p></div><Button disabled={syncMutation.isPending} onClick={() => syncMutation.mutate()} size="sm" variant="secondary"><RefreshCw className={`size-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />Refresh now</Button></div>
            <div className="flex flex-wrap items-center justify-between gap-3 py-4"><div><strong className="text-sm">Connected destinations</strong><p className="mt-1 text-xs text-text-muted">{identities.length} destination{identities.length === 1 ? '' : 's'} across {platformCount} platform{platformCount === 1 ? '' : 's'} are currently available.</p></div><Button onClick={() => setTab('all')} size="sm" variant="secondary">View accounts</Button></div>
            <div className="flex flex-wrap items-center justify-between gap-3 py-4"><div><strong className="text-sm">Accounts needing attention</strong><p className="mt-1 text-xs text-text-muted">{attention ? `${attention} connection${attention === 1 ? '' : 's'} may need reconnecting or review.` : 'All visible connections are currently healthy.'}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${attention ? 'bg-brand-amber/10 text-brand-amber' : 'bg-brand-green/10 text-brand-green'}`}>{attention ? `${attention} to review` : 'All good'}</span></div>
            <div className="flex flex-wrap items-center justify-between gap-3 py-4"><div><strong className="text-sm">Add another account</strong><p className="mt-1 text-xs text-text-muted">Connect another Page, Instagram profile, LinkedIn identity or supported channel.</p></div><Button onClick={() => { setSelectedPlatform(null); setConnectOpen(true) }} size="sm" variant="secondary"><Plus className="size-3.5" />Connect</Button></div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4"><div><strong className="text-sm">Export connection activity</strong><p className="mt-1 text-xs text-text-muted">Download the currently visible connection activity as a CSV record.</p></div><Button disabled={!activities.length} onClick={downloadLogs} size="sm" variant="secondary"><Download className="size-3.5" />Export CSV</Button></div>
          </div>
        </section>
        <section className="rounded-2xl border border-brand-red/25 bg-brand-red/5 p-5">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-red/10 text-brand-red"><AlertTriangle className="size-5" /></span>
          <h2 className="mt-4 font-semibold">Danger Zone</h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">Disconnect every currently connected account and Page from this INXSocial workspace. Existing post history remains available.</p>
          <div className="mt-5 space-y-2">
            <Button className="w-full justify-between border-brand-red/30 bg-brand-red/10 text-brand-red hover:bg-brand-red/20" disabled={!identities.length || disconnectAllMutation.isPending} onClick={() => setDisconnectAllOpen(true)} variant="secondary">Disconnect all connected accounts <ChevronRight className="size-4" /></Button>
            <Button className="w-full justify-between" disabled={!activities.length} onClick={downloadLogs} variant="secondary">Export activity first <Download className="size-4" /></Button>
          </div>
          <p className="mt-4 text-xs leading-5 text-text-soft">For one account only, use Manage or the account actions from the All Accounts tab.</p>
        </section>
      </div>}

      {connectOpen && <Modal panelClassName="connection-connect-panel !max-w-3xl" onClose={() => { if (!connectMutation.isPending) { connectMutation.reset(); setConnectOpen(false); setSelectedPlatform(null) } }} title={selectedPlatform ? `${counts[selectedPlatform] ? 'Add another' : 'Connect'} ${platformMeta[selectedPlatform].label} account` : 'Connect an account'}>
        {selectedPlatform ? <div className="mt-4"><div className="connection-selected-platform flex items-center gap-3 rounded-2xl border border-brand-teal/25 bg-brand-teal/5 p-4"><PlatformIcon platform={selectedPlatform} size="lg" /><div><strong>{platformMeta[selectedPlatform].label}</strong><p className="mt-1 text-sm text-text-muted">{selectedPlatform === 'instagram' ? 'Connect an Instagram Business or Creator profile directly through Instagram.' : platformMeta[selectedPlatform].description}</p></div></div>{selectedPlatform === 'instagram' && <div className="mt-4 rounded-xl border border-brand-teal/25 bg-brand-teal/5 p-3 text-xs leading-5 text-text-muted"><strong className="text-brand-teal">Instagram Login</strong><p className="mt-1">Use Instagram's official authorisation window. If you cancel, INXSocial leaves the current connection unchanged and stops the connection attempt.</p></div>}<p className="mt-4 text-xs leading-5 text-text-muted">INXSocial never receives your platform password. You can disconnect at any time.</p><div className="mt-5 grid gap-2 sm:grid-cols-2"><Button disabled={connectMutation.isPending} onClick={() => { connectMutation.reset(); setConnectOpen(false); setSelectedPlatform(null) }} variant="secondary">Close</Button><Button disabled={!platformMeta[selectedPlatform].available || connectMutation.isPending || (selectedPlatform === 'instagram' && !workspace.data.providers.instagram.configured)} onClick={() => connectMutation.mutate({ platform: selectedPlatform })}>{connectMutation.isPending ? <><LoaderCircle className="size-4 animate-spin" />Waiting for authorisation…</> : selectedPlatform === 'instagram' && !workspace.data.providers.instagram.configured ? 'Instagram setup required' : selectedPlatform === 'instagram' && counts.instagram > 0 ? 'Connect another Instagram account' : selectedPlatform === 'instagram' ? 'Connect Instagram' : 'Continue securely'}</Button></div></div> : <div className="mt-4"><p className="text-sm leading-6 text-text-muted">Choose a platform to open its official secure authorisation flow.</p><div className="connection-platform-grid mt-5 grid gap-3 sm:grid-cols-2">{supportedPlatforms(counts).filter((platform) => !['threads', 'bluesky'].includes(platform.platform)).map((platform) => <button className="connection-platform-card flex min-h-28 items-center gap-4 rounded-2xl border border-border-soft bg-[linear-gradient(145deg,rgba(15,36,52,.86),rgba(5,15,29,.94))] p-4 text-left disabled:opacity-45" disabled={!platform.available} key={platform.platform} onClick={() => setSelectedPlatform(platform.platform)} type="button"><PlatformIcon platform={platform.platform} size="lg" /><span className="min-w-0 flex-1"><strong className="block text-sm">{platform.connectedCount ? 'Add another' : 'Connect'} {platform.label}</strong><small className="mt-1 block text-xs leading-5 text-text-muted">{platform.description}</small></span><ChevronRight className="size-4 shrink-0 text-brand-teal" /></button>)}</div></div>}
      </Modal>}

      {managing && <Modal onClose={() => setManaging(null)} title={`Manage ${managing.displayName}`}><div className="mt-4 space-y-4"><div className="flex items-center gap-3"><PlatformIcon platform={managing.platform} size="lg" /><div><strong>{managing.displayName}</strong><p className="text-sm text-text-muted">{managing.username || platformMeta[managing.platform].label}</p></div></div><dl className="grid grid-cols-2 gap-3 rounded-xl border border-border-soft bg-bg/35 p-4 text-sm"><div><dt className="text-text-muted">Last sync</dt><dd className="mt-1">{relativeSyncTime(managing.lastSyncedAt)}</dd></div><div><dt className="text-text-muted">Status</dt><dd className="mt-1"><StatusBadge status={managing.status === 'connected' ? 'connected' : 'permission_issue'} /></dd></div></dl><div className="grid gap-2 sm:grid-cols-2"><Button onClick={() => syncMutation.mutate()} variant="secondary"><RefreshCw className="size-4" />Refresh</Button><Button onClick={() => { setSelectedPlatform(managing.platform); setConnectOpen(true) }} variant="secondary">Reconnect</Button></div><Button className="w-full border-brand-red/30 bg-brand-red/10 text-brand-red hover:bg-brand-red/20" onClick={() => setDisconnecting(managing)} variant="secondary"><Trash2 className="size-4" />Disconnect account</Button></div></Modal>}

      {disconnecting && <Modal onClose={() => setDisconnecting(null)} title={`Disconnect ${disconnecting.platform === 'facebook' ? 'Page' : 'account'} “${disconnecting.displayName}”?`}><div className="mt-4"><p className="text-sm leading-6 text-text-muted">This removes only this connection from INXSocial. Existing post history remains available.</p><div className="mt-5 grid gap-2 sm:grid-cols-2"><Button onClick={() => setDisconnecting(null)} variant="secondary">Cancel</Button><Button className="border-brand-red/40 bg-brand-red/15 text-brand-red hover:bg-brand-red/25" disabled={disconnectMutation.isPending} onClick={() => disconnectMutation.mutate(disconnecting)}>{disconnectMutation.isPending ? 'Disconnecting…' : 'Yes, disconnect'}</Button></div></div></Modal>}

      {disconnectAllOpen && <Modal onClose={() => !disconnectAllMutation.isPending && setDisconnectAllOpen(false)} title="Disconnect all connected accounts?"><div className="mt-4"><div className="rounded-xl border border-brand-red/25 bg-brand-red/7 p-4"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-brand-red" /><div><strong className="text-brand-red">This affects the whole workspace.</strong><p className="mt-1 text-sm leading-6 text-text-muted">INXSocial will disconnect {identities.length} visible destination{identities.length === 1 ? '' : 's'} across {platformCount} platform{platformCount === 1 ? '' : 's'}. Scheduled publishing to those accounts will no longer be able to continue until they are reconnected.</p></div></div></div><p className="mt-4 text-sm text-text-muted">Your existing INXSocial post history is not deleted. You can reconnect accounts later using the official platform authorisation flow.</p><div className="mt-5 grid gap-2 sm:grid-cols-2"><Button disabled={disconnectAllMutation.isPending} onClick={() => setDisconnectAllOpen(false)} variant="secondary">Keep connections</Button><Button className="border-brand-red/40 bg-brand-red/15 text-brand-red hover:bg-brand-red/25" disabled={disconnectAllMutation.isPending} onClick={() => disconnectAllMutation.mutate()}>{disconnectAllMutation.isPending ? 'Disconnecting all…' : 'Disconnect all'}</Button></div></div></Modal>}

      {securityOpen && <Modal onClose={() => setSecurityOpen(false)} title="How INXSocial protects connections"><ul className="mt-4 space-y-3 text-sm leading-6 text-text-muted"><li>• INXSocial never stores your social-account password.</li><li>• Connections use each platform's official authorisation process.</li><li>• Access credentials are encrypted before they are stored.</li><li>• You can revoke access from INXSocial or the platform at any time.</li></ul></Modal>}

      {helpOpen && <Modal onClose={() => setHelpOpen(false)} title="Connection help"><div className="mt-4 space-y-3">{connectionHelpTopics.map((topic) => <section className="rounded-xl border border-border-soft bg-bg/35 p-3" key={topic.id}><strong className="text-sm">{topic.question}</strong><p className="mt-2 text-sm leading-6 text-text-muted">{topic.answer}</p></section>)}</div></Modal>}

      {activityOpen && <Modal onClose={() => setActivityOpen(false)} title="Connection activity"><div className="mt-4 space-y-2">{activities.map((activity) => <article className="flex items-center gap-3 rounded-xl border border-border-soft bg-bg/35 p-3" key={activity.id}><PlatformIcon platform={activity.platform} /><span className="min-w-0 flex-1"><strong className="block text-sm">{activity.message}</strong><small className="text-xs text-text-muted">{activity.accountName} · {relativeSyncTime(activity.createdAt)}</small></span><Check className="size-4 text-brand-teal" /></article>)}</div></Modal>}

      {healthOpen && <Modal onClose={() => setHealthOpen(false)} title="Detailed account health"><div className="mt-4 space-y-3">{identities.map((identity) => <div className="flex items-center justify-between gap-3 rounded-xl border border-border-soft bg-bg/35 p-3" key={identity.id}><span className="flex items-center gap-3"><PlatformIcon platform={identity.platform} /><span><strong className="block text-sm">{identity.displayName}</strong><small className="text-xs text-text-muted">Last checked {relativeSyncTime(identity.lastSyncedAt)}</small></span></span><StatusBadge status={identity.status === 'connected' ? 'connected' : 'permission_issue'} /></div>)}</div></Modal>}

      {notice && <div aria-live={notice.tone === 'error' ? 'assertive' : 'polite'} className={`notification-pop fixed bottom-5 right-5 z-[60] flex w-[min(24rem,calc(100vw-2rem))] items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl ${notice.tone === 'success' ? 'border-brand-teal/35 bg-[#08251f]/95' : 'border-brand-red/35 bg-[#30131b]/95'}`} role={notice.tone === 'error' ? 'alert' : 'status'}><span className="min-w-0 flex-1 break-words leading-5">{notice.message}</span><button aria-label="Dismiss notification" className="grid size-7 shrink-0 place-items-center rounded-lg text-current/70 transition hover:bg-white/10 hover:text-white" onClick={() => setNotice(null)} type="button"><X className="size-4" /></button></div>}
    </div>
  )
}
