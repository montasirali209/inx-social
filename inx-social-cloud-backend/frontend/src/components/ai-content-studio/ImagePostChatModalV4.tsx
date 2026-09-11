import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowRight, Bot, Check, Clock3, FileImage, Globe2, LoaderCircle, MessageSquareText, Paperclip, Save, Send, Sparkles, WandSparkles, X } from 'lucide-react'
import type { AIDraft, AIContentType, AIPlanAccess, GeneratedAsset } from '../../types/ai-content-studio'
import { uploadMediaAsset } from '../../lib/media-library-api'
import { saveAIDraft } from '../../lib/ai-content-studio-api'
import {
  generateConversationalImagePost,
  sendPostStudioMessage,
  sourceAnalysisMemoryMessage,
  type PostStudioAssistantResponse,
  type PostStudioBrief,
  type PostStudioMessage,
  type PostStudioSourceAnalysis,
} from '../../lib/ai-post-studio-api'
import {
  clearPostStudioRecovery,
  readPostStudioRecovery,
  writePostStudioRecovery,
  type PostStudioRecovery,
  type RecoveryReference,
} from '../../lib/ai-post-studio-recovery'
import { Button } from '../ui/Button'
import { StudioSelect } from './StudioSelect'

const INITIAL_ASSISTANT = 'Tell me what you want to post about. Add a website, product screenshot, logo or reference when useful. I’ll analyse the sources first and ask only for context I genuinely need.'
const ASPECTS: PostStudioBrief['aspectRatio'][] = ['4:5', '1:1', '9:16', '16:9']
const PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'YouTube']

function initialMessagesFor(draft?: AIDraft | null): PostStudioMessage[] {
  const seed: PostStudioMessage[] = [{ role: 'assistant', content: INITIAL_ASSISTANT }]
  if (draft?.prompt) seed.push({ role: 'user', content: draft.prompt })
  return seed
}

function firstPrompt(messages: PostStudioMessage[], brief: PostStudioBrief | null) {
  return messages.find((message) => message.role === 'user')?.content || brief?.objective || 'Create a social media post'
}

function extractUrls(text: string) {
  const values = text.match(/https?:\/\/[^\s<>()]+/gi) || []
  return [...new Set(values.map((value) => value.replace(/[.,;!?]+$/, '')))].slice(0, 2)
}

function renderKey(brief: PostStudioBrief | null, platform: string, ratio: PostStudioBrief['aspectRatio'], analysis: PostStudioSourceAnalysis | null) {
  if (!brief) return ''
  return JSON.stringify({
    objective: brief.objective,
    audience: brief.audience,
    platform,
    ratio,
    tone: brief.tone,
    visualStyle: brief.visualStyle,
    headline: brief.headline,
    supportingCopy: brief.supportingCopy,
    cta: brief.cta,
    visualDirection: brief.visualDirection,
    analysis: analysis?.fingerprint || '',
  })
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

function Pill({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <span className="inline-flex min-h-8 items-center gap-2 rounded-xl border border-border-soft bg-bg/35 px-2.5 text-[9px] font-medium text-text-muted">{icon}{children}</span>
}

function Bubble({ message }: { message: PostStudioMessage }) {
  const assistant = message.role === 'assistant'
  return <div className={`flex gap-2.5 ${assistant ? 'justify-start' : 'justify-end'}`}>
    {assistant && <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><Bot className="size-3.5" /></span>}
    <div className={`max-w-[88%] rounded-2xl border px-3.5 py-3 text-[11px] leading-5 shadow-[0_10px_30px_rgba(0,0,0,.16)] ${assistant ? 'border-border-soft bg-white/[.035] text-text-main' : 'border-brand-teal/30 bg-brand-teal/12 text-white'}`}>
      <p className="whitespace-pre-wrap">{message.content}</p>
    </div>
  </div>
}

function SourceCard({ analysis }: { analysis: PostStudioSourceAnalysis }) {
  return <div className="ml-9 rounded-[20px] border border-brand-cyan/20 bg-[linear-gradient(145deg,rgba(5,31,45,.82),rgba(4,20,31,.88))] p-4">
    <div className="flex items-start justify-between gap-3">
      <div><span className="text-[8px] font-bold uppercase tracking-[.16em] text-brand-cyan">Source analysis complete</span><h4 className="mt-1 text-sm font-semibold">{analysis.productName || 'Product and brand context understood'}</h4></div>
      <span className="rounded-full border border-brand-green/20 bg-brand-green/[.07] px-2 py-1 text-[8px] font-bold text-brand-green">Verified context</span>
    </div>
    {analysis.summary && <p className="mt-2 text-[10px] leading-5 text-text-muted">{analysis.summary}</p>}
    <div className="mt-3 grid gap-3 xl:grid-cols-3">
      {analysis.verifiedClaims.length > 0 && <div><span className="text-[8px] font-bold uppercase tracking-[.12em] text-text-soft">Verified</span><ul className="mt-1.5 space-y-1 text-[9px] leading-4 text-text-muted">{analysis.verifiedClaims.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}</ul></div>}
      {(analysis.assetObservations.length || analysis.visualIdentity.length) > 0 && <div><span className="text-[8px] font-bold uppercase tracking-[.12em] text-text-soft">Visual cues</span><ul className="mt-1.5 space-y-1 text-[9px] leading-4 text-text-muted">{(analysis.assetObservations.length ? analysis.assetObservations : analysis.visualIdentity).slice(0, 2).map((item) => <li key={item}>• {item}</li>)}</ul></div>}
      {analysis.strongestAngles.length > 0 && <div><span className="text-[8px] font-bold uppercase tracking-[.12em] text-text-soft">Strong angles</span><ul className="mt-1.5 space-y-1 text-[9px] leading-4 text-text-muted">{analysis.strongestAngles.slice(0, 2).map((item) => <li key={item}>• {item}</li>)}</ul></div>}
    </div>
  </div>
}

function RecoveryChoice({ recovery, onResume, onFresh }: { recovery: PostStudioRecovery; onResume: () => void; onFresh: () => void }) {
  const userTurns = recovery.messages.filter((message) => message.role === 'user')
  return <div className="absolute inset-0 z-40 grid place-items-center bg-[#01070d]/88 p-5 backdrop-blur-md">
    <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-brand-cyan/30 bg-[linear-gradient(145deg,#071d2a,#04111c)] shadow-[0_36px_120px_rgba(0,0,0,.72)]">
      <div className="p-6 sm:p-7">
        <span className="grid size-12 place-items-center rounded-2xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><Clock3 className="size-5" /></span>
        <span className="mt-5 block text-[9px] font-bold uppercase tracking-[.17em] text-brand-cyan">Unfinished work found</span>
        <h3 className="mt-1 text-xl font-bold">Continue your previous AI post?</h3>
        <p className="mt-2 text-xs leading-5 text-text-muted">Your last Image Post session was saved automatically before the workspace session ended. Resume exactly where you left off, or start a clean post.</p>
        {userTurns[0]?.content && <div className="mt-4 rounded-2xl border border-border-soft bg-black/15 p-3"><span className="text-[8px] font-bold uppercase tracking-[.13em] text-text-soft">Previous idea</span><p className="mt-1.5 line-clamp-3 text-[10px] leading-5 text-text-main">{userTurns[0].content}</p><p className="mt-2 text-[8px] text-text-soft">Saved {new Date(recovery.updatedAt).toLocaleString()}</p></div>}
      </div>
      <div className="grid gap-2 border-t border-border-soft bg-black/10 p-4 sm:grid-cols-2"><Button className="min-h-11" onClick={onFresh}>Start new session</Button><Button className="min-h-11" onClick={onResume} variant="primary"><ArrowRight className="size-4" />Resume previous work</Button></div>
    </div>
  </div>
}

export function ImagePostChatModal({ open, type, access, initialDraft, onClose, onSaved, onContinue, onToast }: {
  open: boolean
  type: AIContentType | null
  access: AIPlanAccess
  initialDraft?: AIDraft | null
  onClose: () => void
  onSaved: (draft: AIDraft) => void
  onContinue: (draft: AIDraft) => void
  onToast: (message: string) => void
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const [messages, setMessages] = useState<PostStudioMessage[]>(() => initialMessagesFor(initialDraft))
  const [composer, setComposer] = useState('')
  const [references, setReferences] = useState<RecoveryReference[]>([])
  const [urls, setUrls] = useState<string[]>(() => extractUrls(initialDraft?.prompt || ''))
  const [assistantResult, setAssistantResult] = useState<PostStudioAssistantResponse | null>(null)
  const [sourceAnalysis, setSourceAnalysis] = useState<PostStudioSourceAnalysis | null>(null)
  const [brief, setBrief] = useState<PostStudioBrief | null>(null)
  const [asset, setAsset] = useState<GeneratedAsset | null>(() => initialDraft?.asset?.type === 'image' ? initialDraft.asset : null)
  const [platform, setPlatform] = useState('Instagram')
  const [aspectRatio, setAspectRatio] = useState<PostStudioBrief['aspectRatio']>('4:5')
  const [lastRenderedKey, setLastRenderedKey] = useState('')
  const [thinking, setThinking] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [recoveryCandidate, setRecoveryCandidate] = useState<PostStudioRecovery | null>(null)
  const [recoveryResolved, setRecoveryResolved] = useState(Boolean(initialDraft))

  useEffect(() => {
    if (!open || type !== 'image_post') return
    if (initialDraft) { setRecoveryResolved(true); return }
    const saved = readPostStudioRecovery()
    setRecoveryCandidate(saved)
    setRecoveryResolved(!saved)
  }, [open, type, initialDraft])

  useEffect(() => {
    if (!open) return
    const prior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prior }
  }, [open])

  useEffect(() => {
    if (!open || !recoveryResolved || initialDraft || !messages.some((message) => message.role === 'user')) return
    const timer = window.setTimeout(() => writePostStudioRecovery({ messages, urls, references, assistantResult, sourceAnalysis, brief, asset, platform, aspectRatio, lastRenderedKey }), 350)
    return () => window.clearTimeout(timer)
  }, [open, recoveryResolved, initialDraft, messages, urls, references, assistantResult, sourceAnalysis, brief, asset, platform, aspectRatio, lastRenderedKey])

  const ready = Boolean(assistantResult?.readyToGenerate && brief?.visualDirection)
  const currentRenderKey = useMemo(() => renderKey(brief, platform, aspectRatio, sourceAnalysis), [brief, platform, aspectRatio, sourceAnalysis])
  const renderNeeded = Boolean(ready && currentRenderKey && (!asset || currentRenderKey !== lastRenderedKey))
  const insufficient = access.creditsConfigured && !access.unlimitedCredits && access.creditsRemaining !== null && access.creditsRemaining < 5
  const busy = thinking || generating || uploading
  const caption = brief?.caption || asset?.caption || ''
  const hashtags = brief?.hashtags || asset?.hashtags || []
  const sources = useMemo(() => [
    ...urls.map((url) => ({ id: url, label: (() => { try { return new URL(url).hostname } catch { return url } })(), icon: <Globe2 className="size-3" /> })),
    ...references.map((item) => ({ id: item.id, label: item.fileName, icon: <FileImage className="size-3" /> })),
  ], [urls, references])
  const platformOptions = PLATFORMS.map((value) => ({
    value,
    label: value,
    meta: value === 'LinkedIn' ? 'Professional feed' : value === 'YouTube' ? 'Community visual' : value === 'TikTok' ? 'Visual post' : 'Social feed post',
    icon: <Sparkles className="size-3.5" />,
  }))
  const aspectOptions = ASPECTS.map((value) => ({
    value,
    label: value,
    meta: value === '4:5' ? 'Portrait feed · recommended' : value === '1:1' ? 'Square feed' : value === '9:16' ? 'Vertical story / reel' : 'Landscape creative',
    icon: <FileImage className="size-3.5" />,
  }))

  function resumeRecovery() {
    const saved = recoveryCandidate
    if (!saved) return
    setMessages(saved.messages); setUrls(saved.urls); setReferences(saved.references || []); setAssistantResult(saved.assistantResult); setSourceAnalysis(saved.sourceAnalysis); setBrief(saved.brief); setAsset(saved.asset); setPlatform(saved.platform || 'Instagram'); setAspectRatio(saved.aspectRatio || '4:5'); setLastRenderedKey(saved.lastRenderedKey || '')
    setRecoveryCandidate(null); setRecoveryResolved(true); onToast('Previous AI Post Studio session restored.')
    window.setTimeout(() => inputRef.current?.focus(), 80)
  }

  function startFresh() {
    clearPostStudioRecovery(); setMessages(initialMessagesFor(null)); setUrls([]); setReferences([]); setAssistantResult(null); setSourceAnalysis(null); setBrief(null); setAsset(null); setPlatform('Instagram'); setAspectRatio('4:5'); setLastRenderedKey(''); setRecoveryCandidate(null); setRecoveryResolved(true); setComposer(''); setError('')
    window.setTimeout(() => inputRef.current?.focus(), 80)
  }

  async function askAssistant(nextMessages: PostStudioMessage[], nextUrls = urls, nextReferences = references) {
    setThinking(true); setError('')
    try {
      const visible = nextMessages.filter((message, index) => index > 0 || message.role === 'user')
      const memory = sourceAnalysisMemoryMessage(sourceAnalysis)
      const result = await sendPostStudioMessage({ messages: memory ? [memory, ...visible.slice(-17)] : visible.slice(-18), urls: nextUrls, referenceAssetIds: nextReferences.map((item) => item.id), platform, aspectRatio })
      setAssistantResult(result); setSourceAnalysis(result.sourceAnalysis || sourceAnalysis); setBrief(result.brief); setPlatform(result.brief.platform || platform); setAspectRatio(result.brief.aspectRatio || aspectRatio); setMessages((current) => [...current, { role: 'assistant', content: result.reply }])
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The AI Post Studio could not respond.') } finally { setThinking(false) }
  }

  async function sendText(value = composer) {
    const text = value.trim(); if (!text || busy) return
    const nextUrls = [...new Set([...urls, ...extractUrls(text)])].slice(0, 2); setUrls(nextUrls); setComposer('')
    const nextMessages = [...messages, { role: 'user' as const, content: text }]; setMessages(nextMessages)
    await askAssistant(nextMessages, nextUrls, references)
  }

  async function uploadReference(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
    if (!file.type.startsWith('image/')) { setError('For Image Post references, upload a PNG, JPEG, WebP or GIF image.'); return }
    setUploading(true); setUploadProgress(0); setError('')
    try {
      const stored = await uploadMediaAsset(file, null, setUploadProgress)
      const nextReferences = [{ id: stored.id, fileName: stored.fileName }, ...references.filter((item) => item.id !== stored.id)].slice(0, 4); setReferences(nextReferences)
      const nextMessages = [...messages, { role: 'user' as const, content: `I uploaded “${stored.fileName}” as a reference. Analyse the visible brand/product details and use it where it improves this post.` }]; setMessages(nextMessages)
      await askAssistant(nextMessages, urls, nextReferences)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The reference image could not be uploaded.') } finally { setUploading(false); setUploadProgress(0) }
  }

  async function generateImage() {
    if (!brief || !renderNeeded || insufficient || generating) return
    setGenerating(true); setError(''); const controller = new AbortController(); controllerRef.current = controller
    try {
      const key = currentRenderKey
      const generated = await generateConversationalImagePost({ prompt: firstPrompt(messages, brief), platform, aspectRatio, referenceAssetIds: references.map((item) => item.id), brief: { ...brief, platform, aspectRatio } }, controller.signal)
      setAsset(generated); setLastRenderedKey(key); onToast('Post creative generated successfully.')
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === 'AbortError')) setError(caught instanceof Error ? caught.message : 'The post image could not be generated.')
    } finally { controllerRef.current = null; setGenerating(false) }
  }

  async function saveDraft() {
    if (!asset) return
    try { const saved = await saveAIDraft(buildDraft(asset, messages, brief, initialDraft)); clearPostStudioRecovery(); onSaved(saved); onToast('AI post draft saved.') } catch (caught) { setError(caught instanceof Error ? caught.message : 'The draft could not be saved.') }
  }

  function continueToPosts() { if (!asset) return; clearPostStudioRecovery(); onContinue(buildDraft(asset, messages, brief, initialDraft)) }
  function handleKey(event: KeyboardEvent<HTMLTextAreaElement>) { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendText() } }

  if (!open || type !== 'image_post') return null

  return createPortal(<div className="fixed inset-0 z-[110] bg-[#01070d]/90 backdrop-blur-md"><div className="flex h-dvh items-end justify-center p-0 sm:items-center sm:p-4"><section aria-modal="true" className="relative flex h-[100dvh] w-full max-w-[1560px] flex-col overflow-hidden border border-brand-cyan/25 bg-[linear-gradient(145deg,rgba(5,22,34,.995),rgba(2,12,22,.995))] shadow-[0_40px_160px_rgba(0,0,0,.78)] sm:h-[min(94dvh,960px)] sm:rounded-[28px]" role="dialog">
    {recoveryCandidate && !recoveryResolved && <RecoveryChoice onFresh={startFresh} onResume={resumeRecovery} recovery={recoveryCandidate} />}
    <header className="flex shrink-0 items-center justify-between border-b border-border-soft bg-bg/25 px-5 py-3.5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl border border-brand-teal/30 bg-brand-teal/10 text-brand-cyan"><MessageSquareText className="size-4" /></span><div><span className="text-[8px] font-bold uppercase tracking-[.18em] text-brand-cyan">Conversational creator</span><h2 className="text-base font-semibold">AI Post Studio <span className="font-normal text-text-soft">· Image Post</span></h2></div></div><div className="flex items-center gap-2"><span className="hidden rounded-full border border-brand-amber/20 bg-brand-amber/8 px-2.5 py-1 text-[9px] font-semibold text-brand-amber sm:inline-flex">⚡ 5 credits per final render</span><button aria-label="Close AI Post Studio" className="grid size-9 place-items-center rounded-xl border border-border-soft text-text-muted hover:text-white" disabled={busy} onClick={onClose} type="button"><X className="size-4" /></button></div></header>
    <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
      <div className="flex min-h-0 flex-col border-r border-border-soft">
        <div className="shrink-0 px-5 pb-3 pt-4"><h3 className="text-sm font-semibold">Build the post with AI</h3><p className="mt-1 text-[9px] text-text-soft">Share the idea. Add sources when useful. Unfinished work is saved automatically for recovery.</p></div>
        {sources.length > 0 && <div className="flex flex-wrap gap-1.5 px-5 pb-3">{sources.map((source) => <Pill icon={source.icon} key={source.id}>{source.label}</Pill>)}</div>}
        <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-2">
          {messages.map((message, index) => <Bubble key={`${message.role}-${index}-${message.content.slice(0, 16)}`} message={message} />)}
          {thinking && <div className="flex items-center gap-2.5"><span className="grid size-7 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><Bot className="size-3.5" /></span><div className="rounded-2xl border border-border-soft bg-white/[.035] px-3.5 py-3 text-[10px] text-text-muted"><LoaderCircle className="mr-2 inline size-3 animate-spin text-brand-cyan" />{sources.length ? 'Analysing sources and creative direction…' : 'Thinking about your post…'}</div></div>}
          {sourceAnalysis && !thinking && <SourceCard analysis={sourceAnalysis} />}
          {assistantResult?.quickReplies?.length && !renderNeeded && !asset ? <div className="flex flex-wrap gap-1.5 pl-9">{assistantResult.quickReplies.map((reply) => <button className="rounded-full border border-brand-cyan/20 bg-brand-cyan/[.05] px-3 py-1.5 text-[9px] font-semibold text-brand-cyan" disabled={busy} key={reply} onClick={() => void sendText(reply)} type="button">{reply}</button>)}</div> : null}
          {renderNeeded && brief && !thinking && <div className="ml-9 overflow-hidden rounded-[24px] border border-brand-cyan/35 bg-[linear-gradient(145deg,rgba(8,45,56,.94),rgba(4,24,37,.97))]"><div className="p-5"><span className="text-[9px] font-bold uppercase tracking-[.16em] text-brand-green">{asset ? 'Refinement complete' : 'Creative brief complete'}</span><h3 className="mt-1 text-xl font-bold">{asset ? 'Your updated post is ready' : 'Ready to generate your post'}</h3><p className="mt-1.5 text-[10px] leading-5 text-text-muted">{asset ? 'Your latest chat changes are applied. Generate the revised visual when ready.' : 'The concept, copy and visual direction are ready.'}</p><div className="mt-3 flex flex-wrap gap-2"><Pill icon={<MessageSquareText className="size-3" />}>{platform}</Pill><Pill icon={<Sparkles className="size-3" />}>{aspectRatio}</Pill></div></div><div className="grid gap-2 border-t border-brand-cyan/15 p-3 sm:grid-cols-[1fr_auto_auto]"><Button disabled={busy || insufficient} onClick={() => void generateImage()} variant="primary"><WandSparkles className="size-4" />{asset ? 'Generate updated post · 5 credits' : 'Generate post now · 5 credits'}</Button><Button disabled={busy} onClick={() => inputRef.current?.focus()}>Refine again</Button><Button disabled={busy} onClick={() => fileRef.current?.click()}>Add reference</Button></div></div>}
        </div>
        <div className="shrink-0 border-t border-border-soft bg-bg/35 p-4">
          {error && <div className="mb-2 rounded-xl border border-brand-red/25 bg-brand-red/[.05] px-3 py-2 text-[9px] text-brand-red">{error}</div>}
          {uploading && <div className="mb-2 text-[9px] text-text-muted">Uploading reference · {uploadProgress}%</div>}
          <div className="rounded-2xl border border-border-strong bg-[#04111c]/85 p-2"><textarea aria-label="Message AI Post Studio" className="min-h-20 w-full resize-none bg-transparent px-2 py-1.5 text-xs text-text-main outline-none" disabled={busy} maxLength={4000} onChange={(event) => setComposer(event.target.value)} onKeyDown={handleKey} placeholder="Describe the post, paste a product URL, or tell the Studio what to change…" ref={inputRef} value={composer} /><div className="flex items-center justify-between border-t border-border-soft pt-2"><div className="flex items-center gap-1"><input accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(event) => void uploadReference(event)} ref={fileRef} type="file" /><button className="grid size-8 place-items-center rounded-lg text-text-muted hover:text-brand-cyan" disabled={busy || references.length >= 4} onClick={() => fileRef.current?.click()} type="button"><Paperclip className="size-3.5" /></button><button className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-[9px] text-text-muted hover:text-brand-cyan" disabled={busy || urls.length >= 2} onClick={() => { setComposer((value) => value || 'https://'); inputRef.current?.focus() }} type="button"><Globe2 className="size-3.5" />Add URL</button></div><button className="grid size-9 place-items-center rounded-xl bg-brand-teal text-[#02130f] disabled:opacity-40" disabled={busy || !composer.trim()} onClick={() => void sendText()} type="button"><Send className="size-4" /></button></div></div>
          <div className="mt-2 overflow-hidden rounded-2xl border border-border-soft bg-black/10">
            <div className="flex items-center justify-between gap-4 px-3 py-2.5"><div><span className="block text-[9px] font-semibold text-text-muted">Open controls</span><span className="mt-0.5 block text-[8px] text-text-soft">Choose the social platform and image ratio for this post.</span></div><span className="rounded-full border border-brand-cyan/15 bg-brand-cyan/[.04] px-2 py-1 text-[7px] font-semibold uppercase tracking-[.1em] text-brand-cyan">Manual control</span></div>
            <div className="grid gap-3 border-t border-border-soft p-3 sm:grid-cols-2"><StudioSelect label="Social platform" value={platform} options={platformOptions} onChange={setPlatform} accent="green"/><StudioSelect label="Image ratio" value={aspectRatio} options={aspectOptions} onChange={setAspectRatio} accent="violet"/></div>
          </div>
        </div>
      </div>
      <div className="scrollbar-thin min-h-0 overflow-y-auto bg-black/[.07] p-5">
        {!asset ? <div className={`grid min-h-[520px] h-full place-items-center rounded-[28px] border p-7 text-center ${renderNeeded ? 'border-brand-green/25' : 'border-dashed border-brand-cyan/18'}`}><div className="max-w-lg"><span className="mx-auto grid size-16 place-items-center rounded-[22px] border border-brand-cyan/25 bg-brand-cyan/[.07] text-brand-cyan">{generating ? <LoaderCircle className="size-7 animate-spin" /> : renderNeeded ? <Check className="size-7 text-brand-green" /> : <Sparkles className="size-7" />}</span><h3 className="mt-5 text-lg font-semibold">{generating ? 'Creating your final post…' : renderNeeded ? 'Your post is ready to generate.' : 'Your post comes together here.'}</h3><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-text-muted">{generating ? 'Applying your approved creative direction and references.' : renderNeeded ? 'Use the large Generate action in the chat to create the final visual.' : 'Chat naturally on the left. The Studio analyses URLs and references before preparing the final post.'}</p></div></div> : <div><div className="mb-4"><span className="text-[9px] font-bold uppercase tracking-[.15em] text-brand-green">✓ Generated</span><h3 className="mt-1 text-sm font-semibold">Review & refine your post</h3><p className="mt-1 text-[9px] text-text-soft">Keep chatting on the left. If you change the creative direction, a new Generate updated post button appears in chat.</p></div><div className="overflow-hidden rounded-3xl border border-border-soft bg-black/25"><img alt={brief?.altText || 'Generated social post'} className="mx-auto max-h-[590px] w-full object-contain" src={asset.url} /></div><div className="mt-4 grid gap-3 xl:grid-cols-[1.35fr_.65fr]"><div className="rounded-2xl border border-border-soft bg-bg/35 p-4"><span className="text-[9px] font-bold uppercase tracking-[.13em] text-text-soft">Caption</span><p className="mt-2 whitespace-pre-wrap text-[11px] leading-5">{caption || 'No caption generated yet.'}</p></div><div className="space-y-3"><div className="rounded-2xl border border-border-soft bg-bg/35 p-4"><span className="text-[9px] font-bold uppercase tracking-[.13em] text-text-soft">Hashtags</span><p className="mt-2 text-[10px] leading-5 text-text-muted">{hashtags.length ? hashtags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ') : 'No hashtags suggested.'}</p></div>{brief?.cta && <div className="rounded-2xl border border-brand-cyan/15 bg-brand-cyan/[.035] p-4"><span className="text-[9px] font-bold uppercase tracking-[.13em] text-brand-cyan">CTA</span><p className="mt-2 text-[11px] font-semibold">{brief.cta}</p></div>}</div></div><div className="mt-4 grid gap-2 sm:grid-cols-3"><Button onClick={() => inputRef.current?.focus()}><MessageSquareText className="size-3.5" />Refine in chat</Button><Button onClick={() => void saveDraft()}><Save className="size-3.5" />Save draft</Button><Button onClick={continueToPosts} variant="primary">Continue to Posts <ArrowRight className="size-3.5" /></Button></div></div>}
      </div>
    </div>
    <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border-soft bg-bg/45 px-5 py-3"><span className="text-[8px] text-text-soft">Unfinished Image Post work is saved for 7 days on this browser. Credits are used only when a final render completes.</span><div className="flex items-center gap-2">{generating && <Button onClick={() => controllerRef.current?.abort()}><X className="size-3.5" />Cancel</Button>}<Button disabled={busy} onClick={onClose}>Close</Button></div></footer>
  </section></div></div>, document.body)
}
