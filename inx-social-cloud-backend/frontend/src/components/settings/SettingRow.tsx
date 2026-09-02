import { ChevronDown } from 'lucide-react'
import type { SettingRow as SettingRowData, SettingsValues } from '../../types/settings'

type Props = {
  row: SettingRowData
  onChange: (key: keyof SettingsValues, value: string | boolean) => void
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

export function SettingRow({ row, onChange }: Props) {
  const key = row.id as keyof SettingsValues
  const controlClasses = 'min-h-10 w-full rounded-xl border border-border-soft bg-bg/45 px-3 text-sm text-text-main transition hover:border-brand-teal/35 focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/15'

  return (
    <div className="grid gap-3 border-t border-border-soft/70 py-3.5 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,46%)] sm:items-center">
      <div className="min-w-0">
        {row.type === 'input' || row.type === 'select' || row.type === 'toggle'
          ? <label className="text-sm font-medium text-text-main" htmlFor={row.id}>{row.label}</label>
          : <span className="text-sm font-medium text-text-main">{row.label}</span>}
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

      {row.type === 'summary' && <strong className="text-left text-sm font-semibold text-text-main sm:text-right">{String(row.value)}</strong>}

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
