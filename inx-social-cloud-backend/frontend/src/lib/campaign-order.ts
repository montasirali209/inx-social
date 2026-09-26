export type CampaignOrderMode = 'custom' | 'alternate_text' | 'alternate_media'

export function orderCampaignPosts<T extends { contentType: 'TEXT' | 'IMAGE' | 'VIDEO' }>(posts: T[], mode: CampaignOrderMode): T[] {
  if (mode === 'custom') return posts
  const text = posts.filter((post) => post.contentType === 'TEXT')
  const media = posts.filter((post) => post.contentType !== 'TEXT')
  const first = mode === 'alternate_text' ? text : media
  const second = mode === 'alternate_text' ? media : text
  const ordered: T[] = []
  for (let index = 0; index < Math.max(first.length, second.length); index += 1) {
    if (first[index]) ordered.push(first[index])
    if (second[index]) ordered.push(second[index])
  }
  return ordered
}
