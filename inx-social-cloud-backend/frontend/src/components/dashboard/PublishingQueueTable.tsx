import { ExternalLink, Film, MoreHorizontal } from 'lucide-react'
import { fileDetails, formatSchedule, jobTitle } from '../../lib/dashboard-format'
import { videoStatus } from '../../lib/dashboard-api'
import type { DashboardJob } from '../../types/dashboard'
import { StatusBadge } from './StatusBadge'

function VideoMark({ job }: { job: DashboardJob }) {
  return (
    <span className="relative grid h-12 w-[76px] shrink-0 place-items-center overflow-hidden rounded-lg border border-border-soft bg-gradient-to-br from-brand-blue/18 via-panel-soft to-brand-cyan/8 text-brand-cyan">
      <Film aria-hidden="true" className="size-5" />
      <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1 py-0.5 text-[9px] font-bold uppercase text-white">{job.contentType}</span>
    </span>
  )
}

function PlatformMark({ pageName }: { pageName?: string }) {
  return (
    <span aria-label={pageName ? `Facebook Page: ${pageName}` : 'Facebook'} className="inline-flex items-center gap-2 text-xs text-text-muted">
      <span aria-hidden="true" className="grid size-7 place-items-center rounded-lg bg-[#1877f2] text-sm font-bold text-white">f</span>
      <span className="hidden max-w-28 truncate 2xl:inline">{pageName || 'Facebook'}</span>
    </span>
  )
}

function EmptyQueue() {
  return (
    <div className="grid min-h-64 place-items-center px-6 py-12 text-center">
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-brand-green/20 bg-brand-green/8 text-brand-green"><Film aria-hidden="true" className="size-5" /></span>
        <h3 className="mt-4 text-base font-semibold">Your publishing queue is clear</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-muted">Upload or schedule a video when you are ready. New publishing work will appear here automatically.</p>
        <a className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-brand-blue/35 bg-brand-blue/10 px-4 text-sm font-semibold text-[#78b8ff] transition hover:bg-brand-blue/16 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan" href="/studio/?view=reels">
          Upload a video <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      </div>
    </div>
  )
}

export function PublishingQueueTable({ jobs }: { jobs: DashboardJob[] }) {
  return (
    <section aria-labelledby="queue-heading" className="min-w-0 overflow-hidden rounded-panel border border-border-soft bg-panel/78 shadow-panel backdrop-blur-xl">
      <header className="flex items-center justify-between gap-4 border-b border-border-soft px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold" id="queue-heading">Publishing Queue</h2>
          <span className="rounded-full bg-brand-blue/12 px-2 py-0.5 text-xs font-bold text-[#70b3ff]">{jobs.length}</span>
        </div>
        <a className="inline-flex items-center gap-1 text-sm font-semibold text-[#69adff] hover:text-brand-cyan focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-cyan" href="/studio/?view=reels">View full queue <ExternalLink aria-hidden="true" className="size-3.5" /></a>
      </header>

      {jobs.length === 0 ? <EmptyQueue /> : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full border-collapse text-left">
              <thead className="bg-bg-soft/65 text-[11px] uppercase tracking-[0.09em] text-text-soft">
                <tr>
                  <th className="px-5 py-3 font-semibold">Video</th>
                  <th className="px-4 py-3 font-semibold">Platform</th>
                  <th className="px-4 py-3 font-semibold">Scheduled for</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {jobs.map((job) => (
                  <tr className="transition-colors hover:bg-panel-hover/35" key={job.id}>
                    <td className="px-5 py-3.5">
                      <div className="flex min-w-[260px] items-center gap-3">
                        <VideoMark job={job} />
                        <span className="min-w-0">
                          <strong className="block max-w-[260px] truncate text-sm font-semibold">{jobTitle(job)}</strong>
                          <small className="mt-1 block text-xs text-text-soft">{fileDetails(job)}</small>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><PlatformMark pageName={job.page?.facebookPageName} /></td>
                    <td className="px-4 py-3.5 text-sm">
                      <span className="block font-medium">{formatSchedule(job.scheduledAt, 'date')}</span>
                      <small className="mt-1 block text-text-muted">{formatSchedule(job.scheduledAt, 'time')}</small>
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={videoStatus(job.status)} /></td>
                    <td className="px-5 py-3.5 text-right">
                      <a aria-label={`Open ${jobTitle(job)} in the current scheduler`} className="inline-grid size-9 place-items-center rounded-lg text-text-muted transition hover:bg-white/6 hover:text-text-main focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/studio/?view=reels"><MoreHorizontal aria-hidden="true" className="size-5" /></a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-4 lg:hidden">
            {jobs.map((job) => (
              <article className="rounded-card border border-border-soft bg-bg-soft/55 p-4" key={job.id}>
                <div className="flex items-start gap-3">
                  <VideoMark job={job} />
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">{jobTitle(job)}</strong>
                    <p className="mt-1 text-xs text-text-soft">{fileDetails(job)}</p>
                  </div>
                  <a aria-label={`Open ${jobTitle(job)}`} className="grid size-9 shrink-0 place-items-center rounded-lg text-text-muted focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/studio/?view=reels"><MoreHorizontal aria-hidden="true" className="size-5" /></a>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-soft pt-3">
                  <PlatformMark pageName={job.page?.facebookPageName} />
                  <StatusBadge status={videoStatus(job.status)} />
                </div>
                <p className="mt-3 text-xs text-text-muted">{formatSchedule(job.scheduledAt)}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
