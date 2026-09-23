import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import {
  loadAiContentStudio,
  loadAnalytics,
  loadBilling,
  loadCalendar,
  loadConnectedAccounts,
  loadDashboard,
  loadMediaLibrary,
  loadPosts,
  loadSettings,
  loadUGCEditor,
  loadUGCStudio,
} from './route-preload'

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
        { path: 'ai-content-studio/ugc', lazy: async () => ({ Component: (await loadUGCStudio()).UGCStudioPage }) },
        { path: 'ai-content-studio/ugc/:adId/edit', lazy: async () => ({ Component: (await loadUGCEditor()).UGCEditorPage }) },
        { path: 'analytics', lazy: async () => ({ Component: (await loadAnalytics()).AnalyticsPage }) },
        { path: 'settings', lazy: async () => ({ Component: (await loadSettings()).SettingsPage }) },
        { path: 'connected-accounts', lazy: async () => ({ Component: (await loadConnectedAccounts()).ConnectedAccountsPage }) },
        { path: 'billing', lazy: async () => ({ Component: (await loadBilling()).BillingPlansPage }) },
      ],
    },
  ],
  { basename: '/app' },
)
