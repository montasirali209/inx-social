import { CalendarClock, Check, CloudUpload, Scissors, Send } from 'lucide-react'
import type { JobSummary } from '../../types/dashboard'

const steps = [
  { label: 'Upload', detail: 'Add your video files', icon: CloudUpload },
  { label: 'Prepare', detail: 'Trim, edit and optimise', icon: Scissors },
  { label: 'Schedule', detail: 'Choose date and time', icon: CalendarClock },
  { label: 'Publish', detail: 'Go live across platforms', icon: Send },
]

function completedSteps(summary: JobSummary) {
  const hasUploaded = summary.total - summary.draft > 0
  const hasPrepared = summary.ready + summary.queued + summary.processing + summary.scheduled + summary.published > 0
  const hasScheduled = summary.queued + summary.processing + summary.scheduled + summary.published > 0
  const hasPublished = summary.published > 0
  return [hasUploaded, hasPrepared, hasScheduled, hasPublished]
}

export function WorkflowStepper({ summary }: { summary: JobSummary }) {
  const completed = completedSteps(summary)
  return (
    <section aria-labelledby="workflow-heading" className="interactive-surface overflow-hidden rounded-panel border px-5 py-4 backdrop-blur-xl sm:px-6">
      <h2 className="sr-only" id="workflow-heading">Video publishing workflow</h2>
      <ol className="grid gap-5 md:grid-cols-4 md:gap-0">
        {steps.map(({ label, detail, icon: Icon }, index) => (
          <li className="group relative flex items-center gap-3.5 md:pr-9" key={label}>
            <span className={`relative z-[1] grid size-12 shrink-0 place-items-center rounded-full border transition duration-200 group-hover:-translate-y-1 group-hover:scale-105 motion-reduce:transition-none ${completed[index] ? 'border-brand-green/35 bg-brand-green/10 text-brand-green shadow-[0_0_26px_rgba(34,197,94,0.12)]' : index === completed.findIndex((value) => !value) ? 'border-brand-blue/45 bg-brand-blue/14 text-[#7ab9ff] shadow-glow-blue' : 'border-white/10 bg-white/[0.035] text-text-muted'}`}>
              <Icon aria-hidden="true" className="size-5" />
              <span className={`absolute -right-1 -top-1 grid size-5 place-items-center rounded-full border border-bg text-[10px] font-extrabold ${completed[index] ? 'bg-brand-green text-[#03150b]' : 'bg-panel-soft text-text-muted'}`}>{completed[index] ? <Check aria-hidden="true" className="size-3" /> : index + 1}</span>
            </span>
            <span className="min-w-0">
              <strong className="text-sm text-text-main sm:text-base">{label}</strong>
              <small className="mt-1 block text-xs leading-5 text-text-muted">{detail}</small>
            </span>
            {index < steps.length - 1 && <span aria-hidden="true" className="absolute left-[23px] top-[50px] h-6 w-px bg-gradient-to-b from-brand-blue/70 to-border-soft md:left-auto md:right-2 md:top-1/2 md:h-px md:w-7 md:bg-gradient-to-r md:after:absolute md:after:-right-0.5 md:after:-top-[3px] md:after:size-2 md:after:rotate-45 md:after:border-r md:after:border-t md:after:border-brand-blue/70" />}
          </li>
        ))}
      </ol>
    </section>
  )
}
