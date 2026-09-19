'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { track } from '@/lib/analytics'

export function PageAnalytics() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    track('marketing_page_view', {
      path: pathname,
      query: searchParams.toString() || null,
    })
  }, [pathname, searchParams])

  return null
}
