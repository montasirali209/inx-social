import { useLocation, useNavigate } from 'react-router-dom'
import type { PostsHandoffState } from '../../types/ai-content-studio'
import { CarouselPostComposerPage } from './CarouselPostComposerPage'
import { InlineManualCarouselPage } from './InlineManualCarouselPage'
import { PostsPage as StandardPostsPage } from './PostsPage'

type PostsRouteState = PostsHandoffState & { manualCarousel?: boolean }

export function PostsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as PostsRouteState | null
  const draft = state?.aiDraft

  if (draft?.contentType === 'carousel_post') {
    return <CarouselPostComposerPage draft={draft} />
  }

  if (state?.manualCarousel) {
    return <InlineManualCarouselPage onStandardPost={() => navigate('/posts', { replace: true, state: null })} />
  }

  return <StandardPostsPage />
}
