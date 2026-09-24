import {
  ArrowRight, Box, Clapperboard, Paperclip, Play, Sparkles, UsersRound, X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchUGCAvatarImage } from '../../lib/ugc-studio-api'
import type { CreateUGCCampaignInput, UGCAvatar } from '../../types/ugc-studio'

function CreatorVisual({ avatar }: { avatar: UGCAvatar | null }) {
  const [loaded, setLoaded] = useState<{ avatarId: string; url: string } | null>(null)

  useEffect(() => {
    let active = true
    let created: string | null = null
    if (!avatar?.imageUrl) return undefined
    void fetchUGCAvatarImage(avatar).then((value) => {
      if (!value) return
      if (!active) { URL.revokeObjectURL(value); return }
      created = value
      setLoaded({ avatarId: avatar.id, url: value })
    })
    return () => { active = false; if (created) URL.revokeObjectURL(created) }
  }, [avatar])

  const url = avatar && loaded?.avatarId === avatar.id ? loaded.url : null
  return url
    ? <img alt="" className="size-full object-cover" src={url} />
    : <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_50%_25%,rgba(45,212,191,.22),transparent_70%),#081b28] text-brand-cyan"><UsersRound className="size-6" /></div>
}

export function UGCAgentHero({
  featuredCreator,
  selectedCreator,
  onClearCreator,
  onOpenAgent,
  onManualSetup,
}: {
  featuredCreator: UGCAvatar | null
  selectedCreator: UGCAvatar | null
  onClearCreator: () => void
  onOpenAgent: (initialPrompt?: string) => void
  onManualSetup: (draft?: Partial<CreateUGCCampaignInput>) => void
}) {
  const [input, setInput] = useState('')
  const creator = selectedCreator || featuredCreator
  const examples = ['Promote my website', 'Create an app demo', 'Make a product unboxing']

  function submit(value = input) {
    const prompt = value.trim()
    onOpenAgent(prompt)
    if (prompt) setInput('')
  }

  return <section className="ugc-agent-hero" id="ugc-agent-composer">
    <div className="ugc-agent-headline">
      <span className="ugc-home-kicker"><Sparkles className="size-3.5" />CREATOR CAMPAIGNS</span>
      <h1>Turn an offer into <em>believable</em> social video.</h1>
      <p>Describe what you want in your own words. The UGC Agent will open and build the campaign with you.</p>
    </div>

    <div className="ugc-agent-center">
      <div className="ugc-agent-launch-label">What do you want to create?</div>
      <div className="ugc-agent-input-shell">
        <button aria-label="Open UGC Agent to add a reference" className="ugc-agent-attach" onClick={() => onOpenAgent('')} type="button">
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
          placeholder={selectedCreator ? `Tell me what you want ${selectedCreator.name} to promote…` : 'Describe your campaign, website, product or service…'}
          value={input}
        />
        <button aria-label="Open UGC Agent" className="ugc-agent-send" disabled={!input.trim()} onClick={() => submit()} type="button">
          <ArrowRight className="size-4" />
        </button>
      </div>

      {selectedCreator && <div className="ugc-agent-context">
        <span><UsersRound className="size-3" />{selectedCreator.name}<button aria-label="Use automatic creator selection" onClick={onClearCreator} type="button"><X className="size-3" /></button></span>
      </div>}

      <div className="ugc-agent-examples"><span>Try an example:</span>{examples.map((example) => <button key={example} onClick={() => submit(example)} type="button">{example}</button>)}</div>
      <button className="ugc-agent-manual" onClick={() => onManualSetup()} type="button">Customize everything manually</button>
    </div>

    <div aria-hidden="true" className="ugc-agent-visual-flow">
      <div className="ugc-agent-visual-card creator">
        <div className="ugc-agent-visual-image"><CreatorVisual avatar={creator} /></div>
        <UsersRound className="size-4" /><span>Creator</span>
      </div>
      <div className="ugc-agent-visual-card product">
        <div className="ugc-agent-product-orb"><Box className="size-7" /></div>
        <Box className="size-4" /><span>Offer</span>
      </div>
      <div className="ugc-agent-visual-card output">
        <div className="ugc-agent-output-frame"><CreatorVisual avatar={creator} /><span><Play className="size-5 fill-current" /></span></div>
        <Clapperboard className="size-4" /><span>UGC Ad</span>
      </div>
    </div>
  </section>
}
