import type { AIDraft, AIContentType, AIPlanAccess } from '../../types/ai-content-studio'
import { GenerationModal } from './GenerationModal'
import { ImagePostChatModal } from './ImagePostChatModal'

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
  if (props.type === 'image_post' || props.initialDraft?.contentType === 'image_post') return <ImagePostChatModal {...props} />
  return <GenerationModal {...props} />
}
