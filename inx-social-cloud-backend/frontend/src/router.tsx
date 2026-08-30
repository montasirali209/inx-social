import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { DashboardPage } from './components/dashboard/DashboardPage'
import { BulkSchedulerPage } from './components/bulk-scheduler/BulkSchedulerPage'
import { ContentCalendarPage } from './components/calendar/ContentCalendarPage'

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, element: <DashboardPage /> },
        { path: 'bulk-scheduler', element: <BulkSchedulerPage /> },
        { path: 'content-calendar', element: <ContentCalendarPage /> },
      ],
    },
  ],
  { basename: '/app' },
)
