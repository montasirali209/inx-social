import { LoaderCircle, Maximize2, Pause, Play, Volume2, VolumeX, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '0:00'
  const total = Math.floor(value)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function UGCVideoPlayer({
  src,
  className = '',
  autoPlay = false,
  fit = 'contain',
}: {
  src: string
  className?: string
  autoPlay?: boolean
  fit?: 'contain' | 'cover'
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const [playing, setPlaying] = useState(autoPlay)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)
  const [muted, setMuted] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const lowPowerControls = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency || 8) <= 4

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    setCurrent(0)
    setDuration(0)
    setPlaying(false)
    setBuffering(false)
    video.load()
    if (autoPlay) {
      void video.play().catch(() => setPlaying(false))
    }
  }, [src, autoPlay])

  useEffect(() => () => {
    const video = videoRef.current
    if (!video) return
    video.pause()
    video.currentTime = 0
  }, [])

  async function togglePlayback() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      await video.play().catch(() => undefined)
    } else {
      video.pause()
    }
  }

  async function enterFullscreen() {
    const shell = shellRef.current
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (!shell || !video) return
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined)
      return
    }
    if (shell.requestFullscreen) {
      await shell.requestFullscreen().catch(() => undefined)
      return
    }
    video.webkitEnterFullscreen?.()
  }

  return <div
    className={`group relative overflow-hidden bg-black ${className}`}
    onKeyDown={(event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        void togglePlayback()
      }
    }}
    ref={shellRef}
    role="group"
    tabIndex={0}
  >
    <video
      className={`size-full ${fit === 'cover' ? 'object-cover' : 'object-contain'}`}
      onClick={() => void togglePlayback()}
      controls={lowPowerControls}
      onCanPlay={() => setBuffering(false)}
      onEnded={() => setPlaying(false)}
      onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
      onPause={() => setPlaying(false)}
      onPlay={() => { setPlaying(true); setBuffering(false) }}
      onPlaying={() => setBuffering(false)}
      onStalled={() => setBuffering(true)}
      onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime || 0)}
      onWaiting={() => setBuffering(true)}
      playsInline
      preload={autoPlay ? 'auto' : 'metadata'}
      ref={videoRef}
      src={src}
    />

    {buffering && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/10"><span className="grid size-12 place-items-center rounded-full border border-white/15 bg-black/70 text-white"><LoaderCircle className="size-5 animate-spin" /></span></div>}
    {!lowPowerControls && !playing && !buffering && <button
      aria-label="Play video"
      className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/70 text-white shadow-lg transition hover:scale-105 hover:bg-black/80"
      onClick={() => void togglePlayback()}
      type="button"
    >
      <Play className="ml-0.5 size-6 fill-current" />
    </button>}

    {!lowPowerControls && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-3 pt-10 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
      <input
        aria-label="Video progress"
        className="h-1.5 w-full cursor-pointer accent-[#2dd4bf]"
        max={Math.max(duration, 0.01)}
        min={0}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (videoRef.current) videoRef.current.currentTime = next
          setCurrent(next)
        }}
        step="0.05"
        type="range"
        value={Math.min(current, duration || 0)}
      />
      <div className="mt-2 flex items-center gap-2 text-white">
        <button aria-label={playing ? 'Pause video' : 'Play video'} className="grid size-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20" onClick={() => void togglePlayback()} type="button">
          {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
        </button>
        <span className="min-w-[72px] text-[10px] tabular-nums text-white/80">{formatTime(current)} / {formatTime(duration)}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            aria-label={muted ? 'Unmute video' : 'Mute video'}
            className="grid size-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20"
            onClick={() => {
              const video = videoRef.current
              if (!video) return
              video.muted = !video.muted
              setMuted(video.muted)
            }}
            type="button"
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <button aria-label="Fullscreen video" className="grid size-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20" onClick={() => void enterFullscreen()} type="button">
            <Maximize2 className="size-4" />
          </button>
        </div>
      </div>
    </div>}
  </div>
}

export function UGCVideoLightbox({
  open,
  src,
  title,
  onClose,
}: {
  open: boolean
  src: string | null
  title?: string
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open || !src) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[360] grid h-[100dvh] w-screen place-items-center overflow-hidden bg-[#01070d]/96 px-3 sm:px-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'UGC video preview'}
      style={{
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}
    >
      <div className="relative flex h-full min-h-0 w-full max-w-5xl items-center justify-center">
        <button aria-label="Close video preview" className="absolute right-0 top-0 z-20 grid size-11 place-items-center rounded-xl border border-white/15 bg-black/80 text-white shadow-lg hover:bg-black/95" onClick={onClose} type="button">
          <X className="size-5" />
        </button>
        <UGCVideoPlayer autoPlay className="aspect-[9/16] max-h-full w-auto max-w-full rounded-[20px] border border-white/10 shadow-2xl sm:rounded-[24px]" src={src} />
      </div>
    </div>,
    document.body,
  )
}
