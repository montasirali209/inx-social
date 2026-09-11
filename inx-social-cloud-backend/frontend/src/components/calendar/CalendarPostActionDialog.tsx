import { CalendarClock, Trash2, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Button } from '../ui/Button'
import type { CalendarPost } from '../../types/calendar'

type Props = {
  action: 'reschedule' | 'delete'
  post: CalendarPost | null
  date: string
  time: string
  busy: boolean
  error: string | null
  onDate: (value: string) => void
  onTime: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}

export function CalendarPostActionDialog({ action, post, date, time, busy, error, onDate, onTime, onClose, onConfirm }: Props) {
  if (!post) return null
  const deleting = action === 'delete'
  return createPortal(<div className="fixed inset-0 z-[100] grid place-items-center bg-[#01070d]/85 p-4 backdrop-blur-md" onMouseDown={event => { if (event.currentTarget === event.target && !busy) onClose() }}>
    <section aria-labelledby="calendar-action-title" aria-modal="true" className="w-full max-w-md rounded-panel border border-brand-cyan/30 bg-panel p-5 shadow-[0_35px_130px_rgba(0,0,0,.72)]" role="dialog">
      <header className="flex items-start gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl border ${deleting ? 'border-brand-red/25 bg-brand-red/10 text-brand-red' : 'border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan'}`}>{deleting ? <Trash2 className="size-5" /> : <CalendarClock className="size-5" />}</span>
        <div className="min-w-0 flex-1"><small className="font-semibold uppercase tracking-[.12em] text-text-soft">{post.pageName}</small><h2 className="mt-1 text-lg font-semibold" id="calendar-action-title">{deleting ? 'Delete scheduled content?' : 'Choose a new schedule'}</h2><p className="mt-1 truncate text-xs text-text-muted">{post.title}</p></div>
        <button aria-label="Close" className="grid size-9 place-items-center rounded-lg text-text-muted hover:bg-white/5" disabled={busy} onClick={onClose} type="button"><X className="size-4" /></button>
      </header>
      {deleting ? <p className="mt-5 rounded-xl border border-brand-red/20 bg-brand-red/7 p-3 text-xs leading-5 text-text-muted">This removes the post from Facebook and from the INXSocial calendar. This cannot be undone.</p> : <div className="mt-5 grid grid-cols-2 gap-3"><label className="text-[10px] font-semibold text-text-muted">Date<input autoFocus className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-bg/45 px-3 text-sm text-white outline-none focus:border-brand-cyan" min={new Date().toISOString().slice(0, 10)} onChange={event => onDate(event.target.value)} type="date" value={date} /></label><label className="text-[10px] font-semibold text-text-muted">Time<input className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-bg/45 px-3 text-sm text-white outline-none focus:border-brand-cyan" onChange={event => onTime(event.target.value)} type="time" value={time} /></label><p className="col-span-2 text-[10px] leading-4 text-text-soft">Facebook requires enough lead time before publishing. INXSocial validates the selected time before applying it.</p></div>}
      {error && <p className="mt-3 rounded-xl border border-brand-red/25 bg-brand-red/8 px-3 py-2 text-[11px] text-brand-red">{error}</p>}
      <footer className="mt-5 grid grid-cols-2 gap-2"><Button disabled={busy} onClick={onClose} type="button" variant="secondary">Cancel</Button><Button disabled={busy || (!deleting && (!date || !time))} onClick={onConfirm} type="button" variant="primary">{busy ? 'Updating…' : deleting ? 'Delete everywhere' : 'Save new time'}</Button></footer>
    </section>
  </div>, document.body)
}
