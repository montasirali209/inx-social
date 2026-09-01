import { Bot, CalendarClock, Folder, FolderOpen, Image, Send, Trash2, Upload, X } from 'lucide-react'
import { systemFolders } from '../../data/mediaLibraryData'
import type { MediaAsset, MediaFolder } from '../../types/media-library'

type Props = {
  assets: MediaAsset[]
  trashAssets: MediaAsset[]
  folders: MediaFolder[]
  active: string
  open: boolean
  onActive: (id: string) => void
  onClose: () => void
  onCreateFolder: () => void
}

const icons = { all: FolderOpen, brand_assets: Image, ai_generated: Bot, uploaded: Upload, scheduled: CalendarClock, published: Send, trash: Trash2 }
export function FolderPanel(props: Props) {
  function count(id: string) {
    if (id === 'all') return props.assets.length
    if (id === 'brand_assets') return props.assets.filter(asset => asset.collection === 'brand_assets').length
    if (id === 'ai_generated') return props.assets.filter(asset => asset.source === 'ai_generated').length
    if (id === 'uploaded') return props.assets.filter(asset => asset.collection === 'uploaded_media').length
    if (id === 'trash') return props.trashAssets.length
    return props.assets.filter(asset => asset.status === id).length
  }
  const content = (
    <aside className="h-full rounded-panel border border-border-soft bg-panel/75 p-4 shadow-panel">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[.16em] text-brand-cyan">Library</p>
          <h2 className="mt-1 text-sm font-semibold">Folders</h2>
        </div>
        <div className="flex gap-1">
          <button aria-label="Create folder" className="rounded-lg p-2 text-brand-cyan transition hover:bg-brand-cyan/10 focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={props.onCreateFolder} type="button"><Folder className="size-4" /></button>
          <button aria-label="Close folders" className="rounded-lg p-2 text-text-muted hover:bg-white/5 2xl:hidden" onClick={props.onClose} type="button"><X className="size-4" /></button>
        </div>
      </div>
      <nav aria-label="Media folders" className="mt-4 space-y-1">
        {systemFolders.map(item => {
          const Icon = icons[item.id as keyof typeof icons]
          return <button className={`flex min-h-10 w-full items-center gap-2 rounded-xl border px-3 text-left text-[11px] transition focus-visible:outline-2 focus-visible:outline-brand-cyan ${props.active === item.id ? 'border-brand-cyan/35 bg-brand-cyan/10 text-brand-cyan' : 'border-transparent text-text-muted hover:bg-white/4 hover:text-white'}`} key={item.id} onClick={() => props.onActive(item.id)} type="button"><Icon className="size-4" /><span className="flex-1 truncate">{item.label}</span><span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px]">{count(item.id)}</span></button>
        })}
        {props.folders.map(folder => <button className={`flex min-h-10 w-full items-center gap-2 rounded-xl border px-3 text-left text-[11px] transition focus-visible:outline-2 focus-visible:outline-brand-cyan ${props.active === folder.id ? 'border-brand-cyan/35 bg-brand-cyan/10 text-brand-cyan' : 'border-transparent text-text-muted hover:bg-white/4 hover:text-white'}`} key={folder.id} onClick={() => props.onActive(folder.id)} type="button"><Folder className="size-4" /><span className="flex-1 truncate">{folder.name}</span><span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px]">{folder.count}</span></button>)}
      </nav>
      <button className="mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand-cyan/25 text-[10px] font-semibold text-brand-cyan transition hover:border-brand-cyan/45 hover:bg-brand-cyan/8 focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={props.onCreateFolder} type="button"><Folder className="size-3.5" />Create Folder</button>
    </aside>
  )
  return <>{props.open && <button aria-label="Close folders" className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm 2xl:hidden" onClick={props.onClose} type="button" />}<div className={`fixed inset-y-3 left-3 z-50 w-[min(310px,calc(100vw-24px))] transition-transform duration-300 2xl:static 2xl:z-auto 2xl:block 2xl:w-auto 2xl:translate-x-0 ${props.open ? 'translate-x-0' : '-translate-x-[110%]'}`}>{content}</div></>
}
