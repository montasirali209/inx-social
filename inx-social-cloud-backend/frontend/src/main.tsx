import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { WorkspaceLoadingState } from './components/ui/WorkspaceLoadingState'
import './index.css'
import './mobile-responsive.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<WorkspaceLoadingState
        message="Opening the workspace and preparing the latest live data."
        panels={[
          { title: 'Workspace', emoji: '✨', rows: 4, minHeight: '320px' },
          { title: 'Live Data', emoji: '📊', rows: 4, minHeight: '320px' },
        ]}
        stats={[
          { label: 'Workspace', emoji: '🏠' },
          { label: 'Publishing', emoji: '🚀' },
          { label: 'Schedule', emoji: '🗓️' },
          { label: 'Analytics', emoji: '📊' },
          { label: 'Connections', emoji: '🔗' },
        ]}
        title="INXSocial"
      />}>
        <RouterProvider router={router} />
      </Suspense>
    </QueryClientProvider>
  </StrictMode>,
)
