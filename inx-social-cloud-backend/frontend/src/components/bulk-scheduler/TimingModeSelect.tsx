import type { TimingMode } from '../../types/bulk-scheduler'

const options: Array<{ value: TimingMode; label: string }> = [
  { value: 'publish_now', label: 'Publish immediately' },
  { value: 'schedule_time', label: 'Choose custom date & times' },
  { value: 'saved_schedule', label: 'Use saved posting times' },
]

export function TimingModeSelect({ value, onChange }: { value: TimingMode | ''; onChange: (value: TimingMode) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-text-muted">Publish timing</span>
      <select className="min-h-11 w-full rounded-xl border border-border-soft bg-bg/65 px-3 text-sm text-text-main focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20" onChange={(event) => onChange(event.target.value as TimingMode)} value={value}>
        <option value="">Choose when to publish…</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}
