import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight, Box, CheckCircle2, Clapperboard, Image as ImageIcon, LoaderCircle,
  Paperclip, Play, SendHorizontal, Sparkles, UsersRound, X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  createUGCCampaign,
  fetchUGCAvatarImage,
  sendUGCAgentMessage,
  uploadUGCProductAsset,
} from '../../lib/ugc-studio-api'
import type {
  CreateUGCCampaignInput,
  UGCAgentMessage,
  UGCAgentResponse,
  UGCAvatar,
  UGCCampaign,
  UGCProductAsset,
} from '../../types/ugc-studio'
import { Button } from '../ui/Button'

function CreatorVisual({ avatar }: { avatar: UGCAvatar | null }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    let created: string | null = null
    setUrl(null)
    if (!avatar?.imageUrl) return undefined
    void fetchUGCAvatarImage(avatar).then((value) => {
      if (!value) return
      if (!active) { URL.revokeObjectURL(value); return }
      created = value
      setUrl(value)
    })
    return () => { active = false; if (created) URL.revokeObjectURL(created) }
  }, [avatar])
  return url
    ? <img alt="" className="size-full object-cover" src={url} />
    : <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_50%_25%,rgba(45,212,191,.22),transparent_70%),#081b28] text-brand-cyan"><UsersRound className="size-6" /></div>
}

function planLabel(plan: CreateUGCCampaignInput) {
  const format = String(plan.creativeFormat || 'AUTO').replaceAll('_', ' ').toLowerCase()
  return [
    `${plan.adCount} variation${plan.adCount === 1 ? '' : 's'}`,
    `${plan.duration}s`,
    plan.quality === 'PREMIUM' ? 'Premium' : 'Standard',
    format === 'auto' ? 'Auto creative' : format.replace(/\b\w/g, (letter) => letter.toUpperCase()),
  ]
}

export function UGCAgentHero({
  featuredCreator,
  selectedCreator,
  onClearCreator,
  onCampaignCreated,
  onManualSetup,
  onToast,
}: {
  featuredCreator: UGCAvatar | null
  selectedCreator: UGCAvatar | null
  onClearCreator: () => void
  onCampaignCreated: (campaign: UGCCampaign) => void
  onManualSetup: (draft?: Partial<CreateUGCCampaignInput>) => void
  onToast: (message: string) => void
}) {
  const queryClient = useQueryClient()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<UGCAgentMessage[]>([])
  const [result, setResult] = useState<UGCAgentResponse | null>(null)
  const [assets, setAssets] = useState<UGCProductAsset[]>([])
  const [thinking, setThinking] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [startedCampaignId, setStartedCampaignId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const creator = selectedCreator || featuredCreator
  const selectedAvatarId = selectedCreator?.id || null

  useEffect(() => {
    if (selectedCreator) inputRef.current?.focus()
  }, [selectedCreator])

  async function runAgent(text: string, overrideAssets = assets) {
    const content = text.trim()
    if (!content || thinking) return
    const nextMessages: UGCAgentMessage[] = [...messages, { role: 'user', content }]
    setMessages(nextMessages)
    setInput('')
    setThinking(true)
    try {
      const response = await sendUGCAgentMessage({
        messages: nextMessages,
        productAssetIds: overrideAssets.map((asset) => asset.id),
        selectedAvatarId,
        currentPlan: result?.plan,
      })
      setResult(response)
      setMessages([...nextMessages, { role: 'assistant', content: response.reply }])
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'The UGC Agent could not respond.')
    } finally {
      setThinking(false)
    }
  }

  async function attachProduct(file: File | undefined) {
    if (!file || uploading) return
    if (!['image/png','image/jpeg','image/webp'].includes(file.type)) {
      onToast('Add a PNG, JPEG or WebP product/reference image.')
      return
    }
    setUploading(true)
    try {
      const asset = await uploadUGCProductAsset(file, result?.brand?.id || null)
      const nextAssets = [...assets.filter((item) => item.id !== asset.id), asset].slice(0, 8)
      setAssets(nextAssets)
      onToast('Reference image added.')
      if (messages.length) await runAgent('Use the attached product/reference image for this UGC ad.', nextAssets)
      else inputRef.current?.focus()
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'The reference image could not be uploaded.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function generate() {
    if (!result?.readyToGenerate || !result.estimate || generating || startedCampaignId) return
    if (!result.estimate.affordability.affordable) {
      onToast(`This setup needs ${result.estimate.credits} credits. Adjust the plan or add credits first.`)
      return
    }
    setGenerating(true)
    try {
      const productAssetIds = assets.map((asset) => asset.id).slice(0, 8)
      const campaign = await createUGCCampaign({
        ...result.plan,
        productAssetIds,
        avatarId: selectedAvatarId || null,
        creatorMode: selectedAvatarId ? 'SELECTED' : 'AUTO',
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['ai-studio-access'] }),
      ])
      setStartedCampaignId(campaign.id)
      setMessages((current) => [...current, { role: 'assistant', content: 'Your UGC campaign is now rendering. You can keep working in the Studio while it finishes.' }])
      onCampaignCreated(campaign)
      onToast(campaign.adCount === 1 ? 'Your UGC ad is rendering.' : `${campaign.adCount} UGC ads are rendering.`)
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'The UGC campaign could not be started.')
    } finally {
      setGenerating(false)
    }
  }

  function quickReply(value: string) {
    if (/upload|add (?:an? )?(?:image|reference)/i.test(value)) {
      fileInputRef.current?.click()
      return
    }
    void runAgent(value)
  }

  const plan = result?.plan
  const showConversation = Boolean(messages.length || result)
  const examples = ['UGC ad for a skincare product', 'App demo with creator', 'Product unboxing video']

  return <section className={`ugc-agent-hero ${showConversation ? 'active' : ''}`} id="ugc-agent-composer">
    <div className="ugc-agent-headline">
      <span className="ugc-home-kicker"><Sparkles className="size-3.5" />CREATOR CAMPAIGNS</span>
      <h1>Turn an offer into <em>believable</em> social video.</h1>
      <p>Tell the UGC Agent what you want. Add a URL, product image or reference and it will build the campaign for you.</p>
    </div>

    <div className="ugc-agent-center">
      {showConversation && <div className="ugc-agent-thread" aria-live="polite">
        {messages.slice(-4).map((message, index) => <div className={`ugc-agent-message ${message.role}`} key={index}>
          {message.role === 'assistant' && <Sparkles className="size-3.5 shrink-0" />}
          <span>{message.content}</span>
        </div>)}
        {thinking && <div className="ugc-agent-message assistant"><LoaderCircle className="size-3.5 animate-spin" /><span>Understanding your request…</span></div>}
        {result?.brand && <div className="ugc-agent-source-summary">
          <div><span>Product understood</span><strong>{result.brand.productName || result.brand.name}</strong></div>
          {result.brand.verifiedClaims?.length ? <p>{result.brand.verifiedClaims.slice(0,3).join(' · ')}</p> : result.brand.summary ? <p>{result.brand.summary}</p> : null}
        </div>}
        {result?.foundReferences?.length ? <div className="ugc-agent-found">
          <span>Website references found</span>
          <div>{result.foundReferences.slice(0,4).map((reference, index) => <figure key={reference.url + index}>
            <img alt={reference.label || 'Website reference'} loading="lazy" referrerPolicy="no-referrer" src={reference.url} />
            <figcaption>{reference.kind || 'reference'}</figcaption>
          </figure>)}</div>
        </div> : null}
      </div>}

      <div className="ugc-agent-input-shell">
        <button aria-label="Add product or reference image" className="ugc-agent-attach" disabled={uploading} onClick={() => fileInputRef.current?.click()} type="button">
          {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
        </button>
        <input
          aria-label="Tell the UGC Agent what you want to create"
          disabled={thinking || generating}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void runAgent(input)
            }
          }}
          placeholder={selectedCreator ? `Tell me what you want ${selectedCreator.name} to advertise…` : 'Describe your product, paste a URL, or tell me the UGC ad you want…'}
          ref={inputRef}
          value={input}
        />
        <button aria-label="Send to UGC Agent" className="ugc-agent-send" disabled={!input.trim() || thinking || generating} onClick={() => void runAgent(input)} type="button">
          {thinking ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
        </button>
        <input accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void attachProduct(event.target.files?.[0])} ref={fileInputRef} type="file" />
      </div>

      {(assets.length > 0 || selectedCreator) && <div className="ugc-agent-context">
        {assets.map((asset) => <span key={asset.id}><ImageIcon className="size-3" />{asset.originalName}<button aria-label="Remove reference" onClick={() => setAssets((current) => current.filter((item) => item.id !== asset.id))} type="button"><X className="size-3" /></button></span>)}
        {selectedCreator && <span><UsersRound className="size-3" />{selectedCreator.name}<button aria-label="Use auto creator instead" onClick={onClearCreator} type="button"><X className="size-3" /></button></span>}
      </div>}

      {!showConversation && <div className="ugc-agent-examples"><span>Try an example:</span>{examples.map((example) => <button key={example} onClick={() => void runAgent(example)} type="button">{example}</button>)}</div>}

      {result?.quickReplies?.length ? <div className="ugc-agent-quick-replies">{result.quickReplies.map((reply) => <button disabled={thinking} key={reply} onClick={() => quickReply(reply)} type="button">{reply}</button>)}</div> : null}

      {result?.readyToGenerate && plan && result.estimate && <div className="ugc-agent-plan">
        <div className="ugc-agent-plan-copy">
          <span>Ready to create</span>
          <strong>{result.brand?.productName || result.brand?.name || plan.productDescription || 'UGC campaign'}</strong>
          <div>{planLabel(plan).map((item) => <small key={item}>{item}</small>)}</div>
        </div>
        <div className="ugc-agent-plan-price">
          <strong>{result.estimate.credits} credits</strong>
          <span>{result.estimate.affordability.affordable ? `${result.estimate.affordability.balanceAfter} left after generation` : `${result.estimate.affordability.shortfall} credits short`}</span>
        </div>
        <div className="ugc-agent-plan-actions">
          <button className="ugc-agent-adjust" onClick={() => onManualSetup({
            ...plan,
            productAssetIds: assets.map((asset) => asset.id),
            avatarId: selectedAvatarId || null,
            creatorMode: selectedAvatarId ? 'SELECTED' : 'AUTO',
          })} type="button">Adjust details</button>
          <Button disabled={!result.estimate.affordability.affordable || generating || Boolean(startedCampaignId)} onClick={() => void generate()} variant="primary">
            {generating ? <LoaderCircle className="size-4 animate-spin" /> : startedCampaignId ? <CheckCircle2 className="size-4" /> : <SendHorizontal className="size-4" />}{startedCampaignId ? 'Rendering' : 'Generate'}
          </Button>
        </div>
      </div>}
      {!showConversation && <button className="ugc-agent-manual" onClick={() => onManualSetup()} type="button">Prefer to set everything yourself? Adjust details</button>}
    </div>

    <div aria-hidden="true" className="ugc-agent-visual-flow">
      <div className="ugc-agent-visual-card creator">
        <div className="ugc-agent-visual-image"><CreatorVisual avatar={creator} /></div>
        <UsersRound className="size-4" /><span>Creator</span>
      </div>
      <div className="ugc-agent-visual-card product">
        <div className="ugc-agent-product-orb"><Box className="size-7" /></div>
        <Box className="size-4" /><span>Product</span>
      </div>
      <div className="ugc-agent-visual-card output">
        <div className="ugc-agent-output-frame"><CreatorVisual avatar={creator} /><span><Play className="size-5 fill-current" /></span></div>
        <Clapperboard className="size-4" /><span>UGC Ad</span>
      </div>
      {result?.readyToGenerate && <span className="ugc-agent-ready"><CheckCircle2 className="size-3.5" />Plan ready</span>}
    </div>
  </section>
}
