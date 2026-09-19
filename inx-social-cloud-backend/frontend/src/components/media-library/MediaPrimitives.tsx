import { Archive, Bot, CheckCircle2, ChevronRight, FileImage, Images, Send, ShieldAlert } from 'lucide-react'
import type { MediaSource, MediaStatus, Platform } from '../../types/media-library'
import { PlatformIcon } from '../posts/PostPrimitives'

const tones = {
  teal: 'border-brand-cyan/25 bg-brand-cyan/[0.055] text-brand-cyan',
  green: 'border-brand-green/25 bg-brand-green/[0.055] text-brand-green',
  amber: 'border-brand-amber/25 bg-brand-amber/[0.055] text-brand-amber',
  red: 'border-brand-red/25 bg-brand-red/[0.055] text-brand-red',
  purple: 'border-brand-purple/25 bg-brand-purple/[0.055] text-brand-purple',
} as const

const icons = { total: Images, ai: Bot, ready: CheckCircle2, used: Send, review: ShieldAlert, archived: Archive, image: FileImage }

export function MediaStatCard({ label, value, detail, tone, icon }: { label: string; value: number; detail: string; tone: keyof typeof tones; icon: keyof typeof icons }) {
  const Icon = icons[icon]
  const reviewCard = label === 'Needs Review'
  const displayLabel = reviewCard ? 'Assets Needing Review' : label
  const displayDetail = reviewCard ? 'Media assets needing attention · click to view' : detail
  const content = <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-current/20 bg-current/[0.07]"><Icon className="size-5" /></span><div className="min-w-0 flex-1"><p className="text-[11px] text-text-muted">{displayLabel}</p><strong className="mt-1 block text-2xl text-text-main">{value.toLocaleString()}</strong><p className="mt-1 text-[9px] text-current">{displayDetail}</p></div>{reviewCard ? <ChevronRight aria-hidden="true" className="mt-4 size-4 shrink-0 transition-transform group-hover:translate-x-1" /> : null}</div>
  const className = `interactive-surface min-w-[210px] rounded-card border p-4 ${tones[tone]}`
  if (reviewCard) {
    return <button aria-label={`View ${value} media assets needing review`} className={`${className} group w-full text-left focus-visible:outline-2 focus-visible:outline-brand-cyan`} onClick={() => window.dispatchEvent(new CustomEvent('inx-media-kpi-filter', { detail: { tab: 'needs_review' } }))} type="button">{content}</button>
  }
  return <article className={className}>{content}</article>
}


export function MediaStatSkeleton({ index = 0 }: { index?: number }) {
  return <div aria-hidden="true" className="min-w-[210px] rounded-card border border-border-soft bg-panel/70 p-4">
    <div className="flex items-start gap-3">
      <span className="size-10 shrink-0 animate-pulse rounded-xl border border-white/[.06] bg-white/[.045] motion-reduce:animate-none" style={{ animationDelay: `${index * 80}ms` }} />
      <div className="min-w-0 flex-1">
        <span className="block h-2.5 w-24 animate-pulse rounded bg-white/[.05] motion-reduce:animate-none" style={{ animationDelay: `${index * 80}ms` }} />
        <span className="mt-3 block h-7 w-16 animate-pulse rounded bg-white/[.07] motion-reduce:animate-none" style={{ animationDelay: `${index * 80}ms` }} />
        <span className="mt-2 block h-2 w-28 animate-pulse rounded bg-brand-cyan/[.07] motion-reduce:animate-none" style={{ animationDelay: `${index * 80}ms` }} />
      </div>
    </div>
  </div>
}

const statusStyle: Record<MediaStatus, string> = {
  unused: 'border-white/10 bg-white/5 text-text-muted', used: 'border-brand-green/20 bg-brand-green/10 text-brand-green', scheduled: 'border-brand-amber/20 bg-brand-amber/10 text-brand-amber', published: 'border-brand-green/20 bg-brand-green/10 text-brand-green', needs_review: 'border-brand-red/20 bg-brand-red/10 text-brand-red', archived: 'border-white/10 bg-white/5 text-text-soft',
}

export function MediaStatusBadge({ status }: { status: MediaStatus }) {
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold capitalize ${statusStyle[status]}`}>{status.replace('_', ' ')}</span>
}

export function SourceBadge({ source }: { source: MediaSource }) {
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold ${source === 'ai_generated' ? 'border-brand-purple/25 bg-brand-purple/10 text-brand-purple' : 'border-brand-cyan/20 bg-brand-cyan/8 text-brand-cyan'}`}>{source === 'ai_generated' ? 'AI Generated' : source === 'uploaded' ? 'Uploaded' : 'Imported'}</span>
}

export function ReadinessIcon({ platform }: { platform: Platform }) { return <PlatformIcon className="size-5 rounded-md text-[8px]" platform={platform} /> }
