import { useRive, useStateMachineInput } from '@rive-app/react-canvas'
import { gsap } from 'gsap'
import { useEffect, useRef } from 'react'

export type CreativeFlowMotionState = 'idle' | 'hover' | 'working' | 'success' | 'error' | 'selected'

export function CreativeFlowMotionSlot({
  state,
  riveSrc,
  stateMachine = 'CreativeFlow',
  className = '',
}: {
  state: CreativeFlowMotionState
  riveSrc?: string | null
  stateMachine?: string
  className?: string
}) {
  if (riveSrc) {
    return <RiveMotionAsset
      className={className}
      src={riveSrc}
      state={state}
      stateMachine={stateMachine}
    />
  }
  return <ExpressiveMotion className={className} state={state} />
}

function RiveMotionAsset({
  className,
  src,
  state,
  stateMachine,
}: {
  className: string
  src: string
  state: CreativeFlowMotionState
  stateMachine: string
}) {
  const { rive, RiveComponent } = useRive({
    src,
    stateMachines: stateMachine,
    autoplay: true,
  })
  const trigger = useStateMachineInput(rive, stateMachine, state)

  useEffect(() => {
    trigger?.fire()
  }, [trigger, state])

  return <RiveComponent className={className} />
}

function ExpressiveMotion({ state, className }: { state: CreativeFlowMotionState; className: string }) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!rootRef.current) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    const root = rootRef.current
    const ringOuter = root.querySelector('[data-ring-outer]')
    const ringInner = root.querySelector('[data-ring-inner]')
    const core = root.querySelector('[data-core]')
    const orbiters = root.querySelectorAll('[data-orbiter]')
    const bars = root.querySelectorAll('[data-bar]')
    const particles = root.querySelectorAll('[data-particle]')
    const scan = root.querySelector('[data-scan]')
    const successMark = root.querySelector('[data-success-mark]')
    const errorMark = root.querySelector('[data-error-mark]')

    const context = gsap.context(() => {
      gsap.to(ringOuter, { rotate: 360, duration: state === 'working' ? 3.8 : 11, repeat: -1, ease: 'none' })
      gsap.to(ringInner, { rotate: -360, duration: state === 'working' ? 5.2 : 15, repeat: -1, ease: 'none' })

      if (state === 'working') {
        gsap.to(core, { scale: 1.06, duration: 0.72, repeat: -1, yoyo: true, ease: 'sine.inOut' })
        gsap.to(orbiters, { rotate: 360, transformOrigin: '50% 50%', duration: 2.4, repeat: -1, ease: 'none', stagger: 0.16 })
        gsap.fromTo(bars, { scaleY: 0.35, opacity: 0.45 }, { scaleY: 1, opacity: 1, duration: 0.48, repeat: -1, yoyo: true, stagger: 0.1, ease: 'sine.inOut' })
        gsap.fromTo(scan, { yPercent: -110, opacity: 0 }, { yPercent: 110, opacity: 0.85, duration: 1.15, repeat: -1, ease: 'power1.inOut' })
        gsap.fromTo(particles, { opacity: 0.18, scale: 0.55 }, { opacity: 1, scale: 1.15, duration: 0.7, repeat: -1, yoyo: true, stagger: 0.12, ease: 'sine.inOut' })
      } else if (state === 'success') {
        gsap.fromTo(core, { scale: 0.7, rotate: -14 }, { scale: 1, rotate: 0, duration: 0.62, ease: 'back.out(2)' })
        gsap.fromTo(successMark, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.44, delay: 0.12, ease: 'back.out(2.3)' })
        gsap.fromTo(particles, { opacity: 0, scale: 0.3 }, { opacity: 0.9, scale: 1, duration: 0.4, stagger: 0.08, ease: 'back.out(2)' })
      } else if (state === 'error') {
        gsap.fromTo(core, { x: -3 }, { x: 3, duration: 0.085, repeat: 7, yoyo: true, ease: 'none' })
        gsap.fromTo(errorMark, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.38, ease: 'back.out(2.3)' })
      } else if (state === 'selected') {
        gsap.to(core, { scale: 1.08, duration: 0.8, repeat: -1, yoyo: true, ease: 'sine.inOut' })
        gsap.to(orbiters, { rotate: 360, transformOrigin: '50% 50%', duration: 5.5, repeat: -1, ease: 'none', stagger: 0.2 })
      } else {
        gsap.to(core, { y: -1.5, duration: 1.9, repeat: -1, yoyo: true, ease: 'sine.inOut' })
        gsap.to(bars, { scaleY: 0.72, duration: 1.35, repeat: -1, yoyo: true, stagger: 0.12, ease: 'sine.inOut' })
      }
    }, root)

    return () => context.revert()
  }, [state])

  const success = state === 'success'
  const error = state === 'error'
  const selected = state === 'selected'
  const working = state === 'working'
  const accent = error
    ? 'border-red-300/70'
    : success
      ? 'border-emerald-300/70'
      : selected
        ? 'border-violet-300/70'
        : 'border-cyan-300/70'
  const coreTone = error
    ? 'border-red-300 bg-red-50 shadow-[0_8px_26px_rgba(239,68,68,.16)]'
    : success
      ? 'border-emerald-300 bg-white shadow-[0_8px_26px_rgba(16,185,129,.16)]'
      : selected
        ? 'border-violet-300 bg-white shadow-[0_8px_26px_rgba(139,92,246,.16)]'
        : 'border-cyan-300 bg-white shadow-[0_8px_26px_rgba(6,182,212,.16)]'

  return <div aria-hidden="true" className={`relative grid place-items-center overflow-visible ${className}`} ref={rootRef}>
    <div data-ring-outer className={`absolute inset-[3%] rounded-full border ${accent} opacity-80`}>
      <span className="absolute left-1/2 top-[-4%] size-[10%] -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,.5)]" />
    </div>
    <div data-ring-inner className={`absolute inset-[14%] rounded-full border border-dashed ${accent} opacity-55`}>
      <span className="absolute bottom-[2%] right-[4%] size-[9%] rounded-full bg-violet-400/90" />
    </div>

    <span data-orbiter className="absolute inset-[8%] rounded-full">
      <i className="absolute right-[3%] top-1/2 size-[7%] -translate-y-1/2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,.55)]" />
    </span>
    <span data-orbiter className="absolute inset-[18%] rounded-full">
      <i className="absolute left-[2%] top-[26%] size-[8%] rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,.5)]" />
    </span>

    <span data-particle className="absolute left-[4%] top-[18%] size-[5%] rounded-full bg-emerald-400/80" />
    <span data-particle className="absolute bottom-[8%] right-[15%] size-[4%] rounded-full bg-cyan-400/80" />
    <span data-particle className="absolute right-[7%] top-[11%] size-[3%] rounded-full bg-violet-400/80" />

    <div data-core className={`relative grid size-[48%] place-items-center overflow-hidden rounded-[30%] border ${coreTone}`}>
      {working && <span data-scan className="absolute inset-x-[10%] top-1/2 h-[2px] rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,.75)]" />}
      <div className="flex h-[34%] items-end gap-[8%]">
        <span data-bar className={`h-[55%] w-[4px] origin-bottom rounded-full ${error ? 'bg-red-400' : success ? 'bg-emerald-400' : selected ? 'bg-violet-400' : 'bg-cyan-400'}`} />
        <span data-bar className={`h-full w-[4px] origin-bottom rounded-full ${error ? 'bg-red-400' : success ? 'bg-emerald-400' : selected ? 'bg-violet-400' : 'bg-violet-400'}`} />
        <span data-bar className={`h-[72%] w-[4px] origin-bottom rounded-full ${error ? 'bg-red-400' : success ? 'bg-emerald-400' : selected ? 'bg-violet-400' : 'bg-cyan-400'}`} />
      </div>

      {success && <span data-success-mark className="absolute inset-0 grid place-items-center bg-white/94">
        <i className="h-[22%] w-[38%] -translate-y-[4%] -rotate-45 border-b-[3px] border-l-[3px] border-emerald-500" />
      </span>}
      {error && <span data-error-mark className="absolute inset-0 grid place-items-center bg-red-50/94">
        <i className="absolute h-[46%] w-[3px] rotate-45 rounded-full bg-red-500" />
        <i className="absolute h-[46%] w-[3px] -rotate-45 rounded-full bg-red-500" />
      </span>}
    </div>
  </div>
}
