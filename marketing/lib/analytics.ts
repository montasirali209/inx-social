'use client'

type EventPayload = Record<string, string | number | boolean | null | undefined>

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>
    gtag?: (...args: unknown[]) => void
  }
}

export function track(event: string, payload: EventPayload = {}) {
  if (typeof window === 'undefined') return
  const eventPayload = { event, ...payload }
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(eventPayload)
  window.gtag?.('event', event, payload)
}
