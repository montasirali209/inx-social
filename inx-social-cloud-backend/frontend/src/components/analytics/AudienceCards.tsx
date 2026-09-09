import { useMemo, useState } from 'react'
import { formatAnalyticsValue } from '../../data/analyticsData'
import type { PerformancePoint } from '../../types/analytics'
import type { AnalyticsCapability, AudienceDemographics, PlatformAnalytics } from '../../types/dashboard'
import { AnalyticsCard, AnalyticsCardHeader, UnavailableState } from './AnalyticsPrimitives'

export function AudienceGrowthCard({ points, total }: { points: PerformancePoint[]; total: number | null }) {
  const maximum = Math.max(1, ...points.map(point => Math.abs(point.followers)))
  return <AnalyticsCard><AnalyticsCardHeader description="Follower or subscriber change returned by the selected platform for this period." title="Audience Growth" />{total === null ? <UnavailableState detail="This connected account did not return audience-growth data for the selected period." title="Audience growth unavailable" /> : <div className="px-5 pb-5"><strong className="text-2xl">{formatAnalyticsValue(total, 'compact')}</strong><p className="mt-1 text-[10px] text-text-muted">Net audience change in this period</p><div className="mt-5 flex h-40 items-end gap-1 border-b border-border-soft">{points.map((point, index) => <span className="analytics-rise-bar group relative min-w-0 flex-1 rounded-t bg-gradient-to-t from-brand-teal/55 to-brand-cyan transition hover:brightness-125" key={point.date} style={{ height: `${Math.max(2, Math.abs(point.followers) / maximum * 100)}%`, animationDelay: `${index * 24}ms` }}><span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-bg px-2 py-1 text-[9px] shadow-panel group-hover:block">{point.label}: {point.followers}</span></span>)}</div><div className="mt-2 flex justify-between text-[9px] text-text-soft"><span>{points[0]?.label}</span><span>{points.at(-1)?.label}</span></div></div>}</AnalyticsCard>
}

type DemographicsProps = {
  demographics?: { instagram: AudienceDemographics | null; facebookSnapshot: AudienceDemographics | null }
  capability?: AnalyticsCapability
  platform: PlatformAnalytics['platform']
  onEditSnapshot: () => void
}

function sourceLabel(source: AudienceDemographics['source']) {
  if (source === 'youtube_api') return 'YouTube live'
  if (source === 'instagram_api') return 'Instagram live'
  return 'Facebook Business Suite snapshot'
}

function unavailableCopy(platform: PlatformAnalytics['platform'], capability?: AnalyticsCapability) {
  if (platform === 'facebook' && capability?.state === 'not_connected') {
    return 'Meta no longer exposes native Facebook Page age and gender through the Page Insights API. Add a dated Meta Business Suite audience snapshot below. If this Page is linked to an Instagram professional account, its live Instagram demographics can also appear here as a separately labelled source.'
  }
  return capability?.reason || (platform === 'facebook'
    ? 'Add a dated Meta Business Suite audience snapshot for Facebook demographics.'
    : platform === 'instagram'
      ? 'This Instagram professional account did not return an eligible follower age and gender breakdown.'
      : platform === 'youtube'
        ? 'YouTube did not return eligible viewer age and gender percentages for this channel and period.'
        : 'This connected platform does not currently provide audience demographics to INXSocial.')
}

export function AudienceDemographicsCard({ demographics, capability, platform, onEditSnapshot }: DemographicsProps) {
  const available = useMemo(() => [demographics?.instagram, demographics?.facebookSnapshot].filter(Boolean) as AudienceDemographics[], [demographics])
  const [source, setSource] = useState<AudienceDemographics['source']>(available[0]?.source || 'facebook_snapshot')
  const selected = available.find(item => item.source === source) || available[0] || null
  const rows = useMemo(() => {
    if (!selected) return []
    return [...new Set(selected.ageGender.map(row => row.age))].map(age => ({
      age,
      women: selected.ageGender.find(row => row.age === age && row.gender === 'women')?.percentage || 0,
      men: selected.ageGender.find(row => row.age === age && row.gender === 'men')?.percentage || 0,
      unknown: selected.ageGender.find(row => row.age === age && row.gender === 'unknown')?.percentage || 0,
    }))
  }, [selected])
  const totals = useMemo(() => selected ? selected.ageGender.reduce((sum, row) => {
    sum[row.gender] += row.percentage
    return sum
  }, { women: 0, men: 0, unknown: 0 }) : { women: 0, men: 0, unknown: 0 }, [selected])

  const sourceButtons = <div className="flex flex-wrap gap-1.5">{available.map(item => <button className={`rounded-lg border px-2 py-1 text-[9px] ${selected?.source === item.source ? 'border-brand-cyan/55 bg-brand-cyan/10 text-brand-cyan' : 'border-border-soft text-text-muted'}`} key={item.source} onClick={() => setSource(item.source)} type="button">{sourceLabel(item.source)}</button>)}{platform === 'facebook' && <button className="rounded-lg border border-border-soft px-2 py-1 text-[9px] text-text-muted hover:border-brand-cyan/40 hover:text-brand-cyan" onClick={onEditSnapshot} type="button">{demographics?.facebookSnapshot ? 'Update snapshot' : 'Add Business Suite snapshot'}</button>}</div>
  const fallback = unavailableCopy(platform, capability)
  const unavailableTitle = platform === 'facebook'
    ? 'Facebook audience demographics need a Business Suite snapshot'
    : capability?.state === 'permission_required'
      ? 'Demographic permission required'
      : `Audience demographics unavailable for ${platform === 'youtube' ? 'YouTube' : platform === 'instagram' ? 'Instagram' : platform === 'linkedin' ? 'LinkedIn' : 'this account'}`

  return <AnalyticsCard><AnalyticsCardHeader action={sourceButtons} description="Verified age and gender data only. Every source is explicitly labelled; INXSocial never estimates demographics." title="Audience Demographics" />{selected ? <div className="px-5 pb-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><strong className="text-lg">{selected.account.username ? `@${selected.account.username.replace(/^@/, '')}` : selected.account.name || 'Audience'}</strong><p className="mt-1 text-[10px] text-text-muted">{sourceLabel(selected.source)} · {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(selected.capturedAt))}</p></div><div className="analytics-audience-orb relative grid size-24 place-items-center rounded-full border border-brand-cyan/20 bg-bg/45 shadow-[inset_0_0_28px_rgba(45,212,191,.08),0_0_28px_rgba(20,184,166,.09)]"><strong className="text-lg">{selected.audienceSize ? formatAnalyticsValue(selected.audienceSize, 'compact') : `${Math.max(totals.women, totals.men).toFixed(0)}%`}</strong><small className="-mt-3 text-[8px] uppercase tracking-wider text-text-soft">audience</small></div></div><div className="grid gap-2.5">{rows.map((row, index) => <div className="grid grid-cols-[42px_minmax(0,1fr)_70px] items-center gap-2" key={row.age}><span className="text-[10px] font-semibold text-text-muted">{row.age}</span><div className="flex h-2.5 overflow-hidden rounded-full bg-bg/55"><i className="analytics-demographic-fill bg-[#ec4899]" style={{ width: `${row.women}%`, animationDelay: `${index * 45}ms` }} /><i className="analytics-demographic-fill bg-[#3b82f6]" style={{ width: `${row.men}%`, animationDelay: `${index * 45 + 35}ms` }} /><i className="analytics-demographic-fill bg-text-soft" style={{ width: `${row.unknown}%`, animationDelay: `${index * 45 + 70}ms` }} /></div><span className="text-right text-[9px] text-text-soft"><b className="text-[#f472b6]">{row.women.toFixed(1)}</b> / <b className="text-[#60a5fa]">{row.men.toFixed(1)}</b>%</span></div>)}</div><div className="mt-4 flex flex-wrap gap-4 text-[9px] text-text-soft"><span><i className="mr-1.5 inline-block size-2 rounded-full bg-[#ec4899]" />Women {totals.women.toFixed(1)}%</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-[#3b82f6]" />Men {totals.men.toFixed(1)}%</span>{totals.unknown > 0 && <span><i className="mr-1.5 inline-block size-2 rounded-full bg-text-soft" />Other {totals.unknown.toFixed(1)}%</span>}</div></div> : <UnavailableState detail={fallback} title={unavailableTitle} />}</AnalyticsCard>
}
