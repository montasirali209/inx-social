import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { ArrowRight, Check, Clapperboard, Film, Gauge, ImagePlus, LoaderCircle, Save, Sparkles, Upload, WandSparkles, X, Zap } from 'lucide-react'
import type { AIDraft, AIContentType, AIPlanAccess, GeneratedAsset } from '../../types/ai-content-studio'
import { uploadMediaAsset } from '../../lib/media-library-api'
import { saveAIDraft } from '../../lib/ai-content-studio-api'
import {
  estimateVideoCredits,
  generateStudioVideo,
  getVideoModels,
  recommendVideoModel,
  type VideoAspectRatio,
  type VideoModelOption,
  type VideoResolution,
  type VideoStudioSelection,
} from '../../lib/ai-next-studio-api'
import { sendPostStudioMessage, type PostStudioBrief } from '../../lib/ai-post-studio-api'
import { Button } from '../ui/Button'
import { StudioSelect } from './StudioSelect'
import { StockVideoCreator } from './StockVideoCreator'

function extractUrls(text: string) {
  return [...new Set((text.match(/https?:\/\/[^\s<>()]+/gi) || []).map((value) => value.replace(/[.,;!?]+$/, '')))].slice(0, 2)
}

function buildDraft(asset: GeneratedAsset, prompt: string, brief: PostStudioBrief | null, existing?: AIDraft | null): AIDraft {
  return {
    id: existing?.id || crypto.randomUUID(), contentType: 'short_video', title: (brief?.headline || prompt || 'AI video').slice(0, 70),
    thumbnailUrl: asset.thumbnailUrl || asset.url, updatedAt: new Date().toISOString(), status: 'ready', prompt: prompt.slice(0, 1500),
    caption: brief?.caption || asset.caption || '', hashtags: brief?.hashtags || asset.hashtags || [], altText: '',
    asset: { ...asset, caption: brief?.caption || asset.caption || '', hashtags: brief?.hashtags || asset.hashtags || [] },
    mediaLibraryAsset: existing?.mediaLibraryAsset || null, mediaLibraryAssets: existing?.mediaLibraryAssets || [],
  }
}

function ModeButton({ active, icon, title, text, onClick, busy }: { active: boolean; icon: ReactNode; title: string; text: string; onClick: () => void; busy?: boolean }) {
  return <button type="button" disabled={busy} onClick={onClick} className={`group relative overflow-hidden rounded-[20px] border p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01] disabled:opacity-50 ${active ? 'border-brand-cyan/45 bg-[linear-gradient(145deg,rgba(0,214,192,.11),rgba(4,23,34,.92))] shadow-[0_18px_60px_rgba(0,214,192,.10)]' : 'border-border-soft bg-black/12 hover:border-brand-cyan/25'}`}>
    <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
    <span className={`grid size-8 place-items-center rounded-xl border ${active ? 'border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan' : 'border-white/7 bg-white/[.03] text-text-muted'}`}>{icon}</span>
    <strong className="mt-2 block text-[10px] text-white">{title}</strong><span className="mt-1 block text-[8px] leading-4 text-text-muted">{text}</span>
  </button>
}

export function VideoStudioModal({ open, type, access, initialDraft, onClose, onSaved, onContinue, onToast }: { open: boolean; type: AIContentType | null; access: AIPlanAccess; initialDraft?: AIDraft | null; onClose: () => void; onSaved: (draft: AIDraft) => void; onContinue: (draft: AIDraft) => void; onToast: (message: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [models, setModels] = useState<VideoModelOption[]>([])
  const [prompt, setPrompt] = useState(initialDraft?.prompt || '')
  const [brief, setBrief] = useState<PostStudioBrief | null>(null)
  const [mode, setMode] = useState<'recommended' | 'fast' | 'manual'>('recommended')
  const [modelRoute, setModelRoute] = useState('pvideo')
  const [duration, setDuration] = useState(5)
  const [resolution, setResolution] = useState<VideoResolution>('720p')
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('9:16')
  const [draft, setDraft] = useState(false)
  const [audio, setAudio] = useState(true)
  const [sourceAsset, setSourceAsset] = useState<{ id: string; fileName: string } | null>(null)
  const [asset, setAsset] = useState<GeneratedAsset | null>(() => initialDraft?.asset?.type === 'video' ? initialDraft.asset : null)
  const [credits, setCredits] = useState(10)
  const [recommendation, setRecommendation] = useState('')
  const [recommending, setRecommending] = useState(false)
  const [polishing, setPolishing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [studioKind, setStudioKind] = useState<'generative' | 'stock'>(() => initialDraft?.asset?.provider === 'OpenMontage stock workflow' ? 'stock' : 'generative')

  const selected = useMemo(() => models.find((item) => item.id === modelRoute) || models[0], [models, modelRoute])
  const selection = useMemo<VideoStudioSelection>(() => ({ modelRoute, duration, resolution, aspectRatio, draft, audio }), [modelRoute, duration, resolution, aspectRatio, draft, audio])
  const insufficient = access.creditsConfigured && !access.unlimitedCredits && access.creditsRemaining !== null && access.creditsRemaining < credits

  useEffect(() => {
    if (!open || (type !== 'short_video' && initialDraft?.contentType !== 'short_video')) return
    let active = true
    void getVideoModels().then((value) => { if (active) setModels(value) }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Video models could not be loaded.') })
    return () => { active = false }
  }, [open, type, initialDraft?.contentType])

  useEffect(() => {
    if (!open || !selected) return
    let active = true
    const timer = window.setTimeout(() => {
      void estimateVideoCredits(selection).then((value) => { if (active) setCredits(value.credits) }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Video credits could not be estimated.') })
    }, 220)
    return () => { active = false; window.clearTimeout(timer) }
  }, [open, selected, selection])

  if (!open || (type !== 'short_video' && initialDraft?.contentType !== 'short_video')) return null

  if (studioKind === 'stock') return <StockVideoCreator initialDraft={initialDraft} onClose={onClose} onSwitchToGenerative={() => setStudioKind('generative')} onSaved={onSaved} onContinue={onContinue} onToast={onToast} />

  function applyModel(model: VideoModelOption, preferred?: Partial<VideoStudioSelection>) {
    setModelRoute(model.id)
    const nextDuration = preferred?.duration && model.durations.includes(preferred.duration) ? preferred.duration : (model.durations.includes(duration) ? duration : model.durations[0])
    const nextResolution = preferred?.resolution && model.resolutions.includes(preferred.resolution) ? preferred.resolution : (model.resolutions.includes(resolution) ? resolution : (model.resolutions.includes('720p') ? '720p' : model.resolutions[0]))
    const nextAspect = preferred?.aspectRatio && model.aspects.includes(preferred.aspectRatio) ? preferred.aspectRatio : (model.aspects.includes(aspectRatio) ? aspectRatio : model.aspects[0])
    setDuration(nextDuration); setResolution(nextResolution); setAspectRatio(nextAspect)
    setAudio(model.audioSupported ? preferred?.audio !== false : false)
    setDraft(model.draftSupported ? Boolean(preferred?.draft) : false)
  }

  async function analyseBrief() {
    if (prompt.trim().length < 2) throw new Error('Describe the video first so AI can analyse it.')
    const result = await sendPostStudioMessage({
      messages: [{ role: 'user', content: `Analyse this idea as a short-form video/Reel brief. Use any supplied URL or reference image as evidence. Focus on hook, scene progression, motion, camera direction, pacing, audience and production needs. Do not generate the video yet.\n\n${prompt}` }],
      urls: extractUrls(prompt), referenceAssetIds: sourceAsset ? [sourceAsset.id] : [],
      platform: aspectRatio === '9:16' ? 'Instagram Reels / TikTok' : 'Social video', aspectRatio,
    })
    setBrief(result.brief)
    return result.brief
  }

  async function recommend() {
    if (prompt.trim().length < 2 || recommending) return
    setMode('recommended'); setRecommending(true); setError(''); setRecommendation('')
    try {
      const analysed = await analyseBrief()
      const routingPrompt = [prompt.trim(), analysed.visualDirection ? `Creative direction: ${analysed.visualDirection}` : '', analysed.supportingCopy ? `Story: ${analysed.supportingCopy}` : ''].filter(Boolean).join('\n')
      const result = await recommendVideoModel({ prompt: routingPrompt.slice(0, 1500), hasReference: Boolean(sourceAsset), aspectRatio })
      const model = models.find((item) => item.id === result.modelRoute)
      if (!model) throw new Error('The recommended model is temporarily unavailable.')
      applyModel(model, result); setRecommendation(result.reason); onToast(`${model.name} recommended for this video brief.`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'AI could not recommend a video model.') } finally { setRecommending(false) }
  }

  function chooseFast() {
    setMode('fast'); setRecommendation('Fast mode uses the best low-cost everyday route for quick social-video generation.')
    const model = models.find((item) => item.id === 'pvideo') || models[0]
    if (model) applyModel(model, { duration: 5, resolution: model.resolutions.includes('720p') ? '720p' : model.resolutions[0], aspectRatio, audio: true, draft: false })
  }

  function chooseManual() { setMode('manual'); setRecommendation('Choose the model yourself. INXSocial recalculates the credit cost whenever you change the model or controls.') }

  async function polishWithAI() {
    if (prompt.trim().length < 2 || polishing) return
    setPolishing(true); setError('')
    try {
      const result = await analyseBrief()
      if (result.visualDirection) setPrompt(result.visualDirection.slice(0, 1500))
      onToast('Video brief analysed and polished.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The AI creative brief could not be prepared.') } finally { setPolishing(false) }
  }

  async function uploadSource(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
    if (!file.type.startsWith('image/')) { setError('Upload an image, product shot or first-frame reference.'); return }
    setUploading(true); setError('')
    try { const stored = await uploadMediaAsset(file, null, () => {}); setSourceAsset({ id: stored.id, fileName: stored.fileName }); onToast('Video reference image added.') } catch (caught) { setError(caught instanceof Error ? caught.message : 'Reference upload failed.') } finally { setUploading(false) }
  }

  async function generate() {
    if (prompt.trim().length < 2 || generating || insufficient || !selected) return
    setGenerating(true); setError('')
    try {
      const result = await generateStudioVideo({ ...selection, prompt: prompt.trim(), sourceMediaLibraryAssetId: sourceAsset?.id || null, caption: brief?.caption || '', hashtags: brief?.hashtags || [], script: brief?.supportingCopy || '' })
      setAsset(result); onToast(`Video created · ${result.creditsUsed} credits used.`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Video generation failed.') } finally { setGenerating(false) }
  }

  async function saveDraft() {
    if (!asset) return
    try { const saved = await saveAIDraft(buildDraft(asset, prompt, brief, initialDraft)); onSaved(saved); onToast('Video saved to drafts.') } catch (caught) { setError(caught instanceof Error ? caught.message : 'Draft could not be saved.') }
  }
  function continueToPosts() { if (asset) onContinue(buildDraft(asset, prompt, brief, initialDraft)) }

  const modelOptions = models.map((model) => ({ value: model.id, label: model.name, description: model.description, meta: `${model.badge} · ${model.resolutions.join(' / ')}`, icon: model.speed === 'fast' ? <Zap className="size-3.5" /> : model.speed === 'premium' ? <Sparkles className="size-3.5" /> : <Film className="size-3.5" /> }))
  const durationOptions = (selected?.durations || []).map((value) => ({ value, label: `${value} seconds`, meta: value <= 5 ? 'Quick social clip' : value >= 15 ? 'Longer story' : 'Balanced length', icon: <Gauge className="size-3.5" /> }))
  const resolutionOptions = (selected?.resolutions || []).map((value) => ({ value, label: value, meta: value === '1080p' ? 'Sharper · higher credit use' : value === '480p' ? 'Lower cost' : 'Recommended balance', icon: <Film className="size-3.5" /> }))
  const aspectOptions = (selected?.aspects || []).map((value) => ({ value, label: value, meta: value === '9:16' ? 'Reels / TikTok / Shorts' : value === '16:9' ? 'Landscape video' : 'Square social', icon: <Film className="size-3.5" /> }))
  const audioOptions = [{ value: 'on', label: 'Native audio on', meta: 'Generate sound when the model supports it' }, { value: 'off', label: 'Silent video', meta: 'Visual-only generation' }]

  return createPortal(<div className="fixed inset-0 z-[100] grid place-items-center bg-[#01070d]/92 p-2 backdrop-blur-xl sm:p-5"><div className="flex h-[min(920px,95vh)] w-full max-w-[1540px] flex-col overflow-hidden rounded-[30px] border border-brand-cyan/25 bg-[radial-gradient(circle_at_12%_12%,rgba(0,214,192,.09),transparent_27%),linear-gradient(145deg,#061824,#020b13)] shadow-[0_44px_160px_rgba(0,0,0,.74)]">
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border-soft px-4 sm:px-6"><div><span className="text-[8px] font-bold uppercase tracking-[.18em] text-brand-cyan">Generative Video</span><h2 className="mt-1 text-base font-bold">AI Video Studio <span className="font-medium text-text-soft">· Reel / Video</span></h2></div><div className="flex items-center gap-2"><button className="rounded-xl border border-brand-green/25 bg-brand-green/[.05] px-3 py-2 text-[9px] font-semibold text-brand-green transition hover:-translate-y-0.5 hover:bg-brand-green/10" onClick={() => setStudioKind('stock')}><Clapperboard className="mr-1.5 inline size-3.5"/>Stock Video Creator</button><span className="rounded-full border border-amber-400/25 bg-amber-400/[.06] px-3 py-1 text-[9px] font-bold text-amber-300">{credits} credits</span><button className="grid size-9 place-items-center rounded-xl border border-border-soft text-text-muted transition hover:-translate-y-0.5 hover:border-brand-cyan/30 hover:text-white" onClick={onClose}><X className="size-4"/></button></div></header>
    <div className="grid min-h-0 flex-1 lg:grid-cols-[57%_43%]">
      <section className="min-h-0 overflow-y-auto border-r border-border-soft p-4 sm:p-5">
        <div className="rounded-[24px] border border-border-soft bg-black/12 p-4 shadow-[inset_0_1px_rgba(255,255,255,.025)]"><div className="flex items-center justify-between gap-3"><div><span className="text-[8px] font-bold uppercase tracking-[.14em] text-text-soft">Creative brief</span><h3 className="mt-1 text-sm font-bold">Describe the video you want</h3></div><Button size="sm" variant="secondary" disabled={polishing || prompt.trim().length < 2} onClick={() => void polishWithAI()}>{polishing ? <LoaderCircle className="size-3.5 animate-spin"/> : <Sparkles className="size-3.5"/>}AI analyse & polish</Button></div><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} className="mt-3 w-full resize-none rounded-2xl border border-brand-cyan/20 bg-bg/60 px-3.5 py-3 text-[11px] leading-5 outline-none transition focus:-translate-y-0.5 focus:border-brand-cyan/45 focus:shadow-[0_16px_50px_rgba(0,214,192,.06)]" placeholder="e.g. Create a fast-paced 9:16 Reel showing the creator workflow from upload to scheduled posts. Start with a strong hook, show product UI, finish on the CTA…"/><p className="mt-2 text-[8px] text-text-soft">Paste a product URL here or upload a reference image below. AI Recommended analyses them before choosing a model.</p></div>

        <div className="mt-4"><span className="text-[8px] font-bold uppercase tracking-[.14em] text-text-soft">Generation route</span><h3 className="mt-1 text-sm font-bold">Keep model choice simple</h3><div className="mt-3 grid gap-2 sm:grid-cols-3"><ModeButton active={mode === 'recommended'} busy={recommending} icon={recommending ? <LoaderCircle className="size-4 animate-spin"/> : <Sparkles className="size-4"/>} title="AI Recommended" text="Analyse the brief first, then choose the best quality-to-cost model." onClick={() => void recommend()}/><ModeButton active={mode === 'fast'} icon={<Zap className="size-4"/>} title="Fast" text="A good everyday model when speed and lower credit use matter." onClick={chooseFast}/><ModeButton active={mode === 'manual'} icon={<Film className="size-4"/>} title="Manual model" text="Choose the generation model yourself without cluttering the main workflow." onClick={chooseManual}/></div></div>

        {recommendation && <div className="mt-3 rounded-[20px] border border-brand-green/20 bg-brand-green/[.045] p-3.5"><div className="flex items-start gap-2.5"><span className="grid size-8 shrink-0 place-items-center rounded-xl border border-brand-green/20 bg-brand-green/10 text-brand-green"><Check className="size-4"/></span><div><span className="text-[8px] font-bold uppercase tracking-[.13em] text-brand-green">{mode === 'recommended' ? 'AI recommendation' : mode === 'fast' ? 'Fast route' : 'Manual control'}</span><p className="mt-1 text-[9px] leading-4 text-text-muted">{recommendation}</p>{selected && <strong className="mt-1 block text-[10px] text-white">Current model: {selected.name}</strong>}</div></div></div>}

        {mode === 'manual' && <div className="mt-4 rounded-[22px] border border-border-soft bg-black/10 p-4"><StudioSelect label="Manual model" value={modelRoute} options={modelOptions} onChange={(value) => { const model = models.find((item) => item.id === value); if (model) applyModel(model) }} accent="violet"/></div>}

        {selected && <div className="mt-4 rounded-[24px] border border-border-soft bg-black/10 p-4"><div className="flex items-center justify-between gap-3"><div><span className="text-[8px] font-bold uppercase tracking-[.14em] text-text-soft">Generation controls</span><h3 className="mt-1 text-sm font-bold">{selected.name}</h3></div><span className="rounded-full border border-brand-cyan/20 bg-brand-cyan/[.05] px-2.5 py-1 text-[8px] font-semibold text-brand-cyan">Live credit estimate · {credits}</span></div><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StudioSelect label="Duration" value={duration} options={durationOptions} onChange={setDuration} accent="cyan"/><StudioSelect label="Resolution" value={resolution} options={resolutionOptions} onChange={setResolution} accent="green"/><StudioSelect label="Aspect ratio" value={aspectRatio} options={aspectOptions} onChange={setAspectRatio} accent="violet"/><StudioSelect label="Audio" value={audio ? 'on' : 'off'} options={audioOptions} onChange={(value) => setAudio(value === 'on')} disabled={!selected.audioSupported} accent="amber"/></div>{!selected.audioSupported && <p className="mt-2 text-[8px] text-text-soft">This model generates visual video only in the current INXSocial integration.</p>}{selected.draftSupported && <button type="button" onClick={() => setDraft((value) => !value)} className={`mt-3 flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition-all duration-300 hover:-translate-y-0.5 ${draft ? 'border-brand-cyan/35 bg-brand-cyan/[.07] shadow-[0_12px_38px_rgba(0,214,192,.07)]' : 'border-border-soft bg-white/[.025]'}`}><span><strong className="block text-[9px]">Draft preview</strong><span className="text-[8px] text-text-soft">Lower-cost motion preview before a standard render.</span></span><span className={`relative h-6 w-11 rounded-full border transition ${draft ? 'border-brand-cyan/40 bg-brand-cyan/20' : 'border-white/10 bg-black/30'}`}><span className={`absolute top-0.5 size-[18px] rounded-full bg-white shadow transition-all ${draft ? 'left-[21px]' : 'left-0.5'}`}/></span></button>}</div>}

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_250px]"><div className="rounded-[22px] border border-border-soft bg-black/10 p-4"><span className="text-[8px] font-bold uppercase tracking-[.14em] text-text-soft">Visual source</span><h3 className="mt-1 text-sm font-bold">Text-to-video or image-to-video</h3><p className="mt-2 text-[9px] leading-4 text-text-muted">A product image, screenshot or first frame can anchor the generated motion.</p>{sourceAsset ? <div className="mt-3 flex items-center justify-between rounded-2xl border border-brand-green/20 bg-brand-green/[.04] px-3 py-2.5"><span className="flex min-w-0 items-center gap-2 text-[9px]"><ImagePlus className="size-3.5 shrink-0 text-brand-green"/><span className="truncate">{sourceAsset.fileName}</span></span><button className="text-[8px] text-text-soft hover:text-white" onClick={() => setSourceAsset(null)}>Remove</button></div> : <Button className="mt-3" disabled={uploading} onClick={() => fileRef.current?.click()}><Upload className="size-3.5"/>{uploading ? 'Uploading…' : 'Add reference image'}</Button>}<input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadSource}/></div><div className="rounded-[22px] border border-brand-cyan/20 bg-brand-cyan/[.035] p-4"><span className="text-[8px] font-bold uppercase tracking-[.14em] text-brand-cyan">Estimated generation</span><strong className="mt-2 block text-3xl tracking-tight">{credits}</strong><span className="text-[9px] text-text-muted">INXSocial credits</span><p className="mt-2 text-[8px] leading-4 text-text-soft">Updates automatically from the model, duration, resolution, audio and draft mode.</p></div></div>
        {error && <div className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/[.06] px-3 py-2.5 text-[9px] text-red-200">{error}</div>}
      </section>

      <section className="flex min-h-0 flex-col bg-black/10 p-4 sm:p-5"><div className="min-h-0 flex-1 overflow-y-auto rounded-[26px] border border-border-soft bg-[radial-gradient(circle_at_50%_25%,rgba(0,214,192,.08),transparent_43%)] p-4">{!asset && !generating && <div className="grid h-full min-h-[470px] place-items-center text-center"><div className="max-w-md"><span className="mx-auto grid size-16 place-items-center rounded-[22px] border border-brand-cyan/25 bg-brand-cyan/[.07] text-brand-cyan shadow-[0_18px_60px_rgba(0,214,192,.08)]"><Film className="size-7"/></span><h3 className="mt-5 text-lg font-bold">Your generated video appears here.</h3><p className="mt-2 text-[10px] leading-5 text-text-muted">Start with the idea. Use AI Recommended for automatic model routing, Fast for speed, or Manual when you want exact control.</p>{selected && <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-border-soft bg-black/20 px-3 py-1.5 text-[8px] text-text-soft"><span className="size-1.5 rounded-full bg-brand-green"/>{selected.name} · {duration}s · {resolution}</div>}</div></div>}{generating && <div className="grid h-full min-h-[470px] place-items-center text-center"><div><LoaderCircle className="mx-auto size-10 animate-spin text-brand-cyan"/><h3 className="mt-4 text-base font-bold">Generating your video…</h3><p className="mt-2 text-[9px] text-text-muted">Rendering the approved brief with your selected route.</p></div></div>}{asset && <div><video className="max-h-[580px] w-full rounded-2xl bg-black object-contain" controls src={asset.url}/><div className="mt-4 rounded-2xl border border-border-soft bg-bg/35 p-4"><span className="text-[8px] font-bold uppercase tracking-[.13em] text-text-soft">Post package</span><p className="mt-2 text-[10px] leading-5">{brief?.caption || asset.caption || 'Video generated and ready for your post.'}</p>{(brief?.hashtags || asset.hashtags || []).length > 0 && <p className="mt-2 text-[9px] text-text-muted">{(brief?.hashtags || asset.hashtags || []).map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')}</p>}</div></div>}</div><div className="mt-4 grid gap-2 sm:grid-cols-3"><Button disabled={!asset} onClick={() => void saveDraft()}><Save className="size-3.5"/>Save draft</Button><Button disabled={!asset} onClick={continueToPosts}>Post / Schedule <ArrowRight className="size-3.5"/></Button><Button variant="primary" disabled={generating || insufficient || prompt.trim().length < 2 || !selected} onClick={() => void generate()}><WandSparkles className="size-3.5"/>Generate video · {credits} credits</Button></div>{insufficient && <p className="mt-2 text-right text-[8px] text-red-300">You need more AI credits for this configuration.</p>}</section>
    </div>
  </div></div>, document.body)
}
