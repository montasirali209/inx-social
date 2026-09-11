import { createPortal } from 'react-dom'
import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { ArrowLeft, ArrowRight, Bot, Globe2, ImagePlus, Layers3, LoaderCircle, Paperclip, Save, Send, Sparkles, WandSparkles, X } from 'lucide-react'
import type { AIDraft, AIContentType, AIPlanAccess, GeneratedAsset } from '../../types/ai-content-studio'
import { uploadMediaAsset } from '../../lib/media-library-api'
import { saveAIDraft } from '../../lib/ai-content-studio-api'
import { generateConversationalCarousel } from '../../lib/ai-next-studio-api'
import { sendPostStudioMessage, sourceAnalysisMemoryMessage, type PostStudioAssistantResponse, type PostStudioBrief, type PostStudioMessage, type PostStudioSourceAnalysis } from '../../lib/ai-post-studio-api'
import { Button } from '../ui/Button'
import { StudioSelect } from './StudioSelect'

const INTRO = 'Tell me the story you want this carousel to tell. Add a website, product screenshot, logo or reference if useful. I’ll analyse the sources, shape the narrative, then build the slides.'
const PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn']
const RATIOS: PostStudioBrief['aspectRatio'][] = ['1:1', '4:5']
type Reference = { id: string; fileName: string }

function extractUrls(text: string) { return [...new Set((text.match(/https?:\/\/[^\s<>()]+/gi) || []).map((value) => value.replace(/[.,;!?]+$/, '')))].slice(0, 2) }
function carouselCredits(slides: number) { return slides <= 5 ? 10 : slides <= 8 ? 15 : 20 }
function renderKey(brief: PostStudioBrief | null, slides: number, platform: string, ratio: string, analysis: PostStudioSourceAnalysis | null) {
  if (!brief) return ''
  return JSON.stringify({ objective: brief.objective, audience: brief.audience, visualDirection: brief.visualDirection, headline: brief.headline, cta: brief.cta, slides, platform, ratio, source: analysis?.fingerprint || '' })
}
function buildDraft(asset: GeneratedAsset, brief: PostStudioBrief | null, messages: PostStudioMessage[], existing?: AIDraft | null): AIDraft {
  const prompt = messages.find((item) => item.role === 'user')?.content || brief?.objective || 'Carousel post'
  return { id: existing?.id || crypto.randomUUID(), contentType: 'carousel_post', title: (brief?.headline || prompt).slice(0, 70), thumbnailUrl: asset.thumbnailUrl || asset.slides?.[0]?.thumbnailUrl || asset.url, updatedAt: new Date().toISOString(), status: 'ready', prompt: prompt.slice(0, 1500), caption: asset.caption || brief?.caption || '', hashtags: asset.hashtags || brief?.hashtags || [], altText: '', asset, mediaLibraryAsset: existing?.mediaLibraryAsset || null, mediaLibraryAssets: existing?.mediaLibraryAssets || [] }
}

export function CarouselChatModal({ open, type, access, initialDraft, onClose, onSaved, onContinue, onToast }: { open: boolean; type: AIContentType | null; access: AIPlanAccess; initialDraft?: AIDraft | null; onClose: () => void; onSaved: (draft: AIDraft) => void; onContinue: (draft: AIDraft) => void; onToast: (message: string) => void }) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [messages, setMessages] = useState<PostStudioMessage[]>(() => [{ role: 'assistant', content: INTRO }, ...(initialDraft?.prompt ? [{ role: 'user' as const, content: initialDraft.prompt }] : [])])
  const [composer, setComposer] = useState('')
  const [urls, setUrls] = useState<string[]>(() => extractUrls(initialDraft?.prompt || ''))
  const [references, setReferences] = useState<Reference[]>([])
  const [assistantResult, setAssistantResult] = useState<PostStudioAssistantResponse | null>(null)
  const [sourceAnalysis, setSourceAnalysis] = useState<PostStudioSourceAnalysis | null>(null)
  const [brief, setBrief] = useState<PostStudioBrief | null>(null)
  const [asset, setAsset] = useState<GeneratedAsset | null>(() => initialDraft?.asset?.type === 'carousel' ? initialDraft.asset : null)
  const [platform, setPlatform] = useState('Instagram')
  const [aspectRatio, setAspectRatio] = useState<PostStudioBrief['aspectRatio']>('1:1')
  const [slides, setSlides] = useState(5)
  const [activeSlide, setActiveSlide] = useState(0)
  const [lastRenderedKey, setLastRenderedKey] = useState('')
  const [thinking, setThinking] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  if (!open || (type !== 'carousel_post' && initialDraft?.contentType !== 'carousel_post')) return null

  const ready = Boolean(assistantResult?.readyToGenerate && brief?.visualDirection)
  const currentKey = renderKey(brief, slides, platform, aspectRatio, sourceAnalysis)
  const renderNeeded = Boolean(ready && currentKey && (!asset || currentKey !== lastRenderedKey))
  const cost = carouselCredits(slides)
  const insufficient = access.creditsConfigured && !access.unlimitedCredits && access.creditsRemaining !== null && access.creditsRemaining < cost
  const busy = thinking || generating || uploading
  const slideAssets = asset?.slides || []
  const selectedSlide = slideAssets[Math.min(activeSlide, Math.max(0, slideAssets.length - 1))]

  async function ask(nextMessages: PostStudioMessage[], nextUrls = urls, nextRefs = references) {
    setThinking(true); setError('')
    try {
      const memory = sourceAnalysisMemoryMessage(sourceAnalysis)
      const formatInstruction: PostStudioMessage = { role: 'user', content: `Output format: a ${slides}-slide social carousel. Build one coherent narrative across the slides; do not treat this as a single-image post.` }
      const result = await sendPostStudioMessage({ messages: [...(memory ? [memory] : []), formatInstruction, ...nextMessages.filter((_, index) => index > 0).slice(-16)], urls: nextUrls, referenceAssetIds: nextRefs.map((item) => item.id), platform, aspectRatio })
      setAssistantResult(result); setSourceAnalysis(result.sourceAnalysis || sourceAnalysis); setBrief(result.brief); setPlatform(result.brief.platform || platform)
      if (result.brief.aspectRatio === '1:1' || result.brief.aspectRatio === '4:5') setAspectRatio(result.brief.aspectRatio)
      setMessages((current) => [...current, { role: 'assistant', content: result.reply }])
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The Carousel Studio could not respond.') } finally { setThinking(false) }
  }

  async function sendText(value = composer) {
    const text = value.trim(); if (!text || busy) return
    const nextUrls = [...new Set([...urls, ...extractUrls(text)])].slice(0, 2); setUrls(nextUrls); setComposer('')
    const next = [...messages, { role: 'user' as const, content: text }]; setMessages(next); await ask(next, nextUrls, references)
  }
  async function uploadReference(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
    if (!file.type.startsWith('image/')) { setError('Upload an image, logo or screenshot as the carousel reference.'); return }
    setUploading(true); setError('')
    try {
      const stored = await uploadMediaAsset(file, null, () => {}); const nextRefs = [{ id: stored.id, fileName: stored.fileName }, ...references.filter((item) => item.id !== stored.id)].slice(0, 4); setReferences(nextRefs)
      const next = [...messages, { role: 'user' as const, content: `I uploaded “${stored.fileName}” as a carousel reference. Analyse it and use it where useful.` }]; setMessages(next); await ask(next, urls, nextRefs)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Reference upload failed.') } finally { setUploading(false) }
  }
  async function generate() {
    if (!brief || !renderNeeded || generating || insufficient) return
    setGenerating(true); setError('')
    try {
      const prompt = messages.find((item) => item.role === 'user')?.content || brief.objective
      const result = await generateConversationalCarousel({ prompt, platform, aspectRatio, slides, referenceAssetIds: references.map((item) => item.id), brief: { ...brief, platform, aspectRatio }, sourceAnalysis })
      setAsset(result); setActiveSlide(0); setLastRenderedKey(currentKey); onToast(`${slides}-slide carousel created · ${result.creditsUsed} credits used.`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Carousel generation failed.') } finally { setGenerating(false) }
  }
  async function saveDraft() { if (!asset) return; try { const draft = await saveAIDraft(buildDraft(asset, brief, messages, initialDraft)); onSaved(draft); onToast('Carousel saved to drafts.') } catch (caught) { setError(caught instanceof Error ? caught.message : 'Draft could not be saved.') } }
  function continueToPosts() { if (asset) onContinue(buildDraft(asset, brief, messages, initialDraft)) }
  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendText() } }

  const slideOptions = [3,4,5,6,7,8,9,10].map((value) => ({ value, label: `${value} slides`, meta: value <= 5 ? 'Concise story' : value <= 8 ? 'Detailed carousel' : 'Long-form carousel', icon: <Layers3 className="size-3.5" /> }))
  const platformOptions = PLATFORMS.map((value) => ({ value, label: value, meta: value === 'LinkedIn' ? 'Professional carousel' : 'Social feed carousel', icon: <Sparkles className="size-3.5" /> }))
  const ratioOptions = RATIOS.map((value) => ({ value, label: value, meta: value === '4:5' ? 'Portrait feed · recommended' : 'Square feed', icon: <ImagePlus className="size-3.5" /> }))

  return createPortal(<div className="fixed inset-0 z-[100] grid place-items-center bg-[#01070d]/90 p-2 backdrop-blur-xl sm:p-5"><div className="flex h-[min(900px,95vh)] w-full max-w-[1540px] flex-col overflow-hidden rounded-[30px] border border-brand-cyan/25 bg-[radial-gradient(circle_at_12%_15%,rgba(0,214,192,.09),transparent_28%),linear-gradient(145deg,#061824,#020b13)] shadow-[0_44px_160px_rgba(0,0,0,.72)]">
    <header className="flex min-h-16 items-center justify-between border-b border-border-soft px-4 sm:px-6"><div><span className="text-[8px] font-bold uppercase tracking-[.18em] text-brand-cyan">Conversational Creator</span><h2 className="mt-1 text-base font-bold">AI Post Studio <span className="font-medium text-text-soft">· Carousel</span></h2></div><div className="flex items-center gap-2"><span className="rounded-full border border-amber-400/25 bg-amber-400/[.06] px-3 py-1 text-[9px] font-bold text-amber-300">{cost} credits · {slides} slides</span><button className="grid size-9 place-items-center rounded-xl border border-border-soft text-text-muted transition hover:-translate-y-0.5 hover:border-brand-cyan/30 hover:text-white" onClick={onClose}><X className="size-4" /></button></div></header>
    <div className="grid min-h-0 flex-1 lg:grid-cols-[47%_53%]">
      <section className="flex min-h-0 flex-col border-r border-border-soft"><div className="border-b border-border-soft px-4 py-3 sm:px-5"><h3 className="text-sm font-bold">Build the carousel with AI</h3><p className="mt-1 text-[9px] text-text-soft">Research, references and narrative planning happen here. Slides render only when you approve the brief.</p></div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">{messages.map((message, index) => <div key={`${index}-${message.content.slice(0, 18)}`} className={`flex gap-2 ${message.role === 'assistant' ? '' : 'justify-end'}`}>{message.role === 'assistant' && <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><Bot className="size-3.5" /></span>}<div className={`max-w-[88%] rounded-2xl border px-3.5 py-3 text-[10px] leading-5 shadow-[0_10px_30px_rgba(0,0,0,.14)] ${message.role === 'assistant' ? 'border-border-soft bg-white/[.035]' : 'border-brand-teal/30 bg-brand-teal/12 text-white'}`}><p className="whitespace-pre-wrap">{message.content}</p></div></div>)}
          {sourceAnalysis && <div className="ml-9 rounded-2xl border border-brand-cyan/20 bg-brand-cyan/[.035] p-4"><span className="text-[8px] font-bold uppercase tracking-[.15em] text-brand-cyan">Source analysis complete</span><p className="mt-2 text-[10px] leading-5 text-text-muted">{sourceAnalysis.summary}</p>{sourceAnalysis.strongestAngles.length > 0 && <p className="mt-2 text-[9px] text-text-soft">Strong angle: {sourceAnalysis.strongestAngles[0]}</p>}</div>}
          {thinking && <div className="ml-9 flex items-center gap-2 text-[10px] text-text-muted"><LoaderCircle className="size-3.5 animate-spin text-brand-cyan" />Analysing the carousel direction…</div>}
          {ready && renderNeeded && <div className="ml-9 rounded-[24px] border border-brand-green/30 bg-[linear-gradient(135deg,rgba(5,62,58,.58),rgba(4,25,35,.86))] p-5 shadow-[0_18px_60px_rgba(0,214,192,.08)]"><span className="text-[8px] font-bold uppercase tracking-[.17em] text-brand-green">Carousel ready</span><h4 className="mt-1 text-lg font-bold">Generate your {slides}-slide carousel</h4><p className="mt-2 text-[10px] leading-5 text-text-muted">The story, source context and visual direction are prepared. Keep refining in chat or render the complete sequence.</p><Button className="mt-4 min-h-11" variant="primary" disabled={insufficient || generating} onClick={() => void generate()}><WandSparkles className="size-4" />Generate carousel · {cost} credits</Button></div>}
          {error && <div className="rounded-xl border border-red-400/25 bg-red-500/[.07] px-3 py-2 text-[10px] text-red-200">{error}</div>}
        </div>
        <div className="space-y-2 border-t border-border-soft p-3 sm:p-4"><div className="overflow-hidden rounded-2xl border border-brand-cyan/25 bg-black/15"><textarea ref={inputRef} value={composer} onChange={(event) => setComposer(event.target.value)} onKeyDown={keyDown} rows={3} className="w-full resize-none bg-transparent px-3.5 py-3 text-[11px] outline-none placeholder:text-text-soft" placeholder="Describe the carousel, paste a URL, or ask to refine the story…"/><div className="flex items-center justify-between border-t border-border-soft px-2.5 py-2"><div className="flex items-center gap-1"><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadReference}/><button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[9px] text-text-muted hover:bg-white/5"><Paperclip className="size-3.5" />Reference</button><button onClick={() => { setComposer((value) => `${value}${value ? ' ' : ''}https://`); inputRef.current?.focus() }} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[9px] text-text-muted hover:bg-white/5"><Globe2 className="size-3.5" />Add URL</button></div><button disabled={!composer.trim() || busy} onClick={() => void sendText()} className="grid size-9 place-items-center rounded-xl bg-brand-teal text-white disabled:opacity-40"><Send className="size-4" /></button></div></div>
          <details className="rounded-2xl border border-border-soft bg-black/10"><summary className="cursor-pointer px-3 py-2.5 text-[9px] text-text-muted">Optional controls · polished manual overrides</summary><div className="grid gap-3 border-t border-border-soft p-3 sm:grid-cols-3"><StudioSelect label="Slides" value={slides} options={slideOptions} onChange={setSlides} accent="cyan"/><StudioSelect label="Platform" value={platform} options={platformOptions} onChange={setPlatform} accent="green"/><StudioSelect label="Aspect ratio" value={aspectRatio} options={ratioOptions} onChange={setAspectRatio} accent="violet"/></div></details></div>
      </section>
      <section className="flex min-h-0 flex-col bg-black/10 p-4 sm:p-5"><div className="min-h-0 flex-1 overflow-y-auto rounded-[24px] border border-border-soft bg-[radial-gradient(circle_at_50%_30%,rgba(0,214,192,.08),transparent_45%)] p-4">{!asset && !generating && <div className="grid h-full min-h-[420px] place-items-center text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-2xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><Sparkles className="size-6" /></span><h3 className="mt-4 text-lg font-bold">Your carousel comes together here.</h3><p className="mx-auto mt-2 max-w-md text-[10px] leading-5 text-text-muted">Plan the story in chat, review the research, then generate a coordinated sequence rather than unrelated images.</p></div></div>}{generating && <div className="grid h-full min-h-[420px] place-items-center text-center"><div><LoaderCircle className="mx-auto size-9 animate-spin text-brand-cyan"/><h3 className="mt-4 text-base font-bold">Designing all {slides} slides…</h3><p className="mt-2 text-[10px] text-text-muted">Keeping story, typography and brand direction consistent across the full carousel.</p></div></div>}{asset && selectedSlide && <div><div className="overflow-hidden rounded-2xl border border-border-soft bg-black/30"><img src={selectedSlide.url} alt={`Carousel slide ${activeSlide + 1}`} className="mx-auto max-h-[560px] w-full object-contain"/></div><div className="mt-3 flex items-center justify-between"><Button size="sm" disabled={activeSlide <= 0} onClick={() => setActiveSlide((value) => Math.max(0, value - 1))}><ArrowLeft className="size-3.5"/>Previous</Button><span className="text-[9px] text-text-muted">Slide {activeSlide + 1} of {slideAssets.length}</span><Button size="sm" disabled={activeSlide >= slideAssets.length - 1} onClick={() => setActiveSlide((value) => Math.min(slideAssets.length - 1, value + 1))}>Next<ArrowRight className="size-3.5"/></Button></div><div className="mt-3 grid grid-cols-5 gap-2">{slideAssets.slice(0, 10).map((slide, index) => <button key={slide.id || `${index}`} type="button" onClick={() => setActiveSlide(index)} className={`overflow-hidden rounded-xl border transition-all hover:-translate-y-0.5 ${activeSlide === index ? 'border-brand-cyan/60 shadow-[0_8px_24px_rgba(0,214,192,.12)]' : 'border-border-soft'}`}><img src={slide.thumbnailUrl || slide.url} alt="" className="aspect-square w-full object-cover"/></button>)}</div></div>}</div><div className="mt-4 grid gap-2 sm:grid-cols-3"><Button disabled={!asset} onClick={() => void saveDraft()}><Save className="size-3.5"/>Save draft</Button><Button disabled={!asset} onClick={continueToPosts}>Continue to Posts <ArrowRight className="size-3.5"/></Button><Button variant="primary" disabled={!renderNeeded || generating || insufficient} onClick={() => void generate()}><WandSparkles className="size-3.5"/>Generate · {cost} credits</Button></div></section>
    </div>
  </div></div>, document.body)
}
