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
  return <FallbackMotion className={className} state={state} />
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

function FallbackMotion({ state, className }: { state: CreativeFlowMotionState; className: string }) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!rootRef.current) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const root = rootRef.current
    const orbiters = root.querySelectorAll('[data-orbiter]')
    const core = root.querySelector('[data-core]')
    const context = gsap.context(() => {
      if (state === 'working') {
        gsap.to(root, { rotate: 360, duration: 7, repeat: -1, ease: 'none' })
        gsap.to(orbiters, { scale: 1.3, opacity: 1, duration: 0.7, repeat: -1, yoyo: true, stagger: 0.14, ease: 'sine.inOut' })
        gsap.to(core, { scale: 1.12, duration: 0.6, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      } else if (state === 'success') {
        gsap.fromTo(root, { scale: 0.82, rotate: -8 }, { scale: 1, rotate: 0, duration: 0.7, ease: 'back.out(2)' })
        gsap.to(orbiters, { y: -2, duration: 1.7, repeat: -1, yoyo: true, stagger: 0.18, ease: 'sine.inOut' })
      } else if (state === 'error') {
        gsap.fromTo(root, { x: -3 }, { x: 3, duration: 0.08, repeat: 5, yoyo: true, ease: 'none' })
      } else {
        gsap.to(root, { y: -2, duration: 2.2, repeat: -1, yoyo: true, ease: 'sine.inOut' })
        gsap.to(orbiters, { opacity: 0.7, duration: 1.6, repeat: -1, yoyo: true, stagger: 0.2, ease: 'sine.inOut' })
      }
    }, root)
    return () => context.revert()
  }, [state])

  const working = state === 'working'
  const success = state === 'success'
  const error = state === 'error'

  return <div className={`relative grid place-items-center ${className}`} ref={rootRef}>
    <div className={`absolute inset-[18%] rounded-full border ${error ? 'border-red-300/70' : success ? 'border-brand-green/35' : 'border-brand-cyan/30'}`} />
    <div className={`absolute inset-[31%] rounded-full border ${error ? 'border-red-200/70' : success ? 'border-brand-green/20' : 'border-brand-purple/20'}`} />
    <span data-orbiter className="absolute left-[8%] top-[45%] size-2.5 rounded-full bg-brand-cyan/70 shadow-[0_0_16px_rgba(20,184,166,.35)]" />
    <span data-orbiter className="absolute right-[16%] top-[16%] size-2 rounded-full bg-brand-purple/55 shadow-[0_0_14px_rgba(139,92,246,.30)]" />
    <span data-orbiter className="absolute bottom-[12%] right-[26%] size-2 rounded-full bg-brand-green/65 shadow-[0_0_14px_rgba(34,197,94,.26)]" />
    <span data-core className={`grid size-[38%] place-items-center rounded-[35%] border shadow-[0_10px_30px_rgba(15,23,42,.10)] ${error ? 'border-red-300 bg-red-50' : success ? 'border-brand-green/25 bg-brand-green/[.08]' : 'border-brand-cyan/25 bg-white'}`}>
      <span className={`size-2.5 rounded-full ${error ? 'bg-red-400' : success ? 'bg-brand-green' : working ? 'bg-brand-cyan' : 'bg-brand-purple/60'}`} />
    </span>
  </div>
}
