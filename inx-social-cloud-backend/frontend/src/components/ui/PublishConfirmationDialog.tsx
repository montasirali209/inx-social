import { AlertTriangle, Check, X } from 'lucide-react'
import { Button } from './Button'

type Props = {
  open: boolean
  busy?: boolean
  title: string
  description: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}

export function PublishConfirmationDialog({ open, busy = false, title, description, confirmLabel, onCancel, onConfirm }: Props) {
  if (!open) return null
  return (
    <div aria-labelledby="publish-confirmation-title" aria-modal="true" className="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog">
      <section className="w-full max-w-md rounded-2xl border border-brand-amber/25 bg-[#071923] p-5 shadow-2xl">
        <header className="flex items-start justify-between gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-brand-amber/25 bg-brand-amber/10 text-brand-amber"><AlertTriangle className="size-5" /></span>
          <div className="min-w-0 flex-1"><span className="text-[10px] font-bold uppercase tracking-[.13em] text-brand-amber">Final confirmation</span><h2 className="mt-1 text-lg font-semibold" id="publish-confirmation-title">{title}</h2></div>
          <button aria-label="Close confirmation" className="grid size-9 place-items-center rounded-lg text-text-muted hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand-cyan" disabled={busy} onClick={onCancel} type="button"><X className="size-4" /></button>
        </header>
        <p className="mt-4 text-sm leading-6 text-text-muted">{description}</p>
        <p className="mt-3 rounded-xl border border-brand-teal/15 bg-brand-teal/6 p-3 text-xs leading-5 text-text-muted">Nothing is sent until you confirm this step.</p>
        <footer className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button disabled={busy} onClick={onCancel} type="button" variant="secondary">Go back</Button>
          <Button disabled={busy} onClick={onConfirm} type="button" variant="primary"><Check className="size-4" />{busy ? 'Submitting…' : confirmLabel}</Button>
        </footer>
      </section>
    </div>
  )
}
