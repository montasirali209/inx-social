import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import {
  ArrowRight,
  Bot,
  Check,
  ExternalLink,
  FileImage,
  Globe2,
  ImagePlus,
  LoaderCircle,
  MessageSquareText,
  Paperclip,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react'
import type { AIDraft, AIContentType, AIPlanAccess, GeneratedAsset } from '../../types/ai-content-studio'
import type { MediaAsset } from '../../types/media-library'
import { uploadMediaAsset } from '../../lib/media-library-api'
import { saveAIDraft } from '../../lib/ai-content-studio-api'
import {
  generateConversationalImagePost,
  sendPostStudioMessage,
  type PostStudioAssistantResponse,
  type PostStudioBrief,
  type PostStudioMessage,
} from '../../lib/ai-post-studio-api'
import { Button } from '../ui/Button'

const INITIAL_ASSISTANT = 'Tell me what you want to post about. I can analyse a website, product screenshot, logo or reference image and I’ll ask only for anything I genuinely need.'
const ASPECTS: PostStudioBrief['aspectRatio'][] = ['4:5', '1:1', '9:16', '16:9']
const PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'YouTube']

function firstPrompt(messages: PostStudioMessage[], brief: PostStudioBrief | null) {
  return messages.find((message) => message.role === 'user')?.content || brief?.objective || 'Create a social media post'
}

function extractUrls(text: string) {
  const matches = text.match(/https?:\/\/[^\s<>()]+/gi) || []
  return [...new Set(matches.map((value) => value.replace(/[.,;!?]+$/, '')))].slice(0, 2)
}

function initialMessagesFor(draft?: AIDraft | null): PostStudioMessage[] {
  const seed: PostStudioMessage[] = [{ role: 'assistant', content: INITIAL_ASSISTANT }]
  if (draft?.prompt) seed.push({ role: 'user', content: draft.prompt })
  return seed
}

function buildDraft(asset: GeneratedAsset, messages: PostStudioMessage[], brief: PostStudioBrief | null, existing?: AIDraft | null): AIDraft {
  const prompt = firstPrompt(messages, brief)
  return {
    id: existing?.id || crypto.randomUUID(),
    contentType: 'image_post',
    title: (brief?.headline || prompt || 'AI image post').slice(0, 70),
    thumbnailUrl: asset.thumbnailUrl || asset.url,
    updatedAt: new Date().toISOString(),
    status: 'ready',
    prompt: prompt.slice(0, 1500),
    caption: brief?.caption || asset.caption || '',
    hashtags: brief?.hashtags || asset.hashtags || [],
    altText: brief?.altText || asset.altText || '',
    asset: {
      ...asset,
      caption: brief?.caption || asset.caption || '',
      hashtags: brief?.hashtags || asset.hashtags || [],
      altText: brief?.altText || asset.altText || '',
    },
    mediaLibraryAsset: existing?.mediaLibraryAsset || null,
    mediaLibraryAssets: existing?.mediaLibraryAssets || [],
  }
}

function ChatBubble({ message, index }: { message: PostStudioMessage; index: number }) {
  const assistant = message.role === 'assistant'
  return <div className={`flex animate-[fadeIn_.24s_ease-out] gap-2.5 ${assistant ? 'justify-start' : 'justify-end'}`} style={{ animationDelay: `${Math.min(index, 6) * 28}ms` }}>
    {assistant && <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><Bot className="size-3.5" /></span>}
    <div className={`max-w-[86%] rounded-2xl border px-3.5 py-3 text-[11px] leading-5 shadow-[0_10px_30px_rgba(0,0,0,.16)] ${assistant ? 'border-border-soft bg-white/[.035] text-text-main' : 'border-brand-teal/30 bg-brand-teal/12 text-white'}`}>
      <p className="whitespace-pre-wrap">{message.content}</p>
    </div>
  </div>
}

function AnalysisPill({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <span className="inline-flex min-h-8 items-center gap-2 rounded-xl border border-border-soft bg-bg/35 px-2.5 text-[9px] font-medium text-text-muted">{icon}{children}</span>
}

export function ImagePostChatModal({
  open,
  type,
  access,
  initialDraft,
  onClose,
  onSaved,
  onContinue,
  onToast,
}: {
  open: boolean
  type: AIContentType | null
  access: AIPlanAccess
  initialDraft?: AIDraft | null
  onClose: () => void
  onSaved: (draft: AIDraft) => void
  onContinue: (draft: AIDraft) => void
  onToast: (message: string) => void
}) {
  const containerRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const [messages, setMessages] = useState<PostStudioMessage[]>(() => initialMessagesFor(initialDraft))
  const [composer, setComposer] = useState('')
  const [references, setReferences] = useState<MediaAsset[]>([])
  const [urls, setUrls] = useState<string[]>(() => extractUrls(initialDraft?.prompt || ''))
  const [assistantResult, setAssistantResult] = useState<PostStudioAssistantResponse | null>(null)
  const [brief, setBrief] = useState<PostStudioBrief | null>(null)
  const [asset, setAsset] = useState<GeneratedAsset | null>(() => initialDraft?.asset?.type === 'image' ? initialDraft.asset : null)
  const [platform, setPlatform] = useState('Instagram')
  const [aspectRatio, setAspectRatio] = useState<PostStudioBrief['aspectRatio']>('4:5')
  const [thinking, setThinking] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const prior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => { document.body.style.overflow = prior; window.clearTimeout(timer) }
  }, [open])

  const ready = Boolean(assistantResult?.readyToGenerate && brief?.visualDirection)
  const insufficient = access.creditsConfigured && !access.unlimitedCredits && access.creditsRemaining !== null && access.creditsRemaining < 5
  const busy = thinking || generating || uploading
  const caption = brief?.caption || asset?.caption || ''
  const hashtags = brief?.hashtags || asset?.hashtags || []

  async function askAssistant(nextMessages: PostStudioMessage[], nextUrls = urls, nextReferences = references) {
    setThinking(true)
    setError('')
    try {
      const result = await sendPostStudioMessage({
        messages: nextMessages.filter((message, index) => index > 0 || message.role === 'user'),
        urls: nextUrls,
        referenceAssetIds: nextReferences.map((item) => item.id),
        platform,
        aspectRatio,
      })
      setAssistantResult(result)
      setBrief(result.brief)
      setPlatform(result.brief.platform || platform)
      setAspectRatio(result.brief.aspectRatio || aspectRatio)
      setMessages((current) => [...current, { role: 'assistant', content: result.reply }])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The AI Post Studio could not respond.')
    } finally {
      setThinking(false)
    }
  }

  async function sendText(value = composer) {
    const text = value.trim()
    if (!text || busy) return
    const discovered = extractUrls(text)
    const nextUrls = [...new Set([...urls, ...discovered])].slice(0, 2)
    setUrls(nextUrls)
    setComposer('')
    const userMessage: PostStudioMessage = { role: 'user', content: text }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    await askAssistant(nextMessages, nextUrls, references)
  }

  async function uploadReference(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('For this first Image Post release, upload a PNG, JPEG, WebP or GIF reference image.')
      return
    }
    setUploading(true)
    setUploadProgress(0)
    setError('')
    try {
      const stored = await uploadMediaAsset(file, null, setUploadProgress)
      const nextReferences = [stored, ...references.filter((item) => item.id !== stored.id)].slice(0, 4)
      setReferences(nextReferences)
      const message: PostStudioMessage = { role: 'user', content: `I uploaded “${stored.fileName}” as a reference. Analyse it and use it where it improves this post.` }
      const nextMessages = [...messages, message]
      setMessages(nextMessages)
      await askAssistant(nextMessages, urls, nextReferences)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The reference image could not be uploaded.')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  async function generateImage() {
    if (!brief || !ready || insufficient || generating) return
    setGenerating(true)
    setError('')
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const generated = await generateConversationalImagePost({
        prompt: firstPrompt(messages, brief),
        platform,
        aspectRatio,
        referenceAssetIds: references.map((item) => item.id),
        brief: { ...brief, platform, aspectRatio },
      }, controller.signal)
      setAsset(generated)
      onToast('Post creative generated with GPT-Image-2.')
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      setError(caught instanceof Error ? caught.message : 'The post image could not be generated.')
    } finally {
      controllerRef.current = null
      setGenerating(false)
    }
  }

  async function saveDraft() {
    if (!asset) return
    try {
      const saved = await saveAIDraft(buildDraft(asset, messages, brief, initialDraft))
      onSaved(saved)
      onToast('AI post draft saved.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The draft could not be saved.')
    }
  }

  function continueToPosts() {
    if (!asset) return
    onContinue(buildDraft(asset, messages, brief, initialDraft))
  }

  function handleKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendText()
    }
  }

  function addUrl() {
    setComposer((current) => current || 'https://')
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  function reactToPointer(event: PointerEvent<HTMLElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - box.left) / Math.max(1, box.width)) * 100
    const y = ((event.clientY - box.top) / Math.max(1, box.height)) * 100
    event.currentTarget.style.setProperty('--studio-x', `${x}%`)
    event.currentTarget.style.setProperty('--studio-y', `${y}%`)
  }

  const sourceSummary = useMemo(() => [
    ...urls.map((url) => ({ key: url, label: new URL(url).hostname, icon: <Globe2 className="size-3" /> })),
    ...references.map((item) => ({ key: item.id, label: item.fileName, icon: <FileImage className="size-3" /> })),
  ], [urls, references])

  if (!open || type !== 'image_post') return null

  return createPortal(<div className="fixed inset-0 z-[110] bg-[#01070d]/90 backdrop-blur-md">
    <div className="flex h-dvh items-end justify-center p-0 sm:items-center sm:p-4">
      <section
        aria-labelledby="ai-post-studio-title"
        aria-modal="true"
        className="group/studio relative flex h-[100dvh] w-full max-w-[1560px] flex-col overflow-hidden border border-brand-cyan/25 bg-[linear-gradient(145deg,rgba(5,22,34,.995),rgba(2,12,22,.995))] shadow-[0_40px_160px_rgba(0,0,0,.78)] sm:h-[min(94dvh,960px)] sm:rounded-[28px]"
        onPointerMove={reactToPointer}
        ref={containerRef}
        role="dialog"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-500 [background:radial-gradient(620px_circle_at_var(--studio-x,25%)_var(--studio-y,20%),rgba(20,184,166,.085),transparent_62%)]" />
        <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-border-soft bg-bg/25 px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative grid size-10 shrink-0 place-items-center rounded-2xl border border-brand-teal/30 bg-brand-teal/10 text-brand-cyan shadow-[0_0_32px_rgba(20,184,166,.13)]"><MessageSquareText className="size-4" /><span className="absolute -right-1 -top-1 size-2.5 animate-pulse rounded-full border-2 border-[#071725] bg-brand-green" /></span>
            <div className="min-w-0"><span className="text-[8px] font-bold uppercase tracking-[.18em] text-brand-cyan">Conversational creator</span><h2 className="truncate text-base font-semibold" id="ai-post-studio-title">AI Post Studio <span className="font-normal text-text-soft">· Image Post</span></h2></div>
          </div>
          <div className="flex items-center gap-2"><span className="hidden rounded-full border border-brand-amber/20 bg-brand-amber/8 px-2.5 py-1 text-[9px] font-semibold text-brand-amber sm:inline-flex">⚡ 5 credits per final render</span><button aria-label="Close AI Post Studio" className="grid size-9 place-items-center rounded-xl border border-border-soft text-text-muted transition hover:border-brand-cyan/35 hover:bg-white/[.04] hover:text-white" disabled={busy} onClick={onClose} type="button"><X className="size-4" /></button></div>
        </header>

        <div className="relative z-10 grid min-h-0 flex-1 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
          <div className="flex min-h-0 flex-col border-b border-border-soft lg:border-b-0 lg:border-r">
            <div className="flex shrink-0 items-start justify-between gap-4 px-4 pb-3 pt-4 sm:px-5">
              <div><h3 className="text-sm font-semibold">Build the post with AI</h3><p className="mt-1 text-[9px] leading-4 text-text-soft">Share a simple idea. Add a URL, logo, screenshot or reference when useful. The assistant asks only for missing context.</p></div>
              <span className="hidden items-center gap-1.5 rounded-full border border-brand-green/20 bg-brand-green/8 px-2 py-1 text-[8px] font-bold uppercase tracking-[.12em] text-brand-green sm:flex"><span className="size-1.5 animate-pulse rounded-full bg-brand-green" />Live</span>
            </div>

            {sourceSummary.length > 0 && <div className="flex shrink-0 flex-wrap gap-1.5 px-4 pb-3 sm:px-5">{sourceSummary.map((source) => <AnalysisPill icon={source.icon} key={source.key}>{source.label}</AnalysisPill>)}</div>}

            <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-2 sm:px-5">
              {messages.map((message, index) => <ChatBubble index={index} key={`${message.role}-${index}-${message.content.slice(0, 18)}`} message={message} />)}
              {thinking && <div className="flex items-center gap-2.5"><span className="grid size-7 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><Bot className="size-3.5" /></span><div className="flex items-center gap-2 rounded-2xl border border-border-soft bg-white/[.035] px-3.5 py-3 text-[10px] text-text-muted"><span className="flex gap-1"><i className="size-1.5 animate-bounce rounded-full bg-brand-cyan [animation-delay:-.2s]" /><i className="size-1.5 animate-bounce rounded-full bg-brand-cyan [animation-delay:-.1s]" /><i className="size-1.5 animate-bounce rounded-full bg-brand-cyan" /></span>Analysing your post context…</div></div>}
              {assistantResult?.quickReplies?.length ? <div className="flex flex-wrap gap-1.5 pl-9">{assistantResult.quickReplies.map((reply) => <button className="rounded-full border border-brand-cyan/20 bg-brand-cyan/[.05] px-3 py-1.5 text-[9px] font-semibold text-brand-cyan transition hover:border-brand-cyan/45 hover:bg-brand-cyan/10" disabled={busy} key={reply} onClick={() => void sendText(reply)} type="button">{reply}</button>)}</div> : null}
            </div>

            <div className="shrink-0 border-t border-border-soft bg-bg/35 p-3 sm:p-4">
              {error && <div className="mb-2 rounded-xl border border-brand-red/25 bg-brand-red/[.05] px-3 py-2 text-[10px] leading-4 text-brand-red">{error}</div>}
              {uploading && <div className="mb-2 flex items-center gap-2 rounded-xl border border-brand-cyan/20 bg-brand-cyan/[.04] px-3 py-2 text-[9px] text-text-muted"><LoaderCircle className="size-3 animate-spin text-brand-cyan" />Uploading reference · {uploadProgress}%</div>}
              <div className="rounded-2xl border border-border-strong bg-[#04111c]/85 p-2 shadow-[0_18px_50px_rgba(0,0,0,.24)] transition focus-within:border-brand-cyan/35 focus-within:shadow-[0_18px_55px_rgba(6,182,212,.08)]">
                <textarea aria-label="Message AI Post Studio" className="min-h-20 w-full resize-none bg-transparent px-2 py-1.5 text-xs leading-5 text-text-main outline-none placeholder:text-text-soft" disabled={busy} maxLength={4000} onChange={(event) => setComposer(event.target.value)} onKeyDown={handleKey} placeholder="Describe your post idea, paste a product URL, or ask the Studio to refine the current concept…" ref={inputRef} value={composer} />
                <div className="flex items-center justify-between gap-2 border-t border-border-soft pt-2">
                  <div className="flex items-center gap-1"><input accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(event) => void uploadReference(event)} ref={fileRef} type="file" /><button className="inline-flex size-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-white/[.05] hover:text-brand-cyan" disabled={busy || references.length >= 4} onClick={() => fileRef.current?.click()} title="Upload reference image" type="button"><Paperclip className="size-3.5" /></button><button className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-[9px] font-semibold text-text-muted transition hover:bg-white/[.05] hover:text-brand-cyan" disabled={busy || urls.length >= 2} onClick={addUrl} type="button"><Globe2 className="size-3.5" />Add URL</button></div>
                  <button aria-label="Send message" className="grid size-9 place-items-center rounded-xl bg-brand-teal text-[#02130f] shadow-[0_0_22px_rgba(20,184,166,.18)] transition hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(20,184,166,.3)] disabled:cursor-not-allowed disabled:opacity-40" disabled={busy || !composer.trim()} onClick={() => void sendText()} type="button"><Send className="size-4" /></button>
                </div>
              </div>

              <details className="group mt-2 rounded-xl border border-border-soft/80 bg-bg/20">
                <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[9px] font-semibold text-text-soft transition hover:text-text-muted"><span>Optional controls</span><span className="text-[8px]">AI chooses sensible defaults</span></summary>
                <div className="grid gap-2 border-t border-border-soft p-3 sm:grid-cols-2">
                  <label className="text-[9px] font-semibold text-text-muted">Platform<select className="mt-1.5 min-h-9 w-full rounded-xl border border-border-soft bg-bg/50 px-2.5 text-[10px] text-text-main outline-none" onChange={(event) => setPlatform(event.target.value)} value={platform}>{PLATFORMS.map((item) => <option key={item}>{item}</option>)}</select></label>
                  <label className="text-[9px] font-semibold text-text-muted">Aspect ratio<select className="mt-1.5 min-h-9 w-full rounded-xl border border-border-soft bg-bg/50 px-2.5 text-[10px] text-text-main outline-none" onChange={(event) => setAspectRatio(event.target.value as PostStudioBrief['aspectRatio'])} value={aspectRatio}>{ASPECTS.map((item) => <option key={item}>{item}</option>)}</select></label>
                </div>
              </details>
            </div>
          </div>

          <div className="scrollbar-thin min-h-0 overflow-y-auto bg-black/[.07] p-4 sm:p-5">
            {!asset ? <div className="relative grid min-h-[520px] h-full place-items-center overflow-hidden rounded-[28px] border border-dashed border-brand-cyan/18 bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,.075),transparent_23rem)] p-7 text-center">
              <div aria-hidden="true" className="absolute left-[17%] top-[20%] size-24 rounded-full bg-brand-cyan/[.04] blur-2xl transition-transform duration-700 group-hover/studio:-translate-y-2" />
              <div aria-hidden="true" className="absolute bottom-[16%] right-[16%] size-32 rounded-full bg-brand-teal/[.045] blur-3xl transition-transform duration-700 group-hover/studio:translate-y-2" />
              <div className="relative max-w-lg">
                <span className="relative mx-auto grid size-16 place-items-center rounded-[22px] border border-brand-cyan/25 bg-brand-cyan/[.07] text-brand-cyan shadow-[0_0_50px_rgba(34,211,238,.08)]"><Sparkles className="size-7" /><span className="absolute inset-0 animate-ping rounded-[22px] border border-brand-cyan/10 [animation-duration:3s]" /></span>
                {generating ? <><h3 className="mt-5 text-lg font-semibold">Creating your final post…</h3><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-text-muted">GPT-Image-2 is rendering the approved creative direction and applying your references. Your 5 credits are committed only when generation completes.</p><div className="mx-auto mt-5 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/[.05]"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-brand-teal to-brand-cyan" /></div></> : <><h3 className="mt-5 text-lg font-semibold">Your post comes together here.</h3><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-text-muted">Chat naturally on the left. The Studio can analyse URLs and references, prepare the caption and creative direction, then render one final post when you are ready.</p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2"><AnalysisPill icon={<MessageSquareText className="size-3" />}>Ask & refine</AnalysisPill><AnalysisPill icon={<Globe2 className="size-3" />}>Analyse URLs</AnalysisPill><AnalysisPill icon={<ImagePlus className="size-3" />}>Use references</AnalysisPill></div>
                  <Button className="mt-6" disabled={!ready || insufficient || busy} onClick={() => void generateImage()} variant="primary"><WandSparkles className="size-4" />{ready ? 'Generate final post · 5 credits' : 'Build the brief in chat first'}</Button>
                  {insufficient && <p className="mt-2 text-[9px] text-brand-red">You need 5 AI credits for the final render.</p>}
                </>}
              </div>
            </div> : <div>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.15em] text-brand-green"><Check className="size-3" />Generated</span><h3 className="mt-1 text-sm font-semibold">Review & refine your post</h3><p className="mt-1 text-[9px] text-text-soft">Keep chatting on the left to change the concept or publishing copy.</p></div><span className="rounded-full border border-brand-green/25 bg-brand-green/10 px-2.5 py-1 text-[9px] font-semibold text-brand-green">5 credits used · GPT-Image-2</span></div>
              <div className="overflow-hidden rounded-3xl border border-border-soft bg-black/25 shadow-[0_30px_80px_rgba(0,0,0,.35)]"><img alt={brief?.altText || 'Generated social post'} className="mx-auto max-h-[590px] w-full object-contain" src={asset.url} /></div>
              <div className="mt-4 grid gap-3 xl:grid-cols-[1.35fr_.65fr]">
                <div className="rounded-2xl border border-border-soft bg-bg/35 p-4"><div className="flex items-center justify-between gap-3"><span className="text-[9px] font-bold uppercase tracking-[.13em] text-text-soft">Caption</span><span className="text-[8px] text-text-soft">Editable through chat</span></div><p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-text-main">{caption || 'No caption generated yet.'}</p></div>
                <div className="space-y-3"><div className="rounded-2xl border border-border-soft bg-bg/35 p-4"><span className="text-[9px] font-bold uppercase tracking-[.13em] text-text-soft">Hashtags</span><p className="mt-2 text-[10px] leading-5 text-text-muted">{hashtags.length ? hashtags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ') : 'No hashtags suggested.'}</p></div>{brief?.cta && <div className="rounded-2xl border border-brand-cyan/15 bg-brand-cyan/[.035] p-4"><span className="text-[9px] font-bold uppercase tracking-[.13em] text-brand-cyan">CTA</span><p className="mt-2 text-[11px] font-semibold">{brief.cta}</p></div>}</div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><Button disabled={busy || insufficient} onClick={() => void generateImage()}><RefreshCw className="size-3.5" />New render · 5</Button><Button onClick={() => inputRef.current?.focus()}><MessageSquareText className="size-3.5" />Refine in chat</Button><Button onClick={() => void saveDraft()}><Save className="size-3.5" />Save draft</Button><Button onClick={continueToPosts} variant="primary">Continue to Posts <ArrowRight className="size-3.5" /></Button></div>
              <div className="mt-3 flex items-center justify-between gap-3 text-[8px] text-text-soft"><span>Provider: OpenAI direct · {asset.model || 'gpt-image-2'}</span><a className="inline-flex items-center gap-1 transition hover:text-brand-cyan" href={asset.url} rel="noopener" target="_blank">Open image <ExternalLink className="size-3" /></a></div>
            </div>}
          </div>
        </div>

        <footer className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-t border-border-soft bg-bg/45 px-4 py-3 sm:px-5"><span className="text-[8px] leading-4 text-text-soft">Studio conversation is included. Credits are used only when a final image render completes.</span><div className="flex items-center gap-2">{generating && <Button onClick={() => controllerRef.current?.abort()}><X className="size-3.5" />Cancel</Button>}<Button disabled={busy} onClick={onClose}>Close</Button>{!asset && <Button disabled={!ready || insufficient || busy} onClick={() => void generateImage()} variant="primary"><Sparkles className="size-3.5" />Generate · 5 credits</Button>}</div></footer>
      </section>
    </div>
  </div>, document.body)
}
