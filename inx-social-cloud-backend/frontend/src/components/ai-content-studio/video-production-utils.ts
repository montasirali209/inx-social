import type { GenerationHistoryItem } from '../../types/ai-content-studio'

export type VideoProductionKind = 'generative' | 'stock'

export function videoProductionKind(item: Pick<GenerationHistoryItem, 'type' | 'provider'>): VideoProductionKind {
  return item.type === 'stock_video' || String(item.provider || '').toLowerCase().includes('openmontage') ? 'stock' : 'generative'
}
