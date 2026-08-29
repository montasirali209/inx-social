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
    <section className={`overflow-hidden rounded-panel border border-border-soft bg-panel/78 shadow-panel backdrop-blur-xl ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}
