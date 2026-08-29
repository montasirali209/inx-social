import { ArrowUpRight, CloudUpload, FileVideo2, LoaderCircle, Upload } from 'lucide-react'
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
        <div className="relative overflow-hidden px-4 py-3.5">
          <div aria-hidden="true" className="absolute -right-9 -top-10 size-28 rounded-full bg-brand-cyan/8 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <span className="relative grid size-11 shrink-0 place-items-center rounded-xl border border-brand-cyan/20 bg-brand-cyan/8 text-brand-cyan shadow-[0_0_28px_rgba(34,211,238,0.1)]"><CloudUpload aria-hidden="true" className="icon-float size-5" /><span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-panel bg-brand-green shadow-[0_0_10px_#22c55e]" /></span>
            <div className="min-w-0 flex-1"><strong className="text-sm">Upload station ready</strong><p className="mt-1 text-xs leading-5 text-text-muted">No transfer in progress. Drop in a video whenever you are ready.</p></div>
            <a aria-label="Upload a video" className="hidden size-10 shrink-0 place-items-center rounded-xl border border-brand-blue/25 bg-brand-blue/10 text-[#72b5ff] transition hover:bg-brand-blue/20 focus-visible:outline-2 focus-visible:outline-brand-cyan sm:grid" href="/studio/?view=reels"><Upload aria-hidden="true" className="size-4" /></a>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/6"><span className="block h-full w-full bg-gradient-to-r from-brand-cyan/20 via-brand-blue/35 to-brand-purple/20" /></div>
        </div>
      ) : (
        <div className="p-3.5">
          <div className="flex items-center gap-3">
            <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-brand-cyan/20 bg-gradient-to-br from-brand-blue/20 to-brand-cyan/8 text-brand-cyan"><FileVideo2 aria-hidden="true" className="size-4.5" /><LoaderCircle aria-hidden="true" className="absolute bottom-1 right-1 size-3 animate-spin text-white motion-reduce:animate-none" /></span>
            <span className="min-w-0"><strong className="block truncate text-sm">{jobTitle(job)}</strong><small className="mt-1 block text-xs text-text-muted">{fileDetails(job)}</small></span>
          </div>
          <div aria-label={stageLabel[job.status]} className="mt-3 h-2 overflow-hidden rounded-full bg-white/7">
            <span className="indeterminate-progress block h-full rounded-full bg-gradient-to-r from-brand-blue via-brand-cyan to-brand-blue shadow-[0_0_14px_rgba(34,211,238,0.45)]" />
          </div>
          <p className="mt-2 text-xs text-text-muted">{stageLabel[job.status] || 'Publishing work in progress'}</p>
        </div>
      )}
    </DashboardCard>
  )
}
