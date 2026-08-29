import type { Platform } from '../../types/bulk-scheduler'

const names: Record<Platform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X',
}

export function platformName(platform: Platform) {
  return names[platform]
}
