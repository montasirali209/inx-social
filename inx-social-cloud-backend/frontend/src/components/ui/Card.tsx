import type { HTMLAttributes, ReactNode } from 'react'

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <section
      className={`rounded-card border border-border-subtle bg-bg-panel p-5 shadow-panel sm:p-6 ${className}`}
      {...props}
    >
      {children}
    </section>
  )
}
