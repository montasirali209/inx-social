import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { gsap } from 'gsap'
import { useNavigate } from 'react-router-dom'
import {
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronDown,
  Coins,
  ExternalLink,
  Eye,
  FileImage,
  Globe2,
  ImagePlus,
  Loader2,
  Maximize2,
  Pencil,
  RefreshCw,
  Rocket,
  ScanSearch,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from 'react'
import { uploadPostStudioReference } from '../../../lib/ai-post-studio-api'
import {
  analyzeCreativeFlowProject,
  generateCreativeFlowCampaign,
  getCreativeFlowGenerationEstimate,
  getCreativeFlowProject,
  getCreativeFlowRender,
  handoffCreativeFlowProject,
  regenerateCreativeFlowProjectPost,
  removeCreativeFlowProjectPost,
  retryCreativeFlowMissing,
  saveCreativeFlowProjectCanvas,
  saveCreativeFlowProjectSource,
  saveCreativeFlowReviewReveal,
  saveCreativeFlowReviewSelection,
  type CreativeFlowAnalysis,
  type CreativeFlowGenerationEstimate,
  type CreativeFlowProject,
  type CreativeFlowProjectList,
  type CreativeFlowRenderCampaign,
} from '../../../lib/creative-flow-api'
import { Button } from '../../ui/Button'
import { CreativeFlowMotionSlot } from './CreativeFlowMotion'

type FlowNodeData = { analysisStep?: number }
type FlowNode = Node<FlowNodeData>
type FlowEdge = Edge<{ active?: boolean; complete?: boolean }>

type LocalPreview = {
  id: string
  name: string
  url: string
}

type WorkspaceContextValue = {
  project: CreativeFlowProject
  analysis: CreativeFlowAnalysis | null
  renderCampaign: CreativeFlowRenderCampaign | null
  generationEstimate: CreativeFlowGenerationEstimate | null
  generationEstimateLoading: boolean
  urlDraft: string
  urlExpanded: boolean
  imageExpanded: boolean
  campaignExpanded: boolean
  advancedExpanded: boolean
  campaignBusy: boolean
  sourceBusy: boolean
  reviewBusy: boolean
  retryMissingBusy: boolean
  handoffBusy: boolean
  uploadProgress: number
  localPreviews: LocalPreview[]
  campaignGoal: string
  campaignPlatforms: string[]
  creativeCount: number
  creativeStyle: string
  campaignAudience: string
  setUrlDraft: (value: string) => void
  setUrlExpanded: (value: boolean) => void
  setImageExpanded: (value: boolean) => void
  setCampaignExpanded: (value: boolean) => void
  setAdvancedExpanded: (value: boolean) => void
  setCampaignGoal: (value: string) => void
  toggleCampaignPlatform: (value: string) => void
  setCreativeCount: (value: number) => void
  setCreativeStyle: (value: string) => void
  setCampaignAudience: (value: string) => void
  saveUrl: () => void
  uploadFiles: (files: File[]) => void
  removeReference: (index: number) => void
  runAnalysis: () => void
  generateCampaign: () => void
  toggleCreativeSelection: (postId: string) => void
  selectAllReadyCreatives: () => void
  clearCreativeSelection: () => void
  retryMissingCreatives: () => void
  regenerateCreative: (postId: string, input?: { imageBrief?: string }) => void
  removeCreative: (postId: string) => void
  openCreativePreview: (postId: string) => void
  sendSelectedToScheduler: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('Creative Flow workspace context is unavailable.')
  return value
}

function normaliseUrlInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(candidate)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return ''
    return url.toString()
  } catch {
    return ''
  }
}

function displayDomain(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./i, '')
  } catch {
    return value
  }
}

function renderFinished(project: CreativeFlowProject) {
  return ['RENDER_READY', 'RENDER_PARTIAL', 'REVIEW_READY', 'HANDOFF_READY', 'CREATIVE_REGENERATING', 'CREATIVE_REGENERATE_FAILED'].includes(project.currentStage)
}

const ANALYSIS_STEPS = [
  { id: 'analysisSources', eyebrow: 'Source collection', title: 'Collect product sources', description: 'Read the website, uploads and product references.' },
  { id: 'analysisEvidence', eyebrow: 'Evidence extraction', title: 'Extract verified evidence', description: 'Separate supported product facts from assumptions.' },
  { id: 'analysisMeaning', eyebrow: 'Product understanding', title: 'Understand positioning', description: 'Interpret audience, product meaning and claim boundaries.' },
  { id: 'analysisBrand', eyebrow: 'Visual intelligence', title: 'Map brand & visuals', description: 'Identify palette, product visuals and usable brand signals.' },
] as const

function analysisStepCount(project: CreativeFlowProject) {
  if (project.workflow.analysis) return ANALYSIS_STEPS.length
  const visible = project.activeJobType === 'PRODUCT_ANALYSIS' || ['PRODUCT_ANALYSIS_RUNNING', 'PRODUCT_ANALYSIS_FAILED'].includes(project.currentStage)
  if (!visible) return 0
  return Math.max(1, Math.min(ANALYSIS_STEPS.length, Number(project.progress.current || 1)))
}

function productIntelligencePosition(project: CreativeFlowProject) {
  const base = project.workflow.canvas.positions.analyzeProduct
  const saved = project.workflow.canvas.positions.productIntelligence
  return { x: Math.max(saved.x, base.x + 850), y: Math.min(saved.y, base.y - 40) }
}

function analysisStepPosition(project: CreativeFlowProject, index: number) {
  const base = project.workflow.canvas.positions.analyzeProduct
  return { x: base.x + 360, y: base.y - 255 + index * 170 }
}

function creativeNodeId(postId: string) {
  return `creative:${postId}`
}

function creativeNodePosition(project: CreativeFlowProject, index: number) {
  const base = productIntelligencePosition(project)
  const column = index % 4
  const row = Math.floor(index / 4)
  return { x: base.x + 520 + column * 340, y: base.y - 390 + row * 485 }
}

function scheduleNodePosition(project: CreativeFlowProject, creativeCount: number) {
  const base = productIntelligencePosition(project)
  const columns = Math.max(1, Math.min(4, Math.max(creativeCount, 1)))
  return { x: base.x + 520 + columns * 340 + 380, y: base.y - 10 }
}

function edgeStyle(active: boolean, complete: boolean) {
  return {
    stroke: complete ? '#22c55e' : active ? '#14b8a6' : '#64748b',
    strokeWidth: active ? 3.2 : 2.6,
    opacity: 0.95,
  }
}

function makeEdge(id: string, source: string, target: string, active = false, complete = false): FlowEdge {
  return {
    id,
    source,
    target,
    type: 'smoothstep',
    animated: active,
    zIndex: 8,
    style: edgeStyle(active, complete),
    data: { active, complete },
  }
}

function baseNodes(project: CreativeFlowProject): FlowNode[] {
  const positions = project.workflow.canvas.positions
  const running = project.activeJobType === 'PRODUCT_ANALYSIS'
  const analysisReady = Boolean(project.workflow.analysis && !running)
  const nodes: FlowNode[] = [
    { id: 'productUrl', type: 'productUrl', position: positions.productUrl, data: {}, draggable: true },
    { id: 'productImages', type: 'productImages', position: positions.productImages, data: {}, draggable: true },
    { id: 'analyzeProduct', type: 'analyzeProduct', position: positions.analyzeProduct, data: {}, draggable: true },
  ]

  ANALYSIS_STEPS.slice(0, analysisStepCount(project)).forEach((step, index) => {
    nodes.push({ id: step.id, type: 'analysisStep', position: analysisStepPosition(project, index), data: { analysisStep: index }, draggable: false })
  })

  if (analysisReady) {
    nodes.push({ id: 'productIntelligence', type: 'productIntelligence', position: productIntelligencePosition(project), data: {}, draggable: true })
  }
  return nodes
}

function baseEdges(project: CreativeFlowProject): FlowEdge[] {
  const running = project.activeJobType === 'PRODUCT_ANALYSIS'
  const analysisReady = Boolean(project.workflow.analysis && !running)
  const visible = analysisStepCount(project)
  const progress = Number(project.progress.current || 0)
  const edges: FlowEdge[] = [
    makeEdge('url-analyze', 'productUrl', 'analyzeProduct', running && progress <= 1, running || analysisReady),
    makeEdge('images-analyze', 'productImages', 'analyzeProduct', running && progress <= 1, running || analysisReady),
  ]

  if (visible > 0) {
    edges.push(makeEdge('analyze-analysisSources', 'analyzeProduct', ANALYSIS_STEPS[0].id, running && progress <= 1, analysisReady || progress > 1))
    for (let index = 1; index < visible; index += 1) {
      edges.push(makeEdge(
        `${ANALYSIS_STEPS[index - 1].id}-${ANALYSIS_STEPS[index].id}`,
        ANALYSIS_STEPS[index - 1].id,
        ANALYSIS_STEPS[index].id,
        running && progress === index + 1,
        analysisReady || progress > index + 1,
      ))
    }
  }

  if (analysisReady) {
    ANALYSIS_STEPS.forEach((step) => edges.push(makeEdge(`${step.id}-intelligence`, step.id, 'productIntelligence', false, true)))
  }
  return edges
}

function reviewGraph(project: CreativeFlowProject, campaign: CreativeFlowRenderCampaign | null, revealedIds: string[]) {
  if (!campaign || !project.renderCampaignId) return { nodes: [] as FlowNode[], edges: [] as FlowEdge[] }
  const revealed = new Set(revealedIds)
  const selected = new Set(project.workflow.review.selectedPostIds)
  const finished = campaign.status !== 'GENERATING_IMAGES'
  const posts = campaign.posts.filter((post) => finished || revealed.has(post.id))

  const nodes: FlowNode[] = posts.map((post, index) => ({
    id: creativeNodeId(post.id),
    type: 'creativeAsset',
    position: creativeNodePosition(project, index),
    data: {},
    draggable: false,
  }))
  const edges: FlowEdge[] = posts.map((post) => makeEdge(
    `product-${post.id}`,
    'productIntelligence',
    creativeNodeId(post.id),
    project.activeJobType === 'CREATIVE_REGENERATE' && project.activeJobId === post.id,
    Boolean(post.mediaAssetId),
  ))

  const selectedReady = posts.filter((post) => selected.has(post.id) && Boolean(post.mediaAssetId))
  if (selectedReady.length) {
    nodes.push({ id: 'scheduleCampaign', type: 'scheduleCampaign', position: scheduleNodePosition(project, posts.length), data: {}, draggable: false })
    selectedReady.forEach((post) => edges.push(makeEdge(`selected-${post.id}`, creativeNodeId(post.id), 'scheduleCampaign', !project.handoffCampaignId, Boolean(project.handoffCampaignId))))
  }

  return { nodes, edges }
}

function focusIds(project: CreativeFlowProject) {
  const processIds = ANALYSIS_STEPS.slice(0, analysisStepCount(project)).map((step) => step.id)
  if (!project.workflow.analysis || project.activeJobType === 'PRODUCT_ANALYSIS') return ['productUrl', 'productImages', 'analyzeProduct', ...processIds]
  if (project.workflow.review.revealedPostIds.length) {
    return ['productIntelligence', ...project.workflow.review.revealedPostIds.map(creativeNodeId), ...(project.workflow.review.selectedPostIds.length ? ['scheduleCampaign'] : [])]
  }
  return [...ANALYSIS_STEPS.map((step) => step.id), 'productIntelligence']
}

const nodeTypes = {
  productUrl: ProductUrlNode,
  productImages: ProductImagesNode,
  analyzeProduct: AnalyzeProductNode,
  analysisStep: AnalysisStepNode,
  productIntelligence: ProductIntelligenceNode,
  creativeAsset: CreativeAssetNode,
  scheduleCampaign: ScheduleCampaignNode,
}

export function CreativeFlowWorkspace({ initialProject, activeProject, onBack }: {
  initialProject: CreativeFlowProject
  activeProject: CreativeFlowProject | null
  onBack: (latest: CreativeFlowProject) => void
}) {
  return <ReactFlowProvider>
    <CreativeFlowWorkspaceInner initialProject={initialProject} activeProject={activeProject} onBack={onBack} />
  </ReactFlowProvider>
}

function CreativeFlowWorkspaceInner({ initialProject, activeProject, onBack }: {
  initialProject: CreativeFlowProject
  activeProject: CreativeFlowProject | null
  onBack: (latest: CreativeFlowProject) => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const flow = useReactFlow()
  const [urlDraft, setUrlDraft] = useState(initialProject.workflow.source.websiteInput || initialProject.productUrl || '')
  const [urlExpanded, setUrlExpanded] = useState(false)
  const [imageExpanded, setImageExpanded] = useState(false)
  const [campaignExpanded, setCampaignExpanded] = useState(false)
  const [advancedExpanded, setAdvancedExpanded] = useState(false)
  const [campaignBusy, setCampaignBusy] = useState(false)
  const [sourceBusy, setSourceBusy] = useState(false)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [retryMissingBusy, setRetryMissingBusy] = useState(false)
  const [handoffBusy, setHandoffBusy] = useState(false)
  const [error, setError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [localPreviews, setLocalPreviews] = useState<LocalPreview[]>([])
  const [campaignGoal, setCampaignGoal] = useState(initialProject.workflow.campaignSetup.goal)
  const [campaignPlatforms, setCampaignPlatforms] = useState<string[]>(initialProject.workflow.campaignSetup.platforms)
  const [creativeCount, setCreativeCount] = useState(initialProject.workflow.campaignSetup.creativeCount)
  const [creativeStyle, setCreativeStyle] = useState(initialProject.workflow.campaignSetup.style)
  const [campaignAudience, setCampaignAudience] = useState(initialProject.workflow.campaignSetup.audience)
  const [previewPostId, setPreviewPostId] = useState<string | null>(null)
  const [revealedIds, setRevealedIds] = useState<string[]>(initialProject.workflow.review.revealedPostIds || [])
  const revealedRef = useRef<string[]>(initialProject.workflow.review.revealedPostIds || [])
  const scheduledRevealRef = useRef(new Set(initialProject.workflow.review.revealedPostIds || []))
  const previewUrlsRef = useRef(new Set<string>())
  const lastFocusRef = useRef('')
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(baseNodes(initialProject))
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(baseEdges(initialProject))

  const projectQuery = useQuery({
    queryKey: ['creative-flow-project', initialProject.id],
    queryFn: () => getCreativeFlowProject(initialProject.id),
    initialData: initialProject,
    staleTime: 800,
    refetchInterval: (query) => query.state.data?.activeJobType === 'PRODUCT_ANALYSIS' ? 650 : query.state.data?.activeJobType ? 1_200 : false,
  })
  const project = projectQuery.data
  const analysis = project.workflow.analysis
  const blockedByAnother = Boolean(activeProject && activeProject.id !== project.id && activeProject.activeJobType)

  const estimateQuery = useQuery({
    queryKey: ['creative-flow-generation-estimate', project.id, creativeCount],
    queryFn: () => getCreativeFlowGenerationEstimate(project.id, creativeCount),
    enabled: Boolean(analysis && !project.renderCampaignId && !project.activeJobType),
    staleTime: 2_000,
    retry: false,
  })

  const renderQuery = useQuery({
    queryKey: ['creative-flow-render', project.renderCampaignId],
    queryFn: () => getCreativeFlowRender(project.renderCampaignId!),
    enabled: Boolean(project.renderCampaignId),
    staleTime: 600,
    retry: 1,
    refetchInterval: (query) => {
      const campaign = query.state.data
      return project.activeJobType === 'CREATIVE_RENDER' || project.activeJobType === 'CREATIVE_REGENERATE' || campaign?.status === 'GENERATING_IMAGES' ? 1_250 : false
    },
  })
  const renderCampaign = renderQuery.data || null

  const updateCachedProject = useCallback((next: CreativeFlowProject) => {
    queryClient.setQueryData(['creative-flow-project', next.id], next)
    queryClient.setQueryData<CreativeFlowProjectList>(['creative-flow-projects'], (current) => {
      if (!current) return current
      return {
        projects: current.projects.map((item) => item.id === next.id ? next : item),
        archivedProjects: current.archivedProjects || [],
        activeProject: next.activeJobType ? next : current.activeProject?.id === next.id ? null : current.activeProject,
      }
    })
  }, [queryClient])

  useEffect(() => {
    const persisted = project.workflow.review.revealedPostIds || []
    if (persisted.join(':') === revealedRef.current.join(':')) return
    revealedRef.current = persisted
    persisted.forEach((id) => scheduledRevealRef.current.add(id))
    setRevealedIds(persisted)
  }, [project.workflow.review.revealedPostIds])

  useEffect(() => {
    if (!renderCampaign) return
    const ready = renderCampaign.posts.filter((post) => Boolean(post.mediaAssetId || post.mediaAsset?.url))
    const additions = ready.filter((post) => !revealedRef.current.includes(post.id) && !scheduledRevealRef.current.has(post.id))
    additions.forEach((post, index) => {
      scheduledRevealRef.current.add(post.id)
      window.setTimeout(() => {
        const next = revealedRef.current.includes(post.id) ? revealedRef.current : [...revealedRef.current, post.id]
        revealedRef.current = next
        setRevealedIds(next)
        void saveCreativeFlowReviewReveal(project.id, next).then(updateCachedProject).catch(() => {})
      }, 140 + index * 170)
    })
  }, [project.id, renderCampaign, updateCachedProject])

  useEffect(() => {
    const review = reviewGraph(project, renderCampaign, revealedIds)
    const nextNodes = [...baseNodes(project), ...review.nodes]
    setNodes((current) => nextNodes.map((node) => {
      const existing = current.find((item) => item.id === node.id)
      return existing && node.draggable !== false ? { ...node, position: existing.position } : node
    }))
    setEdges([...baseEdges(project), ...review.edges])

    const focusKey = [project.currentStage, project.activeJobType || '', project.renderCampaignId || '', project.workflow.review.revealedPostIds.join(','), project.workflow.review.selectedPostIds.join(',')].join(':')
    if (focusKey !== lastFocusRef.current) {
      lastFocusRef.current = focusKey
      window.setTimeout(() => {
        void flow.fitView({ nodes: focusIds(project).map((id) => ({ id })), padding: 0.24, duration: 650, maxZoom: 1.08 })
      }, 140)
    }
  }, [flow, project, renderCampaign, revealedIds, setEdges, setNodes])

  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrlsRef.current.clear()
  }, [])

  const persistSource = useCallback(async (website: string, referenceAssetIds: string[], referenceNames: string[]) => {
    const next = await saveCreativeFlowProjectSource(project.id, { website, referenceAssetIds, referenceNames })
    updateCachedProject(next)
    return next
  }, [project.id, updateCachedProject])

  const saveUrl = useCallback(async () => {
    if (sourceBusy || project.activeJobType) return
    const normalized = normaliseUrlInput(urlDraft)
    if (urlDraft.trim() && !normalized) {
      setError('Enter a valid public website such as example.com.')
      return
    }
    setSourceBusy(true)
    setError('')
    try {
      await persistSource(normalized, project.workflow.source.referenceAssetIds, project.workflow.source.referenceNames)
      setUrlDraft(normalized)
      setUrlExpanded(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The product website could not be saved.')
    } finally {
      setSourceBusy(false)
    }
  }, [persistSource, project.activeJobType, project.workflow.source.referenceAssetIds, project.workflow.source.referenceNames, sourceBusy, urlDraft])

  const uploadFiles = useCallback(async (incoming: File[]) => {
    if (sourceBusy || project.activeJobType) return
    const currentIds = project.workflow.source.referenceAssetIds
    const currentNames = project.workflow.source.referenceNames
    const files = incoming.filter((file) => file.type.startsWith('image/')).slice(0, Math.max(0, 8 - currentIds.length))
    if (!files.length) return

    setSourceBusy(true)
    setError('')
    setUploadProgress(0)
    const ids = [...currentIds]
    const names = [...currentNames]
    const previews: LocalPreview[] = []
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} exceeds the 20 MB reference limit.`)
        const stored = await uploadPostStudioReference(file, (percent) => setUploadProgress(Math.round(((index + percent / 100) / files.length) * 100)))
        ids.push(stored.id)
        names.push(file.name)
        const url = URL.createObjectURL(file)
        previewUrlsRef.current.add(url)
        previews.push({ id: stored.id, name: file.name, url })
      }
      setLocalPreviews((current) => [...current, ...previews])
      await persistSource(normaliseUrlInput(urlDraft) || project.workflow.source.normalizedUrl, ids, names)
      setUploadProgress(100)
    } catch (caught) {
      previews.forEach((preview) => {
        URL.revokeObjectURL(preview.url)
        previewUrlsRef.current.delete(preview.url)
      })
      setError(caught instanceof Error ? caught.message : 'Product images could not be uploaded.')
    } finally {
      setSourceBusy(false)
    }
  }, [persistSource, project.activeJobType, project.workflow.source.normalizedUrl, project.workflow.source.referenceAssetIds, project.workflow.source.referenceNames, sourceBusy, urlDraft])

  const removeReference = useCallback(async (index: number) => {
    if (sourceBusy || project.activeJobType) return
    const removedId = project.workflow.source.referenceAssetIds[index]
    const ids = project.workflow.source.referenceAssetIds.filter((_, itemIndex) => itemIndex !== index)
    const names = project.workflow.source.referenceNames.filter((_, itemIndex) => itemIndex !== index)
    setSourceBusy(true)
    setError('')
    try {
      setLocalPreviews((current) => {
        const target = current.find((item) => item.id === removedId)
        if (target) {
          URL.revokeObjectURL(target.url)
          previewUrlsRef.current.delete(target.url)
        }
        return current.filter((item) => item.id !== removedId)
      })
      await persistSource(normaliseUrlInput(urlDraft) || project.workflow.source.normalizedUrl, ids, names)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The product reference could not be removed.')
    } finally {
      setSourceBusy(false)
    }
  }, [persistSource, project.activeJobType, project.workflow.source.normalizedUrl, project.workflow.source.referenceAssetIds, project.workflow.source.referenceNames, sourceBusy, urlDraft])

  const runAnalysis = useCallback(async () => {
    if (sourceBusy || project.activeJobType || blockedByAnother) return
    setSourceBusy(true)
    setError('')
    try {
      const normalized = normaliseUrlInput(urlDraft)
      if (urlDraft.trim() && !normalized) throw new Error('Enter a valid public website.')
      let latest = project
      if ((normalized || '') !== (project.workflow.source.normalizedUrl || '')) {
        latest = await persistSource(normalized, project.workflow.source.referenceAssetIds, project.workflow.source.referenceNames)
      }
      if (!latest.workflow.source.normalizedUrl && !latest.workflow.source.referenceAssetIds.length) throw new Error('Add a product website or at least one product image first.')
      const started = await analyzeCreativeFlowProject(project.id, {
        website: latest.workflow.source.normalizedUrl,
        referenceAssetIds: latest.workflow.source.referenceAssetIds,
        referenceNames: latest.workflow.source.referenceNames,
      })
      updateCachedProject(started)
      setUrlExpanded(false)
      setImageExpanded(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not start product analysis.')
    } finally {
      setSourceBusy(false)
    }
  }, [blockedByAnother, persistSource, project, sourceBusy, updateCachedProject, urlDraft])

  const generateCampaign = useCallback(async () => {
    if (campaignBusy || project.activeJobType || blockedByAnother || !analysis || project.renderCampaignId) return
    if (!campaignPlatforms.length) {
      setError('Choose at least one platform for this campaign.')
      return
    }
    if (estimateQuery.data && !estimateQuery.data.canGenerate) {
      setError(`This campaign needs ${estimateQuery.data.requiredCredits} AI credits, but only ${estimateQuery.data.creditsRemaining} are available.`)
      return
    }
    setCampaignBusy(true)
    setError('')
    try {
      const next = await generateCreativeFlowCampaign(project.id, {
        goal: campaignGoal,
        platforms: campaignPlatforms,
        creativeCount,
        style: creativeStyle,
        audience: campaignAudience,
      })
      updateCachedProject(next)
      setCampaignExpanded(false)
      setAdvancedExpanded(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not start this campaign.')
    } finally {
      setCampaignBusy(false)
    }
  }, [analysis, blockedByAnother, campaignAudience, campaignBusy, campaignGoal, campaignPlatforms, creativeCount, creativeStyle, estimateQuery.data, project.activeJobType, project.id, project.renderCampaignId, updateCachedProject])

  const toggleCreativeSelection = useCallback(async (postId: string) => {
    if (reviewBusy || project.activeJobType || !renderCampaign) return
    const current = project.workflow.review.selectedPostIds
    const next = current.includes(postId) ? current.filter((id) => id !== postId) : [...current, postId]
    setReviewBusy(true)
    setError('')
    try {
      updateCachedProject(await saveCreativeFlowReviewSelection(project.id, next))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not update the selection.')
    } finally {
      setReviewBusy(false)
    }
  }, [project.activeJobType, project.id, project.workflow.review.selectedPostIds, renderCampaign, reviewBusy, updateCachedProject])

  const selectAllReadyCreatives = useCallback(async () => {
    if (reviewBusy || project.activeJobType || !renderCampaign) return
    const ids = renderCampaign.posts.filter((post) => post.contentType === 'IMAGE' && Boolean(post.mediaAssetId)).map((post) => post.id)
    if (!ids.length) return
    setReviewBusy(true)
    try { updateCachedProject(await saveCreativeFlowReviewSelection(project.id, ids)) } finally { setReviewBusy(false) }
  }, [project.activeJobType, project.id, renderCampaign, reviewBusy, updateCachedProject])

  const clearCreativeSelection = useCallback(async () => {
    if (reviewBusy || project.activeJobType) return
    setReviewBusy(true)
    try { updateCachedProject(await saveCreativeFlowReviewSelection(project.id, [])) } finally { setReviewBusy(false) }
  }, [project.activeJobType, project.id, reviewBusy, updateCachedProject])

  const retryMissingCreatives = useCallback(async () => {
    if (retryMissingBusy || project.activeJobType || blockedByAnother || !project.renderCampaignId) return
    setRetryMissingBusy(true)
    setError('')
    try {
      updateCachedProject(await retryCreativeFlowMissing(project.id))
      await queryClient.invalidateQueries({ queryKey: ['creative-flow-render', project.renderCampaignId] })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not retry missing creatives.')
    } finally {
      setRetryMissingBusy(false)
    }
  }, [blockedByAnother, project.activeJobType, project.id, project.renderCampaignId, queryClient, retryMissingBusy, updateCachedProject])

  const regenerateCreative = useCallback(async (postId: string, input: { imageBrief?: string } = {}) => {
    if (project.activeJobType || blockedByAnother || reviewBusy) return
    setReviewBusy(true)
    setError('')
    try {
      updateCachedProject(await regenerateCreativeFlowProjectPost(project.id, postId, input))
      await queryClient.invalidateQueries({ queryKey: ['creative-flow-render', project.renderCampaignId] })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not regenerate this creative.')
    } finally {
      setReviewBusy(false)
    }
  }, [blockedByAnother, project.activeJobType, project.id, project.renderCampaignId, queryClient, reviewBusy, updateCachedProject])

  const removeCreative = useCallback(async (postId: string) => {
    if (project.activeJobType || reviewBusy) return
    if (!window.confirm('Remove this creative from the campaign? The Media Library asset will remain available.')) return
    setReviewBusy(true)
    setError('')
    try {
      const response = await removeCreativeFlowProjectPost(project.id, postId)
      updateCachedProject(response.project)
      queryClient.setQueryData(['creative-flow-render', project.renderCampaignId], response.campaign)
      const next = revealedRef.current.filter((id) => id !== postId)
      revealedRef.current = next
      setRevealedIds(next)
      scheduledRevealRef.current.delete(postId)
      void saveCreativeFlowReviewReveal(project.id, next).then(updateCachedProject).catch(() => {})
      if (previewPostId === postId) setPreviewPostId(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not remove this creative.')
    } finally {
      setReviewBusy(false)
    }
  }, [previewPostId, project.activeJobType, project.id, project.renderCampaignId, queryClient, reviewBusy, updateCachedProject])

  const sendSelectedToScheduler = useCallback(async () => {
    if (handoffBusy || project.activeJobType || !project.workflow.review.selectedPostIds.length) return
    setHandoffBusy(true)
    setError('')
    try {
      const response = await handoffCreativeFlowProject(project.id)
      updateCachedProject(response.project)
      navigate('/bulk-scheduler', { state: { aiCampaignId: response.campaign.id } })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not send the selection to Bulk Scheduler.')
      setHandoffBusy(false)
    }
  }, [handoffBusy, navigate, project.activeJobType, project.id, project.workflow.review.selectedPostIds.length, updateCachedProject])

  const saveCanvas = useCallback(async (viewport?: Viewport) => {
    const byId = new Map(nodes.map((node) => [node.id, node.position]))
    try {
      updateCachedProject(await saveCreativeFlowProjectCanvas(project.id, {
        positions: {
          productUrl: byId.get('productUrl'),
          productImages: byId.get('productImages'),
          analyzeProduct: byId.get('analyzeProduct'),
          productIntelligence: byId.get('productIntelligence'),
        },
        creativePositions: {},
        schedulePosition: null,
        viewport,
      }))
    } catch {
      // Canvas persistence must never block the creative job.
    }
  }, [nodes, project.id, updateCachedProject])

  const contextValue = useMemo<WorkspaceContextValue>(() => ({
    project,
    analysis,
    renderCampaign,
    generationEstimate: estimateQuery.data || null,
    generationEstimateLoading: estimateQuery.isLoading,
    urlDraft,
    urlExpanded,
    imageExpanded,
    campaignExpanded,
    advancedExpanded,
    campaignBusy,
    sourceBusy,
    reviewBusy,
    retryMissingBusy,
    handoffBusy,
    uploadProgress,
    localPreviews,
    campaignGoal,
    campaignPlatforms,
    creativeCount,
    creativeStyle,
    campaignAudience,
    setUrlDraft,
    setUrlExpanded,
    setImageExpanded,
    setCampaignExpanded,
    setAdvancedExpanded,
    setCampaignGoal,
    toggleCampaignPlatform: (value) => setCampaignPlatforms((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]),
    setCreativeCount,
    setCreativeStyle,
    setCampaignAudience,
    saveUrl: () => void saveUrl(),
    uploadFiles: (files) => void uploadFiles(files),
    removeReference: (index) => void removeReference(index),
    runAnalysis: () => void runAnalysis(),
    generateCampaign: () => void generateCampaign(),
    toggleCreativeSelection: (postId) => void toggleCreativeSelection(postId),
    selectAllReadyCreatives: () => void selectAllReadyCreatives(),
    clearCreativeSelection: () => void clearCreativeSelection(),
    retryMissingCreatives: () => void retryMissingCreatives(),
    regenerateCreative: (postId, input) => void regenerateCreative(postId, input),
    removeCreative: (postId) => void removeCreative(postId),
    openCreativePreview: setPreviewPostId,
    sendSelectedToScheduler: () => void sendSelectedToScheduler(),
  }), [advancedExpanded, analysis, campaignAudience, campaignBusy, campaignExpanded, campaignGoal, campaignPlatforms, clearCreativeSelection, creativeCount, creativeStyle, estimateQuery.data, estimateQuery.isLoading, generateCampaign, handoffBusy, imageExpanded, localPreviews, project, regenerateCreative, removeCreative, removeReference, renderCampaign, retryMissingBusy, retryMissingCreatives, reviewBusy, runAnalysis, saveUrl, selectAllReadyCreatives, sendSelectedToScheduler, sourceBusy, toggleCreativeSelection, uploadFiles, uploadProgress, urlDraft, urlExpanded])

  const previewPost = previewPostId ? renderCampaign?.posts.find((post) => post.id === previewPostId) || null : null

  return <WorkspaceContext.Provider value={contextValue}>
    <div className="relative size-full min-h-[560px] overflow-hidden bg-[radial-gradient(circle_at_18%_18%,rgba(45,212,191,.05),transparent_24rem),radial-gradient(circle_at_82%_72%,rgba(139,92,246,.04),transparent_28rem),#f8fafc]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto max-w-[min(620px,72vw)] rounded-2xl border border-border-soft bg-white/94 px-3.5 py-2.5 shadow-[0_10px_32px_rgba(15,23,42,.07)] backdrop-blur-lg">
          <div className="flex flex-wrap items-center gap-2"><span className="text-[8px] font-bold uppercase tracking-[.15em] text-brand-cyan">Creative Flow · Stage 6</span><span className="rounded-full border border-border-soft bg-slate-50 px-2 py-0.5 text-[8px] font-semibold text-text-soft">{project.activeJobType === 'PRODUCT_ANALYSIS' ? 'Analysing product' : project.activeJobType ? 'Campaign processing' : renderFinished(project) ? 'Review creatives' : analysis ? 'Configure campaign' : 'Source setup'}</span></div>
          <p className="mt-1 truncate text-[10px] font-semibold">{project.name}</p>
        </div>
        <div className="pointer-events-auto flex gap-2"><button aria-label="Fit Creative Flow to screen" className="grid size-9 place-items-center rounded-xl border border-border-soft bg-white text-text-muted shadow-sm" onClick={() => void flow.fitView({ padding: 0.22, duration: 600, maxZoom: 1.05 })} type="button"><Maximize2 className="size-3.5" /></button><Button onClick={() => onBack(project)} size="sm">Projects</Button></div>
      </div>

      {error && <div className="pointer-events-none absolute bottom-4 left-1/2 z-40 w-[min(620px,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-red-200 bg-red-50/96 px-3 py-2.5 text-center text-[9px] text-red-700 shadow-lg">{error}</div>}
      {blockedByAnother && <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 w-[min(660px,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-amber-200 bg-white/96 px-3 py-2.5 text-center text-[9px] text-text-muted shadow-lg">“{activeProject?.name}” currently owns the active Creative Flow AI job.</div>}

      <ReactFlow
        colorMode="light"
        defaultViewport={project.workflow.canvas.viewport}
        defaultEdgeOptions={{ type: 'smoothstep', zIndex: 8, style: { stroke: '#64748b', strokeWidth: 2.6, opacity: 0.95 } }}
        edges={edges}
        edgesFocusable={false}
        fitView={!project.workflow.canvas.viewport.zoom}
        maxZoom={1.8}
        minZoom={0.2}
        nodeTypes={nodeTypes}
        nodes={nodes}
        nodesConnectable={false}
        onEdgesChange={onEdgesChange}
        onMoveEnd={(_, viewport) => void saveCanvas(viewport)}
        onNodeDragStop={() => void saveCanvas(flow.getViewport())}
        onNodesChange={onNodesChange}
        panOnDrag
        proOptions={{ hideAttribution: true }}
        selectionOnDrag
      >
        <Background gap={28} size={1} color="rgba(100,116,139,.13)" />
        <Controls position="bottom-right" showInteractive={false} />
      </ReactFlow>

      {previewPost && <CreativePreviewModal
        onClose={() => setPreviewPostId(null)}
        onRegenerate={() => regenerateCreative(previewPost.id)}
        onToggleSelection={() => toggleCreativeSelection(previewPost.id)}
        post={previewPost}
        selected={project.workflow.review.selectedPostIds.includes(previewPost.id)}
      />}
    </div>
  </WorkspaceContext.Provider>
}

function NodeShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[20px] border border-border-soft bg-white shadow-[0_18px_52px_rgba(15,23,42,.10)] ${className}`}>{children}</div>
}

function AnimatedExpand({ children, id }: { children: ReactNode; id: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => gsap.fromTo(ref.current, { height: 0, opacity: 0, y: -6 }, { height: 'auto', opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }), ref)
    return () => ctx.revert()
  }, [id])
  return <div className="overflow-hidden" ref={ref}>{children}</div>
}

function ProductUrlNode(_: NodeProps) {
  const { project, urlDraft, urlExpanded, sourceBusy, setUrlDraft, setUrlExpanded, saveUrl } = useWorkspace()
  const saved = project.workflow.source.normalizedUrl
  return <>
    <Handle className="!size-3 !border-2 !border-white !bg-brand-cyan" position={Position.Right} type="source" />
    <NodeShell className="w-[330px]">
      <button className="flex w-full items-center gap-3 p-4 text-left" disabled={Boolean(project.activeJobType)} onClick={() => setUrlExpanded(!urlExpanded)} type="button"><span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-brand-cyan/20 bg-brand-cyan/[.06] text-brand-cyan"><Globe2 className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-[8px] font-bold uppercase tracking-[.14em] text-brand-cyan">Product URL</span><strong className="mt-1 block truncate text-[11px]">{saved ? displayDomain(saved) : 'Add product website'}</strong><span className="mt-0.5 block text-[8px] text-text-soft">{saved ? 'Saved to this project' : 'example.com is enough'}</span></span>{saved ? <Check className="size-4 text-brand-green" /> : <ChevronDown className={`size-4 text-text-soft ${urlExpanded ? 'rotate-180' : ''}`} />}</button>
      {urlExpanded && <AnimatedExpand id="url"><div className="nodrag border-t border-border-soft p-4"><label className="text-[8px] font-semibold text-text-muted">Website</label><div className="mt-1.5 flex gap-2"><input autoFocus className="min-h-10 min-w-0 flex-1 rounded-xl border border-border-soft bg-slate-50 px-3 text-[10px] outline-none focus:border-brand-cyan" disabled={sourceBusy || Boolean(project.activeJobType)} onChange={(event) => setUrlDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveUrl() }} placeholder="yourproduct.com" value={urlDraft} /><Button disabled={sourceBusy || Boolean(project.activeJobType)} onClick={saveUrl} size="sm" variant="primary">{sourceBusy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}Done</Button></div></div></AnimatedExpand>}
    </NodeShell>
  </>
}

function ProductImagesNode(_: NodeProps) {
  const { project, imageExpanded, sourceBusy, uploadProgress, localPreviews, setImageExpanded, uploadFiles, removeReference } = useWorkspace()
  const ids = project.workflow.source.referenceAssetIds
  const names = project.workflow.source.referenceNames
  const inputRef = useRef<HTMLInputElement>(null)
  const pick = (event: ChangeEvent<HTMLInputElement>) => { const files = Array.from(event.target.files || []); event.target.value = ''; uploadFiles(files) }
  const drop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); uploadFiles(Array.from(event.dataTransfer.files || [])) }

  return <>
    <Handle className="!size-3 !border-2 !border-white !bg-brand-purple" position={Position.Right} type="source" />
    <NodeShell className="w-[330px]">
      <button className="flex w-full items-center gap-3 p-4 text-left" disabled={Boolean(project.activeJobType)} onClick={() => setImageExpanded(!imageExpanded)} type="button"><span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-brand-purple/20 bg-brand-purple/[.06] text-brand-purple"><FileImage className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-[8px] font-bold uppercase tracking-[.14em] text-brand-purple">Product Images</span><strong className="mt-1 block truncate text-[11px]">{ids.length ? `${ids.length} product reference${ids.length === 1 ? '' : 's'}` : 'Upload product / logo'}</strong><span className="mt-0.5 block text-[8px] text-text-soft">Up to 8 images · saved immediately</span></span>{ids.length ? <Check className="size-4 text-brand-green" /> : <ChevronDown className={`size-4 text-text-soft ${imageExpanded ? 'rotate-180' : ''}`} />}</button>
      {imageExpanded && <AnimatedExpand id="images"><div className="nodrag border-t border-border-soft p-4"><div className="rounded-2xl border border-dashed border-brand-purple/25 bg-brand-purple/[.025] p-3 text-center" onDragOver={(event) => event.preventDefault()} onDrop={drop}><UploadCloud className="mx-auto size-5 text-brand-purple" /><strong className="mt-2 block text-[9px]">Drop product images here</strong><Button className="mt-2" disabled={sourceBusy || Boolean(project.activeJobType) || ids.length >= 8} onClick={() => inputRef.current?.click()} size="sm"><ImagePlus className="size-3" />Choose images</Button><input accept="image/*" className="hidden" multiple onChange={pick} ref={inputRef} type="file" />{sourceBusy && uploadProgress > 0 && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-brand-purple" style={{ width: `${uploadProgress}%` }} /></div>}</div>{ids.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2">{ids.map((id, index) => { const preview = localPreviews.find((item) => item.id === id); return <div className="overflow-hidden rounded-xl border border-border-soft bg-slate-50" key={id}>{preview ? <img alt={preview.name} className="aspect-[4/3] w-full object-cover" src={preview.url} /> : <div className="grid aspect-[4/3] place-items-center"><FileImage className="size-5 text-brand-purple/45" /></div>}<div className="flex items-center gap-1 border-t border-border-soft bg-white px-2 py-1.5"><span className="min-w-0 flex-1 truncate text-[7px] text-text-muted">{names[index] || `Reference ${index + 1}`}</span><button aria-label="Remove product reference" className="grid size-6 place-items-center rounded-md text-text-soft hover:bg-red-50 hover:text-red-500" disabled={sourceBusy || Boolean(project.activeJobType)} onClick={() => removeReference(index)} type="button"><X className="size-3" /></button></div></div> })}</div>}</div></AnimatedExpand>}
    </NodeShell>
  </>
}

function AnalyzeProductNode(_: NodeProps) {
  const { project, sourceBusy, runAnalysis } = useWorkspace()
  const sourceReady = Boolean(project.workflow.source.normalizedUrl || project.workflow.source.referenceAssetIds.length)
  const running = project.activeJobType === 'PRODUCT_ANALYSIS'
  const success = Boolean(project.workflow.analysis)
  const failed = project.currentStage === 'PRODUCT_ANALYSIS_FAILED'
  return <>
    <Handle className="!size-3 !border-2 !border-white !bg-brand-cyan" position={Position.Left} type="target" />
    <Handle className="!size-3 !border-2 !border-white !bg-brand-cyan" position={Position.Right} type="source" />
    <NodeShell className={`w-[260px] ${running ? 'border-brand-cyan/35 shadow-[0_22px_70px_rgba(20,184,166,.16)]' : success ? 'border-brand-green/25' : ''}`}><div className="p-4 text-center"><CreativeFlowMotionSlot className="mx-auto size-14" state={running ? 'working' : success ? 'success' : failed ? 'error' : 'idle'} /><span className="mt-3 block text-[8px] font-bold uppercase tracking-[.14em] text-brand-cyan">Analyse Product</span><strong className="mt-1 block text-[11px]">{running ? 'Understanding the product' : success ? 'Product understood' : 'Connect the product inputs'}</strong><p className="mt-1.5 text-[8px] leading-4 text-text-soft">{running ? project.progress.label || 'Analysing…' : success ? 'Product Intelligence is ready.' : 'URL, images, or both can feed the analysis.'}</p>{!success && <Button className="mt-3 w-full" disabled={!sourceReady || running || sourceBusy} onClick={runAnalysis} size="sm" variant="primary">{running ? <Loader2 className="size-3 animate-spin" /> : <ScanSearch className="size-3" />}{failed ? 'Retry analysis' : 'Analyse product'}</Button>}</div></NodeShell>
  </>
}

function AnalysisStepNode(props: NodeProps) {
  const { project } = useWorkspace()
  const index = Math.max(0, Math.min(ANALYSIS_STEPS.length - 1, Number((props.data as FlowNodeData | undefined)?.analysisStep || 0)))
  const step = ANALYSIS_STEPS[index]
  const complete = Boolean(project.workflow.analysis) || Number(project.progress.current || 0) > index + 1
  const working = !project.workflow.analysis && project.activeJobType === 'PRODUCT_ANALYSIS' && Number(project.progress.current || 0) === index + 1
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => gsap.fromTo(ref.current, { scale: 0.8, opacity: 0, x: -24 }, { scale: 1, opacity: 1, x: 0, duration: 0.5, delay: index * 0.08, ease: 'back.out(1.7)' }), ref)
    return () => ctx.revert()
  }, [index])
  return <div ref={ref}><Handle className="!size-3 !border-2 !border-white !bg-brand-cyan" position={Position.Left} type="target" /><Handle className="!size-3 !border-2 !border-white !bg-brand-cyan" position={Position.Right} type="source" /><NodeShell className={`w-[300px] ${complete ? 'border-brand-green/25' : working ? 'border-brand-cyan/30' : ''}`}><div className="flex items-center gap-3 p-4"><CreativeFlowMotionSlot className="size-14 shrink-0" state={working ? 'working' : complete ? 'success' : 'idle'} /><div className="min-w-0 flex-1"><span className="block text-[7px] font-bold uppercase tracking-[.14em] text-brand-cyan">{step.eyebrow}</span><strong className="mt-1 block text-[10px]">{step.title}</strong><p className="mt-1 text-[7px] leading-4 text-text-muted">{working ? project.progress.label || step.description : step.description}</p></div><span className="grid size-7 shrink-0 place-items-center rounded-full border border-brand-cyan/20 bg-brand-cyan/[.05] text-[8px] font-bold text-brand-cyan">{index + 1}</span></div></NodeShell></div>
}

function ProductIntelligenceNode(_: NodeProps) {
  const { project, analysis, renderCampaign, generationEstimate, generationEstimateLoading, campaignExpanded, advancedExpanded, campaignBusy, retryMissingBusy, campaignGoal, campaignPlatforms, creativeCount, creativeStyle, campaignAudience, setCampaignExpanded, setAdvancedExpanded, setCampaignGoal, toggleCampaignPlatform, setCreativeCount, setCreativeStyle, setCampaignAudience, generateCampaign, selectAllReadyCreatives, clearCreativeSelection, retryMissingCreatives } = useWorkspace()
  if (!analysis) return null
  const source = analysis.sourceAnalysis
  const brand = analysis.brandPack
  const running = ['CAMPAIGN_GENERATION', 'CREATIVE_RENDER'].includes(project.activeJobType || '')
  const renderRunning = project.activeJobType === 'CREATIVE_RENDER'
  const finished = renderFinished(project)
  const readyPosts = renderCampaign?.posts.filter((post) => post.contentType === 'IMAGE' && Boolean(post.mediaAssetId)) || []
  const missingPosts = renderCampaign?.posts.filter((post) => post.contentType === 'IMAGE' && !post.mediaAssetId) || []
  const selectedCount = project.workflow.review.selectedPostIds.length
  const locked = Boolean(project.activeJobType || project.renderCampaignId)
  const platforms = ['Instagram', 'Facebook', 'X', 'LinkedIn', 'TikTok', 'Threads', 'Bluesky', 'Pinterest']
  const goals = ['AI Recommended', 'Sales', 'Traffic', 'Awareness', 'Product launch']
  const styles = ['AI Recommended', 'Premium SaaS', 'Performance ads', 'Minimal editorial', 'Lifestyle', 'Infographic']

  return <>
    <Handle className="!size-3 !border-2 !border-white !bg-brand-green" position={Position.Left} type="target" />
    <Handle className="!size-3 !border-2 !border-white !bg-brand-purple" position={Position.Right} type="source" />
    <NodeShell className="w-[450px] overflow-hidden border-brand-green/25 shadow-[0_26px_80px_rgba(34,197,94,.10)]">
      <div className="border-b border-border-soft bg-[linear-gradient(135deg,rgba(240,253,250,.8),white)] p-4"><div className="flex items-center gap-3"><CreativeFlowMotionSlot className="size-16 shrink-0" state={running ? 'working' : 'success'} /><div className="min-w-0"><span className="text-[8px] font-bold uppercase tracking-[.15em] text-brand-green">Product Intelligence</span><h4 className="mt-1 truncate text-[13px] font-semibold">{source.productName || brand.brandName || project.name}</h4><p className="mt-1 line-clamp-2 text-[8px] leading-4 text-text-muted">{source.summary || 'Product and brand sources analysed.'}</p></div></div></div>
      <div className="p-4"><div className="grid grid-cols-3 gap-2"><div className="rounded-xl border border-border-soft bg-slate-50 p-2.5"><span className="text-[7px] uppercase text-text-soft">Claims</span><strong className="mt-1 block text-[12px]">{source.verifiedClaims.length}</strong></div><div className="rounded-xl border border-border-soft bg-slate-50 p-2.5"><span className="text-[7px] uppercase text-text-soft">References</span><strong className="mt-1 block text-[12px]">{analysis.analysedReferences.length}</strong></div><div className="rounded-xl border border-border-soft bg-slate-50 p-2.5"><span className="text-[7px] uppercase text-text-soft">Confidence</span><strong className="mt-1 block text-[10px] capitalize">{brand.confidence}</strong></div></div>{brand.colors.length > 0 && <div className="mt-3 flex items-center gap-2"><span className="text-[7px] uppercase text-text-soft">Palette</span><div className="flex gap-1">{brand.colors.slice(0, 6).map((color) => <span className="size-4 rounded-full border border-black/10" key={color} style={{ backgroundColor: color }} />)}</div></div>}{analysis.analysedUrl?.url && <a className="nodrag mt-3 inline-flex items-center gap-1.5 text-[8px] font-medium text-brand-cyan hover:underline" href={analysis.analysedUrl.url} rel="noreferrer" target="_blank"><Globe2 className="size-3" />{displayDomain(analysis.analysedUrl.url)}<ExternalLink className="size-2.5" /></a>}</div>

      <button className={`nodrag flex w-full items-center gap-3 border-t border-border-soft px-4 py-3.5 text-left ${campaignExpanded ? 'bg-brand-purple/[.035]' : 'bg-slate-50/65'}`} onClick={() => setCampaignExpanded(!campaignExpanded)} type="button"><CreativeFlowMotionSlot className="size-11 shrink-0" state={running ? 'working' : finished ? 'success' : campaignExpanded ? 'selected' : 'idle'} /><span className="min-w-0 flex-1"><span className="block text-[8px] font-bold uppercase tracking-[.14em] text-brand-purple">Campaign</span><strong className="mt-0.5 block truncate text-[10px]">{running ? project.progress.label || 'Generating campaign…' : finished ? `${readyPosts.length} creatives ready` : `${creativeCount} creatives · ${campaignPlatforms.length} platform${campaignPlatforms.length === 1 ? '' : 's'}`}</strong><span className="mt-0.5 block truncate text-[7px] text-text-soft">{running ? 'Planning is handled automatically in the background' : `${campaignGoal} · ${creativeStyle}`}</span></span><ChevronDown className={`size-4 text-text-soft ${campaignExpanded ? 'rotate-180' : ''}`} /></button>

      {running && <div className="border-t border-border-soft bg-white px-4 py-3">{renderRunning ? <><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-cyan transition-all" style={{ width: `${Math.max(8, Math.min(100, Math.round(project.progress.current / Math.max(1, project.progress.total) * 100)))}%` }} /></div><div className="mt-1.5 flex justify-between text-[7px] text-text-soft"><span>{project.progress.current} generated</span><span>{project.progress.total || creativeCount} total</span></div></> : <><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[40%] animate-pulse rounded-full bg-[linear-gradient(90deg,#8b5cf6,#14b8a6)]" /></div><p className="mt-1.5 text-[7px] text-text-soft">Preparing the campaign, then rendering begins automatically.</p></>}</div>}

      {campaignExpanded && !project.renderCampaignId && <AnimatedExpand id="campaign"><div className="nodrag border-t border-border-soft bg-white p-4"><span className="text-[8px] font-semibold text-text-muted">Campaign goal</span><div className="mt-2 flex flex-wrap gap-1.5">{goals.map((goal) => <button className={`rounded-lg border px-2.5 py-1.5 text-[8px] font-medium ${campaignGoal === goal ? 'border-brand-purple/30 bg-brand-purple/[.07] text-brand-purple' : 'border-border-soft'}`} disabled={locked} key={goal} onClick={() => setCampaignGoal(goal)} type="button">{goal}</button>)}</div><div className="mt-4"><span className="text-[8px] font-semibold text-text-muted">Platforms</span><div className="mt-2 flex flex-wrap gap-1.5">{platforms.map((platform) => { const selected = campaignPlatforms.includes(platform); return <button className={`rounded-lg border px-2.5 py-1.5 text-[8px] ${selected ? 'border-brand-cyan/30 bg-brand-cyan/[.07] text-brand-cyan' : 'border-border-soft'}`} disabled={locked} key={platform} onClick={() => toggleCampaignPlatform(platform)} type="button">{selected && <Check className="mr-1 inline size-2.5" />}{platform}</button> })}</div></div><div className="mt-4"><span className="text-[8px] font-semibold text-text-muted">How many creatives?</span><div className="mt-2 flex flex-wrap gap-1.5">{[5, 10, 20, 50].map((count) => <button className={`min-w-10 rounded-lg border px-2.5 py-1.5 text-[8px] font-semibold ${creativeCount === count ? 'border-brand-cyan/30 bg-brand-cyan/[.07] text-brand-cyan' : 'border-border-soft'}`} disabled={locked} key={count} onClick={() => setCreativeCount(count)} type="button">{count}</button>)}<label className="flex min-h-8 items-center rounded-lg border border-border-soft px-2"><span className="mr-1 text-[7px] text-text-soft">Custom</span><input className="w-10 bg-transparent text-[8px] outline-none" disabled={locked} max={50} min={1} onChange={(event) => setCreativeCount(Math.max(1, Math.min(50, Number(event.target.value || 1))))} type="number" value={creativeCount} /></label></div></div><div className="mt-4 rounded-xl border border-brand-cyan/15 bg-brand-cyan/[.035] p-3">{generationEstimateLoading ? <span className="flex items-center gap-2 text-[8px] text-text-muted"><Loader2 className="size-3 animate-spin" />Calculating campaign credits…</span> : generationEstimate ? <><div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[8px] font-semibold text-text-muted"><Coins className="size-3 text-brand-cyan" />{creativeCount} creatives</span><strong className="text-[10px]">{generationEstimate.requiredCredits} credits</strong></div><div className="mt-1.5 flex justify-between text-[7px] text-text-soft"><span>{generationEstimate.creditsPerCreative} per creative</span><span>{generationEstimate.creditsRemaining} available</span></div></> : <span className="text-[8px] text-text-muted">Credit estimate will appear here.</span>}</div><button className="mt-4 flex w-full items-center justify-between rounded-xl border border-border-soft bg-slate-50 px-3 py-2 text-left" disabled={locked} onClick={() => setAdvancedExpanded(!advancedExpanded)} type="button"><span><strong className="block text-[8px]">Advanced options</strong><span className="text-[7px] text-text-soft">Optional style and audience direction</span></span><ChevronDown className={`size-3.5 text-text-soft ${advancedExpanded ? 'rotate-180' : ''}`} /></button>{advancedExpanded && <AnimatedExpand id="advanced"><div className="mt-3 space-y-3 rounded-xl border border-border-soft bg-slate-50/70 p-3"><label className="block"><span className="text-[8px] font-semibold text-text-muted">Creative style</span><select className="mt-1.5 min-h-9 w-full rounded-lg border border-border-soft bg-white px-2.5 text-[8px]" disabled={locked} onChange={(event) => setCreativeStyle(event.target.value)} value={creativeStyle}>{styles.map((style) => <option key={style}>{style}</option>)}</select></label><label className="block"><span className="text-[8px] font-semibold text-text-muted">Audience direction</span><textarea className="mt-1.5 min-h-20 w-full resize-none rounded-lg border border-border-soft bg-white p-2.5 text-[8px]" disabled={locked} maxLength={500} onChange={(event) => setCampaignAudience(event.target.value)} placeholder="Optional — leave blank for automatic audience inference." value={campaignAudience} /></label></div></AnimatedExpand>}<Button className="mt-4 w-full" disabled={campaignBusy || locked || generationEstimateLoading || !generationEstimate?.canGenerate || !campaignPlatforms.length} onClick={generateCampaign} size="sm" variant="primary">{campaignBusy ? <Loader2 className="size-3 animate-spin" /> : <Rocket className="size-3" />}Generate Campaign{generationEstimate?.requiredCredits ? ` · ${generationEstimate.requiredCredits} credits` : ''}</Button>{generationEstimate && !generationEstimate.canGenerate && <p className="mt-2 text-center text-[8px] text-red-600">Not enough AI credits for this campaign.</p>}</div></AnimatedExpand>}

      {finished && <div className="border-t border-brand-green/15 bg-brand-green/[.035] px-4 py-3"><div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[8px] font-semibold text-brand-green"><CheckCircle2 className="size-3" />Creative review ready</span><span className="text-[8px] text-text-soft">{readyPosts.length} ready</span></div>{readyPosts.length > 0 && <div className="mt-2 grid grid-cols-2 gap-2"><Button disabled={Boolean(project.activeJobType) || selectedCount === readyPosts.length} onClick={selectAllReadyCreatives} size="sm">Select all</Button><Button disabled={Boolean(project.activeJobType) || !selectedCount} onClick={clearCreativeSelection} size="sm">Clear selection</Button></div>}{missingPosts.length > 0 && <Button className="mt-2 w-full" disabled={retryMissingBusy || Boolean(project.activeJobType)} onClick={retryMissingCreatives} size="sm">{retryMissingBusy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}Retry {missingPosts.length} missing</Button>}</div>}
    </NodeShell>
  </>
}

function CreativeAssetNode(props: NodeProps) {
  const postId = String(props.id).replace(/^creative:/, '')
  const { project, renderCampaign, reviewBusy, toggleCreativeSelection, regenerateCreative, removeCreative, openCreativePreview } = useWorkspace()
  const post = renderCampaign?.posts.find((item) => item.id === postId)
  const selected = project.workflow.review.selectedPostIds.includes(postId)
  const regenerating = project.activeJobType === 'CREATIVE_REGENERATE' && project.activeJobId === postId
  const imageUrl = post?.mediaAsset?.url || post?.mediaAsset?.thumbnailUrl || ''
  const [directionOpen, setDirectionOpen] = useState(false)
  const [directionDraft, setDirectionDraft] = useState('')
  if (!post) return null
  const locked = reviewBusy || Boolean(project.activeJobType)
  const failed = !post.mediaAssetId && renderCampaign?.status !== 'GENERATING_IMAGES'
  const regenerateWithDirection = () => {
    const direction = directionDraft.trim()
    if (!direction) return
    regenerateCreative(postId, { imageBrief: `${post.imageBrief || ''}\n\nUser direction: ${direction}`.trim() })
    setDirectionDraft('')
    setDirectionOpen(false)
  }

  return <><Handle className="!size-3 !border-2 !border-white !bg-brand-green" position={Position.Left} type="target" /><Handle className={`!size-3 !border-2 !border-white ${selected ? '!bg-brand-purple' : '!bg-brand-green'}`} position={Position.Right} type="source" /><NodeShell className={`w-[300px] overflow-hidden ${selected ? 'border-brand-purple/40 shadow-[0_24px_70px_rgba(139,92,246,.16)]' : 'border-brand-green/20'}`}><div className="relative bg-slate-100">{imageUrl ? <button aria-label={`Open creative ${post.sequence}`} className="nodrag block w-full" onClick={() => openCreativePreview(postId)} type="button"><img alt={`Creative ${post.sequence}`} className="aspect-[4/5] max-h-[320px] w-full object-cover" src={imageUrl} /></button> : <div className="grid aspect-[4/5] place-items-center"><CreativeFlowMotionSlot className="size-16" state={regenerating ? 'working' : failed ? 'error' : 'idle'} /></div>}<div className="absolute left-2.5 top-2.5 rounded-full border border-white/70 bg-white/92 px-2 py-1 text-[7px] font-bold shadow-sm">Creative {String(post.sequence).padStart(2, '0')}</div>{imageUrl && <button aria-label="Open image preview" className="nodrag absolute bottom-2.5 right-2.5 grid size-8 place-items-center rounded-xl border border-white/70 bg-white/92 text-text-main shadow-md" onClick={() => openCreativePreview(postId)} type="button"><Eye className="size-3.5" /></button>}</div><div className="p-3.5"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><span className="block text-[7px] font-bold uppercase tracking-[.12em] text-brand-cyan">{post.pillar || 'Campaign creative'}</span><strong className="mt-1 line-clamp-2 block text-[9px] leading-4">{post.hook || post.caption}</strong></div>{post.mediaAssetId && <button aria-label={selected ? 'Deselect creative' : 'Select creative'} aria-pressed={selected} className={`nodrag grid size-8 shrink-0 place-items-center rounded-xl border ${selected ? 'border-brand-purple/30 bg-brand-purple text-white' : 'border-border-soft bg-white text-text-soft'}`} disabled={locked} onClick={() => toggleCreativeSelection(postId)} type="button"><Check className="size-3.5" /></button>}</div>{regenerating && <div className="mt-3 rounded-xl border border-brand-cyan/20 bg-brand-cyan/[.04] p-2.5 text-[8px] text-brand-cyan"><Loader2 className="mr-1 inline size-3 animate-spin" />Creating a new production-quality version…</div>}<div className="nodrag mt-3 grid grid-cols-2 gap-1.5"><Button disabled={!post.mediaAssetId} onClick={() => openCreativePreview(postId)} size="sm"><Eye className="size-3" />Open image</Button><Button disabled={locked || !post.mediaAssetId} onClick={() => regenerateCreative(postId)} size="sm"><RefreshCw className="size-3" />Regenerate</Button><Button disabled={locked || !post.mediaAssetId} onClick={() => setDirectionOpen((value) => !value)} size="sm"><Pencil className="size-3" />Direction</Button><button className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-red-100 px-2 text-[8px] font-medium text-red-500 hover:bg-red-50" disabled={locked} onClick={() => removeCreative(postId)} type="button"><Trash2 className="size-3" />Remove</button></div>{directionOpen && <AnimatedExpand id={`direction-${postId}`}><div className="nodrag mt-3 rounded-xl border border-brand-cyan/15 bg-slate-50 p-2.5"><span className="text-[8px] font-semibold text-text-muted">Optional direction</span><textarea autoFocus className="mt-1.5 min-h-14 w-full resize-none rounded-lg border border-border-soft bg-white p-2 text-[8px]" maxLength={500} onChange={(event) => setDirectionDraft(event.target.value)} placeholder="Example: cleaner layout, less text, larger product UI" value={directionDraft} /><div className="mt-2 flex justify-end gap-1.5"><Button onClick={() => setDirectionOpen(false)} size="sm">Cancel</Button><Button disabled={!directionDraft.trim()} onClick={regenerateWithDirection} size="sm" variant="primary"><Sparkles className="size-3" />Regenerate</Button></div></div></AnimatedExpand>}</div></NodeShell></>
}

function ScheduleCampaignNode(_: NodeProps) {
  const { project, handoffBusy, sendSelectedToScheduler } = useWorkspace()
  const selectedCount = project.workflow.review.selectedPostIds.length
  return <><Handle className="!size-3 !border-2 !border-white !bg-brand-purple" position={Position.Left} type="target" /><NodeShell className="w-[300px] border-brand-purple/30 shadow-[0_24px_76px_rgba(139,92,246,.13)]"><div className="p-4 text-center"><CreativeFlowMotionSlot className="mx-auto size-16" state={handoffBusy ? 'working' : project.handoffCampaignId ? 'success' : 'selected'} /><span className="mt-2 block text-[8px] font-bold uppercase tracking-[.14em] text-brand-purple">Schedule Campaign</span><strong className="mt-1 block text-[12px]">{selectedCount} creative{selectedCount === 1 ? '' : 's'} selected</strong><p className="mt-1.5 text-[8px] leading-4 text-text-muted">Review is complete. Continue with destinations and publishing times in Bulk Scheduler.</p><Button className="mt-3 w-full" disabled={handoffBusy || Boolean(project.activeJobType) || !selectedCount} onClick={sendSelectedToScheduler} size="sm" variant="primary">{handoffBusy ? <Loader2 className="size-3 animate-spin" /> : <CalendarRange className="size-3" />}Continue to Bulk Scheduler</Button></div></NodeShell></>
}

function CreativePreviewModal({ post, selected, onClose, onToggleSelection, onRegenerate }: {
  post: CreativeFlowRenderCampaign['posts'][number]
  selected: boolean
  onClose: () => void
  onToggleSelection: () => void
  onRegenerate: () => void
}) {
  const imageUrl = post.mediaAsset?.url || post.mediaAsset?.thumbnailUrl || ''
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }} role="dialog" aria-modal="true"><div className="flex max-h-[94vh] w-[min(1100px,96vw)] flex-col overflow-hidden rounded-[24px] border border-white/15 bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-border-soft px-4 py-3"><div><span className="text-[8px] font-bold uppercase tracking-[.14em] text-brand-cyan">Creative preview</span><strong className="mt-0.5 block text-[11px]">Creative {String(post.sequence).padStart(2, '0')} · {post.pillar || 'Campaign creative'}</strong></div><button aria-label="Close creative preview" className="grid size-9 place-items-center rounded-xl border border-border-soft text-text-muted" onClick={onClose} type="button"><X className="size-4" /></button></div><div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4 sm:p-6"><div className="mx-auto flex min-h-[56vh] items-center justify-center">{imageUrl ? <img alt={`Creative ${post.sequence} full preview`} className="max-h-[76vh] max-w-full rounded-2xl object-contain shadow-[0_20px_70px_rgba(15,23,42,.20)]" src={imageUrl} /> : <div className="text-sm text-text-muted">Image unavailable.</div>}</div></div><div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-soft bg-white px-4 py-3"><div className="min-w-0 flex-1"><strong className="line-clamp-1 text-[9px]">{post.hook || post.caption}</strong><span className="mt-0.5 block text-[7px] text-text-soft">Inspect the full design before selecting it for publishing.</span></div><div className="flex flex-wrap gap-2">{imageUrl && <a className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border-soft px-3 text-[8px] font-semibold text-text-muted hover:text-text-main" href={imageUrl} rel="noreferrer" target="_blank"><ExternalLink className="size-3" />Open original</a>}<Button onClick={onRegenerate} size="sm"><RefreshCw className="size-3" />Regenerate</Button><Button onClick={onToggleSelection} size="sm" variant={selected ? undefined : 'primary'}>{selected ? <X className="size-3" /> : <Check className="size-3" />}{selected ? 'Deselect' : 'Select for publish'}</Button></div></div></div></div>
}
