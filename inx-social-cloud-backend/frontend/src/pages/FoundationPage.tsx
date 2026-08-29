import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, CloudCog, Code2, ShieldCheck } from 'lucide-react'
import { apiRequest } from '../lib/api-client'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'

type HealthResponse = {
  ok: boolean
  service: string
  version: string
  reactApp: string
}

const foundationItems = [
  { title: 'React + TypeScript', body: 'A component-based interface with strict typing and route-by-route migration.', icon: Code2 },
  { title: 'Tailwind CSS v4', body: 'One CSS-first token system for consistent colour, spacing, controls and accessibility.', icon: ShieldCheck },
  { title: 'Railway integrated', body: 'One deployment continues to serve the API and the new browser application.', icon: CloudCog },
]

export function FoundationPage() {
  const health = useQuery({
    queryKey: ['platform-health'],
    queryFn: () => apiRequest<HealthResponse>('/health'),
  })

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[20px] border border-accent-blue/25 bg-hero-gradient p-6 shadow-panel sm:p-8 lg:p-10">
        <div className="max-w-3xl">
          <Badge tone="success">Phase 13.0 foundation</Badge>
          <h1 className="mt-5 text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl lg:text-5xl">The new INX Social application foundation is ready.</h1>
          <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-text-secondary sm:text-lg">This preview proves the new UI stack can run beside the current Studio without changing existing publishing, AI or account workflows.</p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {foundationItems.map(({ title, body, icon: Icon }) => (
          <Card key={title}>
            <span className="grid size-11 place-items-center rounded-control border border-accent-blue/25 bg-accent-blue/10 text-accent-cyan">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <h2 className="mt-5 text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{body}</p>
          </Card>
        ))}
      </div>

      <Card aria-live="polite" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Live backend check</p>
          {health.isPending && <p className="mt-2 text-base font-semibold">Checking Railway service…</p>}
          {health.isError && <p className="mt-2 text-base font-semibold text-accent-red">Backend connection unavailable</p>}
          {health.data && <p className="mt-2 text-base font-semibold">{health.data.service} v{health.data.version}</p>}
        </div>
        {health.data?.ok && (
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-green">
            <CheckCircle2 aria-hidden="true" className="size-5" />
            Connected
          </span>
        )}
      </Card>
    </div>
  )
}
