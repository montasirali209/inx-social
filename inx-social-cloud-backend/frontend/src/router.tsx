import { createBrowserRouter, useRouteError } from 'react-router-dom'
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
  isRouteChunkError,
} from './route-preload'

function AppRouteError() {
  const error = useRouteError()
  const chunkError = isRouteChunkError(error)
  const message = error instanceof Error ? error.message : 'The workspace could not be opened.'

  return <div className="grid min-h-screen place-items-center bg-[#020b13] px-5 text-white">
    <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#071722] p-7 shadow-2xl">
      <span className="text-[10px] font-bold uppercase tracking-[.18em] text-brand-cyan">INXSocial workspace</span>
      <h1 className="mt-3 text-xl font-bold">{chunkError ? 'A new app version is available.' : 'This page could not be opened.'}</h1>
      <p className="mt-2 text-sm leading-6 text-text-muted">{chunkError ? 'The page was updated while this browser tab was open. Reload once to continue with the latest version.' : message}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button className="rounded-xl bg-brand-cyan px-4 py-2.5 text-sm font-bold text-[#031019]" onClick={() => window.location.reload()} type="button">Reload workspace</button>
        <button className="rounded-xl border border-white/10 bg-white/[.03] px-4 py-2.5 text-sm font-semibold text-white" onClick={() => { window.location.href = '/app/' }} type="button">Go to dashboard</button>
      </div>
    </div>
  </div>
}

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
      errorElement: <AppRouteError />,
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
