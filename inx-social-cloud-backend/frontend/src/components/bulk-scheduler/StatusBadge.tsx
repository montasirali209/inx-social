import { AlertCircle, CalendarClock, CheckCircle2, Clock3, LoaderCircle, ShieldX } from 'lucide-react'
import type { UploadStatus } from '../../types/bulk-scheduler'

const styles: Record<UploadStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  published: { label: 'Published', className: 'border-brand-green/25 bg-brand-green/10 text-brand-green', icon: CheckCircle2 },
  scheduled: { label: 'Scheduled', className: 'border-brand-blue/30 bg-brand-blue/12 text-[#6eb8ff]', icon: CalendarClock },
  uploading: { label: 'Uploading', className: 'border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan', icon: LoaderCircle },
  waiting: { label: 'Waiting', className: 'border-brand-purple/30 bg-brand-purple/10 text-[#b59aff]', icon: Clock3 },
  failed: { label: 'Failed', className: 'border-brand-red/30 bg-brand-red/10 text-brand-red', icon: AlertCircle },
  blocked: { label: 'Blocked', className: 'border-brand-amber/30 bg-brand-amber/10 text-brand-amber', icon: ShieldX },
}

export function StatusBadge({ status }: { status: UploadStatus }) {
  const definition = styles[status]
  const Icon = definition.icon
  return <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${definition.className}`}><Icon aria-hidden="true" className={`size-3.5 ${status === 'uploading' ? 'animate-spin motion-reduce:animate-none' : ''}`} />{definition.label}</span>
}
