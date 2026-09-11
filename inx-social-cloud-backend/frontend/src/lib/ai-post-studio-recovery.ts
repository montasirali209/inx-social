import type { GeneratedAsset } from '../types/ai-content-studio'
import type {
  PostStudioAssistantResponse,
  PostStudioBrief,
  PostStudioMessage,
  PostStudioSourceAnalysis,
} from './ai-post-studio-api'
import { getCurrentAuthUserId } from './auth-session'

const PREFIX = 'inx-social-ai-post-recovery-v1:'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type RecoveryReference = {
  id: string
  fileName: string
}

export type PostStudioRecovery = {
  version: 1
  userId: string
  updatedAt: string
  messages: PostStudioMessage[]
  urls: string[]
  references: RecoveryReference[]
  assistantResult: PostStudioAssistantResponse | null
  sourceAnalysis: PostStudioSourceAnalysis | null
  brief: PostStudioBrief | null
  asset: GeneratedAsset | null
  platform: string
  aspectRatio: PostStudioBrief['aspectRatio']
  lastRenderedKey: string
}

function key(userId = getCurrentAuthUserId()) {
  return userId ? `${PREFIX}${userId}` : ''
}

export function readPostStudioRecovery(): PostStudioRecovery | null {
  const storageKey = key()
  if (!storageKey) return null
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '') as PostStudioRecovery
    if (!parsed || parsed.version !== 1 || parsed.userId !== getCurrentAuthUserId()) return null
    const age = Date.now() - new Date(parsed.updatedAt).getTime()
    if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) {
      window.localStorage.removeItem(storageKey)
      return null
    }
    if (!Array.isArray(parsed.messages) || !parsed.messages.some((message) => message.role === 'user')) return null
    return parsed
  } catch {
    return null
  }
}

export function writePostStudioRecovery(input: Omit<PostStudioRecovery, 'version' | 'userId' | 'updatedAt'>) {
  const userId = getCurrentAuthUserId()
  const storageKey = key(userId)
  if (!storageKey) return
  const value: PostStudioRecovery = {
    version: 1,
    userId,
    updatedAt: new Date().toISOString(),
    ...input,
  }
  try { window.localStorage.setItem(storageKey, JSON.stringify(value)) } catch { /* best-effort recovery */ }
}

export function clearPostStudioRecovery() {
  const storageKey = key()
  if (storageKey) window.localStorage.removeItem(storageKey)
}
