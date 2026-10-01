import { BookmarkPlus, Check, ChevronDown, Clock3, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  times: string[]
  disabled: boolean
  onAdd: (time: string) => void
  onRemove: (time: string) => void
  savedTimes: string[]
  onSaveForFuture: () => Promise<void>
}

type Meridiem = 'AM' | 'PM'

// Bulk Scheduler time picker uses 12-hour presentation while preserving 24-hour storage.

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1)
const MINUTES = Array.from({ length: 60 }, (_, index) => index)
const PERIODS: Meridiem[] = ['AM', 'PM']

function displayBulkTime(time: string) {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  const period: Meridiem = hours >= 12 ? 'PM' : 'AM'
  const hour = hours % 12 || 12
  return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`
}

function to24Hour(hour: number, minute: number, period: Meridiem) {
  const hours = period === 'AM' ? hour % 12 : (hour % 12) + 12
  return `${String(hours).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function from24Hour(value: string) {
  const [hours = 14, minute = 0] = value.split(':').map(Number)
  return {
    hour: hours % 12 || 12,
    minute: Number.isFinite(minute) ? minute : 0,
    period: (hours >= 12 ? 'PM' : 'AM') as Meridiem,
  }
}

function WheelColumn<T extends string | number>({
  ariaLabel,
  options,
  value,
  render,
  onChange,
}: {
  ariaLabel: string
  options: T[]
  value: T
  render: (value: T) => string
  onChange: (value: T) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const rowHeight = 36
  const selectedIndex = Math.max(0, options.findIndex((item) => item === value))
  const scrollFrame = useRef<number | null>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const target = selectedIndex * rowHeight
    if (Math.abs(node.scrollTop - target) > 2) node.scrollTo({ top: target, behavior: 'smooth' })
  }, [selectedIndex])

  useEffect(() => () => {
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current)
  }, [])

  return (
    <div className="relative min-w-0 flex-1">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-1 top-9 z-10 h-9 rounded-xl border border-brand-cyan/20 bg-brand-cyan/[.055] shadow-[inset_0_1px_rgba(255,255,255,.85)]" />
      <div
        aria-label={ariaLabel}
        className="h-[108px] snap-y snap-mandatory overflow-y-auto scroll-smooth overscroll-contain rounded-2xl border border-border-soft bg-white px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(event) => {
          const node = event.currentTarget
          if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current)
          scrollFrame.current = requestAnimationFrame(() => {
            const index = Math.max(0, Math.min(options.length - 1, Math.round(node.scrollTop / rowHeight)))
            const next = options[index]
            if (next !== undefined && next !== value) onChange(next)
          })
        }}
        ref={ref}
        role="listbox"
        tabIndex={0}
      >
        <div aria-hidden="true" className="h-9" />
        {options.map((option) => {
          const active = option === value
          return (
            <button
              aria-selected={active}
              className={`relative z-20 flex h-9 w-full snap-center items-center justify-center rounded-lg text-xs font-semibold transition ${active ? 'text-brand-cyan' : 'text-text-muted hover:text-text-main'}`}
              key={String(option)}
              onClick={() => onChange(option)}
              role="option"
              type="button"
            >
              {render(option)}
            </button>
          )
        })}
        <div aria-hidden="true" className="h-9" />
      </div>
    </div>
  )
}

export function DailyTimeSelector({ times, disabled, onAdd, onRemove, savedTimes, onSaveForFuture }: Props) {
  const [draft, setDraft] = useState('14:00')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)
  const allSaved = useMemo(() => times.length > 0 && times.every((time) => savedTimes.includes(time)), [savedTimes, times])
  const parts = useMemo(() => from24Hour(draft), [draft])

  useEffect(() => {
    if (!pickerOpen) return
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (!pickerRef.current?.contains(target)) setPickerOpen(false)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickerOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', key)
    }
  }, [pickerOpen])

  function updateDraft(next: Partial<{ hour: number; minute: number; period: Meridiem }>) {
    setDraft(to24Hour(next.hour ?? parts.hour, next.minute ?? parts.minute, next.period ?? parts.period))
  }

  async function saveForFuture() {
    if (disabled || saving || allSaved || !times.length) return
    setSaving(true)
    setSaveError('')
    try {
      await onSaveForFuture()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'These posting times could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-medium text-text-muted">Daily publishing times</legend>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1" ref={pickerRef}>
          <button
            aria-expanded={pickerOpen}
            aria-haspopup="listbox"
            className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border-soft bg-white px-3 text-left text-sm shadow-[0_4px_14px_rgba(15,23,42,.035)] transition hover:border-brand-cyan/30 focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/20 disabled:cursor-not-allowed disabled:opacity-55"
            disabled={disabled}
            onClick={() => setPickerOpen((current) => !current)}
            type="button"
          >
            <span className="flex items-center gap-2.5"><Clock3 aria-hidden="true" className="size-4 text-text-soft" /><strong className="font-semibold text-text-main">{displayBulkTime(draft)}</strong></span>
            <ChevronDown aria-hidden="true" className={`size-4 text-text-soft transition-transform ${pickerOpen ? 'rotate-180 text-brand-cyan' : ''}`} />
          </button>

          {pickerOpen && (
            <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-full min-w-[280px] rounded-[22px] border border-brand-cyan/20 bg-white p-3 shadow-[0_24px_70px_rgba(15,23,42,.16)]">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div><strong className="block text-[11px] text-text-main">Choose publishing time</strong><span className="mt-0.5 block text-[9px] text-text-soft">Scroll hour, minute and AM/PM.</span></div>
                <span className="rounded-full border border-brand-cyan/20 bg-brand-cyan/[.06] px-2.5 py-1 text-[10px] font-semibold text-brand-cyan">{displayBulkTime(draft)}</span>
              </div>
              <div className="grid grid-cols-[1fr_1fr_.9fr] gap-2">
                <div><span className="mb-1 block text-center text-[8px] font-bold uppercase tracking-[.12em] text-text-soft">Hour</span><WheelColumn ariaLabel="Hour" onChange={(hour) => updateDraft({ hour })} options={HOURS} render={(hour) => String(hour).padStart(2, '0')} value={parts.hour} /></div>
                <div><span className="mb-1 block text-center text-[8px] font-bold uppercase tracking-[.12em] text-text-soft">Minute</span><WheelColumn ariaLabel="Minute" onChange={(minute) => updateDraft({ minute })} options={MINUTES} render={(minute) => String(minute).padStart(2, '0')} value={parts.minute} /></div>
                <div><span className="mb-1 block text-center text-[8px] font-bold uppercase tracking-[.12em] text-text-soft">Period</span><WheelColumn ariaLabel="AM or PM" onChange={(period) => updateDraft({ period })} options={PERIODS} render={(period) => period} value={parts.period} /></div>
              </div>
              <button className="mt-3 min-h-9 w-full rounded-xl bg-brand-cyan px-3 text-[10px] font-bold text-white transition hover:brightness-105" onClick={() => setPickerOpen(false)} type="button">Use {displayBulkTime(draft)}</button>
            </div>
          )}
        </div>

        <button className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-brand-cyan/35 bg-brand-cyan/10 px-3 text-xs font-semibold text-brand-cyan transition hover:bg-brand-cyan/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan disabled:cursor-not-allowed disabled:opacity-40" disabled={disabled || !draft || times.includes(draft)} onClick={() => { onAdd(draft); setPickerOpen(false) }} type="button"><Plus aria-hidden="true" className="size-4" /> Add</button>
      </div>

      <div aria-label="Selected daily publishing times" className="mt-2 flex min-h-8 flex-wrap gap-1.5">
        {times.map((time) => (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-teal/30 bg-brand-teal/10 py-1 pl-2.5 pr-1 text-[11px] font-semibold text-brand-cyan" key={time}>
            {displayBulkTime(time)}
            <button aria-label={`Remove ${displayBulkTime(time)}`} className="grid size-6 place-items-center rounded-full transition hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-brand-cyan" disabled={disabled} onClick={() => onRemove(time)} type="button"><X aria-hidden="true" className="size-3.5" /></button>
          </span>
        ))}
        {!times.length && <span className="self-center text-[11px] text-brand-amber">Add at least one time.</span>}
      </div>

      <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] leading-4 text-text-soft">Files fill these times in order each day, then continue on the next day.</p>
        <button
          className={`inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 text-[10px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan disabled:cursor-not-allowed disabled:opacity-55 ${allSaved ? 'border-brand-green/20 bg-brand-green/[.06] text-brand-green' : 'border-brand-cyan/25 bg-brand-cyan/[.06] text-brand-cyan hover:bg-brand-cyan/10'}`}
          disabled={disabled || saving || allSaved || !times.length}
          onClick={() => void saveForFuture()}
          type="button"
        >
          {allSaved ? <Check aria-hidden="true" className="size-3.5" /> : <BookmarkPlus aria-hidden="true" className="size-3.5" />}
          {saving ? 'Saving…' : allSaved ? 'Saved for future' : 'Save times for future'}
        </button>
      </div>
      <p className="mt-1 text-[9px] leading-4 text-text-soft">Saving adds these custom times to your reusable Scheduler times without removing existing saved times.</p>
      {saveError && <p className="mt-1 text-[10px] leading-4 text-brand-red">{saveError}</p>}
    </fieldset>
  )
}
