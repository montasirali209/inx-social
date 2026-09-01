import { Activity, ExternalLink, Square } from 'lucide-react'
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { BatchProgress } from '../../types/bulk-scheduler'
import { BulkActivityContext, useBulkSchedulerActivity, type BulkActivityContextValue } from './bulk-scheduler-activity-store'

const initialActivity: BatchProgress = { state: 'idle', percent: 0, current: 0, total: 0, completed: 0, failed: 0, message: '' }

export function BulkSchedulerActivityProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState(initialActivity)
  const stopRef = useRef<(() => void) | null>(null)
  const registerStop = useCallback((handler: (() => void) | null) => { stopRef.current = handler }, [])
  const stop = useCallback(() => stopRef.current?.(), [])
  const value = useMemo<BulkActivityContextValue>(() => ({
    progress,
    running: ['preparing', 'uploading', 'scheduling'].includes(progress.state),
    update: setProgress,
    registerStop,
    stop,
  }), [progress, registerStop, stop])
  return <BulkActivityContext.Provider value={value}>{children}</BulkActivityContext.Provider>
}

export function BulkRunDock() {
  const { progress, running, stop } = useBulkSchedulerActivity()
  if (!running) return null
  return (
    <aside aria-label="Active Bulk Scheduler upload" aria-live="polite" className="notification-pop fixed bottom-4 right-4 z-[70] w-[min(420px,calc(100vw-2rem))] rounded-2xl border border-brand-cyan/35 bg-panel/95 p-3 shadow-[0_24px_80px_rgba(0,0,0,.55),0_0_40px_rgba(20,184,166,.14)] backdrop-blur-xl">
      <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><Activity className="size-4 animate-pulse motion-reduce:animate-none" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><strong className="text-xs">Bulk Scheduler is running</strong><span className="text-[10px] font-semibold text-brand-cyan">{Math.round(progress.percent)}%</span></div><p className="mt-1 truncate text-[10px] text-text-muted">{progress.message}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/7"><span className="block h-full rounded-full bg-gradient-to-r from-brand-green to-brand-cyan transition-[width]" style={{ width: `${Math.max(2, progress.percent)}%` }} /></div><p className="mt-1 text-[9px] text-text-soft">{progress.current}/{progress.total} actions · {progress.completed} completed · {progress.failed} failed</p></div></div>
      <div className="mt-3 flex gap-2"><Link className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 px-3 text-[10px] font-semibold text-brand-cyan transition hover:bg-brand-cyan/15 focus-visible:outline-2 focus-visible:outline-brand-cyan" to="/bulk-scheduler"><ExternalLink className="size-3.5" />View batch</Link><button className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-brand-red/30 bg-brand-red/8 px-3 text-[10px] font-semibold text-brand-red transition hover:bg-brand-red/15 focus-visible:outline-2 focus-visible:outline-brand-red" onClick={stop} type="button"><Square className="size-3 fill-current" />Stop</button></div>
    </aside>
  )
}
