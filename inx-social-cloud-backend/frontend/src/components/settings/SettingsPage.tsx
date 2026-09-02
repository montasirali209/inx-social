import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, LockKeyhole, RotateCcw, Save, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectionSummary, settingsCards, settingsEqual } from '../../data/settingsData'
import { fetchSettingsWorkspace, openBillingPortal, saveSettings } from '../../lib/settings-api'
import { useUiStore } from '../../store/ui-store'
import type { SettingsCardData, SettingsValues } from '../../types/settings'
import { Button } from '../ui/Button'
import { SettingsCard } from './SettingsCard'

type Notice = { tone: 'success' | 'error'; message: string } | null

function SettingsSkeleton() {
  return (
    <div aria-label="Loading settings" className="grid gap-4 md:grid-cols-2 2xl:grid-cols-12">
      {Array.from({ length: 7 }, (_, index) => <div className={`h-[310px] animate-pulse rounded-2xl border border-border-soft bg-panel/55 ${index < 3 ? '2xl:col-span-4' : '2xl:col-span-3'}`} key={index} />)}
    </div>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const search = useUiStore((state) => state.settingsSearch)
  const setSearch = useUiStore((state) => state.setSettingsSearch)
  const setTimezone = useUiStore((state) => state.setTimezone)
  const [changes, setChanges] = useState<Partial<SettingsValues>>({})
  const [notice, setNotice] = useState<Notice>(null)
  const noticeTimer = useRef<number | null>(null)
  const workspace = useQuery({ queryKey: ['settings-workspace'], queryFn: fetchSettingsWorkspace })

  useEffect(() => () => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
  }, [])

  const mutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: (values) => {
      queryClient.setQueryData(['settings-workspace'], (current: typeof workspace.data) => current ? { ...current, settings: values } : current)
      setChanges({})
      setTimezone(values.timezone)
      void queryClient.invalidateQueries({ queryKey: ['settings-workspace'] })
      showNotice({ tone: 'success', message: 'Settings saved successfully.' })
    },
    onError: (error) => showNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Settings could not be saved.' }),
  })

  function showNotice(next: Exclude<Notice, null>) {
    setNotice(next)
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4200)
  }

  const draft = useMemo(() => workspace.data ? { ...workspace.data.settings, ...changes } : null, [changes, workspace.data])

  const cards = useMemo(() => {
    if (!draft || !workspace.data) return []
    const all = settingsCards(draft, { ...workspace.data, settings: draft })
    const term = search.trim().toLowerCase()
    if (!term) return all
    return all.filter((card) => `${card.title} ${card.description} ${card.rows.map((row) => `${row.label} ${row.description || ''}`).join(' ')}`.toLowerCase().includes(term))
  }, [draft, search, workspace.data])

  const dirty = Boolean(draft && workspace.data && !settingsEqual(draft, workspace.data.settings))
  const connectedPlatforms = useMemo(() => {
    if (!workspace.data) return []
    const values = new Set<string>()
    if ((workspace.data.account.pageUsage?.connected || 0) > 0) values.add('facebook')
    workspace.data.connections.filter((connection) => connection.status === 'ACTIVE').forEach((connection) => values.add(connection.platform))
    return [...values]
  }, [workspace.data])

  function changeSetting(key: keyof SettingsValues, value: string | boolean) {
    setChanges((current) => ({ ...current, [key]: value }))
    if (key === 'timezone' && typeof value === 'string') setTimezone(value)
  }

  function discardChanges() {
    if (!workspace.data) return
    setChanges({})
    setTimezone(workspace.data.settings.timezone)
    showNotice({ tone: 'success', message: 'Unsaved changes discarded.' })
  }

  async function cardAction(card: SettingsCardData) {
    if (card.id === 'publishing') return navigate('/posts')
    if (card.id === 'scheduler') return navigate('/bulk-scheduler')
    if (card.id === 'ai_content') return window.location.assign('/studio/?view=agent')
    if (card.id === 'connected_accounts') return navigate('/connected-accounts')
    if (card.id === 'billing') {
      try { await openBillingPortal() } catch (error) { showNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Billing portal could not be opened.' }) }
      return
    }
    const target = card.id === 'notifications' ? 'emailAlerts' : 'workspaceName'
    document.getElementById(target)?.focus()
  }

  if (workspace.isLoading) return <SettingsSkeleton />

  if (workspace.isError || !workspace.data || !draft) {
    return <section className="rounded-2xl border border-brand-red/25 bg-brand-red/7 p-6"><h2 className="text-lg font-semibold">Settings unavailable</h2><p className="mt-2 text-sm text-text-muted">{workspace.error instanceof Error ? workspace.error.message : 'Refresh the page and try again.'}</p><Button className="mt-4" onClick={() => void workspace.refetch()} type="button">Try again</Button></section>
  }

  const sync = connectionSummary({ ...workspace.data, settings: draft })

  return (
    <div className="space-y-4 pb-8">
      <label className="relative block sm:hidden">
        <span className="sr-only">Search settings</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
        <input className="min-h-11 w-full rounded-xl border border-border-soft bg-panel/70 pl-10 pr-3 text-sm text-text-main placeholder:text-text-soft focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/15" onChange={(event) => setSearch(event.target.value)} placeholder="Search settings…" type="search" value={search} />
      </label>

      <section className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-panel/45 p-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex items-center gap-2 text-xs text-text-muted"><ShieldCheck aria-hidden="true" className="size-4 text-brand-teal" /><span>{dirty ? 'You have unsaved changes.' : 'All settings are up to date.'}</span></div>
        <div className="grid gap-2 sm:flex">
          <Button className="w-full sm:w-auto" disabled={!dirty || mutation.isPending} onClick={discardChanges} type="button" variant="secondary"><RotateCcw aria-hidden="true" className="size-4" />Discard changes</Button>
          <Button className="w-full sm:w-auto" disabled={!dirty || mutation.isPending || !draft.workspaceName.trim()} onClick={() => mutation.mutate(draft)} type="button" variant="primary"><Save aria-hidden="true" className="size-4" />{mutation.isPending ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </section>

      {cards.length ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-12">
          {cards.map((card) => <SettingsCard card={card} connectedPlatforms={card.id === 'connected_accounts' ? connectedPlatforms : []} key={card.id} onAction={(selected) => void cardAction(selected)} onChange={changeSetting} />)}
        </div>
      ) : (
        <section className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-border-soft bg-panel/35 p-8 text-center"><div><strong className="text-base">No settings found</strong><p className="mt-2 text-sm text-text-muted">Try a different search term.</p></div></section>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-[linear-gradient(135deg,rgba(15,36,52,.72),rgba(7,24,38,.82))] p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand-teal/20 bg-brand-teal/8 text-brand-teal"><LockKeyhole aria-hidden="true" className="size-5" /></span><div><strong>Your settings are private and only visible to you.</strong><p className="mt-1 text-xs text-text-muted">Changes are applied only after you choose Save changes. Connected account credentials are never shown here.</p></div></div>
        <div className="flex flex-wrap gap-3 text-xs"><a className="text-brand-cyan hover:underline focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/privacy.html">Privacy policy</a><a className="text-brand-cyan hover:underline focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/data-deletion.html">Data deletion</a></div>
      </section>

      <span className="sr-only" aria-live="polite">{sync.latestSync ? `Connections last synced ${new Date(sync.latestSync).toLocaleString()}.` : ''}</span>
      {notice && <div aria-live="polite" className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl ${notice.tone === 'success' ? 'border-brand-teal/35 bg-[#08251f]/95 text-white' : 'border-brand-red/35 bg-[#30131b]/95 text-white'}`}><span className={`grid size-6 place-items-center rounded-full ${notice.tone === 'success' ? 'bg-brand-teal' : 'bg-brand-red'}`}><Check aria-hidden="true" className="size-4" /></span>{notice.message}</div>}
    </div>
  )
}
