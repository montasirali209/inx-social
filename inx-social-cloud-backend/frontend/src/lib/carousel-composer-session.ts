import type { MediaAsset } from '../types/media-library'
import type { ScheduleMode } from '../types/posts'

export const CAROUSEL_SESSION_KEY = 'inx-social-carousel-composer-session-v2'

export type CarouselComposerSession = {
  title: string
  caption: string
  captionIdea: string
  assets: MediaAsset[]
  slideLinks: Record<string, string>
  selectedIds: string[]
  mode: ScheduleMode
  date: string
  time: string
  campaign: string
  labels: string
  updatedAt: string
}

export function readCarouselSession(): CarouselComposerSession | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CAROUSEL_SESSION_KEY) || 'null') as Partial<CarouselComposerSession> | null
    if (!parsed || !Array.isArray(parsed.assets)) return null
    return {
      title: typeof parsed.title === 'string' ? parsed.title : '',
      caption: typeof parsed.caption === 'string' ? parsed.caption : '',
      captionIdea: typeof parsed.captionIdea === 'string' ? parsed.captionIdea : '',
      assets: parsed.assets.filter((asset): asset is MediaAsset => Boolean(asset?.id)).slice(0, 10),
      slideLinks: parsed.slideLinks && typeof parsed.slideLinks === 'object' ? parsed.slideLinks : {},
      selectedIds: Array.isArray(parsed.selectedIds) ? parsed.selectedIds.filter((id): id is string => typeof id === 'string') : [],
      mode: parsed.mode === 'now' || parsed.mode === 'draft' ? parsed.mode : 'later',
      date: typeof parsed.date === 'string' ? parsed.date : '',
      time: typeof parsed.time === 'string' ? parsed.time : '19:30',
      campaign: typeof parsed.campaign === 'string' ? parsed.campaign : 'No campaign',
      labels: typeof parsed.labels === 'string' ? parsed.labels : 'Carousel',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function saveCarouselSession(session: Omit<CarouselComposerSession, 'updatedAt'>) {
  window.localStorage.setItem(CAROUSEL_SESSION_KEY, JSON.stringify({ ...session, updatedAt: new Date().toISOString() }))
}

export function clearCarouselSession() {
  window.localStorage.removeItem(CAROUSEL_SESSION_KEY)
}

export function hasCarouselSession() {
  const session = readCarouselSession()
  return Boolean(session && (session.title.trim() || session.caption.trim() || session.captionIdea.trim() || session.assets.length))
}
