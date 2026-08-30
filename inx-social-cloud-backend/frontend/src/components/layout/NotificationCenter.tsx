import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Check,
  CheckCheck,
  Clock3,
  PlugZap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { StudioOverview } from '../../types/dashboard'

type NotificationTone = 'danger' | 'warning' | 'info' | 'success'

type WorkspaceNotification = {
  id: string
  title: string
  description: string
  href: string
  count: number
  tone: NotificationTone
  icon: typeof Bell
}

const readStorageKey = 'inx-social-notification-fingerprint'

const toneStyles: Record<NotificationTone, string> = {
  danger: 'border-red-400/20 bg-red-500/8 text-red-300',
  warning: 'border-amber-300/20 bg-amber-400/8 text-amber-200',
  info: 'border-blue-300/20 bg-blue-400/8 text-blue-200',
  success: 'border-teal-300/20 bg-teal-400/8 text-teal-200',
}

function workspaceNotifications(overview?: StudioOverview): WorkspaceNotification[] {
  if (!overview) return []
  const notices: WorkspaceNotification[] = []
  const activeWork = overview.summary.queued + overview.summary.processing
  const reconnects = overview.pages.filter((page) => page.status !== 'ACTIVE').length

  if (overview.summary.failed > 0) {
    notices.push({
      id: 'publishing-failed',
      title: 'Publishing needs attention',
      description: `${overview.summary.failed} item${overview.summary.failed === 1 ? '' : 's'} failed and should be reviewed.`,
      href: '/studio/?view=posts',
      count: overview.summary.failed,
      tone: 'danger',
      icon: AlertTriangle,
    })
  }
  if (activeWork > 0) {
    notices.push({
      id: 'publishing-active',
      title: 'Publishing is in progress',
      description: `${activeWork} item${activeWork === 1 ? '' : 's'} queued or currently processing.`,
      href: '/app/bulk-scheduler',
      count: activeWork,
      tone: 'info',
      icon: Clock3,
    })
  }
  if (overview.summary.scheduled > 0) {
    notices.push({
      id: 'content-scheduled',
      title: 'Content is scheduled',
      description: `${overview.summary.scheduled} upcoming item${overview.summary.scheduled === 1 ? '' : 's'} in your calendar.`,
      href: '/app/content-calendar',
      count: overview.summary.scheduled,
      tone: 'success',
      icon: CalendarClock,
    })
  }
  if (reconnects > 0) {
    notices.push({
      id: 'connections-required',
      title: 'Account connection required',
      description: `${reconnects} connected account${reconnects === 1 ? '' : 's'} need to be reconnected.`,
      href: '/studio/?view=pages',
      count: reconnects,
      tone: 'warning',
      icon: PlugZap,
    })
  }

  return notices
}

export function NotificationCenter({ overview }: { overview?: StudioOverview }) {
  const notices = useMemo(() => workspaceNotifications(overview), [overview])
  const fingerprint = notices.map((notice) => `${notice.id}:${notice.count}`).join('|')
  const [open, setOpen] = useState(false)
  const [readFingerprint, setReadFingerprint] = useState(() => (
    typeof window === 'undefined' ? '' : window.localStorage.getItem(readStorageKey) || ''
  ))
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const unreadCount = fingerprint && fingerprint !== readFingerprint ? notices.length : 0

  useEffect(() => {
    if (!open) return
    function closeOnOutsidePress(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  function markAllRead() {
    window.localStorage.setItem(readStorageKey, fingerprint)
    setReadFingerprint(fingerprint)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-controls="workspace-notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unreadCount ? `Open notifications, ${unreadCount} unread` : 'Open notifications'}
        className="group relative grid size-10 place-items-center rounded-xl border border-border-soft bg-panel/70 text-text-muted transition duration-200 hover:-translate-y-0.5 hover:border-brand-cyan/40 hover:bg-panel-hover/80 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan motion-reduce:transform-none motion-reduce:transition-none"
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <Bell aria-hidden="true" className={`size-[18px] transition duration-200 ${unreadCount ? 'text-brand-cyan group-hover:rotate-6' : ''} motion-reduce:transition-none`} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-bg bg-brand-red px-1 text-[9px] font-extrabold leading-none text-white shadow-[0_0_14px_rgba(239,68,68,.65)]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <section
          aria-label="Notifications"
          className="notification-pop fixed inset-x-3 top-[72px] z-50 overflow-hidden rounded-2xl border border-brand-cyan/20 bg-[linear-gradient(145deg,rgba(7,25,35,.99),rgba(3,13,23,.99))] shadow-[0_30px_90px_rgba(0,0,0,.58),0_0_45px_rgba(20,184,166,.10)] backdrop-blur-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[min(360px,calc(100vw-2rem))]"
          id="workspace-notifications"
          role="dialog"
        >
          <header className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-text-main">Notifications</h2>
              <p className="mt-0.5 text-[11px] text-text-soft">{unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'You are up to date'}</p>
            </div>
            {unreadCount > 0 ? (
              <button className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold text-brand-cyan transition hover:bg-brand-cyan/8 focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={markAllRead} type="button">
                <CheckCheck aria-hidden="true" className="size-3.5" /> Mark all read
              </button>
            ) : null}
          </header>

          <div className="max-h-[min(430px,65vh)] space-y-2 overflow-y-auto p-3 scrollbar-thin">
            {!overview ? (
              <div aria-label="Loading notifications" className="space-y-2" role="status">
                {Array.from({ length: 3 }, (_, index) => <div className="h-[74px] animate-pulse rounded-xl bg-white/[.04] motion-reduce:animate-none" key={index} />)}
              </div>
            ) : notices.length ? notices.map((notice) => {
              const Icon = notice.icon
              return (
                <a className="group flex items-start gap-3 rounded-xl border border-transparent p-2.5 transition duration-200 hover:border-brand-cyan/15 hover:bg-white/[.035] focus-visible:outline-2 focus-visible:outline-brand-cyan motion-reduce:transition-none" href={notice.href} key={notice.id} onClick={() => setOpen(false)}>
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl border ${toneStyles[notice.tone]}`}><Icon aria-hidden="true" className="size-[18px]" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3"><strong className="text-xs text-text-main">{notice.title}</strong><span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-text-muted">{notice.count}</span></span>
                    <span className="mt-1 block text-[11px] leading-4 text-text-muted">{notice.description}</span>
                    <span className="mt-1.5 block text-[10px] font-semibold text-brand-cyan opacity-80 transition group-hover:opacity-100">Open details →</span>
                  </span>
                </a>
              )
            }) : (
              <div className="grid min-h-44 place-items-center px-5 py-8 text-center">
                <div>
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-teal-300/20 bg-teal-400/8 text-teal-300"><Check aria-hidden="true" className="size-5" /></span>
                  <h3 className="mt-3 text-sm font-semibold text-text-main">All caught up</h3>
                  <p className="mt-1 text-xs leading-5 text-text-muted">New publishing, scheduling, and connection updates will appear here.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}
