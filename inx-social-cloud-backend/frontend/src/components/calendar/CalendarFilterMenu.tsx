import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

export type CalendarFilterOption<T extends string> = {
  value: T
  label: string
  description?: string
  icon: ReactNode
}

const tones = {
  platform: {
    eyebrow: 'Platform',
    border: 'border-brand-blue/30 hover:border-brand-blue/60',
    glow: 'shadow-[0_12px_32px_rgba(24,119,242,.08)]',
    active: 'border-brand-blue/35 bg-brand-blue/10',
    check: 'border-brand-blue/45 bg-brand-blue text-white',
  },
  page: {
    eyebrow: 'Destination',
    border: 'border-brand-teal/30 hover:border-brand-teal/60',
    glow: 'shadow-[0_12px_32px_rgba(20,184,166,.08)]',
    active: 'border-brand-teal/35 bg-brand-teal/10',
    check: 'border-brand-teal/45 bg-brand-teal text-[#032018]',
  },
  status: {
    eyebrow: 'Status',
    border: 'border-brand-amber/30 hover:border-brand-amber/60',
    glow: 'shadow-[0_12px_32px_rgba(245,158,11,.08)]',
    active: 'border-brand-amber/35 bg-brand-amber/10',
    check: 'border-brand-amber/45 bg-brand-amber text-[#241403]',
  },
} as const

export function CalendarFilterMenu<T extends string>({ kind, value, options, onChange }: {
  kind: keyof typeof tones
  value: T
  options: CalendarFilterOption<T>[]
  onChange: (value: T) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value) || options[0]
  const tone = tones[kind]

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
    }
  }, [])

  return <div className="relative min-w-[168px] flex-1 md:max-w-[230px]" ref={rootRef}>
    <button
      aria-expanded={open}
      aria-haspopup="listbox"
      className={`group flex min-h-11 w-full items-center gap-2.5 rounded-xl border bg-bg/70 px-2.5 text-left transition hover:-translate-y-0.5 hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-brand-cyan motion-reduce:transform-none ${tone.border} ${tone.glow}`}
      onClick={() => setOpen((current) => !current)}
      type="button"
    >
      {selected.icon}
      <span className="min-w-0 flex-1">
        <span className="block text-[8px] font-bold uppercase tracking-[.14em] text-text-soft">{tone.eyebrow}</span>
        <span className="block truncate text-[11px] font-semibold text-text-main">{selected.label}</span>
      </span>
      <ChevronDown aria-hidden="true" className={`size-3.5 text-text-muted transition ${open ? 'rotate-180' : ''}`} />
    </button>

    {open ? <div className="absolute left-0 top-[calc(100%+.55rem)] z-50 w-full min-w-[250px] rounded-2xl border border-white/10 bg-[#061721]/98 p-2 shadow-[0_28px_80px_rgba(0,0,0,.58)] backdrop-blur-xl" role="listbox">
      <div className="px-2 pb-2 pt-1">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-text-soft">Filter by {tone.eyebrow.toLowerCase()}</p>
      </div>
      <div className="scrollbar-thin max-h-72 space-y-1 overflow-y-auto">
        {options.map((option) => {
          const active = option.value === value
          return <button
            aria-selected={active}
            className={`flex min-h-12 w-full items-center gap-2.5 rounded-xl border px-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-brand-cyan ${active ? tone.active : 'border-transparent hover:border-white/10 hover:bg-white/[.045]'}`}
            key={option.value}
            onClick={() => { onChange(option.value); setOpen(false) }}
            role="option"
            type="button"
          >
            {option.icon}
            <span className="min-w-0 flex-1"><strong className="block truncate text-[11px]">{option.label}</strong>{option.description ? <small className="block truncate text-[9px] text-text-soft">{option.description}</small> : null}</span>
            <span className={`grid size-5 place-items-center rounded-full border ${active ? tone.check : 'border-white/15 text-transparent'}`}><Check aria-hidden="true" className="size-3" /></span>
          </button>
        })}
      </div>
    </div> : null}
  </div>
}
