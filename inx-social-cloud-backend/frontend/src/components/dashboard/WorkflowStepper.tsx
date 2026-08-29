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
    <section aria-labelledby="workflow-heading" className="rounded-panel border border-border-soft bg-panel/78 px-5 py-4 shadow-panel backdrop-blur-xl">
      <h2 className="sr-only" id="workflow-heading">Video publishing workflow</h2>
      <ol className="grid gap-4 md:grid-cols-4 md:gap-0">
        {steps.map(({ label, detail, icon: Icon }, index) => (
          <li className="relative flex items-center gap-3 md:pr-6" key={label}>
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-brand-blue/20 bg-brand-blue/10 text-[#67adff]">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <strong className="text-sm text-text-main">{label}</strong>
                <span className={`grid size-5 place-items-center rounded-full text-[10px] font-bold ${completed[index] ? 'bg-brand-green/14 text-brand-green' : 'bg-white/6 text-text-soft'}`}>
                  {completed[index] ? <Check aria-hidden="true" className="size-3" /> : index + 1}
                </span>
              </span>
              <small className="mt-0.5 block text-xs text-text-muted">{detail}</small>
            </span>
            {index < steps.length - 1 && <span aria-hidden="true" className="absolute left-[22px] top-[48px] h-[18px] w-px bg-gradient-to-b from-brand-blue/70 to-border-soft md:left-auto md:right-1 md:top-1/2 md:h-px md:w-5 md:bg-gradient-to-r" />}
          </li>
        ))}
      </ol>
    </section>
  )
}
