import { FileText } from 'lucide-react'

export function PostThumbnail({ src, title, className = '' }: { src: string | null; title: string; className?: string }) {
  return (
    <span className={`relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-border-soft bg-[radial-gradient(circle_at_25%_15%,rgba(45,212,191,.22),transparent_35%),linear-gradient(145deg,rgba(20,184,166,.16),rgba(3,17,30,.96))] ${className}`}>
      {src ? <img alt="" className="size-full object-cover" src={src} /> : <FileText aria-hidden="true" className="size-4 text-brand-cyan" />}
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-brand-cyan to-transparent" />
      <span className="sr-only">Thumbnail for {title}</span>
    </span>
  )
}

