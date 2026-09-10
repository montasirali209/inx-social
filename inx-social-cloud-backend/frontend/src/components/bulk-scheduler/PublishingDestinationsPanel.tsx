import type { Destination, Platform, PlatformDefinition } from '../../types/bulk-scheduler'
import { DestinationSelector } from '../posts/DestinationSelector'

type Props = {
  destinations: Destination[]
  platforms: PlatformDefinition[]
  selectedIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
}

const knownPlatforms: Platform[] = ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'x']

export function PublishingDestinationsPanel({ destinations, platforms, selectedIds, onSelectionChange }: Props) {
  const plannedPlatforms = platforms
    .filter((platform) => platform.availability === 'PLANNED' && knownPlatforms.includes(platform.code as Platform))
    .map((platform) => platform.code as Platform)

  return (
    <DestinationSelector
      destinations={destinations}
      mode="batch"
      plannedPlatforms={plannedPlatforms}
      selectedIds={[...selectedIds]}
      setSelectedIds={(ids) => onSelectionChange(new Set(ids))}
    />
  )
}
