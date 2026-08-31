import { Clock3, Plus, X } from 'lucide-react'
import { useState } from 'react'

type Props = {
  times: string[]
  disabled: boolean
  onAdd: (time: string) => void
  onRemove: (time: string) => void
}

function displayTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit' }).format(new Date(2026, 0, 1, hours, minutes))
}

export function DailyTimeSelector({ times, disabled, onAdd, onRemove }: Props) {
  const [draft, setDraft] = useState('14:00')
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-medium text-text-muted">Daily publishing times</legend>
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Add a daily publishing time</span>
          <Clock3 aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-soft" />
          <input className="min-h-11 w-full rounded-xl border border-border-soft bg-bg/65 pl-9 pr-3 text-sm focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/20" disabled={disabled} onChange={(event) => setDraft(event.target.value)} type="time" value={draft} />
        </label>
        <button className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-brand-cyan/35 bg-brand-cyan/10 px-3 text-xs font-semibold text-brand-cyan transition hover:bg-brand-cyan/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan disabled:cursor-not-allowed disabled:opacity-40" disabled={disabled || !draft || times.includes(draft)} onClick={() => onAdd(draft)} type="button"><Plus aria-hidden="true" className="size-4" /> Add</button>
      </div>
      <div aria-label="Selected daily publishing times" className="mt-2 flex min-h-8 flex-wrap gap-1.5">
        {times.map((time) => (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-teal/30 bg-brand-teal/10 py-1 pl-2.5 pr-1 text-[11px] font-semibold text-brand-cyan" key={time}>
            {displayTime(time)}
            <button aria-label={`Remove ${displayTime(time)}`} className="grid size-6 place-items-center rounded-full transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-brand-cyan" disabled={disabled} onClick={() => onRemove(time)} type="button"><X aria-hidden="true" className="size-3.5" /></button>
          </span>
        ))}
        {!times.length && <span className="self-center text-[11px] text-brand-amber">Add at least one time.</span>}
      </div>
      <p className="mt-1 text-[10px] leading-4 text-text-soft">Files fill these times in order each day, then continue on the next day.</p>
    </fieldset>
  )
}
