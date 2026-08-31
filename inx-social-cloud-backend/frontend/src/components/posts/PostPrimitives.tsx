import { AlertTriangle, CalendarClock, Check, ClipboardList, FileEdit, type LucideIcon } from 'lucide-react'
import { platforms } from '../../data/postsData'
import type { Platform, PostStatus } from '../../types/posts'

export function PlatformIcon({ platform, className = '' }: { platform: Platform; className?: string }) {
  const item = platforms.find((candidate) => candidate.id === platform)!
  return <span aria-label={item.label} className={`inline-grid size-6 shrink-0 place-items-center rounded-lg text-[10px] font-black text-white shadow-sm ${item.colour} ${className}`}>{item.short}</span>
}

const statusStyles: Record<PostStatus, string> = {
  draft: 'border-white/10 bg-white/5 text-text-muted',
  scheduled: 'border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan',
  published: 'border-brand-green/25 bg-brand-green/10 text-brand-green',
  awaiting_approval: 'border-brand-purple/25 bg-brand-purple/10 text-[#c4b5fd]',
  needs_review: 'border-brand-amber/25 bg-brand-amber/10 text-brand-amber',
  failed: 'border-brand-red/25 bg-brand-red/10 text-brand-red',
}

export function PostsStatusBadge({ status }: { status: PostStatus }) {
  return <span className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-semibold capitalize ${statusStyles[status]}`}>{status.replaceAll('_', ' ')}</span>
}

const statIcons: Record<string, LucideIcon> = {
  'All Posts': ClipboardList,
  Drafts: FileEdit,
  Scheduled: CalendarClock,
  Published: Check,
  'Needs Review': AlertTriangle,
}

export function PostsStatCard({ label, value, detail, tone, onClick }: { label: string; value: number; detail: string; tone: 'teal' | 'green' | 'amber' | 'red' | 'blue'; onClick?: () => void }) {
  const Icon = statIcons[label] || ClipboardList
  const tones = {
    teal: 'border-brand-cyan/25 text-brand-cyan bg-brand-cyan/10',
    green: 'border-brand-green/25 text-brand-green bg-brand-green/10',
    amber: 'border-brand-amber/25 text-brand-amber bg-brand-amber/10',
    red: 'border-brand-red/25 text-brand-red bg-brand-red/10',
    blue: 'border-brand-blue/25 text-brand-cyan bg-brand-blue/10',
  }
  const content = (
    <>
      <div className="flex items-start gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl border ${tones[tone]}`}><Icon aria-hidden="true" className="size-5" /></span>
        <div className="min-w-0 flex-1"><p className="text-xs text-text-muted">{label}</p><strong className="mt-0.5 block text-2xl tracking-tight">{value}</strong><p className="mt-1 text-[10px] text-text-soft">{detail}</p></div>
        {onClick && <span className="self-center text-lg text-brand-cyan transition-transform group-hover:translate-x-1" aria-hidden="true">›</span>}
      </div>
    </>
  )
  if (onClick) return <button aria-label={`Open ${label}`} className="interactive-surface group min-w-[210px] flex-1 rounded-card border p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan" onClick={onClick} type="button">{content}</button>
  return <article className="interactive-surface min-w-[210px] flex-1 rounded-card border p-4">{content}</article>
}

export function PanelHeading({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <header className="mb-4 flex items-start gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-brand-cyan/45 bg-brand-cyan/10 text-xs font-bold text-brand-cyan">{step}</span>
      <div><h2 className="font-semibold text-text-main">{title}</h2><p className="mt-0.5 text-[11px] text-text-muted">{subtitle}</p></div>
    </header>
  )
}
