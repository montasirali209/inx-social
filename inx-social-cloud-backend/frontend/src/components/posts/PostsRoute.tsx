import { useLocation, useNavigate } from 'react-router-dom'
import { clearCarouselSession, hasCarouselSession } from '../../lib/carousel-composer-session'
import type { PostsHandoffState } from '../../types/ai-content-studio'
import type { MediaAsset } from '../../types/media-library'
import type { ScheduleMode } from '../../types/posts'
import { InlineManualCarouselPage } from './InlineManualCarouselPage'
import { PostsPage as StandardPostsPage } from './PostsPage'

type PostsRouteState = Partial<PostsHandoffState> & { manualCarousel?: boolean; mediaLibraryAsset?: MediaAsset; mediaLibraryAssets?: MediaAsset[]; scheduleMode?: ScheduleMode }

export function PostsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as PostsRouteState | null
  const draft = state?.aiDraft
  const carouselDraft = draft?.contentType === 'carousel_post' ? draft : undefined
  const selectedAssets = state?.mediaLibraryAssets?.filter((asset) => asset.type === 'image').slice(0, 10)
  const explicitStandardHandoff = Boolean(state?.mediaLibraryAsset || draft && draft.contentType !== 'carousel_post')
  const openCarousel = !explicitStandardHandoff && Boolean(carouselDraft || state?.manualCarousel || selectedAssets?.length || hasCarouselSession())

  if (openCarousel) {
    return <InlineManualCarouselPage initialAssets={selectedAssets} initialDraft={carouselDraft} onStandardPost={() => { clearCarouselSession(); navigate('/posts', { replace: true, state: null }) }} />
  }

  return <StandardPostsPage />
}
