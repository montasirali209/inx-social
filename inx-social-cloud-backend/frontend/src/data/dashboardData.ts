import type { Platform } from '../types/dashboard'

export const platformPresentation: Record<Platform, {
  label: string
  shortLabel: string
  colour: string
  className: string
}> = {
  facebook: { label: 'Facebook', shortLabel: 'f', colour: '#1877f2', className: 'bg-[#1877f2] text-white' },
  instagram: { label: 'Instagram', shortLabel: '◎', colour: '#d9468f', className: 'bg-gradient-to-br from-[#f59e0b] via-[#ec4899] to-[#7c3aed] text-white' },
  linkedin: { label: 'LinkedIn', shortLabel: 'in', colour: '#0a66c2', className: 'bg-[#0a66c2] text-white' },
  youtube: { label: 'YouTube', shortLabel: '▶', colour: '#ff0033', className: 'bg-[#ff0033] text-white' },
  tiktok: { label: 'TikTok', shortLabel: '♪', colour: '#111827', className: 'border border-white/15 bg-black text-white' },
  x: { label: 'X (Twitter)', shortLabel: '𝕏', colour: '#374151', className: 'border border-white/15 bg-black text-white' },
}

export const platformOrder: Platform[] = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'x']

