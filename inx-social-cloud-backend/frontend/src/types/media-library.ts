export type MediaType = 'image' | 'video' | 'gif' | 'thumbnail'
export type MediaSource = 'uploaded' | 'ai_generated' | 'imported'
export type MediaCollection = 'uploaded_media' | 'brand_assets' | 'ai_generated' | 'imported'
export type MediaStatus = 'unused' | 'used' | 'scheduled' | 'published' | 'needs_review' | 'archived'
export type Platform = 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube' | 'x'

export type PlatformReadiness = {
  platform: Platform
  status: 'ready' | 'needs_resize' | 'too_long' | 'wrong_format'
  message: string
}

export type MediaAsset = {
  id: string
  fileName: string
  type: MediaType
  source: MediaSource
  collection: MediaCollection
  status: MediaStatus
  thumbnailUrl: string
  fileUrl: string
  width: number | null
  height: number | null
  duration: number | null
  fileSize: number
  createdAt: string
  folder: { id: string; name: string } | null
  tags: string[]
  prompt: string | null
  qualityScore: number | null
  usedIn: Array<{ id: string; title: string; status: string }>
  contentAvailable: boolean
}

export type MediaFolder = { id: string; name: string; count: number }

export type MediaLibraryWorkspace = {
  assets: MediaAsset[]
  folders: MediaFolder[]
  storage: { usedBytes: number; limitBytes: number }
}

export type MediaTabId = 'all' | 'videos' | 'images' | 'ai_generated' | 'brand_assets' | 'scheduled' | 'published' | 'unused'
