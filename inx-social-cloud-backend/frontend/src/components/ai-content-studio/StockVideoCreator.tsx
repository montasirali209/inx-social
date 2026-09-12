import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { ArrowRight, Captions, Check, Clapperboard, Database, Film, LoaderCircle, Mic2, Save, Sparkles, TimerReset, WandSparkles, X } from 'lucide-react'
import type { AIDraft, GeneratedAsset } from '../../types/ai-content-studio'
import { getGenerationStatus, saveAIDraft } from '../../lib/ai-content-studio-api'
import { generateStockVideo, getStockVideoAccess, type StockVideoAccess, type StockVideoSelection, type VideoAspectRatio } from '../../lib/ai-next-studio-api'
import { Button } from '../ui/Button'
import { StudioSelect } from './StudioSelect'

const ACTIVE_JOB_KEY = 'inx-social-stock-video-active-job-v1'

function buildDraft(asset: GeneratedAsset, prompt: string, existing?: AIDraft | null): AIDraft {
  return {
    id: existing?.id || crypto.randomUUID(), contentType: 'short_video', title: (asset.caption || prompt || 'Stock video').slice(0, 70),
    thumbnailUrl: asset.thumbnailUrl || asset.url, updatedAt: new Date().toISOString(), status: 'ready', prompt: prompt.slice(0, 1500),
    caption: asset.caption || '', hashtags: asset.hashtags || [], altText: '', asset,
    mediaLibraryAsset: existing?.mediaLibraryAsset || null, mediaLibraryAssets: existing?.mediaLibraryAssets || [],
  }
}

export function StockVideoCreator({ initialDraft, onClose, onSwitchToGenerative, onSaved, onContinue, onToast }: {
  initialDraft?: AIDraft | null
  onClose: () => void
  onSwitchToGenerative: () => void
  onSaved: (draft: AIDraft) => void
  onContinue: (draft: AIDraft) => void
  onToast: (message: string) => void
}) {
  const [access, setAccess] = useState<StockVideoAccess | null>(null)
  const [prompt, setPrompt] = useState(initialDraft?.prompt || '')
  const [duration, setDuration] = useState<15 | 30 | 45 | 60>(30)
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p')
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('9:16')
  const [tone, setTone] = useState<StockVideoSelection['tone']>('Natural')
  const [voiceover, setVoiceover] = useState(true)
  const [captions, setCaptions] = useState(true)
  const [jobId, setJobId] = useState(() => window.localStorage.getItem(ACTIVE_JOB_KEY) || '')
  const [progress, setProgress] = useState(0)
  const [asset, setAsset] = useState<GeneratedAsset | null>(() => initialDraft?.asset?.provider === 'OpenMontage stock workflow' ? initialDraft.asset : null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void getStockVideoAccess().then(value => { if (active) setAccess(value) }).catch(caught => { if (active) setError(caught instanceof Error ? caught.message : 'Stock Video Creator could not be loaded.') })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!jobId) return
    let active = true
    async function poll() {
      try {
        const result = await getGenerationStatus(jobId)
        if (!active) return
        setProgress(Number(result.progress || 0))
        if (result.status === 'completed' && result.asset) {
          setAsset(result.asset); setJobId(''); window.localStorage.removeItem(ACTIVE_JOB_KEY)
          setAccess(current => current ? { ...current, used: current.used + 1, remaining: Math.max(0, current.remaining - 1) } : current)
          onToast('Stock video created and saved to Media Library.')
          return
        }
        if (result.status === 'failed' || result.status === 'cancelled') {
          setError(result.error || 'Stock video creation failed.'); setJobId(''); window.localStorage.removeItem(ACTIVE_JOB_KEY)
          return
        }
        window.setTimeout(() => { if (active) void poll() }, 3000)
      } catch (caught) {
        if (!active) return
        setError(caught instanceof Error ? caught.message : 'Video progress could not be checked.'); setJobId('')
      }
    }
    void poll()
    return () => { active = false }
  }, [jobId, onToast])

  const working = Boolean(jobId)
  const unavailable = !access?.enabled || !access?.configured || !access?.remaining

  async function generate() {
    if (working || prompt.trim().length < 2 || unavailable) return
    setError(''); setAsset(null); setProgress(1)
    try {
      const job = await generateStockVideo({ prompt: prompt.trim(), duration, resolution, aspectRatio, tone, voiceover, captions })
      window.localStorage.setItem(ACTIVE_JOB_KEY, job.id); setJobId(job.id)
      onToast('Stock video production started. You can safely leave this screen while it renders.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Stock video production could not start.') }
  }

  async function saveDraft() {
    if (!asset) return
    try { const saved = await saveAIDraft(buildDraft(asset, prompt, initialDraft)); onSaved(saved); onToast('Stock video saved to drafts.') } catch (caught) { setError(caught instanceof Error ? caught.message : 'Draft could not be saved.') }
  }

  const durationOptions = [15, 30, 45, 60].map(value => ({ value, label: `${value} seconds`, meta: value === 30 ? 'Recommended social length' : value === 60 ? 'Full one-minute story' : 'Short-form video', icon: <Film className="size-3.5" /> }))
  const resolutionOptions = ['720p', '1080p'].map(value => ({ value, label: value, meta: value === '720p' ? 'Faster render · recommended' : 'Sharper final output', icon: <Film className="size-3.5" /> }))
  const aspectOptions = ['9:16', '1:1', '16:9'].map(value => ({ value, label: value, meta: value === '9:16' ? 'Reels / TikTok / Shorts' : value === '1:1' ? 'Square social feed' : 'Landscape video', icon: <Clapperboard className="size-3.5" /> }))
  const toneOptions = ['Natural', 'Friendly', 'Confident', 'Energetic', 'Professional', 'Cinematic'].map(value => ({ value, label: value, meta: 'Applied to script, pacing and footage selection' }))

  return createPortal(<div className="fixed inset-0 z-[100] grid place-items-center bg-[#01070d]/92 p-2 backdrop-blur-xl sm:p-5"><div className="flex h-[min(920px,95vh)] w-full max-w-[1540px] flex-col overflow-hidden rounded-[30px] border border-brand-green/25 bg-[radial-gradient(circle_at_12%_12%,rgba(16,185,129,.10),transparent_27%),linear-gradient(145deg,#061824,#020b13)] shadow-[0_44px_160px_rgba(0,0,0,.74)]">
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border-soft px-4 sm:px-6"><div><span className="text-[8px] font-bold uppercase tracking-[.18em] text-brand-green">Real stock footage · Plus benefit</span><h2 className="mt-1 text-base font-bold">Stock Video Creator <span className="font-medium text-text-soft">· OpenMontage workflow</span></h2></div><div className="flex items-center gap-2"><button className="rounded-xl border border-border-soft px-3 py-2 text-[9px] font-semibold text-text-muted transition hover:border-brand-cyan/30 hover:text-white" onClick={onSwitchToGenerative}>AI Generated Video</button><span className="rounded-full border border-brand-green/25 bg-brand-green/[.06] px-3 py-1 text-[9px] font-bold text-brand-green">{access ? `${access.remaining}/${access.limit} remaining` : 'Loading allowance…'}</span><button className="grid size-9 place-items-center rounded-xl border border-border-soft text-text-muted hover:text-white" onClick={onClose}><X className="size-4" /></button></div></header>
    <div className="grid min-h-0 flex-1 lg:grid-cols-[56%_44%]">
      <section className="min-h-0 overflow-y-auto border-r border-border-soft p-4 sm:p-5">
        <div className="rounded-[24px] border border-brand-green/20 bg-black/12 p-4"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-brand-green/25 bg-brand-green/10 text-brand-green"><WandSparkles className="size-5" /></span><div><h3 className="text-sm font-bold">One idea becomes a complete stock-footage video</h3><p className="mt-1 text-[9px] leading-4 text-text-muted">The workflow writes the script, plans scenes, finds real royalty-free clips, creates narration and captions, composes the edit and saves it to Media Library.</p></div></div><textarea className="mt-4 w-full resize-none rounded-2xl border border-brand-green/20 bg-bg/60 px-3.5 py-3 text-[11px] leading-5 outline-none focus:border-brand-green/45" maxLength={1500} onChange={event => setPrompt(event.target.value)} placeholder="e.g. Make a hopeful 30-second Reel about rebuilding confidence after a difficult year, using real people and city footage…" rows={6} value={prompt} /></div>
        <div className="mt-4 rounded-[24px] border border-border-soft bg-black/10 p-4"><span className="text-[8px] font-bold uppercase tracking-[.14em] text-text-soft">Production controls</span><div className="mt-3 grid gap-3 sm:grid-cols-2"><StudioSelect label="Duration" value={duration} options={durationOptions} onChange={value => setDuration(value as 15 | 30 | 45 | 60)} accent="green"/><StudioSelect label="Resolution" value={resolution} options={resolutionOptions} onChange={value => setResolution(value as '720p' | '1080p')} accent="cyan"/><StudioSelect label="Aspect ratio" value={aspectRatio} options={aspectOptions} onChange={value => setAspectRatio(value as VideoAspectRatio)} accent="violet"/><StudioSelect label="Tone" value={tone} options={toneOptions} onChange={value => setTone(value as StockVideoSelection['tone'])} accent="amber"/></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><button className={`flex items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${voiceover ? 'border-brand-green/35 bg-brand-green/[.07]' : 'border-border-soft bg-white/[.025]'}`} onClick={() => setVoiceover(value => !value)}><span className="flex items-center gap-2"><Mic2 className="size-4 text-brand-green"/><span><strong className="block text-[9px]">AI narration</strong><span className="text-[8px] text-text-soft">Natural voiceover from the generated script</span></span></span><Check className={`size-4 ${voiceover ? 'text-brand-green' : 'text-text-soft/25'}`}/></button><button className={`flex items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${captions ? 'border-brand-cyan/35 bg-brand-cyan/[.07]' : 'border-border-soft bg-white/[.025]'}`} onClick={() => setCaptions(value => !value)}><span className="flex items-center gap-2"><Captions className="size-4 text-brand-cyan"/><span><strong className="block text-[9px]">Burned-in captions</strong><span className="text-[8px] text-text-soft">Readable subtitles included in the MP4</span></span></span><Check className={`size-4 ${captions ? 'text-brand-cyan' : 'text-text-soft/25'}`}/></button></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-[20px] border border-border-soft bg-white/[.02] p-3 text-[9px] leading-4 text-text-muted"><div className="flex items-center gap-2 text-white"><Database className="size-4 text-brand-green"/><strong>Licensed-source provenance included</strong></div><p className="mt-1">Every production records its stock provider, contributor and original source.</p><a className="mt-2 inline-block text-brand-cyan hover:underline" href="https://github.com/calesthio/OpenMontage" rel="noreferrer" target="_blank">OpenMontage project ↗</a></div><div className="rounded-[20px] border border-amber-400/20 bg-amber-400/[.035] p-3 text-[9px] leading-4 text-text-muted"><div className="flex items-center gap-2 text-white"><TimerReset className="size-4 text-amber-300"/><strong>10-day video storage</strong></div><p className="mt-1">Download or publish the finished MP4 within 10 days. It is then automatically removed to control large-file storage.</p></div></div>
        {!access?.enabled && access && <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/[.06] p-3 text-[9px] text-amber-200">Stock Video Creator is included with the Plus plan.</div>}
        {access?.enabled && !access.configured && <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/[.06] p-3 text-[9px] text-amber-200">Stock footage providers are being configured. This creator will become available when setup is complete.</div>}
        {error && <div className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/[.06] p-3 text-[9px] text-red-200">{error}</div>}
      </section>
      <section className="flex min-h-0 flex-col bg-black/10 p-4 sm:p-5"><div className="min-h-0 flex-1 overflow-y-auto rounded-[26px] border border-border-soft bg-[radial-gradient(circle_at_50%_25%,rgba(16,185,129,.08),transparent_43%)] p-4">
        {!asset && !working && <div className="grid h-full min-h-[470px] place-items-center text-center"><div className="max-w-md"><span className="mx-auto grid size-16 place-items-center rounded-[22px] border border-brand-green/25 bg-brand-green/[.07] text-brand-green"><Clapperboard className="size-7"/></span><h3 className="mt-5 text-lg font-bold">Your finished stock video appears here.</h3><p className="mt-2 text-[10px] leading-5 text-text-muted">Real clips, automatic script, scene selection, narration and captions—without spending your AI video-generation credits.</p></div></div>}
        {working && <div className="grid h-full min-h-[470px] place-items-center text-center"><div className="w-full max-w-sm"><LoaderCircle className="mx-auto size-10 animate-spin text-brand-green"/><h3 className="mt-4 text-base font-bold">Producing your stock video…</h3><p className="mt-2 text-[9px] text-text-muted">Planning scenes, retrieving footage and composing the final edit.</p><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-brand-green to-brand-cyan transition-all duration-700" style={{ width: `${Math.max(3, progress)}%` }}/></div><strong className="mt-2 block text-[10px] text-brand-green">{progress}%</strong><p className="mt-4 text-[8px] text-text-soft">You can leave this screen. The production continues and resumes here when you return.</p></div></div>}
        {asset && <div><video className="max-h-[560px] w-full rounded-2xl bg-black object-contain" controls src={asset.url}/><div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[.04] px-3 py-2 text-[8px] text-amber-100"><TimerReset className="size-3.5"/>Available in Media Library for 10 days. Download or publish it before automatic removal.</div><div className="mt-3 rounded-2xl border border-border-soft bg-bg/35 p-4"><span className="text-[8px] font-bold uppercase tracking-[.13em] text-brand-green">Complete post package</span><p className="mt-2 text-[10px] leading-5">{asset.caption}</p>{asset.hashtags?.length ? <p className="mt-2 text-[9px] text-text-muted">{asset.hashtags.map(tag => `#${tag.replace(/^#/, '')}`).join(' ')}</p> : null}<div className="mt-3 flex flex-wrap gap-1.5">{asset.provenance?.map(item => <a className="rounded-full border border-white/10 px-2 py-1 text-[8px] text-text-soft hover:border-brand-cyan/30 hover:text-white" href={item.sourceUrl} key={`${item.provider}:${item.providerId}`} rel="noreferrer" target="_blank">{item.creator} · {item.provider}</a>)}</div></div></div>}
      </div><div className="mt-4 grid gap-2 sm:grid-cols-3"><Button disabled={!asset} onClick={() => void saveDraft()}><Save className="size-3.5"/>Save draft</Button><Button disabled={!asset} onClick={() => asset && onContinue(buildDraft(asset, prompt, initialDraft))}>Post / Schedule <ArrowRight className="size-3.5"/></Button><Button variant="primary" disabled={working || unavailable || prompt.trim().length < 2} onClick={() => void generate()}><Sparkles className="size-3.5"/>{working ? 'Producing…' : 'Create stock video'}</Button></div></section>
    </div>
  </div></div>, document.body)
}
