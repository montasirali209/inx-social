import type { Platform } from '../types/dashboard'

export const platformPresentation: Record<Platform, {
  label: string
  colour: string
}> = {
  facebook: { label: 'Facebook', colour: '#3b7dc8' },
  instagram: { label: 'Instagram', colour: '#d9468f' },
  linkedin: { label: 'LinkedIn', colour: '#0a66c2' },
  youtube: { label: 'YouTube', colour: '#ff0000' },
  tiktok: { label: 'TikTok', colour: '#111827' },
  pinterest: { label: 'Pinterest', colour: '#e60023' },
  x: { label: 'X', colour: '#4fb4df' },
}

export const platformOrder: Platform[] = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'pinterest', 'x']
