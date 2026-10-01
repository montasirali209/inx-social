import { describe, expect, it } from 'vitest'
import { moveCampaignMediaPost, reorderCampaignMediaPost } from './manual-campaign-media-order'

const posts = [
  { id: 'text-1', contentType: 'TEXT' as const },
  { id: 'image-1', contentType: 'IMAGE' as const },
  { id: 'text-2', contentType: 'TEXT' as const },
  { id: 'video-1', contentType: 'VIDEO' as const },
  { id: 'image-2', contentType: 'IMAGE' as const },
]

describe('manual campaign media ordering', () => {
  it('moves media up and down without moving text post slots', () => {
    expect(moveCampaignMediaPost(posts, 'image-2', -1).map((post) => post.id)).toEqual([
      'text-1', 'image-1', 'text-2', 'image-2', 'video-1',
    ])
    expect(moveCampaignMediaPost(posts, 'image-1', 1).map((post) => post.id)).toEqual([
      'text-1', 'video-1', 'text-2', 'image-1', 'image-2',
    ])
  })

  it('drag-reorders media while preserving all text positions', () => {
    expect(reorderCampaignMediaPost(posts, 'image-2', 'image-1').map((post) => post.id)).toEqual([
      'text-1', 'image-2', 'text-2', 'image-1', 'video-1',
    ])
  })

  it('does nothing for invalid or identical drag targets', () => {
    expect(reorderCampaignMediaPost(posts, 'image-1', 'image-1')).toBe(posts)
    expect(moveCampaignMediaPost(posts, 'image-1', -1)).toBe(posts)
  })
})
