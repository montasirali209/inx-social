import {
  ArrowRight, Clapperboard, Paperclip, Sparkles, UserRound, WandSparkles,
} from 'lucide-react'
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
  return <div aria-hidden="true" className="ugc-motion-graphic">
    <div
      className="ugc-motion-ambient"
    />

    <div className="ugc-motion-topline">
      <span><WandSparkles className="size-3.5" /> UGC FLOW</span>
      <span className="ugc-motion-live"><i /> LIVE</span>
    </div>

    <div className="ugc-motion-stage">
      <div
        className="ugc-motion-orbit ugc-motion-orbit-outer"
      >
        <span className="ugc-motion-orbit-dot" />
      </div>
      <div
        className="ugc-motion-orbit ugc-motion-orbit-inner"
      >
        <span className="ugc-motion-orbit-dot secondary" />
      </div>

      <div
        className="ugc-motion-core"
      >
        <span
          className="ugc-motion-core-icon"
        >
          <Sparkles className="size-6" />
        </span>
        <strong>AI UGC</strong>
        <small>Idea to creator-ready video</small>
      </div>

      <div className="ugc-motion-route">
        <span
          className="ugc-motion-endpoint creator"
        >
          <UserRound className="size-4" />
        </span>
        <div className="ugc-motion-line">
          <i
          />
        </div>
        <span
          className="ugc-motion-endpoint video"
        >
          <Clapperboard className="size-4" />
        </span>
      </div>

      <span
        className="ugc-motion-particle particle-a"
      />
      <span
        className="ugc-motion-particle particle-b"
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
