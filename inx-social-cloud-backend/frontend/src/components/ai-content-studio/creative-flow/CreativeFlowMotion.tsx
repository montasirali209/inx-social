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
    const face = root.querySelector('[data-face]')
    const halo = root.querySelector('[data-halo]')
    const eyes = root.querySelectorAll('[data-eye]')
    const thoughts = root.querySelectorAll('[data-thought]')
    const sparks = root.querySelectorAll('[data-spark]')
    const alert = root.querySelector('[data-alert]')

    const context = gsap.context(() => {
      if (state === 'working') {
        gsap.to(face, { y: -2, rotate: 4, duration: 0.58, repeat: -1, yoyo: true, ease: 'sine.inOut' })
        gsap.to(eyes, { x: 3, duration: 0.48, repeat: -1, yoyo: true, stagger: 0.06, ease: 'sine.inOut' })
        gsap.to(halo, { rotate: 360, duration: 7, repeat: -1, ease: 'none' })
        gsap.fromTo(thoughts, { opacity: 0.28, scale: 0.72, y: 2 }, {
          opacity: 1,
          scale: 1.18,
          y: -5,
          duration: 0.78,
          repeat: -1,
          yoyo: true,
          stagger: 0.18,
          ease: 'sine.inOut',
        })
      } else if (state === 'success') {
        gsap.fromTo(face, { scale: 0.72, rotate: -9 }, { scale: 1, rotate: 0, duration: 0.66, ease: 'back.out(2.2)' })
        gsap.fromTo(sparks, { opacity: 0, scale: 0.2 }, {
          opacity: 1,
          scale: 1,
          duration: 0.38,
          stagger: 0.08,
          ease: 'back.out(2)',
        })
        gsap.to(sparks, { y: -2, duration: 1.4, repeat: -1, yoyo: true, stagger: 0.12, ease: 'sine.inOut' })
      } else if (state === 'error') {
        gsap.fromTo(face, { x: -4, rotate: -3 }, { x: 4, rotate: 3, duration: 0.085, repeat: 7, yoyo: true, ease: 'none' })
        gsap.fromTo(alert, { scale: 0.5, y: 5 }, { scale: 1, y: 0, duration: 0.48, ease: 'back.out(2.4)' })
        gsap.to(alert, { y: -2, duration: 0.7, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      } else if (state === 'selected') {
        gsap.to(face, { scale: 1.05, duration: 0.7, repeat: -1, yoyo: true, ease: 'sine.inOut' })
        gsap.to(halo, { rotate: 360, duration: 10, repeat: -1, ease: 'none' })
      } else {
        gsap.to(face, { y: -2, rotate: -1.5, duration: 2.1, repeat: -1, yoyo: true, ease: 'sine.inOut' })
        gsap.to(eyes, { y: 1, duration: 1.8, repeat: -1, yoyo: true, stagger: 0.12, ease: 'sine.inOut' })
        gsap.to(halo, { rotate: 360, duration: 18, repeat: -1, ease: 'none' })
      }
    }, root)

    return () => context.revert()
  }, [state])

  const working = state === 'working'
  const success = state === 'success'
  const error = state === 'error'
  const selected = state === 'selected'

  const ringClass = error
    ? 'border-red-300/70 bg-red-50/60'
    : success
      ? 'border-brand-green/30 bg-brand-green/[.045]'
      : selected
        ? 'border-brand-purple/30 bg-brand-purple/[.04]'
        : 'border-brand-cyan/25 bg-brand-cyan/[.035]'

  const faceClass = error
    ? 'border-red-300 bg-red-50 shadow-[0_8px_24px_rgba(239,68,68,.14)]'
    : success
      ? 'border-brand-green/25 bg-white shadow-[0_8px_24px_rgba(34,197,94,.12)]'
      : selected
        ? 'border-brand-purple/25 bg-white shadow-[0_8px_24px_rgba(139,92,246,.12)]'
        : 'border-brand-cyan/25 bg-white shadow-[0_8px_24px_rgba(20,184,166,.12)]'

  return <div aria-hidden="true" className={`relative grid place-items-center overflow-visible ${className}`} ref={rootRef}>
    <div data-halo className={`absolute inset-[6%] rounded-full border border-dashed ${ringClass}`} />

    {working && <>
      <span data-thought className="absolute right-[3%] top-[2%] size-[14%] rounded-full border border-brand-purple/20 bg-white shadow-sm" />
      <span data-thought className="absolute right-[18%] top-[15%] size-[10%] rounded-full border border-brand-cyan/20 bg-white shadow-sm" />
      <span data-thought className="absolute right-[27%] top-[28%] size-[6%] rounded-full bg-brand-cyan/25" />
    </>}

    {success && <>
      <span data-spark className="absolute left-[4%] top-[17%] text-[9px] font-black text-brand-green">✦</span>
      <span data-spark className="absolute right-[5%] top-[10%] text-[8px] font-black text-brand-cyan">✦</span>
      <span data-spark className="absolute bottom-[7%] right-[12%] text-[7px] font-black text-brand-purple">✦</span>
    </>}

    {error && <span data-alert className="absolute -right-[2%] -top-[2%] grid size-[30%] min-h-4 min-w-4 place-items-center rounded-full border-2 border-white bg-red-500 text-[8px] font-black leading-none text-white shadow-[0_6px_18px_rgba(239,68,68,.28)]">!</span>}

    <div data-face className={`relative grid size-[62%] place-items-center rounded-[38%] border ${faceClass}`}>
      {error ? <>
        <span className="absolute left-[23%] top-[29%] text-[8px] font-black leading-none text-red-500">×</span>
        <span className="absolute right-[23%] top-[29%] text-[8px] font-black leading-none text-red-500">×</span>
        <span className="absolute bottom-[22%] h-[18%] w-[34%] rounded-t-full border-x-2 border-t-2 border-red-400" />
      </> : success ? <>
        <span data-eye className="absolute left-[25%] top-[31%] h-[8%] w-[14%] rounded-b-full border-b-2 border-brand-green" />
        <span data-eye className="absolute right-[25%] top-[31%] h-[8%] w-[14%] rounded-b-full border-b-2 border-brand-green" />
        <span className="absolute bottom-[21%] h-[18%] w-[38%] rounded-b-full border-b-2 border-brand-green" />
      </> : working ? <>
        <span data-eye className="absolute left-[25%] top-[31%] size-[9%] rounded-full bg-brand-purple/75" />
        <span data-eye className="absolute right-[25%] top-[31%] size-[9%] rounded-full bg-brand-purple/75" />
        <span className="absolute bottom-[25%] flex gap-[2px]"><i className="size-[3px] rounded-full bg-brand-cyan" /><i className="size-[3px] rounded-full bg-brand-cyan/70" /><i className="size-[3px] rounded-full bg-brand-cyan/40" /></span>
      </> : <>
        <span data-eye className="absolute left-[25%] top-[31%] size-[8%] rounded-full bg-brand-cyan/75" />
        <span data-eye className="absolute right-[25%] top-[31%] size-[8%] rounded-full bg-brand-cyan/75" />
        <span className={`absolute bottom-[23%] h-[13%] w-[32%] rounded-b-full border-b-2 ${selected ? 'border-brand-purple' : 'border-brand-cyan/70'}`} />
      </>}
    </div>
  </div>
}
