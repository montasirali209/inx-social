import type { Platform } from '../../types/bulk-scheduler'

const platformStyles: Record<Platform, { label: string; mark: string; className: string }> = {
  facebook: { label: 'Facebook', mark: 'f', className: 'bg-[#1877f2] text-white' },
  instagram: { label: 'Instagram', mark: '◎', className: 'bg-[linear-gradient(135deg,#7c3aed,#ec4899,#f59e0b)] text-white' },
  linkedin: { label: 'LinkedIn', mark: 'in', className: 'bg-[#0a66c2] text-white' },
  tiktok: { label: 'TikTok', mark: '♪', className: 'bg-black text-white ring-1 ring-white/15' },
  youtube: { label: 'YouTube', mark: '▶', className: 'bg-[#ff0033] text-white' },
  x: { label: 'X', mark: 'X', className: 'bg-black text-white ring-1 ring-white/20' },
}

type PlatformMarkSize = 'xs' | 'sm' | 'md'

const sizeStyles: Record<PlatformMarkSize, string> = {
  xs: 'size-5 text-[8px]',
  sm: 'size-6 text-[9px]',
  md: 'size-8 text-[11px]',
}

export function PlatformMark({ platform, size = 'md', className = '' }: { platform: Platform; size?: PlatformMarkSize; className?: string }) {
  const definition = platformStyles[platform]
  return (
    <span
      aria-label={definition.label}
      className={`inline-grid shrink-0 place-items-center rounded-full font-black tracking-[-0.04em] shadow-[0_6px_18px_rgba(0,0,0,0.28)] ${sizeStyles[size]} ${definition.className} ${className}`}
      role="img"
    >
      {definition.mark}
    </span>
  )
}
