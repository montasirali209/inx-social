import { ArrowDown, ArrowUp, FileText, GripVertical, Image as ImageIcon, Images, Loader2, Megaphone, Sparkles, Trash2, Video, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { parseTextPosts } from '../../lib/bulk-scheduler-utils'
import type { CampaignOrderMode } from '../../lib/campaign-order'
import { Button } from '../ui/Button'

export type CampaignPreviewPost = {
  id: string
  sequence: number
  contentType: 'TEXT' | 'IMAGE' | 'VIDEO'
  caption: string
  thumbnailUrl: string
  fileName: string
}

export type CampaignImport = {
  id: string
  title: string
  source: 'ai' | 'manual'
  textPosts: number
  imagePosts: number
  total: number
  orderMode: CampaignOrderMode
  posts: CampaignPreviewPost[]
}

type Props = {
  campaign: CampaignImport
  running: boolean
  onClose: () => void
  onTitleChange: (title: string) => void
  onTextAdd: (captions: string[]) => void
  onMediaAdd: (files: File[]) => void
  onMediaMove: (id: string, direction: -1 | 1) => void
  onMediaReorder: (activeId: string, overId: string) => void
  onGenerateAICaptions: () => void
  aiCaptionBusy: boolean
  aiCaptioningIds: Set<string>
  aiCaptionMessage: string
  onPostEdit: (id: string, caption: string) => void
  onPostRemove: (id: string) => void
  onPostMove: (id: string, direction: -1 | 1) => void
  onOrderModeChange: (mode: CampaignOrderMode) => void
}

export function ManualCampaignEditor({ campaign, running, onClose, onTitleChange, onTextAdd, onMediaAdd, onMediaMove, onMediaReorder, onGenerateAICaptions, aiCaptionBusy, aiCaptioningIds, aiCaptionMessage, onPostEdit, onPostRemove, onPostMove, onOrderModeChange }: Props) {
  const [bulkText, setBulkText] = useState('')
  const mediaInput = useRef<HTMLInputElement>(null)
  const mediaList = useRef<HTMLDivElement>(null)
  const mediaCards = useRef(new Map<string, HTMLElement>())
  const previousMediaRects = useRef(new Map<string, DOMRect>())
  const dragState = useRef<{ id: string; pointerId: number; startX: number; startY: number; moved: boolean; lastOverId: string | null } | null>(null)
  const onMediaReorderRef = useRef(onMediaReorder)
  const [draggingMediaId, setDraggingMediaId] = useState<string | null>(null)
  const [dragOverMediaId, setDragOverMediaId] = useState<string | null>(null)
  const parsed = parseTextPosts(bulkText)
  const textPosts = campaign.posts.filter((post) => post.contentType === 'TEXT')
  const mediaPosts = campaign.posts.filter((post) => post.contentType !== 'TEXT')
  const emptyImagePosts = mediaPosts.filter((post) => post.contentType === 'IMAGE' && !post.caption.trim())
  const mediaOrderKey = mediaPosts.map((post) => post.id).join('|')

  useEffect(() => {
    onMediaReorderRef.current = onMediaReorder
  }, [onMediaReorder])

  useLayoutEffect(() => {
    const nextRects = new Map<string, DOMRect>()
    mediaCards.current.forEach((node, id) => {
      nextRects.set(id, node.getBoundingClientRect())
    })

    const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reducedMotion) {
      nextRects.forEach((nextRect, id) => {
        const previousRect = previousMediaRects.current.get(id)
        const node = mediaCards.current.get(id)
        if (!previousRect || !node || dragState.current?.id === id) return
        const deltaX = previousRect.left - nextRect.left
        const deltaY = previousRect.top - nextRect.top
        if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return
        if (typeof node.getAnimations === 'function') node.getAnimations().forEach((animation) => animation.cancel())
        if (typeof node.animate !== 'function') return
        node.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: 'translate(0, 0)' },
          ],
          { duration: 130, easing: 'cubic-bezier(.2,.8,.2,1)' },
        )
      })
    }

    previousMediaRects.current = nextRects
  }, [mediaOrderKey])

  const beginMediaDrag = (event: ReactPointerEvent<HTMLElement>, id: string) => {
    if (running || aiCaptionBusy || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault()
    dragState.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      lastOverId: null,
    }
    setDraggingMediaId(null)
    setDragOverMediaId(null)
  }

  useEffect(() => {
    const clearDrag = () => {
      dragState.current = null
      setDraggingMediaId(null)
      setDragOverMediaId(null)
    }

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragState.current
      if (!drag || drag.pointerId !== event.pointerId) return

      if (!drag.moved) {
        const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
        if (distance < 4) return
        drag.moved = true
        setDraggingMediaId(drag.id)
        setDragOverMediaId(drag.id)
      }

      if (event.cancelable) event.preventDefault()

      const list = mediaList.current
      if (list) {
        const bounds = list.getBoundingClientRect()
        const edge = Math.min(72, Math.max(40, bounds.height * 0.15))
        if (typeof list.scrollBy === 'function') {
          if (event.clientY < bounds.top + edge) list.scrollBy({ top: -30, behavior: 'auto' })
          else if (event.clientY > bounds.bottom - edge) list.scrollBy({ top: 30, behavior: 'auto' })
        }
      }

      const hit = typeof document.elementFromPoint === 'function'
        ? document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null
        : null
      const card = hit?.closest<HTMLElement>('[data-media-sort-id]')
      const overId = card?.dataset.mediaSortId || ''
      if (!overId || overId === drag.id || overId === drag.lastOverId) return

      drag.lastOverId = overId
      setDragOverMediaId(overId)
      onMediaReorderRef.current(drag.id, overId)
    }

    const onPointerEnd = (event: PointerEvent) => {
      const drag = dragState.current
      if (!drag || drag.pointerId !== event.pointerId) return
      clearDrag()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') clearDrag()
    }

    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerEnd)
    window.addEventListener('pointercancel', onPointerEnd)
    window.addEventListener('blur', clearDrag)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerEnd)
      window.removeEventListener('pointercancel', onPointerEnd)
      window.removeEventListener('blur', clearDrag)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  const handleMediaKeyboard = (event: ReactKeyboardEvent<HTMLElement>, id: string) => {
    if (running || aiCaptionBusy) return
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      onMediaMove(id, -1)
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      onMediaMove(id, 1)
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (dragState.current) {
        dragState.current = null
        setDraggingMediaId(null)
        setDragOverMediaId(null)
        return
      }
      if (!running) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, running])

  return createPortal(
    <div className="fixed inset-0 z-[110] grid place-items-center overflow-y-auto bg-[#01070d]/90 p-0 backdrop-blur-md sm:p-4" onMouseDown={(event) => { if (event.currentTarget === event.target && !running) onClose() }}>
      <section aria-labelledby="manual-campaign-title" aria-modal="true" className="my-auto flex h-dvh w-full max-w-7xl flex-col overflow-hidden rounded-none border border-brand-cyan/25 bg-panel shadow-[0_38px_150px_rgba(0,0,0,.74)] sm:h-auto sm:max-h-[min(960px,calc(100dvh-2rem))] sm:rounded-[22px]" role="dialog">
        <header className="flex shrink-0 items-start gap-3 border-b border-border-soft bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,.10),transparent_42%),linear-gradient(135deg,rgba(10,30,44,.98),rgba(6,18,29,.98))] p-4 sm:p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><Megaphone className="size-5" /></span>
          <div className="min-w-0 flex-1"><h2 className="text-lg font-semibold" id="manual-campaign-title">Build a campaign manually</h2><p className="mt-1 text-xs text-text-muted">Write text posts on the left, add images or videos on the right, then choose their publishing order below.</p></div>
          <button aria-label="Close campaign editor" className="grid size-9 shrink-0 place-items-center rounded-lg text-text-muted hover:bg-white/5 hover:text-white" disabled={running} onClick={onClose} type="button"><X className="size-4" /></button>
        </header>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <label className="block max-w-lg text-xs font-semibold">Campaign name<input className="mt-1.5 min-h-10 w-full rounded-lg border border-border-soft bg-bg/65 px-3 text-sm focus:border-brand-cyan focus:outline-none" disabled={running} maxLength={200} onChange={(event) => onTitleChange(event.target.value)} value={campaign.title} /></label>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="flex min-h-0 flex-col rounded-2xl border border-brand-cyan/20 bg-brand-cyan/[.025] p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><FileText className="size-4 text-brand-cyan" />Text posts</h3><span className="text-xs text-text-muted">{textPosts.length} added</span></div>
              <p className="mt-1 text-[11px] leading-5 text-text-muted">Paste several posts into one box. Leave <strong className="text-text-main">two empty lines</strong> between posts. Single blank lines within a post are kept.</p>
              <label className="mt-3 block text-xs font-semibold">Paste text posts<textarea className="mt-1.5 min-h-32 w-full resize-y rounded-xl border border-border-soft bg-bg/65 p-3 text-sm text-text-main focus:border-brand-cyan focus:outline-none" disabled={running} onChange={(event) => setBulkText(event.target.value)} placeholder={'First post\n\n\nSecond post\n\n\nThird post'} value={bulkText} /></label>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] text-text-muted">{parsed.length} post{parsed.length === 1 ? '' : 's'} detected</span><Button disabled={running || !parsed.length} onClick={() => { onTextAdd(parsed); setBulkText('') }} size="sm" type="button"><FileText className="size-3.5" />Add {parsed.length || ''} text post{parsed.length === 1 ? '' : 's'}</Button></div>
              <div className="scrollbar-thin mt-3 space-y-2 overflow-y-auto lg:max-h-[34vh]">
                {textPosts.map((post) => <label className="block rounded-xl border border-border-soft bg-bg/40 p-2.5 text-[11px] font-semibold" key={post.id}>Text post {post.sequence}<textarea className="mt-1.5 min-h-16 w-full resize-y rounded-lg border border-border-soft bg-bg/65 p-2.5 text-xs text-text-main focus:border-brand-cyan focus:outline-none" disabled={running} onChange={(event) => onPostEdit(post.id, event.target.value)} value={post.caption} /></label>)}
              </div>
            </section>

            <section className="flex min-h-0 flex-col rounded-2xl border border-brand-purple/20 bg-brand-purple/[.025] p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><Images className="size-4 text-[#c4b5fd]" />Image and video posts</h3><span className="text-xs text-text-muted">{mediaPosts.length} added</span></div>
              <p className="mt-1 text-[11px] leading-5 text-text-muted">Select multiple files at once. Each file gets its own caption field. Drag a media preview to rearrange it, or use the arrow buttons.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button disabled={running || aiCaptionBusy} onClick={() => mediaInput.current?.click()} size="sm" type="button"><Images className="size-3.5" />Add images or videos</Button>
                <Button disabled={running || aiCaptionBusy || !emptyImagePosts.length} onClick={onGenerateAICaptions} size="sm" type="button" variant="primary">
                  {aiCaptionBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  {aiCaptionBusy ? 'Generating captions…' : `AI captions · ${emptyImagePosts.length} empty`}
                </Button>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-text-soft">AI fills only empty image captions and never replaces your existing text. The first 5 AI captions in a manual campaign are free; after that, 5 credits unlock AI captions for the rest of that same campaign, including retries.</p>
              {aiCaptionMessage && <p className={`mt-1.5 text-[10px] leading-4 ${/could not|not enough|unavailable|failed/i.test(aiCaptionMessage) ? 'text-brand-amber' : 'text-brand-cyan'}`}>{aiCaptionMessage}</p>}
              <input accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/x-m4v,video/webm,.avi,.mkv" className="sr-only" multiple onChange={(event) => { onMediaAdd(Array.from(event.target.files || [])); event.target.value = '' }} ref={mediaInput} type="file" />
              <div className="scrollbar-thin mt-3 space-y-2 overflow-y-auto overscroll-contain lg:max-h-[51vh]" ref={mediaList}>
                {mediaPosts.map((post, mediaIndex) => {
                  const dragging = draggingMediaId === post.id
                  const dragTarget = dragOverMediaId === post.id && draggingMediaId !== post.id
                  return <article
                    className={`relative flex gap-3 rounded-xl border bg-bg/40 p-2.5 transition-[border-color,background-color,box-shadow,opacity] duration-100 ${dragging ? 'z-10 border-brand-cyan/65 bg-brand-cyan/[.08] opacity-75 shadow-[0_12px_32px_rgba(45,212,191,.12)]' : dragTarget ? 'border-brand-cyan/55 bg-brand-cyan/[.055]' : 'border-border-soft'}`}
                    data-media-sort-id={post.id}
                    key={post.id}
                    ref={(node) => {
                      if (node) mediaCards.current.set(post.id, node)
                      else mediaCards.current.delete(post.id)
                    }}
                  >
                    <div
                      aria-grabbed={dragging}
                      aria-label={`Drag ${post.fileName || `media ${mediaIndex + 1}`} to reorder`}
                      className={`group relative size-16 shrink-0 touch-none select-none overflow-hidden rounded-lg border transition duration-150 focus:outline-none focus:ring-2 focus:ring-brand-cyan/45 ${running || aiCaptionBusy ? 'cursor-not-allowed border-border-soft opacity-60' : 'cursor-grab border-border-soft hover:border-brand-cyan/55 active:cursor-grabbing active:scale-[.97]'}`}
                      onKeyDown={(event) => handleMediaKeyboard(event, post.id)}
                      onPointerDown={(event) => beginMediaDrag(event, post.id)}
                      role="button"
                      tabIndex={running || aiCaptionBusy ? -1 : 0}
                    >
                      {post.contentType === 'IMAGE' && post.thumbnailUrl
                        ? <img alt="" className="size-full object-cover" draggable={false} src={post.thumbnailUrl} />
                        : <span className="grid size-full place-items-center bg-brand-purple/10 text-[#c4b5fd]"><Video className="size-5" /></span>}
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/60 py-1 text-[8px] font-semibold text-white/90 opacity-90 backdrop-blur-sm transition group-hover:bg-black/75"><GripVertical className="size-3" />Drag</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                        {post.contentType === 'IMAGE' ? <ImageIcon className="size-3.5 shrink-0" /> : <Video className="size-3.5 shrink-0" />}
                        <span className="min-w-0 flex-1 truncate">{post.fileName}</span>
                        <span className="shrink-0 rounded-md border border-border-soft bg-black/10 px-1.5 py-0.5 text-[8px] font-bold tabular-nums text-text-soft">{String(mediaIndex + 1).padStart(2, '0')}</span>
                        <button aria-label={`Move ${post.fileName || `media ${mediaIndex + 1}`} up in media order`} className="grid size-7 shrink-0 place-items-center rounded-md border border-border-soft text-text-muted transition duration-150 hover:-translate-y-0.5 hover:border-brand-cyan/40 hover:bg-brand-cyan/[.07] hover:text-brand-cyan active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-30" disabled={running || aiCaptionBusy || mediaIndex === 0} onClick={() => onMediaMove(post.id, -1)} type="button"><ArrowUp className="size-3.5" /></button>
                        <button aria-label={`Move ${post.fileName || `media ${mediaIndex + 1}`} down in media order`} className="grid size-7 shrink-0 place-items-center rounded-md border border-border-soft text-text-muted transition duration-150 hover:translate-y-0.5 hover:border-brand-cyan/40 hover:bg-brand-cyan/[.07] hover:text-brand-cyan active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-30" disabled={running || aiCaptionBusy || mediaIndex === mediaPosts.length - 1} onClick={() => onMediaMove(post.id, 1)} type="button"><ArrowDown className="size-3.5" /></button>
                      </div>
                      <label className="mt-1 block text-[10px] text-text-muted">Caption for this {post.contentType.toLowerCase()}<textarea className="mt-1 min-h-16 w-full resize-y rounded-lg border border-border-soft bg-bg/65 p-2 text-xs text-text-main focus:border-brand-cyan focus:outline-none" disabled={running || aiCaptioningIds.has(post.id)} onChange={(event) => onPostEdit(post.id, event.target.value)} placeholder={aiCaptioningIds.has(post.id) ? 'AI is analysing this image and writing a caption…' : 'Write a caption for this post…'} value={post.caption} /></label>
                    </div>
                  </article>
                })}
              </div>
            </section>
          </div>

          <section className="mt-4 rounded-2xl border border-border-soft bg-bg/30 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Publishing order · {campaign.total} posts</h3><p className="mt-1 text-[11px] text-text-muted">The selected posting times apply to these posts from first to last.</p></div></div>
            <fieldset className="mt-3 flex flex-wrap gap-2 text-xs"><legend className="mb-2 font-semibold">Choose the sequence</legend>{([
              ['custom', 'As arranged'], ['alternate_text', 'Alternate · text first'], ['alternate_media', 'Alternate · media first'],
            ] as const).map(([mode, label]) => <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${campaign.orderMode === mode ? 'border-brand-cyan/55 bg-brand-cyan/10 text-brand-cyan' : 'border-border-soft text-text-muted'}`} key={mode}><input checked={campaign.orderMode === mode} className="accent-brand-cyan" disabled={running} name="campaign-order" onChange={() => onOrderModeChange(mode)} type="radio" value={mode} />{label}</label>)}</fieldset>
            <p className="mt-2 text-[11px] leading-5 text-text-muted">With two daily times, alternating places one text and one media post each day while both types remain. Extra posts of either type continue at the remaining times.</p>
            {campaign.posts.length ? <ol className="scrollbar-thin mt-3 grid max-h-44 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{campaign.posts.map((post, index) => <li className="flex min-w-0 items-center gap-2 rounded-lg border border-border-soft bg-bg/45 p-2" key={post.id}><strong className="text-[11px] text-brand-cyan">{String(index + 1).padStart(2, '0')}</strong>{post.contentType === 'TEXT' ? <FileText className="size-3.5 shrink-0 text-brand-cyan" /> : post.contentType === 'IMAGE' ? <ImageIcon className="size-3.5 shrink-0 text-[#c4b5fd]" /> : <Video className="size-3.5 shrink-0 text-[#c4b5fd]" />}<span className="min-w-0 flex-1 truncate text-[11px]">{post.contentType === 'TEXT' ? post.caption || 'Empty text post' : post.fileName || 'Media post'}</span><button aria-label={`Move post ${index + 1} up`} className="rounded p-1 text-text-muted hover:text-brand-cyan disabled:opacity-30" disabled={running || campaign.orderMode !== 'custom' || index === 0} onClick={() => onPostMove(post.id, -1)} type="button"><ArrowUp className="size-3.5" /></button><button aria-label={`Move post ${index + 1} down`} className="rounded p-1 text-text-muted hover:text-brand-cyan disabled:opacity-30" disabled={running || campaign.orderMode !== 'custom' || index === campaign.posts.length - 1} onClick={() => onPostMove(post.id, 1)} type="button"><ArrowDown className="size-3.5" /></button><button aria-label={`Remove post ${index + 1}`} className="rounded p-1 text-text-muted hover:text-brand-red disabled:opacity-30" disabled={running} onClick={() => onPostRemove(post.id)} type="button"><Trash2 className="size-3.5" /></button></li>)}</ol> : <p className="mt-3 rounded-xl border border-dashed border-border-soft p-4 text-center text-xs text-text-muted">Add text or media to build your campaign.</p>}
          </section>
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border-soft bg-panel px-4 py-3 sm:px-5"><span className="text-xs text-text-muted">{campaign.textPosts} text · {campaign.imagePosts} media · {campaign.total} total</span><Button disabled={running} onClick={onClose} type="button" variant="primary">Use this campaign</Button></footer>
      </section>
    </div>, document.body)
}
