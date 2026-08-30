import { Check, LoaderCircle, RefreshCw, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { enhancePostCaption } from '../../lib/posts-api'
import type { CaptionTone, EnhancementAction } from '../../types/posts'
import { Button } from '../ui/Button'

const labels: Record<EnhancementAction, string> = {
  rewrite: 'Rewrite',
  shorten: 'Shorten',
  expand: 'Expand',
  hashtags: 'Add Hashtags',
  cta: 'Improve CTA',
}

type Props = {
  action: EnhancementAction
  caption: string
  tone: CaptionTone
  onApply: (caption: string) => void
  onClose: () => void
}

export function CaptionEnhancementModal({ action, caption, tone, onApply, onClose }: Props) {
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function generate() {
    setLoading(true)
    setError('')
    try {
      const response = await enhancePostCaption(caption, action, tone)
      setResult(response.caption)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The caption could not be enhanced.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    enhancePostCaption(caption, action, tone)
      .then((response) => setResult(response.caption))
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'The caption could not be enhanced.'))
      .finally(() => setLoading(false))
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = previousOverflow }
  }, [action, caption, onClose, tone])

  return createPortal(
    <div className="posts-modal-backdrop fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-[#020914]/80 p-4 backdrop-blur-md" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
      <section aria-labelledby="caption-enhancement-title" aria-modal="true" className="posts-modal-panel my-auto w-full max-w-3xl overflow-hidden rounded-panel border border-brand-cyan/30 bg-panel shadow-[0_30px_120px_rgba(0,0,0,.65),0_0_70px_rgba(20,184,166,.12)]" role="dialog">
        <header className="relative overflow-hidden border-b border-border-soft bg-gradient-to-br from-brand-cyan/[0.12] via-panel to-panel px-5 py-5 sm:px-6">
          <div className="absolute -right-10 -top-12 size-44 rounded-full border border-brand-cyan/15 bg-brand-cyan/[0.05]" />
          <button aria-label="Close caption enhancement" className="absolute right-4 top-4 rounded-xl border border-border-soft bg-bg/45 p-2 text-text-muted transition hover:border-brand-cyan/35 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={onClose} type="button"><X className="size-4" /></button>
          <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><Sparkles className="size-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-brand-cyan">AI Content Enhancement</p><h2 className="mt-1 text-xl font-semibold" id="caption-enhancement-title">{labels[action]} caption</h2><p className="mt-1 text-xs text-text-muted">Review the OpenAI suggestion before applying it. Your original caption is preserved.</p></div></div>
        </header>
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <article className="rounded-2xl border border-border-soft bg-bg/30 p-4"><div className="mb-3 flex items-center justify-between"><strong className="text-xs">Original</strong><span className="text-[9px] uppercase tracking-wider text-text-soft">{caption.length} chars</span></div><p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-xs leading-6 text-text-muted">{caption}</p></article>
          <article className="relative min-h-48 rounded-2xl border border-brand-cyan/20 bg-brand-cyan/[0.035] p-4"><div className="mb-3 flex items-center justify-between"><strong className="text-xs text-brand-cyan">AI suggestion</strong><span className="rounded-full bg-brand-cyan/10 px-2 py-1 text-[9px] capitalize text-brand-cyan">{tone}</span></div>{loading ? <div className="grid min-h-32 place-items-center text-center"><span><LoaderCircle className="mx-auto size-7 animate-spin text-brand-cyan" /><span className="mt-3 block text-xs text-text-muted">Enhancing your caption…</span></span></div> : error ? <div className="rounded-xl border border-brand-red/25 bg-brand-red/8 p-3 text-xs leading-5 text-brand-red">{error}</div> : <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-xs leading-6 text-text-main">{result}</p>}</article>
        </div>
        <footer className="flex flex-col-reverse gap-2 border-t border-border-soft bg-bg/20 px-5 py-4 sm:flex-row sm:justify-end sm:px-6"><Button onClick={onClose} type="button" variant="ghost">Keep original</Button><Button disabled={loading} onClick={() => void generate()} type="button" variant="ghost"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />Try again</Button><Button disabled={loading || !result} onClick={() => { onApply(result); onClose() }} type="button" variant="primary"><Check className="size-4" />Apply to caption</Button></footer>
      </section>
    </div>,
    document.body,
  )
}
