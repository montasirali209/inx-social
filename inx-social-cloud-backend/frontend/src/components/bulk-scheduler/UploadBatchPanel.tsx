import { FileText, HardDrive, Image as ImageIcon, Images, Megaphone, Play, Plus, RotateCcw, Sparkles, Type, UploadCloud } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AIPostCampaign } from '../../types/ai-content-studio'
import type { BulkContentMode, SelectedMedia, TimingMode } from '../../types/bulk-scheduler'
import { Button } from '../ui/Button'
import { CaptionInput } from './CaptionInput'
import { SessionSummary } from './SessionSummary'
import { TimingModeSelect } from './TimingModeSelect'
import { DailyTimeSelector } from './DailyTimeSelector'
import { ManualCampaignEditor, type CampaignImport } from './ManualCampaignEditor'
import type { CampaignOrderMode } from '../../lib/campaign-order'

type Props = {
  workspaceMode: 'media' | 'text' | 'campaign'
  contentMode: BulkContentMode
  media: SelectedMedia[]
  captions: string
  captionCount: number
  timingMode: TimingMode | ''
  scheduleDate: string
  scheduleTimes: string[]
  savedScheduleTimes: string[]
  timezone: string
  selectedDestinations: number
  useFallback: boolean
  retainMedia: boolean
  smartTiming: boolean
  canStart: boolean
  disabledReason: string
  running: boolean
  campaigns: AIPostCampaign[]
  campaignLoading: boolean
  campaignError: string
  onWorkspaceModeChange: (value: 'media' | 'text' | 'campaign') => void
  onCampaignSelect: (campaign: AIPostCampaign) => void
  onCampaignClear: () => void
  onManualCampaignStart: () => void
  onManualCampaignTitleChange: (title: string) => void
  onManualTextAdd: (captions: string[]) => void
  onManualOrderModeChange: (mode: CampaignOrderMode) => void
  onManualMediaAdd: (files: File[]) => void
  onManualPostEdit: (id: string, caption: string) => void
  onManualPostRemove: (id: string) => void
  onManualPostMove: (id: string, direction: -1 | 1) => void
  onCreateCampaign: () => void
  onContentModeChange: (value: BulkContentMode) => void
  onMedia: (files: File[]) => void
  onCaptionFile: (file: File) => void
  onCaptionsChange: (value: string) => void
  onTimingModeChange: (value: TimingMode) => void
  onScheduleDateChange: (value: string) => void
  onScheduleTimeAdd: (value: string) => void
  onScheduleTimeRemove: (value: string) => void
  onSaveScheduleTimes: () => Promise<void>
  onFallbackChange: (value: boolean) => void
  onRetainMediaChange: (value: boolean) => void
  onSmartTimingChange: (value: boolean) => void
  onClear: () => void
  onStart: () => void
  campaignImport?: CampaignImport | null
}

function campaignModeLabel(mode: AIPostCampaign['contentMode']) {
  if (mode === 'IMAGE') return 'Image'
  if (mode === 'MIXED') return 'Mixed'
  return 'Text'
}

export function UploadBatchPanel(props: Props) {
  const mediaInput = useRef<HTMLInputElement>(null)
  const captionInput = useRef<HTMLInputElement>(null)
  const [manualEditorOpen, setManualEditorOpen] = useState(false)
  const needsDate = props.timingMode === 'schedule_time' || props.timingMode === 'saved_schedule'
  const textMode = props.contentMode === 'text'
  const campaignMode = props.workspaceMode === 'campaign'
  const exceedsLibraryLimit = props.media.some((item) => item.file.size > 100 * 1024 * 1024)
  const campaignImport = props.campaignImport || null

  return (
    <section aria-labelledby="upload-batch-title" className="interactive-surface rounded-panel border p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/8 text-brand-cyan">{campaignMode ? <Megaphone aria-hidden="true" className="size-5" /> : <UploadCloud aria-hidden="true" className="size-5" />}</span>
          <div>
            <h2 className="text-base font-semibold" id="upload-batch-title">{campaignMode ? 'Campaign batch' : 'Bulk content batch'}</h2>
            <p className="mt-0.5 text-xs leading-5 text-text-muted">{campaignMode ? campaignImport ? `“${campaignImport.title}” is loaded in campaign order. Review the sequence below, then choose destinations and timing.` : 'Build a campaign from your own text and media, or use a saved AI campaign.' : textMode ? 'Paste complete text posts, then choose how they should publish.' : 'Add local images or videos and captions, then choose how they should publish.'}</p>
          </div>
        </div>
        {!campaignMode && <div className="flex flex-wrap gap-2">
          {!textMode && <Button disabled={props.running} onClick={() => mediaInput.current?.click()} type="button"><Images aria-hidden="true" className="size-4" /> Select media</Button>}
          <Button disabled={props.running} onClick={() => captionInput.current?.click()} type="button" variant="ghost"><FileText aria-hidden="true" className="size-4" /> {textMode ? 'Post file' : 'Caption file'}</Button>
          <input accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/x-m4v,video/webm,.avi,.mkv" className="sr-only" multiple onChange={(event) => { props.onMedia(Array.from(event.target.files || [])); event.target.value = '' }} ref={mediaInput} type="file" />
          <input accept=".txt,text/plain" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onCaptionFile(file); event.target.value = '' }} ref={captionInput} type="file" />
        </div>}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-border-soft bg-black/10 p-1">
        <button className={`flex min-h-10 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition ${props.workspaceMode === 'media' ? 'bg-brand-cyan/12 text-brand-cyan shadow-inner' : 'text-text-muted hover:bg-white/[.03] hover:text-white'}`} disabled={props.running} onClick={() => props.onWorkspaceModeChange('media')} type="button"><Images className="size-4" />Media Posts</button>
        <button className={`flex min-h-10 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition ${props.workspaceMode === 'text' ? 'bg-brand-cyan/12 text-brand-cyan shadow-inner' : 'text-text-muted hover:bg-white/[.03] hover:text-white'}`} disabled={props.running} onClick={() => props.onWorkspaceModeChange('text')} type="button"><Type className="size-4" />Text Posts</button>
        <button className={`flex min-h-10 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition ${campaignMode ? 'bg-brand-purple/12 text-[#c4b5fd] shadow-inner' : 'text-text-muted hover:bg-white/[.03] hover:text-white'}`} disabled={props.running} onClick={() => props.onWorkspaceModeChange('campaign')} type="button"><Megaphone className="size-4" />Campaign</button>
      </div>

      {campaignMode && !campaignImport && <div className="mt-4 rounded-2xl border border-brand-purple/20 bg-[radial-gradient(circle_at_95%_0%,rgba(124,58,237,.10),transparent_16rem),linear-gradient(145deg,rgba(15,27,49,.78),rgba(5,18,29,.72))] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><span className="text-[9px] font-bold uppercase tracking-[.13em] text-[#c4b5fd]">Choose how to build</span><h3 className="mt-1 text-sm font-semibold">Your campaign, your sequence</h3><p className="mt-1 text-[10px] leading-5 text-text-muted">Combine your own text, images and videos in any order, or create and load a saved AI campaign.</p></div>
          <div className="flex flex-wrap gap-2"><Button disabled={props.running} onClick={() => { props.onManualCampaignStart(); setManualEditorOpen(true) }} size="sm" variant="primary"><Plus className="size-3.5" />Build manually</Button><Button disabled={props.running} onClick={props.onCreateCampaign} size="sm" variant="ghost"><Sparkles className="size-3.5" />Create with AI</Button></div>
        </div>

        <h4 className="mt-5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Saved AI campaigns</h4>

        {props.campaignLoading ? <div className="mt-4 rounded-xl border border-border-soft bg-black/10 p-4 text-[10px] text-text-muted">Loading saved campaigns…</div> : props.campaignError ? <div className="mt-4 rounded-xl border border-brand-red/20 bg-brand-red/[.05] p-4 text-[10px] text-brand-red">{props.campaignError}</div> : props.campaigns.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {props.campaigns.map((campaign) => {
            const visualReady = campaign.counts.withImages === campaign.counts.imagePosts
            return <button className="group rounded-xl border border-border-soft bg-black/10 p-3 text-left transition hover:-translate-y-0.5 hover:border-brand-cyan/30 hover:bg-brand-cyan/[.025]" disabled={props.running} key={campaign.id} onClick={() => props.onCampaignSelect(campaign)} type="button">
              <div className="flex items-start justify-between gap-2"><span className="rounded-full border border-brand-purple/20 bg-brand-purple/[.06] px-2 py-1 text-[8px] font-semibold text-[#c4b5fd]">{campaignModeLabel(campaign.contentMode)}</span><span className={`text-[8px] font-semibold ${visualReady ? 'text-brand-green' : 'text-brand-amber'}`}>{visualReady ? 'Ready' : `${campaign.counts.imagePosts - campaign.counts.withImages} visual${campaign.counts.imagePosts - campaign.counts.withImages === 1 ? '' : 's'} needed`}</span></div>
              <strong className="mt-2 block truncate text-[11px]">{campaign.title}</strong>
              <span className="mt-1 block text-[9px] text-text-muted">{campaign.postCount} posts · {campaign.counts.textPosts} text · {campaign.counts.imagePosts} image</span>
            </button>
          })}
        </div> : <div className="mt-4 rounded-xl border border-dashed border-border-soft p-5 text-center"><Megaphone className="mx-auto size-5 text-brand-cyan" /><strong className="mt-2 block text-[11px]">No AI campaigns yet</strong><p className="mt-1 text-[9px] text-text-muted">Create one in AI Content Studio, generate any required images, then it will appear here automatically.</p></div>}
      </div>}

      {campaignMode && campaignImport?.source === 'manual' && <div className="mt-4 rounded-2xl border border-brand-cyan/20 bg-brand-cyan/[.025] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-sm">{campaignImport.title || 'Manual campaign'}</strong><span className="mt-1 block text-xs text-text-muted">{campaignImport.total} posts · {campaignImport.textPosts} text · {campaignImport.imagePosts} media · {campaignImport.orderMode === 'custom' ? 'As arranged' : 'Alternating text and media'}</span></div><Button disabled={props.running} onClick={() => setManualEditorOpen(true)} size="sm" variant="primary">Edit campaign</Button></div>
        <p className="mt-2 text-[11px] text-text-muted">Your posts and captions are in the editor. Choose destinations and timing below. Files stay in this browser session until you publish or schedule.</p>
        <Button className="mt-2" disabled={props.running} onClick={props.onCampaignClear} size="sm" variant="ghost">Choose another campaign</Button>
      </div>}

      {campaignMode && campaignImport?.source === 'ai' && <div className="mt-4 rounded-2xl border border-brand-cyan/20 bg-brand-cyan/[.025] p-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><span className="text-[9px] font-bold uppercase tracking-[.1em] text-brand-cyan">Campaign loaded</span><strong className="mt-1 block text-sm">{campaignImport.title}</strong><span className="mt-1 block text-[9px] text-text-muted">{campaignImport.total} posts · {campaignImport.textPosts} text · {campaignImport.imagePosts} image</span></div>
          <Button disabled={props.running} onClick={props.onCampaignClear} size="sm" variant="ghost">Choose another campaign</Button>
        </div>
        <div className="scrollbar-thin mt-3 flex gap-2 overflow-x-auto pb-2">
          {campaignImport.posts.map((post) => <article className="w-[180px] shrink-0 overflow-hidden rounded-xl border border-border-soft bg-bg/45" key={post.id}>
            {post.contentType === 'IMAGE' && post.thumbnailUrl ? <img alt="" className="h-24 w-full object-cover" src={post.thumbnailUrl} /> : <div className="grid h-16 place-items-center bg-[linear-gradient(145deg,rgba(45,212,191,.08),rgba(5,20,31,.7))]"><FileText className="size-5 text-brand-cyan" /></div>}
            <div className="p-2.5"><div className="flex items-center gap-1.5"><span className="text-[9px] font-bold text-brand-cyan">{String(post.sequence).padStart(2, '0')}</span><span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[7px] font-semibold ${post.contentType === 'IMAGE' ? 'border-brand-purple/20 text-[#c4b5fd]' : 'border-brand-cyan/20 text-brand-cyan'}`}>{post.contentType === 'IMAGE' ? <ImageIcon className="size-2.5" /> : <FileText className="size-2.5" />}{post.contentType === 'IMAGE' ? 'Image' : 'Text'}</span></div><p className="mt-1.5 line-clamp-3 text-[8px] leading-4 text-text-muted">{post.caption}</p></div>
          </article>)}
        </div>
      </div>}

      {(!campaignMode || campaignImport) && <>
        <div className={`mt-4 grid gap-4 ${needsDate ? '' : 'lg:grid-cols-2'}`}>
          <TimingModeSelect onChange={props.onTimingModeChange} value={props.timingMode} />
          {needsDate ? (
            <div className="grid gap-2 sm:grid-cols-[minmax(0,.72fr)_minmax(0,1.28fr)]">
              <label><span className="mb-1.5 block text-xs font-medium text-text-muted">Start date</span><input className="min-h-11 w-full rounded-xl border border-border-soft bg-bg/65 px-3 text-sm focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/20" disabled={props.running} onChange={(event) => props.onScheduleDateChange(event.target.value)} type="date" value={props.scheduleDate} /></label>
              {props.timingMode === 'schedule_time'
                ? <DailyTimeSelector disabled={props.running} onAdd={props.onScheduleTimeAdd} onRemove={props.onScheduleTimeRemove} onSaveForFuture={props.onSaveScheduleTimes} savedTimes={props.savedScheduleTimes} times={props.scheduleTimes} />
                : <div><span className="mb-1.5 block text-xs font-medium text-text-muted">Saved posting times</span><div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-border-soft bg-bg/40 px-3 py-2">{props.savedScheduleTimes.map((time) => <span className="rounded-lg border border-brand-teal/20 bg-brand-teal/8 px-2.5 py-1 text-xs font-semibold text-brand-cyan" key={time}>{time}</span>)}</div><p className="mt-1.5 text-[10px] leading-4 text-text-soft">Account timezone: {props.timezone.replaceAll('_', ' ')} · <Link className="text-brand-cyan hover:underline" to="/settings">Change saved times</Link></p></div>}
            </div>
          ) : <div className="flex min-h-11 items-end text-xs leading-5 text-text-muted">{props.timingMode === 'publish_now' ? (campaignImport ? 'Each campaign post is routed to compatible selected destinations and sent in campaign order.' : textMode ? 'Each text post is sent securely for immediate publishing.' : 'Each image or video publishes after the provider accepts the upload.') : 'Choose when this batch should publish.'}</div>}
        </div>

        {needsDate && (
          <div className="mt-3 space-y-3 rounded-xl border border-brand-cyan/20 bg-brand-cyan/[.045] px-3.5 py-3 text-xs leading-5 text-text-muted">
            <div><strong className="text-text-main">Scheduled publishing:</strong>{' '}Every post receives its own scheduled time from the start date and daily times above. INX Social keeps the schedule visible until publishing begins.</div>
            <label className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${props.smartTiming ? 'border-brand-purple/40 bg-brand-purple/[.08]' : 'border-border-soft bg-black/10'} ${props.running ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-brand-purple/30'}`}>
              <input checked={props.smartTiming} className="mt-0.5 size-4 accent-brand-purple" disabled={props.running} onChange={(event) => props.onSmartTimingChange(event.target.checked)} type="checkbox" />
              <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-purple" />
              <span><span className="block text-xs font-semibold text-text-main">Smart Timing</span><span className="mt-0.5 block text-[11px] leading-4 text-text-muted">AI analyses your selected accounts and existing performance, then safely adjusts each exact publishing time around the times you chose. The final time appears in Calendar.</span></span>
            </label>
          </div>
        )}

        {campaignImport ? <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-brand-cyan/20 bg-brand-cyan/[.035] p-3">
          <div><span className="text-[9px] uppercase tracking-[.08em] text-text-soft">Campaign</span><strong className="mt-1 block text-sm">{campaignImport.total} posts</strong></div>
          <div><span className="text-[9px] uppercase tracking-[.08em] text-text-soft">Text</span><strong className="mt-1 block text-sm">{campaignImport.textPosts}</strong></div>
          <div><span className="text-[9px] uppercase tracking-[.08em] text-text-soft">Media</span><strong className="mt-1 block text-sm text-brand-cyan">{campaignImport.imagePosts}</strong></div>
        </div> : <>
          <div className="mt-4"><CaptionInput captionCount={props.captionCount} contentMode={props.contentMode} mediaCount={props.media.length} onChange={props.onCaptionsChange} onFallbackChange={props.onFallbackChange} useFallback={props.useFallback} value={props.captions} /></div>
          <div className="mt-4"><SessionSummary captionCount={props.captionCount} contentMode={props.contentMode} media={props.media} scheduleTimes={props.scheduleTimes} selectedDestinations={props.selectedDestinations} timingMode={props.timingMode} /></div>
        </>}

        {!campaignImport && !textMode && <label className={`mt-4 flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${props.retainMedia ? 'border-brand-teal/45 bg-brand-teal/8' : 'border-border-soft bg-bg/35'} ${exceedsLibraryLimit ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-brand-teal/30'}`}>
          <input checked={props.retainMedia && !exceedsLibraryLimit} className="mt-0.5 size-4 accent-brand-teal" disabled={props.running || exceedsLibraryLimit || !props.media.length} onChange={(event) => props.onRetainMediaChange(event.target.checked)} type="checkbox" />
          <HardDrive aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-teal" />
          <span><span className="block text-xs font-semibold text-text-main">Save selected media to Media Library for reuse</span><span className="mt-0.5 block text-[11px] leading-4 text-text-muted">Off by default. One deduplicated copy is stored and linked to every resulting post.{exceedsLibraryLimit ? ' Files over 100 MB remain temporary.' : ''}</span></span>
        </label>}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button className="sm:w-auto" disabled={props.running || (!campaignImport && !props.media.length && !props.captions)} onClick={props.onClear} type="button" variant="ghost"><RotateCcw aria-hidden="true" className="size-4" /> Clear session</Button>
          <Button className="flex-1" disabled={!props.canStart || props.running} onClick={props.onStart} type="button" variant="primary"><Play aria-hidden="true" className="size-4 fill-current" /> {campaignImport ? props.timingMode === 'publish_now' ? 'Publish Campaign' : 'Schedule Campaign' : textMode ? 'Start Text Batch' : 'Start Upload'}</Button>
        </div>
        {!props.canStart && <p className="mt-2 text-center text-xs text-text-soft">{props.disabledReason}</p>}
      </>}
      {campaignMode && campaignImport?.source === 'manual' && manualEditorOpen && <ManualCampaignEditor campaign={campaignImport} onClose={() => setManualEditorOpen(false)} onMediaAdd={props.onManualMediaAdd} onOrderModeChange={props.onManualOrderModeChange} onPostEdit={props.onManualPostEdit} onPostMove={props.onManualPostMove} onPostRemove={props.onManualPostRemove} onTextAdd={props.onManualTextAdd} onTitleChange={props.onManualCampaignTitleChange} running={props.running} />}
    </section>
  )
}
