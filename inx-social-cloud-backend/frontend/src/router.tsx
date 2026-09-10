import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'

const loadDashboard = () => import('./components/dashboard/DashboardPage')
const loadCalendar = () => import('./components/calendar/ContentCalendarPage')
const loadPosts = () => import('./components/posts/PostsPage')
const loadMediaLibrary = () => import('./components/media-library/MediaLibraryPage')
const loadAiContentStudio = () => import('./components/ai-content-studio/AiContentStudioPage')
const loadAnalytics = () => import('./components/analytics/AnalyticsPage')
const loadSettings = () => import('./components/settings/SettingsPage')
const loadConnectedAccounts = () => import('./components/connections/ConnectedAccountsPage')
const loadBilling = () => import('./components/billing/BillingPlansPage')

const routeLoaders: Record<string, () => Promise<unknown>> = {
  '/': loadDashboard,
  '/content-calendar': loadCalendar,
  '/posts': loadPosts,
  '/media-library': loadMediaLibrary,
  '/ai-content-studio': loadAiContentStudio,
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

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, lazy: async () => ({ Component: (await loadDashboard()).DashboardPage }) },
        { path: 'bulk-scheduler', element: null },
        { path: 'content-calendar', lazy: async () => ({ Component: (await loadCalendar()).ContentCalendarPage }) },
        { path: 'posts', lazy: async () => ({ Component: (await loadPosts()).PostsPage }) },
        { path: 'media-library', lazy: async () => ({ Component: (await loadMediaLibrary()).MediaLibraryPage }) },
        { path: 'ai-content-studio', lazy: async () => ({ Component: (await loadAiContentStudio()).AiContentStudioPage }) },
        { path: 'analytics', lazy: async () => ({ Component: (await loadAnalytics()).AnalyticsPage }) },
        { path: 'settings', lazy: async () => ({ Component: (await loadSettings()).SettingsPage }) },
        { path: 'connected-accounts', lazy: async () => ({ Component: (await loadConnectedAccounts()).ConnectedAccountsPage }) },
        { path: 'billing', lazy: async () => ({ Component: (await loadBilling()).BillingPlansPage }) },
      ],
    },
  ],
  { basename: '/app' },
)
