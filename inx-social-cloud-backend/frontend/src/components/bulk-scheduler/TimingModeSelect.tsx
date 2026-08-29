import type { TimingMode } from '../../types/bulk-scheduler'

const options: Array<{ value: TimingMode; label: string; disabled?: boolean }> = [
  { value: 'publish_now', label: 'Publish immediately' },
  { value: 'schedule_time', label: 'Schedule from selected date/time' },
  { value: 'next_available_slots', label: 'Use next available slots' },
  { value: 'spread_across_days', label: 'Spread across days' },
  { value: 'best_engagement_time', label: 'Use best engagement time (analytics required)', disabled: true },
]

export function TimingModeSelect({ value, onChange }: { value: TimingMode | ''; onChange: (value: TimingMode) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-text-muted">Timing mode</span>
      <select className="min-h-11 w-full rounded-xl border border-border-soft bg-bg/65 px-3 text-sm text-text-main focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20" onChange={(event) => onChange(event.target.value as TimingMode)} value={value}>
        <option value="">Select timing mode…</option>
        {options.map((option) => <option disabled={option.disabled} key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}
