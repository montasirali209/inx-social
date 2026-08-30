import type { MediaSource, MediaStatus, MediaTabId, Platform, PlatformReadiness, MediaAsset } from '../types/media-library'

export type MediaFilters = {
  type: 'all' | 'image' | 'video' | 'gif'
  platformSize: 'all' | 'square' | 'portrait' | 'landscape' | 'unknown'
  source: 'all' | MediaSource
  status: 'all' | MediaStatus
  dateAdded: 'all' | '7' | '30' | '90'
}

export const emptyMediaFilters: MediaFilters = { type: 'all', platformSize: 'all', source: 'all', status: 'all', dateAdded: 'all' }

export const mediaTabs: Array<{ id: MediaTabId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'videos', label: 'Videos' },
  { id: 'images', label: 'Images' },
  { id: 'ai_generated', label: 'AI Generated' },
  { id: 'brand_assets', label: 'Brand Assets' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'published', label: 'Published' },
  { id: 'unused', label: 'Unused' },
]

export const systemFolders = [
  { id: 'all', label: 'All Files' },
  { id: 'brand_assets', label: 'Brand Assets' },
  { id: 'ai_generated', label: 'AI Generated' },
  { id: 'uploaded', label: 'Uploaded Media' },
  { id: 'scheduled', label: 'Scheduled Content' },
  { id: 'published', label: 'Published Content' },
]

const platforms: Platform[] = ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'x']

export function platformReadiness(asset: MediaAsset): PlatformReadiness[] {
  const portrait = Boolean(asset.width && asset.height && asset.height > asset.width)
  const squareOrPortrait = Boolean(asset.width && asset.height && asset.height >= asset.width)
  return platforms.map((platform) => {
    if (!asset.contentAvailable) return { platform, status: 'wrong_format', message: 'Content unavailable' }
    if (asset.type === 'video' && asset.duration && ['instagram', 'tiktok'].includes(platform) && asset.duration > 90) return { platform, status: 'too_long', message: 'Too long' }
    if (platform === 'instagram' && asset.width && asset.height && !squareOrPortrait) return { platform, status: 'needs_resize', message: 'Needs resize' }
    if (platform === 'tiktok' && asset.width && asset.height && !portrait) return { platform, status: 'needs_resize', message: 'Needs 9:16' }
    return { platform, status: 'ready', message: 'Ready' }
  })
}

export function matchesTab(asset: MediaAsset, tab: MediaTabId) {
  if (tab === 'all') return true
  if (tab === 'videos') return asset.type === 'video'
  if (tab === 'images') return asset.type === 'image' || asset.type === 'gif' || asset.type === 'thumbnail'
  if (tab === 'ai_generated') return asset.source === 'ai_generated'
  if (tab === 'brand_assets') return asset.collection === 'brand_assets'
  return asset.status === tab
}
