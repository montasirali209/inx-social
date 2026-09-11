import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Sparkles } from 'lucide-react'

export type StudioSelectOption<T extends string | number> = {
  value: T
  label: string
  description?: string
  meta?: string
  icon?: ReactNode
}

type MenuPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
  openUp: boolean
}

export function StudioSelect<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  accent = 'cyan',
}: {
  label?: string
  value: T
  options: StudioSelectOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  accent?: 'cyan' | 'green' | 'amber' | 'violet'
}) {
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value) || options[0]
  const accentClass = accent === 'green'
    ? 'border-brand-green/35 shadow-[0_12px_38px_rgba(40,210,153,.08)]'
    : accent === 'amber'
      ? 'border-amber-300/30 shadow-[0_12px_38px_rgba(251,191,36,.08)]'
      : accent === 'violet'
        ? 'border-violet-300/30 shadow-[0_12px_38px_rgba(167,139,250,.08)]'
        : 'border-brand-cyan/30 shadow-[0_12px_38px_rgba(0,214,192,.08)]'

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth
    const gap = 8
    const safeEdge = 10
    const spaceBelow = viewportHeight - rect.bottom - safeEdge
    const spaceAbove = rect.top - safeEdge
    const desiredHeight = Math.min(292, Math.max(164, options.length * 58 + 16))
    const openUp = spaceBelow < Math.min(desiredHeight, 230) && spaceAbove > spaceBelow
    const available = Math.max(132, (openUp ? spaceAbove : spaceBelow) - gap)
    const width = Math.min(rect.width, viewportWidth - safeEdge * 2)
    const left = Math.max(safeEdge, Math.min(rect.left, viewportWidth - width - safeEdge))
    setMenuPosition({
      top: openUp ? rect.top - gap : rect.bottom + gap,
      left,
      width,
      maxHeight: Math.min(desiredHeight, available),
      openUp,
    })
  }, [options.length])

  useEffect(() => {
    if (!open) return
    updatePosition()
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const reposition = () => updatePosition()
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', key)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', key)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open, updatePosition])

  if (!selected) return null

  const menu = open && menuPosition ? <div
    ref={menuRef}
    role="listbox"
    className="fixed z-[1000] overflow-hidden rounded-[20px] border border-brand-cyan/25 bg-[linear-gradient(155deg,rgba(8,31,44,.995),rgba(2,13,21,.995))] p-1.5 shadow-[0_28px_90px_rgba(0,0,0,.68),0_0_42px_rgba(0,214,192,.08)] backdrop-blur-2xl"
    style={{
      top: menuPosition.top,
      left: menuPosition.left,
      width: menuPosition.width,
      maxHeight: menuPosition.maxHeight,
      transform: menuPosition.openUp ? 'translateY(-100%)' : undefined,
    }}
  >
    <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/55 to-transparent" />
    <div className="h-full max-h-[inherit] overflow-y-auto overscroll-contain p-0.5">
      {options.map((option) => {
        const active = option.value === value
        return <button
          type="button"
          role="option"
          aria-selected={active}
          key={String(option.value)}
          onClick={() => { onChange(option.value); setOpen(false) }}
          className={`group/option mb-1 flex w-full items-start gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-all duration-200 last:mb-0 ${active ? 'border-brand-cyan/30 bg-brand-cyan/[.08] shadow-[inset_0_1px_rgba(255,255,255,.04)]' : 'border-transparent hover:translate-x-0.5 hover:border-white/7 hover:bg-white/[.04]'}`}
        >
          <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-xl border ${active ? 'border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan' : 'border-white/7 bg-white/[.025] text-text-muted'}`}>{option.icon || <Sparkles className="size-3.5" />}</span>
          <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><strong className="truncate text-[10px] font-semibold text-white">{option.label}</strong>{active && <Check className="size-3.5 shrink-0 text-brand-green" />}</span>{option.description && <span className="mt-0.5 block text-[8px] leading-4 text-text-muted">{option.description}</span>}{option.meta && <span className="mt-1 block text-[7px] font-semibold uppercase tracking-[.09em] text-text-soft">{option.meta}</span>}</span>
        </button>
      })}
    </div>
  </div> : null

  return <div ref={rootRef} className="relative min-w-0">
    {label && <span className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[.13em] text-text-soft">{label}</span>}
    <button
      ref={triggerRef}
      type="button"
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={() => setOpen((current) => !current)}
      className={`group relative flex min-h-11 w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border bg-[linear-gradient(145deg,rgba(9,34,48,.95),rgba(3,17,27,.96))] px-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45 ${open ? `${accentClass} -translate-y-0.5 scale-[1.01]` : 'border-border-soft hover:border-brand-cyan/25'}`}
    >
      <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-70" />
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-xl border border-white/8 bg-white/[.035] text-brand-cyan transition-transform duration-300 group-hover:scale-110">{selected.icon || <Sparkles className="size-3.5" />}</span>
        <span className="min-w-0"><strong className="block truncate text-[10px] font-semibold text-white">{selected.label}</strong>{selected.meta && <span className="block truncate text-[8px] text-text-soft">{selected.meta}</span>}</span>
      </span>
      <ChevronDown className={`size-3.5 shrink-0 text-text-soft transition-transform duration-300 ${open ? 'rotate-180 text-brand-cyan' : ''}`} />
    </button>
    {typeof document !== 'undefined' && menu ? createPortal(menu, document.body) : null}
  </div>
}
