import { useQuery } from '@tanstack/react-query'
import { Bot, Image, LockKeyhole, Sparkles, Video } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchStudioOverview } from '../../lib/dashboard-api'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Modal } from '../billing/BillingPrimitives'

const tools = [
  { icon: Image, title: 'AI image generation', text: 'Create brand-aware campaign visuals.' },
  { icon: Video, title: 'AI video generation', text: 'Build short-form video concepts and variants.' },
  { icon: Bot, title: 'Campaign assistant', text: 'Turn a goal into a structured content plan.' },
]

export function AiContentStudioPage() {
  const overview = useQuery({ queryKey: ['studio-overview'], queryFn: fetchStudioOverview, staleTime: 30_000 })
  const [upgradeOpen, setUpgradeOpen] = useState(true)
  const access = overview.data?.features?.aiContentStudio
  const allowed = Boolean(access?.allowed)

  if (overview.isLoading) return <div className="grid gap-4 md:grid-cols-3">{tools.map(({ title }) => <Card className="h-44 animate-pulse bg-panel-soft/60" key={title}><span className="sr-only">Loading {title}</span></Card>)}</div>

  return <>
    <section className="overflow-hidden rounded-3xl border border-brand-purple/25 bg-[radial-gradient(circle_at_90%_5%,rgba(139,92,246,.18),transparent_30rem),linear-gradient(145deg,rgba(10,27,45,.96),rgba(5,15,29,.98))] p-6 shadow-panel sm:p-8">
      <span className="inline-flex items-center gap-2 rounded-full border border-brand-purple/25 bg-brand-purple/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-[#c4b5fd]"><Sparkles className="size-3.5" />Controlled access</span>
      <h2 className="mt-5 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Create faster with the full INXSocial AI workspace.</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">AI Content Studio is included with Plus. Administrators can also grant individual development access without changing a customer’s subscription.</p>
      {!allowed && <Button className="mt-6" onClick={() => setUpgradeOpen(true)} variant="primary"><LockKeyhole className="size-4" />Upgrade to Plus</Button>}
    </section>
    <div className="mt-4 grid gap-4 md:grid-cols-3">{tools.map(({ icon: Icon, title, text }) => <Card className={`p-5 ${allowed ? '' : 'opacity-60'}`} key={title}><span className="grid size-11 place-items-center rounded-2xl border border-brand-purple/25 bg-brand-purple/10 text-[#c4b5fd]"><Icon className="size-5" /></span><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-xs leading-5 text-text-muted">{text}</p>{!allowed && <span className="mt-4 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-brand-amber"><LockKeyhole className="size-3" />Plus required</span>}</Card>)}</div>
    <Modal footer={<><Button onClick={() => setUpgradeOpen(false)}>Not now</Button><Link to="/billing"><Button variant="primary">View Plus plan</Button></Link></>} onClose={() => setUpgradeOpen(false)} open={!allowed && upgradeOpen} title="Upgrade to access AI Content Studio">
      <div className="rounded-2xl border border-brand-purple/25 bg-brand-purple/8 p-5"><Sparkles className="size-7 text-[#c4b5fd]" /><p className="mt-3 text-sm leading-6 text-text-muted">Your current plan does not include the full AI Content Studio. Upgrade to Plus for AI image generation, video generation, creative variations and future advanced tools.</p></div>
    </Modal>
  </>
}
