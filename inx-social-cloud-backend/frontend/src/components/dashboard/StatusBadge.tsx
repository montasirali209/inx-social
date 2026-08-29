import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle, UploadCloud } from 'lucide-react'
import type { VideoStatus } from '../../types/dashboard'

const styles: Record<VideoStatus, string> = {
  ready: 'border-[#3b82f6]/25 bg-[#3b82f6]/10 text-[#79b8ff]',
  scheduled: 'border-[#3b82f6]/25 bg-[#3b82f6]/10 text-[#79b8ff]',
  in_queue: 'border-brand-purple/25 bg-brand-purple/10 text-[#c4a8ff]',
  publishing: 'border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan',
  published: 'border-brand-green/25 bg-brand-green/10 text-brand-green',
  pending_review: 'border-brand-amber/25 bg-brand-amber/10 text-brand-amber',
  failed: 'border-brand-red/25 bg-brand-red/10 text-[#ff8e98]',
}

const labels: Record<VideoStatus, string> = {
  ready: 'Ready',
  scheduled: 'Scheduled',
  in_queue: 'In Queue',
  publishing: 'Publishing',
  published: 'Published',
  pending_review: 'Pending Review',
  failed: 'Failed',
}

const icons = {
  ready: UploadCloud,
  scheduled: Clock3,
  in_queue: Clock3,
  publishing: LoaderCircle,
  published: CheckCircle2,
  pending_review: AlertTriangle,
  failed: AlertTriangle,
} satisfies Record<VideoStatus, typeof Clock3>

export function StatusBadge({ status, compact = false }: { status: VideoStatus; compact?: boolean }) {
  const Icon = icons[status]
  return (
    <span className={`inline-flex items-center rounded-lg border font-semibold shadow-[inset_0_1px_rgba(255,255,255,0.04)] ${compact ? 'min-h-6 gap-1 px-2 py-0.5 text-[10px]' : 'min-h-7 gap-1.5 px-2.5 py-1 text-xs'} ${styles[status]}`}>
      {!compact && <Icon aria-hidden="true" className={`size-3.5 ${status === 'publishing' ? 'animate-spin motion-reduce:animate-none' : ''}`} />}
      {labels[status]}
    </span>
  )
}
