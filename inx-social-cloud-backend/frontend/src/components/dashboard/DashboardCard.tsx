import type { ReactNode } from 'react'

export function DashboardCard({
  title,
  action,
  children,
  className = '',
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`interactive-surface overflow-hidden rounded-panel border backdrop-blur-xl ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-border-soft bg-gradient-to-r from-white/[0.025] to-transparent px-4 py-4">
        <h2 className="text-sm font-semibold tracking-[-0.01em]">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}
