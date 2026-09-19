'use client'

import Link, { type LinkProps } from 'next/link'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { track } from '@/lib/analytics'

type Props = LinkProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  children: ReactNode
  eventName?: string
  eventData?: Record<string, string | number | boolean>
}

export function TrackLink({ children, eventName, eventData, onClick, ...props }: Props) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        if (eventName) track(eventName, eventData)
        onClick?.(event)
      }}
    >
      {children}
    </Link>
  )
}
