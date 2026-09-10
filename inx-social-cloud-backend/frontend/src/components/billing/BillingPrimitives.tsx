import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, LockKeyhole, X } from 'lucide-react'
import type { InvoiceStatus, SubscriptionStatus } from '../../types/billing'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-panel border border-border-soft bg-[linear-gradient(145deg,rgba(10,32,43,.88),rgba(5,21,31,.92))] shadow-[0_20px_55px_rgba(0,0,0,.22),inset_0_1px_rgba(255,255,255,.035)] backdrop-blur-xl ${className}`}>{children}</section>
}

export function Button({ children, className = '', tone = 'secondary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; tone?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const tones = { primary: 'border-brand-teal/60 bg-brand-teal text-[#02130f] hover:bg-brand-cyan', secondary: 'border-border-strong bg-panel-soft/70 text-white hover:bg-panel-hover', danger: 'border-brand-red/50 bg-brand-red/12 text-[#fda4af] hover:bg-brand-red/22', ghost: 'border-transparent bg-transparent text-text-muted hover:bg-white/5 hover:text-white' }
  return <button className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 motion-reduce:transform-none ${tones[tone]} ${className}`} {...props}>{children}</button>
}

export function Toggle({ checked, label, onChange, disabled = false }: { checked: boolean; label: string; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <button aria-checked={checked} aria-label={label} className={`relative h-7 w-12 shrink-0 rounded-full border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan ${checked ? 'border-brand-teal bg-brand-teal' : 'border-border-strong bg-bg/70'} disabled:opacity-45`} disabled={disabled} onClick={() => onChange(!checked)} role="switch" type="button"><span className={`absolute top-1 size-[18px] rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} /></button>
}

export function ProgressBar({ label, value, max }: { label: string; value: number; max: number }) {
  const percent = Math.min(100, Math.round((value / Math.max(1, max)) * 100))
  return <div aria-label={`${label}: ${value} of ${max}`} aria-valuemax={max} aria-valuemin={0} aria-valuenow={value} role="progressbar"><div className="h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-brand-teal to-brand-green transition-all" style={{ width: `${percent}%` }} /></div></div>
}

export function StatusBadge({ status }: { status: SubscriptionStatus | InvoiceStatus }) {
  const good = ['active', 'trialing', 'paid', 'manual'].includes(status)
  const warning = ['past_due', 'upcoming', 'paused'].includes(status)
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${good ? 'border-brand-green/25 bg-brand-green/10 text-[#4ade80]' : warning ? 'border-brand-amber/25 bg-brand-amber/10 text-[#fbbf24]' : 'border-brand-red/25 bg-brand-red/10 text-[#fb7185]'}`}><span className="size-1.5 rounded-full bg-current" />{status.replace('_', ' ')}</span>
}

export function FeatureAvailabilityRow({ children, available, detail }: { children: ReactNode; available: boolean; detail?: string }) {
  return <div className="flex items-start justify-between gap-3 border-b border-border-soft py-3 last:border-0"><div className="min-w-0"><div className={available ? 'text-sm text-text-main' : 'text-sm text-text-soft'}>{children}</div>{detail && <p className="mt-1 text-xs text-text-muted">{detail}</p>}</div><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${available ? 'border-brand-green/25 bg-brand-green/10 text-[#4ade80]' : 'border-white/10 bg-white/5 text-text-soft'}`}>{available ? 'Included' : 'Locked'}</span></div>
}

type OverlayProps = { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; drawer?: boolean }
export function Overlay({ open, title, onClose, children, footer, drawer = false }: OverlayProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    const timer = window.setTimeout(() => focusable()[0]?.focus(), 0)
    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = previous
      window.removeEventListener('keydown', handleKey)
      previousFocus.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(<div className={`fixed inset-0 z-[100] flex bg-[#01070d]/82 p-3 backdrop-blur-md ${drawer ? 'justify-end' : 'items-center justify-center sm:p-6'}`} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}><section aria-labelledby="billing-overlay-title" aria-modal="true" className={`flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden border border-brand-cyan/30 bg-panel shadow-[0_35px_130px_rgba(0,0,0,.72),0_0_70px_rgba(20,184,166,.12)] ${drawer ? 'h-full max-w-lg rounded-panel' : 'max-w-3xl rounded-panel'}`} ref={dialogRef} role="dialog"><header className="flex items-center justify-between gap-4 border-b border-border-soft p-5"><h2 className="text-lg font-semibold" id="billing-overlay-title">{title}</h2><button aria-label={`Close ${title}`} className="rounded-lg border border-border-soft p-2 text-text-muted hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={onClose} type="button"><X aria-hidden="true" className="size-4" /></button></header><div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5">{children}</div>{footer && <footer className="flex flex-col-reverse gap-2 border-t border-border-soft bg-bg/35 p-4 sm:flex-row sm:justify-end">{footer}</footer>}</section></div>, document.body)
}

export const Modal = Overlay
export function Drawer(props: Omit<OverlayProps, 'drawer'>) { return <Overlay {...props} drawer /> }

export function Availability({ available, children }: { available: boolean; children: ReactNode }) {
  return <div className={`flex items-start gap-2 text-sm ${available ? 'text-text-main' : 'text-text-soft'}`}>{available ? <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-teal" /> : <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}<span>{children}</span></div>
}
