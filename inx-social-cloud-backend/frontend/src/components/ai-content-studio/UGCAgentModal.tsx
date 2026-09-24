import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight, CheckCircle2, Image as ImageIcon, LoaderCircle, Paperclip, Settings2,
  Sparkles, UserRound, UsersRound, WandSparkles, X,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
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

function AvatarImage({ avatar }: { avatar: UGCAvatar }) {
  const [loaded, setLoaded] = useState<{ avatarId: string; url: string } | null>(null)

  useEffect(() => {
    let active = true
    let created: string | null = null
    if (!avatar.imageUrl) return undefined
    void fetchUGCAvatarImage(avatar).then((value) => {
      if (!value) return
      if (!active) { URL.revokeObjectURL(value); return }
      created = value
      setLoaded({ avatarId: avatar.id, url: value })
    })
    return () => { active = false; if (created) URL.revokeObjectURL(created) }
  }, [avatar])

  const url = loaded?.avatarId === avatar.id ? loaded.url : null
  return url
    ? <img alt="" className="size-full object-cover" src={url} />
    : <div className="grid size-full place-items-center bg-[#0a1c28] text-brand-cyan"><UserRound className="size-5" /></div>
}

function readableFormat(value?: string) {
  return String(value || 'AUTO').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function UGCAgentModal({
  initialPrompt,
  avatars,
  selectedCreator,
  onCreatorChange,
  onClose,
  onCampaignCreated,
  onManualSetup,
  onToast,
}: {
  initialPrompt?: string
  avatars: UGCAvatar[]
  selectedCreator: UGCAvatar | null
  onCreatorChange: (avatar: UGCAvatar | null) => void
  onClose: () => void
  onCampaignCreated: (campaign: UGCCampaign) => void
  onManualSetup: (draft?: Partial<CreateUGCCampaignInput>) => void
  onToast: (message: string) => void
}) {
  const queryClient = useQueryClient()
  const seededPrompt = initialPrompt?.trim() || ''
  const [messages, setMessages] = useState<UGCAgentMessage[]>(seededPrompt ? [{ role: 'user', content: seededPrompt }] : [])
  const [result, setResult] = useState<UGCAgentResponse | null>(null)
  const [input, setInput] = useState('')
  const [assets, setAssets] = useState<UGCProductAsset[]>([])
  const [thinking, setThinking] = useState(Boolean(seededPrompt))
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [creatorPickerOpen, setCreatorPickerOpen] = useState(false)
  const [startedCampaignId, setStartedCampaignId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const threadRef = useRef<HTMLDivElement | null>(null)
  const initialRequestStarted = useRef(false)

  const selectedAvatarId = selectedCreator?.id || null
  const creatorList = useMemo(() => avatars.slice(0, 100), [avatars])

  useEffect(() => {
    if (!seededPrompt || initialRequestStarted.current) return
    initialRequestStarted.current = true
    let active = true
    void sendUGCAgentMessage({
      messages: [{ role: 'user', content: seededPrompt }],
      selectedAvatarId,
      productAssetIds: [],
      currentPlan: undefined,
    }).then((response) => {
      if (!active) return
      setResult(response)
      setMessages([{ role: 'user', content: seededPrompt }, { role: 'assistant', content: response.reply }])
    }).catch((error) => {
      if (!active) return
      onToast(error instanceof Error ? error.message : 'The UGC Agent could not respond.')
    }).finally(() => {
      if (active) setThinking(false)
    })
    return () => { active = false }
  }, [onToast, seededPrompt, selectedAvatarId])

  useEffect(() => {
    const thread = threadRef.current
    if (!thread) return
    window.requestAnimationFrame(() => {
      thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' })
    })
  }, [messages, thinking, result?.readyToGenerate])

  useEffect(() => {
    const timer = window.setTimeout(() => composerRef.current?.focus(), 180)
    return () => window.clearTimeout(timer)
  }, [])

  async function runAgent(text: string, overrideAssets = assets, avatarId = selectedAvatarId) {
    const content = text.trim()
    if (!content || thinking || generating) return
    const nextMessages: UGCAgentMessage[] = [...messages, { role: 'user', content }]
    setMessages(nextMessages)
    setInput('')
    setThinking(true)
    try {
      const response = await sendUGCAgentMessage({
        messages: nextMessages,
        productAssetIds: overrideAssets.map((asset) => asset.id),
        selectedAvatarId: avatarId,
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
      await runAgent('I added a product/reference image. Use it when planning this campaign.', nextAssets)
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'The reference image could not be uploaded.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function chooseCreator(avatar: UGCAvatar | null) {
    onCreatorChange(avatar)
    setCreatorPickerOpen(false)
    if (avatar) void runAgent(`Use ${avatar.name} as the creator for this campaign.`, assets, avatar.id)
    else void runAgent('Choose the creator automatically for this campaign.', assets, null)
  }

  function manualDraft(): Partial<CreateUGCCampaignInput> {
    const plan = result?.plan || {}
    return {
      ...plan,
      productAssetIds: assets.map((asset) => asset.id),
      avatarId: selectedAvatarId,
      creatorMode: selectedAvatarId ? 'SELECTED' : 'AUTO',
    }
  }

  async function generate() {
    if (!result?.readyToGenerate || !result.estimate || generating || startedCampaignId) return
    if (!result.estimate.affordability.affordable) {
      onToast(`This setup needs ${result.estimate.credits} credits. Adjust the campaign or add credits first.`)
      return
    }
    setGenerating(true)
    try {
      const campaign = await createUGCCampaign({
        ...result.plan,
        productAssetIds: assets.map((asset) => asset.id),
        avatarId: selectedAvatarId,
        creatorMode: selectedAvatarId ? 'SELECTED' : 'AUTO',
      })
      setStartedCampaignId(campaign.id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['ai-studio-access'] }),
      ])
      onCampaignCreated(campaign)
      onToast(campaign.adCount === 1 ? 'Your UGC ad is rendering.' : `${campaign.adCount} UGC ads are rendering.`)
      onClose()
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

  return createPortal(<div className="ugc-agent-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }} role="presentation">
    <section aria-label="UGC Agent" aria-modal="true" className="ugc-agent-modal" role="dialog">
      <header className="ugc-agent-modal-header">
        <div className="ugc-agent-modal-title">
          <span><Sparkles className="size-4" /></span>
          <div><strong>UGC Agent</strong><small>Tell me what you want to create. I’ll work it out with you.</small></div>
        </div>
        <div className="ugc-agent-modal-header-actions">
          <button className="ugc-agent-modal-manual" onClick={() => onManualSetup(manualDraft())} type="button"><Settings2 className="size-3.5" />Customize manually</button>
          <button aria-label="Close UGC Agent" className="ugc-agent-modal-close" onClick={onClose} type="button"><X className="size-4" /></button>
        </div>
      </header>

      <div className="ugc-agent-modal-body">
        <div className="ugc-agent-modal-thread" ref={threadRef}>
          {!messages.length && <div className="ugc-agent-welcome">
            <span><WandSparkles className="size-6" /></span>
            <h2>What would you like to create?</h2>
            <p>Explain it naturally. You can say “promote my website”, paste a URL, describe a product, or ask for a particular style of UGC ad.</p>
            <div>
              {['Promote my website', 'Create an ad for my app', 'Make a product demo'].map((example) => <button key={example} onClick={() => void runAgent(example)} type="button">{example}</button>)}
            </div>
          </div>}

          {messages.map((message, index) => <div className={`ugc-agent-modal-message ${message.role}`} key={index}>
            {message.role === 'assistant' && <span className="ugc-agent-modal-avatar"><Sparkles className="size-4" /></span>}
            <div>{message.content}</div>
          </div>)}

          {thinking && <div className="ugc-agent-modal-message assistant">
            <span className="ugc-agent-modal-avatar"><LoaderCircle className="size-4 animate-spin" /></span>
            <div className="ugc-agent-thinking">Thinking about your campaign…</div>
          </div>}

          {result?.brand && <section className="ugc-agent-modal-source">
            <div><span>Understood from your website</span><strong>{result.brand.productName || result.brand.name}</strong></div>
            {result.brand.summary && <p>{result.brand.summary}</p>}
            {result.brand.verifiedClaims?.length ? <ul>{result.brand.verifiedClaims.slice(0, 3).map((claim) => <li key={claim}>{claim}</li>)}</ul> : null}
            {result.foundReferences?.length ? <div className="ugc-agent-modal-references">{result.foundReferences.slice(0, 5).map((reference, index) => <figure key={reference.url + index}><img alt={reference.label || 'Website reference'} referrerPolicy="no-referrer" src={reference.url} /><figcaption>{reference.kind}</figcaption></figure>)}</div> : null}
          </section>}

          {result?.quickReplies?.length ? <div className="ugc-agent-modal-quick">{result.quickReplies.map((reply) => <button disabled={thinking} key={reply} onClick={() => quickReply(reply)} type="button">{reply}</button>)}</div> : null}

          {result?.readyToGenerate && result.estimate && <section className="ugc-agent-modal-plan">
            <div className="ugc-agent-modal-plan-head">
              <div><span>Campaign ready</span><strong>{result.brand?.productName || result.brand?.name || result.plan.productDescription || 'UGC campaign'}</strong></div>
              <span className="ugc-agent-modal-credit">{result.estimate.credits} credits</span>
            </div>
            <div className="ugc-agent-modal-plan-grid">
              <div><span>Length</span><strong>{result.plan.duration}s</strong></div>
              <div><span>Variations</span><strong>{result.plan.adCount}</strong></div>
              <div><span>Quality</span><strong>{result.plan.quality === 'PREMIUM' ? 'Premium' : 'Standard'}</strong></div>
              <div><span>Format</span><strong>{readableFormat(result.plan.creativeFormat)}</strong></div>
            </div>
            <div className="ugc-agent-modal-plan-actions">
              <button onClick={() => onManualSetup(manualDraft())} type="button"><Settings2 className="size-3.5" />Customize</button>
              <Button disabled={!result.estimate.affordability.affordable || generating || Boolean(startedCampaignId)} onClick={() => void generate()} variant="primary">
                {generating ? <LoaderCircle className="size-4 animate-spin" /> : startedCampaignId ? <CheckCircle2 className="size-4" /> : <ArrowRight className="size-4" />}
                {startedCampaignId ? 'Rendering' : 'Generate'}
              </Button>
            </div>
            {!result.estimate.affordability.affordable && <p className="ugc-agent-modal-shortfall">You need {result.estimate.affordability.shortfall} more credits for this setup.</p>}
          </section>}
        </div>

        <aside className="ugc-agent-modal-context">
          <div className="ugc-agent-modal-context-head"><span>Campaign context</span><small>Optional controls</small></div>
          <button className="ugc-agent-modal-creator-control" onClick={() => setCreatorPickerOpen((value) => !value)} type="button">
            {selectedCreator ? <span className="ugc-agent-modal-selected-avatar"><AvatarImage avatar={selectedCreator} /></span> : <span className="ugc-agent-modal-selected-avatar auto"><UsersRound className="size-5" /></span>}
            <div><small>Creator</small><strong>{selectedCreator?.name || 'Auto select'}</strong></div>
            <ArrowRight className="size-3.5" />
          </button>

          {creatorPickerOpen && <div className="ugc-agent-modal-creators">
            <button className={!selectedCreator ? 'selected' : ''} onClick={() => chooseCreator(null)} type="button"><span className="auto"><UsersRound className="size-5" /></span><strong>Auto</strong></button>
            {creatorList.map((avatar) => <button className={selectedCreator?.id === avatar.id ? 'selected' : ''} key={avatar.id} onClick={() => chooseCreator(avatar)} type="button"><span><AvatarImage avatar={avatar} /></span><strong>{avatar.name}</strong></button>)}
          </div>}

          <button className="ugc-agent-modal-reference-control" onClick={() => fileInputRef.current?.click()} type="button">
            {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
            <div><strong>Add product/reference image</strong><small>PNG, JPEG or WebP</small></div>
          </button>
          <input accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void attachProduct(event.target.files?.[0])} ref={fileInputRef} type="file" />

          {assets.length ? <div className="ugc-agent-modal-assets">{assets.map((asset) => <span key={asset.id}><ImageIcon className="size-3.5" /><em>{asset.originalName}</em><button aria-label="Remove reference" onClick={() => setAssets((current) => current.filter((item) => item.id !== asset.id))} type="button"><X className="size-3" /></button></span>)}</div> : null}

          <div className="ugc-agent-modal-context-note"><Sparkles className="size-3.5" /><p>You do not need to configure everything here. The Agent can choose the structure, creator and defaults automatically.</p></div>
        </aside>
      </div>

      <footer className="ugc-agent-modal-composer">
        <button aria-label="Attach product or reference image" disabled={uploading} onClick={() => fileInputRef.current?.click()} type="button"><Paperclip className="size-4" /></button>
        <textarea
          aria-label="Message the UGC Agent"
          disabled={thinking || generating}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void runAgent(input)
            }
          }}
          placeholder="Message the UGC Agent…"
          ref={composerRef}
          rows={1}
          value={input}
        />
        <button aria-label="Send message" className="send" disabled={!input.trim() || thinking || generating} onClick={() => void runAgent(input)} type="button">{thinking ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}</button>
      </footer>
    </section>
  </div>, document.body)
}
