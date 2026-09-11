import { useLocation } from 'react-router-dom'
import type { PostsHandoffState } from '../../types/ai-content-studio'
import { CarouselPostComposerPage } from './CarouselPostComposerPage'
import { PostsPage as StandardPostsPage } from './PostsPage'

export function PostsPage() {
  const location = useLocation()
  const state = location.state as PostsHandoffState | null
  const draft = state?.aiDraft

  if (draft?.contentType === 'carousel_post') {
    return <CarouselPostComposerPage draft={draft} />
  }

  return <StandardPostsPage />
}
