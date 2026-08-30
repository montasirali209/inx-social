import type { Platform, PostType } from '../types/posts'

export const platforms: Array<{ id: Platform; label: string; short: string; colour: string }> = [
  { id: 'facebook', label: 'Facebook', short: 'f', colour: 'bg-[#1877f2]' },
  { id: 'instagram', label: 'Instagram', short: '◎', colour: 'bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]' },
  { id: 'linkedin', label: 'LinkedIn', short: 'in', colour: 'bg-[#0a66c2]' },
  { id: 'tiktok', label: 'TikTok', short: '♪', colour: 'bg-black' },
  { id: 'youtube', label: 'YouTube', short: '▶', colour: 'bg-[#ff0033]' },
  { id: 'x', label: 'X', short: 'X', colour: 'bg-black' },
]

export const postTypes: Array<{ id: PostType; label: string; available: boolean }> = [
  { id: 'text', label: 'Text', available: true },
  { id: 'image', label: 'Image', available: true },
  { id: 'video', label: 'Video / Reel', available: true },
  { id: 'carousel', label: 'Carousel', available: false },
]

export const campaigns = ['No campaign', 'Always-on content', 'Product launch', 'Community growth']

export function improveCaption(value: string, action: 'rewrite' | 'shorten' | 'expand' | 'hashtags' | 'cta') {
  const clean = value.trim().replace(/\s+/g, ' ')
  if (action === 'rewrite') return clean ? `${clean[0].toUpperCase()}${clean.slice(1)}` : ''
  if (action === 'shorten') return clean.length > 240 ? `${clean.slice(0, 237).trimEnd()}…` : clean
  if (action === 'expand') return clean ? `${clean}\n\nHere is what makes this worth your attention—and how you can put it into action today.` : ''
  if (action === 'cta') return clean ? `${clean}\n\nWhat do you think? Share your view below.` : ''
  const tags = [...new Set(clean.toLowerCase().match(/[a-z]{5,}/g) || [])].slice(0, 4)
  return `${clean}${clean ? '\n\n' : ''}${(tags.length ? tags : ['socialmedia', 'content']).map((tag) => `#${tag}`).join(' ')}`
}

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
