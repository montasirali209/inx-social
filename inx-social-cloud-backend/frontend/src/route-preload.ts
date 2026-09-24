const CHUNK_RECOVERY_KEY = 'inx-route-chunk-recovery'

export function isRouteChunkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|Failed to load module script/i.test(message)
}

async function loadRouteModule<T>(loader: () => Promise<T>): Promise<T> {
  try {
    const value = await loader()
    if (typeof window !== 'undefined') sessionStorage.removeItem(CHUNK_RECOVERY_KEY)
    return value
  } catch (error) {
    if (typeof window !== 'undefined' && isRouteChunkError(error) && sessionStorage.getItem(CHUNK_RECOVERY_KEY) !== '1') {
      sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1')
      window.location.reload()
      return new Promise<T>(() => {})
    }
    throw error
  }
}

export const loadDashboard = () => loadRouteModule(() => import('./components/dashboard/DashboardPage'))
export const loadCalendar = () => loadRouteModule(() => import('./components/calendar/ContentCalendarPage'))
export const loadPosts = () => loadRouteModule(() => import('./components/posts/PostsRoute'))
export const loadMediaLibrary = () => loadRouteModule(() => import('./components/media-library/MediaLibraryPage'))
export const loadAiContentStudio = () => loadRouteModule(() => import('./components/ai-content-studio/AiContentStudioPage'))
export const loadUGCStudio = () => loadRouteModule(() => import('./components/ai-content-studio/UGCStudioPage'))
export const loadUGCEditor = () => loadRouteModule(() => import('./components/ai-content-studio/UGCEditorPage'))
export const loadAnalytics = () => loadRouteModule(() => import('./components/analytics/AnalyticsPage'))
export const loadSettings = () => loadRouteModule(() => import('./components/settings/SettingsPage'))
export const loadConnectedAccounts = () => loadRouteModule(() => import('./components/connections/ConnectedAccountsPageV4'))
export const loadBilling = () => loadRouteModule(() => import('./components/billing/BillingPlansPage'))

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
