import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CalendarRange,
  Check,
  ExternalLink,
  Image as ImageIcon,
  LoaderCircle,
  Megaphone,
  PencilLine,
  RefreshCcw,
  Sparkles,
  Trash2,
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

const PLATFORM_OPTIONS = ['Facebook', 'Instagram', 'LinkedIn', 'X', 'Threads', 'Bluesky', 'Pinterest']
const POST_COUNTS = [10, 15, 20, 30]
const TONES = ['Clear, human and credible', 'Professional', 'Conversational', 'Playful', 'Educational', 'Bold']

function publishCaption(post: AIPostCampaignPost) {
  const tags = post.hashtags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')
  return [post.caption.trim(), tags].filter(Boolean).join('\n\n')
}

type Props = {
  open: boolean
  onClose: () => void
  onHandoff: (campaign: AIPostCampaign, mode: 'TEXT' | 'IMAGE') => void
  onToast: (message: string) => void
}

export function AiPostCampaignModal({ open, onClose, onHandoff, onToast }: Props) {
  const [campaign, setCampaign] = useState<AIPostCampaign | null>(null)
  const [recent, setRecent] = useState<AIPostCampaign[]>([])
  const [loadingRecent, setLoadingRecent] = useState(false)
  const [creating, setCreating] = useState(false)
  const [busyPostId, setBusyPostId] = useState<string | null>(null)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<AIPostCampaignPost>>({})
  const [form, setForm] = useState<CreateAIPostCampaignInput>({
    businessUrl: '',
    goal: '',
    audience: '',
    tone: TONES[0],
    contentMode: 'TEXT',
    platforms: ['Facebook', 'Instagram'],
    postCount: 10,
  })

  useEffect(() => {
    if (!open) return
    setLoadingRecent(true)
    void getAIPostCampaigns(8)
      .then(setRecent)
      .catch(() => setRecent([]))
      .finally(() => setLoadingRecent(false))
  }, [open])

  const imagesReady = campaign?.contentMode === 'IMAGE'
    ? campaign.posts.filter((post) => Boolean(post.mediaAssetId)).length
    : 0
  const allImagesReady = Boolean(campaign?.contentMode === 'IMAGE' && campaign.posts.length && imagesReady === campaign.posts.length)

  const canCreate = form.goal.trim().length >= 8 && form.platforms.length > 0 && !creating

  const preparedCaptions = useMemo(
    () => campaign?.posts.map(publishCaption) || [],
    [campaign],
  )

  function togglePlatform(platform: string) {
    setForm((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform],
    }))
  }

  async function createCampaign() {
    if (!canCreate) return
    setCreating(true)
    try {
      const created = await createAIPostCampaign({
        ...form,
        businessUrl: form.businessUrl?.trim() || undefined,
        audience: form.audience?.trim() || undefined,
      })
      setCampaign(created)
      setRecent((current) => [created, ...current.filter((item) => item.id !== created.id)].slice(0, 8))
      onToast(`${created.postCount}-post AI campaign created and ready for review.`)
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'The AI campaign could not be created.')
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
    if (!campaign) return
    setBusyPostId(post.id)
    try {
      const updated = await updateAIPostCampaignPost(campaign.id, post.id, {
        title: String(editDraft.title || ''),
        pillar: String(editDraft.pillar || ''),
        hook: String(editDraft.hook || ''),
        caption: String(editDraft.caption || ''),
        cta: String(editDraft.cta || ''),
        hashtags: Array.isArray(editDraft.hashtags) ? editDraft.hashtags : [],
        imageBrief: String(editDraft.imageBrief || ''),
      })
      setCampaign(updated)
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
    if (!campaign) return
    setBusyPostId(post.id)
    try {
      const updated = await regenerateAIPostCampaignPost(campaign.id, post.id)
      setCampaign(updated)
      onToast(`Post ${post.sequence} regenerated.`)
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'The post could not be regenerated.')
    } finally {
      setBusyPostId(null)
    }
  }

  async function generateImage(post: AIPostCampaignPost) {
    if (!campaign) return
    setBusyPostId(post.id)
    try {
      const updated = await generateAIPostCampaignImage(campaign.id, post.id)
      setCampaign(updated)
      onToast(`Image created for post ${post.sequence}. 5 AI credits used.`)
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'The campaign image could not be generated.')
    } finally {
      setBusyPostId(null)
    }
  }

  async function removeCampaign(item: AIPostCampaign) {
    if (!window.confirm(`Delete “${item.title}”? This removes the campaign plan, not media already saved in Media Library.`)) return
    try {
      await deleteAIPostCampaign(item.id)
      setRecent((current) => current.filter((candidate) => candidate.id !== item.id))
      if (campaign?.id === item.id) setCampaign(null)
      onToast('AI campaign deleted.')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'The campaign could not be deleted.')
    }
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-[#01070d]/92 backdrop-blur-xl">
      <section className="mx-auto flex h-dvh w-full max-w-[1540px] flex-col overflow-hidden bg-bg sm:h-[min(940px,96dvh)] sm:translate-y-[2dvh] sm:rounded-[28px] sm:border sm:border-border-soft sm:shadow-[0_30px_100px_rgba(0,0,0,.48)]">
        <header className="flex items-start justify-between gap-3 border-b border-border-soft bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,.12),transparent_42%),linear-gradient(135deg,rgba(10,30,44,.98),rgba(6,18,29,.98))] p-4 sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            {campaign && <button aria-label="Back to campaign setup" className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-border-soft text-text-muted hover:text-white" onClick={() => setCampaign(null)} type="button"><ArrowLeft className="size-4" /></button>}
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><Megaphone className="size-5" /></span>
            <div className="min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-[.16em] text-brand-cyan">AI Post Campaign</span>
              <h2 className="mt-1 truncate text-lg font-semibold sm:text-xl">{campaign?.title || 'Build a complete organic campaign'}</h2>
              <p className="mt-1 max-w-3xl text-[11px] leading-5 text-text-muted">{campaign ? 'Review every post, refine the copy and create campaign images before sending the batch to Bulk Scheduler.' : 'Give INXSocial the campaign goal and optional website. AI builds the strategy first, then creates 10–30 distinct posts for review.'}</p>
            </div>
          </div>
          <button aria-label="Close AI Post Campaign" className="grid size-9 shrink-0 place-items-center rounded-xl border border-border-soft text-text-muted hover:text-white" onClick={onClose} type="button"><X className="size-4" /></button>
        </header>

        {!campaign ? (
          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1fr_360px] lg:overflow-hidden">
            <div className="min-w-0 p-4 sm:p-6 lg:overflow-y-auto">
              <div className="mx-auto max-w-4xl space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[.08em] text-text-soft">Campaign goal</span>
                    <textarea className="mt-2 min-h-28 w-full rounded-2xl border border-border-soft bg-black/15 px-4 py-3 text-sm outline-none transition focus:border-brand-cyan/45" maxLength={1600} onChange={(event) => setForm((current) => ({ ...current, goal: event.target.value }))} placeholder="Example: Introduce INXSocial to creators and small agencies, explain the time saved by bulk scheduling, and drive free-trial signups without sounding like repeated ads." value={form.goal} />
                  </label>

                  <label>
                    <span className="text-[10px] font-semibold uppercase tracking-[.08em] text-text-soft">Business / product website <span className="normal-case tracking-normal text-text-soft">(optional)</span></span>
                    <input className="mt-2 min-h-11 w-full rounded-xl border border-border-soft bg-black/15 px-3 text-sm outline-none focus:border-brand-cyan/45" onChange={(event) => setForm((current) => ({ ...current, businessUrl: event.target.value }))} placeholder="https://www.example.com" type="url" value={form.businessUrl || ''} />
                  </label>

                  <label>
                    <span className="text-[10px] font-semibold uppercase tracking-[.08em] text-text-soft">Audience <span className="normal-case tracking-normal text-text-soft">(optional)</span></span>
                    <input className="mt-2 min-h-11 w-full rounded-xl border border-border-soft bg-black/15 px-3 text-sm outline-none focus:border-brand-cyan/45" maxLength={600} onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))} placeholder="Creators, agencies, local businesses…" value={form.audience || ''} />
                  </label>
                </div>

                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-[.08em] text-text-soft">Primary platforms</span>
                  <div className="mt-2 flex flex-wrap gap-2">{PLATFORM_OPTIONS.map((platform) => {
                    const active = form.platforms.includes(platform)
                    return <button className={`rounded-xl border px-3 py-2 text-[10px] font-semibold transition ${active ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan' : 'border-border-soft text-text-muted hover:text-white'}`} key={platform} onClick={() => togglePlatform(platform)} type="button">{active && <Check className="mr-1 inline size-3" />}{platform}</button>
                  })}</div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-[.08em] text-text-soft">Campaign format</span>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button className={`rounded-2xl border p-3 text-left transition ${form.contentMode === 'TEXT' ? 'border-brand-cyan/40 bg-brand-cyan/[.08]' : 'border-border-soft bg-black/10'}`} onClick={() => setForm((current) => ({ ...current, contentMode: 'TEXT' }))} type="button"><strong className="block text-xs">Text-first</strong><small className="mt-1 block text-[9px] leading-4 text-text-muted">Ready to send straight to Bulk Scheduler.</small></button>
                      <button className={`rounded-2xl border p-3 text-left transition ${form.contentMode === 'IMAGE' ? 'border-brand-purple/40 bg-brand-purple/[.08]' : 'border-border-soft bg-black/10'}`} onClick={() => setForm((current) => ({ ...current, contentMode: 'IMAGE' }))} type="button"><strong className="flex items-center gap-1.5 text-xs"><ImageIcon className="size-3.5" />Image campaign</strong><small className="mt-1 block text-[9px] leading-4 text-text-muted">AI creates image briefs first. Render only the visuals you approve.</small></button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-[.08em] text-text-soft">Number of posts</span>
                    <div className="mt-2 grid grid-cols-4 gap-2">{POST_COUNTS.map((count) => <button className={`rounded-xl border px-2 py-3 text-xs font-semibold transition ${form.postCount === count ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan' : 'border-border-soft text-text-muted hover:text-white'}`} key={count} onClick={() => setForm((current) => ({ ...current, postCount: count }))} type="button">{count}</button>)}</div>
                  </div>
                </div>

                <label>
                  <span className="text-[10px] font-semibold uppercase tracking-[.08em] text-text-soft">Tone</span>
                  <select className="mt-2 min-h-11 w-full rounded-xl border border-border-soft bg-panel px-3 text-sm outline-none focus:border-brand-cyan/45" onChange={(event) => setForm((current) => ({ ...current, tone: event.target.value }))} value={form.tone}>{TONES.map((tone) => <option key={tone} value={tone}>{tone}</option>)}</select>
                </label>

                <div className="rounded-2xl border border-brand-cyan/15 bg-brand-cyan/[.035] p-4">
                  <div className="flex gap-3"><Sparkles className="mt-0.5 size-4 shrink-0 text-brand-cyan" /><div><strong className="text-xs">Strategy first, posts second</strong><p className="mt-1 text-[10px] leading-5 text-text-muted">INXSocial analyses the brief and readable website evidence, creates content pillars, then writes the campaign in batches to keep the posts materially different from each other.</p></div></div>
                </div>

                <Button className="min-h-12 w-full justify-center" disabled={!canCreate} onClick={() => void createCampaign()} variant="primary">{creating ? <><LoaderCircle className="size-4 animate-spin" />Building campaign strategy and posts…</> : <><Sparkles className="size-4" />Generate AI campaign</>}</Button>
              </div>
            </div>

            <aside className="border-t border-border-soft bg-black/10 p-4 sm:p-5 lg:overflow-y-auto lg:border-l lg:border-t-0">
              <div className="flex items-center justify-between"><div><span className="text-[9px] font-bold uppercase tracking-[.14em] text-text-soft">Saved campaigns</span><h3 className="mt-1 text-sm font-semibold">Recent work</h3></div><CalendarRange className="size-4 text-brand-cyan" /></div>
              <div className="mt-4 space-y-2">
                {loadingRecent ? <div className="rounded-xl border border-border-soft p-4 text-[10px] text-text-muted">Loading campaigns…</div> : recent.length ? recent.map((item) => <article className="rounded-xl border border-border-soft bg-bg/30 p-3" key={item.id}><div className="flex items-start justify-between gap-2"><button className="min-w-0 flex-1 text-left" onClick={() => setCampaign(item)} type="button"><strong className="block truncate text-xs">{item.title}</strong><small className="mt-1 block text-[9px] text-text-muted">{item.postCount} posts · {item.contentMode === 'IMAGE' ? `${item.counts.withImages}/${item.postCount} images` : 'text campaign'}</small></button><button aria-label={`Delete ${item.title}`} className="grid size-7 shrink-0 place-items-center rounded-lg text-text-soft hover:bg-brand-red/10 hover:text-brand-red" onClick={() => void removeCampaign(item)} type="button"><Trash2 className="size-3.5" /></button></div></article>) : <div className="rounded-xl border border-dashed border-border-soft p-5 text-center text-[10px] text-text-muted">Your generated campaigns will appear here.</div>}
              </div>
            </aside>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
            <div className="mx-auto max-w-6xl">
              <section className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <div className="rounded-2xl border border-border-soft bg-panel/60 p-4">
                  <span className="text-[9px] font-bold uppercase tracking-[.14em] text-brand-cyan">Campaign strategy</span>
                  <p className="mt-2 text-xs leading-5 text-text-muted">{campaign.strategySummary || campaign.goal}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">{campaign.contentPillars.map((pillar) => <span className="rounded-full border border-brand-cyan/20 bg-brand-cyan/[.055] px-2.5 py-1 text-[9px] text-brand-cyan" key={pillar}>{pillar}</span>)}</div>
                  {campaign.sourceUrl && <a className="mt-3 inline-flex items-center gap-1 text-[9px] text-text-soft hover:text-brand-cyan" href={campaign.sourceUrl} rel="noreferrer" target="_blank">Website analysed <ExternalLink className="size-3" /></a>}
                </div>
                <div className="rounded-2xl border border-border-soft bg-panel/60 p-4 lg:min-w-72">
                  <span className="text-[9px] font-bold uppercase tracking-[.14em] text-text-soft">Ready to schedule</span>
                  {campaign.contentMode === 'IMAGE' ? <><strong className="mt-2 block text-2xl">{imagesReady}/{campaign.postCount}</strong><p className="text-[10px] text-text-muted">campaign images generated</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/25"><div className="h-full rounded-full bg-brand-cyan transition-all" style={{ width: `${Math.round((imagesReady / campaign.postCount) * 100)}%` }} /></div></> : <><strong className="mt-2 block text-2xl">{campaign.postCount}</strong><p className="text-[10px] text-text-muted">text posts ready for Bulk Scheduler</p></>}
                </div>
              </section>

              <div className="mt-4 space-y-3">
                {campaign.posts.map((post) => {
                  const editing = editingPostId === post.id
                  const busy = busyPostId === post.id
                  const mediaUrl = post.mediaAsset?.thumbnailUrl || post.mediaAsset?.url
                  return <article className="overflow-hidden rounded-2xl border border-border-soft bg-[linear-gradient(145deg,rgba(15,36,52,.78),rgba(7,24,38,.88))]" key={post.id}>
                    <div className="grid min-w-0 lg:grid-cols-[72px_1fr_auto]">
                      <div className="flex items-center justify-between border-b border-border-soft px-4 py-3 lg:flex-col lg:justify-start lg:border-b-0 lg:border-r lg:px-2 lg:py-4">
                        <span className="text-[9px] font-bold uppercase tracking-[.12em] text-text-soft">Post</span>
                        <strong className="text-xl text-brand-cyan">{String(post.sequence).padStart(2, '0')}</strong>
                      </div>

                      <div className="min-w-0 p-4">
                        {editing ? <div className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input className="min-h-10 rounded-xl border border-border-soft bg-black/15 px-3 text-xs outline-none focus:border-brand-cyan/40" onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))} value={String(editDraft.title || '')} />
                            <input className="min-h-10 rounded-xl border border-border-soft bg-black/15 px-3 text-xs outline-none focus:border-brand-cyan/40" onChange={(event) => setEditDraft((current) => ({ ...current, pillar: event.target.value }))} value={String(editDraft.pillar || '')} />
                          </div>
                          <input className="min-h-10 w-full rounded-xl border border-border-soft bg-black/15 px-3 text-xs outline-none focus:border-brand-cyan/40" onChange={(event) => setEditDraft((current) => ({ ...current, hook: event.target.value }))} placeholder="Hook" value={String(editDraft.hook || '')} />
                          <textarea className="min-h-36 w-full rounded-xl border border-border-soft bg-black/15 px-3 py-2 text-xs leading-5 outline-none focus:border-brand-cyan/40" onChange={(event) => setEditDraft((current) => ({ ...current, caption: event.target.value }))} value={String(editDraft.caption || '')} />
                          <input className="min-h-10 w-full rounded-xl border border-border-soft bg-black/15 px-3 text-xs outline-none focus:border-brand-cyan/40" onChange={(event) => setEditDraft((current) => ({ ...current, hashtags: event.target.value.split(/[\s,]+/).map((tag) => tag.replace(/^#/, '')).filter(Boolean) }))} placeholder="hashtags separated by spaces" value={(Array.isArray(editDraft.hashtags) ? editDraft.hashtags : []).map((tag) => `#${tag}`).join(' ')} />
                          {campaign.contentMode === 'IMAGE' && <textarea className="min-h-24 w-full rounded-xl border border-border-soft bg-black/15 px-3 py-2 text-xs leading-5 outline-none focus:border-brand-purple/40" onChange={(event) => setEditDraft((current) => ({ ...current, imageBrief: event.target.value }))} placeholder="Image creative direction" value={String(editDraft.imageBrief || '')} />}
                          <div className="flex gap-2"><Button disabled={busy} onClick={() => void saveEdit(post)} size="sm" variant="primary">{busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}Save</Button><Button onClick={() => { setEditingPostId(null); setEditDraft({}) }} size="sm">Cancel</Button></div>
                        </div> : <>
                          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-brand-cyan/20 bg-brand-cyan/[.05] px-2 py-1 text-[8px] font-semibold uppercase tracking-[.08em] text-brand-cyan">{post.pillar || 'Campaign'}</span>{post.mediaAssetId && <span className="rounded-full border border-brand-green/20 bg-brand-green/[.06] px-2 py-1 text-[8px] font-semibold text-brand-green">Image ready</span>}</div>
                          <h3 className="mt-2 text-sm font-semibold">{post.title}</h3>
                          {post.hook && <p className="mt-2 text-[11px] font-semibold text-white/85">{post.hook}</p>}
                          <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-text-muted">{post.caption}</p>
                          {post.hashtags.length > 0 && <p className="mt-2 text-[10px] text-brand-cyan/80">{post.hashtags.map((tag) => `#${tag}`).join(' ')}</p>}
                          {campaign.contentMode === 'IMAGE' && <div className="mt-3 rounded-xl border border-brand-purple/15 bg-brand-purple/[.035] p-3"><strong className="text-[9px] uppercase tracking-[.08em] text-[#c4b5fd]">Image direction</strong><p className="mt-1 text-[10px] leading-4 text-text-muted">{post.imageBrief || 'No image brief yet.'}</p></div>}
                        </>}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 border-t border-border-soft p-3 lg:w-48 lg:flex-col lg:items-stretch lg:border-l lg:border-t-0">
                        {mediaUrl && <img alt="" className="aspect-[4/5] w-20 rounded-xl border border-border-soft object-cover lg:w-full" src={mediaUrl} />}
                        {!editing && <Button disabled={busy} onClick={() => beginEdit(post)} size="sm"><PencilLine className="size-3.5" />Edit</Button>}
                        {!editing && <Button disabled={busy} onClick={() => void regenerate(post)} size="sm">{busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <RefreshCcw className="size-3.5" />}Regenerate</Button>}
                        {!editing && campaign.contentMode === 'IMAGE' && <Button disabled={busy} onClick={() => void generateImage(post)} size="sm" variant={post.mediaAssetId ? 'ghost' : 'primary'}>{busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}{post.mediaAssetId ? 'Recreate image' : 'Create image'}</Button>}
                      </div>
                    </div>
                  </article>
                })}
              </div>

              <div className="sticky bottom-0 mt-4 flex flex-col gap-2 rounded-2xl border border-border-soft bg-panel/95 p-3 shadow-[0_-15px_45px_rgba(0,0,0,.22)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
                <div><strong className="text-xs">Campaign reviewed?</strong><p className="mt-0.5 text-[9px] text-text-muted">{campaign.contentMode === 'IMAGE' && !allImagesReady ? `Generate the remaining ${campaign.postCount - imagesReady} images to send the visual campaign, or send the captions as text posts now.` : 'Continue to Bulk Scheduler to choose destinations and publishing times.'}</p></div>
                <div className="flex flex-wrap gap-2">
                  {campaign.contentMode === 'IMAGE' && !allImagesReady && <Button onClick={() => onHandoff({ ...campaign, posts: campaign.posts.map((post) => ({ ...post, caption: publishCaption(post) })) }, 'TEXT')} size="sm">Send captions only</Button>}
                  <Button disabled={campaign.contentMode === 'IMAGE' && !allImagesReady} onClick={() => onHandoff({ ...campaign, posts: campaign.posts.map((post) => ({ ...post, caption: publishCaption(post) })) }, campaign.contentMode)} size="sm" variant="primary"><CalendarRange className="size-3.5" />{campaign.contentMode === 'IMAGE' ? 'Send visual campaign to Bulk Scheduler' : 'Send to Bulk Scheduler'}</Button>
                </div>
              </div>
              <span className="sr-only">{preparedCaptions.length} prepared campaign captions</span>
            </div>
          </div>
        )}
      </section>
    </div>,
    document.body,
  )
}
