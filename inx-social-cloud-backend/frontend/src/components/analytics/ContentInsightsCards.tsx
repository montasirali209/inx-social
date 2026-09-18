import { Activity, CalendarDays, Clock, Gauge, Image, MessageCircle, Trophy, Video } from 'lucide-react'
import type { PlatformAnalytics } from '../../types/dashboard'
import { AnalyticsCard, AnalyticsCardHeader } from './AnalyticsPrimitives'

function interactionsForPost(post: PlatformAnalytics['content'][number]) {
  return Number(post.insights?.totalInteractions ?? post.reactions + post.comments + post.shares)
}

function compact(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits }).format(value)
}

function contentMix(content: PlatformAnalytics['content']) {
  return content.reduce((counts, post) => {
    const type = String(post.contentType || '').toLowerCase()
    if (/video|reel|short/.test(type)) counts.video += 1
    else if (/image|photo|carousel/.test(type)) counts.image += 1
    else counts.other += 1
    return counts
  }, { image: 0, video: 0, other: 0 })
}

export function ContentEfficiencyCard({ analytics }: { analytics: PlatformAnalytics }) {
  const posts = analytics.content.length
  const totalInteractions = Number(analytics.summary.totalInteractions || 0)
  const avgInteractions = posts ? totalInteractions / posts : 0
  const engagedPosts = analytics.content.filter(post => interactionsForPost(post) > 0).length
  const bestPostInteractions = analytics.content.reduce((best, post) => Math.max(best, interactionsForPost(post)), 0)
  const conversationActions = Number(analytics.summary.comments || 0) + Number(analytics.summary.shares || 0)
  const coverage = posts ? engagedPosts / posts * 100 : 0

  const metrics = [
    { label: 'Avg interactions / post', value: compact(avgInteractions), icon: Gauge },
    { label: 'Engaged posts', value: `${engagedPosts}/${posts}`, icon: Activity },
    { label: 'Best post interactions', value: compact(bestPostInteractions), icon: Trophy },
    { label: 'Comments + shares', value: compact(conversationActions), icon: MessageCircleMore },
  ]

  return <AnalyticsCard>
    <AnalyticsCardHeader description="Calculated from the live post metrics in the selected period. No audience-growth estimate is used." title="Content Efficiency" />
    <div className="px-5 pb-5">
      <div className="grid grid-cols-2 gap-2">{metrics.map(({ label, value, icon: Icon }) => <div className="rounded-xl border border-border-soft bg-bg/30 p-3" key={label}><span className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-text-soft"><Icon className="size-3" />{label}</span><strong className="mt-1.5 block text-lg">{value}</strong></div>)}</div>
      <div className="mt-4 rounded-xl border border-border-soft bg-bg/30 p-3"><div className="flex items-center justify-between gap-3 text-[10px]"><span className="text-text-muted">Posts receiving at least one interaction</span><strong>{coverage.toFixed(0)}%</strong></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border-soft"><span className="block h-full rounded-full bg-gradient-to-r from-brand-teal to-brand-cyan transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, coverage))}%` }} /></div></div>
    </div>
  </AnalyticsCard>
}

export function PublishingRhythmCard({ analytics, days }: { analytics: PlatformAnalytics; days: number }) {
  const content = analytics.content
  const dated = content.flatMap(post => post.createdTime ? [{ post, date: new Date(post.createdTime) }] : []).filter(item => Number.isFinite(item.date.getTime()))
  const activeDays = new Set(dated.map(item => item.post.createdTime!.slice(0, 10))).size
  const postsPerWeek = days > 0 ? content.length / days * 7 : 0
  const latest = dated.sort((left, right) => right.date.getTime() - left.date.getTime())[0]?.date || null
  const dayCounts = dated.reduce((map, item) => {
    const day = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(item.date)
    map.set(day, (map.get(day) || 0) + 1)
    return map
  }, new Map<string, number>())
  const mostActiveDay = [...dayCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || '—'
  const mix = contentMix(content)

  return <AnalyticsCard>
    <AnalyticsCardHeader description="Publishing frequency and content mix calculated directly from posts returned for the selected period." title="Publishing Rhythm" />
    <div className="px-5 pb-5">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border-soft bg-bg/30 p-3"><span className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-text-soft"><CalendarDays className="size-3" />Posts in period</span><strong className="mt-1.5 block text-lg">{content.length.toLocaleString('en-GB')}</strong></div>
        <div className="rounded-xl border border-border-soft bg-bg/30 p-3"><span className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-text-soft"><Activity className="size-3" />Active days</span><strong className="mt-1.5 block text-lg">{activeDays}</strong></div>
        <div className="rounded-xl border border-border-soft bg-bg/30 p-3"><span className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-text-soft"><Gauge className="size-3" />Posts / week</span><strong className="mt-1.5 block text-lg">{postsPerWeek.toFixed(1)}</strong></div>
        <div className="rounded-xl border border-border-soft bg-bg/30 p-3"><span className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-text-soft"><Clock className="size-3" />Latest post</span><strong className="mt-1.5 block text-sm">{latest ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(latest) : 'No posts'}</strong></div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border-soft bg-bg/30 p-3 text-[10px]">
        <span className="mr-auto text-text-muted">Most active day <strong className="ml-1 text-text-main">{mostActiveDay}</strong></span>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/[.07] px-2 py-1 text-text-muted"><Image className="size-3" />Images {mix.image}</span>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/[.07] px-2 py-1 text-text-muted"><Video className="size-3" />Video {mix.video}</span>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/[.07] px-2 py-1 text-text-muted">Other {mix.other}</span>
      </div>
    </div>
  </AnalyticsCard>
}
