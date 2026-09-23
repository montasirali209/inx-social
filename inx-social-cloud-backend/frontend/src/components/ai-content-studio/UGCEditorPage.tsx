import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, CalendarRange, Captions, Clapperboard, Coins, LoaderCircle,
  Music2, RefreshCcw, Save, Sparkles, UserRound, Volume2, WandSparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchMediaLibrary } from '../../lib/media-library-api'
import {
  fetchUGCAvatarImage, getUGCAd, getUGCOverview, regenerateUGCAd,
  regenerateUGCScene, updateUGCAd,
} from '../../lib/ugc-studio-api'
import type { MediaAsset } from '../../types/media-library'
import type { UGCAvatar, UGCAd } from '../../types/ugc-studio'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import './ugc-studio.css'

const voices = ['Pippa','Sophie','Priya','Nadia','Serena','Olivia','Jessica','Chloe','Callum','James','Oliver','Arjun','Marcus','Ethan','Shaun','Graham']
const deliveries = [
  ['Natural','Natural, warm, conversational social creator delivery.'],
  ['Energetic','Energetic and upbeat creator delivery with natural pacing; never sound like an announcer.'],
  ['Calm','Calm, reassuring, relaxed creator delivery with clear conversational pacing.'],
  ['Professional','Confident, polished and professional while still sounding natural and human.'],
  ['Excited','Genuinely excited discovery-style delivery with believable emotion and varied pacing.'],
] as const

function AvatarThumb({ avatar }: { avatar: UGCAvatar }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    let createdUrl: string | null = null
    if (!avatar.imageUrl) return undefined
    void fetchUGCAvatarImage(avatar).then((value) => {
      if (!value) return
      if (!active) { URL.revokeObjectURL(value); return }
      createdUrl = value
      setUrl(value)
    })
    return () => {
      active = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [avatar])
  return <div className="size-10 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-brand-cyan/10">{url ? <img alt="" className="size-full object-cover" src={url} /> : <span className="grid size-full place-items-center text-xs font-bold text-brand-cyan">{avatar.name.slice(0,1)}</span>}</div>
}

function assetFor(ad: UGCAd | undefined, assets: MediaAsset[]) {
  if (!ad?.mediaAssetId) return undefined
  return assets.find((asset) => asset.id === ad.mediaAssetId)
}

export function UGCEditorPage() {
  const { adId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const adQuery = useQuery({
    queryKey: ['ugc-ad', adId],
    queryFn: () => getUGCAd(adId),
    enabled: Boolean(adId),
    refetchInterval: (query) => ['QUEUED','RENDERING','RESERVING'].includes(query.state.data?.status || '') ? 3500 : false,
  })
  const overview = useQuery({ queryKey: ['ugc-studio-overview'], queryFn: getUGCOverview, staleTime: 20_000 })
  const media = useQuery({ queryKey: ['media-library', 'ugc-editor', adQuery.data?.mediaAssetId], queryFn: fetchMediaLibrary, enabled: Boolean(adQuery.data?.mediaAssetId) })
  const ad = adQuery.data
  const asset = assetFor(ad, media.data?.assets || [])

  const [scriptEdit, setScriptEdit] = useState<string>()
  const [captionEdit, setCaptionEdit] = useState<string>()
  const [ctaEdit, setCtaEdit] = useState<string>()
  const [avatarIdEdit, setAvatarIdEdit] = useState<string | null | undefined>()
  const [voiceEdit, setVoiceEdit] = useState<string>()
  const [voicePromptEdit, setVoicePromptEdit] = useState<string>()
  const [musicModeEdit, setMusicModeEdit] = useState<'AUTO' | 'NONE'>()
  const [captionsEnabledEdit, setCaptionsEnabledEdit] = useState<boolean>()
  const [message, setMessage] = useState('')

  const script = scriptEdit ?? ad?.script ?? ''
  const caption = captionEdit ?? ad?.caption ?? ''
  const cta = ctaEdit ?? ad?.cta ?? ''
  const avatarId = avatarIdEdit !== undefined ? avatarIdEdit : (ad?.avatarId ?? null)
  const baselineVoice = ad?.voice || 'Pippa'
  const voice = voiceEdit ?? baselineVoice
  const baselineVoicePrompt = ad?.voicePrompt || deliveries[0][1]
  const voicePrompt = voicePromptEdit ?? baselineVoicePrompt
  const musicMode = musicModeEdit ?? ad?.musicMode ?? 'AUTO'
  const captionsEnabled = captionsEnabledEdit ?? ad?.captionsEnabled ?? true

  function clearEdits() {
    setScriptEdit(undefined)
    setCaptionEdit(undefined)
    setCtaEdit(undefined)
    setAvatarIdEdit(undefined)
    setVoiceEdit(undefined)
    setVoicePromptEdit(undefined)
    setMusicModeEdit(undefined)
    setCaptionsEnabledEdit(undefined)
  }

  useEffect(() => {
    if (adId) void trackUGCStudioEvent({ event: 'EDITOR_OPENED', stage: 'editor', adId })
  }, [adId])

  const save = useMutation({
    mutationFn: () => updateUGCAd(adId, { script, caption, cta, avatarId, voice, voicePrompt, musicMode, captionsEnabled }),
    onSuccess: (value) => {
      queryClient.setQueryData(['ugc-ad', adId], value)
      void queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
      void queryClient.invalidateQueries({ queryKey: ['media-library'] })
      clearEdits()
      setMessage('Changes saved. Regenerate only when the video itself needs to change.')
    },
    onError: (value) => setMessage(value instanceof Error ? value.message : 'Changes could not be saved.'),
  })
  const regenerate = useMutation({
    mutationFn: () => regenerateUGCAd(adId),
    onSuccess: (value) => {
      queryClient.setQueryData(['ugc-ad', adId], value)
      void queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
      void queryClient.invalidateQueries({ queryKey: ['media-library'] })
      setMessage('Full ad regeneration queued. You can leave this page while it renders.')
    },
    onError: (value) => setMessage(value instanceof Error ? value.message : 'Regeneration could not start.'),
  })
  const sceneRegenerate = useMutation({
    mutationFn: (sceneId: string) => regenerateUGCScene(sceneId),
    onSuccess: (value) => {
      queryClient.setQueryData(['ugc-ad', adId], value)
      void queryClient.invalidateQueries({ queryKey: ['ugc-studio-overview'] })
      void queryClient.invalidateQueries({ queryKey: ['media-library'] })
      setMessage('Only that scene was queued for regeneration; the rest of the ad is reused.')
    },
    onError: (value) => setMessage(value instanceof Error ? value.message : 'Scene regeneration could not start.'),
  })

  const avatars = overview.data?.avatars || []
  const selectedAvatar = avatars.find((item) => item.id === avatarId) || ad?.avatar || null
  const busy = ['QUEUED','RENDERING','RESERVING'].includes(ad?.status || '')
  const fullCredits = ad?.credits || 0
  const changedVideo = Boolean(ad && (script !== ad.script || avatarId !== ad.avatarId || voice !== baselineVoice || voicePrompt !== baselineVoicePrompt))
  const changedPost = Boolean(ad && (caption !== ad.caption || cta !== ad.cta || musicMode !== ad.musicMode || captionsEnabled !== ad.captionsEnabled))
  const dirty = changedVideo || changedPost

  async function schedule() {
    if (!ad?.mediaAssetId || !asset) return
    void trackUGCStudioEvent({
      event: 'SCHEDULER_HANDOFF',
      stage: 'editor',
      campaignId: ad.campaignId,
      adId: ad.id,
      metadata: { readyCount: 1, variationCount: 1, quality: ad.quality, duration: ad.duration },
    })
    navigate('/bulk-scheduler', {
      state: {
        mediaLibraryAssets: [asset],
        aiMixedCampaign: { id: ad.campaignId, title: ad.title, posts: [{ id: ad.id, contentType: 'IMAGE', caption: ad.caption || ad.script, mediaAssetId: ad.mediaAssetId }] },
      },
    })
  }

  return <div className="ugc-editor-shell">
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><Link className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-text-muted hover:text-white" to="/ai-content-studio?ugc=1"><ArrowLeft className="size-3.5" />Back to UGC Studio</Link><h1 className="mt-2 text-2xl font-bold tracking-tight">{ad?.title || 'UGC Ad Editor'}</h1><p className="mt-1 text-[11px] text-text-muted">Change only what you need. Non-video edits do not require an expensive full regeneration.</p></div><div className="flex flex-wrap gap-2"><Button disabled={!dirty || save.isPending || busy} onClick={() => save.mutate()}><Save className="size-4" />Save changes</Button><Button disabled={!asset || ad?.status !== 'READY'} onClick={() => void schedule()} variant="primary"><CalendarRange className="size-4" />Schedule</Button></div></div>

    {message && <div className="mb-5 rounded-2xl border border-brand-cyan/20 bg-brand-cyan/[.045] p-3 text-[11px] text-text-muted">{message}</div>}

    <div className="grid gap-5 xl:grid-cols-[minmax(300px,.72fr)_minmax(0,1.28fr)]">
      <div className="space-y-5">
        <Card className="ugc-editor-preview overflow-hidden p-3">
          <div className="relative mx-auto aspect-[9/16] max-h-[68vh] overflow-hidden rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_50%_20%,rgba(45,212,191,.14),transparent_18rem),#020b13]">
            {asset?.fileUrl ? <video className="size-full object-contain" controls playsInline src={asset.fileUrl} /> : <div className="absolute inset-0 grid place-items-center"><div className="text-center">{busy ? <LoaderCircle className="mx-auto size-9 animate-spin text-brand-cyan motion-reduce:animate-none" /> : <Clapperboard className="mx-auto size-9 text-text-soft" />}<span className="mt-3 block text-[10px] text-text-muted">{busy ? 'Rendering in the background…' : ad?.status === 'FAILED' ? ad.error || 'Render failed' : 'No final video yet'}</span></div></div>}
            <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[9px] font-bold backdrop-blur">{ad?.duration || 30}s · 720p</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[9px] text-text-muted"><span className="rounded-xl border border-white/8 bg-white/[.025] p-2">{ad?.quality === 'PREMIUM' ? 'Premium' : 'Standard'}</span><span className="rounded-xl border border-white/8 bg-white/[.025] p-2">{ad?.scenes.length || 0} scene{ad?.scenes.length === 1 ? '' : 's'}</span><span className="rounded-xl border border-white/8 bg-white/[.025] p-2">{ad?.status || 'Loading'}</span></div>
        </Card>

        <Card className="ugc-depth-card p-4">
          <div className="flex items-center justify-between gap-3"><div><span className="text-[9px] font-bold uppercase tracking-[.15em] text-brand-cyan">Regeneration</span><h3 className="mt-1 text-sm font-semibold">Rebuild the full ad</h3></div><Coins className="size-5 text-brand-amber" /></div>
          <p className="mt-2 text-[10px] leading-4 text-text-muted">Use this after changing the creator, voice or substantial script. Music/caption settings can be saved without a full AI-video regeneration.</p>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-white/8 bg-black/15 p-3"><span className="text-[10px] text-text-muted">Full regeneration</span><strong className="text-sm">{fullCredits} credits</strong></div>
          <Button className="mt-3 w-full" disabled={busy || regenerate.isPending} onClick={() => regenerate.mutate()} variant="primary">{regenerate.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}Regenerate full ad</Button>
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="ugc-depth-card p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand-amber/25 bg-brand-amber/10 text-brand-amber"><UserRound className="size-4" /></span><div><span className="text-[9px] font-bold uppercase tracking-[.15em] text-brand-amber">Creator</span><h2 className="mt-1 text-base font-semibold">Avatar & voice</h2></div></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-[10px] font-semibold text-text-muted">Creator<select className="ugc-input mt-2 w-full" disabled={busy} onChange={(event) => {
      const nextId = event.target.value || null
      setAvatarIdEdit(nextId)
      const nextAvatar = avatars.find((item) => item.id === nextId)
      if (nextAvatar?.voice) setVoiceEdit(nextAvatar.voice)
    }} value={avatarId || ''}><option value="">Auto / current</option>{avatars.map((avatar) => <option key={avatar.id} value={avatar.id}>{avatar.name} · {avatar.category}</option>)}</select></label><label className="text-[10px] font-semibold text-text-muted">Voice<select className="ugc-input mt-2 w-full" disabled={busy} onChange={(event) => setVoiceEdit(event.target.value)} value={voice}>{voices.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
          {selectedAvatar && <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[.025] p-3"><AvatarThumb avatar={selectedAvatar} /><div><strong className="block text-xs">{selectedAvatar.name}</strong><span className="text-[9px] text-text-muted">{selectedAvatar.category} · {selectedAvatar.ageBand} · {selectedAvatar.locale}</span></div></div>}
          <div className="mt-4"><span className="text-[10px] font-semibold text-text-muted">Delivery</span><div className="mt-2 flex flex-wrap gap-2">{deliveries.map(([label,prompt]) => <button className={`rounded-xl border px-3 py-2 text-[10px] transition ${voicePrompt === prompt ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan' : 'border-white/10 bg-white/[.025] text-text-muted hover:text-white'}`} key={label} onClick={() => setVoicePromptEdit(prompt)} type="button">{label}</button>)}</div></div>
        </Card>

        <Card className="ugc-depth-card p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"><WandSparkles className="size-4" /></span><div><span className="text-[9px] font-bold uppercase tracking-[.15em] text-brand-cyan">Script</span><h2 className="mt-1 text-base font-semibold">What the creator says</h2></div></div><textarea className="ugc-input mt-4 min-h-44 w-full resize-y" disabled={busy} onChange={(event) => setScriptEdit(event.target.value)} value={script} /><div className="mt-2 flex items-center justify-between text-[9px] text-text-soft"><span>{script.trim().split(/\s+/).filter(Boolean).length} words</span>{changedVideo && <span className="text-brand-amber">Video-impacting change</span>}</div></Card>

        <Card className="ugc-depth-card p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand-purple/25 bg-brand-purple/10 text-[#c4b5fd]"><Volume2 className="size-4" /></span><div><span className="text-[9px] font-bold uppercase tracking-[.15em] text-[#c4b5fd]">Finishing</span><h2 className="mt-1 text-base font-semibold">Music, captions & publishing copy</h2></div></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2"><button className={`rounded-2xl border p-4 text-left transition ${musicMode === 'AUTO' ? 'border-brand-cyan/35 bg-brand-cyan/[.06]' : 'border-white/10 bg-white/[.025]'}`} onClick={() => setMusicModeEdit(musicMode === 'AUTO' ? 'NONE' : 'AUTO')} type="button"><Music2 className="size-4 text-brand-cyan" /><strong className="mt-2 block text-xs">Background music</strong><span className="mt-1 block text-[9px] text-text-muted">{musicMode === 'AUTO' ? 'Auto · enabled where appropriate' : 'Off'}</span></button><button className={`rounded-2xl border p-4 text-left transition ${captionsEnabled ? 'border-brand-cyan/35 bg-brand-cyan/[.06]' : 'border-white/10 bg-white/[.025]'}`} onClick={() => setCaptionsEnabledEdit(!captionsEnabled)} type="button"><Captions className="size-4 text-brand-cyan" /><strong className="mt-2 block text-xs">Captions</strong><span className="mt-1 block text-[9px] text-text-muted">{captionsEnabled ? 'Automatic captions on' : 'Captions off'}</span></button></div>
          <label className="mt-4 block text-[10px] font-semibold text-text-muted">CTA<input className="ugc-input mt-2 w-full" onChange={(event) => setCtaEdit(event.target.value)} value={cta} /></label><label className="mt-4 block text-[10px] font-semibold text-text-muted">Post caption<textarea className="ugc-input mt-2 min-h-24 w-full resize-y" onChange={(event) => setCaptionEdit(event.target.value)} value={caption} /></label>
        </Card>

        <Card className="ugc-depth-card p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><span className="text-[9px] font-bold uppercase tracking-[.15em] text-brand-green">Storyboard</span><h2 className="mt-1 text-base font-semibold">Regenerate only the scene that needs work.</h2></div><Sparkles className="size-5 text-brand-green" /></div><div className="mt-4 space-y-3">{ad?.scenes.map((scene) => { const sceneCredits = Math.max(1, Math.ceil((ad.credits || 1) * scene.duration / ad.duration)); return <article className="ugc-scene-card rounded-2xl border border-white/9 bg-white/[.025] p-4" key={scene.id}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-brand-cyan/20 bg-brand-cyan/[.06] px-2 py-1 text-[8px] font-bold text-brand-cyan">SCENE {scene.sequence}</span><span className="rounded-full border border-white/10 bg-black/15 px-2 py-1 text-[8px] text-text-muted">{scene.kind}</span><span className="text-[9px] text-text-soft">{scene.duration}s</span></div><p className="mt-2 text-[10px] leading-4 text-text-muted">{scene.script || scene.prompt}</p></div><Button disabled={busy || sceneRegenerate.isPending} onClick={() => sceneRegenerate.mutate(scene.id)} size="sm"><RefreshCcw className="size-3.5" />Regenerate · {sceneCredits} cr</Button></div></article> })}</div></Card>
      </div>
    </div>
  </div>
}
