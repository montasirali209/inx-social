import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
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
      <Suspense fallback={<div aria-label="Opening INXSocial" className="grid min-h-[45vh] place-items-center" role="status"><div className="flex items-center gap-3 rounded-xl border border-border-soft bg-panel/60 px-4 py-3 text-sm text-text-muted"><span className="size-4 animate-spin rounded-full border-2 border-brand-cyan/25 border-t-brand-cyan motion-reduce:animate-none" /><span>Opening workspace…</span></div></div>}>
        <RouterProvider router={router} />
      </Suspense>
    </QueryClientProvider>
  </StrictMode>,
)
