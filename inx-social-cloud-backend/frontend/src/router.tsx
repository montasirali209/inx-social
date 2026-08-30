import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, lazy: async () => ({ Component: (await import('./components/dashboard/DashboardPage')).DashboardPage }) },
        { path: 'bulk-scheduler', lazy: async () => ({ Component: (await import('./components/bulk-scheduler/BulkSchedulerPage')).BulkSchedulerPage }) },
        { path: 'content-calendar', lazy: async () => ({ Component: (await import('./components/calendar/ContentCalendarPage')).ContentCalendarPage }) },
        { path: 'posts', lazy: async () => ({ Component: (await import('./components/posts/PostsPage')).PostsPage }) },
        { path: 'media-library', lazy: async () => ({ Component: (await import('./components/media-library/MediaLibraryPage')).MediaLibraryPage }) },
      ],
    },
  ],
  { basename: '/app' },
)
