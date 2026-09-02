import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, lazy: async () => ({ Component: (await import('./components/dashboard/DashboardPage')).DashboardPage }) },
        { path: 'bulk-scheduler', element: null },
        { path: 'content-calendar', lazy: async () => ({ Component: (await import('./components/calendar/ContentCalendarPage')).ContentCalendarPage }) },
        { path: 'posts', lazy: async () => ({ Component: (await import('./components/posts/PostsPage')).PostsPage }) },
        { path: 'media-library', lazy: async () => ({ Component: (await import('./components/media-library/MediaLibraryPage')).MediaLibraryPage }) },
        { path: 'analytics', lazy: async () => ({ Component: (await import('./components/analytics/AnalyticsPage')).AnalyticsPage }) },
        { path: 'settings', lazy: async () => ({ Component: (await import('./components/settings/SettingsPage')).SettingsPage }) },
        { path: 'connected-accounts', lazy: async () => ({ Component: (await import('./components/connections/ConnectedAccountsPage')).ConnectedAccountsPage }) },
      ],
    },
  ],
  { basename: '/app' },
)
