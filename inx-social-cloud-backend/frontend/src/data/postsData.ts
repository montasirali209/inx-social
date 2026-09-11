import type { Platform, PostType } from '../types/posts'

export const platforms: Array<{ id: Platform; label: string }> = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'x', label: 'X' },
]

export const postTypes: Array<{ id: PostType; label: string; available: boolean }> = [
  { id: 'text', label: 'Text / Media Post', available: true },
  { id: 'carousel', label: 'Carousel Post', available: true },
]

export const campaigns = ['No campaign', 'Always-on content', 'Product launch', 'Community growth']

export function contentScore(caption: string, hasMedia: boolean, destinationCount: number) {
  let score = 20
  if (caption.trim().length >= 40) score += 25
  if (caption.trim().length >= 100) score += 15
  if (/#\w+/.test(caption)) score += 10
  if (/\?|comment|share|learn|discover/i.test(caption)) score += 10
  if (hasMedia) score += 10
  if (destinationCount) score += 10
  return Math.min(100, score)
}
