import { useLocation, useNavigate } from 'react-router-dom'
import { getActivePostComposer, hasCarouselSession, setActivePostComposer } from '../../lib/carousel-composer-session'
import { clearPostComposerFile } from '../../lib/post-composer-file-session'
import type { PostsHandoffState } from '../../types/ai-content-studio'
import type { MediaAsset } from '../../types/media-library'
import type { ScheduleMode } from '../../types/posts'
import { InlineManualCarouselPage } from './InlineManualCarouselPage'
import { PostsPage as StandardPostsPage } from './PostsPage'
import { PostsStatOverlayController } from './PostsStatOverlayController'

const STANDARD_COMPOSER_SESSION_KEY = 'inx-social-post-composer-session-v1'

if (typeof window !== 'undefined') {
  const navigation = window.performance?.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined
  if (navigation?.type === 'reload') {
    window.localStorage.removeItem(STANDARD_COMPOSER_SESSION_KEY)
    void clearPostComposerFile().catch(() => {})
  }
}

type PostsRouteState = Partial<PostsHandoffState> & { manualCarousel?: boolean; standardComposer?: boolean; mediaLibraryAsset?: MediaAsset; mediaLibraryAssets?: MediaAsset[]; scheduleMode?: ScheduleMode }

export function PostsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as PostsRouteState | null
  const draft = state?.aiDraft
  const carouselDraft = draft?.contentType === 'carousel_post' ? draft : undefined
  const selectedAssets = state?.mediaLibraryAssets?.filter((asset) => asset.type === 'image').slice(0, 10)
  const explicitStandardHandoff = Boolean(state?.standardComposer || state?.mediaLibraryAsset || draft && draft.contentType !== 'carousel_post')
  const explicitCarouselHandoff = Boolean(carouselDraft || state?.manualCarousel || selectedAssets?.length)
  const savedMode = getActivePostComposer()
  const openCarousel = !explicitStandardHandoff && (explicitCarouselHandoff || savedMode === 'carousel' || savedMode === null && hasCarouselSession())

  return (
    <>
      <PostsStatOverlayController />
      {openCarousel ? (
        (() => {
          setActivePostComposer('carousel')
          return <InlineManualCarouselPage initialAssets={selectedAssets} initialDraft={carouselDraft} onStandardPost={() => { setActivePostComposer('standard'); navigate('/posts', { replace: true, state: { standardComposer: true } }) }} />
        })()
      ) : (
        (() => {
          setActivePostComposer('standard')
          return <StandardPostsPage />
        })()
      )}
    </>
  )
}
