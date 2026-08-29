import type { ReactNode } from 'react'

export function ChartCard({ title, action, children, className = '' }: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`interactive-surface overflow-hidden rounded-card border backdrop-blur-xl ${className}`}>
      <header className="flex min-h-13 items-center justify-between gap-3 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-[-0.02em] text-text-main">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

