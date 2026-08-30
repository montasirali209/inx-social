import { Heart, MessageCircle, MoreHorizontal, Send, Share2 } from 'lucide-react'
import { platforms } from '../../data/postsData'
import type { ConnectedPage } from '../../types/dashboard'
import type { MediaItem, Platform } from '../../types/posts'
import { PanelHeading, PlatformIcon } from './PostPrimitives'

type Props = { caption: string; media: MediaItem | null; selectedPage: ConnectedPage | null }

export function PostPreviewPanel({ caption, media, selectedPage }: Props) {
  const active: Platform = 'facebook'
  return (
    <section className="interactive-surface rounded-panel border p-4 xl:p-5">
      <PanelHeading step={4} subtitle="See how your post will appear before publishing." title="Post Preview" />
      <div className="scrollbar-thin flex gap-2 overflow-x-auto border-b border-border-soft pb-2">{platforms.map((platform) => <button className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] transition focus-visible:outline-2 focus-visible:outline-brand-cyan ${platform.id === active ? 'bg-brand-cyan/10 text-brand-cyan' : 'text-text-soft opacity-55'}`} disabled={platform.id !== active} key={platform.id} type="button"><PlatformIcon className="size-4 rounded text-[8px]" platform={platform.id} />{platform.label}</button>)}</div>
      <article className="mt-3 overflow-hidden rounded-xl border border-border-soft bg-bg/45">
        <header className="flex items-center gap-3 p-3"><img alt="" className="size-10 rounded-full border border-brand-cyan/20 object-cover" src={selectedPage?.facebookPagePicture || '/assets/inx-social-mark.png'} /><div className="min-w-0 flex-1"><strong className="block truncate text-xs">{selectedPage?.facebookPageName || 'Choose a destination'}</strong><span className="text-[9px] text-text-soft">Just now · Public</span></div><MoreHorizontal className="size-4 text-text-muted" /></header>
        <p className="whitespace-pre-wrap px-3 pb-3 text-xs leading-5 text-text-main">{caption || 'Your caption preview will appear here as you type.'}</p>
        {media ? <div className="aspect-video max-h-72 bg-black/35">{media.type === 'image' ? <img alt="Post preview media" className="h-full w-full object-cover" src={media.url} /> : <video aria-label="Post preview video" className="h-full w-full object-cover" muted src={media.url} />}</div> : <div className="grid aspect-video max-h-56 place-items-center border-y border-border-soft bg-gradient-to-br from-brand-cyan/[0.06] to-bg/60"><span className="text-center text-[10px] text-text-soft"><PlatformIcon className="mx-auto mb-2 size-8" platform="facebook" />Media preview</span></div>}
        <div className="flex items-center justify-between border-b border-border-soft px-3 py-2 text-[10px] text-text-muted"><span className="flex items-center gap-1"><Heart className="size-3 fill-brand-red text-brand-red" /> Preview</span><span>Comments · Shares</span></div>
        <div className="grid grid-cols-3 p-1">{[[Heart, 'Like'], [MessageCircle, 'Comment'], [Share2, 'Share']].map(([Icon, label]) => <button className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] text-text-muted transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" key={label as string} type="button"><Icon className="size-3.5" />{label as string}</button>)}</div>
      </article>
      <p className="mt-3 flex items-center gap-2 rounded-lg border border-border-soft bg-bg/25 p-2 text-[9px] text-text-soft"><Send className="size-3" />Preview may vary slightly when published by the platform.</p>
    </section>
  )
}
