import type { Platform } from '../../types/bulk-scheduler'
import { SocialPlatformIcon } from '../ui/SocialPlatformIcon'

type PlatformMarkSize = 'xs' | 'sm' | 'md'

const sizeStyles: Record<PlatformMarkSize, string> = {
  xs: '!size-5',
  sm: '!size-6',
  md: '!size-8',
}

export function PlatformMark({ platform, size = 'md', className = '' }: { platform: Platform; size?: PlatformMarkSize; className?: string }) {
  return <SocialPlatformIcon className={`${sizeStyles[size]} ${className}`} platform={platform} />
}
