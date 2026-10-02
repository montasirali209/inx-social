import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { gsap } from 'gsap'
import { useNavigate } from 'react-router-dom'
import {
  BrainCircuit,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileImage,
  Globe2,
  Coins,
  ImagePlus,
  Images,
  Loader2,
  Pencil,
  Layers3,
  Maximize2,
  RefreshCw,
  Rocket,
  ScanSearch,
  Sparkles,
  Target,
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
  getCreativeFlowGenerationEstimate,
  getCreativeFlowProject,
  getCreativeFlowRender,
  handoffCreativeFlowProject,
  saveCreativeFlowCampaignSetup,
  saveCreativeFlowProjectCanvas,
  saveCreativeFlowProjectSource,
  saveCreativeFlowReviewReveal,
  saveCreativeFlowReviewSelection,
  saveCreativeFlowStrategySelection,
  startCreativeFlowProjectGeneration,
  startCreativeFlowProjectStrategy,
  regenerateCreativeFlowProjectPost,
  removeCreativeFlowProjectPost,
  retryCreativeFlowMissing,
  type CreativeFlowAnalysis,
  type CreativeFlowGenerationEstimate,
  type CreativeFlowProject,
  type CreativeFlowRenderCampaign,
  type CreativeFlowProjectList,
} from '../../../lib/creative-flow-api'
import { Button } from '../../ui/Button'
import { CreativeFlowMotionSlot } from './CreativeFlowMotion'

type Stage2Node = Node<Record<string, never>>
type Stage2Edge = Edge<{ active?: boolean; complete?: boolean }, 'motion'>

type LocalPreview = {
  id: string
  name: string
  url: string
}

type WorkspaceContextValue = {
  project: CreativeFlowProject
  analysis: CreativeFlowAnalysis | null
  urlDraft: string
  urlExpanded: boolean
  imageExpanded: boolean
  campaignExpanded: boolean
  advancedExpanded: boolean
  campaignBusy: boolean
  strategyExpanded: boolean
  strategyBusy: boolean
  generationBusy: boolean
  generationEstimate: CreativeFlowGenerationEstimate | null
  generationEstimateLoading: boolean
  renderCampaign: CreativeFlowRenderCampaign | null
  reviewBusy: boolean
  retryMissingBusy: boolean
  handoffBusy: boolean
  campaignGoal: string
  campaignPlatforms: string[]
  creativeCount: number
  creativeStyle: string
  campaignAudience: string
  sourceBusy: boolean
  running: boolean
  error: string
  uploadProgress: number
  localPreviews: LocalPreview[]
  setUrlDraft: (value: string) => void
  setUrlExpanded: (value: boolean) => void
  setImageExpanded: (value: boolean) => void
  setCampaignExpanded: (value: boolean) => void
  setAdvancedExpanded: (value: boolean) => void
  setStrategyExpanded: (value: boolean) => void
  setCampaignGoal: (value: string) => void
  toggleCampaignPlatform: (value: string) => void
  setCreativeCount: (value: number) => void
  setCreativeStyle: (value: string) => void
  setCampaignAudience: (value: string) => void
  saveCampaignSetup: () => void
  startStrategy: () => void
  toggleStrategyConcept: (sequence: number) => void
  startGeneration: () => void
  toggleCreativeSelection: (postId: string) => void
  selectAllReadyCreatives: () => void
  clearCreativeSelection: () => void
  retryMissingCreatives: () => void
  regenerateCreative: (postId: string, input?: { caption?: string; imageBrief?: string }) => void
  removeCreative: (postId: string) => void
  sendSelectedToScheduler: () => void
  saveUrl: () => void
  uploadFiles: (files: File[]) => void
  removeReference: (index: number) => void
  runAnalysis: () => void
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

function campaignConfigured(project: CreativeFlowProject) {
  return Boolean(project.workflow.strategyPlan || project.renderCampaignId) || [
    'CAMPAIGN_READY',
    'STRATEGY_PLANNING',
    'STRATEGY_READY',
    'STRATEGY_FAILED',
    'CREATIVE_RENDER_STARTING',
    'CREATIVE_RENDER_RUNNING',
    'CREATIVE_RENDER_FAILED',
    'RENDER_READY',
    'RENDER_PARTIAL',
  ].includes(project.currentStage)
}

function renderFinished(project: CreativeFlowProject) {
  return [
    'RENDER_READY',
    'RENDER_PARTIAL',
    'REVIEW_READY',
    'HANDOFF_READY',
    'CREATIVE_REGENERATING',
    'CREATIVE_REGENERATE_FAILED',
  ].includes(project.currentStage)
}

function focusNodeIds(project: CreativeFlowProject) {
  if (project.activeJobType === 'PRODUCT_ANALYSIS' || project.currentStage === 'PRODUCT_ANALYSIS_RUNNING') {
    return ['productUrl', 'productImages', 'analyzeProduct', 'analysisProcess']
  }
  if (!project.workflow.analysis) {
    return ['productUrl', 'productImages', 'analyzeProduct']
  }
  if (
    project.activeJobType === 'STRATEGY_PLANNING' ||
    ['CAMPAIGN_READY', 'STRATEGY_PLANNING', 'STRATEGY_FAILED'].includes(project.currentStage)
  ) {
    return ['campaignSetup', 'creativeStrategy']
  }
  if (project.workflow.review.revealedPostIds.length) {
    return [
      'generateCreatives',
      ...project.workflow.review.revealedPostIds.map((id) => creativeNodeId(id)),
      ...(project.workflow.review.selectedPostIds.length ? ['scheduleCampaign'] : []),
    ]
  }
  if (
    project.workflow.strategyPlan &&
    (
      project.activeJobType === 'CREATIVE_RENDER' ||
      project.renderCampaignId ||
      ['STRATEGY_READY', 'CREATIVE_RENDER_STARTING', 'CREATIVE_RENDER_RUNNING', 'CREATIVE_RENDER_FAILED', 'RENDER_READY', 'RENDER_PARTIAL'].includes(project.currentStage)
    )
  ) {
    return ['creativeStrategy', 'generateCreatives']
  }
  return ['productIntelligence', 'campaignSetup']
}

function creativeNodeId(postId: string) {
  return `creative:${postId}`
}

function creativeNodePosition(project: CreativeFlowProject, _postId: string, index: number) {
  const base = project.workflow.canvas.positions.generateCreatives
  const column = index % 4
  const row = Math.floor(index / 4)
  return {
    x: base.x + 430 + (column * 340),
    y: base.y - 420 + (row * 350),
  }
}

function scheduleNodePosition(project: CreativeFlowProject, creativeCount: number) {
  const base = project.workflow.canvas.positions.generateCreatives
  const columns = Math.max(1, Math.min(4, Math.max(creativeCount, 1)))
  return {
    x: base.x + 430 + (columns * 340) + 390,
    y: base.y - 40,
  }
}

function buildReviewGraph(
  project: CreativeFlowProject,
  campaign: CreativeFlowRenderCampaign | null,
  revealedPostIds: string[],
) {
  if (!campaign || !project.renderCampaignId) return { nodes: [] as Stage2Node[], edges: [] as Stage2Edge[] }

  const revealed = new Set(revealedPostIds)
  const selected = new Set(project.workflow.review.selectedPostIds)
  const finished = campaign.status !== 'GENERATING_IMAGES'
  const visiblePosts = campaign.posts.filter((post) =>
    finished || revealed.has(post.id)
  )

  const nodes: Stage2Node[] = visiblePosts.map((post, index) => ({
    id: creativeNodeId(post.id),
    type: 'creativeAsset',
    position: creativeNodePosition(project, post.id, index),
    data: {},
    draggable: false,
  }))

  const edges: Stage2Edge[] = visiblePosts.map((post) => ({
    id: `generate-${post.id}`,
    source: 'generateCreatives',
    target: creativeNodeId(post.id),
    type: 'motion',
    data: {
      active: project.activeJobType === 'CREATIVE_REGENERATE' && project.activeJobId === post.id,
      complete: Boolean(post.mediaAssetId),
    },
  }))

  const selectedVisible = visiblePosts.filter((post) => selected.has(post.id) && Boolean(post.mediaAssetId))
  if (selectedVisible.length) {
    nodes.push({
      id: 'scheduleCampaign',
      type: 'scheduleCampaign',
      position: scheduleNodePosition(project, visiblePosts.length),
      data: {},
      draggable: false,
    })
    selectedVisible.forEach((post) => {
      edges.push({
        id: `selected-${post.id}-schedule`,
        source: creativeNodeId(post.id),
        target: 'scheduleCampaign',
        type: 'motion',
        data: { active: true, complete: Boolean(project.handoffCampaignId) },
      })
    })
  }

  return { nodes, edges }
}

function defaultNodes(project: CreativeFlowProject): Stage2Node[] {
  const positions = project.workflow.canvas.positions
  const running = project.activeJobType === 'PRODUCT_ANALYSIS'
  const analysis = project.workflow.analysis
  const nodes: Stage2Node[] = [
    { id: 'productUrl', type: 'productUrl', position: positions.productUrl, data: {}, draggable: true },
    { id: 'productImages', type: 'productImages', position: positions.productImages, data: {}, draggable: true },
    { id: 'analyzeProduct', type: 'analyzeProduct', position: positions.analyzeProduct, data: {}, draggable: true },
  ]
  if (running && !analysis) {
    nodes.push({ id: 'analysisProcess', type: 'analysisProcess', position: positions.productIntelligence, data: {}, draggable: false })
  } else if (analysis) {
    nodes.push({ id: 'productIntelligence', type: 'productIntelligence', position: positions.productIntelligence, data: {}, draggable: true })
    nodes.push({ id: 'campaignSetup', type: 'campaignSetup', position: positions.campaignSetup, data: {}, draggable: true })
    if (campaignConfigured(project)) {
      nodes.push({ id: 'creativeStrategy', type: 'creativeStrategy', position: positions.creativeStrategy, data: {}, draggable: true })
    }
    if (project.workflow.strategyPlan) {
      nodes.push({ id: 'generateCreatives', type: 'generateCreatives', position: positions.generateCreatives, data: {}, draggable: true })
    }
  }
  return nodes
}

function defaultEdges(project: CreativeFlowProject): Stage2Edge[] {
  const running = project.activeJobType === 'PRODUCT_ANALYSIS'
  const analysis = project.workflow.analysis
  const sourceActive = running
  const edges: Stage2Edge[] = [
    {
      id: 'url-analyze',
      source: 'productUrl',
      target: 'analyzeProduct',
      type: 'motion',
      data: { active: sourceActive, complete: Boolean(analysis) },
    },
    {
      id: 'images-analyze',
      source: 'productImages',
      target: 'analyzeProduct',
      type: 'motion',
      data: { active: sourceActive, complete: Boolean(analysis) },
    },
  ]
  if (running && !analysis) {
    edges.push({
      id: 'analyze-process',
      source: 'analyzeProduct',
      target: 'analysisProcess',
      type: 'motion',
      data: { active: true, complete: false },
    })
  } else if (analysis) {
    edges.push({
      id: 'analyze-intelligence',
      source: 'analyzeProduct',
      target: 'productIntelligence',
      type: 'motion',
      data: { active: false, complete: true },
    })
    const campaignReady = campaignConfigured(project)
    const strategyRunning = project.activeJobType === 'STRATEGY_PLANNING'
    const strategyReady = Boolean(project.workflow.strategyPlan)
    const renderRunning = project.activeJobType === 'CREATIVE_RENDER'
    edges.push({
      id: 'intelligence-campaign',
      source: 'productIntelligence',
      target: 'campaignSetup',
      type: 'motion',
      data: { active: !campaignReady, complete: campaignReady },
    })
    if (campaignReady) {
      edges.push({
        id: 'campaign-strategy',
        source: 'campaignSetup',
        target: 'creativeStrategy',
        type: 'motion',
        data: { active: strategyRunning, complete: strategyReady },
      })
    }
    if (strategyReady) {
      edges.push({
        id: 'strategy-generate',
        source: 'creativeStrategy',
        target: 'generateCreatives',
        type: 'motion',
        data: { active: renderRunning, complete: renderFinished(project) },
      })
    }
  }
  return edges
}

const nodeTypes = {
  productUrl: ProductUrlNode,
  productImages: ProductImagesNode,
  analyzeProduct: AnalyzeProductNode,
  analysisProcess: AnalysisProcessNode,
  productIntelligence: ProductIntelligenceNode,
  campaignSetup: CampaignSetupNode,
  creativeStrategy: CreativeStrategyNode,
  generateCreatives: GenerateCreativesNode,
  creativeAsset: CreativeAssetNode,
  scheduleCampaign: ScheduleCampaignNode,
}

const edgeTypes = {
  motion: MotionEdge,
}

export function CreativeFlowWorkspace({
  initialProject,
  activeProject,
  onBack,
}: {
  initialProject: CreativeFlowProject
  activeProject: CreativeFlowProject | null
  onBack: (latest: CreativeFlowProject) => void
}) {
  return <ReactFlowProvider>
    <CreativeFlowWorkspaceInner activeProject={activeProject} initialProject={initialProject} onBack={onBack} />
  </ReactFlowProvider>
}

function CreativeFlowWorkspaceInner({
  initialProject,
  activeProject,
  onBack,
}: {
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
  const [strategyExpanded, setStrategyExpanded] = useState(false)
  const [strategyBusy, setStrategyBusy] = useState(false)
  const [generationBusy, setGenerationBusy] = useState(false)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [retryMissingBusy, setRetryMissingBusy] = useState(false)
  const [handoffBusy, setHandoffBusy] = useState(false)
  const [revealedPostIds, setRevealedPostIds] = useState<string[]>(initialProject.workflow.review.revealedPostIds || [])
  const revealedPostIdsRef = useRef<string[]>(initialProject.workflow.review.revealedPostIds || [])
  const revealScheduledRef = useRef<Set<string>>(new Set(initialProject.workflow.review.revealedPostIds || []))
  const revealTimersRef = useRef<number[]>([])
  const [campaignGoal, setCampaignGoal] = useState(initialProject.workflow.campaignSetup.goal)
  const [campaignPlatforms, setCampaignPlatforms] = useState<string[]>(initialProject.workflow.campaignSetup.platforms)
  const [creativeCount, setCreativeCount] = useState(initialProject.workflow.campaignSetup.creativeCount)
  const [creativeStyle, setCreativeStyle] = useState(initialProject.workflow.campaignSetup.style)
  const [campaignAudience, setCampaignAudience] = useState(initialProject.workflow.campaignSetup.audience)
  const [sourceBusy, setSourceBusy] = useState(false)
  const [error, setError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [localPreviews, setLocalPreviews] = useState<LocalPreview[]>([])
  const previewUrlsRef = useRef<Set<string>>(new Set())
  const [nodes, setNodes, onNodesChange] = useNodesState<Stage2Node>(defaultNodes(initialProject))
  const [edges, setEdges, onEdgesChange] = useEdgesState<Stage2Edge>(defaultEdges(initialProject))
  const lastFocusKeyRef = useRef('')

  const projectQuery = useQuery({
    queryKey: ['creative-flow-project', initialProject.id],
    queryFn: () => getCreativeFlowProject(initialProject.id),
    initialData: initialProject,
    staleTime: 1_000,
    refetchInterval: (query) => query.state.data?.activeJobType ? 1_800 : false,
  })
  const project = projectQuery.data
  useEffect(() => {
    const persisted = projectQuery.data?.workflow.review.revealedPostIds || []
    const current = revealedPostIdsRef.current
    const same = persisted.length === current.length && persisted.every((id, index) => id === current[index])
    if (same) return
    revealedPostIdsRef.current = persisted
    persisted.forEach((id) => revealScheduledRef.current.add(id))
    setRevealedPostIds(persisted)
  }, [projectQuery.data?.workflow.review.revealedPostIds])

  const analysis = project.workflow.analysis
  const running = project.activeJobType === 'PRODUCT_ANALYSIS'
  const strategyRunning = project.activeJobType === 'STRATEGY_PLANNING'
  const renderRunning = project.activeJobType === 'CREATIVE_RENDER'
  const anyJobRunning = Boolean(project.activeJobType)
  const blockedByAnother = Boolean(activeProject && activeProject.id !== project.id && activeProject.activeJobType)
  const selectedSequences = project.workflow.selectedConceptSequences
  const generationEstimateQuery = useQuery({
    queryKey: ['creative-flow-generation-estimate', project.id, selectedSequences.join(',')],
    queryFn: () => getCreativeFlowGenerationEstimate(project.id),
    enabled: Boolean(project.workflow.strategyPlan && selectedSequences.length && !project.renderCampaignId && !renderRunning),
    staleTime: 5_000,
    retry: false,
  })
  const renderCampaignQuery = useQuery({
    queryKey: ['creative-flow-render', project.renderCampaignId],
    queryFn: () => getCreativeFlowRender(project.renderCampaignId!),
    enabled: Boolean(project.renderCampaignId),
    staleTime: 700,
    retry: 1,
    refetchInterval: (query) => {
      const campaign = query.state.data
      return project.activeJobType === 'CREATIVE_RENDER' ||
        project.activeJobType === 'CREATIVE_REGENERATE' ||
        campaign?.status === 'GENERATING_IMAGES'
        ? 1_500
        : false
    },
  })
  const renderCampaign = renderCampaignQuery.data || null

  const updateCachedProject = useCallback((next: CreativeFlowProject) => {
    queryClient.setQueryData(['creative-flow-project', next.id], next)
    queryClient.setQueryData<CreativeFlowProjectList>(['creative-flow-projects'], (current) => {
      if (!current) return current
      const projects = current.projects.map((item) => item.id === next.id ? next : item)
      const currentActive = next.activeJobType
        ? next
        : current.activeProject?.id === next.id
          ? null
          : current.activeProject
      return { projects, activeProject: currentActive }
    })
  }, [queryClient])

  useEffect(() => {
    const reviewGraph = buildReviewGraph(project, renderCampaign, revealedPostIds)
    const nextNodes = [...defaultNodes(project), ...reviewGraph.nodes]
    setNodes((current) => nextNodes.map((node) => {
      const existing = current.find((item) => item.id === node.id)
      return existing ? { ...node, position: existing.position } : node
    }))
    setEdges([...defaultEdges(project), ...reviewGraph.edges])

    const focusKey = [
      project.currentStage,
      project.activeJobType || '',
      project.workflow.analysis ? 'analysis' : '',
      project.workflow.strategyPlan ? 'strategy' : '',
      project.renderCampaignId || '',
    ].join(':')
    const focusChanged = lastFocusKeyRef.current !== focusKey
    lastFocusKeyRef.current = focusKey
    if (focusChanged) {
      const ids = focusNodeIds(project)
      window.setTimeout(() => {
        void flow.fitView({
          nodes: ids.map((id) => ({ id })),
          padding: 0.24,
          duration: 760,
          maxZoom: 1.12,
        })
      }, 180)
    }
  }, [analysis, flow, project, renderCampaign, revealedPostIds, running, setEdges, setNodes])

  useEffect(() => {
    if (!renderCampaign) return
    const readyPosts = renderCampaign.posts.filter((post) => Boolean(post.mediaAsset?.url || post.mediaAssetId))
    const current = new Set(revealedPostIds)
    const additions = readyPosts.filter((post) => !current.has(post.id) && !revealScheduledRef.current.has(post.id))
    additions.forEach((post, index) => {
      revealScheduledRef.current.add(post.id)
      const timer = window.setTimeout(() => {
        const existing = revealedPostIdsRef.current
        if (!existing.includes(post.id)) {
          const nextRevealed = [...existing, post.id]
          revealedPostIdsRef.current = nextRevealed
          setRevealedPostIds(nextRevealed)
          void saveCreativeFlowReviewReveal(project.id, nextRevealed)
            .then(updateCachedProject)
            .catch(() => {})
        }
        const restoredReview = ['RENDER_READY', 'RENDER_PARTIAL', 'REVIEW_READY', 'HANDOFF_READY'].includes(project.currentStage)
        if (project.activeJobType === 'CREATIVE_RENDER' || (restoredReview && index === additions.length - 1)) {
          window.setTimeout(() => {
            const focusIds = [
              'generateCreatives',
              creativeNodeId(post.id),
              ...(project.workflow.review.selectedPostIds.length ? ['scheduleCampaign'] : []),
            ]
            void flow.fitView({
              nodes: focusIds.map((id) => ({ id })),
              padding: 0.28,
              duration: 520,
              maxZoom: 1.05,
            })
          }, 60)
        }
      }, 140 + (index * 190))
      revealTimersRef.current.push(timer)
    })
  }, [flow, project.activeJobType, project.currentStage, project.id, project.workflow.review.selectedPostIds.length, renderCampaign, revealedPostIds, updateCachedProject])

  useEffect(() => () => {
    revealTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    revealTimersRef.current = []
  }, [])

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
    if (sourceBusy || anyJobRunning) return
    const trimmed = urlDraft.trim()
    const normalized = normaliseUrlInput(trimmed)
    if (trimmed && !normalized) {
      setError('Enter a website such as example.com. Creative Flow adds the secure URL format for you.')
      return
    }
    setSourceBusy(true)
    setError('')
    try {
      await persistSource(
        normalized,
        project.workflow.source.referenceAssetIds,
        project.workflow.source.referenceNames,
      )
      setUrlDraft(normalized)
      setUrlExpanded(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The product website could not be saved.')
    } finally {
      setSourceBusy(false)
    }
  }, [anyJobRunning, persistSource, project.workflow.source.referenceAssetIds, project.workflow.source.referenceNames, sourceBusy, urlDraft])

  const uploadFiles = useCallback(async (incoming: File[]) => {
    if (sourceBusy || anyJobRunning) return
    const currentIds = project.workflow.source.referenceAssetIds
    const currentNames = project.workflow.source.referenceNames
    const remaining = Math.max(0, 8 - currentIds.length)
    const files = incoming.filter((file) => file.type.startsWith('image/')).slice(0, remaining)
    if (!files.length) return

    setSourceBusy(true)
    setError('')
    setUploadProgress(0)
    const nextIds = [...currentIds]
    const nextNames = [...currentNames]
    const newPreviews: LocalPreview[] = []
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} is larger than the 20 MB reference limit.`)
        const stored = await uploadPostStudioReference(file, (percent) => {
          setUploadProgress(Math.round(((index + percent / 100) / files.length) * 100))
        })
        nextIds.push(stored.id)
        nextNames.push(file.name)
        const previewUrl = URL.createObjectURL(file)
        previewUrlsRef.current.add(previewUrl)
        newPreviews.push({ id: stored.id, name: file.name, url: previewUrl })
      }
      setLocalPreviews((current) => [...current, ...newPreviews])
      await persistSource(
        normaliseUrlInput(urlDraft) || project.workflow.source.normalizedUrl,
        nextIds,
        nextNames,
      )
      setUploadProgress(100)
    } catch (caught) {
      newPreviews.forEach((item) => {
        URL.revokeObjectURL(item.url)
        previewUrlsRef.current.delete(item.url)
      })
      setError(caught instanceof Error ? caught.message : 'Product images could not be uploaded.')
    } finally {
      setSourceBusy(false)
    }
  }, [anyJobRunning, persistSource, project.workflow.source.normalizedUrl, project.workflow.source.referenceAssetIds, project.workflow.source.referenceNames, sourceBusy, urlDraft])

  const removeReference = useCallback(async (index: number) => {
    if (sourceBusy || anyJobRunning) return
    const ids = project.workflow.source.referenceAssetIds.filter((_, itemIndex) => itemIndex !== index)
    const names = project.workflow.source.referenceNames.filter((_, itemIndex) => itemIndex !== index)
    setSourceBusy(true)
    setError('')
    try {
      const removedId = project.workflow.source.referenceAssetIds[index]
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
      setError(caught instanceof Error ? caught.message : 'The product image could not be removed from this project.')
    } finally {
      setSourceBusy(false)
    }
  }, [anyJobRunning, persistSource, project.workflow.source.normalizedUrl, project.workflow.source.referenceAssetIds, project.workflow.source.referenceNames, sourceBusy, urlDraft])

  const runAnalysis = useCallback(async () => {
    if (sourceBusy || running || blockedByAnother) return
    setSourceBusy(true)
    setError('')
    try {
      const normalized = normaliseUrlInput(urlDraft)
      if (urlDraft.trim() && !normalized) throw new Error('Enter a website such as example.com. You do not need to type https://.')
      let latest = project
      const websiteChanged = (normalized || '') !== (project.workflow.source.normalizedUrl || '')
      if (websiteChanged) {
        latest = await persistSource(
          normalized,
          project.workflow.source.referenceAssetIds,
          project.workflow.source.referenceNames,
        )
      }
      if (!latest.workflow.source.normalizedUrl && !latest.workflow.source.referenceAssetIds.length) {
        throw new Error('Add a product website or at least one product image first.')
      }
      const started = await analyzeCreativeFlowProject(project.id, {
        website: latest.workflow.source.normalizedUrl,
        referenceAssetIds: latest.workflow.source.referenceAssetIds,
        referenceNames: latest.workflow.source.referenceNames,
      })
      updateCachedProject(started)
      setUrlExpanded(false)
      setImageExpanded(false)
      window.setTimeout(() => {
        void flow.fitView({ padding: 0.22, duration: 720, maxZoom: 1.05 })
      }, 120)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not start product analysis.')
    } finally {
      setSourceBusy(false)
    }
  }, [blockedByAnother, flow, persistSource, project, running, sourceBusy, updateCachedProject, urlDraft])

  const saveCampaign = useCallback(async () => {
    if (campaignBusy || anyJobRunning || !analysis) return
    if (!campaignPlatforms.length) {
      setError('Choose at least one platform for this campaign.')
      return
    }
    setCampaignBusy(true)
    setError('')
    try {
      const next = await saveCreativeFlowCampaignSetup(project.id, {
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
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not save this campaign setup.')
    } finally {
      setCampaignBusy(false)
    }
  }, [analysis, anyJobRunning, campaignAudience, campaignBusy, campaignGoal, campaignPlatforms, creativeCount, creativeStyle, project.id, updateCachedProject])

  const startStrategy = useCallback(async () => {
    if (strategyBusy || anyJobRunning || blockedByAnother) return
    setStrategyBusy(true)
    setError('')
    try {
      const next = await startCreativeFlowProjectStrategy(project.id)
      updateCachedProject(next)
      setStrategyExpanded(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not start strategy planning.')
    } finally {
      setStrategyBusy(false)
    }
  }, [anyJobRunning, blockedByAnother, project.id, strategyBusy, updateCachedProject])

  const toggleStrategyConcept = useCallback(async (sequence: number) => {
    if (strategyBusy || anyJobRunning || !project.workflow.strategyPlan) return
    const current = project.workflow.selectedConceptSequences
    const next = current.includes(sequence)
      ? current.filter((value) => value !== sequence)
      : [...current, sequence].sort((a, b) => a - b)
    if (!next.length) {
      setError('Keep at least one strategy concept before generation.')
      return
    }
    setStrategyBusy(true)
    setError('')
    try {
      const updated = await saveCreativeFlowStrategySelection(project.id, next)
      updateCachedProject(updated)
      await queryClient.invalidateQueries({ queryKey: ['creative-flow-generation-estimate', project.id] })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not update the concept selection.')
    } finally {
      setStrategyBusy(false)
    }
  }, [anyJobRunning, project.id, project.workflow.selectedConceptSequences, project.workflow.strategyPlan, queryClient, strategyBusy, updateCachedProject])

  const startGeneration = useCallback(async () => {
    if (generationBusy || anyJobRunning || blockedByAnother || !project.workflow.strategyPlan) return
    setGenerationBusy(true)
    setError('')
    try {
      const next = await startCreativeFlowProjectGeneration(project.id)
      updateCachedProject(next)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not start creative generation.')
    } finally {
      setGenerationBusy(false)
    }
  }, [anyJobRunning, blockedByAnother, generationBusy, project.id, project.workflow.strategyPlan, updateCachedProject])

  const toggleCreativeSelection = useCallback(async (postId: string) => {
    if (reviewBusy || Boolean(project.activeJobType) || !renderCampaign) return
    const current = project.workflow.review.selectedPostIds
    const next = current.includes(postId)
      ? current.filter((id) => id !== postId)
      : [...current, postId]
    setReviewBusy(true)
    setError('')
    try {
      const updated = await saveCreativeFlowReviewSelection(project.id, next)
      updateCachedProject(updated)
      if (next.length) {
        window.setTimeout(() => {
          const focusIds = [...next.slice(-3).map(creativeNodeId), 'scheduleCampaign']
          void flow.fitView({
            nodes: focusIds.map((id) => ({ id })),
            padding: 0.3,
            duration: 620,
            maxZoom: 1.05,
          })
        }, 180)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not update the review selection.')
    } finally {
      setReviewBusy(false)
    }
  }, [flow, project.activeJobType, project.id, project.workflow.review.selectedPostIds, renderCampaign, reviewBusy, updateCachedProject])

  const selectAllReadyCreatives = useCallback(async () => {
    if (reviewBusy || Boolean(project.activeJobType) || !renderCampaign) return
    const completedIds = renderCampaign.posts
      .filter((post) => post.contentType === 'IMAGE' && Boolean(post.mediaAssetId))
      .map((post) => post.id)
    if (!completedIds.length) return
    setReviewBusy(true)
    setError('')
    try {
      const updated = await saveCreativeFlowReviewSelection(project.id, completedIds)
      updateCachedProject(updated)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not select the completed creatives.')
    } finally {
      setReviewBusy(false)
    }
  }, [project.activeJobType, project.id, renderCampaign, reviewBusy, updateCachedProject])

  const clearCreativeSelection = useCallback(async () => {
    if (reviewBusy || Boolean(project.activeJobType) || !project.workflow.review.selectedPostIds.length) return
    setReviewBusy(true)
    setError('')
    try {
      const updated = await saveCreativeFlowReviewSelection(project.id, [])
      updateCachedProject(updated)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not clear the review selection.')
    } finally {
      setReviewBusy(false)
    }
  }, [project.activeJobType, project.id, project.workflow.review.selectedPostIds.length, reviewBusy, updateCachedProject])

  const retryMissingCreatives = useCallback(async () => {
    if (retryMissingBusy || Boolean(project.activeJobType) || blockedByAnother || !project.renderCampaignId) return
    setRetryMissingBusy(true)
    setError('')
    try {
      const updated = await retryCreativeFlowMissing(project.id)
      updateCachedProject(updated)
      await queryClient.invalidateQueries({ queryKey: ['creative-flow-render', project.renderCampaignId] })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not retry the missing creatives.')
    } finally {
      setRetryMissingBusy(false)
    }
  }, [blockedByAnother, project.activeJobType, project.id, project.renderCampaignId, queryClient, retryMissingBusy, updateCachedProject])

  const regenerateCreative = useCallback(async (postId: string, input: { caption?: string; imageBrief?: string } = {}) => {
    if (Boolean(project.activeJobType) || blockedByAnother || reviewBusy) return
    setReviewBusy(true)
    setError('')
    try {
      const updated = await regenerateCreativeFlowProjectPost(project.id, postId, input)
      updateCachedProject(updated)
      await queryClient.invalidateQueries({ queryKey: ['creative-flow-render', project.renderCampaignId] })
      window.setTimeout(() => {
        void flow.fitView({
          nodes: [{ id: 'generateCreatives' }, { id: creativeNodeId(postId) }],
          padding: 0.28,
          duration: 580,
          maxZoom: 1.08,
        })
      }, 120)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not regenerate this creative.')
    } finally {
      setReviewBusy(false)
    }
  }, [blockedByAnother, flow, project.activeJobType, project.id, project.renderCampaignId, queryClient, reviewBusy, updateCachedProject])

  const removeCreative = useCallback(async (postId: string) => {
    if (Boolean(project.activeJobType) || reviewBusy) return
    if (!window.confirm('Remove this creative from the Creative Flow campaign? The generated Media Library asset will not be deleted.')) return
    setReviewBusy(true)
    setError('')
    try {
      const response = await removeCreativeFlowProjectPost(project.id, postId)
      updateCachedProject(response.project)
      queryClient.setQueryData(['creative-flow-render', project.renderCampaignId], response.campaign)
      const nextRevealed = revealedPostIdsRef.current.filter((id) => id !== postId)
      revealedPostIdsRef.current = nextRevealed
      setRevealedPostIds(nextRevealed)
      revealScheduledRef.current.delete(postId)
      void saveCreativeFlowReviewReveal(project.id, nextRevealed).then(updateCachedProject).catch(() => {})
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not remove this creative.')
    } finally {
      setReviewBusy(false)
    }
  }, [project.activeJobType, project.id, project.renderCampaignId, queryClient, reviewBusy, updateCachedProject])

  const sendSelectedToScheduler = useCallback(async () => {
    if (handoffBusy || Boolean(project.activeJobType) || !project.workflow.review.selectedPostIds.length) return
    setHandoffBusy(true)
    setError('')
    try {
      const response = await handoffCreativeFlowProject(project.id)
      updateCachedProject(response.project)
      navigate('/bulk-scheduler', { state: { aiCampaignId: response.campaign.id } })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not send the selected creatives to Bulk Scheduler.')
      setHandoffBusy(false)
    }
  }, [handoffBusy, navigate, project.activeJobType, project.id, project.workflow.review.selectedPostIds.length, updateCachedProject])

  const saveCanvas = useCallback(async (nextNodes: Stage2Node[], viewport?: Viewport) => {
    const byId = new Map(nextNodes.map((node) => [node.id, node.position]))
    try {
      const next = await saveCreativeFlowProjectCanvas(project.id, {
        positions: {
          productUrl: byId.get('productUrl'),
          productImages: byId.get('productImages'),
          analyzeProduct: byId.get('analyzeProduct'),
          productIntelligence: byId.get('productIntelligence') || byId.get('analysisProcess'),
          campaignSetup: byId.get('campaignSetup'),
          creativeStrategy: byId.get('creativeStrategy'),
          generateCreatives: byId.get('generateCreatives'),
        },
        creativePositions: {},
        schedulePosition: null,
        viewport,
      })
      updateCachedProject(next)
    } catch {
      // Canvas persistence is non-blocking. The project job/data remain safe.
    }
  }, [project.id, updateCachedProject])

  const contextValue = useMemo<WorkspaceContextValue>(() => ({
    project,
    analysis,
    urlDraft,
    urlExpanded,
    imageExpanded,
    campaignExpanded,
    advancedExpanded,
    campaignBusy,
    strategyExpanded,
    strategyBusy,
    generationBusy,
    generationEstimate: generationEstimateQuery.data || null,
    generationEstimateLoading: generationEstimateQuery.isLoading,
    renderCampaign,
    reviewBusy,
    retryMissingBusy,
    handoffBusy,
    campaignGoal,
    campaignPlatforms,
    creativeCount,
    creativeStyle,
    campaignAudience,
    sourceBusy,
    running,
    error,
    uploadProgress,
    localPreviews,
    setUrlDraft,
    setUrlExpanded,
    setImageExpanded,
    setCampaignExpanded,
    setAdvancedExpanded,
    setStrategyExpanded,
    setCampaignGoal,
    toggleCampaignPlatform: (value) => setCampaignPlatforms((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]),
    setCreativeCount,
    setCreativeStyle,
    setCampaignAudience,
    saveCampaignSetup: () => void saveCampaign(),
    startStrategy: () => void startStrategy(),
    toggleStrategyConcept: (sequence) => void toggleStrategyConcept(sequence),
    startGeneration: () => void startGeneration(),
    toggleCreativeSelection: (postId) => void toggleCreativeSelection(postId),
    selectAllReadyCreatives: () => void selectAllReadyCreatives(),
    clearCreativeSelection: () => void clearCreativeSelection(),
    retryMissingCreatives: () => void retryMissingCreatives(),
    regenerateCreative: (postId, input) => void regenerateCreative(postId, input),
    removeCreative: (postId) => void removeCreative(postId),
    sendSelectedToScheduler: () => void sendSelectedToScheduler(),
    saveUrl: () => void saveUrl(),
    uploadFiles: (files) => void uploadFiles(files),
    removeReference: (index) => void removeReference(index),
    runAnalysis: () => void runAnalysis(),
  }), [advancedExpanded, analysis, campaignAudience, campaignBusy, campaignExpanded, campaignGoal, campaignPlatforms, clearCreativeSelection, creativeCount, creativeStyle, error, generationBusy, generationEstimateQuery.data, generationEstimateQuery.isLoading, handoffBusy, imageExpanded, localPreviews, project, regenerateCreative, removeCreative, removeReference, renderCampaign, retryMissingBusy, retryMissingCreatives, reviewBusy, runAnalysis, running, saveCampaign, saveUrl, selectAllReadyCreatives, sendSelectedToScheduler, sourceBusy, startGeneration, startStrategy, strategyBusy, strategyExpanded, toggleCreativeSelection, toggleStrategyConcept, uploadFiles, uploadProgress, urlDraft, urlExpanded])

  return <WorkspaceContext.Provider value={contextValue}>
    <div className="relative size-full min-h-[560px] overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(45,212,191,.055),transparent_25rem),radial-gradient(circle_at_85%_75%,rgba(139,92,246,.045),transparent_28rem),#f8fafc]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto max-w-[min(620px,72vw)] rounded-2xl border border-border-soft bg-white/92 px-3.5 py-2.5 shadow-[0_10px_32px_rgba(15,23,42,.07)] backdrop-blur-lg">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[8px] font-bold uppercase tracking-[.15em] text-brand-cyan">Creative Flow · Stage 6</span>
            <span className={`rounded-full border px-2 py-0.5 text-[8px] font-semibold ${running ? 'border-brand-cyan/20 bg-brand-cyan/[.05] text-brand-cyan' : analysis ? 'border-brand-green/20 bg-brand-green/[.05] text-brand-green' : 'border-border-soft bg-slate-50 text-text-soft'}`}>
              {running
                ? 'Analysing product'
                : strategyRunning
                  ? 'Planning strategy'
                  : project.activeJobType === 'CREATIVE_REGENERATE'
                    ? 'Regenerating creative'
                    : renderRunning
                      ? 'Generating creatives'
                      : project.handoffCampaignId
                        ? 'Sent to Bulk Scheduler'
                        : renderFinished(project) || project.currentStage === 'REVIEW_READY'
                          ? project.workflow.review.selectedPostIds.length
                            ? `${project.workflow.review.selectedPostIds.length} selected for scheduling`
                            : 'Review creatives'
                          : project.workflow.strategyPlan
                            ? 'Strategy ready'
                            : project.currentStage === 'CAMPAIGN_READY'
                              ? 'Campaign ready'
                              : analysis ? 'Configure campaign' : 'Source setup'}
            </span>
          </div>
          <p className="mt-1 truncate text-[10px] font-semibold">{project.name}</p>
          <p className="mt-0.5 hidden text-[8px] text-text-soft sm:block">Drag the canvas, zoom, move nodes, and interact directly inside each node. There is no settings sidebar.</p>
        </div>

        <div className="pointer-events-auto flex gap-2">
          <button aria-label="Fit Creative Flow to screen" className="grid size-9 place-items-center rounded-xl border border-border-soft bg-white/92 text-text-muted shadow-sm backdrop-blur transition hover:text-text-main" onClick={() => void flow.fitView({ padding: 0.22, duration: 650, maxZoom: 1.05 })} type="button"><Maximize2 className="size-3.5" /></button>
          <Button onClick={() => onBack(project)} size="sm">Projects</Button>
        </div>
      </div>

      {error && <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 w-[min(620px,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-red-200 bg-red-50/95 px-3 py-2.5 text-center text-[9px] text-red-700 shadow-lg backdrop-blur">{error}</div>}

      {blockedByAnother && <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 w-[min(660px,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-brand-amber/20 bg-white/95 px-3 py-2.5 text-center text-[9px] text-text-muted shadow-lg backdrop-blur">“{activeProject?.name}” currently owns the active Creative Flow AI job. This project stays saved, but another AI-processing job cannot start until that job finishes.</div>}

      <ReactFlow
        colorMode="light"
        defaultViewport={project.workflow.canvas.viewport}
        edgeTypes={edgeTypes}
        edges={edges}
        fitView={!project.workflow.canvas.viewport.zoom}
        maxZoom={1.8}
        minZoom={0.35}
        nodeTypes={nodeTypes}
        nodes={nodes}
        nodesConnectable={false}
        onEdgesChange={onEdgesChange}
        onMoveEnd={(_, viewport) => void saveCanvas(nodes, viewport)}
        onNodeDragStop={(_, __, draggedNodes) => {
          const merged = nodes.map((node) => draggedNodes.find((item) => item.id === node.id) || node)
          void saveCanvas(merged, flow.getViewport())
        }}
        onNodesChange={onNodesChange}
        panOnDrag
        proOptions={{ hideAttribution: true }}
        selectionOnDrag
      >
        <Background gap={28} size={1} color="rgba(100,116,139,.13)" />
        <Controls position="bottom-right" showInteractive={false} />
      </ReactFlow>
    </div>
  </WorkspaceContext.Provider>
}

function NodeShell({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`rounded-[20px] border border-border-soft bg-white shadow-[0_18px_52px_rgba(15,23,42,.10)] ${className}`}>{children}</div>
}

function AnimatedExpand({ children, id }: { children: ReactNode; id: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, { height: 0, opacity: 0, y: -6 }, { height: 'auto', opacity: 1, y: 0, duration: 0.34, ease: 'power2.out' })
    }, ref)
    return () => ctx.revert()
  }, [id])
  return <div className="overflow-hidden" ref={ref}>{children}</div>
}

function ProductUrlNode(props: NodeProps) {
  void props
  const {
    project,
    urlDraft,
    urlExpanded,
    sourceBusy,
    running,
    setUrlDraft,
    setUrlExpanded,
    saveUrl,
  } = useWorkspace()
  const saved = project.workflow.source.normalizedUrl
  return <>
    <Handle className="!size-3 !border-2 !border-white !bg-brand-cyan" position={Position.Right} type="source" />
    <NodeShell className={`w-[330px] transition-shadow ${urlExpanded ? 'shadow-[0_22px_65px_rgba(20,184,166,.14)]' : ''}`}>
      <button className="flex w-full items-center gap-3 p-4 text-left" disabled={running} onClick={() => setUrlExpanded(!urlExpanded)} type="button">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-brand-cyan/20 bg-brand-cyan/[.06] text-brand-cyan"><Globe2 className="size-4" /></span>
        <span className="min-w-0 flex-1"><span className="block text-[8px] font-bold uppercase tracking-[.14em] text-brand-cyan">Product URL</span><strong className="mt-1 block truncate text-[11px]">{saved ? displayDomain(saved) : 'Add product website'}</strong><span className="mt-0.5 block text-[8px] text-text-soft">{saved ? 'Saved to this project' : 'example.com is enough'}</span></span>
        {saved ? <span className="grid size-7 place-items-center rounded-full bg-brand-green/[.08] text-brand-green"><Check className="size-3.5" /></span> : <ChevronDown className={`size-4 text-text-soft transition-transform ${urlExpanded ? 'rotate-180' : ''}`} />}
      </button>
      {urlExpanded && <AnimatedExpand id="url">
        <div className="nodrag border-t border-border-soft p-4">
          <label className="block text-[8px] font-semibold text-text-muted">Website</label>
          <div className="mt-1.5 flex gap-2">
            <input autoFocus className="min-h-10 min-w-0 flex-1 rounded-xl border border-border-soft bg-slate-50 px-3 text-[10px] outline-none transition focus:border-brand-cyan focus:bg-white" disabled={sourceBusy || Boolean(project.activeJobType)} onChange={(event) => setUrlDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveUrl() }} placeholder="yourproduct.com" value={urlDraft} />
            <Button disabled={sourceBusy || Boolean(project.activeJobType)} onClick={saveUrl} size="sm" variant="primary">{sourceBusy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}Done</Button>
          </div>
          <p className="mt-2 text-[8px] leading-4 text-text-soft">No need to type https://. Creative Flow normalises the address before analysing it.</p>
        </div>
      </AnimatedExpand>}
    </NodeShell>
  </>
}

function ProductImagesNode(props: NodeProps) {
  void props
  const {
    project,
    imageExpanded,
    sourceBusy,
    running,
    uploadProgress,
    localPreviews,
    setImageExpanded,
    uploadFiles,
    removeReference,
  } = useWorkspace()
  const ids = project.workflow.source.referenceAssetIds
  const names = project.workflow.source.referenceNames
  const inputRef = useRef<HTMLInputElement>(null)

  const pickFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    uploadFiles(files)
  }
  const dropFiles = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    uploadFiles(Array.from(event.dataTransfer.files || []))
  }

  return <>
    <Handle className="!size-3 !border-2 !border-white !bg-brand-purple" position={Position.Right} type="source" />
    <NodeShell className={`w-[330px] transition-shadow ${imageExpanded ? 'shadow-[0_22px_65px_rgba(139,92,246,.12)]' : ''}`}>
      <button className="flex w-full items-center gap-3 p-4 text-left" disabled={running} onClick={() => setImageExpanded(!imageExpanded)} type="button">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-brand-purple/20 bg-brand-purple/[.06] text-brand-purple"><FileImage className="size-4" /></span>
        <span className="min-w-0 flex-1"><span className="block text-[8px] font-bold uppercase tracking-[.14em] text-brand-purple">Product Images</span><strong className="mt-1 block truncate text-[11px]">{ids.length ? `${ids.length} product reference${ids.length === 1 ? '' : 's'}` : 'Upload product / logo'}</strong><span className="mt-0.5 block text-[8px] text-text-soft">Up to 8 images · saved immediately</span></span>
        {ids.length ? <span className="grid size-7 place-items-center rounded-full bg-brand-green/[.08] text-brand-green"><Check className="size-3.5" /></span> : <ChevronDown className={`size-4 text-text-soft transition-transform ${imageExpanded ? 'rotate-180' : ''}`} />}
      </button>
      {imageExpanded && <AnimatedExpand id="images">
        <div className="nodrag border-t border-border-soft p-4">
          <div className="rounded-2xl border border-dashed border-brand-purple/25 bg-brand-purple/[.025] p-3 text-center" onDragOver={(event) => event.preventDefault()} onDrop={dropFiles}>
            <span className="mx-auto grid size-9 place-items-center rounded-xl bg-white text-brand-purple shadow-sm"><UploadCloud className="size-4" /></span>
            <strong className="mt-2 block text-[9px]">Drop product images here</strong>
            <span className="mt-1 block text-[8px] text-text-soft">or choose files from your device</span>
            <Button className="mt-2" disabled={sourceBusy || Boolean(project.activeJobType) || ids.length >= 8} onClick={() => inputRef.current?.click()} size="sm"><ImagePlus className="size-3" />Choose images</Button>
            <input accept="image/*" className="hidden" multiple onChange={pickFiles} ref={inputRef} type="file" />
            {sourceBusy && uploadProgress > 0 && <div className="mt-3"><div className="h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-brand-purple transition-all" style={{ width: `${uploadProgress}%` }} /></div><span className="mt-1 block text-[8px] text-text-soft">Uploading {uploadProgress}%</span></div>}
          </div>

          {ids.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2">{ids.map((id, index) => {
            const preview = localPreviews.find((item) => item.id === id)
            return <div className="group relative overflow-hidden rounded-xl border border-border-soft bg-slate-50" key={id}>
              {preview ? <img alt={preview.name} className="aspect-[4/3] w-full object-cover" src={preview.url} /> : <div className="grid aspect-[4/3] place-items-center bg-[linear-gradient(145deg,#f8fafc,#eef2ff)]"><FileImage className="size-5 text-brand-purple/45" /></div>}
              <div className="flex items-center gap-1.5 border-t border-border-soft bg-white px-2 py-1.5"><span className="min-w-0 flex-1 truncate text-[7px] text-text-muted">{names[index] || `Reference ${index + 1}`}</span><button aria-label="Remove product reference" className="grid size-6 place-items-center rounded-md text-text-soft hover:bg-red-50 hover:text-red-500" disabled={sourceBusy || Boolean(project.activeJobType)} onClick={() => removeReference(index)} type="button"><X className="size-3" /></button></div>
            </div>
          })}</div>}
        </div>
      </AnimatedExpand>}
    </NodeShell>
  </>
}

function AnalyzeProductNode(props: NodeProps) {
  void props
  const { project, running, sourceBusy, runAnalysis } = useWorkspace()
  const sourceReady = Boolean(project.workflow.source.normalizedUrl || project.workflow.source.referenceAssetIds.length)
  const success = Boolean(project.workflow.analysis)
  const failed = project.currentStage === 'PRODUCT_ANALYSIS_FAILED'

  return <>
    <Handle className="!size-3 !border-2 !border-white !bg-brand-cyan" position={Position.Left} type="target" />
    <Handle className="!size-3 !border-2 !border-white !bg-brand-cyan" position={Position.Right} type="source" />
    <NodeShell className={`w-[250px] overflow-hidden ${running ? 'border-brand-cyan/35 shadow-[0_22px_70px_rgba(20,184,166,.16)]' : success ? 'border-brand-green/25' : ''}`}>
      <div className="p-4 text-center">
        <CreativeFlowMotionSlot className="mx-auto size-14" state={running ? 'working' : success ? 'success' : failed ? 'error' : 'idle'} />
        <span className="mt-3 block text-[8px] font-bold uppercase tracking-[.14em] text-brand-cyan">Analyse Product</span>
        <strong className="mt-1 block text-[11px]">{running ? 'Creative Flow is reading your sources' : success ? 'Product understood' : failed ? 'Try product analysis again' : 'Connect the product inputs'}</strong>
        <p className="mt-1.5 text-[8px] leading-4 text-text-soft">{running ? project.progress.label || 'Analysing…' : success ? 'The Product Intelligence node is ready.' : failed ? project.lastError || 'Something interrupted product analysis. Retry when ready.' : 'URL, images, or both can feed the analysis.'}</p>
        {!success && <Button className="mt-3 w-full" disabled={!sourceReady || running || sourceBusy} onClick={runAnalysis} size="sm" variant="primary">{running ? <Loader2 className="size-3 animate-spin" /> : <ScanSearch className="size-3" />}{failed ? 'Retry analysis' : 'Analyse product'}</Button>}
      </div>
    </NodeShell>
  </>
}

function AnalysisProcessNode(props: NodeProps) {
  void props
  const { project } = useWorkspace()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, { scale: 0.72, opacity: 0, x: -24 }, { scale: 1, opacity: 1, x: 0, duration: 0.65, ease: 'back.out(1.7)' })
    }, ref)
    return () => ctx.revert()
  }, [])

  return <div ref={ref}>
    <Handle className="!size-3 !border-2 !border-white !bg-brand-cyan" position={Position.Left} type="target" />
    <NodeShell className="w-[300px] border-brand-cyan/30 p-4 shadow-[0_26px_80px_rgba(20,184,166,.16)]">
      <div className="flex items-center gap-4">
        <CreativeFlowMotionSlot className="size-20 shrink-0" state="working" />
        <div className="min-w-0"><span className="text-[8px] font-bold uppercase tracking-[.15em] text-brand-cyan">Product Intelligence</span><h4 className="mt-1 text-[12px] font-semibold">Understanding your product…</h4><p className="mt-1 text-[8px] leading-4 text-text-muted">{project.progress.label || 'Reading website, visuals and brand evidence.'}</p></div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-cyan transition-all duration-500" style={{ width: `${Math.max(12, Math.min(100, Math.round((project.progress.current / Math.max(1, project.progress.total)) * 100)))}%` }} /></div>
    </NodeShell>
  </div>
}

function ProductIntelligenceNode(props: NodeProps) {
  void props
  const { analysis, project } = useWorkspace()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      const timeline = gsap.timeline()
      timeline.fromTo(ref.current, { scale: 0.74, opacity: 0, x: -30 }, { scale: 1, opacity: 1, x: 0, duration: 0.72, ease: 'back.out(1.8)' })
      timeline.fromTo(ref.current?.querySelectorAll('[data-intelligence-chip]') || [], { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.34, stagger: 0.07 }, '-=.22')
    }, ref)
    return () => ctx.revert()
  }, [])

  if (!analysis) return null
  const source = analysis.sourceAnalysis
  const brand = analysis.brandPack
  return <div ref={ref}>
    <Handle className="!size-3 !border-2 !border-white !bg-brand-green" position={Position.Left} type="target" />
    <Handle className="!size-3 !border-2 !border-white !bg-brand-green" position={Position.Right} type="source" />
    <NodeShell className="w-[380px] overflow-hidden border-brand-green/25 shadow-[0_26px_80px_rgba(34,197,94,.11)]">
      <div className="border-b border-border-soft bg-[linear-gradient(135deg,rgba(240,253,250,.8),rgba(255,255,255,1))] p-4">
        <div className="flex items-center gap-3">
          <CreativeFlowMotionSlot className="size-16 shrink-0" state="success" />
          <div className="min-w-0"><span className="text-[8px] font-bold uppercase tracking-[.15em] text-brand-green">Product Intelligence</span><h4 className="mt-1 truncate text-[13px] font-semibold">{source.productName || brand.brandName || project.name}</h4><p className="mt-1 line-clamp-2 text-[8px] leading-4 text-text-muted">{source.summary || 'Product and brand sources analysed.'}</p></div>
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2">
          <div data-intelligence-chip className="rounded-xl border border-border-soft bg-slate-50 p-2.5"><span className="block text-[7px] uppercase tracking-[.1em] text-text-soft">Claims</span><strong className="mt-1 block text-[12px]">{source.verifiedClaims.length}</strong></div>
          <div data-intelligence-chip className="rounded-xl border border-border-soft bg-slate-50 p-2.5"><span className="block text-[7px] uppercase tracking-[.1em] text-text-soft">References</span><strong className="mt-1 block text-[12px]">{analysis.analysedReferences.length}</strong></div>
          <div data-intelligence-chip className="rounded-xl border border-border-soft bg-slate-50 p-2.5"><span className="block text-[7px] uppercase tracking-[.1em] text-text-soft">Confidence</span><strong className="mt-1 block text-[10px] capitalize">{brand.confidence}</strong></div>
        </div>

        {brand.colors.length > 0 && <div className="mt-3 flex items-center gap-2" data-intelligence-chip><span className="text-[7px] uppercase tracking-[.1em] text-text-soft">Palette</span><div className="flex gap-1">{brand.colors.slice(0, 6).map((color) => <span className="size-4 rounded-full border border-black/10 shadow-sm" key={color} style={{ backgroundColor: color }} />)}</div></div>}
        {analysis.analysedUrl?.url && <a className="nodrag mt-3 inline-flex max-w-full items-center gap-1.5 truncate text-[8px] font-medium text-brand-cyan hover:underline" href={analysis.analysedUrl.url} rel="noreferrer" target="_blank"><Globe2 className="size-3 shrink-0" /><span className="truncate">{displayDomain(analysis.analysedUrl.url)}</span><ExternalLink className="size-2.5 shrink-0" /></a>}
        <div className="mt-3 rounded-xl border border-brand-green/15 bg-brand-green/[.035] p-2.5" data-intelligence-chip><span className="flex items-center gap-1.5 text-[8px] font-semibold text-brand-green"><Sparkles className="size-3" />Product intelligence saved</span><p className="mt-1 text-[8px] leading-4 text-text-muted">This evidence remains attached to the project and now feeds the Campaign Setup node.</p></div>
      </div>
    </NodeShell>
  </div>
}

function CampaignSetupNode(props: NodeProps) {
  void props
  const {
    project,
    campaignExpanded,
    advancedExpanded,
    campaignBusy,
    campaignGoal,
    campaignPlatforms,
    creativeCount,
    creativeStyle,
    campaignAudience,
    setCampaignExpanded,
    setAdvancedExpanded,
    setCampaignGoal,
    toggleCampaignPlatform,
    setCreativeCount,
    setCreativeStyle,
    setCampaignAudience,
    saveCampaignSetup,
  } = useWorkspace()
  const ready = campaignConfigured(project)
  const locked = Boolean(project.activeJobType)
  const ref = useRef<HTMLDivElement>(null)
  const platforms = ['Instagram', 'Facebook', 'X', 'LinkedIn', 'TikTok', 'Threads', 'Bluesky', 'Pinterest']
  const goals = ['AI Recommended', 'Sales', 'Traffic', 'Awareness', 'Product launch']
  const styles = ['AI Recommended', 'Performance ads', 'Minimal', 'Lifestyle', 'Editorial / infographic']

  useEffect(() => {
    if (!ref.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, { opacity: 0, x: -34, scale: 0.86 }, { opacity: 1, x: 0, scale: 1, duration: 0.68, ease: 'back.out(1.65)' })
    }, ref)
    return () => ctx.revert()
  }, [])

  return <div ref={ref}>
    <Handle className="!size-3 !border-2 !border-white !bg-brand-green" position={Position.Left} type="target" />
    <Handle className="!size-3 !border-2 !border-white !bg-brand-purple" position={Position.Right} type="source" />
    <NodeShell className={`w-[360px] overflow-hidden transition-shadow ${campaignExpanded ? 'border-brand-purple/25 shadow-[0_26px_80px_rgba(139,92,246,.13)]' : ready ? 'border-brand-green/25' : 'border-brand-purple/20'}`}>
      <button className="flex w-full items-center gap-3 p-4 text-left" disabled={locked} onClick={() => setCampaignExpanded(!campaignExpanded)} type="button">
        <CreativeFlowMotionSlot className="size-12 shrink-0" state={ready ? 'success' : campaignExpanded ? 'selected' : 'idle'} />
        <span className="min-w-0 flex-1">
          <span className="block text-[8px] font-bold uppercase tracking-[.14em] text-brand-purple">Campaign Setup</span>
          <strong className="mt-1 block truncate text-[11px]">{ready ? `${creativeCount} creatives · ${campaignPlatforms.length} platform${campaignPlatforms.length === 1 ? '' : 's'}` : 'Shape the campaign'}</strong>
          <span className="mt-0.5 block truncate text-[8px] text-text-soft">{campaignGoal} · {creativeStyle}</span>
        </span>
        {ready && !campaignExpanded
          ? <span className="grid size-7 place-items-center rounded-full bg-brand-green/[.08] text-brand-green"><Check className="size-3.5" /></span>
          : <ChevronDown className={`size-4 text-text-soft transition-transform ${campaignExpanded ? 'rotate-180' : ''}`} />}
      </button>

      {campaignExpanded && <AnimatedExpand id="campaign-setup">
        <div className="nodrag border-t border-border-soft p-4">
          <div>
            <span className="text-[8px] font-semibold text-text-muted">Campaign goal</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {goals.map((goal) => <button className={`rounded-lg border px-2.5 py-1.5 text-[8px] font-medium transition ${campaignGoal === goal ? 'border-brand-purple/30 bg-brand-purple/[.07] text-brand-purple' : 'border-border-soft bg-white text-text-muted hover:bg-slate-50'}`} key={goal} onClick={() => setCampaignGoal(goal)} type="button">{goal}</button>)}
            </div>
          </div>

          <div className="mt-4">
            <span className="text-[8px] font-semibold text-text-muted">Platforms</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {platforms.map((platform) => {
                const selected = campaignPlatforms.includes(platform)
                return <button aria-pressed={selected} className={`rounded-lg border px-2.5 py-1.5 text-[8px] font-medium transition ${selected ? 'border-brand-cyan/30 bg-brand-cyan/[.07] text-brand-cyan' : 'border-border-soft bg-white text-text-muted hover:bg-slate-50'}`} key={platform} onClick={() => toggleCampaignPlatform(platform)} type="button">{selected && <Check className="mr-1 inline size-2.5" />}{platform}</button>
              })}
            </div>
          </div>

          <div className="mt-4">
            <span className="text-[8px] font-semibold text-text-muted">How many creatives?</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[5, 10, 20, 50].map((count) => <button className={`min-w-10 rounded-lg border px-2.5 py-1.5 text-[8px] font-semibold transition ${creativeCount === count ? 'border-brand-cyan/30 bg-brand-cyan/[.07] text-brand-cyan' : 'border-border-soft bg-white text-text-muted hover:bg-slate-50'}`} key={count} onClick={() => setCreativeCount(count)} type="button">{count}</button>)}
              <label className="flex min-h-8 items-center rounded-lg border border-border-soft bg-white px-2"><span className="mr-1.5 text-[7px] text-text-soft">Custom</span><input aria-label="Custom creative count" className="w-10 bg-transparent text-[8px] font-semibold outline-none" max={50} min={1} onChange={(event) => setCreativeCount(Math.max(1, Math.min(50, Number(event.target.value || 1))))} type="number" value={creativeCount} /></label>
            </div>
          </div>

          <button className="mt-4 flex w-full items-center justify-between rounded-xl border border-border-soft bg-slate-50 px-3 py-2 text-left" onClick={() => setAdvancedExpanded(!advancedExpanded)} type="button"><span><strong className="block text-[8px]">Advanced options</strong><span className="mt-0.5 block text-[7px] text-text-soft">Optional style and audience direction</span></span><ChevronDown className={`size-3.5 text-text-soft transition-transform ${advancedExpanded ? 'rotate-180' : ''}`} /></button>

          {advancedExpanded && <AnimatedExpand id="campaign-advanced">
            <div className="mt-3 space-y-3 rounded-xl border border-border-soft bg-slate-50/70 p-3">
              <label className="block"><span className="text-[8px] font-semibold text-text-muted">Creative style</span><select className="mt-1.5 min-h-9 w-full rounded-lg border border-border-soft bg-white px-2.5 text-[8px] outline-none focus:border-brand-purple/40" onChange={(event) => setCreativeStyle(event.target.value)} value={creativeStyle}>{styles.map((style) => <option key={style} value={style}>{style}</option>)}</select></label>
              <label className="block"><span className="text-[8px] font-semibold text-text-muted">Audience direction</span><textarea className="mt-1.5 min-h-20 w-full resize-none rounded-lg border border-border-soft bg-white p-2.5 text-[8px] leading-4 outline-none focus:border-brand-purple/40" maxLength={500} onChange={(event) => setCampaignAudience(event.target.value)} placeholder="Optional — leave blank and Creative Flow will infer from Product Intelligence." value={campaignAudience} /></label>
            </div>
          </AnimatedExpand>}

          <Button className="mt-4 w-full" disabled={campaignBusy || locked || !campaignPlatforms.length} onClick={saveCampaignSetup} size="sm" variant="primary">{campaignBusy ? <Loader2 className="size-3 animate-spin" /> : ready ? <Check className="size-3" /> : <Target className="size-3" />}{ready ? 'Update campaign setup' : 'Save campaign setup'}</Button>
          {ready && <div className="mt-3 rounded-xl border border-brand-green/15 bg-brand-green/[.035] p-2.5"><span className="flex items-center gap-1.5 text-[8px] font-semibold text-brand-green"><Layers3 className="size-3" />Campaign setup saved</span><p className="mt-1 text-[8px] leading-4 text-text-muted">The strategy node is connected and can now plan the campaign.</p></div>}
        </div>
      </AnimatedExpand>}
    </NodeShell>
  </div>
}

function CreativeStrategyNode(props: NodeProps) {
  void props
  const {
    project,
    strategyExpanded,
    strategyBusy,
    setStrategyExpanded,
    startStrategy,
    toggleStrategyConcept,
  } = useWorkspace()
  const plan = project.workflow.strategyPlan
  const running = project.activeJobType === 'STRATEGY_PLANNING'
  const failed = project.currentStage === 'STRATEGY_FAILED'
  const selected = new Set(project.workflow.selectedConceptSequences)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, { opacity: 0, x: -38, scale: 0.84 }, { opacity: 1, x: 0, scale: 1, duration: 0.7, ease: 'back.out(1.7)' })
    }, ref)
    return () => ctx.revert()
  }, [])

  return <div ref={ref}>
    <Handle className="!size-3 !border-2 !border-white !bg-brand-purple" position={Position.Left} type="target" />
    <Handle className="!size-3 !border-2 !border-white !bg-brand-cyan" position={Position.Right} type="source" />
    <NodeShell className={`w-[420px] overflow-hidden ${running ? 'border-brand-purple/35 shadow-[0_26px_84px_rgba(139,92,246,.16)]' : plan ? 'border-brand-green/25' : 'border-brand-purple/20'}`}>
      <div className="flex items-center gap-3 p-4">
        <CreativeFlowMotionSlot className="size-14 shrink-0" state={running ? 'working' : plan ? 'success' : failed ? 'error' : 'idle'} />
        <div className="min-w-0 flex-1">
          <span className="block text-[8px] font-bold uppercase tracking-[.14em] text-brand-purple">Creative Strategy</span>
          <strong className="mt-1 block truncate text-[12px]">
            {running
              ? project.progress.label || 'Planning campaign strategy…'
              : plan
                ? `${plan.concepts.length} distinct concepts ready`
                : failed
                  ? 'Strategy needs another try'
                  : 'Plan the creative campaign'}
          </strong>
          <span className="mt-0.5 block truncate text-[8px] text-text-soft">
            {plan ? `${selected.size} kept · ${plan.strategy.contentPillars.length} content pillars` : 'Uses Product Intelligence + Campaign Setup'}
          </span>
        </div>
        {plan && !running && <button aria-label="Expand creative strategy" className="grid size-8 place-items-center rounded-lg border border-border-soft text-text-soft hover:text-text-main" onClick={() => setStrategyExpanded(!strategyExpanded)} type="button"><ChevronDown className={`size-3.5 transition-transform ${strategyExpanded ? 'rotate-180' : ''}`} /></button>}
      </div>

      {running && <div className="border-t border-border-soft p-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-purple transition-all duration-500" style={{ width: `${Math.max(12, Math.min(100, Math.round((project.progress.current / Math.max(1, project.progress.total)) * 100)))}%` }} /></div>
        <p className="mt-2 text-[8px] leading-4 text-text-muted">The strategy job keeps running even if you leave this project.</p>
      </div>}

      {!plan && !running && <div className="nodrag border-t border-border-soft p-4">
        <p className="text-[8px] leading-4 text-text-muted">Creative Flow will build the campaign foundation and then produce the exact number of materially different concepts requested in Campaign Setup.</p>
{failed && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-[8px] leading-4 text-red-700">{project.lastError || 'Creative strategy stopped unexpectedly. The project is safe; retry this step when ready.'}</div>}
                <Button className="mt-3 w-full" disabled={strategyBusy || Boolean(project.activeJobType) || Boolean(project.renderCampaignId)} onClick={startStrategy} size="sm" variant="primary">{strategyBusy ? <Loader2 className="size-3 animate-spin" /> : failed ? <RefreshCw className="size-3" /> : <BrainCircuit className="size-3" />}{failed ? 'Retry strategy' : 'Build creative strategy'}</Button>
      </div>}

      {plan && strategyExpanded && <AnimatedExpand id="creative-strategy">
        <div className="nodrag border-t border-border-soft p-4">
          <p className="text-[9px] leading-4 text-text-muted">{plan.strategy.strategySummary}</p>
          {plan.strategy.contentPillars.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{plan.strategy.contentPillars.map((pillar) => <span className="rounded-full border border-brand-purple/15 bg-brand-purple/[.035] px-2 py-1 text-[7px] text-text-muted" key={pillar}>{pillar}</span>)}</div>}

          <div className="mt-4 flex items-center justify-between"><span className="text-[8px] font-semibold text-text-muted">Concept matrix</span><span className="text-[8px] text-brand-green">{selected.size} kept</span></div>
          <div className="mt-2 max-h-[300px] space-y-2 overflow-y-auto pr-1">
            {plan.concepts.map((concept) => {
              const kept = selected.has(concept.sequence)
              return <button aria-pressed={kept} className={`block w-full rounded-xl border p-3 text-left transition ${kept ? 'border-brand-cyan/25 bg-brand-cyan/[.035]' : 'border-border-soft bg-slate-50 opacity-55'}`} disabled={strategyBusy || Boolean(project.activeJobType) || Boolean(project.renderCampaignId)} key={concept.sequence} onClick={() => toggleStrategyConcept(concept.sequence)} type="button">
                <span className="flex items-start justify-between gap-2"><span className="min-w-0"><span className="block text-[7px] font-bold uppercase tracking-[.11em] text-brand-purple">{concept.angle}</span><strong className="mt-1 block text-[9px] leading-4">{concept.hook}</strong></span><span className={`grid size-6 shrink-0 place-items-center rounded-full border ${kept ? 'border-brand-green/25 bg-brand-green/[.08] text-brand-green' : 'border-border-soft bg-white text-text-soft'}`}>{kept ? <Check className="size-3" /> : <X className="size-3" />}</span></span>
                <span className="mt-1.5 line-clamp-2 block text-[7px] leading-4 text-text-soft">{concept.visualStyle}</span>
              </button>
            })}
          </div>

          <Button className="mt-3 w-full" disabled={strategyBusy || Boolean(project.activeJobType) || Boolean(project.renderCampaignId)} onClick={startStrategy} size="sm"><RefreshCw className="size-3" />Regenerate strategy</Button>
        </div>
      </AnimatedExpand>}
    </NodeShell>
  </div>
}

function GenerateCreativesNode(props: NodeProps) {
  void props
  const {
    project,
    generationBusy,
    generationEstimate,
    generationEstimateLoading,
    renderCampaign,
    reviewBusy,
    retryMissingBusy,
    startGeneration,
    selectAllReadyCreatives,
    clearCreativeSelection,
    retryMissingCreatives,
  } = useWorkspace()
  const running = project.activeJobType === 'CREATIVE_RENDER'
  const finished = renderFinished(project)
  const partial = project.currentStage === 'RENDER_PARTIAL'
  const failed = project.currentStage === 'CREATIVE_RENDER_FAILED'
  const selectedCount = project.workflow.selectedConceptSequences.length
  const completedPosts = renderCampaign?.posts.filter((post) => post.contentType === 'IMAGE' && Boolean(post.mediaAssetId)) || []
  const missingPosts = renderCampaign?.posts.filter((post) => post.contentType === 'IMAGE' && !post.mediaAssetId) || []
  const selectedReviewCount = project.workflow.review.selectedPostIds.length
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, { opacity: 0, x: -40, scale: 0.82 }, { opacity: 1, x: 0, scale: 1, duration: 0.72, ease: 'back.out(1.75)' })
    }, ref)
    return () => ctx.revert()
  }, [])

  const requiredCredits = generationEstimate?.requiredCredits || project.workflow.generation.plannedCredits
  const creditsPerCreative = generationEstimate?.creditsPerCreative || project.workflow.generation.creditsPerCreative
  const canStart = Boolean(generationEstimate?.canGenerate && !project.renderCampaignId && !running)

  return <div ref={ref}>
    <Handle className="!size-3 !border-2 !border-white !bg-brand-cyan" position={Position.Left} type="target" />
    <Handle className="!size-3 !border-2 !border-white !bg-brand-green" position={Position.Right} type="source" />
    <NodeShell className={`w-[330px] overflow-hidden ${running ? 'border-brand-cyan/35 shadow-[0_28px_88px_rgba(20,184,166,.16)]' : finished ? 'border-brand-green/25' : failed ? 'border-red-200' : 'border-brand-cyan/20'}`}>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <CreativeFlowMotionSlot className="size-14 shrink-0" state={running ? 'working' : finished ? 'success' : failed ? 'error' : 'idle'} />
          <div className="min-w-0 flex-1">
            <span className="block text-[8px] font-bold uppercase tracking-[.14em] text-brand-cyan">Generate Creatives</span>
            <strong className="mt-1 block text-[11px]">{running ? project.progress.label || 'Generating…' : finished ? `${project.progress.current} creatives ready` : failed ? 'Generation needs attention' : `${selectedCount} concepts selected`}</strong>
            <span className="mt-0.5 block text-[8px] text-text-soft">{creditsPerCreative ? `${creditsPerCreative} credits per completed creative` : 'Credit estimate loading'}</span>
          </div>
        </div>

        {running && <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-cyan transition-all duration-500" style={{ width: `${Math.max(8, Math.min(100, Math.round((project.progress.current / Math.max(1, project.progress.total)) * 100)))}%` }} /></div>
          <div className="mt-1.5 flex justify-between text-[7px] text-text-soft"><span>{project.progress.current} ready</span><span>{project.progress.total} total</span></div>
          <p className="mt-2 text-[8px] leading-4 text-text-muted">This is a persistent background render. You can close Creative Flow and come back later.</p>
        </div>}

        {!running && !project.renderCampaignId && <div className="mt-4 rounded-xl border border-border-soft bg-slate-50 p-3">
          {generationEstimateLoading
            ? <span className="flex items-center gap-2 text-[8px] text-text-muted"><Loader2 className="size-3 animate-spin" />Checking generation credits…</span>
            : generationEstimate
              ? <><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-[8px] font-semibold text-text-muted"><Coins className="size-3 text-brand-cyan" />Planned generation</span><strong className="text-[9px]">{generationEstimate.requiredCredits} credits</strong></div><p className="mt-1.5 text-[7px] leading-4 text-text-soft">{generationEstimate.creditsRemaining} credits available. Failed image renders use the existing refund path.</p></>
              : <span className="text-[8px] text-text-muted">Select at least one strategy concept to calculate generation cost.</span>}
        </div>}

        {!running && !project.renderCampaignId && <Button className="mt-3 w-full" disabled={generationBusy || generationEstimateLoading || !canStart || Boolean(project.activeJobType)} onClick={startGeneration} size="sm" variant="primary">{generationBusy ? <Loader2 className="size-3 animate-spin" /> : <Rocket className="size-3" />}Generate {selectedCount}{requiredCredits ? ` · ${requiredCredits} credits` : ''}</Button>}

        {generationEstimate && !generationEstimate.canGenerate && !project.renderCampaignId && <p className="mt-2 text-center text-[8px] text-red-600">Not enough AI credits for this selected strategy.</p>}

        {finished && <div className="mt-4 rounded-xl border border-brand-green/20 bg-brand-green/[.04] p-3">
          <span className="flex items-center gap-1.5 text-[8px] font-semibold text-brand-green"><Images className="size-3" />{partial ? 'Generation partially complete' : 'Creative generation complete'}</span>
          <p className="mt-1 text-[8px] leading-4 text-text-muted">{partial ? 'Completed creatives are available below. Missing renders can be retried safely without restarting the completed work.' : 'Each finished creative appears as its own persistent review node.'}</p>
          {completedPosts.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2">
            <Button disabled={reviewBusy || Boolean(project.activeJobType) || selectedReviewCount === completedPosts.length} onClick={selectAllReadyCreatives} size="sm"><CheckCircle2 className="size-3" />Select all ready</Button>
            <Button disabled={reviewBusy || Boolean(project.activeJobType) || !selectedReviewCount} onClick={clearCreativeSelection} size="sm">Clear selection</Button>
          </div>}
          {missingPosts.length > 0 && <Button className="mt-2 w-full" disabled={retryMissingBusy || Boolean(project.activeJobType)} onClick={retryMissingCreatives} size="sm" variant="primary">{retryMissingBusy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}Retry {missingPosts.length} missing creative{missingPosts.length === 1 ? '' : 's'}</Button>}
        </div>

        {failed && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-[8px] leading-4 text-red-700">{project.lastError || 'Creative generation stopped unexpectedly. No other project state was lost.'}</div>}
        {failed && !project.renderCampaignId && <Button className="mt-3 w-full" disabled={generationBusy || !generationEstimate?.canGenerate} onClick={startGeneration} size="sm"><RefreshCw className="size-3" />Retry generation start</Button>}
      </div>
    </NodeShell>
  </div>
}

function CreativeAssetNode(props: NodeProps) {
  const postId = String(props.id).replace(/^creative:/, '')
  const {
    project,
    renderCampaign,
    reviewBusy,
    toggleCreativeSelection,
    regenerateCreative,
    removeCreative,
  } = useWorkspace()
  const post = renderCampaign?.posts.find((item) => item.id === postId)
  const selected = project.workflow.review.selectedPostIds.includes(postId)
  const regenerating = project.activeJobType === 'CREATIVE_REGENERATE' && project.activeJobId === postId
  const finishedCampaign = renderCampaign?.status !== 'GENERATING_IMAGES'
  const regenerationFailed = project.workflow.review.failedPostId === postId
  const failed = Boolean(post && ((!post.mediaAssetId && finishedCampaign) || regenerationFailed) && !regenerating)
  const imageUrl = post?.mediaAsset?.url || post?.mediaAsset?.thumbnailUrl || ''
  const locked = reviewBusy || Boolean(project.activeJobType)
  const [directionOpen, setDirectionOpen] = useState(false)
  const [directionDraft, setDirectionDraft] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, { opacity: 0, scale: 0.72, x: -28 }, {
        opacity: 1,
        scale: 1,
        x: 0,
        duration: 0.62,
        ease: 'back.out(1.8)',
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  if (!post) return null

  const motionState = regenerating ? 'working' : failed ? 'error' : selected ? 'selected' : 'success'
  const regenerateWithDirection = () => {
    const direction = directionDraft.trim()
    if (!direction || locked) return
    const existing = String(post.imageBrief || '').trim()
    regenerateCreative(postId, {
      imageBrief: [existing, `User direction: ${direction}`].filter(Boolean).join('\n\n'),
    })
    setDirectionOpen(false)
    setDirectionDraft('')
  }

  return <div ref={ref}>
    <Handle className="!size-3 !border-2 !border-white !bg-brand-green" position={Position.Left} type="target" />
    <Handle className={`!size-3 !border-2 !border-white ${selected ? '!bg-brand-purple' : '!bg-brand-green'}`} position={Position.Right} type="source" />
    <NodeShell className={`w-[300px] overflow-hidden ${selected ? 'border-brand-purple/40 shadow-[0_24px_70px_rgba(139,92,246,.16)]' : failed ? 'border-red-200' : 'border-brand-green/20'}`}>
      <div className="relative">
        {imageUrl
          ? <button
              aria-label={selected ? `Deselect creative ${post.sequence}` : `Select creative ${post.sequence}`}
              aria-pressed={selected}
              className="nodrag block w-full bg-slate-100 text-left disabled:cursor-not-allowed"
              disabled={locked}
              onClick={() => toggleCreativeSelection(postId)}
              type="button"
            >
              <img alt={`Creative ${post.sequence}`} className="aspect-[4/5] max-h-[300px] w-full object-cover" src={imageUrl} />
            </button>
          : <div className="nodrag grid aspect-[4/3] w-full place-items-center bg-[radial-gradient(circle_at_50%_35%,rgba(239,68,68,.06),transparent_12rem),#f8fafc]">
              <div className="text-center"><CreativeFlowMotionSlot className="mx-auto size-16" state={regenerating ? 'working' : failed ? 'error' : 'idle'} /><span className="mt-2 block text-[8px] font-semibold text-text-muted">{regenerating ? 'Creating a new version…' : 'This creative needs a retry'}</span></div>
            </div>}

        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
          <span className="rounded-full border border-white/70 bg-white/90 px-2 py-1 text-[7px] font-bold text-text-main shadow-sm backdrop-blur">Creative {String(post.sequence).padStart(2, '0')}</span>
          {selected && <span className="grid size-6 place-items-center rounded-full border border-white/70 bg-brand-purple text-white shadow-sm"><Check className="size-3" /></span>}
        </div>

        <div className="absolute right-2.5 top-2.5">
          <CreativeFlowMotionSlot className="size-10" state={motionState} />
        </div>
      </div>

      <div className="p-3.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <span className="block text-[7px] font-bold uppercase tracking-[.12em] text-brand-cyan">{post.pillar || 'Campaign creative'}</span>
            <strong className="mt-1 line-clamp-2 block text-[9px] leading-4">{post.hook || post.caption}</strong>
          </div>
          {post.mediaAssetId && <button aria-label={selected ? 'Unselect creative' : 'Select creative'} aria-pressed={selected} className={`nodrag grid size-8 shrink-0 place-items-center rounded-xl border transition ${selected ? 'border-brand-purple/30 bg-brand-purple/[.08] text-brand-purple' : 'border-border-soft bg-white text-text-soft hover:border-brand-cyan/30 hover:text-brand-cyan'}`} disabled={locked} onClick={() => toggleCreativeSelection(postId)} type="button"><CheckCircle2 className="size-3.5" /></button>}
        </div>

        {regenerating && <div className="mt-3 rounded-xl border border-brand-cyan/20 bg-brand-cyan/[.04] p-2.5"><span className="flex items-center gap-2 text-[8px] font-semibold text-brand-cyan"><Loader2 className="size-3 animate-spin motion-reduce:animate-none" />Thinking, drawing and replacing this creative…</span><p className="mt-1 text-[7px] leading-4 text-text-soft">The previous version stays safe until the new render succeeds.</p></div>}
        {regenerationFailed && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-[8px] leading-4 text-red-700">{project.workflow.review.failedPostError || project.lastError || 'This creative could not be regenerated. Retry when ready.'}</div>}

        <div className="nodrag mt-3 grid grid-cols-3 gap-1.5">
          <Button disabled={locked || !post.mediaAssetId} onClick={() => regenerateCreative(postId)} size="sm"><RefreshCw className="size-3" />Regenerate</Button>
          <Button disabled={locked || !post.mediaAssetId} onClick={() => setDirectionOpen((value) => !value)} size="sm"><Pencil className="size-3" />Direction</Button>
          <button className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-red-100 px-2 text-[8px] font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-40" disabled={locked || renderCampaign?.status === 'GENERATING_IMAGES'} onClick={() => removeCreative(postId)} type="button"><Trash2 className="size-3" />Remove</button>
        </div>

        {!post.mediaAssetId && <Button className="nodrag mt-2 w-full" disabled={locked} onClick={() => regenerateCreative(postId)} size="sm" variant="primary"><RefreshCw className="size-3" />Retry creative</Button>}

        {directionOpen && post.mediaAssetId && <AnimatedExpand id={`direction-${postId}`}>
          <div className="nodrag mt-3 rounded-xl border border-brand-cyan/15 bg-slate-50 p-2.5">
            <span className="text-[8px] font-semibold text-text-muted">Optional direction for the next version</span>
            <textarea
              autoFocus
              className="mt-1.5 min-h-14 w-full resize-none rounded-lg border border-border-soft bg-white p-2 text-[8px] leading-4 outline-none focus:border-brand-cyan"
              disabled={locked}
              maxLength={500}
              onChange={(event) => setDirectionDraft(event.target.value)}
              placeholder="Example: cleaner layout, larger product screen, less text"
              value={directionDraft}
            />
            <div className="mt-2 flex justify-end gap-1.5">
              <Button disabled={locked} onClick={() => { setDirectionOpen(false); setDirectionDraft('') }} size="sm">Cancel</Button>
              <Button disabled={locked || !directionDraft.trim()} onClick={regenerateWithDirection} size="sm" variant="primary"><Sparkles className="size-3" />Regenerate</Button>
            </div>
          </div>
        </AnimatedExpand>}
      </div>
    </NodeShell>
  </div>
}

function ScheduleCampaignNode(props: NodeProps) {
  void props
  const {
    project,
    handoffBusy,
    sendSelectedToScheduler,
  } = useWorkspace()
  const selectedCount = project.workflow.review.selectedPostIds.length
  const sent = Boolean(project.handoffCampaignId)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, { opacity: 0, scale: 0.72, x: -34 }, {
        opacity: 1,
        scale: 1,
        x: 0,
        duration: 0.68,
        ease: 'back.out(1.9)',
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  return <div ref={ref}>
    <Handle className="!size-3 !border-2 !border-white !bg-brand-purple" position={Position.Left} type="target" />
    <NodeShell className={`w-[300px] overflow-hidden ${sent ? 'border-brand-green/30' : 'border-brand-purple/30 shadow-[0_24px_76px_rgba(139,92,246,.13)]'}`}>
      <div className="p-4 text-center">
        <CreativeFlowMotionSlot className="mx-auto size-16" state={handoffBusy ? 'working' : sent ? 'success' : 'selected'} />
        <span className="mt-2 block text-[8px] font-bold uppercase tracking-[.14em] text-brand-purple">Schedule Campaign</span>
        <strong className="mt-1 block text-[12px]">{sent ? 'Campaign handed off' : `${selectedCount} creative${selectedCount === 1 ? '' : 's'} selected`}</strong>
        <p className="mt-1.5 text-[8px] leading-4 text-text-muted">{sent ? 'The approved selection is ready in Bulk Scheduler.' : 'Only the creatives joined to this node will move forward. Destinations and publishing times stay under Bulk Scheduler control.'}</p>
        <Button className="mt-3 w-full" disabled={handoffBusy || Boolean(project.activeJobType) || !selectedCount} onClick={sendSelectedToScheduler} size="sm" variant="primary">{handoffBusy ? <Loader2 className="size-3 animate-spin" /> : <CalendarRange className="size-3" />}{sent ? 'Open Bulk Scheduler' : 'Continue to Bulk Scheduler'}</Button>
      </div>
    </NodeShell>
  </div>
}

function MotionEdge(props: EdgeProps<Stage2Edge>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props
  const pathRef = useRef<SVGPathElement>(null)
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.34,
  })
  const active = Boolean(data?.active)
  const complete = Boolean(data?.complete)

  useEffect(() => {
    if (!pathRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const path = pathRef.current
    const length = path.getTotalLength()
    const ctx = gsap.context(() => {
      gsap.fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 0.62, ease: 'power2.out' })
      if (active) {
        gsap.to(path, { opacity: 0.62, duration: 0.8, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      }
    }, path)
    return () => ctx.revert()
  }, [active, edgePath])

  const stroke = complete ? 'rgba(34,197,94,.72)' : active ? 'rgba(20,184,166,.82)' : 'rgba(148,163,184,.58)'
  return <>
    <path d={edgePath} fill="none" ref={pathRef} stroke={stroke} strokeLinecap="round" strokeWidth={active ? 2.2 : 1.6} />
    {active && <circle fill="rgba(20,184,166,.95)" r="3.2">
      <animateMotion dur="1.35s" path={edgePath} repeatCount="indefinite" />
    </circle>}
  </>
}
