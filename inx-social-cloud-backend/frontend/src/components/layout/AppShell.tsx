import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Outlet, useLocation } from 'react-router-dom'
import { fetchStudioOverview } from '../../lib/dashboard-api'
import { preloadAllAppRoutes } from '../../route-preload'
import { RequireAuth } from '../auth/RequireAuth'
import { BulkSchedulerPage } from '../bulk-scheduler/BulkSchedulerPage'
import { BulkRunDock, BulkSchedulerActivityProvider } from '../bulk-scheduler/BulkSchedulerActivity'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (id: number) => void
}

export function AppShell() {
  return <RequireAuth><BulkSchedulerActivityProvider><AppShellContent /></BulkSchedulerActivityProvider></RequireAuth>
}

function AppShellContent() {
  const location = useLocation()
  const bulkRoute = location.pathname === '/bulk-scheduler'
  const overview = useQuery({
    queryKey: ['studio-overview'],
    queryFn: fetchStudioOverview,
    refetchInterval: 60_000,
  })

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
    if (connection?.saveData || connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') return
    const warm = () => { void preloadAllAppRoutes() }
    const idleWindow = window as IdleWindow
    if (typeof idleWindow.requestIdleCallback === 'function') {
      const idleId = idleWindow.requestIdleCallback(warm, { timeout: 1200 })
      return () => idleWindow.cancelIdleCallback?.(idleId)
    }
    const timer = window.setTimeout(warm, 650)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-dvh bg-bg text-text-main">
      <a className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-brand-blue focus:px-4 focus:py-2 focus:text-white" href="#main-content">
        Skip to content
      </a>
      <Sidebar overview={overview.data} />
      <div className="md:pl-[88px] xl:pl-[264px]">
        <Topbar overview={overview.data} />
        <main className="mx-auto w-full max-w-[1780px] min-w-0 p-3 sm:p-5 xl:p-6" id="main-content">
          <div aria-hidden={!bulkRoute} className={bulkRoute ? 'route-stage min-w-0' : 'hidden'} style={{ animationDuration: '160ms' }}><BulkSchedulerPage /></div>
          {!bulkRoute && <div className="route-stage min-w-0" key={location.pathname} style={{ animationDuration: '160ms' }}><Outlet /></div>}
        </main>
      </div>
      <BulkRunDock />
    </div>
  )
}
