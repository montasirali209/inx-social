import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronRight, Layers3, LoaderCircle, Plus, Radio, Search, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { Button } from '../ui/Button'
import { SocialPlatformIcon } from '../ui/SocialPlatformIcon'
import './connected-accounts-motion.css'

type Notice = { tone: 'success' | 'error'; message: string } | null

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={title}>
      <section className="connected-modal max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border-soft bg-[#071923]/95 p-5 shadow-2xl">
        <header className="flex items-start justify-between gap-4">
          <div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-xs text-text-muted">Secure social connection managed through the INXSocial backend.</p></div>
          <button aria-label="Close" className="grid size-9 place-items-center rounded-lg text-text-muted hover:bg-white/5" onClick={onClose} type="button"><X className="size-4" /></button>
        </header>
        {children}
      </section>
    </div>
  )
}

function PlatformBadge({ platform, size = 'md' }: { platform: Platform; size?: 'md' | 'lg' }) {
  return <span className={`connected-platform-badge grid shrink-0 place-items-center rounded-2xl border border-white/10 bg-bg/55 ${size === 'lg' ? 'size-14' : 'size-11'}`}><SocialPlatformIcon className={size === 'lg' ? '!size-11' : '!size-8'} platform={platform} /></span>
}

function IdentityAvatar({ identity }: { identity: ConnectedIdentity }) {
  return <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-bg/70 shadow-[0_10px_24px_rgba(0,0,0,.25)]">
    <SocialPlatformIcon className="absolute size-8 rounded-lg" platform={identity.platform} />
    {identity.avatarUrl ? <img alt="" className="relative z-10 size-full object-cover" onError={event => { event.currentTarget.style.display = 'none' }} src={identity.avatarUrl} /> : null}
  </span>
}

export function ConnectedAccountsPage() {
  const queryClient = useQueryClient()
  const workspace = useQuery({
    queryKey: ['connections-workspace'],
    queryFn: fetchConnectionsWorkspace,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState<Notice>(null)
  const [connectOpen, setConnectOpen] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null)
  const [disconnecting, setDisconnecting] = useState<ConnectedIdentity | null>(null)
  const [blueskyHandle, setBlueskyHandle] = useState('')
  const [blueskyAppPassword, setBlueskyAppPassword] = useState('')

  const identities = useMemo(() => workspace.data ? flattenConnectedIdentities(workspace.data) : [], [workspace.data])
  const counts = useMemo(() => Object.fromEntries(customerFacingPlatforms.map(platform => [platform, identities.filter(identity => identity.platform === platform).length])) as Partial<Record<Platform, number>>, [identities])
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return identities
    return identities.filter(identity => `${identity.displayName} ${identity.username || ''} ${identity.platform}`.toLowerCase().includes(term))
  }, [identities, search])

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['connections-workspace'] }),
      queryClient.invalidateQueries({ queryKey: ['settings-workspace'] }),
      queryClient.invalidateQueries({ queryKey: ['posts-workspace'] }),
      queryClient.invalidateQueries({ queryKey: ['studio-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['analytics-sources'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-all-account-sources'] }),
    ])
  }

  const connectMutation = useMutation({
    mutationFn: async (platform: Platform) => {
      if (platform === 'google_business') throw new Error('Google Business is not supplied by the current social gateway.')
      const input = platform === 'bluesky' ? { handle: blueskyHandle.trim(), appPassword: blueskyAppPassword.trim() } : {}
      if (platform === 'bluesky' && (!input.handle || !input.appPassword)) throw new Error('Enter your Bluesky handle and app password first.')
      return connectPostForMePlatform(platform, input)
    },
    onSuccess: async (_, platform) => {
      await syncPostForMeConnections()
      await refresh()
      setConnectOpen(false)
      setSelectedPlatform(null)
      setBlueskyAppPassword('')
      setNotice({ tone: 'success', message: `${platformMeta[platform].label} connected successfully.` })
    },
    onError: error => setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The account could not be connected.' }),
  })

  const disconnectMutation = useMutation({
    mutationFn: (identity: ConnectedIdentity) => {
      if (!identity.connectionId) throw new Error('This connection must be migrated before it can be removed here.')
      return disconnectSocialConnection(identity.connectionId)
    },
    onSuccess: async () => { await refresh(); setDisconnecting(null); setNotice({ tone: 'success', message: 'Account disconnected.' }) },
    onError: error => setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The account could not be disconnected.' }),
  })

  if (workspace.isLoading) return <div className="h-[38rem] animate-pulse rounded-2xl border border-border-soft bg-panel/55" />
  if (workspace.isError || !workspace.data) return <section className="rounded-2xl border border-brand-red/25 bg-brand-red/7 p-6"><h2 className="text-lg font-semibold">Connected accounts unavailable</h2><p className="mt-2 text-sm text-text-muted">{workspace.error instanceof Error ? workspace.error.message : 'Try again shortly.'}</p><Button className="mt-4" onClick={() => void workspace.refetch()}>Try again</Button></section>

  const configured = Object.values(workspace.data.providers || {}).some(provider => provider?.providerEngine === 'POST_FOR_ME' && provider.configured)
  const connectedPlatforms = new Set(identities.map(identity => identity.platform)).size
  const healthyConnections = identities.filter(identity => identity.status === 'connected').length

  return (
    <div className="connected-accounts-scene space-y-4 pb-8">
      {notice && <div className={`connected-notice rounded-xl border p-3 text-sm ${notice.tone === 'success' ? 'border-brand-teal/25 bg-brand-teal/8 text-brand-teal' : 'border-brand-red/25 bg-brand-red/8 text-brand-red'}`}>{notice.message}</div>}

      <section className="connected-hero relative overflow-hidden rounded-[22px] border border-brand-cyan/15 p-5 sm:p-6">
        <div aria-hidden="true" className="connected-orb connected-orb-a" />
        <div aria-hidden="true" className="connected-orb connected-orb-b" />
        <div aria-hidden="true" className="connected-grid-plane" />
        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-start gap-3"><span className="connected-shield grid size-12 place-items-center rounded-2xl border border-brand-teal/20 bg-brand-teal/10 text-brand-cyan"><ShieldCheck className="size-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold sm:text-2xl">Connected Accounts</h1><span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/20 bg-brand-green/8 px-2.5 py-1 text-[10px] font-semibold text-brand-green"><Radio className="size-3 animate-pulse motion-reduce:animate-none" />Live gateway</span></div><p className="mt-1 max-w-2xl text-sm leading-6 text-text-muted">One connection universe for publishing, scheduling and analytics across every supported network.</p></div></div>
            <div className="mt-5 flex flex-wrap gap-2"><Button disabled={!configured} onClick={() => { setSelectedPlatform(null); setConnectOpen(true) }}><Plus className="size-4" />Connect Account</Button><span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/8 bg-bg/35 px-3 text-[10px] text-text-muted"><Sparkles className="size-3.5 text-brand-cyan" />Connections sync automatically</span></div>
          </div>
          <div className="connected-stack hidden min-h-28 min-w-44 items-center justify-center xl:flex" aria-hidden="true">
            <span className="connected-stack-card connected-stack-card-1"><Layers3 className="size-6" /></span><span className="connected-stack-card connected-stack-card-2" /><span className="connected-stack-card connected-stack-card-3" />
          </div>
        </div>
        <div className="relative z-10 mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[['Connected accounts', identities.length], ['Active platforms', connectedPlatforms], ['Connection health', identities.length ? `${Math.round(healthyConnections / identities.length * 100)}%` : '—'], ['Available networks', 9]].map(([label, value], index) => <div className="connected-stat-card" key={String(label)}><span className="connected-stat-index">0{index + 1}</span><small>{label}</small><strong>{value}</strong><span className="connected-stat-line" /></div>)}
        </div>
      </section>

      {!configured && <section className="rounded-2xl border border-brand-amber/30 bg-brand-amber/7 p-4"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-brand-amber" /><div><strong className="text-sm">Social gateway configuration required</strong><p className="mt-1 text-sm leading-6 text-text-muted">The server-side connection provider must be configured before customer connections can be enabled.</p></div></div></section>}

      <section className="connected-glass-panel rounded-[22px] border border-border-soft p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="font-semibold">Connect a network</h2><p className="mt-1 text-sm text-text-muted">Nine networks, one publishing workspace. Add more accounts without changing your workflow.</p></div><label className="relative block w-full md:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" /><input className="min-h-10 w-full rounded-xl border border-border-soft bg-bg/40 pl-9 pr-3 text-sm outline-none transition focus:border-brand-teal focus:shadow-[0_0_0_3px_rgba(20,184,166,.08)]" onChange={event => setSearch(event.target.value)} placeholder="Search connected accounts" value={search} /></label></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{customerFacingPlatforms.map((platform, index) => <button className="network-orbit-card group relative flex min-h-32 items-center gap-4 overflow-hidden rounded-2xl border border-border-soft p-4 text-left disabled:opacity-50" disabled={!configured} key={platform} onClick={() => { setSelectedPlatform(platform); setConnectOpen(true) }} style={{ animationDelay: `${index * 45}ms` }} type="button"><span aria-hidden="true" className="network-card-glow" /><PlatformBadge platform={platform} size="lg" /><span className="relative z-10 min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="text-sm">{platformMeta[platform].label}</strong>{(counts[platform] || 0) > 0 && <span className="rounded-full border border-brand-green/15 bg-brand-green/8 px-2 py-0.5 text-[10px] font-semibold text-brand-green">{counts[platform]} connected</span>}</span><small className="mt-1 block text-xs leading-5 text-text-muted">{platformMeta[platform].description}</small></span><ChevronRight className="relative z-10 size-4 shrink-0 text-brand-cyan transition duration-200 group-hover:translate-x-1" /></button>)}</div>
      </section>

      <section className="connected-glass-panel overflow-hidden rounded-[22px] border border-border-soft">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft p-5"><div><h2 className="font-semibold">Connected destinations</h2><p className="mt-1 text-sm text-text-muted">Profiles, Pages and channels currently available to the publisher and Analytics.</p></div><span className="inline-flex items-center gap-2 rounded-full border border-brand-green/15 bg-brand-green/8 px-3 py-1.5 text-[10px] font-semibold text-brand-green"><span className="size-1.5 animate-pulse rounded-full bg-brand-green motion-reduce:animate-none" />Auto-synced</span></header>
        {filtered.length ? <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3">{filtered.map((identity, index) => <article className="connected-destination-card group relative grid min-h-28 gap-3 overflow-hidden rounded-2xl border border-white/[.07] bg-bg/35 p-4" key={`${identity.platform}-${identity.id}`} style={{ animationDelay: `${index * 35}ms` }}><span aria-hidden="true" className="destination-scan" /><div className="relative z-10 flex min-w-0 items-center gap-3"><IdentityAvatar identity={identity} /><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{identity.displayName}</strong><small className="block truncate text-xs text-text-muted">{identity.username || identity.detail}</small></div><CheckCircle2 className="size-4 shrink-0 text-brand-green" /></div><div className="relative z-10 flex items-center justify-between gap-2"><span className="text-[10px] text-text-muted">{platformMeta[identity.platform].label} · {relativeSyncTime(identity.lastSyncedAt)}</span><Button onClick={() => setDisconnecting(identity)} size="sm" variant="secondary"><Trash2 className="size-3.5" />Disconnect</Button></div></article>)}</div> : <div className="grid min-h-44 place-items-center p-8 text-center"><div><p className="text-sm font-medium">No matching connected accounts.</p><p className="mt-1 text-xs text-text-muted">Connect a platform above to make it available to Posts, Calendar and Analytics.</p></div></div>}
      </section>

      {connectOpen && <Modal onClose={() => { if (!connectMutation.isPending) { setConnectOpen(false); setSelectedPlatform(null); setBlueskyAppPassword('') } }} title={selectedPlatform ? `Connect ${platformMeta[selectedPlatform].label}` : 'Connect a social account'}>
        {!selectedPlatform ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{customerFacingPlatforms.map(platform => <button className="network-orbit-card flex items-center gap-3 rounded-xl border border-border-soft p-3 text-left" key={platform} onClick={() => setSelectedPlatform(platform)} type="button"><PlatformBadge platform={platform} /><span className="flex-1"><strong className="block text-sm">{platformMeta[platform].label}</strong><small className="text-xs text-text-muted">{counts[platform] || 0} connected</small></span><ChevronRight className="size-4 text-brand-teal" /></button>)}</div> : <div className="mt-5"><div className="flex items-start gap-3 rounded-xl border border-brand-teal/20 bg-brand-teal/5 p-4"><PlatformBadge platform={selectedPlatform} size="lg" /><div><strong>{platformMeta[selectedPlatform].label}</strong><p className="mt-1 text-sm leading-6 text-text-muted">{platformMeta[selectedPlatform].description}</p></div></div>{selectedPlatform === 'bluesky' && <div className="mt-4 grid gap-3"><label className="text-sm"><span className="mb-1.5 block text-text-muted">Bluesky handle</span><input autoComplete="username" className="min-h-11 w-full rounded-xl border border-border-soft bg-bg/45 px-3 outline-none focus:border-brand-teal" onChange={event => setBlueskyHandle(event.target.value)} placeholder="name.bsky.social" value={blueskyHandle} /></label><label className="text-sm"><span className="mb-1.5 block text-text-muted">App password</span><input autoComplete="off" className="min-h-11 w-full rounded-xl border border-border-soft bg-bg/45 px-3 outline-none focus:border-brand-teal" onChange={event => setBlueskyAppPassword(event.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx" type="password" value={blueskyAppPassword} /></label><p className="text-xs leading-5 text-text-muted">Use a Bluesky app password, not your main account password. INXSocial sends it directly to the connection service and does not store it in the browser.</p></div>}<p className="mt-4 text-xs leading-5 text-text-muted">Publishing and feed permissions are requested so this connection can be used for posting, scheduling and supported analytics.</p><div className="mt-5 grid gap-2 sm:grid-cols-2"><Button disabled={connectMutation.isPending} onClick={() => setSelectedPlatform(null)} variant="secondary">Back</Button><Button disabled={connectMutation.isPending || (selectedPlatform === 'bluesky' && (!blueskyHandle.trim() || !blueskyAppPassword.trim()))} onClick={() => connectMutation.mutate(selectedPlatform)}>{connectMutation.isPending ? <><LoaderCircle className="size-4 animate-spin" />Waiting for authorisation…</> : `Connect ${platformMeta[selectedPlatform].label}`}</Button></div></div>}
      </Modal>}

      {disconnecting && <Modal onClose={() => !disconnectMutation.isPending && setDisconnecting(null)} title={`Disconnect ${disconnecting.displayName}?`}><div className="mt-5"><p className="text-sm leading-6 text-text-muted">Future publishing and analytics sync will stop for this destination. Existing INXSocial post history will remain available.</p><div className="mt-5 grid gap-2 sm:grid-cols-2"><Button disabled={disconnectMutation.isPending} onClick={() => setDisconnecting(null)} variant="secondary">Keep connected</Button><Button className="border-brand-red/35 bg-brand-red/10 text-brand-red hover:bg-brand-red/20" disabled={disconnectMutation.isPending} onClick={() => disconnectMutation.mutate(disconnecting)}>{disconnectMutation.isPending ? 'Disconnecting…' : 'Disconnect account'}</Button></div></div></Modal>}
    </div>
  )
}
