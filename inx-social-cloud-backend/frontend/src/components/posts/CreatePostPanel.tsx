import { AtSign, FileImage, FileVideo, Hash, ImagePlus, Link2, MapPin, RefreshCw, Smile, Sparkles, Type, UploadCloud, WandSparkles, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { contentScore, postTypes } from '../../data/postsData'
import type { BestTimeInsight, CaptionTone, EnhancementAction, MediaItem, PostType } from '../../types/posts'
import { Button } from '../ui/Button'
import { CaptionEnhancementModal } from './CaptionEnhancementModal'
import { PanelHeading } from './PostPrimitives'

type Props = {
  postType: PostType
  setPostType: (value: PostType) => void
  title: string
  setTitle: (value: string) => void
  caption: string
  setCaption: (value: string) => void
  media: MediaItem | null
  setMedia: (value: MediaItem | null) => void
  destinationCount: number
  bestTime: BestTimeInsight
  bestTimeLoading: boolean
  retainMedia: boolean
  setRetainMedia: (value: boolean) => void
}

export function CreatePostPanel(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const score = contentScore(props.caption, Boolean(props.media), props.destinationCount)
  const [tone, setTone] = useState<CaptionTone>('professional')
  const [enhancement, setEnhancement] = useState<EnhancementAction | null>(null)
  const closeEnhancement = useCallback(() => setEnhancement(null), [])

  function selectFile(file?: File) {
    if (!file) return
    const type = file.type.startsWith('video/') ? 'video' : 'image'
    if (type === 'image' && file.size > 15 * 1024 * 1024) return window.alert('Images must be no larger than 15 MB.')
    if (props.media) URL.revokeObjectURL(props.media.url)
    const url = URL.createObjectURL(file)
    props.setMedia({ id: crypto.randomUUID(), libraryAssetId: null, type, file, url, thumbnailUrl: url, fileName: file.name, size: file.size })
    props.setRetainMedia(false)
    props.setPostType(type === 'video' ? 'video' : 'image')
  }

  return (
    <section className="interactive-surface rounded-panel border p-4 xl:p-5">
      <PanelHeading step={1} subtitle="Write your message and add visual content." title="Create Your Post" />
      <fieldset><legend className="mb-2 text-[11px] font-semibold text-text-muted">Post type</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{postTypes.map((item) => <button aria-pressed={props.postType === item.id} className={`rounded-xl border px-2 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-brand-cyan ${props.postType === item.id ? 'border-brand-cyan/60 bg-brand-cyan/12 text-brand-cyan' : 'border-border-soft bg-bg/30 text-text-muted hover:border-brand-cyan/30 hover:text-white'} disabled:cursor-not-allowed disabled:opacity-40`} disabled={!item.available} key={item.id} onClick={() => props.setPostType(item.id)} type="button">{item.label}{!item.available && <span className="ml-1 text-[8px]">Soon</span>}</button>)}</div></fieldset>

      <label className="mt-4 block text-[11px] font-semibold text-text-muted">Post title <span className="font-normal text-text-soft">(optional)</span><input className="mt-2 w-full rounded-xl border border-border-soft bg-bg/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/10" maxLength={200} onChange={(event) => props.setTitle(event.target.value)} placeholder="Give your post a working title…" value={props.title} /></label>
      <label className="mt-4 block text-[11px] font-semibold text-text-muted">Caption<textarea className="mt-2 min-h-36 w-full resize-y rounded-xl border border-border-soft bg-bg/40 p-3 text-sm leading-6 text-white outline-none transition placeholder:text-text-soft focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/10" maxLength={5000} onChange={(event) => props.setCaption(event.target.value)} placeholder="What would you like to share?" value={props.caption} /></label>
      <div className="-mt-10 flex h-10 items-center justify-between px-3 text-text-soft"><div className="flex gap-1">{[Smile, Hash, AtSign, Link2, MapPin, Type].map((Icon, index) => <button aria-label={['Emoji', 'Hashtag', 'Mention', 'Link', 'Location', 'Formatting'][index]} className="rounded-lg p-1.5 transition hover:bg-white/5 hover:text-brand-cyan focus-visible:outline-2 focus-visible:outline-brand-cyan" key={index} type="button"><Icon className="size-3.5" /></button>)}</div><span className="text-[10px]">{props.caption.length} / 5,000</span></div>

      <div className="mt-4"><p className="mb-2 text-[11px] font-semibold text-text-muted">Media</p><input accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(event) => selectFile(event.target.files?.[0])} ref={inputRef} type="file" />
        {props.media ? <div className="flex min-w-0 items-center gap-3 rounded-xl border border-brand-cyan/25 bg-brand-cyan/[0.035] p-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan">{props.media.type === 'image' ? <FileImage aria-hidden="true" className="size-5" /> : <FileVideo aria-hidden="true" className="size-5" />}</span><div className="min-w-0 flex-1"><strong className="block truncate text-xs text-text-main">{props.media.fileName}</strong><span className="mt-0.5 block text-[9px] uppercase tracking-wide text-text-soft">{props.media.type} · {(props.media.size / 1024 / 1024).toFixed(1)} MB · Ready</span></div><button className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-soft px-2.5 py-2 text-[10px] font-semibold text-text-muted transition hover:border-brand-cyan/35 hover:text-brand-cyan focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={() => inputRef.current?.click()} type="button"><RefreshCw aria-hidden="true" className="size-3" />Replace</button><button aria-label={`Remove ${props.media.fileName}`} className="shrink-0 rounded-lg border border-border-soft p-2 text-text-muted transition hover:border-brand-red/40 hover:bg-brand-red/10 hover:text-brand-red focus-visible:outline-2 focus-visible:outline-brand-red" onClick={() => { URL.revokeObjectURL(props.media!.url); props.setMedia(null); props.setRetainMedia(false); props.setPostType('text') }} type="button"><X className="size-4" /></button></div> : <button className="group grid min-h-32 w-full place-items-center rounded-xl border border-dashed border-brand-cyan/25 bg-brand-cyan/[0.025] p-4 text-center transition hover:border-brand-cyan/55 hover:bg-brand-cyan/[0.06] focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectFile(event.dataTransfer.files[0]) }} type="button"><span><UploadCloud className="mx-auto size-7 text-brand-cyan" /><strong className="mt-2 block text-xs">Drag & drop media here</strong><span className="mt-1 block text-[10px] text-text-muted">PNG, JPEG, WebP, MP4, MOV or WebM</span><span className="mt-3 inline-flex rounded-lg border border-brand-cyan/30 px-3 py-1.5 text-[11px] text-brand-cyan"><ImagePlus className="mr-1.5 size-3.5" />Upload Files</span></span></button>}
      </div>
      {props.media && <label className={`mt-2 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[10px] ${props.media.libraryAssetId ? 'border-brand-green/20 bg-brand-green/[0.045] text-brand-green' : props.media.size > 100 * 1024 * 1024 ? 'cursor-not-allowed border-brand-amber/20 bg-brand-amber/[0.04] text-brand-amber' : 'cursor-pointer border-border-soft bg-bg/25 text-text-muted hover:border-brand-cyan/25'}`}><input checked={Boolean(props.media.libraryAssetId) || props.retainMedia} className="mt-0.5 accent-[var(--color-brand-cyan)]" disabled={Boolean(props.media.libraryAssetId) || props.media.size > 100 * 1024 * 1024} onChange={(event) => props.setRetainMedia(event.target.checked)} type="checkbox" /><span><strong className="block text-text-main">{props.media.libraryAssetId ? 'Stored in Media Library' : 'Save to Media Library for reuse'}</strong><span className="mt-0.5 block">{props.media.libraryAssetId ? 'Future Reuse actions can attach this same asset without making another copy.' : props.media.size > 100 * 1024 * 1024 ? 'Files larger than 100 MB remain temporary and must be reselected for reuse.' : 'Off by default. The exact file is checksum-deduplicated and counts toward your storage allowance.'}</span></span></label>}

      <div className="mt-4 rounded-2xl border border-brand-cyan/15 bg-brand-cyan/[0.025] p-3"><div className="mb-2 flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-[11px] font-semibold text-text-muted"><WandSparkles className="size-3.5 text-brand-cyan" />AI Content Enhancement</div><span className="rounded-full bg-brand-cyan/8 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-brand-cyan">OpenAI powered</span></div><div className="flex flex-wrap gap-2">{([['rewrite', 'Rewrite'], ['shorten', 'Shorten'], ['expand', 'Expand'], ['hashtags', 'Add Hashtags'], ['cta', 'Improve CTA']] as const).map(([action, label]) => <Button className="min-h-8 px-2.5 py-1 text-[10px]" disabled={!props.caption.trim()} key={action} onClick={() => setEnhancement(action)} title={props.caption.trim() ? `${label} with AI` : 'Write a caption first'} type="button" variant="ghost"><Sparkles className="size-3" />{label}</Button>)}<select aria-label="Caption tone" className="min-h-8 rounded-lg border border-border-soft bg-bg/50 px-2 text-[10px] capitalize text-text-muted outline-none focus:border-brand-cyan" onChange={(event) => setTone(event.target.value as CaptionTone)} value={tone}><option value="professional">Professional</option><option value="friendly">Friendly</option><option value="concise">Concise</option><option value="energetic">Energetic</option></select></div><p className="mt-2 text-[9px] text-text-soft">Suggestions open in a review window. Nothing replaces your caption until you approve it.</p></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-border-soft bg-bg/30 p-3">
          <span className="text-[10px] text-text-muted">Live Content Score</span>
          <div className="mt-1 flex items-center gap-3"><strong className="text-lg text-brand-cyan">{score}/100</strong><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-green transition-all" style={{ width: `${score}%` }} /></div></div>
          <p className="mt-1 text-[9px] text-text-soft">Updates from caption quality, CTA, media and destinations.</p>
        </div>
        <div className="rounded-xl border border-border-soft bg-bg/30 p-3">
          <span className="text-[10px] text-text-muted">Best Time To Post</span>
          <strong className={`mt-1 block text-xs ${props.bestTime.available ? 'text-brand-cyan' : 'text-text-main'}`}>{props.bestTimeLoading ? 'Analysing Page activity…' : props.bestTime.label}</strong>
          <p className="mt-1 text-[10px] leading-4 text-text-soft">{props.bestTimeLoading ? 'Reading live engagement history from the selected Page.' : props.bestTime.detail}</p>
        </div>
      </div>
      {enhancement && <CaptionEnhancementModal action={enhancement} caption={props.caption} onApply={props.setCaption} onClose={closeEnhancement} tone={tone} />}
    </section>
  )
}
