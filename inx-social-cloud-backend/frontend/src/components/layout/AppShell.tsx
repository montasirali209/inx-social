import { useQuery } from '@tanstack/react-query'
import { Outlet, useLocation } from 'react-router-dom'
import { fetchStudioOverview } from '../../lib/dashboard-api'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell() {
  const location = useLocation()
  const overview = useQuery({ queryKey: ['studio-overview'], queryFn: fetchStudioOverview })

  return (
    <div className="min-h-dvh bg-bg text-text-main">
      <a className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-brand-blue focus:px-4 focus:py-2 focus:text-white" href="#main-content">
        Skip to content
      </a>
      <Sidebar overview={overview.data} />
      <div className="md:pl-[88px] xl:pl-[264px]">
        <Topbar overview={overview.data} />
        <main className="mx-auto w-full max-w-[1780px] p-4 sm:p-5 xl:p-6" id="main-content">
          <div className="route-stage" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
