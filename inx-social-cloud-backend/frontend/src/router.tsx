import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { DashboardPage } from './components/dashboard/DashboardPage'

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
      children: [{ index: true, element: <DashboardPage /> }],
    },
  ],
  { basename: '/app' },
)
