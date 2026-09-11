import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { ArrowRight, Check, Film, ImagePlus, LoaderCircle, Save, Sparkles, Upload, WandSparkles, X, Zap } from 'lucide-react'
import type { AIDraft, AIContentType, AIPlanAccess, GeneratedAsset } from '../../types/ai-content-studio'
import { uploadMediaAsset } from '../../lib/media-library-api'
import { saveAIDraft } from '../../lib/ai-content-studio-api'
import { estimateVideoCredits, generateStudioVideo, getVideoModels, type VideoModelOption, type VideoStudioSelection } from '../../lib/ai-next-studio-api'
import { sendPostStudioMessage, type PostStudioBrief } from '../../lib/ai-post-studio-api'
import { Button } from '../ui/Button'

const ASPECTS: VideoStudioSelection['aspectRatio'][] = ['9:16', '16:9', '1:1']
function extractUrls(text: string) { return [...new Set((text.match(/https?:\/\/[^\s<>()]+/gi) || []).map(value => value.replace(/[.,;!?]+$/, '')))].slice(0, 2) }
function buildDraft(asset: GeneratedAsset, prompt: string, brief: PostStudioBrief | null, existing?: AIDraft | null): AIDraft {
  return { id: existing?.id || crypto.randomUUID(), contentType: 'short_video', title: (brief?.headline || prompt || 'AI video').slice(0, 70), thumbnailUrl: asset.thumbnailUrl || asset.url, updatedAt: new Date().toISOString(), status: 'ready', prompt: prompt.slice(0, 1500), caption: brief?.caption || asset.caption || '', hashtags: brief?.hashtags || asset.hashtags || [], altText: '', asset: { ...asset, caption: brief?.caption || asset.caption || '', hashtags: brief?.hashtags || asset.hashtags || [] }, mediaLibraryAsset: existing?.mediaLibraryAsset || null, mediaLibraryAssets: existing?.mediaLibraryAssets || [] }
}

export function VideoStudioModal({ open, type, access, initialDraft, onClose, onSaved, onContinue, onToast }: { open: boolean; type: AIContentType | null; access: AIPlanAccess; initialDraft?: AIDraft | null; onClose: () => void; onSaved: (draft: AIDraft) => void; onContinue: (draft: AIDraft) => void; onToast: (message: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [models, setModels] = useState<VideoModelOption[]>([])
  const [prompt, setPrompt] = useState(initialDraft?.prompt || '')
  const [brief, setBrief] = useState<PostStudioBrief | null>(null)
  const [modelRoute, setModelRoute] = useState<VideoStudioSelection['modelRoute']>('fast')
  const [duration, setDuration] = useState(5)
  const [resolution, setResolution] = useState<VideoStudioSelection['resolution']>('720p')
  const [aspectRatio, setAspectRatio] = useState<VideoStudioSelection['aspectRatio']>('9:16')
  const [draft, setDraft] = useState(false)
  const [audio, setAudio] = useState(true)
  const [sourceAsset, setSourceAsset] = useState<{ id: string; fileName: string } | null>(null)
  const [asset, setAsset] = useState<GeneratedAsset | null>(() => initialDraft?.asset?.type === 'video' ? initialDraft.asset : null)
  const [credits, setCredits] = useState(10)
  const [loadingModels, setLoadingModels] = useState(true)
  const [polishing, setPolishing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const selected = useMemo(() => models.find(item => item.id === modelRoute) || models[0], [models, modelRoute])
  const selection = useMemo<VideoStudioSelection>(() => ({ modelRoute, duration, resolution, aspectRatio, draft, audio }), [modelRoute, duration, resolution, aspectRatio, draft, audio])
  const insufficient = access.creditsConfigured && !access.unlimitedCredits && access.creditsRemaining !== null && access.creditsRemaining < credits

  useEffect(() => {
    if (!open || (type !== 'short_video' && initialDraft?.contentType !== 'short_video')) return
    let active = true
    void getVideoModels().then(value => { if (active) setModels(value) }).catch(caught => { if (active) setError(caught instanceof Error ? caught.message : 'Video models could not be loaded.') }).finally(() => { if (active) setLoadingModels(false) })
    return () => { active = false }
  }, [open, type, initialDraft?.contentType])

  useEffect(() => {
    if (!open || !selected) return
    let active = true
    const timer = window.setTimeout(() => { void estimateVideoCredits(selection).then(value => { if (active) setCredits(value.credits) }).catch(caught => { if (active) setError(caught instanceof Error ? caught.message : 'Video credits could not be estimated.') }) }, 180)
    return () => { active = false; window.clearTimeout(timer) }
  }, [open, selected, selection])

  if (!open || (type !== 'short_video' && initialDraft?.contentType !== 'short_video')) return null

  function chooseModel(model: VideoModelOption) {
    setModelRoute(model.id)
    if (!model.durations.includes(duration)) setDuration(model.durations[0])
    if (!model.resolutions.includes(resolution)) setResolution(model.resolutions.includes('720p') ? '720p' : model.resolutions[0])
    if (!model.draftSupported) setDraft(false)
  }

  async function polishWithAI() {
    if (prompt.trim().length < 2 || polishing) return
    setPolishing(true); setError('')
    try {
      const sourceInstruction = sourceAsset ? `I uploaded ${sourceAsset.fileName} as the visual reference.` : ''
      const result = await sendPostStudioMessage({ messages: [{ role: 'user', content: `Create a production-ready short-form video/Reel creative brief from this idea. Focus on motion, camera, scene progression, hook and social pacing rather than a static image. ${sourceInstruction}\n\n${prompt}` }], urls: extractUrls(prompt), referenceAssetIds: sourceAsset ? [sourceAsset.id] : [], platform: aspectRatio === '9:16' ? 'Instagram Reels / TikTok' : 'Social video', aspectRatio })
      setBrief(result.brief); if (result.brief.visualDirection) setPrompt(result.brief.visualDirection.slice(0, 1500)); onToast(result.routing.deepAnalysisPerformed ? 'Website/reference analysed and video brief prepared.' : 'Video brief polished with AI.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The AI creative brief could not be prepared.') } finally { setPolishing(false) }
  }

  async function uploadSource(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
    if (!file.type.startsWith('image/')) { setError('For this Video Studio version, upload an image, product shot or first-frame reference.'); return }
    setUploading(true); setError('')
    try { const stored = await uploadMediaAsset(file, null, () => {}); setSourceAsset({ id: stored.id, fileName: stored.fileName }); onToast('Video reference image added.') } catch (caught) { setError(caught instanceof Error ? caught.message : 'Reference upload failed.') } finally { setUploading(false) }
  }

  async function generate() {
    if (prompt.trim().length < 2 || generating || insufficient || !selected) return
    setGenerating(true); setError('')
    try { const result = await generateStudioVideo({ ...selection, prompt: prompt.trim(), sourceMediaLibraryAssetId: sourceAsset?.id || null, caption: brief?.caption || '', hashtags: brief?.hashtags || [], script: brief?.supportingCopy || '' }); setAsset(result); onToast(`Video created · ${result.creditsUsed} credits used.`) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Video generation failed.') } finally { setGenerating(false) }
  }
  async function saveDraft() { if (!asset) return; try { const saved = await saveAIDraft(buildDraft(asset, prompt, brief, initialDraft)); onSaved(saved); onToast('Video saved to drafts.') } catch (caught) { setError(caught instanceof Error ? caught.message : 'Draft could not be saved.') } }
  function continueToPosts() { if (asset) onContinue(buildDraft(asset, prompt, brief, initialDraft)) }

  return createPortal(<div className="fixed inset-0 z-[100] grid place-items-center bg-[#01070d]/92 p-2 backdrop-blur-xl sm:p-5"><div className="flex h-[min(900px,95vh)] w-full max-w-[1540px] flex-col overflow-hidden rounded-[30px] border border-brand-cyan/25 bg-[radial-gradient(circle_at_12%_12%,rgba(0,214,192,.08),transparent_27%),linear-gradient(145deg,#061824,#020b13)] shadow-[0_44px_160px_rgba(0,0,0,.74)]">
    <header className="flex min-h-16 items-center justify-between border-b border-border-soft px-4 sm:px-6"><div><span className="text-[8px] font-bold uppercase tracking-[.18em] text-brand-cyan">Generative Video</span><h2 className="mt-1 text-base font-bold">AI Video Studio <span className="font-medium text-text-soft">· Reel / Video</span></h2></div><div className="flex items-center gap-2"><span className="rounded-full border border-amber-400/25 bg-amber-400/[.06] px-3 py-1 text-[9px] font-bold text-amber-300">{credits} credits</span><button className="grid size-9 place-items-center rounded-xl border border-border-soft text-text-muted hover:text-white" onClick={onClose}><X className="size-4"/></button></div></header>
    <div className="grid min-h-0 flex-1 lg:grid-cols-[56%_44%]">
      <section className="min-h-0 overflow-y-auto border-r border-border-soft p-4 sm:p-5">
        <div className="rounded-[22px] border border-border-soft bg-black/12 p-4"><div className="flex items-center justify-between gap-3"><div><span className="text-[8px] font-bold uppercase tracking-[.14em] text-text-soft">Creative brief</span><h3 className="mt-1 text-sm font-bold">Describe the motion you want</h3></div><Button size="sm" variant="secondary" disabled={polishing || prompt.trim().length < 2} onClick={() => void polishWithAI()}>{polishing ? <LoaderCircle className="size-3.5 animate-spin"/> : <Sparkles className="size-3.5"/>}AI analyse & polish</Button></div><textarea value={prompt} onChange={event => setPrompt(event.target.value)} rows={6} className="mt-3 w-full resize-none rounded-2xl border border-brand-cyan/20 bg-bg/60 px-3.5 py-3 text-[11px] leading-5 outline-none focus:border-brand-cyan/45" placeholder="e.g. A fast-paced 9:16 product Reel showing the creator workflow from upload to scheduled posts. Start with a strong hook, show real product UI, finish on the CTA…"/><p className="mt-2 text-[8px] text-text-soft">Paste a product URL in the brief and AI analyse & polish can inspect it before generation.</p></div>
        <div className="mt-4"><div className="flex items-end justify-between"><div><span className="text-[8px] font-bold uppercase tracking-[.14em] text-text-soft">Model</span><h3 className="mt-1 text-sm font-bold">Choose the generation engine</h3></div><span className="text-[8px] text-text-soft">Cost updates before Generate</span></div>{loadingModels ? <div className="mt-3 flex items-center gap-2 text-[10px] text-text-muted"><LoaderCircle className="size-4 animate-spin"/>Loading video models…</div> : <div className="mt-3 grid gap-3 sm:grid-cols-2">{models.map(model => <button key={model.id} onClick={() => chooseModel(model)} className={`group relative rounded-[20px] border p-4 text-left transition ${modelRoute === model.id ? 'border-brand-cyan/55 bg-brand-cyan/[.075] shadow-[0_14px_50px_rgba(0,214,192,.08)]' : 'border-border-soft bg-black/10 hover:border-brand-cyan/25'}`}><div className="flex items-start justify-between"><span className={`grid size-9 place-items-center rounded-xl ${model.id === 'fast' ? 'bg-amber-400/10 text-amber-300' : 'bg-violet-400/10 text-violet-300'}`}>{model.id === 'fast' ? <Zap className="size-4"/> : <Film className="size-4"/>}</span>{modelRoute === model.id && <span className="grid size-6 place-items-center rounded-full bg-brand-teal text-white"><Check className="size-3.5"/></span>}</div><div className="mt-3 flex items-center gap-2"><strong className="text-sm">{model.name}</strong><span className="rounded-full border border-border-soft px-2 py-0.5 text-[7px] font-bold uppercase tracking-[.1em] text-text-muted">{model.badge}</span></div><p className="mt-2 text-[9px] leading-4 text-text-muted">{model.description}</p><div className="mt-3 flex flex-wrap gap-1.5 text-[7px] text-text-soft">{model.durations.map(value => <span key={value} className="rounded-md bg-white/[.04] px-1.5 py-1">{value}s</span>)}{model.resolutions.map(value => <span key={value} className="rounded-md bg-white/[.04] px-1.5 py-1">{value}</span>)}</div></button>)}</div>}</div>
        {selected && <div className="mt-4 rounded-[22px] border border-border-soft bg-black/10 p-4"><span className="text-[8px] font-bold uppercase tracking-[.14em] text-text-soft">Generation controls</span><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="text-[8px] text-text-soft">Duration<select value={duration} onChange={event => setDuration(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-border-soft bg-bg px-2.5 py-2.5 text-[10px] text-white">{selected.durations.map(value => <option key={value} value={value}>{value} seconds</option>)}</select></label><label className="text-[8px] text-text-soft">Resolution<select value={resolution} onChange={event => setResolution(event.target.value as VideoStudioSelection['resolution'])} className="mt-1 w-full rounded-xl border border-border-soft bg-bg px-2.5 py-2.5 text-[10px] text-white">{selected.resolutions.map(value => <option key={value}>{value}</option>)}</select></label><label className="text-[8px] text-text-soft">Aspect ratio<select value={aspectRatio} onChange={event => setAspectRatio(event.target.value as VideoStudioSelection['aspectRatio'])} className="mt-1 w-full rounded-xl border border-border-soft bg-bg px-2.5 py-2.5 text-[10px] text-white">{ASPECTS.map(value => <option key={value}>{value}</option>)}</select></label><label className="text-[8px] text-text-soft">Audio<select value={audio ? 'on' : 'off'} onChange={event => setAudio(event.target.value === 'on')} className="mt-1 w-full rounded-xl border border-border-soft bg-bg px-2.5 py-2.5 text-[10px] text-white"><option value="on">Native audio on</option><option value="off">Silent video</option></select></label></div>{selected.draftSupported && <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-border-soft bg-white/[.025] px-3 py-2.5"><span><strong className="block text-[9px]">Draft preview</strong><span className="text-[8px] text-text-soft">Lower-cost preview for testing motion before a standard render.</span></span><input type="checkbox" checked={draft} onChange={event => setDraft(event.target.checked)} className="size-4 accent-teal-400"/></label>}</div>}
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_250px]"><div className="rounded-[22px] border border-border-soft bg-black/10 p-4"><div className="flex items-center justify-between"><div><span className="text-[8px] font-bold uppercase tracking-[.14em] text-text-soft">Visual source</span><h3 className="mt-1 text-sm font-bold">Text-to-video or image-to-video</h3></div><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadSource}/><Button size="sm" variant="secondary" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? <LoaderCircle className="size-3.5 animate-spin"/> : <Upload className="size-3.5"/>}{sourceAsset ? 'Replace image' : 'Add image'}</Button></div>{sourceAsset ? <div className="mt-3 flex items-center justify-between rounded-xl border border-brand-cyan/20 bg-brand-cyan/[.04] px-3 py-2"><span className="inline-flex items-center gap-2 text-[9px]"><ImagePlus className="size-3.5 text-brand-cyan"/>{sourceAsset.fileName}</span><button className="text-[8px] text-text-soft hover:text-white" onClick={() => setSourceAsset(null)}>Remove</button></div> : <p className="mt-3 text-[9px] leading-4 text-text-muted">Leave empty for text-to-video, or add a product shot / first frame to control the subject. With a reference, the model preserves the source framing.</p>}</div><div className="rounded-[22px] border border-amber-400/20 bg-amber-400/[.035] p-4"><span className="text-[8px] font-bold uppercase tracking-[.14em] text-amber-300">Render cost</span><div className="mt-2 flex items-end gap-1"><strong className="text-3xl leading-none text-white">{credits}</strong><span className="pb-0.5 text-[9px] text-text-muted">credits</span></div><p className="mt-2 text-[8px] leading-4 text-text-soft">Based on {selected?.name || 'model'} · {duration}s · {resolution}{draft ? ' · draft' : ''}. Credits are reserved when generation begins and returned if it fails.</p></div></div>
        {error && <div className="mt-3 rounded-xl border border-red-400/25 bg-red-500/[.07] px-3 py-2 text-[10px] text-red-200">{error}</div>}<Button className="mt-4 min-h-12 w-full" variant="primary" disabled={generating || prompt.trim().length < 2 || !selected || insufficient} onClick={() => void generate()}>{generating ? <LoaderCircle className="size-4 animate-spin"/> : <WandSparkles className="size-4"/>}{generating ? 'Generating video…' : `Generate video · ${credits} credits`}</Button>
      </section>
      <section className="flex min-h-0 flex-col bg-black/10 p-4 sm:p-5"><div className="min-h-0 flex-1 overflow-y-auto rounded-[24px] border border-border-soft bg-[radial-gradient(circle_at_50%_28%,rgba(0,214,192,.08),transparent_44%)] p-4">
        {!asset && !generating && <div className="grid h-full min-h-[480px] place-items-center text-center"><div><span className="mx-auto grid size-16 place-items-center rounded-[22px] border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><Film className="size-7"/></span><h3 className="mt-4 text-lg font-bold">Video preview appears here.</h3><p className="mx-auto mt-2 max-w-sm text-[10px] leading-5 text-text-muted">Choose a generation model and explicit video settings. Use AI analyse & polish when a rough idea, URL or reference needs a stronger production brief.</p>{selected && <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-border-soft bg-black/15 p-3 text-left"><div className="flex items-center justify-between"><span className="text-[8px] uppercase tracking-[.13em] text-text-soft">Selected setup</span><span className="text-[8px] font-bold text-brand-cyan">{credits} credits</span></div><p className="mt-2 text-[10px] font-semibold">{selected.name} · {duration}s · {resolution} · {aspectRatio}</p><p className="mt-1 text-[8px] text-text-soft">{audio ? 'Native audio' : 'Silent'}{draft ? ' · Draft preview' : ''}{sourceAsset ? ' · Image reference' : ' · Text to video'}</p></div>}</div></div>}
        {generating && <div className="grid h-full min-h-[480px] place-items-center text-center"><div><LoaderCircle className="mx-auto size-10 animate-spin text-brand-cyan"/><h3 className="mt-4 text-base font-bold">Generating your video…</h3><p className="mt-2 text-[10px] text-text-muted">Video generation can take longer than image creation. Your reserved credits are protected if the render fails.</p></div></div>}
        {asset && <div className="space-y-4"><div className="mx-auto overflow-hidden rounded-[22px] border border-border-soft bg-black/40"><video src={asset.url} controls playsInline className="max-h-[650px] w-full bg-black object-contain"/></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-border-soft bg-black/15 p-4"><span className="text-[8px] font-bold uppercase tracking-[.13em] text-text-soft">Creative setup</span><p className="mt-2 text-[10px] font-semibold">{selected?.name} · {duration}s · {resolution} · {aspectRatio}</p><p className="mt-1 text-[8px] text-text-soft">{asset.creditsUsed} credits used</p></div><div className="rounded-2xl border border-border-soft bg-black/15 p-4"><span className="text-[8px] font-bold uppercase tracking-[.13em] text-text-soft">Publishing copy</span><p className="mt-2 line-clamp-4 text-[9px] leading-4 text-text-muted">{brief?.caption || 'Add or refine the final caption in Posts.'}</p></div></div></div>}
      </div>{asset && <div className="mt-3 grid gap-2 sm:grid-cols-2"><Button onClick={() => void saveDraft()}><Save className="size-4"/>Save draft</Button><Button variant="primary" onClick={continueToPosts}>Continue to Posts<ArrowRight className="size-4"/></Button></div>}</section>
    </div><footer className="flex min-h-12 items-center justify-between border-t border-border-soft px-4 text-[8px] text-text-soft"><span>Model, duration, resolution and draft mode determine the video credit cost shown before generation.</span><Button size="sm" onClick={onClose}>Close</Button></footer>
  </div></div>, document.body)
}
