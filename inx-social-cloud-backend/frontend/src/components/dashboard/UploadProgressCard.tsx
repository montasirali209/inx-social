import { ArrowUpRight, CloudUpload, LoaderCircle } from 'lucide-react'
import { fileDetails, jobTitle } from '../../lib/dashboard-format'
import type { DashboardJob } from '../../types/dashboard'
import { DashboardCard } from './DashboardCard'

const stageLabel: Partial<Record<DashboardJob['status'], string>> = {
  AWAITING_UPLOAD: 'Waiting for browser upload',
  READY: 'Upload complete — ready to queue',
  QUEUED: 'Queued for publishing',
  PROCESSING: 'Publishing to Facebook',
}

export function UploadProgressCard({ job }: { job: DashboardJob | null }) {
  return (
    <DashboardCard
      action={<a className="inline-flex items-center gap-1 text-xs font-semibold text-[#6db2ff] hover:text-brand-cyan focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/studio/?view=reels">View queue <ArrowUpRight aria-hidden="true" className="size-3.5" /></a>}
      title="Upload Progress"
    >
      {!job ? (
        <div className="flex min-h-24 items-center gap-3 px-4 py-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-cyan/10 text-brand-cyan"><CloudUpload aria-hidden="true" className="size-5" /></span>
          <div><strong className="text-sm">No active upload</strong><p className="mt-1 text-xs text-text-muted">Your browser is not transferring a video.</p></div>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-cyan/10 text-brand-cyan"><LoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" /></span>
            <span className="min-w-0"><strong className="block truncate text-sm">{jobTitle(job)}</strong><small className="mt-1 block text-xs text-text-muted">{fileDetails(job)}</small></span>
          </div>
          <div aria-label={stageLabel[job.status]} className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/7">
            <span className="block h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-brand-blue to-brand-cyan motion-reduce:animate-none" />
          </div>
          <p className="mt-2 text-xs text-text-muted">{stageLabel[job.status] || 'Publishing work in progress'}</p>
        </div>
      )}
    </DashboardCard>
  )
}
