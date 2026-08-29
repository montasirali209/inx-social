import type { Platform } from '../../types/dashboard'
import { platformPresentation } from '../../data/dashboardData'

export function PlatformIcon({ platform, className = '' }: { platform: Platform; className?: string }) {
  const presentation = platformPresentation[platform]
  return (
    <span
      aria-label={presentation.label}
      className={`inline-grid size-6 shrink-0 place-items-center rounded-md text-[10px] font-black leading-none shadow-[inset_0_1px_rgba(255,255,255,0.18)] ${presentation.className} ${className}`}
      role="img"
      title={presentation.label}
    >
      {presentation.shortLabel}
    </span>
  )
}

