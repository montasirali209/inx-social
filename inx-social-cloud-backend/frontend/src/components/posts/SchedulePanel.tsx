import { CalendarClock, Clock3, FileEdit, Send } from 'lucide-react'
import { campaigns } from '../../data/postsData'
import type { BestTimeInsight, PublishProgress, ScheduleMode } from '../../types/posts'
import { Button } from '../ui/Button'
import { PanelHeading } from './PostPrimitives'

type Props = {
  mode: ScheduleMode
  setMode: (mode: ScheduleMode) => void
  date: string
  setDate: (value: string) => void
  time: string
  setTime: (value: string) => void
  campaign: string
  setCampaign: (value: string) => void
  labels: string
  setLabels: (value: string) => void
  canPublish: boolean
  progress: PublishProgress
  onPublish: () => void
  onDraft: () => void
  bestTime: BestTimeInsight
  bestTimeLoading: boolean
}

export function SchedulePanel(props: Props) {
  const busy = props.progress.state === 'preparing' || props.progress.state === 'uploading'
  return (
    <section className="interactive-surface rounded-panel border p-4 xl:p-5">
      <PanelHeading step={3} subtitle="Choose when and how this content goes live." title="Schedule & Publish" />
      <div className="grid grid-cols-3 gap-2">{([{ id: 'now', label: 'Publish Now', icon: Send }, { id: 'later', label: 'Schedule', icon: CalendarClock }, { id: 'draft', label: 'Save Draft', icon: FileEdit }] as const).map(({ id, label, icon: Icon }) => <button aria-pressed={props.mode === id} className={`min-h-20 rounded-xl border p-2 text-center transition focus-visible:outline-2 focus-visible:outline-brand-cyan ${props.mode === id ? 'border-brand-cyan/55 bg-brand-cyan/12 text-brand-cyan' : 'border-border-soft bg-bg/25 text-text-muted hover:border-brand-cyan/25 hover:text-white'}`} key={id} onClick={() => props.setMode(id)} type="button"><Icon className="mx-auto size-5" /><span className="mt-2 block text-[10px] font-semibold">{label}</span></button>)}</div>
      {props.mode === 'later' && <div className="mt-4 grid grid-cols-2 gap-2"><label className="text-[10px] text-text-muted">Date<input className="mt-1.5 min-h-10 w-full rounded-xl border border-border-soft bg-bg/40 px-2 text-xs outline-none focus:border-brand-cyan" min={new Date().toISOString().slice(0, 10)} onChange={(event) => props.setDate(event.target.value)} type="date" value={props.date} /></label><label className="text-[10px] text-text-muted">Time<input className="mt-1.5 min-h-10 w-full rounded-xl border border-border-soft bg-bg/40 px-2 text-xs outline-none focus:border-brand-cyan" onChange={(event) => props.setTime(event.target.value)} type="time" value={props.time} /></label></div>}
      <div className="mt-3 rounded-xl border border-brand-cyan/20 bg-brand-cyan/[0.045] p-3"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-xs font-semibold text-brand-cyan"><Clock3 className="size-4" />Best Time To Post</div><strong className="mt-1.5 block text-sm text-white">{props.bestTimeLoading ? 'Analysing activity…' : props.bestTime.label}</strong></div>{props.bestTime.available && props.bestTime.time && <button className="shrink-0 rounded-lg border border-brand-cyan/25 px-2.5 py-1.5 text-[9px] font-semibold text-brand-cyan transition hover:bg-brand-cyan/10 focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={() => { props.setMode('later'); props.setTime(props.bestTime.time!) }} type="button">Use time</button>}</div><p className="mt-1 text-[10px] leading-4 text-text-muted">{props.bestTimeLoading ? 'Reading the selected Page’s live engagement history.' : props.bestTime.detail}</p></div>
      <label className="mt-3 block text-[10px] text-text-muted">Campaign <span className="text-text-soft">(optional)</span><select className="mt-1.5 min-h-10 w-full rounded-xl border border-border-soft bg-bg/40 px-3 text-xs outline-none focus:border-brand-cyan" onChange={(event) => props.setCampaign(event.target.value)} value={props.campaign}>{campaigns.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="mt-3 block text-[10px] text-text-muted">Labels <span className="text-text-soft">(comma separated)</span><input className="mt-1.5 min-h-10 w-full rounded-xl border border-border-soft bg-bg/40 px-3 text-xs outline-none focus:border-brand-cyan" onChange={(event) => props.setLabels(event.target.value)} placeholder="campaign, launch" value={props.labels} /></label>
      {busy && <div className="mt-4"><div className="mb-1 flex justify-between text-[10px] text-text-muted"><span>{props.progress.message}</span><span>{props.progress.percent}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-green transition-all" style={{ width: `${props.progress.percent}%` }} /></div></div>}
      {props.progress.state === 'failed' && <p className="mt-3 rounded-lg border border-brand-red/20 bg-brand-red/8 p-2 text-[10px] text-brand-red">{props.progress.message}</p>}
      {props.progress.state === 'completed' && <p className="mt-3 rounded-lg border border-brand-green/20 bg-brand-green/8 p-2 text-[10px] text-brand-green">{props.progress.message}</p>}
      <Button className="mt-4 w-full" disabled={!props.canPublish || busy} onClick={props.mode === 'draft' ? props.onDraft : props.onPublish} type="button" variant="primary">{props.mode === 'draft' ? <FileEdit className="size-4" /> : <CalendarClock className="size-4" />}{props.mode === 'draft' ? 'Save as Draft' : props.mode === 'now' ? 'Publish Post' : 'Schedule Post'}</Button>
      {props.mode !== 'draft' && <button className="mt-2 w-full rounded-lg py-2 text-[10px] text-text-muted transition hover:text-brand-cyan focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={props.onDraft} type="button">Save as Draft instead</button>}
    </section>
  )
}
