import type { PublishingActivityPoint } from '../../types/dashboard'

const rows = [
  { key: 'published' as const, label: 'Published', colour: '#2dd4bf' },
  { key: 'scheduled' as const, label: 'Scheduled', colour: '#3b82f6' },
  { key: 'engagement' as const, label: 'Engagement', colour: '#f8fafc' },
]

export function ActivityTooltip({ point, leftPercent }: {
  point: PublishingActivityPoint
  leftPercent: number
}) {
  const alignRight = leftPercent > 68
  return (
    <div className={`pointer-events-none absolute top-2 z-20 min-w-40 rounded-xl border border-teal-300/18 bg-[#071923]/96 p-2.5 shadow-[0_22px_55px_rgba(0,0,0,.52),0_0_28px_rgba(20,184,166,.08)] backdrop-blur-xl ${alignRight ? '-translate-x-full' : ''}`} style={{ left: `${leftPercent}%` }}>
      <p className="mb-1.5 text-[11px] font-semibold text-text-main">{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(point.date))}</p>
      <dl className="space-y-1">
        {rows.map((row) => <div className="flex items-center justify-between gap-5 text-[10px]" key={row.key}><dt className="flex items-center gap-2 text-text-muted"><span className="size-1.5 rounded-full" style={{ backgroundColor: row.colour }} />{row.label}</dt><dd className="font-semibold text-text-main">{point[row.key].toLocaleString('en-GB')}</dd></div>)}
      </dl>
    </div>
  )
}
