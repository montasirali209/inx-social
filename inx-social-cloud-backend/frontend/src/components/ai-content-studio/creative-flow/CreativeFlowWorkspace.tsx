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
import {
  Check,
  ChevronDown,
  ExternalLink,
  FileImage,
  Globe2,
  ImagePlus,
  Loader2,
  Maximize2,
  Play,
  RefreshCw,
  ScanSearch,
  Sparkles,
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
  getCreativeFlowProject,
  saveCreativeFlowProjectCanvas,
  saveCreativeFlowProjectSource,
  type CreativeFlowAnalysis,
  type CreativeFlowProject,
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
  sourceBusy: boolean
  running: boolean
  error: string
  uploadProgress: number
  localPreviews: LocalPreview[]
  setUrlDraft: (value: string) => void
  setUrlExpanded: (value: boolean) => void
  setImageExpanded: (value: boolean) => void
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
  }
  return edges
}

const nodeTypes = {
  productUrl: ProductUrlNode,
  productImages: ProductImagesNode,
  analyzeProduct: AnalyzeProductNode,
  analysisProcess: AnalysisProcessNode,
  productIntelligence: ProductIntelligenceNode,
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
  const flow = useReactFlow()
  const [urlDraft, setUrlDraft] = useState(initialProject.workflow.source.websiteInput || initialProject.productUrl || '')
  const [urlExpanded, setUrlExpanded] = useState(false)
  const [imageExpanded, setImageExpanded] = useState(false)
  const [sourceBusy, setSourceBusy] = useState(false)
  const [error, setError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [localPreviews, setLocalPreviews] = useState<LocalPreview[]>([])
  const previewUrlsRef = useRef<Set<string>>(new Set())
  const [nodes, setNodes, onNodesChange] = useNodesState<Stage2Node>(defaultNodes(initialProject))
  const [edges, setEdges, onEdgesChange] = useEdgesState<Stage2Edge>(defaultEdges(initialProject))
  const lastStageRef = useRef(initialProject.currentStage)

  const projectQuery = useQuery({
    queryKey: ['creative-flow-project', initialProject.id],
    queryFn: () => getCreativeFlowProject(initialProject.id),
    initialData: initialProject,
    staleTime: 1_000,
    refetchInterval: (query) => query.state.data?.activeJobType ? 1_800 : false,
  })
  const project = projectQuery.data
  const analysis = project.workflow.analysis
  const running = project.activeJobType === 'PRODUCT_ANALYSIS'
  const blockedByAnother = Boolean(activeProject && activeProject.id !== project.id && activeProject.activeJobType)

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
    const nextNodes = defaultNodes(project)
    setNodes((current) => nextNodes.map((node) => {
      const existing = current.find((item) => item.id === node.id)
      return existing ? { ...node, position: existing.position } : node
    }))
    setEdges(defaultEdges(project))

    const stageChanged = lastStageRef.current !== project.currentStage
    lastStageRef.current = project.currentStage
    if ((running || analysis) && stageChanged) {
      window.setTimeout(() => {
        void flow.fitView({
          nodes: analysis
            ? [{ id: 'productUrl' }, { id: 'productImages' }, { id: 'analyzeProduct' }, { id: 'productIntelligence' }]
            : [{ id: 'productUrl' }, { id: 'productImages' }, { id: 'analyzeProduct' }, { id: 'analysisProcess' }],
          padding: 0.2,
          duration: 720,
          maxZoom: 1.05,
        })
      }, 120)
    }
  }, [analysis, flow, project, running, setEdges, setNodes])

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
    if (sourceBusy || running) return
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
  }, [persistSource, project.workflow.source.referenceAssetIds, project.workflow.source.referenceNames, running, sourceBusy, urlDraft])

  const uploadFiles = useCallback(async (incoming: File[]) => {
    if (sourceBusy || running) return
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
  }, [persistSource, project.workflow.source.normalizedUrl, project.workflow.source.referenceAssetIds, project.workflow.source.referenceNames, running, sourceBusy, urlDraft])

  const removeReference = useCallback(async (index: number) => {
    if (sourceBusy || running) return
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
  }, [persistSource, project.workflow.source.normalizedUrl, project.workflow.source.referenceAssetIds, project.workflow.source.referenceNames, running, sourceBusy, urlDraft])

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

  const saveCanvas = useCallback(async (nextNodes: Stage2Node[], viewport?: Viewport) => {
    const byId = new Map(nextNodes.map((node) => [node.id, node.position]))
    try {
      const next = await saveCreativeFlowProjectCanvas(project.id, {
        positions: {
          productUrl: byId.get('productUrl'),
          productImages: byId.get('productImages'),
          analyzeProduct: byId.get('analyzeProduct'),
          productIntelligence: byId.get('productIntelligence') || byId.get('analysisProcess'),
        },
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
    sourceBusy,
    running,
    error,
    uploadProgress,
    localPreviews,
    setUrlDraft,
    setUrlExpanded,
    setImageExpanded,
    saveUrl: () => void saveUrl(),
    uploadFiles: (files) => void uploadFiles(files),
    removeReference: (index) => void removeReference(index),
    runAnalysis: () => void runAnalysis(),
  }), [analysis, error, imageExpanded, localPreviews, project, removeReference, runAnalysis, running, saveUrl, sourceBusy, uploadFiles, uploadProgress, urlDraft, urlExpanded])

  return <WorkspaceContext.Provider value={contextValue}>
    <div className="relative size-full min-h-[560px] overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(45,212,191,.055),transparent_25rem),radial-gradient(circle_at_85%_75%,rgba(139,92,246,.045),transparent_28rem),#f8fafc]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto max-w-[min(620px,72vw)] rounded-2xl border border-border-soft bg-white/92 px-3.5 py-2.5 shadow-[0_10px_32px_rgba(15,23,42,.07)] backdrop-blur-lg">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[8px] font-bold uppercase tracking-[.15em] text-brand-cyan">Creative Flow · Stage 2</span>
            <span className={`rounded-full border px-2 py-0.5 text-[8px] font-semibold ${running ? 'border-brand-cyan/20 bg-brand-cyan/[.05] text-brand-cyan' : analysis ? 'border-brand-green/20 bg-brand-green/[.05] text-brand-green' : 'border-border-soft bg-slate-50 text-text-soft'}`}>
              {running ? 'Analysing product' : analysis ? 'Product ready' : 'Source setup'}
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

      {blockedByAnother && <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 w-[min(660px,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-brand-amber/20 bg-white/95 px-3 py-2.5 text-center text-[9px] text-text-muted shadow-lg backdrop-blur">“{activeProject?.name}” currently owns the active Creative Flow AI job. You can edit this project, but analysis waits until that job finishes.</div>}

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
            <input autoFocus className="min-h-10 min-w-0 flex-1 rounded-xl border border-border-soft bg-slate-50 px-3 text-[10px] outline-none transition focus:border-brand-cyan focus:bg-white" disabled={sourceBusy || running} onChange={(event) => setUrlDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveUrl() }} placeholder="yourproduct.com" value={urlDraft} />
            <Button disabled={sourceBusy || running} onClick={saveUrl} size="sm" variant="primary">{sourceBusy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}Done</Button>
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
            <Button className="mt-2" disabled={sourceBusy || running || ids.length >= 8} onClick={() => inputRef.current?.click()} size="sm"><ImagePlus className="size-3" />Choose images</Button>
            <input accept="image/*" className="hidden" multiple onChange={pickFiles} ref={inputRef} type="file" />
            {sourceBusy && uploadProgress > 0 && <div className="mt-3"><div className="h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-brand-purple transition-all" style={{ width: `${uploadProgress}%` }} /></div><span className="mt-1 block text-[8px] text-text-soft">Uploading {uploadProgress}%</span></div>}
          </div>

          {ids.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2">{ids.map((id, index) => {
            const preview = localPreviews.find((item) => item.id === id)
            return <div className="group relative overflow-hidden rounded-xl border border-border-soft bg-slate-50" key={id}>
              {preview ? <img alt={preview.name} className="aspect-[4/3] w-full object-cover" src={preview.url} /> : <div className="grid aspect-[4/3] place-items-center bg-[linear-gradient(145deg,#f8fafc,#eef2ff)]"><FileImage className="size-5 text-brand-purple/45" /></div>}
              <div className="flex items-center gap-1.5 border-t border-border-soft bg-white px-2 py-1.5"><span className="min-w-0 flex-1 truncate text-[7px] text-text-muted">{names[index] || `Reference ${index + 1}`}</span><button aria-label="Remove product reference" className="grid size-6 place-items-center rounded-md text-text-soft hover:bg-red-50 hover:text-red-500" disabled={sourceBusy || running} onClick={() => removeReference(index)} type="button"><X className="size-3" /></button></div>
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
        <span className={`mx-auto grid size-11 place-items-center rounded-[16px] border ${running ? 'border-brand-cyan/25 bg-brand-cyan/[.07] text-brand-cyan' : success ? 'border-brand-green/20 bg-brand-green/[.06] text-brand-green' : failed ? 'border-red-200 bg-red-50 text-red-500' : 'border-border-soft bg-slate-50 text-text-muted'}`}>
          {running ? <Loader2 className="size-4.5 animate-spin motion-reduce:animate-none" /> : success ? <Check className="size-4.5" /> : failed ? <RefreshCw className="size-4.5" /> : <Play className="size-4.5" />}
        </span>
        <span className="mt-3 block text-[8px] font-bold uppercase tracking-[.14em] text-brand-cyan">Analyse Product</span>
        <strong className="mt-1 block text-[11px]">{running ? 'Creative Flow is reading your sources' : success ? 'Product understood' : failed ? 'Try product analysis again' : 'Connect the product inputs'}</strong>
        <p className="mt-1.5 text-[8px] leading-4 text-text-soft">{running ? project.progress.label || 'Analysing…' : success ? 'The Product Intelligence node is ready.' : 'URL, images, or both can feed the analysis.'}</p>
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
        <div className="mt-3 rounded-xl border border-brand-green/15 bg-brand-green/[.035] p-2.5" data-intelligence-chip><span className="flex items-center gap-1.5 text-[8px] font-semibold text-brand-green"><Sparkles className="size-3" />Stage 2 complete</span><p className="mt-1 text-[8px] leading-4 text-text-muted">This node and its evidence are persisted with the project. Campaign Setup grows from here in Stage 3.</p></div>
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
