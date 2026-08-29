import { create } from 'zustand'

type UiState = {
  mobileNavigationOpen: boolean
  timezone: string
  setMobileNavigationOpen: (open: boolean) => void
  setTimezone: (timezone: string) => void
}

const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London'
const savedTimezone = typeof window === 'undefined' ? '' : window.localStorage.getItem('inx-social-timezone') || ''

export const useUiStore = create<UiState>((set) => ({
  mobileNavigationOpen: false,
  timezone: savedTimezone || browserTimezone,
  setMobileNavigationOpen: (mobileNavigationOpen) => set({ mobileNavigationOpen }),
  setTimezone: (timezone) => {
    window.localStorage.setItem('inx-social-timezone', timezone)
    set({ timezone })
  },
}))
