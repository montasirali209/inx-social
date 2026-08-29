import type { BatchProgress } from '../../types/bulk-scheduler'

const labels: Record<BatchProgress['state'], string> = {
  idle: 'Idle', preparing: 'Preparing', uploading: 'Uploading', scheduling: 'Scheduling', completed: 'Completed', failed: 'Failed', stopped: 'Stopped',
}

export function UploadProgress({ progress }: { progress: BatchProgress }) {
  return (
    <div className="rounded-xl border border-border-soft bg-black/15 p-3">
      <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold">{labels[progress.state]}</span><strong className="text-sm">{Math.round(progress.percent)}%</strong></div>
      <div aria-label={`${Math.round(progress.percent)} percent complete`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(progress.percent)} className="mt-2 h-2 overflow-hidden rounded-full bg-white/6" role="progressbar"><div className="h-full rounded-full bg-gradient-to-r from-brand-cyan via-brand-blue to-brand-purple shadow-[0_0_18px_rgba(36,135,255,.5)] transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${progress.percent}%` }} /></div>
      <p aria-live="polite" className="mt-2 min-h-5 text-xs leading-5 text-text-muted">{progress.message}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-white/6 bg-panel/55 px-3 py-2"><strong className="block text-sm">{progress.current}/{progress.total}</strong><span className="text-[10px] uppercase tracking-wide text-text-soft">Current</span></div>
        <div className="rounded-lg border border-white/6 bg-panel/55 px-3 py-2"><strong className="block text-sm text-brand-green">{progress.completed}</strong><span className="text-[10px] uppercase tracking-wide text-text-soft">Completed</span></div>
        <div className="rounded-lg border border-white/6 bg-panel/55 px-3 py-2"><strong className="block text-sm text-brand-red">{progress.failed}</strong><span className="text-[10px] uppercase tracking-wide text-text-soft">Failed</span></div>
      </div>
    </div>
  )
}
