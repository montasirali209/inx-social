import type { Platform } from '../../types/dashboard'
import { SocialPlatformIcon } from '../ui/SocialPlatformIcon'

export function PlatformIcon({ platform, className = '' }: { platform: Platform; className?: string }) {
  return <SocialPlatformIcon className={className} platform={platform} />
}
