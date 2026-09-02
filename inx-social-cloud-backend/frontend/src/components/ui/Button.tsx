import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: ButtonVariant
  size?: 'sm' | 'md'
}

const variants: Record<ButtonVariant, string> = {
  primary: 'border-accent-blue bg-accent-blue text-white shadow-[0_12px_30px_rgba(20,184,166,.22)] hover:border-accent-blue-hover hover:bg-accent-blue-hover active:translate-y-px',
  secondary: 'border-border-strong bg-bg-panel-alt text-text-primary hover:border-accent-blue/60 hover:bg-bg-elevated active:translate-y-px',
  ghost: 'border-transparent bg-transparent text-text-secondary hover:bg-bg-elevated hover:text-text-primary active:translate-y-px',
}

export function Button({ children, className = '', variant = 'secondary', size = 'md', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-control border font-semibold transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none ${size === 'sm' ? 'min-h-9 px-3 py-1.5 text-xs' : 'min-h-10 px-4 py-2 text-sm'} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
