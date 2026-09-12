import type { MediaAsset } from '../types/media-library'
import type { ScheduleMode } from '../types/posts'

// Composer recovery is intentionally in-memory. It survives normal React Router
// navigation and switching between post types, but a browser refresh starts a
// clean composer unless the user explicitly saved a draft.
export const CAROUSEL_SESSION_KEY = 'inx-social-carousel-composer-session-v2'
const LEGACY_ACTIVE_COMPOSER_KEY = 'inx-social-active-post-composer-v1'

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

export type ActivePostComposer = 'standard' | 'carousel'

let carouselSession: CarouselComposerSession | null = null
let activePostComposer: ActivePostComposer | null = null

// Remove persistence created by earlier builds. This migration runs when the
// Posts bundle is loaded after a refresh, preventing stale unsaved content from
// unexpectedly reappearing.
if (typeof window !== 'undefined') {
  window.localStorage.removeItem(CAROUSEL_SESSION_KEY)
  window.localStorage.removeItem(LEGACY_ACTIVE_COMPOSER_KEY)
}

export function readCarouselSession(): CarouselComposerSession | null {
  return carouselSession
}

export function saveCarouselSession(session: Omit<CarouselComposerSession, 'updatedAt'>) {
  carouselSession = { ...session, updatedAt: new Date().toISOString() }
}

export function clearCarouselSession() {
  carouselSession = null
  if (typeof window !== 'undefined') window.localStorage.removeItem(CAROUSEL_SESSION_KEY)
}

export function hasCarouselSession() {
  const session = carouselSession
  return Boolean(session && (session.title.trim() || session.caption.trim() || session.captionIdea.trim() || session.assets.length))
}

export function getActivePostComposer(): ActivePostComposer | null {
  return activePostComposer
}

export function setActivePostComposer(value: ActivePostComposer) {
  activePostComposer = value
}
