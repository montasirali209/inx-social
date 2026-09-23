import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import {
  CalendarRange,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Layers3,
  LoaderCircle,
  Megaphone,
  PencilLine,
  RefreshCcw,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react'
import {
  createAIPostCampaign,
  deleteAIPostCampaign,
  generateAIPostCampaignImage,
  getAIPostCampaigns,
  regenerateAIPostCampaignPost,
  updateAIPostCampaignPost,
} from '../../lib/ai-content-studio-api'
import type {
  AIPostCampaign,
  AIPostCampaignPost,
  CreateAIPostCampaignInput,
} from '../../types/ai-content-studio'
import { Button } from '../ui/Button'
import { SocialPlatformIcon, type SocialPlatformName } from '../ui/SocialPlatformIcon'

const PLATFORM_OPTIONS: Array<{ key: SocialPlatformName; value: string; label: string }> = [
  { key: 'facebook', value: 'Facebook', label: 'Facebook' },
  { key: 'instagram', value: 'Instagram', label: 'Instagram' },
  { key: 'linkedin', value: 'LinkedIn', label: 'LinkedIn' },
  { key: 'x', value: 'X', label: 'X' },
  { key: 'threads', value: 'Threads', label: 'Threads' },
  { key: 'bluesky', value: 'Bluesky', label: 'Bluesky' },
  { key: 'pinterest', value: 'Pinterest', label: 'Pinterest' },
  { key: 'tiktok', value: 'TikTok', label: 'TikTok' },
  { key: 'youtube', value: 'YouTube', label: 'YouTube' },
]
const POST_COUNTS = [10, 15, 20, 30]

function normaliseWebsite(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function formatLabel(mode: AIPostCampaign['contentMode']) {
  if (mode === 'IMAGE') return 'Image only'
  if (mode === 'MIXED') return 'Mixed'
  return 'Text only'
}

function publishCaption(post: AIPostCampaignPost) {
  const tags = post.hashtags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')
  return [post.caption.trim(), tags].filter(Boolean).join('\n\n')
}

type Props = {
  open: boolean
  onClose: () => void
  onHandoff: (campaign: AIPostCampaign) => void
  onToast: (message: string) => void
}

export function AiPostCampaignModal({ open, onClose, onHandoff, onToast }: Props) {
  const [selectedCampaign, setSelectedCampaign] = useState<AIPostCampaign | null>(null)
  const [recent, setRecent] = useState<AIPostCampaign[]>([])
  const [creating, setCreating] = useState(false)
  const [generationStep, setGenerationStep] = useState(0)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [busyPostId, setBusyPostId] = useState<string | null>(null)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set())
  const [editDraft, setEditDraft] = useState<Partial<AIPostCampaignPost>>({})
  const [imagePreview, setImagePreview] = useState<{ url: string; title: string; caption: string } | null>(null)
  const reviewRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState<CreateAIPostCampaignInput>({
    businessUrl: '',
    goal: '',
    audience: '',
    contentMode: 'TEXT',
    platforms: ['Facebook', 'Instagram'],
    postCount: 10,
    imagePostCount: 5,
  })

  useEffect(() => {
    if (!open) return
    void getAIPostCampaigns(10)
      .then(setRecent)
      .catch(() => setRecent([]))
  }, [open])

  useEffect(() => {
    if (!creating) return
    const timer = window.setInterval(() => {
      setGenerationStep((current) => Math.min(2, current + 1))
    }, 4200)
    return () => window.clearInterval(timer)
  }, [creating])

  const imageCount = form.contentMode === 'TEXT'
    ? 0
    : form.contentMode === 'IMAGE'
      ? form.postCount
      : Math.max(1, Math.min(form.postCount - 1, Number(form.imagePostCount || Math.round(form.postCount / 2))))
  const textCount = form.postCount - imageCount
  const canCreate = form.goal.trim().length >= 8 && form.platforms.length > 0 && !creating

  const campaignImagePosts = selectedCampaign?.posts.filter((post) => post.contentType === 'IMAGE') || []
  const campaignTextPosts = selectedCampaign?.posts.filter((post) => post.contentType === 'TEXT') || []
  const imagesReady = campaignImagePosts.filter((post) => Boolean(post.mediaAssetId)).length
  const allRequiredImagesReady = campaignImagePosts.length === imagesReady

  function togglePlatform(platform: string) {
    setForm((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform],
    }))
  }

  function chooseMode(contentMode: 'TEXT' | 'IMAGE' | 'MIXED') {
    setForm((current) => ({
      ...current,
      contentMode,
      imagePostCount: contentMode === 'TEXT'
        ? 0
        : contentMode === 'IMAGE'
          ? current.postCount
          : Math.max(1, Math.min(current.postCount - 1, current.imagePostCount || Math.round(current.postCount / 2))),
    }))
  }

  function choosePostCount(postCount: number) {
    setForm((current) => ({
      ...current,
      postCount,
      imagePostCount: current.contentMode === 'TEXT'
        ? 0
        : current.contentMode === 'IMAGE'
          ? postCount
          : Math.max(1, Math.min(postCount - 1, current.imagePostCount || Math.round(postCount / 2))),
    }))
  }

  function openCampaign(campaign: AIPostCampaign) {
    setSelectedCampaign(campaign)
    setEditingPostId(null)
    setEditDraft({})
    window.requestAnimationFrame(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  async function createCampaign() {
    if (!canCreate) return
    setCreating(true)
    setGenerationStep(0)
    setInlineError(null)
    try {
      const website = normaliseWebsite(form.businessUrl || '')
      const created = await createAIPostCampaign({
        businessUrl: website || undefined,
        goal: form.goal.trim(),
        contentMode: form.contentMode,
        platforms: form.platforms,
        postCount: form.postCount,
        imagePostCount: imageCount,
      })
      setForm((current) => ({ ...current, businessUrl: website }))
      setRecent((current) => [created, ...current.filter((item) => item.id !== created.id)].slice(0, 10))
      setSelectedCampaign(created)
      onToast(`${created.postCount}-post AI campaign created and ready for review.`)
      window.requestAnimationFrame(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The AI campaign could not be created.'
      setInlineError(message)
      onToast(message)
    } finally {
      setCreating(false)
    }
  }

  function beginEdit(post: AIPostCampaignPost) {
    setEditingPostId(post.id)
    setEditDraft({
      title: post.title,
      pillar: post.pillar,
      hook: post.hook,
      caption: post.caption,
      cta: post.cta,
      hashtags: [...post.hashtags],
      imageBrief: post.imageBrief,
    })
  }

  async function saveEdit(post: AIPostCampaignPost) {
    if (!selectedCampaign) return
    setBusyPostId(post.id)
    try {
      const updated = await updateAIPostCampaignPost(selectedCampaign.id, post.id, {
        title: String(editDraft.title || ''),
        pillar: String(editDraft.pillar || ''),
        hook: String(editDraft.hook || ''),
        caption: String(editDraft.caption || ''),
        cta: String(editDraft.cta || ''),
        hashtags: Array.isArray(editDraft.hashtags) ? editDraft.hashtags : [],
        imageBrief: String(editDraft.imageBrief || ''),
      })
      setSelectedCampaign(updated)
      setRecent((current) => current.map((item) => item.id === updated.id ? updated : item))
      setEditingPostId(null)
      setEditDraft({})
      onToast('Campaign post updated.')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'The post could not be updated.')
    } finally {
      setBusyPostId(null)
    }
  }

  async function regenerate(post: AIPostCampaignPost) {
    if (!selectedCampaign) return
    setBusyPostId(post.id)
    try {
      const updated = await regenerateAIPostCampaignPost(selectedCampaign.id, post.id)
      setSelectedCampaign(updated)
      setRecent((current) => current.map((item) => item.id === updated.id ? updated : item))
      onToast(`Post ${post.sequence} regenerated using campaign rules.`)
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'The post could not be regenerated.')
    } finally {
      setBusyPostId(null)
    }
  }

  async function generateImage(post: AIPostCampaignPost) {
    if (!selectedCampaign || post.contentType !== 'IMAGE') return
    setBusyPostId(post.id)
    try {
      const updated = await generateAIPostCampaignImage(selectedCampaign.id, post.id)
      setSelectedCampaign(updated)
      setRecent((current) => current.map((item) => item.id === updated.id ? updated : item))
      onToast(`Image created for post ${post.sequence}. 5 AI credits used.`)
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'The campaign image could not be generated.')
    } finally {
      setBusyPostId(null)
    }
  }

  async function removeCampaign(item: AIPostCampaign) {
    if (!window.confirm(`Delete “${item.title}”? Generated Media Library images are not deleted.`)) return
    try {
      await deleteAIPostCampaign(item.id)
      setRecent((current) => current.filter((candidate) => candidate.id !== item.id))
      if (selectedCampaign?.id === item.id) setSelectedCampaign(null)
      onToast('AI campaign deleted.')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'The campaign could not be deleted.')
    }
  }

  function togglePost(postId: string) {
    setExpandedPosts((current) => {
      const next = new Set(current)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
  }

  if (!open) return null

  const generationMessages = [
    'Analysing your goal and business context…',
    'Building the campaign map, hooks and content mix…',
    'Writing concise platform-aware posts and quality-checking repetition…',
  ]

  return createPortal(
    <div className="ai-studio-modal-backdrop fixed inset-0 z-[120] grid place-items-center overflow-hidden bg-[#01070d]/92 p-0 backdrop-blur-xl sm:p-5">
      <section className="ai-studio-modal-enter relative h-dvh w-full max-w-[1540px] overflow-y-auto bg-bg sm:h-[min(94dvh,980px)] sm:rounded-[30px] sm:border sm:border-brand-cyan/20 sm:shadow-[0_40px_120px_rgba(0,0,0,.55)]">
        <div aria-hidden="true" className="ai-campaign-glow-drift pointer-events-none absolute -left-32 top-12 size-80 rounded-full bg-brand-cyan/[.08] blur-[90px]" />
        <div aria-hidden="true" className="ai-campaign-glow-drift pointer-events-none absolute right-0 top-64 size-72 rounded-full bg-brand-purple/[.07] blur-[100px] [animation-delay:-2.8s]" />

        <header className="relative flex items-start justify-between gap-3 border-b border-brand-cyan/15 bg-[radial-gradient(circle_at_0%_0%,rgba(45,212,191,.15),transparent_34%),linear-gradient(135deg,rgba(10,32,45,.98),rgba(5,18,29,.98))] p-4 sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="ai-campaign-soft-float grid size-11 shrink-0 place-items-center rounded-2xl border border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan shadow-[0_10px_28px_rgba(45,212,191,.12)]"><Megaphone className="size-5" /></span>
            <div className="min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-[.18em] text-brand-cyan">AI Post Campaign</span>
              <h2 className="mt-1 text-lg font-semibold sm:text-xl">Build a campaign. Let AI handle the marketing mechanics.</h2>
              <p className="mt-1 max-w-3xl text-[11px] leading-5 text-text-muted">Describe what you want to achieve, add your website and choose the content mix. INXSocial handles strategy, hooks, platform fit, brevity and campaign sequencing.</p>
            </div>
          </div>
          <button aria-label="Close AI Post Campaign" className="grid size-9 shrink-0 place-items-center rounded-xl border border-border-soft text-text-muted transition hover:-translate-y-0.5 hover:border-brand-cyan/30 hover:text-white" onClick={onClose} type="button"><X className="size-4" /></button>
        </header>

        <div className="relative grid min-w-0 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0 p-4 sm:p-6 lg:p-7">
            <div className="mx-auto max-w-5xl space-y-5">
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-text-soft">What should this campaign achieve?</span>
                <textarea
                  className="mt-2 min-h-28 w-full rounded-[20px] border border-border-soft bg-black/15 px-4 py-3 text-sm leading-6 outline-none transition focus:border-brand-cyan/45 focus:shadow-[0_0_0_3px_rgba(45,212,191,.06)]"
                  maxLength={1600}
                  onChange={(event) => setForm((current) => ({ ...current, goal: event.target.value }))}
                  placeholder="Example: Introduce our product to creators, show how it solves daily social-media friction, keep every post hook-driven and gradually move people toward trying the product."
                  value={form.goal}
                />
              </label>

              <div className="ai-campaign-3d-card rounded-[22px] border border-border-soft bg-[linear-gradient(145deg,rgba(8,31,44,.78),rgba(4,17,28,.78))] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-text-soft">Social platforms</span>
                    <p className="mt-1 text-[11px] leading-5 text-text-muted">Choose where this campaign is intended to work. AI adapts hooks and length automatically.</p>
                  </div>
                  <span className="text-[10px] font-semibold text-brand-cyan">{form.platforms.length} selected</span>
                </div>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:overflow-visible">
                  {PLATFORM_OPTIONS.map((platform) => {
                    const active = form.platforms.includes(platform.value)
                    return <button
                      aria-label={`${active ? 'Remove' : 'Add'} ${platform.label}`}
                      className={`group relative grid size-12 shrink-0 place-items-center rounded-2xl border transition duration-300 hover:-translate-y-1 hover:scale-110 ${active ? 'border-brand-cyan/50 bg-brand-cyan/10 shadow-[0_12px_28px_rgba(45,212,191,.12)]' : 'border-border-soft bg-black/10 hover:border-white/25'}`}
                      key={platform.value}
                      onClick={() => togglePlatform(platform.value)}
                      title={platform.label}
                      type="button"
                    >
                      <SocialPlatformIcon className="!size-8 transition duration-300 group-hover:rotate-[4deg] group-hover:scale-110" platform={platform.key} />
                      {active && <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-brand-cyan text-[8px] text-[#001014]"><Check className="size-2.5" /></span>}
                    </button>
                  })}
                </div>
              </div>

              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-text-soft">Business / product website <span className="normal-case tracking-normal text-text-soft">(optional)</span></span>
                <input
                  className="mt-2 min-h-12 w-full rounded-2xl border border-border-soft bg-black/15 px-4 text-sm outline-none transition focus:border-brand-cyan/45"
                  onBlur={(event) => setForm((current) => ({ ...current, businessUrl: normaliseWebsite(event.target.value) }))}
                  onChange={(event) => setForm((current) => ({ ...current, businessUrl: event.target.value }))}
                  placeholder="yourbusiness.com"
                  type="text"
                  value={form.businessUrl || ''}
                />
              </label>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-text-soft">Campaign type</span>
                <div className="mt-2 grid gap-3 md:grid-cols-3">
                  {([
                    { mode: 'TEXT' as const, icon: FileText, title: 'Text Post Only', copy: 'Fast, concise posts built to work without a visual.' },
                    { mode: 'IMAGE' as const, icon: ImageIcon, title: 'Image Post Only', copy: 'Every post gets an image concept. Render visuals only after review.' },
                    { mode: 'MIXED' as const, icon: Layers3, title: 'Mix Text + Image', copy: 'Blend quick text posts with high-impact visual posts in one campaign.' },
                  ]).map((option) => {
                    const active = form.contentMode === option.mode
                    const Icon = option.icon
                    return <button
                      className={`ai-campaign-3d-card group relative overflow-hidden rounded-[22px] border p-4 text-left transition duration-300 hover:-translate-y-1 ${active ? 'border-brand-cyan/45 bg-[linear-gradient(145deg,rgba(45,212,191,.12),rgba(17,24,39,.6))] shadow-[0_18px_42px_rgba(0,0,0,.25)]' : 'border-border-soft bg-black/10 hover:border-white/20'}`}
                      key={option.mode}
                      onClick={() => chooseMode(option.mode)}
                      type="button"
                    >
                      <div aria-hidden="true" className={`absolute -right-8 -top-8 size-24 rounded-full blur-2xl transition ${active ? 'bg-brand-cyan/20' : 'bg-white/[.03]'}`} />
                      <span className={`ai-campaign-soft-float relative grid size-10 place-items-center rounded-2xl border ${active ? 'border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan' : 'border-border-soft text-text-muted'}`}><Icon className="size-4.5" /></span>
                      <strong className="relative mt-3 block text-sm">{option.title}</strong>
                      <small className="relative mt-1 block text-[10px] leading-5 text-text-muted">{option.copy}</small>
                      {active && <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-brand-cyan text-[#001014]"><Check className="size-3" /></span>}
                    </button>
                  })}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                <div className="ai-campaign-3d-card rounded-[22px] border border-border-soft bg-black/10 p-4">
                  <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-text-soft">Number of posts</span>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {POST_COUNTS.map((count) => <button className={`rounded-xl border px-2 py-3 text-xs font-semibold transition hover:-translate-y-0.5 ${form.postCount === count ? 'border-brand-cyan/45 bg-brand-cyan/10 text-brand-cyan' : 'border-border-soft text-text-muted hover:text-white'}`} key={count} onClick={() => choosePostCount(count)} type="button">{count}</button>)}
                  </div>
                </div>

                <div className="ai-campaign-3d-card rounded-[22px] border border-brand-cyan/15 bg-[radial-gradient(circle_at_90%_0%,rgba(45,212,191,.10),transparent_14rem),linear-gradient(145deg,rgba(10,30,43,.82),rgba(5,18,29,.82))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.025)]">
                  <div className="flex items-center justify-between gap-4">
                    <div><span className="text-[11px] font-bold uppercase tracking-[.1em] text-text-soft">Content mix</span><p className="mt-1.5 text-[11px] leading-5 text-text-muted">{form.contentMode === 'MIXED' ? 'Choose how much of the campaign should be visual.' : 'The split follows your selected campaign type.'}</p></div>
                    <div className="text-right"><strong className="block text-lg text-brand-cyan">{imageCount} image</strong><small className="text-[11px] font-medium text-text-muted">{textCount} text</small></div>
                  </div>
                  <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-black/30"><span className="bg-brand-cyan transition-all" style={{ width: `${(imageCount / form.postCount) * 100}%` }} /><span className="bg-white/15 transition-all" style={{ width: `${(textCount / form.postCount) * 100}%` }} /></div>
                  {form.contentMode === 'MIXED' && <div className="mt-4">
                    <input
                      aria-label="Number of image posts"
                      className="w-full accent-[rgb(45,212,191)]"
                      max={form.postCount - 1}
                      min={1}
                      onChange={(event) => setForm((current) => ({ ...current, imagePostCount: Number(event.target.value) }))}
                      type="range"
                      value={imageCount}
                    />
                    <div className="mt-2 flex justify-between text-[10px] font-medium text-text-soft"><span>More text</span><span>{imageCount} image + {textCount} text</span><span>More visual</span></div>
                  </div>}
                  {imageCount > 0 && <p className="mt-3 text-[10px] leading-5 text-text-soft">Images are <strong className="text-white/80">not generated automatically</strong>. Review first, then render only the images you want. Rendering all {imageCount} image posts would use up to <strong className="text-brand-cyan">{imageCount * 5} AI credits</strong>.</p>}
                </div>
              </div>

              {inlineError && <div className="rounded-2xl border border-brand-red/30 bg-brand-red/[.07] px-4 py-3 text-[11px] leading-5 text-brand-red">{inlineError}</div>}

              <div className="rounded-[22px] border border-brand-cyan/15 bg-[linear-gradient(120deg,rgba(45,212,191,.06),rgba(124,58,237,.035))] p-4">
                <div className="flex gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand-cyan/20 bg-brand-cyan/[.07] text-brand-cyan"><WandSparkles className="size-4" /></span>
                  <div><strong className="text-xs">AI handles the campaign mechanics</strong><p className="mt-1 text-[10px] leading-5 text-text-muted">Business understanding, platform fit, hook rotation, brevity, campaign sequencing, CTA variation, media selection and repetition control are applied automatically. You only define the outcome.</p></div>
                </div>
              </div>

              <Button className="min-h-13 w-full justify-center shadow-[0_14px_36px_rgba(45,212,191,.12)]" disabled={!canCreate} onClick={() => void createCampaign()} variant="primary">
                {creating ? <><LoaderCircle className="size-4 animate-spin" />{generationMessages[generationStep]}</> : <><Sparkles className="size-4" />Generate AI campaign</>}
              </Button>
            </div>
          </div>

          <aside className="min-w-0 border-t border-border-soft bg-black/[.08] p-4 sm:p-5 lg:border-l lg:border-t-0">
            <div className="sticky top-4">
              <div className="flex items-center justify-between"><div><span className="text-[9px] font-bold uppercase tracking-[.14em] text-text-soft">Saved campaigns</span><h3 className="mt-1 text-sm font-semibold">Recent work</h3></div><CalendarRange className="size-4 text-brand-cyan" /></div>
              <div className="mt-4 space-y-3">
                {recent.length ? recent.map((item, index) => {
                  const selected = selectedCampaign?.id === item.id
                  const firstVisual = item.posts.find((post) => post.mediaAsset?.thumbnailUrl || post.mediaAsset?.url)?.mediaAsset
                  const visualUrl = firstVisual?.thumbnailUrl || firstVisual?.url
                  return <article className={`ai-campaign-3d-card group relative overflow-hidden rounded-2xl border transition duration-300 hover:-translate-y-1 ${selected ? 'border-brand-cyan/40 bg-brand-cyan/[.06] shadow-[0_14px_36px_rgba(0,0,0,.2)]' : 'border-border-soft bg-bg/35 hover:border-white/20'}`} key={item.id}>
                    <button className="flex w-full gap-3 p-3 text-left" onClick={() => openCampaign(item)} type="button">
                      <div className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border-soft bg-[linear-gradient(145deg,rgba(45,212,191,.12),rgba(124,58,237,.10))]">
                        {visualUrl ? <img alt="" className="size-full object-cover" src={visualUrl} /> : <>
                          <span className="absolute -left-2 top-2 h-8 w-9 rotate-[-10deg] rounded-lg border border-white/10 bg-white/[.05]" />
                          <span className="absolute left-4 top-2 h-8 w-9 rotate-[8deg] rounded-lg border border-brand-cyan/20 bg-brand-cyan/[.08]" />
                          <Sparkles className="relative size-4 text-brand-cyan" />
                        </>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5"><span className="rounded-full border border-brand-cyan/20 bg-brand-cyan/[.05] px-2 py-0.5 text-[7px] font-bold uppercase tracking-[.08em] text-brand-cyan">{formatLabel(item.contentMode)}</span><span className="text-[8px] text-text-soft">#{index + 1}</span></div>
                        <strong className="mt-1.5 block truncate text-[11px]">{item.title}</strong>
                        <small className="mt-1 block text-[8px] text-text-muted">{item.counts.textPosts} text · {item.counts.imagePosts} image · {item.postCount} total</small>
                        <div className="mt-2 flex h-1 overflow-hidden rounded-full bg-black/30"><span className="bg-brand-cyan" style={{ width: `${(item.counts.imagePosts / Math.max(1, item.postCount)) * 100}%` }} /><span className="bg-white/15" style={{ width: `${(item.counts.textPosts / Math.max(1, item.postCount)) * 100}%` }} /></div>
                      </div>
                    </button>
                    <button aria-label={`Delete ${item.title}`} className="absolute right-2 top-2 grid size-7 place-items-center rounded-lg text-text-soft opacity-60 transition hover:bg-brand-red/10 hover:text-brand-red group-hover:opacity-100" onClick={() => void removeCampaign(item)} type="button"><Trash2 className="size-3.5" /></button>
                  </article>
                }) : <div className="rounded-2xl border border-dashed border-brand-cyan/15 bg-brand-cyan/[.025] p-6 text-center"><Sparkles className="mx-auto size-5 text-brand-cyan/60" /><strong className="mt-2 block text-[10px]">Campaign previews will live here</strong><p className="mt-1 text-[9px] leading-4 text-text-muted">Generate your first campaign, then reopen any saved campaign without leaving this window.</p></div>}
              </div>
            </div>
          </aside>
        </div>

        {selectedCampaign && <div className="relative scroll-mt-4 border-t border-brand-cyan/15 bg-[linear-gradient(180deg,rgba(7,25,37,.96),rgba(4,16,26,.98))] p-4 sm:p-6" ref={reviewRef}>
          <div className="mx-auto max-w-[1280px]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-[.16em] text-brand-cyan">Campaign workspace</span>
                <h3 className="mt-1 text-lg font-semibold">{selectedCampaign.title}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-brand-cyan/20 bg-brand-cyan/[.06] px-2.5 py-1 text-[8px] font-semibold text-brand-cyan">{formatLabel(selectedCampaign.contentMode)}</span>
                  <span className="rounded-full border border-border-soft px-2.5 py-1 text-[8px] text-text-muted">{selectedCampaign.counts.textPosts} text</span>
                  <span className="rounded-full border border-border-soft px-2.5 py-1 text-[8px] text-text-muted">{selectedCampaign.counts.imagePosts} image</span>
                  {PLATFORM_OPTIONS.filter((option) => selectedCampaign.platforms.includes(option.value)).map((option) => <SocialPlatformIcon className="!size-6" key={option.value} platform={option.key} />)}
                </div>
              </div>
              <div className="grid min-w-[260px] grid-cols-3 gap-2">
                <div className="rounded-xl border border-border-soft bg-black/15 p-3"><span className="text-[8px] uppercase tracking-[.08em] text-text-soft">Posts</span><strong className="mt-1 block text-lg">{selectedCampaign.postCount}</strong></div>
                <div className="rounded-xl border border-border-soft bg-black/15 p-3"><span className="text-[8px] uppercase tracking-[.08em] text-text-soft">Images</span><strong className="mt-1 block text-lg">{imagesReady}/{campaignImagePosts.length}</strong></div>
                <div className="rounded-xl border border-border-soft bg-black/15 p-3"><span className="text-[8px] uppercase tracking-[.08em] text-text-soft">Ready</span><strong className="mt-1 block text-lg">{allRequiredImagesReady ? 'Yes' : 'Review'}</strong></div>
              </div>
            </div>

            <section className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]">
              <div className="rounded-[20px] border border-border-soft bg-black/10 p-4">
                <span className="text-[8px] font-bold uppercase tracking-[.12em] text-brand-cyan">Smart strategy</span>
                <p className="mt-2 text-[10px] leading-5 text-text-muted">{selectedCampaign.strategySummary || selectedCampaign.goal}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">{selectedCampaign.contentPillars.map((pillar) => <span className="rounded-full border border-brand-cyan/15 bg-brand-cyan/[.04] px-2 py-1 text-[8px] text-brand-cyan" key={pillar}>{pillar}</span>)}</div>
              </div>
              <div className="rounded-[20px] border border-border-soft bg-black/10 p-4">
                <span className="text-[8px] font-bold uppercase tracking-[.12em] text-text-soft">Campaign source</span>
                <p className="mt-2 text-[10px] leading-5 text-text-muted">{selectedCampaign.sourceSummary || 'Campaign generated from the customer brief.'}</p>
                {selectedCampaign.sourceUrl && <a className="mt-3 inline-flex items-center gap-1 text-[9px] text-brand-cyan hover:underline" href={selectedCampaign.sourceUrl} rel="noreferrer" target="_blank">Website analysed <ExternalLink className="size-3" /></a>}
              </div>
            </section>

            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {selectedCampaign.posts.map((post) => {
                const editing = editingPostId === post.id
                const busy = busyPostId === post.id
                const expanded = expandedPosts.has(post.id)
                const mediaUrl = post.mediaAsset?.thumbnailUrl || post.mediaAsset?.url
                return <article className="group overflow-hidden rounded-[20px] border border-border-soft bg-[linear-gradient(145deg,rgba(14,37,52,.78),rgba(5,20,31,.9))] transition duration-300 hover:-translate-y-0.5 hover:border-white/20" key={post.id}>
                  <div className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2"><span className="text-sm font-bold text-brand-cyan">{String(post.sequence).padStart(2, '0')}</span><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[7px] font-bold uppercase tracking-[.08em] ${post.contentType === 'IMAGE' ? 'border-brand-purple/25 bg-brand-purple/[.06] text-[#c4b5fd]' : 'border-brand-cyan/20 bg-brand-cyan/[.05] text-brand-cyan'}`}>{post.contentType === 'IMAGE' ? <ImageIcon className="size-2.5" /> : <FileText className="size-2.5" />}{post.contentType === 'IMAGE' ? 'Image post' : 'Text post'}</span><span className="truncate text-[8px] text-text-soft">{post.pillar}</span></div>
                    {post.mediaAssetId && <span className="rounded-full border border-brand-green/20 bg-brand-green/[.06] px-2 py-1 text-[7px] text-brand-green">Visual ready</span>}
                  </div>

                  {editing ? <div className="space-y-3 p-4">
                    <input className="min-h-10 w-full rounded-xl border border-border-soft bg-black/15 px-3 text-xs outline-none focus:border-brand-cyan/40" onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))} value={String(editDraft.title || '')} />
                    <input className="min-h-10 w-full rounded-xl border border-border-soft bg-black/15 px-3 text-xs outline-none focus:border-brand-cyan/40" onChange={(event) => setEditDraft((current) => ({ ...current, hook: event.target.value }))} placeholder="Hook" value={String(editDraft.hook || '')} />
                    <textarea className="min-h-28 w-full rounded-xl border border-border-soft bg-black/15 px-3 py-2 text-xs leading-5 outline-none focus:border-brand-cyan/40" onChange={(event) => setEditDraft((current) => ({ ...current, caption: event.target.value }))} value={String(editDraft.caption || '')} />
                    <input className="min-h-10 w-full rounded-xl border border-border-soft bg-black/15 px-3 text-xs outline-none focus:border-brand-cyan/40" onChange={(event) => setEditDraft((current) => ({ ...current, hashtags: event.target.value.split(/[\s,]+/).map((tag) => tag.replace(/^#/, '')).filter(Boolean) }))} placeholder="hashtags" value={(Array.isArray(editDraft.hashtags) ? editDraft.hashtags : []).map((tag) => `#${tag}`).join(' ')} />
                    {post.contentType === 'IMAGE' && <textarea className="min-h-24 w-full rounded-xl border border-brand-purple/20 bg-black/15 px-3 py-2 text-xs leading-5 outline-none focus:border-brand-purple/40" onChange={(event) => setEditDraft((current) => ({ ...current, imageBrief: event.target.value }))} placeholder="Image creative direction" value={String(editDraft.imageBrief || '')} />}
                    <div className="flex gap-2"><Button disabled={busy} onClick={() => void saveEdit(post)} size="sm" variant="primary">{busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}Save</Button><Button onClick={() => { setEditingPostId(null); setEditDraft({}) }} size="sm">Cancel</Button></div>
                  </div> : <div className="grid min-w-0 sm:grid-cols-[1fr_auto]">
                    <div className="min-w-0 p-4">
                      <h4 className="text-sm font-semibold">{post.title}</h4>
                      {post.hook && <p className="mt-2 text-[11px] font-semibold leading-5 text-white/90">{post.hook}</p>}
                      <p className={`mt-2 whitespace-pre-wrap text-[10px] leading-5 text-text-muted ${expanded ? '' : 'line-clamp-3'}`}>{publishCaption(post)}</p>
                      {publishCaption(post).length > 220 && <button className="mt-2 inline-flex items-center gap-1 text-[8px] font-semibold text-brand-cyan" onClick={() => togglePost(post.id)} type="button">{expanded ? <><ChevronUp className="size-3" />Show less</> : <><ChevronDown className="size-3" />Expand post</>}</button>}
                      {post.contentType === 'IMAGE' && expanded && <div className="mt-3 rounded-xl border border-brand-purple/15 bg-brand-purple/[.035] p-3"><strong className="text-[8px] uppercase tracking-[.08em] text-[#c4b5fd]">Visual direction</strong><p className="mt-1 text-[9px] leading-4 text-text-muted">{post.imageBrief || 'AI will create a visual direction when this post is regenerated.'}</p></div>}
                    </div>
                    <div className="flex gap-2 border-t border-border-soft p-3 sm:w-40 sm:flex-col sm:border-l sm:border-t-0">
                      {mediaUrl && <button aria-label={`Open full image for post ${post.sequence}`} className="group/image relative overflow-hidden rounded-xl border border-border-soft text-left transition hover:border-brand-cyan/40 hover:shadow-[0_12px_30px_rgba(45,212,191,.10)]" onClick={() => setImagePreview({ url: post.mediaAsset?.url || mediaUrl, title: post.title, caption: publishCaption(post) })} type="button"><img alt={post.title} className="aspect-[4/5] w-16 object-cover transition duration-300 group-hover/image:scale-[1.035] sm:w-full" src={mediaUrl} /><span className="absolute inset-x-2 bottom-2 rounded-lg bg-black/65 px-2 py-1 text-center text-[7px] font-semibold text-white opacity-0 backdrop-blur transition group-hover/image:opacity-100">View full image</span></button>}
                      <Button disabled={busy} onClick={() => beginEdit(post)} size="sm"><PencilLine className="size-3.5" />Edit</Button>
                      <Button disabled={busy} onClick={() => void regenerate(post)} size="sm">{busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <RefreshCcw className="size-3.5" />}Regenerate</Button>
                      {post.contentType === 'IMAGE' && <Button disabled={busy} onClick={() => void generateImage(post)} size="sm" variant={post.mediaAssetId ? 'ghost' : 'primary'}>{busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}{post.mediaAssetId ? 'Recreate image' : 'Create image'}</Button>}
                    </div>
                  </div>}
                </article>
              })}
            </div>

            <div className="sticky bottom-3 z-10 mt-5 flex flex-col gap-3 rounded-[20px] border border-brand-cyan/20 bg-panel/95 p-3 shadow-[0_-18px_55px_rgba(0,0,0,.28)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
              <div><strong className="text-xs">Campaign reviewed?</strong><p className="mt-1 text-[9px] text-text-muted">{campaignImagePosts.length && !allRequiredImagesReady ? `${campaignImagePosts.length - imagesReady} image post${campaignImagePosts.length - imagesReady === 1 ? '' : 's'} still need a visual before the full campaign can go to Bulk Scheduler.` : `${campaignTextPosts.length} text + ${campaignImagePosts.length} image posts are ready to hand off in campaign order.`}</p></div>
              <Button disabled={!allRequiredImagesReady} onClick={() => onHandoff(selectedCampaign)} size="sm" variant="primary"><CalendarRange className="size-3.5" />Send campaign to Bulk Scheduler</Button>
            </div>
          </div>
        </div>}
      </section>
      {imagePreview && <div aria-label="Campaign image preview" aria-modal="true" className="fixed inset-0 z-[160] grid place-items-center bg-[#01070d]/94 p-4 backdrop-blur-xl" onMouseDown={(event) => { if (event.currentTarget === event.target) setImagePreview(null) }} role="dialog">
        <div className="ai-studio-modal-enter relative flex max-h-[94dvh] w-full max-w-[980px] flex-col overflow-hidden rounded-[28px] border border-brand-cyan/25 bg-[linear-gradient(145deg,rgba(5,22,34,.995),rgba(2,12,22,.995))] shadow-[0_44px_160px_rgba(0,0,0,.78)]">
          <div className="flex items-start justify-between gap-3 border-b border-border-soft px-4 py-3 sm:px-5">
            <div className="min-w-0"><span className="text-[8px] font-bold uppercase tracking-[.16em] text-brand-cyan">Campaign image</span><h3 className="mt-1 truncate text-sm font-semibold">{imagePreview.title}</h3></div>
            <button aria-label="Close image preview" className="grid size-9 shrink-0 place-items-center rounded-xl border border-border-soft text-text-muted transition hover:border-brand-cyan/30 hover:text-white" onClick={() => setImagePreview(null)} type="button"><X className="size-4" /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-black/20 p-3 sm:p-5">
            <img alt={imagePreview.title} className="mx-auto max-h-[72dvh] w-auto max-w-full rounded-2xl object-contain shadow-[0_24px_80px_rgba(0,0,0,.45)]" src={imagePreview.url} />
            <p className="mx-auto mt-4 max-w-3xl whitespace-pre-wrap text-[10px] leading-5 text-text-muted">{imagePreview.caption}</p>
          </div>
        </div>
      </div>}
    </div>,
    document.body,
  )
}
