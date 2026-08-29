import { ExternalLink, Film, MoreHorizontal, Play, Plus, Sparkles } from 'lucide-react'
import { fileDetails, formatSchedule, jobTitle } from '../../lib/dashboard-format'
import { videoStatus } from '../../lib/dashboard-api'
import type { DashboardJob } from '../../types/dashboard'
import { StatusBadge } from './StatusBadge'

function VideoMark({ job }: { job: DashboardJob }) {
  return (
    <span className="group/video relative grid h-[58px] w-[92px] shrink-0 place-items-center overflow-hidden rounded-xl border border-brand-blue/20 bg-[radial-gradient(circle_at_28%_18%,rgba(45,212,191,0.2),transparent_34%),linear-gradient(140deg,rgba(20,184,166,0.2),rgba(3,17,30,0.96)_56%,rgba(16,185,129,0.1))] text-brand-cyan shadow-[inset_0_1px_rgba(255,255,255,0.06)]">
      <span className="grid size-8 place-items-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur transition group-hover/video:scale-110 group-hover/video:bg-brand-blue/60 motion-reduce:transition-none"><Play aria-hidden="true" className="ml-0.5 size-3.5 fill-current" /></span>
      <span className="absolute bottom-1.5 right-1.5 rounded-md border border-white/10 bg-black/70 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-white">{job.contentType}</span>
      <span aria-hidden="true" className="absolute -left-5 -top-5 size-12 rounded-full border border-brand-cyan/20" />
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
    <section aria-labelledby="queue-heading" className="interactive-surface min-w-0 overflow-hidden rounded-panel border backdrop-blur-xl">
      <header className="flex items-center justify-between gap-4 border-b border-border-soft bg-gradient-to-r from-white/[0.025] to-transparent px-5 py-4">
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
                  <tr className="group/row transition-colors hover:bg-brand-blue/[0.045]" key={job.id}>
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
                      <a aria-label={`Open ${jobTitle(job)} in the current scheduler`} className="inline-grid size-9 place-items-center rounded-lg border border-transparent text-text-muted transition group-hover/row:border-border-soft group-hover/row:bg-white/[0.035] hover:border-brand-blue/35 hover:text-text-main focus-visible:outline-2 focus-visible:outline-brand-cyan" href="/studio/?view=reels"><MoreHorizontal aria-hidden="true" className="size-5" /></a>
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
          <div className="border-t border-border-soft bg-[radial-gradient(circle_at_12%_50%,rgba(20,184,166,0.09),transparent_32%),linear-gradient(90deg,rgba(255,255,255,0.02),transparent)] px-5 py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-brand-cyan/20 bg-brand-cyan/8 text-brand-cyan"><Sparkles aria-hidden="true" className="size-5" /></span>
                <div><strong className="text-sm">Ready for your next video</strong><p className="mt-1 text-xs leading-5 text-text-muted">Add more content without leaving your live publishing workflow.</p></div>
              </div>
              <a className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-brand-blue/35 bg-brand-blue/10 px-4 text-sm font-semibold text-[#79baff] transition hover:-translate-y-0.5 hover:bg-brand-blue/18 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan motion-reduce:transition-none" href="/studio/?view=reels"><Plus aria-hidden="true" className="size-4" /> Add video</a>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
