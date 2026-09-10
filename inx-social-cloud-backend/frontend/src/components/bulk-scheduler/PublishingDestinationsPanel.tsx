import type { Destination, PlatformDefinition } from '../../types/bulk-scheduler'
import { DestinationSelector } from '../posts/DestinationSelector'

type Props = {
  destinations: Destination[]
  platforms: PlatformDefinition[]
  selectedIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
}

export function PublishingDestinationsPanel({ destinations, selectedIds, onSelectionChange }: Props) {
  return (
    <DestinationSelector
      destinations={destinations}
      mode="batch"
      selectedIds={[...selectedIds]}
      setSelectedIds={(ids) => onSelectionChange(new Set(ids))}
    />
  )
}
