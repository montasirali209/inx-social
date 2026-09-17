import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronRight, LoaderCircle, Plus, RefreshCw, Search, ShieldCheck, Trash2, X } from 'lucide-react'
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

type Notice = { tone: 'success' | 'error'; message: string } | null

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <section className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border-soft bg-[#071923] p-5 shadow-2xl">
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
  return <SocialPlatformIcon className={size === 'lg' ? '!size-12' : '!size-10'} platform={platform} />
}

export function ConnectedAccountsPage() {
  const queryClient = useQueryClient()
  const workspace = useQuery({ queryKey: ['connections-workspace'], queryFn: fetchConnectionsWorkspace })
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState<Notice>(null)
  const [connectOpen, setConnectOpen] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null)
  const [disconnecting, setDisconnecting] = useState<ConnectedIdentity | null>(null)
  const [blueskyHandle, setBlueskyHandle] = useState('')
  const [blueskyAppPassword, setBlueskyAppPassword] = useState('')

  const identities = useMemo(() => workspace.data ? flattenConnectedIdentities(workspace.data) : [], [workspace.data])
  const counts = useMemo(() => Object.fromEntries(customerFacingPlatforms.map((platform) => [platform, identities.filter((identity) => identity.platform === platform).length])) as Partial<Record<Platform, number>>, [identities])
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return identities
    return identities.filter((identity) => `${identity.displayName} ${identity.username || ''} ${identity.platform}`.toLowerCase().includes(term))
  }, [identities, search])

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['connections-workspace'] }),
      queryClient.invalidateQueries({ queryKey: ['settings-workspace'] }),
      queryClient.invalidateQueries({ queryKey: ['posts-workspace'] }),
      queryClient.invalidateQueries({ queryKey: ['studio-overview'] }),
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
    onError: (error) => setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The account could not be connected.' }),
  })

  const syncMutation = useMutation({
    mutationFn: syncPostForMeConnections,
    onSuccess: async () => { await refresh(); setNotice({ tone: 'success', message: 'Connected accounts refreshed.' }) },
    onError: (error) => setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Connections could not be refreshed.' }),
  })

  const disconnectMutation = useMutation({
    mutationFn: (identity: ConnectedIdentity) => {
      if (!identity.connectionId) throw new Error('This legacy connection must be migrated before it can be removed here.')
      return disconnectSocialConnection(identity.connectionId)
    },
    onSuccess: async () => { await refresh(); setDisconnecting(null); setNotice({ tone: 'success', message: 'Account disconnected.' }) },
    onError: (error) => setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The account could not be disconnected.' }),
  })

  if (workspace.isLoading) return <div className="h-[38rem] animate-pulse rounded-2xl border border-border-soft bg-panel/55" />
  if (workspace.isError || !workspace.data) return <section className="rounded-2xl border border-brand-red/25 bg-brand-red/7 p-6"><h2 className="text-lg font-semibold">Connected accounts unavailable</h2><p className="mt-2 text-sm text-text-muted">{workspace.error instanceof Error ? workspace.error.message : 'Refresh and try again.'}</p><Button className="mt-4" onClick={() => void workspace.refetch()}>Try again</Button></section>

  const configured = Object.values(workspace.data.providers || {}).some((provider) => provider?.providerEngine === 'POST_FOR_ME' && provider.configured)
  const connectedPlatforms = new Set(identities.map((identity) => identity.platform)).size

  return (
    <div className="space-y-4 pb-8">
      {notice && <div className={`rounded-xl border p-3 text-sm ${notice.tone === 'success' ? 'border-brand-teal/25 bg-brand-teal/8 text-brand-teal' : 'border-brand-red/25 bg-brand-red/8 text-brand-red'}`}>{notice.message}</div>}

      <section className="rounded-2xl border border-border-soft bg-[linear-gradient(120deg,rgba(20,184,166,.08),rgba(15,36,52,.72))] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-xl bg-brand-teal/10 text-brand-teal"><ShieldCheck className="size-5" /></span><div><h1 className="text-xl font-semibold">Connected Accounts</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-text-muted">Connect every supported social network from one workspace. INXSocial keeps your account mapping isolated and sends publishing requests through the server-side social gateway.</p></div></div>
          <div className="flex flex-wrap gap-2"><Button disabled={syncMutation.isPending || !configured} onClick={() => syncMutation.mutate()} variant="secondary"><RefreshCw className={`size-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />Refresh</Button><Button disabled={!configured} onClick={() => { setSelectedPlatform(null); setConnectOpen(true) }}><Plus className="size-4" />Connect Account</Button></div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-border-soft bg-bg/35 p-4"><small className="text-text-muted">Connected accounts</small><strong className="mt-1 block text-2xl">{identities.length}</strong></div><div className="rounded-xl border border-border-soft bg-bg/35 p-4"><small className="text-text-muted">Active platforms</small><strong className="mt-1 block text-2xl">{connectedPlatforms}</strong></div><div className="rounded-xl border border-border-soft bg-bg/35 p-4"><small className="text-text-muted">Available networks</small><strong className="mt-1 block text-2xl">9</strong></div></div>
      </section>

      {!configured && <section className="rounded-2xl border border-brand-amber/30 bg-brand-amber/7 p-4"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-brand-amber" /><div><strong className="text-sm">Post for Me configuration required</strong><p className="mt-1 text-sm leading-6 text-text-muted">Add the Post for Me API key and webhook secret to the Railway backend before enabling customer connections.</p></div></div></section>}

      <section className="rounded-2xl border border-border-soft bg-panel/55 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="font-semibold">Social networks</h2><p className="mt-1 text-sm text-text-muted">All networks currently supported by the INXSocial publishing gateway.</p></div><label className="relative block w-full md:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" /><input className="min-h-10 w-full rounded-xl border border-border-soft bg-bg/40 pl-9 pr-3 text-sm outline-none focus:border-brand-teal" onChange={(event) => setSearch(event.target.value)} placeholder="Search connected accounts" value={search} /></label></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{customerFacingPlatforms.map((platform) => <button className="group flex min-h-28 items-center gap-4 rounded-2xl border border-border-soft bg-[linear-gradient(145deg,rgba(15,36,52,.86),rgba(5,15,29,.94))] p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-teal/35 disabled:opacity-50" disabled={!configured} key={platform} onClick={() => { setSelectedPlatform(platform); setConnectOpen(true) }} type="button"><PlatformBadge platform={platform} size="lg" /><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><strong className="text-sm">{platformMeta[platform].label}</strong>{(counts[platform] || 0) > 0 && <span className="rounded-full bg-brand-teal/10 px-2 py-0.5 text-[10px] font-semibold text-brand-teal">{counts[platform]} connected</span>}</span><small className="mt-1 block text-xs leading-5 text-text-muted">{platformMeta[platform].description}</small></span><ChevronRight className="size-4 shrink-0 text-brand-teal transition group-hover:translate-x-0.5" /></button>)}</div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border-soft bg-panel/55">
        <header className="border-b border-border-soft p-5"><h2 className="font-semibold">Connected destinations</h2><p className="mt-1 text-sm text-text-muted">Every connected profile, Page or channel available to the publisher.</p></header>
        {filtered.length ? <div className="divide-y divide-border-soft">{filtered.map((identity) => <article className="grid gap-3 p-4 md:grid-cols-[minmax(0,1.4fr)_1fr_auto] md:items-center" key={`${identity.platform}-${identity.id}`}><div className="flex min-w-0 items-center gap-3"><PlatformBadge platform={identity.platform} /><div className="min-w-0"><strong className="block truncate text-sm">{identity.displayName}</strong><small className="block truncate text-xs text-text-muted">{identity.username || identity.detail}</small></div></div><div className="flex items-center gap-2 text-xs text-text-muted"><CheckCircle2 className="size-4 text-brand-teal" /><span>{platformMeta[identity.platform].label} · {relativeSyncTime(identity.lastSyncedAt)}</span></div><Button onClick={() => setDisconnecting(identity)} size="sm" variant="secondary"><Trash2 className="size-3.5" />Disconnect</Button></article>)}</div> : <div className="grid min-h-44 place-items-center p-8 text-center"><div><p className="text-sm font-medium">No matching connected accounts.</p><p className="mt-1 text-xs text-text-muted">Connect a platform above to make it available to Posts and Bulk Scheduler.</p></div></div>}
      </section>

      {connectOpen && <Modal onClose={() => { if (!connectMutation.isPending) { setConnectOpen(false); setSelectedPlatform(null); setBlueskyAppPassword('') } }} title={selectedPlatform ? `Connect ${platformMeta[selectedPlatform].label}` : 'Connect a social account'}>
        {!selectedPlatform ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{customerFacingPlatforms.map((platform) => <button className="flex items-center gap-3 rounded-xl border border-border-soft bg-bg/30 p-3 text-left hover:border-brand-teal/30" key={platform} onClick={() => setSelectedPlatform(platform)} type="button"><PlatformBadge platform={platform} /><span className="flex-1"><strong className="block text-sm">{platformMeta[platform].label}</strong><small className="text-xs text-text-muted">{counts[platform] || 0} connected</small></span><ChevronRight className="size-4 text-brand-teal" /></button>)}</div> : <div className="mt-5"><div className="flex items-start gap-3 rounded-xl border border-brand-teal/20 bg-brand-teal/5 p-4"><PlatformBadge platform={selectedPlatform} size="lg" /><div><strong>{platformMeta[selectedPlatform].label}</strong><p className="mt-1 text-sm leading-6 text-text-muted">{platformMeta[selectedPlatform].description}</p></div></div>{selectedPlatform === 'bluesky' && <div className="mt-4 grid gap-3"><label className="text-sm"><span className="mb-1.5 block text-text-muted">Bluesky handle</span><input autoComplete="username" className="min-h-11 w-full rounded-xl border border-border-soft bg-bg/45 px-3 outline-none focus:border-brand-teal" onChange={(event) => setBlueskyHandle(event.target.value)} placeholder="name.bsky.social" value={blueskyHandle} /></label><label className="text-sm"><span className="mb-1.5 block text-text-muted">App password</span><input autoComplete="off" className="min-h-11 w-full rounded-xl border border-border-soft bg-bg/45 px-3 outline-none focus:border-brand-teal" onChange={(event) => setBlueskyAppPassword(event.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx" type="password" value={blueskyAppPassword} /></label><p className="text-xs leading-5 text-text-muted">Use a Bluesky app password, not your main account password. INXSocial sends it directly to the connection service and does not store it in the browser.</p></div>}<p className="mt-4 text-xs leading-5 text-text-muted">Publishing and feed permissions are requested so this connection can be used for posting, scheduling and supported analytics.</p><div className="mt-5 grid gap-2 sm:grid-cols-2"><Button disabled={connectMutation.isPending} onClick={() => setSelectedPlatform(null)} variant="secondary">Back</Button><Button disabled={connectMutation.isPending || (selectedPlatform === 'bluesky' && (!blueskyHandle.trim() || !blueskyAppPassword.trim()))} onClick={() => connectMutation.mutate(selectedPlatform)}>{connectMutation.isPending ? <><LoaderCircle className="size-4 animate-spin" />Waiting for authorisation…</> : `Connect ${platformMeta[selectedPlatform].label}`}</Button></div></div>}
      </Modal>}

      {disconnecting && <Modal onClose={() => !disconnectMutation.isPending && setDisconnecting(null)} title={`Disconnect ${disconnecting.displayName}?`}><div className="mt-5"><p className="text-sm leading-6 text-text-muted">Future publishing and analytics sync will stop for this destination. Existing INXSocial post history will remain available.</p><div className="mt-5 grid gap-2 sm:grid-cols-2"><Button disabled={disconnectMutation.isPending} onClick={() => setDisconnecting(null)} variant="secondary">Keep connected</Button><Button className="border-brand-red/35 bg-brand-red/10 text-brand-red hover:bg-brand-red/20" disabled={disconnectMutation.isPending} onClick={() => disconnectMutation.mutate(disconnecting)}>{disconnectMutation.isPending ? 'Disconnecting…' : 'Disconnect account'}</Button></div></div></Modal>}
    </div>
  )
}
