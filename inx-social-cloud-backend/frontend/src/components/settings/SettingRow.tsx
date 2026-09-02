import { ChevronDown, Plus, X } from 'lucide-react'
import { useState } from 'react'
import type { SettingRow as SettingRowData, SettingsValues } from '../../types/settings'

type Props = {
  row: SettingRowData
  onChange: (key: keyof SettingsValues, value: string | boolean | string[]) => void
}

export function SettingToggle({ checked, id, label, onChange }: { checked: boolean; id: string; label: string; onChange: (checked: boolean) => void }) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border p-0.5 transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan ${checked ? 'border-brand-teal/60 bg-brand-teal shadow-[0_0_20px_rgba(20,184,166,.18)]' : 'border-border-strong bg-panel-soft'}`}
      id={id}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span className={`size-5 rounded-full bg-white shadow transition duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

function SettingTimes({ id, label, value, onChange }: { id: string; label: string; value: string[]; onChange: (times: string[]) => void }) {
  const [candidate, setCandidate] = useState(value.at(-1) || '10:00')
  const add = () => {
    if (!/^\d{2}:\d{2}$/.test(candidate) || value.includes(candidate) || value.length >= 12) return
    onChange([...value, candidate].sort())
  }
  return (
    <div aria-labelledby={`${id}-label`} className="grid gap-2">
      <div className="flex gap-2">
        <input aria-label={`Add ${label.toLowerCase()}`} className="min-h-10 min-w-0 flex-1 rounded-xl border border-border-soft bg-bg/45 px-3 text-sm text-text-main focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/15" id={id} onChange={(event) => setCandidate(event.target.value)} type="time" value={candidate} />
        <button aria-label={`Add ${candidate}`} className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand-teal/30 bg-brand-teal/10 text-brand-teal transition hover:bg-brand-teal/20 focus-visible:outline-2 focus-visible:outline-brand-cyan disabled:cursor-not-allowed disabled:opacity-40" disabled={value.includes(candidate) || value.length >= 12} onClick={add} type="button"><Plus className="size-4" /></button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {value.map((time) => <span className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-brand-teal/20 bg-brand-teal/8 pl-2.5 pr-1 text-xs font-semibold text-brand-cyan" key={time}>{time}<button aria-label={`Remove ${time}`} className="grid size-6 place-items-center rounded-md transition hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-brand-cyan disabled:cursor-not-allowed disabled:opacity-30" disabled={value.length === 1} onClick={() => onChange(value.filter((item) => item !== time))} title={value.length === 1 ? 'Keep at least one default time' : `Remove ${time}`} type="button"><X className="size-3" /></button></span>)}
      </div>
      <span className="text-[10px] text-text-soft">Add up to 12 times. At least one time is required.</span>
    </div>
  )
}

export function SettingRow({ row, onChange }: Props) {
  const key = row.id as keyof SettingsValues
  const controlClasses = 'min-h-10 w-full rounded-xl border border-border-soft bg-bg/45 px-3 text-sm text-text-main transition hover:border-brand-teal/35 focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/15'

  return (
    <div className="grid gap-3 border-t border-border-soft/70 py-3.5 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,46%)] sm:items-center">
      <div className="min-w-0">
        {row.type === 'input' || row.type === 'select' || row.type === 'toggle'
          ? <label className="text-sm font-medium text-text-main" htmlFor={row.id}>{row.label}</label>
          : <span className="text-sm font-medium text-text-main" id={`${row.id}-label`}>{row.label}</span>}
        {row.description && <p className="mt-1 text-[11px] leading-4 text-text-muted">{row.description}</p>}
      </div>

      {row.type === 'input' && (
        <input
          className={controlClasses}
          id={row.id}
          maxLength={80}
          name={row.id}
          onChange={(event) => onChange(key, event.target.value)}
          value={String(row.value)}
        />
      )}

      {row.type === 'select' && (
        <div className="relative">
          <select className={`${controlClasses} appearance-none pr-9`} id={row.id} onChange={(event) => onChange(key, event.target.value)} value={String(row.value)}>
            {(row.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
        </div>
      )}

      {row.type === 'toggle' && <div className="flex justify-end sm:justify-self-end"><SettingToggle checked={Boolean(row.value)} id={row.id} label={row.label} onChange={(value) => onChange(key, value)} /></div>}

      {row.type === 'times' && <SettingTimes id={row.id} label={row.label} onChange={(value) => onChange(key, value)} value={Array.isArray(row.value) ? row.value : []} />}

      {row.type === 'summary' && <strong className="min-w-0 break-words text-left text-sm font-semibold text-text-main sm:text-right">{String(row.value)}</strong>}

      {row.type === 'progress' && (
        <div className="grid gap-2">
          <div className="flex items-center justify-between text-xs"><span className="text-text-muted">{row.description}</span><strong>{Number(row.value)}%</strong></div>
          <div aria-label={`${row.label}: ${row.value}%`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={Number(row.value)} className="h-2 overflow-hidden rounded-full bg-white/7" role="progressbar">
            <span className="block h-full rounded-full bg-gradient-to-r from-brand-teal to-brand-green transition-[width]" style={{ width: `${Number(row.value)}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}
