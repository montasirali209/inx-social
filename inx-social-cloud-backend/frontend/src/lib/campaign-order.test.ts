import { describe, expect, it } from 'vitest'
import { orderCampaignPosts } from './campaign-order'

const posts = [
  { id: 'image-1', contentType: 'IMAGE' as const },
  { id: 'video-2', contentType: 'VIDEO' as const },
  { id: 'text-1', contentType: 'TEXT' as const },
  { id: 'text-2', contentType: 'TEXT' as const },
  { id: 'image-3', contentType: 'IMAGE' as const },
]

describe('manual campaign publishing order', () => {
  it('keeps the chosen sequence when alternating is off', () => {
    expect(orderCampaignPosts(posts, 'custom').map((post) => post.id)).toEqual(posts.map((post) => post.id))
  })

  it('pairs text with image or video at successive schedule slots and retains every remaining post', () => {
    expect(orderCampaignPosts(posts, 'alternate_text').map((post) => post.id)).toEqual(['text-1', 'image-1', 'text-2', 'video-2', 'image-3'])
    expect(orderCampaignPosts(posts, 'alternate_media').map((post) => post.id)).toEqual(['image-1', 'text-1', 'video-2', 'text-2', 'image-3'])
  })
})
