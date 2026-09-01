import { CalendarPlus, Copy, Download, MoreHorizontal, Pencil, RotateCcw, Send, Trash2 } from 'lucide-react'
import type { MediaAsset } from '../../types/media-library'

type Props = { asset: MediaAsset; trashMode?: boolean; onUse: () => void; onSchedule: () => void; onDownload: () => void; onRename: () => void; onDuplicate: () => void; onDelete: () => void; onRestore?: () => void; onPurge?: () => void }

export function AssetActionMenu(props: Props) {
  const actions = props.trashMode ? [
    { label: 'Restore', icon: RotateCcw, action: props.onRestore || (() => {}) },
    { label: 'Download', icon: Download, action: props.onDownload },
    { label: 'Delete permanently', icon: Trash2, action: props.onPurge || (() => {}), danger: true },
  ] : [
    { label: 'Use in Post', icon: Send, action: props.onUse },
    { label: 'Schedule', icon: CalendarPlus, action: props.onSchedule },
    { label: 'Download', icon: Download, action: props.onDownload },
    { label: 'Rename', icon: Pencil, action: props.onRename },
    { label: 'Duplicate', icon: Copy, action: props.onDuplicate },
    { label: 'Delete', icon: Trash2, action: props.onDelete, danger: true },
  ]
  return <details className="group relative"><summary aria-label={`Actions for ${props.asset.fileName}`} className="grid size-8 cursor-pointer list-none place-items-center rounded-lg text-text-muted transition hover:bg-white/7 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan"><MoreHorizontal className="size-4" /></summary><div className="notification-pop absolute bottom-full right-0 z-30 mb-1 w-40 rounded-xl border border-border-soft bg-panel p-1.5 shadow-panel">{actions.map(({ label, icon: Icon, action, danger }) => <button className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] transition hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-brand-cyan ${danger ? 'text-brand-red' : 'text-text-muted hover:text-white'}`} key={label} onClick={(event) => { event.preventDefault(); action(); const details = event.currentTarget.closest('details'); if (details) details.open = false }} type="button"><Icon className="size-3.5" />{label}</button>)}</div></details>
}
