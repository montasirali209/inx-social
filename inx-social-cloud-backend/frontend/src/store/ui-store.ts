import { create } from 'zustand'

type UiState = {
  mobileNavigationOpen: boolean
  settingsSearch: string
  connectionsSearch: string
  billingSearch: string
  billingHelpOpen: boolean
  timezone: string
  setMobileNavigationOpen: (open: boolean) => void
  setSettingsSearch: (search: string) => void
  setConnectionsSearch: (search: string) => void
  setBillingSearch: (search: string) => void
  setBillingHelpOpen: (open: boolean) => void
  setTimezone: (timezone: string) => void
}

const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London'
const savedTimezone = typeof window === 'undefined' ? '' : window.localStorage.getItem('inx-social-timezone') || ''

export const useUiStore = create<UiState>((set) => ({
  mobileNavigationOpen: false,
  settingsSearch: '',
  connectionsSearch: '',
  billingSearch: '',
  billingHelpOpen: false,
  timezone: savedTimezone || browserTimezone,
  setMobileNavigationOpen: (mobileNavigationOpen) => set({ mobileNavigationOpen }),
  setSettingsSearch: (settingsSearch) => set({ settingsSearch }),
  setConnectionsSearch: (connectionsSearch) => set({ connectionsSearch }),
  setBillingSearch: (billingSearch) => set({ billingSearch }),
  setBillingHelpOpen: (billingHelpOpen) => set({ billingHelpOpen }),
  setTimezone: (timezone) => {
    window.localStorage.setItem('inx-social-timezone', timezone)
    set({ timezone })
  },
}))
