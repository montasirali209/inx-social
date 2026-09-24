import {
  ArrowRight, Box, Clapperboard, Globe2, PackageOpen, Paperclip, Play, Sparkles, UsersRound,
} from 'lucide-react'
import { useState } from 'react'
import type { CreateUGCCampaignInput } from '../../types/ugc-studio'

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

export function UGCAgentHero({
  onStart,
}: {
  onStart: (draft?: Partial<CreateUGCCampaignInput>) => void
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

    <div aria-hidden="true" className="ugc-agent-visual-flow">
      <div className="ugc-agent-visual-card creator">
        <div className="ugc-agent-visual-image grid place-items-center"><UsersRound className="size-7 text-brand-cyan" /></div>
        <UsersRound className="size-4" /><span>Creator</span>
      </div>
      <div className="ugc-agent-visual-card product">
        <div className="ugc-agent-product-orb"><Box className="size-7" /></div>
        <Globe2 className="size-4" /><span>Offer</span>
      </div>
      <div className="ugc-agent-visual-card output">
        <div className="ugc-agent-output-frame grid place-items-center"><Clapperboard className="size-8 text-brand-cyan" /><span><Play className="size-5 fill-current" /></span></div>
        <PackageOpen className="size-4" /><span>UGC Ad</span>
      </div>
    </div>
  </section>
}
