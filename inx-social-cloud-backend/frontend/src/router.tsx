import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { FoundationPage } from './pages/FoundationPage'

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
      children: [{ index: true, element: <FoundationPage /> }],
    },
  ],
  { basename: '/app' },
)
