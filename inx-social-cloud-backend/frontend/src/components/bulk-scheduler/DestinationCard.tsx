import { Check, Link2Off } from 'lucide-react'
import { useState } from 'react'
import type { Destination } from '../../types/bulk-scheduler'
import { PlatformMark } from './PlatformMark'

type Props = {
  destination: Destination
  selected: boolean
  onToggle: (id: string) => void
}

export function DestinationCard({ destination, selected, onToggle }: Props) {
  const disabled = !destination.connected
  const [imageFailed, setImageFailed] = useState(false)
  const initials = destination.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'IN'
  return (
    <label className={`group relative flex min-h-[78px] items-center gap-3 rounded-xl border p-3 transition duration-200 ease-out focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-cyan motion-reduce:transition-none ${disabled ? 'cursor-not-allowed border-white/5 bg-black/12 opacity-60' : selected ? 'cursor-pointer border-brand-blue/75 bg-gradient-to-br from-brand-blue/18 to-brand-cyan/5 shadow-[0_12px_32px_rgba(20,184,166,0.14),inset_0_1px_rgba(255,255,255,0.04)] hover:-translate-y-0.5' : 'cursor-pointer border-border-soft bg-black/12 hover:-translate-y-0.5 hover:border-brand-blue/40 hover:bg-panel-hover/45'}`}>
      <input
        checked={selected}
        className="peer sr-only"
        disabled={disabled}
        onChange={() => onToggle(destination.id)}
        type="checkbox"
      />
      <span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center rounded border transition ${selected ? 'border-brand-blue bg-brand-blue text-white' : 'border-text-soft/70 bg-black/20 text-transparent group-hover:border-brand-cyan/70'}`}><Check className="size-3.5" /></span>
      <span className="relative shrink-0">
        {destination.avatarUrl && !imageFailed
          ? <img alt="" className="size-10 rounded-full border border-white/10 bg-panel-soft object-cover" onError={() => setImageFailed(true)} src={destination.avatarUrl} />
          : <span aria-hidden="true" className="grid size-10 place-items-center rounded-full border border-brand-blue/30 bg-gradient-to-br from-brand-blue to-[#0b766a] text-[11px] font-bold text-white">{initials}</span>}
        <PlatformMark className="absolute -bottom-1 -right-1 ring-2 ring-panel" platform={destination.platform} size="xs" />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-sm font-semibold text-text-main">{destination.handle || destination.name}</strong>
        <span className="mt-0.5 block truncate text-xs text-text-muted">{destination.type}</span>
        <span className={`mt-1 inline-flex items-center gap-1 text-[10px] font-semibold ${disabled ? 'text-brand-amber' : 'text-brand-green'}`}>
          {disabled ? <Link2Off aria-hidden="true" className="size-3" /> : <span className="size-1.5 rounded-full bg-brand-green shadow-[0_0_8px_#22c55e]" />}
          {disabled ? destination.disabledReason || 'Reconnect required' : 'Connected'}
        </span>
      </span>
    </label>
  )
}
