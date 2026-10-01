import {
  ArrowRight, Clapperboard, Paperclip, Sparkles, UserRound, WandSparkles,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import type { CreateUGCCampaignInput, UGCAvatar } from '../../types/ugc-studio'

function asWebsite(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const candidate = /^(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/?#].*)?$/i.test(trimmed)
  if (!candidate) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function draftFromPrompt(value: string): Partial<CreateUGCCampaignInput> {
  const prompt = value.trim()
  const website = asWebsite(prompt)
  if (website) {
    return {
      sourceType: 'WEBSITE',
      productUrl: website,
      campaignType: 'AVATAR_EXPLAINER',
      creativeFormat: 'AUTO',
      notes: prompt,
    }
  }

  const lower = prompt.toLowerCase()
  const productIntent = /\b(product|unbox|unboxing|physical|packaging)\b/.test(lower)
  const websiteIntent = /\b(website|site|saas|software|app|service|platform)\b/.test(lower)

  if (productIntent) {
    return {
      sourceType: 'PRODUCT',
      productDescription: prompt,
      campaignType: 'PRODUCT_SHOWCASE',
      creativeFormat: /\bunbox(?:ing)?\b/.test(lower) ? 'UNBOXING' : 'AUTO',
      notes: prompt,
    }
  }

  if (websiteIntent) {
    return {
      sourceType: 'WEBSITE',
      productDescription: prompt,
      campaignType: 'AVATAR_EXPLAINER',
      creativeFormat: 'AUTO',
      notes: prompt,
    }
  }

  return {
    sourceType: 'BRIEF',
    productDescription: prompt,
    campaignType: 'AUTO',
    creativeFormat: 'AUTO',
    notes: prompt,
  }
}

function UGCMotionGraphic() {
  const reduceMotion = useReducedMotion()
  const infinite = reduceMotion ? undefined : { repeat: Infinity, repeatType: 'loop' as const }

  return <div aria-hidden="true" className="ugc-motion-graphic">
    <motion.div
      animate={reduceMotion ? undefined : { opacity: [.38, .68, .38], scale: [.94, 1.06, .94] }}
      className="ugc-motion-ambient"
      transition={{ duration: 5.5, ease: 'easeInOut', ...infinite }}
    />

    <div className="ugc-motion-topline">
      <span><WandSparkles className="size-3.5" /> UGC FLOW</span>
      <span className="ugc-motion-live"><i /> LIVE</span>
    </div>

    <div className="ugc-motion-stage">
      <motion.div
        animate={reduceMotion ? undefined : { rotate: 360 }}
        className="ugc-motion-orbit ugc-motion-orbit-outer"
        transition={{ duration: 18, ease: 'linear', ...infinite }}
      >
        <span className="ugc-motion-orbit-dot" />
      </motion.div>
      <motion.div
        animate={reduceMotion ? undefined : { rotate: -360 }}
        className="ugc-motion-orbit ugc-motion-orbit-inner"
        transition={{ duration: 13, ease: 'linear', ...infinite }}
      >
        <span className="ugc-motion-orbit-dot secondary" />
      </motion.div>

      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -5, 0], scale: [1, 1.025, 1] }}
        className="ugc-motion-core"
        transition={{ duration: 4.2, ease: 'easeInOut', ...infinite }}
      >
        <motion.span
          animate={reduceMotion ? undefined : { rotate: [0, 10, -8, 0] }}
          className="ugc-motion-core-icon"
          transition={{ duration: 4.8, ease: 'easeInOut', ...infinite }}
        >
          <Sparkles className="size-6" />
        </motion.span>
        <strong>AI UGC</strong>
        <small>Idea to creator-ready video</small>
      </motion.div>

      <div className="ugc-motion-route">
        <motion.span
          animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
          className="ugc-motion-endpoint creator"
          transition={{ duration: 3.6, ease: 'easeInOut', ...infinite }}
        >
          <UserRound className="size-4" />
        </motion.span>
        <div className="ugc-motion-line">
          <motion.i
            animate={reduceMotion ? undefined : { left: ['0%', 'calc(100% - 10px)'], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2.6, ease: 'easeInOut', ...infinite }}
          />
        </div>
        <motion.span
          animate={reduceMotion ? undefined : { y: [0, 3, 0] }}
          className="ugc-motion-endpoint video"
          transition={{ duration: 3.9, ease: 'easeInOut', ...infinite }}
        >
          <Clapperboard className="size-4" />
        </motion.span>
      </div>

      <motion.span
        animate={reduceMotion ? undefined : { x: [0, 8, 0], y: [0, -8, 0], opacity: [.45, 1, .45] }}
        className="ugc-motion-particle particle-a"
        transition={{ duration: 4.1, ease: 'easeInOut', ...infinite }}
      />
      <motion.span
        animate={reduceMotion ? undefined : { x: [0, -6, 0], y: [0, 7, 0], opacity: [.3, .8, .3] }}
        className="ugc-motion-particle particle-b"
        transition={{ duration: 5.2, ease: 'easeInOut', ...infinite }}
      />
    </div>

    <div className="ugc-motion-footer">
      <span>Creator</span><i /><span>AI direction</span><i /><span>Video</span>
    </div>
  </div>
}

export function UGCAgentHero({
  onStart,
}: {
  onStart: (draft?: Partial<CreateUGCCampaignInput>) => void
  creator?: UGCAvatar | null
  offerImageUrl?: string | null
  ugcVideoUrl?: string | null
}) {
  const [input, setInput] = useState('')
  const examples = [
    { label: 'Promote my website', draft: { sourceType: 'WEBSITE', campaignType: 'AVATAR_EXPLAINER', creativeFormat: 'AUTO' } },
    { label: 'Create an app demo', draft: { sourceType: 'WEBSITE', campaignType: 'AVATAR_EXPLAINER', creativeFormat: 'AUTO', productDescription: 'Create an app demo' } },
    { label: 'Make a product unboxing', draft: { sourceType: 'PRODUCT', campaignType: 'PRODUCT_SHOWCASE', creativeFormat: 'UNBOXING', productDescription: 'Make a product unboxing' } },
  ] satisfies Array<{ label: string; draft: Partial<CreateUGCCampaignInput> }>

  function submit(value = input) {
    const prompt = value.trim()
    if (!prompt) return
    onStart(draftFromPrompt(prompt))
    setInput('')
  }

  return <section className="ugc-agent-hero" id="ugc-launcher">
    <div className="ugc-agent-headline">
      <span className="ugc-home-kicker"><Sparkles className="size-3.5" />CREATOR CAMPAIGNS</span>
      <h1>Turn an offer into <em>believable</em> social video.</h1>
      <p>Describe what you want, paste a website, or choose a starting point. INXSocial opens the campaign setup with the relevant fields already selected.</p>
    </div>

    <div className="ugc-agent-center">
      <div className="ugc-agent-launch-label">What do you want to create?</div>
      <div className="ugc-agent-input-shell">
        <button
          aria-label="Start with product photos"
          className="ugc-agent-attach"
          onClick={() => onStart({ sourceType: 'PRODUCT', campaignType: 'PRODUCT_SHOWCASE', creativeFormat: 'AUTO' })}
          type="button"
        >
          <Paperclip className="size-4" />
        </button>
        <input
          aria-label="Describe the UGC ad you want"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
          placeholder="Describe your campaign, paste a website, product or service…"
          value={input}
        />
        <button aria-label="Open UGC campaign setup" className="ugc-agent-send" disabled={!input.trim()} onClick={() => submit()} type="button">
          <ArrowRight className="size-4" />
        </button>
      </div>

      <div className="ugc-agent-examples">
        <span>Try an example:</span>
        {examples.map((example) => <button key={example.label} onClick={() => onStart(example.draft)} type="button">{example.label}</button>)}
      </div>
      <button className="ugc-agent-manual" onClick={() => onStart()} type="button">Customize everything manually</button>
    </div>

    <UGCMotionGraphic />
  </section>
}
