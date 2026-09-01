import { createContext, useContext } from 'react'
import type { BatchProgress } from '../../types/bulk-scheduler'

export type BulkActivityContextValue = {
  progress: BatchProgress
  running: boolean
  update: (progress: BatchProgress) => void
  registerStop: (handler: (() => void) | null) => void
  stop: () => void
}

export const BulkActivityContext = createContext<BulkActivityContextValue | null>(null)

export function useBulkSchedulerActivity() {
  const value = useContext(BulkActivityContext)
  if (!value) throw new Error('Bulk Scheduler activity is unavailable outside AppShell.')
  return value
}

