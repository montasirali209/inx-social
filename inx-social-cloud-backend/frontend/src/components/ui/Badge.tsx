import type { ReactNode } from 'react'

type BadgeTone = 'neutral' | 'success' | 'warning'

const tones: Record<BadgeTone, string> = {
  neutral: 'border-border-strong bg-bg-elevated text-text-secondary',
  success: 'border-accent-green/25 bg-accent-green/10 text-accent-green',
  warning: 'border-accent-orange/25 bg-accent-orange/10 text-accent-orange',
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex min-h-6 items-center rounded-full border px-2.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  )
}
