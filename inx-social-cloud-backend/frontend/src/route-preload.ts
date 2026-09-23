export const loadDashboard = () => import('./components/dashboard/DashboardPage')
export const loadCalendar = () => import('./components/calendar/ContentCalendarPage')
export const loadPosts = () => import('./components/posts/PostsRoute')
export const loadMediaLibrary = () => import('./components/media-library/MediaLibraryPage')
export const loadAiContentStudio = () => import('./components/ai-content-studio/AiContentStudioPage')
export const loadUGCStudio = () => import('./components/ai-content-studio/UGCStudioPage')
export const loadUGCEditor = () => import('./components/ai-content-studio/UGCEditorPage')
export const loadAnalytics = () => import('./components/analytics/AnalyticsPage')
export const loadSettings = () => import('./components/settings/SettingsPage')
export const loadConnectedAccounts = () => import('./components/connections/ConnectedAccountsPageV4')
export const loadBilling = () => import('./components/billing/BillingPlansPage')

const routeLoaders: Record<string, () => Promise<unknown>> = {
  '/': loadDashboard,
  '/content-calendar': loadCalendar,
  '/posts': loadPosts,
  '/media-library': loadMediaLibrary,
  '/ai-content-studio': loadAiContentStudio,
  '/ai-content-studio/ugc': loadUGCStudio,
  '/analytics': loadAnalytics,
  '/settings': loadSettings,
  '/connected-accounts': loadConnectedAccounts,
  '/billing': loadBilling,
}

export function preloadAppRoute(path: string) {
  return routeLoaders[path]?.()
}

export function preloadAllAppRoutes() {
  return Promise.allSettled(Object.values(routeLoaders).map((load) => load()))
}
