import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchMediaLibrary } from '../../lib/media-library-api'
import { saveCarouselSession, setActivePostComposer } from '../../lib/carousel-composer-session'
import { fetchPostsWorkspace } from '../../lib/posts-api'
import type { DashboardJob } from '../../types/dashboard'
import type { MediaAsset } from '../../types/media-library'
import type { PostDraft, PostType, ScheduleMode } from '../../types/posts'
import type { PostLibraryView } from '../../lib/posts-reuse'
import { DraftLibraryModal } from './DraftLibraryModal'
import { PostReuseModal } from './PostReuseModal'

const STANDARD_DRAFT_KEY = 'inx-social-post-drafts-v1'
const MANUAL_CAROUSEL_DRAFT_KEY = 'inx-social-manual-carousel-draft-v1'
const STANDARD_COMPOSER_KEY = 'inx-social-post-composer-session-v1'
const CAROUSEL_DRAFT_ID = 'browser-carousel-draft'

type StoredCarouselDraft = {
  title?: unknown
  caption?: unknown
  captionIdea?: unknown
  assetIds?: unknown
  slideLinks?: unknown
  selectedIds?: unknown
  mode?: unknown
  date?: unknown
  time?: unknown
  campaign?: unknown
  labels?: unknown
  updatedAt?: unknown
}

function parseJson<T>(value: string | null, fallback: T): T {
  try { return value ? JSON.parse(value) as T : fallback } catch { return fallback }
}

function standardDrafts(): PostDraft[] {
  const value = parseJson<unknown>(window.localStorage.getItem(STANDARD_DRAFT_KEY), [])
  return Array.isArray(value) ? value as PostDraft[] : []
}

function storedCarouselDraft(): StoredCarouselDraft | null {
  const value = parseJson<unknown>(window.localStorage.getItem(MANUAL_CAROUSEL_DRAFT_KEY), null)
  return value && typeof value === 'object' ? value as StoredCarouselDraft : null
}

function carouselDraftSummary(value: StoredCarouselDraft | null): PostDraft | null {
  if (!value) return null
  const assetIds = Array.isArray(value.assetIds) ? value.assetIds.filter((id): id is string => typeof id === 'string') : []
  const selectedIds = Array.isArray(value.selectedIds) ? value.selectedIds.filter((id): id is string => typeof id === 'string') : []
  const createdAt = typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString()
  const mode: ScheduleMode = value.mode === 'now' || value.mode === 'draft' ? value.mode : 'later'
  return {
    id: CAROUSEL_DRAFT_ID,
    title: typeof value.title === 'string' ? value.title : '',
    caption: typeof value.caption === 'string' ? value.caption : '',
    postType: 'carousel',
    mediaFileName: assetIds.length ? `${assetIds.length} carousel slide${assetIds.length === 1 ? '' : 's'}` : 'Carousel slides',
    mediaLibraryAssetId: null,
    selectedDestinationIds: selectedIds,
    scheduleMode: mode,
    scheduledAt: null,
    campaign: typeof value.campaign === 'string' ? value.campaign : 'No campaign',
    labels: typeof value.labels === 'string' ? value.labels.split(',').map((item) => item.trim()).filter(Boolean) : ['Carousel'],
    status: 'draft',
    createdAt,
  }
}

function dateParts(value: string | null) {
  const fallback = new Date(Date.now() + 86_400_000)
  const date = value ? new Date(value) : fallback
  const safe = Number.isNaN(date.getTime()) ? fallback : date
  const pad = (number: number) => String(number).padStart(2, '0')
  return {
    date: `${safe.getFullYear()}-${pad(safe.getMonth() + 1)}-${pad(safe.getDate())}`,
    time: `${pad(safe.getHours())}:${pad(safe.getMinutes())}`,
  }
}

function writeStandardComposer(input: {
  postType: PostType
  title: string
  caption: string
  mediaLibraryAssetId: string | null
  mediaFileName: string | null
  selectedIds: string[]
  mode: ScheduleMode
  scheduledAt: string | null
  campaign: string
  labels: string
}) {
  const schedule = dateParts(input.scheduledAt)
  window.localStorage.setItem(STANDARD_COMPOSER_KEY, JSON.stringify({
    postType: input.postType === 'carousel' ? 'text' : input.postType,
    title: input.title,
    caption: input.caption,
    captionIdea: '',
    mediaLibraryAssetId: input.mediaLibraryAssetId,
    mediaFileName: input.mediaFileName,
    selectedIds: input.selectedIds,
    mode: input.mode,
    date: schedule.date,
    time: schedule.time,
    campaign: input.campaign,
    labels: input.labels,
    retainMedia: Boolean(input.mediaLibraryAssetId),
  }))
}

function libraryView(label: string): PostLibraryView | null {
  if (label === 'All Posts') return 'all'
  if (label === 'Scheduled') return 'scheduled'
  if (label === 'Published') return 'published'
  if (label === 'Needs Review') return 'needs_review'
  return null
}

export function PostsStatOverlayController() {
  const navigate = useNavigate()
  const workspace = useQuery({ queryKey: ['posts-workspace'], queryFn: fetchPostsWorkspace, refetchInterval: 45_000 })
  const [draftOpen, setDraftOpen] = useState(false)
  const [postView, setPostView] = useState<PostLibraryView | null>(null)
  const [draftVersion, setDraftVersion] = useState(0)

  useEffect(() => {
    const onOpen = (event: Event) => {
      if (!(event instanceof CustomEvent) || event.detail?.source !== 'fallback') return
      const label = String(event.detail?.label || '')
      if (label === 'Drafts') {
        setDraftVersion((value) => value + 1)
        setDraftOpen(true)
        return
      }
      const view = libraryView(label)
      if (view) setPostView(view)
    }
    window.addEventListener('inx-posts-stat-open', onOpen)
    return () => window.removeEventListener('inx-posts-stat-open', onOpen)
  }, [])

  const drafts = useMemo(() => {
    void draftVersion
    void draftOpen
    const carousel = carouselDraftSummary(storedCarouselDraft())
    return [...standardDrafts(), ...(carousel ? [carousel] : [])]
  }, [draftVersion, draftOpen])

  function deleteDraft(id: string) {
    if (id === CAROUSEL_DRAFT_ID) {
      window.localStorage.removeItem(MANUAL_CAROUSEL_DRAFT_KEY)
    } else {
      const next = standardDrafts().filter((draft) => draft.id !== id)
      window.localStorage.setItem(STANDARD_DRAFT_KEY, JSON.stringify(next))
    }
    setDraftVersion((value) => value + 1)
  }

  async function loadDraft(draft: PostDraft) {
    setDraftOpen(false)
    if (draft.id === CAROUSEL_DRAFT_ID || draft.postType === 'carousel') {
      const stored = storedCarouselDraft()
      if (!stored) return
      const assetIds = Array.isArray(stored.assetIds) ? stored.assetIds.filter((id): id is string => typeof id === 'string') : []
      const library = await fetchMediaLibrary()
      const byId = new Map(library.assets.map((asset) => [asset.id, asset]))
      const assets = assetIds.map((id) => byId.get(id)).filter((asset): asset is MediaAsset => Boolean(asset))
      const rawLinks = stored.slideLinks
      const slideLinks: Record<string, string> = {}
      if (Array.isArray(rawLinks)) assetIds.forEach((id, index) => { if (typeof rawLinks[index] === 'string' && rawLinks[index]) slideLinks[id] = rawLinks[index] })
      else if (rawLinks && typeof rawLinks === 'object') Object.entries(rawLinks as Record<string, unknown>).forEach(([id, link]) => { if (typeof link === 'string') slideLinks[id] = link })
      saveCarouselSession({
        title: typeof stored.title === 'string' ? stored.title : '',
        caption: typeof stored.caption === 'string' ? stored.caption : '',
        captionIdea: typeof stored.captionIdea === 'string' ? stored.captionIdea : '',
        assets,
        slideLinks,
        selectedIds: Array.isArray(stored.selectedIds) ? stored.selectedIds.filter((id): id is string => typeof id === 'string') : [],
        mode: stored.mode === 'now' || stored.mode === 'draft' ? stored.mode : 'later',
        date: typeof stored.date === 'string' ? stored.date : new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
        time: typeof stored.time === 'string' ? stored.time : '19:30',
        campaign: typeof stored.campaign === 'string' ? stored.campaign : 'No campaign',
        labels: typeof stored.labels === 'string' ? stored.labels : 'Carousel',
      })
      setActivePostComposer('carousel')
      navigate('/posts', { replace: true, state: { manualCarousel: true } })
      return
    }

    writeStandardComposer({
      postType: draft.postType,
      title: draft.title,
      caption: draft.caption,
      mediaLibraryAssetId: draft.mediaLibraryAssetId || null,
      mediaFileName: draft.mediaFileName,
      selectedIds: draft.selectedDestinationIds,
      mode: draft.scheduleMode,
      scheduledAt: draft.scheduledAt,
      campaign: draft.campaign,
      labels: draft.labels.join(', '),
    })
    setActivePostComposer('standard')
    navigate('/posts', { replace: true, state: { standardComposer: true } })
  }

  function reusePost(job: DashboardJob) {
    setPostView(null)
    writeStandardComposer({
      postType: job.contentType === 'IMAGE' ? 'image' : job.contentType === 'VIDEO' ? 'video' : 'text',
      title: job.title || '',
      caption: job.caption || '',
      mediaLibraryAssetId: job.mediaLibraryAssetId,
      mediaFileName: job.localFileName,
      selectedIds: job.page ? [job.page.id] : [],
      mode: 'later',
      scheduledAt: null,
      campaign: 'No campaign',
      labels: 'Reused post',
    })
    setActivePostComposer('standard')
    navigate('/posts', { replace: true, state: { standardComposer: true } })
  }

  return (
    <>
      {draftOpen && <DraftLibraryModal drafts={drafts} onClose={() => setDraftOpen(false)} onDelete={deleteDraft} onLoad={(draft) => void loadDraft(draft)} pages={workspace.data?.pages || []} />}
      {postView && <PostReuseModal initialView={postView} jobs={workspace.data?.jobs || []} onClose={() => setPostView(null)} onReuse={reusePost} />}
    </>
  )
}
