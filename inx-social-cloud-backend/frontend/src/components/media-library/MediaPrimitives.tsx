import { Archive, Bot, CheckCircle2, FileImage, Images, Send, ShieldAlert } from 'lucide-react'
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
  return <article className={`interactive-surface min-w-[210px] rounded-card border p-4 ${tones[tone]}`}><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-current/20 bg-current/[0.07]"><Icon className="size-5" /></span><div><p className="text-[11px] text-text-muted">{label}</p><strong className="mt-1 block text-2xl text-text-main">{value.toLocaleString()}</strong><p className="mt-1 text-[9px] text-current">{detail}</p></div></div></article>
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
