import { useLocation, useNavigate } from 'react-router-dom'
import { hasCarouselSession } from '../../lib/carousel-composer-session'
import type { PostsHandoffState } from '../../types/ai-content-studio'
import type { MediaAsset } from '../../types/media-library'
import type { ScheduleMode } from '../../types/posts'
import { InlineManualCarouselPage } from './InlineManualCarouselPage'
import { PostsPage as StandardPostsPage } from './PostsPage'

type PostsRouteState = Partial<PostsHandoffState> & { manualCarousel?: boolean; mediaLibraryAsset?: MediaAsset; mediaLibraryAssets?: MediaAsset[]; scheduleMode?: ScheduleMode }

const ACTIVE_COMPOSER_KEY = 'inx-social-active-post-composer-v1'

export function PostsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as PostsRouteState | null
  const draft = state?.aiDraft
  const carouselDraft = draft?.contentType === 'carousel_post' ? draft : undefined
  const selectedAssets = state?.mediaLibraryAssets?.filter((asset) => asset.type === 'image').slice(0, 10)
  const explicitStandardHandoff = Boolean(state?.mediaLibraryAsset || draft && draft.contentType !== 'carousel_post')
  const explicitCarouselHandoff = Boolean(carouselDraft || state?.manualCarousel || selectedAssets?.length)
  const savedMode = window.localStorage.getItem(ACTIVE_COMPOSER_KEY)
  const openCarousel = !explicitStandardHandoff && (explicitCarouselHandoff || savedMode === 'carousel' || savedMode === null && hasCarouselSession())

  if (openCarousel) {
    window.localStorage.setItem(ACTIVE_COMPOSER_KEY, 'carousel')
    return <InlineManualCarouselPage initialAssets={selectedAssets} initialDraft={carouselDraft} onStandardPost={() => { window.localStorage.setItem(ACTIVE_COMPOSER_KEY, 'standard'); navigate('/posts', { replace: true, state: { standardComposer: true } }) }} />
  }

  window.localStorage.setItem(ACTIVE_COMPOSER_KEY, 'standard')
  return <StandardPostsPage />
}
