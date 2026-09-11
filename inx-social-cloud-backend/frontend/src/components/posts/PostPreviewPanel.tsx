import { Heart, Image as ImageIcon, Images, MessageCircle, MoreHorizontal, Send, Share2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { platforms } from '../../data/postsData'
import type { ConnectedPage } from '../../types/dashboard'
import type { MediaAsset } from '../../types/media-library'
import type { MediaItem, Platform } from '../../types/posts'
import { PanelHeading, PlatformIcon } from './PostPrimitives'

type Props = {
  caption: string
  media: MediaItem | null
  selectedPage: ConnectedPage | null
  carouselAssets?: MediaAsset[]
}

function PreviewAvatar({ page }: { page: ConnectedPage | null }) {
  const [failedPicture, setFailedPicture] = useState<string | null>(null)
  const picture = page?.facebookPagePicture || ''
  const initial = page?.facebookPageName?.trim().slice(0, 1).toUpperCase() || ''
  const showPicture = Boolean(picture && failedPicture !== picture)

  return (
    <span className="grid size-11 shrink-0 place-items-center">
      {showPicture ? (
        <img alt="" className="size-10 rounded-full border border-border-strong bg-panel object-cover shadow-[0_5px_16px_rgba(0,0,0,.22)]" onError={() => setFailedPicture(picture)} src={picture} />
      ) : (
        <span className="grid size-10 place-items-center rounded-full border border-border-strong bg-[linear-gradient(145deg,rgba(18,48,63,.95),rgba(7,25,35,.98))] text-sm font-bold text-text-main shadow-[0_5px_16px_rgba(0,0,0,.2)]">
          {initial || <UserRound aria-hidden="true" className="size-4 text-text-soft" />}
        </span>
      )}
    </span>
  )
}

export function PostPreviewPanel({ caption, media, selectedPage, carouselAssets = [] }: Props) {
  const active: Platform = 'facebook'
  const isCarousel = carouselAssets.length > 0
  return (
    <section className="interactive-surface rounded-panel border p-4 xl:p-5">
      <PanelHeading step={4} subtitle={isCarousel ? 'See the carousel slide sequence before publishing.' : 'See how your post will appear before publishing.'} title="Post Preview" />
      <div className="scrollbar-thin flex gap-1.5 overflow-x-auto border-b border-border-soft pb-2">
        {platforms.map((platform) => (
          <button className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium transition focus-visible:outline-2 focus-visible:outline-brand-cyan ${platform.id === active ? 'bg-brand-cyan/10 text-brand-cyan' : 'text-text-soft opacity-55'}`} disabled={platform.id !== active} key={platform.id} type="button">
            <PlatformIcon className="size-[18px] rounded-md shadow-none" platform={platform.id} />
            {platform.label}
          </button>
        ))}
      </div>
      <article className="mt-3 w-full overflow-hidden rounded-xl border border-border-soft bg-bg/45 shadow-[0_10px_28px_rgba(0,0,0,.12)]">
        <header className="flex items-center gap-3 p-3">
          <PreviewAvatar page={selectedPage} />
          <div className="min-w-0 flex-1"><strong className="block truncate text-xs">{selectedPage?.facebookPageName || 'Choose a destination'}</strong><span className="text-[9px] text-text-soft">Just now · Public</span></div>
          <MoreHorizontal className="size-4 text-text-muted" />
        </header>
        <p className="whitespace-pre-wrap px-3 pb-3 text-xs leading-5 text-text-main">{caption || 'Your caption preview will appear here as you type.'}</p>
        {isCarousel ? (
          <div className="relative h-56 w-full overflow-hidden border-y border-border-soft bg-black/35">
            <div className="scrollbar-thin flex h-full snap-x snap-mandatory overflow-x-auto">
              {carouselAssets.map((asset, index) => (
                <div className="relative h-full min-w-full snap-center" key={asset.id}>
                  <img alt={`Carousel preview slide ${index + 1}`} className="h-full w-full object-cover" src={asset.thumbnailUrl || asset.fileUrl} />
                  <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[9px] font-semibold text-white">{index + 1}/{carouselAssets.length}</span>
                </div>
              ))}
            </div>
          </div>
        ) : media ? (
          <div className="h-56 w-full overflow-hidden bg-black/35">{media.type === 'image' ? <img alt="Post preview media" className="h-full w-full object-cover" src={media.url} /> : <video aria-label="Post preview video" className="h-full w-full object-cover" muted src={media.url} />}</div>
        ) : (
          <div className="grid h-56 w-full place-items-center border-y border-border-soft bg-[radial-gradient(circle_at_50%_45%,rgba(20,184,166,.09),transparent_34%),linear-gradient(145deg,rgba(12,37,50,.74),rgba(4,18,27,.82))]">
            <div className="flex flex-col items-center gap-2 text-center text-[10px] text-text-soft">
              <span className="grid size-10 place-items-center rounded-xl border border-brand-cyan/15 bg-brand-cyan/[0.06] text-brand-cyan shadow-[0_8px_22px_rgba(0,0,0,.16)]">
                {isCarousel ? <Images aria-hidden="true" className="size-[18px]" /> : <ImageIcon aria-hidden="true" className="size-[18px]" />}
              </span>
              <span className="font-medium text-text-muted">Media preview</span>
            </div>
          </div>
        )}
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border-soft px-3 py-2 text-[10px] text-text-muted"><span className="flex min-w-0 items-center gap-1"><Heart className="size-3 shrink-0 fill-brand-red text-brand-red" /> <span className="truncate">Preview</span></span><span className="shrink-0">Comments · Shares</span></div>
        <div className="grid grid-cols-3 p-1">{[[Heart, 'Like'], [MessageCircle, 'Comment'], [Share2, 'Share']].map(([Icon, label]) => <button className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] text-text-muted transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" key={label as string} type="button"><Icon className="size-3.5" />{label as string}</button>)}</div>
      </article>
      <p className="mt-3 flex items-center gap-2 rounded-lg border border-border-soft bg-bg/25 p-2 text-[9px] text-text-soft"><Send className="size-3" />Preview may vary slightly when published by the platform.</p>
    </section>
  )
}
