import type { AIDraft, AIContentType, AIPlanAccess } from '../../types/ai-content-studio'
import { GenerationModal } from './GenerationModal'
import { ImagePostChatModal } from './ImagePostChatModal'
import { CarouselChatModal } from './CarouselChatModal'
import { VideoStudioModal } from './VideoStudioModal'

export function GenerationModalRouter(props: {
  open: boolean
  type: AIContentType | null
  access: AIPlanAccess
  initialDraft?: AIDraft | null
  onClose: () => void
  onSaved: (draft: AIDraft) => void
  onContinue: (draft: AIDraft) => void
  onToast: (message: string) => void
}) {
  const contentType = props.initialDraft?.contentType || props.type
  if (contentType === 'image_post') return <ImagePostChatModal {...props} />
  if (contentType === 'carousel_post') return <CarouselChatModal {...props} />
  if (contentType === 'short_video') return <VideoStudioModal {...props} />
  return <GenerationModal {...props} />
}
