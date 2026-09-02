import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, ChevronDown, Link2, LoaderCircle, Plus, RefreshCw, Search, ShieldCheck, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  connectFacebook,
  connectOAuthPlatform,
  disconnectFacebookPage,
  disconnectSocialConnection,
  fetchConnectionsWorkspace,
  flattenConnectedIdentities,
  syncInstagram,
} from '../../lib/connections-api'
import type { ConnectedIdentity } from '../../lib/connections-api'
import { Button } from '../ui/Button'

type Platform = 'all' | 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'x'
type Notice = { tone: 'success' | 'error'; message: string } | null

const platformDetails = [
  { id: 'facebook', label: 'Facebook', mark: 'f', detail: 'Publishing and analytics', live: true },
  { id: 'instagram', label: 'Instagram', mark: '◎', detail: 'Identity and insights', live: true },
  { id: 'linkedin', label: 'LinkedIn', mark: 'in', detail: 'Account identity', live: true },
  { id: 'youtube', label: 'YouTube', mark: '▶', detail: 'Channels and statistics', live: true },
  { id: 'x', label: 'X', mark: '𝕏', detail: 'Read-only profile', live: true },
] as const

const platformColours: Record<string, string> = {
  facebook: 'bg-[#1877f2] text-white',
  instagram: 'bg-gradient-to-br from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white',
  linkedin: 'bg-[#0a66c2] text-white',
  youtube: 'bg-[#ff0000] text-white',
  x: 'bg-white text-black',
}

function formatSync(value: string | null) {
  if (!value) return 'Not synced yet'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function LoadingState() {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div className="h-44 animate-pulse rounded-2xl border border-border-soft bg-panel/55" key={index} />)}</div>
}

export function ConnectedAccountsPage() {
  const queryClient = useQueryClient()
  const workspace = useQuery({ queryKey: ['connections-workspace'], queryFn: fetchConnectionsWorkspace })
  const [search, setSearch] = useState('')
  const [platform, setPlatform] = useState<Platform>('all')
  const [notice, setNotice] = useState<Notice>(null)
  const [disconnecting, setDisconnecting] = useState<ConnectedIdentity | null>(null)
  const [activePlatform, setActivePlatform] = useState<string | null>(null)

  const identities = useMemo(() => workspace.data ? flattenConnectedIdentities(workspace.data) : [], [workspace.data])
  const filtered = useMemo(() => identities.filter((identity) => {
    const matchesPlatform = platform === 'all' || identity.platform === platform
    const term = search.trim().toLowerCase()
    const matchesSearch = !term || `${identity.displayName} ${identity.username || ''} ${identity.platform}`.toLowerCase().includes(term)
    return matchesPlatform && matchesSearch
  }), [identities, platform, search])

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['connections-workspace'] }),
      queryClient.invalidateQueries({ queryKey: ['studio-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['settings-workspace'] }),
    ])
  }

  const connectMutation = useMutation({
    mutationFn: async (selected: string) => {
      setActivePlatform(selected)
      if (selected === 'facebook') return connectFacebook()
      if (selected === 'instagram') return syncInstagram()
      return connectOAuthPlatform(selected as 'linkedin' | 'youtube' | 'x')
    },
    onSuccess: async (_, selected) => {
      await refresh()
      setNotice({ tone: 'success', message: `${platformDetails.find((item) => item.id === selected)?.label || selected} connected successfully.` })
    },
    onError: (error) => setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The account could not be connected.' }),
    onSettled: () => setActivePlatform(null),
  })

  const disconnectMutation = useMutation({
    mutationFn: (identity: ConnectedIdentity) => identity.connectionId ? disconnectSocialConnection(identity.connectionId) : disconnectFacebookPage(identity.id),
    onSuccess: async () => {
      setDisconnecting(null)
      await refresh()
      setNotice({ tone: 'success', message: 'The connection was removed.' })
    },
    onError: (error) => setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The connection could not be removed.' }),
  })

  if (workspace.isLoading) return <LoadingState />
  if (workspace.isError || !workspace.data) return <section className="rounded-2xl border border-brand-red/25 bg-brand-red/7 p-6"><h2 className="text-lg font-semibold">Connected accounts unavailable</h2><p className="mt-2 text-sm text-text-muted">{workspace.error instanceof Error ? workspace.error.message : 'Refresh and try again.'}</p><Button className="mt-4" onClick={() => void workspace.refetch()}>Try again</Button></section>

  const connectedPlatforms = new Set(identities.map((identity) => identity.platform)).size
  const healthy = identities.filter((identity) => identity.status === 'connected').length
  const pageLimit = workspace.data.overview.license.limits.pages
  const facebookPages = identities.filter((identity) => identity.platform === 'facebook').length
  const availablePages = pageLimit === null ? 'Unlimited' : Math.max(0, pageLimit - facebookPages)

  return (
    <div className="space-y-5 pb-8">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Connected destinations', identities.length, 'Profiles and Pages available'],
          ['Connected platforms', connectedPlatforms, 'Live account connections'],
          ['Healthy connections', `${healthy}/${identities.length}`, !identities.length ? 'Connect a platform to begin' : healthy === identities.length ? 'All synced' : 'Review connection status'],
          ['Facebook Page slots', availablePages, pageLimit === null ? 'No plan limit' : `${facebookPages} of ${pageLimit} in use`],
        ].map(([label, value, detail]) => <article className="rounded-2xl border border-border-soft bg-[linear-gradient(145deg,rgba(15,36,52,.82),rgba(7,24,38,.9))] p-4 shadow-[0_14px_38px_rgba(0,0,0,.14)]" key={label}><span className="text-[10px] font-bold uppercase tracking-[.12em] text-text-muted">{label}</span><strong className="mt-2 block text-2xl tracking-[-.04em]">{value}</strong><small className="mt-1 block text-[11px] text-text-muted">{detail}</small></article>)}
      </section>

      <section className="rounded-2xl border border-border-soft bg-panel/45 p-4 backdrop-blur-xl sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><span className="text-[10px] font-bold uppercase tracking-[.15em] text-brand-teal">Official connections</span><h2 className="mt-1 text-lg font-semibold">Connect a social platform</h2><p className="mt-1 text-xs text-text-muted">Each card states the capabilities currently released in INXSocial.</p></div><span className="inline-flex items-center gap-2 text-xs text-text-muted"><ShieldCheck className="size-4 text-brand-teal" />Tokens are encrypted server-side</span></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {platformDetails.map((item) => {
            const provider = item.id === 'linkedin' || item.id === 'youtube' || item.id === 'x' ? workspace.data.providers[item.id] : null
            const configured = item.id === 'facebook' || item.id === 'instagram' || Boolean(provider?.configured)
            const count = identities.filter((identity) => identity.platform === item.id).length
            const loading = connectMutation.isPending && activePlatform === item.id
            return <button className="group flex min-h-28 items-center gap-3 rounded-2xl border border-border-soft bg-bg/35 p-3 text-left transition hover:-translate-y-0.5 hover:border-brand-teal/35 hover:bg-panel-soft/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan disabled:cursor-not-allowed disabled:opacity-55" disabled={!configured || connectMutation.isPending} key={item.id} onClick={() => connectMutation.mutate(item.id)} type="button"><span className={`grid size-11 shrink-0 place-items-center rounded-xl text-sm font-black ${platformColours[item.id]}`}>{loading ? <LoaderCircle className="size-5 animate-spin" /> : item.mark}</span><span className="min-w-0"><strong className="flex items-center gap-1.5 text-sm">{item.label}<Plus className="size-3.5 text-brand-teal" /></strong><small className="mt-1 block text-[10px] leading-4 text-text-muted">{configured ? item.detail : 'Server setup required'}</small><b className="mt-1 block text-[9px] font-semibold text-brand-teal">{count ? `${count} connected · add another` : 'Connect'}</b></span></button>
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-text-muted"><span className="rounded-full border border-border-soft px-3 py-1.5">Threads · planned</span><span className="rounded-full border border-border-soft px-3 py-1.5">TikTok · planned</span><span className="rounded-full border border-border-soft px-3 py-1.5">Pinterest · planned</span></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border-soft bg-panel/45 backdrop-blur-xl">
        <header className="flex flex-col gap-3 border-b border-border-soft p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h2 className="text-lg font-semibold">Connected destinations</h2><p className="mt-1 text-xs text-text-muted">Every connected YouTube channel and social profile is listed separately.</p></div><Button disabled={workspace.isFetching} onClick={() => void workspace.refetch()} variant="secondary"><RefreshCw className={`size-4 ${workspace.isFetching ? 'animate-spin' : ''}`} />Refresh</Button></header>
        <div className="grid gap-3 border-b border-border-soft p-4 sm:grid-cols-[minmax(0,1fr)_13rem]">
          <label className="relative"><span className="sr-only">Search connected accounts</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" /><input className="min-h-11 w-full rounded-xl border border-border-soft bg-bg/45 pl-10 pr-3 text-sm text-text-main placeholder:text-text-soft focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/15" onChange={(event) => setSearch(event.target.value)} placeholder="Search accounts or Pages…" type="search" value={search} /></label>
          <label className="relative"><span className="sr-only">Filter by platform</span><select className="min-h-11 w-full appearance-none rounded-xl border border-border-soft bg-bg/45 px-3 pr-9 text-sm text-text-main focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/15" onChange={(event) => setPlatform(event.target.value as Platform)} value={platform}><option value="all">Every platform</option>{platformDetails.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" /></label>
        </div>
        {filtered.length ? <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3 sm:p-5">{filtered.map((identity) => <article className="group grid grid-cols-[3rem_minmax(0,1fr)_auto] gap-3 rounded-2xl border border-border-soft bg-bg/35 p-4 transition hover:border-brand-teal/30 hover:bg-panel-soft/55" key={`${identity.platform}-${identity.id}`}><span className={`grid size-12 place-items-center overflow-hidden rounded-xl text-sm font-black ${platformColours[identity.platform]}`}>{identity.avatarUrl ? <img alt="" className="size-full object-cover" src={identity.avatarUrl} /> : platformDetails.find((item) => item.id === identity.platform)?.mark}</span><div className="min-w-0"><span className="text-[9px] font-bold uppercase tracking-[.11em] text-text-muted">{identity.platform}</span><h3 className="truncate text-sm font-semibold">{identity.displayName}</h3><p className="truncate text-[10px] text-text-muted">{identity.username || identity.detail}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-[9px]"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${identity.status === 'connected' ? 'bg-brand-teal/10 text-brand-teal' : 'bg-brand-amber/10 text-brand-amber'}`}>{identity.status === 'connected' ? <Check className="size-3" /> : <AlertTriangle className="size-3" />}{identity.status === 'connected' ? 'Connected' : 'Needs attention'}</span><span className="text-text-soft">Synced {formatSync(identity.lastSyncedAt)}</span></div></div><button aria-label={`Disconnect ${identity.displayName}`} className="grid size-9 place-items-center rounded-lg border border-brand-red/15 bg-brand-red/7 text-[#fb7185] transition hover:border-brand-red/35 hover:bg-brand-red/15 focus-visible:outline-2 focus-visible:outline-brand-red" onClick={() => setDisconnecting(identity)} title="Disconnect" type="button"><Trash2 className="size-4" /></button></article>)}</div> : <div className="grid min-h-56 place-items-center p-8 text-center"><div><Link2 className="mx-auto size-8 text-text-soft" /><strong className="mt-3 block">No connected destinations found</strong><p className="mt-2 text-xs text-text-muted">Connect a platform above or change your filters.</p></div></div>}
      </section>

      {disconnecting && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="disconnect-title"><section className="w-full max-w-md rounded-2xl border border-border-soft bg-[#071923] p-5 shadow-2xl"><header className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-bold uppercase tracking-[.13em] text-[#fb7185]">Remove connection</span><h2 className="mt-1 text-lg font-semibold" id="disconnect-title">Disconnect {disconnecting.displayName}?</h2></div><button aria-label="Close" className="grid size-9 place-items-center rounded-lg text-text-muted hover:bg-white/5" onClick={() => setDisconnecting(null)} type="button"><X className="size-4" /></button></header><p className="mt-3 text-sm leading-6 text-text-muted">{disconnecting.connectionId ? 'This removes the saved access and every profile or channel belonging to this connected account. Existing post records remain available.' : 'This Page will no longer be available for publishing or analytics. Existing post records remain available.'}</p><footer className="mt-5 grid gap-2 sm:grid-cols-2"><Button onClick={() => setDisconnecting(null)} type="button" variant="secondary">Keep connected</Button><Button className="border-brand-red/40 bg-brand-red/15 text-[#fb7185] hover:bg-brand-red/25" disabled={disconnectMutation.isPending} onClick={() => disconnectMutation.mutate(disconnecting)} type="button">{disconnectMutation.isPending ? 'Disconnecting…' : 'Disconnect'}</Button></footer></section></div>}

      {notice && <div className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm shadow-2xl ${notice.tone === 'success' ? 'border-brand-teal/35 bg-[#08251f]/95' : 'border-brand-red/35 bg-[#30131b]/95'}`}>{notice.message}</div>}
    </div>
  )
}
