import { CheckCircle2, ChevronRight, Layers3, Send, Square, UploadCloud } from 'lucide-react'

const steps = [
  { icon: Layers3, title: 'Select destinations', detail: 'Choose one or many accounts' },
  { icon: UploadCloud, title: 'Upload & configure', detail: 'Add media, captions and timing' },
  { icon: Send, title: 'Publish with confidence', detail: 'Follow every result live' },
]

export function BulkSchedulerHero({
  onStop,
  running,
}: {
  onStop: () => void
  running: boolean
}) {
  return (
    <section className="hero-stage px-5 py-5 sm:px-7">
      <div className="relative z-[1] grid items-center gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(520px,.95fr)]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-brand-cyan"><CheckCircle2 aria-hidden="true" className="size-4" /> Session-based publishing</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Bulk publishing, made simple.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">Select your destinations, upload images or videos with captions, choose a timing mode, then publish instantly or let the scheduler handle it for you.</p>
          {running ? <div className="mt-4"><button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-red/45 bg-brand-red/15 px-4 text-xs font-semibold text-brand-red transition hover:bg-brand-red/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red" onClick={onStop} type="button"><Square aria-hidden="true" className="size-3 fill-current" /> Stop Scheduler</button></div> : null}
        </div>
        <ol className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
          {steps.map((step, index) => <li className="contents" key={step.title}><div className="rounded-xl border border-white/7 bg-black/18 p-3 backdrop-blur"><step.icon aria-hidden="true" className="size-5 text-brand-cyan" /><strong className="mt-2 block text-xs">{step.title}</strong><span className="mt-0.5 block text-[10px] leading-4 text-text-soft">{step.detail}</span></div>{index < steps.length - 1 && <ChevronRight aria-hidden="true" className="mx-auto hidden size-4 text-brand-blue sm:block" />}</li>)}
        </ol>
      </div>
    </section>
  )
}
