export type CampaignMediaOrderItem = {
  id: string
  contentType: 'TEXT' | 'IMAGE' | 'VIDEO'
}

function mediaSlots<T extends CampaignMediaOrderItem>(posts: T[]) {
  return posts.flatMap((post, index) => post.contentType === 'TEXT' ? [] : [index])
}

export function moveCampaignMediaPost<T extends CampaignMediaOrderItem>(posts: T[], id: string, direction: -1 | 1) {
  const slots = mediaSlots(posts)
  const mediaIndex = slots.findIndex((slot) => posts[slot]?.id === id)
  const targetMediaIndex = mediaIndex + direction
  if (mediaIndex < 0 || targetMediaIndex < 0 || targetMediaIndex >= slots.length) return posts

  const next = [...posts]
  const fromSlot = slots[mediaIndex]
  const toSlot = slots[targetMediaIndex]
  ;[next[fromSlot], next[toSlot]] = [next[toSlot], next[fromSlot]]
  return next
}

export function reorderCampaignMediaPost<T extends CampaignMediaOrderItem>(posts: T[], activeId: string, overId: string) {
  if (!activeId || !overId || activeId === overId) return posts

  const slots = mediaSlots(posts)
  const media = slots.map((slot) => posts[slot])
  const activeIndex = media.findIndex((post) => post.id === activeId)
  const overIndex = media.findIndex((post) => post.id === overId)
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) return posts

  const reordered = [...media]
  const [active] = reordered.splice(activeIndex, 1)
  reordered.splice(overIndex, 0, active)

  const next = [...posts]
  slots.forEach((slot, index) => {
    next[slot] = reordered[index]
  })
  return next
}
