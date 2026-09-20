import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, LoaderCircle } from 'lucide-react'
import type { DashboardJob } from '../../types/dashboard'

export type BulkHistoryView = 'all' | 'scheduled' | 'published' | 'needs_review'

export function BulkSchedulerStats({ jobs, onOpen }: { jobs: DashboardJob[]; onOpen: (view: BulkHistoryView) => void }) {
  const unique = [...new Map(jobs.map(job => [job.contentId || job.providerPostId || job.id, job])).values()]
  const scheduled = unique.filter(job => job.status === 'SCHEDULED').length
  const published = unique.filter(job => job.status === 'PUBLISHED').length
  const processing = unique.filter(job => ['AWAITING_UPLOAD', 'READY', 'PROCESSING'].includes(job.status)).length
  const needsReview = unique.filter(job => job.status === 'FAILED').length
  const cards = [
    { label: 'All Bulk Jobs', value: unique.length, detail: 'Publishing records', icon: ClipboardList, tone: 'border-brand-cyan/25 bg-brand-cyan/8 text-brand-cyan', view: 'all' as const },
    { label: 'Scheduled', value: scheduled, detail: 'Held by Post for Me', icon: CalendarClock, tone: 'border-brand-blue/25 bg-brand-blue/8 text-brand-cyan', view: 'scheduled' as const },
    { label: 'Published', value: published, detail: 'Completed publishing', icon: CheckCircle2, tone: 'border-brand-green/25 bg-brand-green/8 text-brand-green', view: 'published' as const },
    { label: 'Processing', value: processing, detail: 'Upload or publish in progress', icon: LoaderCircle, tone: 'border-brand-purple/25 bg-brand-purple/8 text-brand-purple', view: 'all' as const },
    { label: 'Needs Review', value: needsReview, detail: needsReview ? 'Action required' : 'Nothing needs attention', icon: AlertTriangle, tone: needsReview ? 'border-brand-red/25 bg-brand-red/8 text-brand-red' : 'border-border-soft bg-white/[.025] text-text-muted', view: 'needs_review' as const },
  ]

  return (
    <section aria-label="Bulk publishing status" className="mt-4 flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-5">
      {cards.map(({ label, value, detail, icon: Icon, tone, view }) => (
        <button className="interactive-surface group min-w-[210px] rounded-card border p-4 text-left focus-visible:outline-2 focus-visible:outline-brand-cyan md:min-w-0" key={label} onClick={() => onOpen(view)} type="button">
          <div className="flex items-start gap-3">
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl border ${tone}`}><Icon className={`size-4.5 ${label === 'Processing' && value ? 'animate-spin motion-reduce:animate-none' : ''}`} /></span>
            <span className="min-w-0 flex-1"><small className="block text-[10px] text-text-muted">{label}</small><strong className="mt-0.5 block text-2xl">{value}</strong><small className="mt-1 block text-[9px] text-text-soft">{detail}</small></span>
            <span className="self-center text-lg text-brand-cyan transition-transform group-hover:translate-x-1">›</span>
          </div>
        </button>
      ))}
    </section>
  )
}
