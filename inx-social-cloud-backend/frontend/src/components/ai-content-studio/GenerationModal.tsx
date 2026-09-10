import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Captions,
  Check,
  Copy,
  Download,
  GripVertical,
  Hash,
  ImagePlus,
  Library,
  Mic2,
  Music2,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  WandSparkles,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { MediaAsset } from '../../types/media-library'
import type { AIDraft, AIContentType, AIPlanAccess, BrandKit, GeneratedAsset, GenerationRequest, GenerationStatus } from '../../types/ai-content-studio'
import {
  estimateGenerationCost,
  generateCarouselPost,
  generateImagePost,
  generateShortVideo,
  generateUGCAd,
  getBrandKits,
  rememberGeneration,
  saveAIDraft,
  saveGeneratedAssets,
  sendDraftToPosts,
} from '../../lib/ai-content-studio-api'
import { fetchMediaLibrary, uploadMediaAsset } from '../../lib/media-library-api'
import { Button } from '../ui/Button'
import { CreditCostPreview, GenerationProgress, workflowDefinitions } from './AIStudioPrimitives'

type FormValues = {
  prompt: string
  goal: string
  platform: string
  aspectRatio: string
  visualStyle: string
  brandKitId: string
  tone: string
  variants: number
  slides: number
  captionStyle: string
  ctaStyle: string
  duration: number
  visualSource: string
  voiceover: boolean
  subtitles: boolean
  music: boolean
  cta: string
  productName: string
  productDescription: string
  audience: string
  hook: string
  offer: string
  ugcFormat: string
  mediaSource: string
  mediaLibraryAssetId: string
  uploadedFile: File | null
}

const defaults: FormValues = {
  prompt: '',
  goal: 'Brand awareness',
  platform: 'Instagram',
  aspectRatio: '4:5',
  visualStyle: 'Brand-led',
  brandKitId: '',
  tone: 'Professional',
  variants: 1,
  slides: 4,
  captionStyle: 'Concise',
  ctaStyle: 'Gentle CTA',
  duration: 5,
  visualSource: 'AI generated',
  voiceover: false,
  subtitles: true,
  music: true,
  cta: '',
  productName: '',
  productDescription: '',
  audience: '',
  hook: '',
  offer: '',
  ugcFormat: 'Talking-head style',
  mediaSource: 'Generate supporting visuals',
  mediaLibraryAssetId: '',
  uploadedFile: null,
}

const fieldClass = 'mt-1.5 min-h-10 w-full rounded-xl border border-border-soft bg-bg/45 px-3 py-2 text-xs text-text-main outline-none transition placeholder:text-text-soft focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/10'
const textAreaClass = `${fieldClass} min-h-28 resize-y leading-5`

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="block text-[10px] font-semibold text-text-muted"><span className="flex items-center justify-between gap-2"><span>{label}</span>{hint && <span className="font-normal text-text-soft">{hint}</span>}</span>{children}</label>
}

function SelectField({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <Field label={label}><select className={fieldClass} onChange={(event) => onChange(event.target.value)} value={value}>{values.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
}

function ToggleField({ checked, label, description, onChange }: { checked: boolean; label: string; description: string; onChange: (checked: boolean) => void }) {
  return <button aria-checked={checked} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border-soft bg-bg/30 p-3 text-left transition hover:border-brand-cyan/25 focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={() => onChange(!checked)} role="switch" type="button"><span><strong className="block text-xs">{label}</strong><span className="mt-1 block text-[9px] leading-4 text-text-muted">{description}</span></span><span className={`relative h-6 w-11 shrink-0 rounded-full border transition ${checked ? 'border-brand-teal bg-brand-teal' : 'border-border-strong bg-bg'}`}><span className={`absolute top-1 size-4 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`} /></span></button>
}

function PromptField({ value, onChange, label = 'What is this post about?', placeholder = 'Describe the idea, offer, product or message you want this post to communicate…' }: { value: string; onChange: (value: string) => void; label?: string; placeholder?: string }) {
  return <Field label={label} hint={`${value.length}/1,500`}><textarea className={textAreaClass} maxLength={1500} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required value={value} /></Field>
}

function BrandKitField({ brandKits, value, onChange }: { brandKits: BrandKit[]; value: string; onChange: (value: string) => void }) {
  return <Field label="Brand kit"><select className={fieldClass} onChange={(event) => onChange(event.target.value)} value={value}><option value="">Workspace defaults</option>{brandKits.map((kit) => <option key={kit.id} value={kit.id}>{kit.name}{kit.active ? ' · Active' : ''}</option>)}</select></Field>
}

function MediaSourceFields({ values, mediaAssets, onChange }: { values: FormValues; mediaAssets: MediaAsset[]; onChange: (patch: Partial<FormValues>) => void }) {
  const source = values.visualSource === 'Uploaded media' || values.mediaSource === 'Upload product media' ? 'upload' : values.visualSource === 'Media Library assets' || values.mediaSource === 'Select from Media Library' ? 'library' : 'generated'
  return <>
    {source === 'upload' && <Field label="Upload source media" hint="Saved to Media Library before generation"><span className="mt-1.5 flex min-h-24 cursor-pointer items-center justify-center rounded-xl border border-dashed border-brand-cyan/25 bg-brand-cyan/[.025] p-4 text-center transition hover:border-brand-cyan/50"><input accept="image/*,video/*" className="sr-only" onChange={(event) => onChange({ uploadedFile: event.target.files?.[0] || null })} type="file" /><span><UploadCloud className="mx-auto size-5 text-brand-cyan" /><strong className="mt-2 block text-[10px]">{values.uploadedFile?.name || 'Choose product or source media'}</strong><span className="mt-1 block text-[9px] text-text-soft">Image or video · maximum Media Library limits apply</span></span></span></Field>}
    {source === 'library' && <Field label="Media Library asset"><select className={fieldClass} onChange={(event) => onChange({ mediaLibraryAssetId: event.target.value })} value={values.mediaLibraryAssetId}><option value="">Select an asset</option>{mediaAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.fileName}</option>)}</select></Field>}
  </>
}

export function ImageGenerationForm({ values, brandKits, onChange }: { values: FormValues; brandKits: BrandKit[]; onChange: (patch: Partial<FormValues>) => void }) {
  return <div className="space-y-4"><PromptField onChange={(prompt) => onChange({ prompt })} value={values.prompt} /><div className="grid gap-3 sm:grid-cols-2"><SelectField label="Content goal" onChange={(goal) => onChange({ goal })} value={values.goal} values={['Brand awareness', 'Promote product/service', 'Engagement', 'Announcement', 'Educational']} /><SelectField label="Platform target" onChange={(platform) => onChange({ platform })} value={values.platform} values={['Instagram', 'Facebook', 'LinkedIn', 'YouTube', 'TikTok']} /><SelectField label="Aspect ratio" onChange={(aspectRatio) => onChange({ aspectRatio })} value={values.aspectRatio} values={['1:1', '4:5', '9:16', '16:9']} /><SelectField label="Visual style" onChange={(visualStyle) => onChange({ visualStyle })} value={values.visualStyle} values={['Brand-led', 'Editorial', 'Minimal', 'Lifestyle', 'Product focused', 'Illustrative']} /><BrandKitField brandKits={brandKits} onChange={(brandKitId) => onChange({ brandKitId })} value={values.brandKitId} /><SelectField label="Tone" onChange={(tone) => onChange({ tone })} value={values.tone} values={['Professional', 'Friendly', 'Bold', 'Minimal', 'Energetic']} /><SelectField label="Number of variants" onChange={(value) => onChange({ variants: Number(value) })} value={String(values.variants)} values={['1', '2', '3', '4']} /></div><div className="grid gap-2 sm:grid-cols-3"><ToggleField checked label="Caption" description="Write publishing copy" onChange={() => {}} /><ToggleField checked label="Hashtags" description="Add relevant hashtags" onChange={() => {}} /><ToggleField checked label="Alt text" description="Create accessible alt text" onChange={() => {}} /></div></div>
}

export function CarouselGenerationForm({ values, brandKits, onChange }: { values: FormValues; brandKits: BrandKit[]; onChange: (patch: Partial<FormValues>) => void }) {
  return <div className="space-y-4"><PromptField label="Main topic / prompt" onChange={(prompt) => onChange({ prompt })} value={values.prompt} /><div className="grid gap-3 sm:grid-cols-2"><Field label="Number of slides" hint="3–10"><input className={fieldClass} max={10} min={3} onChange={(event) => onChange({ slides: Number(event.target.value) })} type="number" value={values.slides} /></Field><SelectField label="Content goal" onChange={(goal) => onChange({ goal })} value={values.goal} values={['Educational', 'Brand awareness', 'Product launch', 'Engagement', 'Announcement']} /><SelectField label="Platform target" onChange={(platform) => onChange({ platform })} value={values.platform} values={['Instagram', 'Facebook', 'LinkedIn']} /><SelectField label="Visual style" onChange={(visualStyle) => onChange({ visualStyle })} value={values.visualStyle} values={['Brand-led', 'Editorial', 'Minimal', 'Bold typography', 'Product focused']} /><BrandKitField brandKits={brandKits} onChange={(brandKitId) => onChange({ brandKitId })} value={values.brandKitId} /><SelectField label="Caption style" onChange={(captionStyle) => onChange({ captionStyle })} value={values.captionStyle} values={['Concise', 'Story-led', 'Educational', 'Conversational']} /><SelectField label="CTA style" onChange={(ctaStyle) => onChange({ ctaStyle })} value={values.ctaStyle} values={['Gentle CTA', 'Direct CTA', 'Question', 'No CTA']} /></div><div className="grid gap-2 sm:grid-cols-2"><ToggleField checked label="Generate slide copy" description="Write coordinated text for every slide" onChange={() => {}} /><ToggleField checked label="Generate visuals" description="Create a coordinated visual system" onChange={() => {}} /></div></div>
}

export function VideoGenerationForm({ values, brandKits, mediaAssets, onChange }: { values: FormValues; brandKits: BrandKit[]; mediaAssets: MediaAsset[]; onChange: (patch: Partial<FormValues>) => void }) {
  return <div className="space-y-4"><PromptField label="Video idea / prompt" onChange={(prompt) => onChange({ prompt })} value={values.prompt} /><div className="grid gap-3 sm:grid-cols-2"><SelectField label="Duration" onChange={(duration) => onChange({ duration: Number(duration) })} value={String(values.duration)} values={['5', '10', '15']} /><SelectField label="Aspect ratio" onChange={(aspectRatio) => onChange({ aspectRatio })} value={values.aspectRatio === '4:5' ? '9:16' : values.aspectRatio} values={['9:16', '4:5', '1:1', '16:9']} /><SelectField label="Platform target" onChange={(platform) => onChange({ platform })} value={values.platform} values={['Instagram', 'Facebook', 'TikTok', 'YouTube']} /><SelectField label="Video style" onChange={(visualStyle) => onChange({ visualStyle })} value={values.visualStyle} values={['Product showcase', 'Cinematic', 'Motion graphic', 'Lifestyle', 'Educational']} /><SelectField label="Visual source" onChange={(visualSource) => onChange({ visualSource, uploadedFile: null, mediaLibraryAssetId: '' })} value={values.visualSource} values={['AI generated', 'Uploaded media', 'Media Library assets']} /><BrandKitField brandKits={brandKits} onChange={(brandKitId) => onChange({ brandKitId })} value={values.brandKitId} /></div><MediaSourceFields mediaAssets={mediaAssets} onChange={onChange} values={values} /><Field label="Call to action" hint="Optional"><input className={fieldClass} maxLength={180} onChange={(event) => onChange({ cta: event.target.value })} placeholder="e.g. Learn more, Shop now, Follow for more" value={values.cta} /></Field><div className="grid gap-2 sm:grid-cols-3"><ToggleField checked={values.voiceover} description="Add generated narration" label="Voiceover" onChange={(voiceover) => onChange({ voiceover })} /><ToggleField checked={values.subtitles} description="Burn or attach subtitles" label="Captions / subtitles" onChange={(subtitles) => onChange({ subtitles })} /><ToggleField checked={values.music} description="Add suitable background audio" label="Music" onChange={(music) => onChange({ music })} /></div></div>
}

export function UGCGenerationForm({ values, brandKits, mediaAssets, onChange }: { values: FormValues; brandKits: BrandKit[]; mediaAssets: MediaAsset[]; onChange: (patch: Partial<FormValues>) => void }) {
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><Field label="Product / service name"><input className={fieldClass} maxLength={160} onChange={(event) => onChange({ productName: event.target.value })} placeholder="What are you promoting?" required value={values.productName} /></Field><SelectField label="Platform" onChange={(platform) => onChange({ platform })} value={values.platform} values={['Instagram', 'Facebook', 'TikTok', 'YouTube']} /></div><Field label="Product description"><textarea className={textAreaClass} maxLength={1500} onChange={(event) => onChange({ productDescription: event.target.value, prompt: event.target.value })} placeholder="Describe the product/service, benefits and important facts. Do not include unsupported claims." required value={values.productDescription} /></Field><div className="grid gap-3 sm:grid-cols-2"><SelectField label="Campaign goal" onChange={(goal) => onChange({ goal })} value={values.goal} values={['Promote product/service', 'Generate enquiries', 'Brand awareness', 'Product launch']} /><Field label="Target audience"><input className={fieldClass} maxLength={200} onChange={(event) => onChange({ audience: event.target.value })} placeholder="Who should this speak to?" value={values.audience} /></Field><Field label="Hook"><input className={fieldClass} maxLength={220} onChange={(event) => onChange({ hook: event.target.value })} placeholder="Opening angle or leave blank for AI" value={values.hook} /></Field><Field label="Offer"><input className={fieldClass} maxLength={220} onChange={(event) => onChange({ offer: event.target.value })} placeholder="Optional offer or incentive" value={values.offer} /></Field><Field label="CTA"><input className={fieldClass} maxLength={180} onChange={(event) => onChange({ cta: event.target.value })} placeholder="What should viewers do next?" value={values.cta} /></Field><SelectField label="Tone" onChange={(tone) => onChange({ tone })} value={values.tone} values={['Natural', 'Friendly', 'Confident', 'Energetic', 'Professional']} /><SelectField label="UGC format" onChange={(ugcFormat) => onChange({ ugcFormat })} value={values.ugcFormat} values={['Talking-head style', 'Testimonial', 'Product demo', 'Problem / solution', 'Before / after']} /><SelectField label="Duration" onChange={(duration) => onChange({ duration: Number(duration) })} value={String(values.duration)} values={['5', '10', '15']} /><SelectField label="Media source" onChange={(mediaSource) => onChange({ mediaSource, uploadedFile: null, mediaLibraryAssetId: '' })} value={values.mediaSource} values={['Upload product media', 'Select from Media Library', 'Generate supporting visuals']} /><BrandKitField brandKits={brandKits} onChange={(brandKitId) => onChange({ brandKitId })} value={values.brandKitId} /></div><MediaSourceFields mediaAssets={mediaAssets} onChange={onChange} values={values} /></div>
}

function editableHashtags(asset: GeneratedAsset, onChange: (asset: GeneratedAsset) => void) {
  return <Field label="Hashtags"><input className={fieldClass} onChange={(event) => onChange({ ...asset, hashtags: event.target.value.split(/\s+/).map((item) => item.replace(/^#/, '')).filter(Boolean) })} placeholder="#social #content" value={(asset.hashtags || []).map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')} /></Field>
}

export function CarouselEditor({ asset, onChange, onRegenerateSlide }: { asset: GeneratedAsset; onChange: (asset: GeneratedAsset) => void; onRegenerateSlide: (index: number) => void }) {
  const slides = asset.slides || []
  const dragIndex = useRef<number | null>(null)
  function replaceSlide(index: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const next = slides.map((slide, slideIndex) => slideIndex === index ? { ...slide, url, thumbnailUrl: url } : slide)
    onChange({ ...asset, slides: next })
  }
  function move(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return
    const next = [...slides]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange({ ...asset, slides: next })
  }
  return <div><div className="scrollbar-thin flex gap-3 overflow-x-auto pb-3">{slides.map((slide, index) => <article className="w-56 shrink-0 overflow-hidden rounded-2xl border border-border-soft bg-bg/35" draggable key={slide.id} onDragStart={() => { dragIndex.current = index }} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex.current !== null) move(dragIndex.current, index); dragIndex.current = null }}><div className="relative aspect-square bg-panel-soft">{slide.url ? <img alt={`Carousel slide ${index + 1}`} className="size-full object-cover" src={slide.url} /> : <div className="grid size-full place-items-center text-text-soft"><ImagePlus className="size-8" /></div>}<span className="absolute left-2 top-2 flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-[9px]"><GripVertical className="size-3" />{index + 1}</span></div><div className="space-y-2 p-3"><textarea aria-label={`Slide ${index + 1} text`} className={`${fieldClass} min-h-20 resize-y`} onChange={(event) => onChange({ ...asset, slides: slides.map((item, itemIndex) => itemIndex === index ? { ...item, caption: event.target.value } : item) })} placeholder="Slide copy" value={slide.caption || ''} /><div className="grid grid-cols-2 gap-1.5"><Button onClick={() => onRegenerateSlide(index)} size="sm" type="button"><RefreshCw className="size-3" />Redo</Button><label className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-1 rounded-xl border border-border-soft bg-bg-panel-alt px-2 text-[10px] font-semibold hover:border-brand-cyan/40"><input accept="image/*" className="sr-only" onChange={(event) => replaceSlide(index, event)} type="file" /><ImagePlus className="size-3" />Replace</label><Button onClick={() => onChange({ ...asset, slides: [...slides.slice(0, index + 1), { ...slide, id: crypto.randomUUID() }, ...slides.slice(index + 1)] })} size="sm" type="button" variant="ghost"><Copy className="size-3" />Duplicate</Button><Button disabled={slides.length <= 3} onClick={() => onChange({ ...asset, slides: slides.filter((_, itemIndex) => itemIndex !== index) })} size="sm" type="button" variant="ghost"><Trash2 className="size-3" />Delete</Button></div></div></article>)}</div>{slides.length < 10 && <Button onClick={() => { const last = slides.at(-1) || asset; onChange({ ...asset, slides: [...slides, { ...last, id: crypto.randomUUID() }] }) }} size="sm" type="button"><Plus className="size-3.5" />Add slide</Button>}</div>
}

export function VideoPreview({ asset }: { asset: GeneratedAsset }) {
  return <div className="overflow-hidden rounded-2xl border border-border-soft bg-black"><video className="aspect-video w-full bg-black object-contain" controls poster={asset.thumbnailUrl} src={asset.url}>Your browser does not support video playback.</video></div>
}

export function GeneratedAssetPreview({ asset, onChange, onRegenerateSlide }: { asset: GeneratedAsset; onChange: (asset: GeneratedAsset) => void; onRegenerateSlide: (index: number) => void }) {
  return <div className="space-y-4">{asset.type === 'carousel' ? <CarouselEditor asset={asset} onChange={onChange} onRegenerateSlide={onRegenerateSlide} /> : asset.type === 'video' ? <VideoPreview asset={asset} /> : <div className="overflow-hidden rounded-2xl border border-border-soft bg-bg/40"><img alt={asset.altText || 'Generated social post'} className="mx-auto max-h-[560px] w-full object-contain" src={asset.url} /></div>}
    <div className="grid gap-3 lg:grid-cols-2"><Field label="Caption"><textarea className={`${textAreaClass} min-h-36`} onChange={(event) => onChange({ ...asset, caption: event.target.value })} value={asset.caption || ''} /></Field><div className="space-y-3">{editableHashtags(asset, onChange)}{asset.type === 'image' && <Field label="Alt text"><textarea className={`${textAreaClass} min-h-20`} onChange={(event) => onChange({ ...asset, altText: event.target.value })} value={asset.altText || ''} /></Field>}{asset.script !== undefined && <Field label="Script"><textarea className={`${textAreaClass} min-h-24`} onChange={(event) => onChange({ ...asset, script: event.target.value })} value={asset.script || ''} /></Field>}</div></div>
  </div>
}

function requestFor(type: AIContentType, values: FormValues, sourceAssetId?: string): GenerationRequest {
  const prompt = type === 'ugc_ad' ? `${values.productName}: ${values.productDescription}`.trim() : values.prompt.trim()
  return {
    type,
    prompt,
    platform: values.platform,
    aspectRatio: values.aspectRatio,
    tone: values.tone,
    brandKitId: values.brandKitId || undefined,
    options: {
      goal: values.goal,
      visualStyle: values.visualStyle,
      variants: values.variants,
      slides: values.slides,
      captionStyle: values.captionStyle,
      ctaStyle: values.ctaStyle,
      duration: values.duration,
      visualSource: values.visualSource,
      voiceover: values.voiceover,
      subtitles: values.subtitles,
      music: values.music,
      cta: values.cta,
      productName: values.productName,
      productDescription: values.productDescription,
      targetAudience: values.audience,
      hook: values.hook,
      offer: values.offer,
      ugcFormat: values.ugcFormat,
      mediaSource: values.mediaSource,
      sourceMediaLibraryAssetId: sourceAssetId || values.mediaLibraryAssetId || undefined,
    },
  }
}

function generationFunction(type: AIContentType) {
  if (type === 'image_post') return generateImagePost
  if (type === 'carousel_post') return generateCarouselPost
  if (type === 'short_video') return generateShortVideo
  return generateUGCAd
}

function draftTitle(type: AIContentType, values: FormValues) {
  const definition = workflowDefinitions.find((item) => item.type === type)
  const seed = type === 'ugc_ad' ? values.productName : values.prompt
  return seed.trim().slice(0, 70) || definition?.title || 'AI content draft'
}

function buildDraft(type: AIContentType, values: FormValues, asset: GeneratedAsset | null, existing?: AIDraft | null, savedAssets: MediaAsset[] = []): AIDraft {
  return {
    id: existing?.id || crypto.randomUUID(),
    contentType: type,
    title: draftTitle(type, values),
    thumbnailUrl: asset?.thumbnailUrl || asset?.slides?.[0]?.thumbnailUrl || asset?.slides?.[0]?.url || asset?.url,
    updatedAt: new Date().toISOString(),
    status: asset ? 'ready' : 'draft',
    prompt: type === 'ugc_ad' ? values.productDescription : values.prompt,
    caption: asset?.caption || existing?.caption || '',
    hashtags: asset?.hashtags || existing?.hashtags || [],
    altText: asset?.altText || existing?.altText || '',
    asset,
    mediaLibraryAsset: savedAssets[0] || existing?.mediaLibraryAsset || null,
    mediaLibraryAssets: savedAssets.length ? savedAssets : existing?.mediaLibraryAssets || [],
  }
}

function requiredReady(type: AIContentType, values: FormValues) {
  if (type === 'ugc_ad') return Boolean(values.productName.trim() && values.productDescription.trim())
  return Boolean(values.prompt.trim())
}

export function GenerationModal({ open, type, access, initialDraft, onClose, onSaved, onContinue, onToast }: { open: boolean; type: AIContentType | null; access: AIPlanAccess; initialDraft?: AIDraft | null; onClose: () => void; onSaved: (draft: AIDraft) => void; onContinue: (draft: AIDraft) => void; onToast: (message: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const [values, setValues] = useState<FormValues>(defaults)
  const [status, setStatus] = useState<GenerationStatus>('idle')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [asset, setAsset] = useState<GeneratedAsset | null>(null)
  const [credits, setCredits] = useState(1)
  const [brandKits, setBrandKits] = useState<BrandKit[]>([])
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([])
  const [savedAssets, setSavedAssets] = useState<MediaAsset[]>([])
  const [mode, setMode] = useState<'form' | 'preview'>('form')
  const currentType = type || initialDraft?.contentType || null

  useEffect(() => {
    if (!open || !currentType) return
    const next = { ...defaults }
    if (currentType === 'carousel_post') { next.goal = 'Educational'; next.aspectRatio = '1:1' }
    if (currentType === 'short_video') { next.aspectRatio = '9:16'; next.visualStyle = 'Product showcase' }
    if (currentType === 'ugc_ad') { next.aspectRatio = '9:16'; next.tone = 'Natural'; next.goal = 'Promote product/service' }
    if (initialDraft) {
      next.prompt = initialDraft.prompt || ''
      next.productDescription = initialDraft.contentType === 'ugc_ad' ? initialDraft.prompt || '' : ''
      next.productName = initialDraft.contentType === 'ugc_ad' ? initialDraft.title : ''
    }
    setValues(next)
    setAsset(initialDraft?.asset || null)
    setSavedAssets(initialDraft?.mediaLibraryAssets || (initialDraft?.mediaLibraryAsset ? [initialDraft.mediaLibraryAsset] : []))
    setMode(initialDraft?.asset ? 'preview' : 'form')
    setStatus(initialDraft?.asset ? 'completed' : 'idle')
    setError('')
    setMessage('')
    void Promise.all([getBrandKits(), fetchMediaLibrary().then((workspace) => workspace.assets)]).then(([kits, assets]) => { setBrandKits(kits); setMediaAssets(assets) }).catch(() => {})
  }, [open, currentType, initialDraft])

  useEffect(() => {
    if (!open || !currentType) return
    const timer = window.setTimeout(() => {
      void estimateGenerationCost(requestFor(currentType, values)).then((estimate) => setCredits(estimate.credits)).catch(() => {})
    }, 180)
    return () => window.clearTimeout(timer)
  }, [open, currentType, values])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusable = () => Array.from(containerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !['preparing', 'generating', 'processing'].includes(status)) onClose()
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKey)
    window.setTimeout(() => focusable()[0]?.focus(), 0)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleKey) }
  }, [open, onClose, status])

  if (!open || !currentType) return null
  const definition = workflowDefinitions.find((item) => item.type === currentType)!
  const generating = ['preparing', 'generating', 'processing'].includes(status)
  const insufficient = access.creditsConfigured && !access.unlimitedCredits && access.creditsRemaining !== null && access.creditsRemaining < credits

  function patch(valuesPatch: Partial<FormValues>) { setValues((current) => ({ ...current, ...valuesPatch })) }

  async function prepareSourceAsset() {
    if (!values.uploadedFile) return values.mediaLibraryAssetId || undefined
    setStatus('preparing')
    setMessage('Saving your source media to Media Library before generation.')
    const stored = await uploadMediaAsset(values.uploadedFile, null, (percent) => setMessage(`Saving source media to Media Library · ${percent}%`), controllerRef.current?.signal)
    setMediaAssets((current) => [stored, ...current.filter((item) => item.id !== stored.id)])
    patch({ mediaLibraryAssetId: stored.id, uploadedFile: null })
    return stored.id
  }

  async function runGeneration(extraOptions: Record<string, unknown> = {}) {
    if (!requiredReady(currentType, values)) { setError(currentType === 'ugc_ad' ? 'Add the product/service name and description before generating.' : 'Add a clear prompt before generating.'); setStatus('failed'); return }
    if (insufficient) { setError('Not enough AI credits for this generation.'); setStatus('failed'); return }
    setError('')
    setStatus('preparing')
    setMessage('Preparing your brief and validating the generation request.')
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const sourceAssetId = await prepareSourceAsset()
      const request = requestFor(currentType, values, sourceAssetId)
      request.options = { ...request.options, ...extraOptions }
      setStatus('generating')
      setMessage('The generation provider is creating the requested media and publishing copy.')
      const result = await generationFunction(currentType)(request, controller.signal)
      if (controller.signal.aborted) return
      setStatus('processing')
      setMessage('Finalising caption, hashtags, accessibility text and media metadata.')
      setAsset(result)
      setSavedAssets([])
      setMode('preview')
      setStatus('completed')
      setMessage('Content generated successfully.')
      rememberGeneration({ id: result.id, type: currentType, prompt: request.prompt, createdAt: result.createdAt, creditsUsed: result.creditsUsed, status: 'completed', assetUrl: result.url })
      onToast('Content generated successfully.')
    } catch (caught) {
      if (controller.signal.aborted || (caught instanceof DOMException && caught.name === 'AbortError')) {
        setStatus('cancelled')
        setMessage('Generation stopped. No completed asset was added to Media Library.')
        return
      }
      const text = caught instanceof Error ? caught.message : 'Generation failed. Please retry or edit the input.'
      setStatus('failed')
      setError(text)
      setMessage(text)
      rememberGeneration({ id: crypto.randomUUID(), type: currentType, prompt: requestFor(currentType, values).prompt, createdAt: new Date().toISOString(), creditsUsed: 0, status: 'failed' })
    } finally {
      controllerRef.current = null
    }
  }

  function cancel() {
    controllerRef.current?.abort()
    setStatus('cancelled')
    setMessage('Cancelling the current request…')
  }

  async function storeMedia() {
    if (!asset) return []
    if (savedAssets.length) return savedAssets
    setStatus('processing')
    setMessage('Saving generated media into Media Library.')
    try {
      const stored = await saveGeneratedAssets(asset, (percent) => setMessage(`Saving generated media to Media Library · ${percent}%`))
      setSavedAssets(stored)
      setStatus('completed')
      setMessage('Generated media saved to Media Library.')
      onToast('Generated media saved to Media Library.')
      return stored
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : 'Generated media could not be saved.'
      setStatus('failed')
      setError(text)
      throw caught
    }
  }

  async function saveDraft() {
    try {
      const draft = buildDraft(currentType, values, asset, initialDraft, savedAssets)
      const saved = await saveAIDraft(draft)
      onSaved(saved)
      onToast('AI draft saved.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The draft could not be saved.'); setStatus('failed') }
  }

  async function continueToPosts() {
    if (!asset) { setError('Generate content before continuing to Posts.'); return }
    try {
      const stored = await storeMedia()
      const draft = buildDraft(currentType, values, asset, initialDraft, stored)
      const saved = await saveAIDraft(draft)
      const prepared = await sendDraftToPosts(saved)
      onSaved(prepared)
      onContinue(prepared)
    } catch { /* storeMedia/save functions surface the error */ }
  }

  async function regenerateSlide(index: number) {
    if (currentType !== 'carousel_post' || !asset) return
    await runGeneration({ regenerateSlideIndex: index, variationOf: asset.id })
  }

  function downloadAsset() {
    if (!asset) return
    const items = asset.type === 'carousel' && asset.slides?.length ? asset.slides : [asset]
    items.forEach((item, index) => {
      const link = document.createElement('a')
      link.href = item.url
      link.download = `inxsocial-${currentType}-${index + 1}`
      link.target = '_blank'
      link.rel = 'noopener'
      link.click()
    })
  }

  const form = currentType === 'image_post'
    ? <ImageGenerationForm brandKits={brandKits} onChange={patch} values={values} />
    : currentType === 'carousel_post'
      ? <CarouselGenerationForm brandKits={brandKits} onChange={patch} values={values} />
      : currentType === 'short_video'
        ? <VideoGenerationForm brandKits={brandKits} mediaAssets={mediaAssets} onChange={patch} values={values} />
        : <UGCGenerationForm brandKits={brandKits} mediaAssets={mediaAssets} onChange={patch} values={values} />

  return createPortal(<div className="fixed inset-0 z-[110] bg-[#01070d]/88 backdrop-blur-md" onMouseDown={(event) => { if (event.currentTarget === event.target && !generating) onClose() }}>
    <div className="flex h-dvh items-end justify-center p-0 sm:items-center sm:p-4" ref={containerRef}>
      <section aria-labelledby="ai-generation-title" aria-modal="true" className="flex h-[100dvh] w-full max-w-[1500px] flex-col overflow-hidden border border-brand-cyan/25 bg-[linear-gradient(145deg,rgba(7,24,38,.99),rgba(3,13,24,.99))] shadow-[0_40px_150px_rgba(0,0,0,.75)] sm:h-[min(92dvh,940px)] sm:rounded-[26px]" role="dialog">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-soft px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand-teal/25 bg-brand-teal/10 text-brand-cyan"><definition.icon className="size-4" /></span><div className="min-w-0"><span className="text-[8px] font-bold uppercase tracking-[.16em] text-text-soft">{definition.label}</span><h2 className="truncate text-base font-semibold" id="ai-generation-title">Create {definition.title}</h2></div></div>
          <div className="flex items-center gap-2"><span className="hidden rounded-full border border-brand-amber/20 bg-brand-amber/8 px-2.5 py-1 text-[9px] font-semibold text-brand-amber sm:inline-flex"><CoinsIcon />~{credits} credit{credits === 1 ? '' : 's'}</span><button aria-label={`Close ${definition.title} creator`} className="grid size-9 place-items-center rounded-xl border border-border-soft text-text-muted transition hover:border-brand-cyan/30 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" disabled={generating} onClick={onClose} type="button"><X className="size-4" /></button></div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)]">
          <div className="scrollbar-thin min-h-0 overflow-y-auto border-b border-border-soft p-4 lg:border-b-0 lg:border-r sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">{mode === 'form' ? 'Configure your post' : 'Generation brief'}</h3><p className="mt-1 text-[9px] text-text-soft">Every setting is part of the generation request.</p></div>{mode === 'preview' && <Button onClick={() => setMode('form')} size="sm" type="button"><ArrowLeft className="size-3.5" />Edit input</Button>}</div>
            {form}
            <div className="mt-4"><CreditCostPreview configured={access.creditsConfigured} credits={credits} remaining={access.creditsRemaining} unlimited={access.unlimitedCredits} /></div>
            <div className="mt-4"><GenerationProgress message={message || undefined} status={status} /></div>
            {error && <div className="mt-3 rounded-2xl border border-brand-red/30 bg-brand-red/[.06] p-4"><strong className="text-xs text-brand-red">{error}</strong><div className="mt-3 flex flex-wrap gap-2"><Button disabled={generating} onClick={() => void runGeneration()} size="sm">Retry</Button><Button onClick={() => { setMode('form'); setError(''); setStatus('idle') }} size="sm">Edit input</Button><Button onClick={onClose} size="sm" variant="ghost">Return to Studio</Button></div></div>}
          </div>

          <div className="scrollbar-thin min-h-0 overflow-y-auto bg-black/[.08] p-4 sm:p-5">
            {asset ? <><div className="mb-4 flex items-center justify-between gap-3"><div><span className="text-[9px] font-bold uppercase tracking-[.16em] text-brand-green">Generated</span><h3 className="mt-1 text-sm font-semibold">Review & refine</h3></div><span className="rounded-full border border-brand-green/25 bg-brand-green/10 px-2.5 py-1 text-[9px] font-semibold text-brand-green">{asset.creditsUsed} credits used</span></div><GeneratedAssetPreview asset={asset} onChange={setAsset} onRegenerateSlide={(index) => void regenerateSlide(index)} /><div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3"><Button disabled={generating} onClick={() => void runGeneration()}><RefreshCw className="size-3.5" />Regenerate</Button><Button disabled={generating} onClick={() => void runGeneration({ variationOf: asset.id })}><WandSparkles className="size-3.5" />Create variation</Button><Button onClick={() => setMode('form')}><Sparkles className="size-3.5" />Edit prompt</Button><Button onClick={downloadAsset}><Download className="size-3.5" />Download</Button><Button disabled={generating} onClick={() => void storeMedia()}><Library className="size-3.5" />Save to Media Library</Button><Button disabled={generating} onClick={() => void saveDraft()}><Save className="size-3.5" />Save draft</Button></div><Button className="mt-3 w-full" disabled={generating} onClick={() => void continueToPosts()} variant="primary"><Send className="size-4" />Continue to Posts <ArrowRight className="size-4" /></Button><p className="mt-2 text-center text-[9px] leading-4 text-text-soft">Media is saved first. Posts will be pre-filled, but destinations and publishing time remain unselected.</p></> : <div className="grid min-h-[420px] place-items-center rounded-3xl border border-dashed border-border-soft bg-[radial-gradient(circle_at_center,rgba(34,211,238,.06),transparent_22rem)] p-8 text-center"><div><span className="mx-auto grid size-16 place-items-center rounded-2xl border border-brand-cyan/25 bg-brand-cyan/8 text-brand-cyan"><Sparkles className="size-7" /></span><h3 className="mt-4 text-lg font-semibold">Your generated post appears here.</h3><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-text-muted">Configure the brief, review the estimated credit cost, then generate. Nothing is published from AI Content Studio.</p>{generating ? <Button className="mt-5" onClick={cancel} variant="ghost"><X className="size-4" />Cancel generation</Button> : <Button className="mt-5" disabled={!requiredReady(currentType, values) || insufficient} onClick={() => void runGeneration()} variant="primary"><Sparkles className="size-4" />Generate {definition.title}</Button>}</div></div>}
          </div>
        </div>

        {!asset && <footer className="flex shrink-0 flex-col gap-2 border-t border-border-soft bg-bg/55 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"><span className="text-[9px] text-text-soft">Generated content stays in Studio until you save it or continue to Posts.</span><div className="flex gap-2">{generating ? <Button onClick={cancel}><X className="size-4" />Cancel</Button> : <><Button onClick={onClose}>Close</Button><Button disabled={!requiredReady(currentType, values) || insufficient} onClick={() => void runGeneration()} variant="primary"><Sparkles className="size-4" />Generate · ~{credits} credits</Button></>}</div></footer>}
      </section>
    </div>
  </div>, document.body)
}

function CoinsIcon() { return <span aria-hidden="true" className="mr-1">⚡</span> }
