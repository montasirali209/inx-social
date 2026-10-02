import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FolderKanban,
  FolderOpen,
  Loader2,
  Plus,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  archiveCreativeFlowProject,
  createCreativeFlowProject,
  listCreativeFlowProjects,
  openCreativeFlowProject,
  type CreativeFlowProject,
  type CreativeFlowProjectList,
} from '../../lib/creative-flow-api'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

export function CreativeFlowProjectLaunchCard({ onOpen }: { onOpen: () => void }) {
  return <Card className="group relative overflow-hidden border-brand-cyan/25 p-0 transition duration-300 hover:border-brand-cyan/45 hover:shadow-[0_20px_56px_rgba(15,23,42,.10)]">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_12%,rgba(45,212,191,.11),transparent_22rem),radial-gradient(circle_at_95%_90%,rgba(139,92,246,.07),transparent_20rem)]" />
    <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)] lg:items-center">
      <div className="flex min-w-0 items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan shadow-[0_14px_34px_rgba(20,184,166,.12)]">
          <WandSparkles className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[.17em] text-brand-cyan">Creative Flow</span>
            <span className="rounded-full border border-brand-purple/20 bg-brand-purple/[.06] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.12em] text-brand-purple">Projects</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight sm:text-xl">Build campaigns as persistent creative projects.</h2>
          <p className="mt-2 max-w-3xl text-[11px] leading-5 text-text-muted">Create a project, leave it running in the background, and come back later without losing the workflow or campaign progress.</p>
          <Button className="mt-5" onClick={onOpen} size="sm" variant="primary">
            <FolderKanban className="size-3.5" />Open Creative Flow <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Button>
        </div>
      </div>

      <div aria-hidden="true" className="relative hidden min-h-[150px] lg:block">
        <div className="absolute left-[7%] top-[38px] w-[132px] -rotate-[5deg] rounded-[18px] border border-border-soft bg-white p-3 shadow-[0_14px_36px_rgba(15,23,42,.07)] transition duration-300 group-hover:-translate-x-1">
          <span className="grid size-8 place-items-center rounded-xl bg-brand-cyan/[.08] text-brand-cyan"><FolderOpen className="size-4" /></span>
          <strong className="mt-2 block text-[9px]">Product launch</strong>
          <span className="mt-1 block text-[8px] text-text-soft">Draft</span>
        </div>
        <div className="absolute right-[8%] top-[30px] w-[142px] rotate-[5deg] rounded-[18px] border border-brand-green/20 bg-white p-3 shadow-[0_14px_36px_rgba(15,23,42,.07)] transition duration-300 group-hover:translate-x-1">
          <span className="grid size-8 place-items-center rounded-xl bg-brand-green/[.08] text-brand-green"><Sparkles className="size-4" /></span>
          <strong className="mt-2 block text-[9px]">October campaign</strong>
          <span className="mt-1 inline-flex items-center gap-1 text-[8px] text-brand-green"><span className="size-1.5 rounded-full bg-brand-green" />Saved</span>
        </div>
      </div>
    </div>
  </Card>
}

export function CreativeFlowProjectHubModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const dialogRef = useRef<HTMLElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selectedProject, setSelectedProject] = useState<CreativeFlowProject | null>(null)

  const projectsQuery = useQuery({
    queryKey: ['creative-flow-projects'],
    queryFn: listCreativeFlowProjects,
    enabled: open,
    staleTime: 3_000,
    refetchInterval: open ? 10_000 : false,
  })

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || busy) return
      event.preventDefault()
      if (createOpen) setCreateOpen(false)
      else if (selectedProject) setSelectedProject(null)
      else onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const timer = window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>('button, input')?.focus(), 0)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus.current?.focus()
    }
  }, [open, onClose, busy, createOpen, selectedProject])

  const data = projectsQuery.data
  const projects = data?.projects || []
  const activeProject = data?.activeProject || null
  const sortedProjects = useMemo(() => {
    if (!activeProject) return projects
    return [activeProject, ...projects.filter((project) => project.id !== activeProject.id)]
  }, [activeProject, projects])

  if (!open) return null

  async function createProject() {
    const name = projectName.trim()
    if (!name || busy) return
    setBusy(true)
    setError('')
    try {
      const project = await createCreativeFlowProject(name)
      queryClient.setQueryData<CreativeFlowProjectList>(['creative-flow-projects'], (current) => ({
        projects: [project, ...(current?.projects || []).filter((item) => item.id !== project.id)],
        activeProject: current?.activeProject || null,
      }))
      setProjectName('')
      setCreateOpen(false)
      setSelectedProject(project)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not create this project.')
    } finally {
      setBusy(false)
    }
  }

  async function openProject(project: CreativeFlowProject) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const opened = await openCreativeFlowProject(project.id)
      queryClient.setQueryData<CreativeFlowProjectList>(['creative-flow-projects'], (current) => ({
        projects: (current?.projects || []).map((item) => item.id === opened.id ? opened : item),
        activeProject: current?.activeProject?.id === opened.id ? opened : current?.activeProject || null,
      }))
      setSelectedProject(opened)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not open this project.')
    } finally {
      setBusy(false)
    }
  }

  async function archiveProject(project: CreativeFlowProject) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await archiveCreativeFlowProject(project.id)
      queryClient.setQueryData<CreativeFlowProjectList>(['creative-flow-projects'], (current) => ({
        projects: (current?.projects || []).filter((item) => item.id !== project.id),
        activeProject: current?.activeProject?.id === project.id ? null : current?.activeProject || null,
      }))
      if (selectedProject?.id === project.id) setSelectedProject(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creative Flow could not archive this project.')
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[360] bg-slate-950/55 p-3 backdrop-blur-md sm:p-6" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) onClose() }}>
      <section aria-labelledby="creative-flow-projects-title" aria-modal="true" className="mx-auto flex h-[calc(100dvh-1.5rem)] w-full max-w-[1120px] flex-col overflow-hidden rounded-[24px] border border-border-soft bg-[#f8fafc] shadow-[0_38px_130px_rgba(15,23,42,.32)] sm:h-[min(820px,calc(100dvh-3rem))]" ref={dialogRef} role="dialog">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-soft bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            {selectedProject && <button aria-label="Back to Creative Flow projects" className="grid size-9 shrink-0 place-items-center rounded-xl border border-border-soft bg-white text-text-muted transition hover:bg-slate-50 hover:text-text-main" onClick={() => setSelectedProject(null)} type="button"><ArrowLeft className="size-4" /></button>}
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-brand-cyan/25 bg-brand-cyan/[.08] text-brand-cyan"><FolderKanban className="size-4.5" /></span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold sm:text-lg" id="creative-flow-projects-title">{selectedProject ? selectedProject.name : 'Creative Flow Projects'}</h2>
              <p className="mt-0.5 hidden text-[10px] text-text-muted sm:block">{selectedProject ? 'Persistent Creative Flow project' : 'Create, resume and monitor your Creative Flow work.'}</p>
            </div>
          </div>
          <button aria-label="Close Creative Flow" className="grid size-9 place-items-center rounded-xl border border-border-soft bg-white text-text-muted transition hover:bg-slate-50 hover:text-text-main disabled:opacity-50" disabled={busy} onClick={onClose} type="button"><X className="size-4" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectedProject
            ? <ProjectFoundation project={selectedProject} activeProject={activeProject} onBack={() => setSelectedProject(null)} />
            : <div className="p-4 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-[.16em] text-brand-cyan">Your workspace</span>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight">Creative Flow projects</h3>
                    <p className="mt-1 max-w-2xl text-[10px] leading-5 text-text-muted">Projects are saved before any AI work begins, so you can close INXSocial and return without losing the campaign state.</p>
                  </div>
                  <Button onClick={() => { setCreateOpen(true); setError('') }} size="sm" variant="primary"><Plus className="size-3.5" />New project</Button>
                </div>

                {activeProject && <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-brand-cyan/25 bg-brand-cyan/[.04] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand-cyan/20 bg-white text-brand-cyan"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" /></span>
                    <div className="min-w-0"><strong className="block truncate text-[11px]">{activeProject.name} is working in the background</strong><span className="mt-0.5 block truncate text-[9px] text-text-muted">{activeProject.progress.label || humanStage(activeProject.currentStage)}{activeProject.progress.total > 0 ? ` · ${activeProject.progress.current}/${activeProject.progress.total}` : ''}</span></div>
                  </div>
                  <Button onClick={() => void openProject(activeProject)} size="sm">View project</Button>
                </div>}

                {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[10px] text-red-700">{error}</div>}

                {projectsQuery.isLoading
                  ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div className="h-[166px] animate-pulse rounded-[20px] border border-border-soft bg-white" key={index} />)}</div>
                  : projectsQuery.isError
                    ? <div className="mt-5 rounded-[20px] border border-border-soft bg-white p-8 text-center"><strong className="text-sm">Projects could not load</strong><p className="mt-1 text-[10px] text-text-muted">{projectsQuery.error instanceof Error ? projectsQuery.error.message : 'Try again in a moment.'}</p><Button className="mt-4" onClick={() => void projectsQuery.refetch()} size="sm">Retry</Button></div>
                    : sortedProjects.length
                      ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{sortedProjects.map((project) => <ProjectCard busy={busy} key={project.id} project={project} onArchive={() => void archiveProject(project)} onOpen={() => void openProject(project)} />)}</div>
                      : <div className="mt-5 grid min-h-[300px] place-items-center rounded-[24px] border border-dashed border-border-soft bg-white p-8 text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-[20px] border border-brand-cyan/20 bg-brand-cyan/[.05] text-brand-cyan"><FolderOpen className="size-6" /></span><h4 className="mt-4 text-base font-semibold">Your first project starts here</h4><p className="mx-auto mt-1 max-w-md text-[10px] leading-5 text-text-muted">Name the project first. The Creative Flow workflow will always belong to that project and can be restored later.</p><Button className="mt-4" onClick={() => setCreateOpen(true)} size="sm" variant="primary"><Plus className="size-3.5" />Create project</Button></div></div>}
              </div>}
        </div>

        {!selectedProject && <footer className="shrink-0 border-t border-border-soft bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><span className="text-[9px] text-text-muted">Multiple projects can be saved.</span><span className="text-[9px] font-medium text-text-soft">Only one Creative Flow AI job can actively process at a time.</span></div>
        </footer>}
      </section>

      {createOpen && <div className="fixed inset-0 z-[380] grid place-items-center bg-slate-950/25 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) setCreateOpen(false) }}>
        <section aria-modal="true" className="w-full max-w-md rounded-[22px] border border-border-soft bg-white p-5 shadow-[0_30px_90px_rgba(15,23,42,.28)]" role="dialog">
          <div className="flex items-start justify-between gap-3"><div><span className="text-[8px] font-bold uppercase tracking-[.15em] text-brand-cyan">New Creative Flow project</span><h3 className="mt-1 text-lg font-semibold">Name your project</h3><p className="mt-1 text-[10px] leading-5 text-text-muted">The project is saved immediately. You can prepare other drafts while another Creative Flow job is running.</p></div><button aria-label="Close create project" className="grid size-8 shrink-0 place-items-center rounded-lg text-text-muted hover:bg-slate-50 hover:text-text-main" disabled={busy} onClick={() => setCreateOpen(false)} type="button"><X className="size-4" /></button></div>
          <label className="mt-4 block"><span className="text-[9px] font-semibold text-text-muted">Project name</span><input autoFocus className="mt-1.5 min-h-11 w-full rounded-xl border border-border-soft bg-slate-50 px-3 text-[11px] outline-none transition focus:border-brand-cyan focus:bg-white" maxLength={120} onChange={(event) => setProjectName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void createProject() }} placeholder="e.g. October product campaign" value={projectName} /></label>
          {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[9px] text-red-700">{error}</div>}
          <div className="mt-5 flex justify-end gap-2"><Button disabled={busy} onClick={() => setCreateOpen(false)}>Cancel</Button><Button disabled={!projectName.trim() || busy} onClick={() => void createProject()} variant="primary">{busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}Create project</Button></div>
        </section>
      </div>}
    </div>,
    document.body,
  )
}

function ProjectCard({ project, busy, onOpen, onArchive }: { project: CreativeFlowProject; busy: boolean; onOpen: () => void; onArchive: () => void }) {
  const running = Boolean(project.activeJobType)
  const completed = project.status === 'COMPLETED'
  const statusLabel = running ? 'Running' : completed ? 'Completed' : project.status === 'FAILED' ? 'Needs attention' : project.status === 'DRAFT' ? 'Draft' : humanStage(project.currentStage)
  return <article className={`group relative overflow-hidden rounded-[20px] border bg-white p-4 shadow-[0_10px_32px_rgba(15,23,42,.045)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(15,23,42,.075)] ${running ? 'border-brand-cyan/35' : 'border-border-soft'}`}>
    <div className="flex items-start justify-between gap-3">
      <span className={`grid size-10 place-items-center rounded-2xl border ${running ? 'border-brand-cyan/25 bg-brand-cyan/[.07] text-brand-cyan' : completed ? 'border-brand-green/20 bg-brand-green/[.06] text-brand-green' : 'border-border-soft bg-slate-50 text-text-muted'}`}>{running ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : completed ? <CheckCircle2 className="size-4" /> : <FolderOpen className="size-4" />}</span>
      <span className={`rounded-full border px-2 py-1 text-[8px] font-semibold ${running ? 'border-brand-cyan/20 bg-brand-cyan/[.05] text-brand-cyan' : completed ? 'border-brand-green/20 bg-brand-green/[.05] text-brand-green' : 'border-border-soft bg-slate-50 text-text-soft'}`}>{statusLabel}</span>
    </div>
    <h4 className="mt-4 truncate text-[12px] font-semibold">{project.name}</h4>
    <p className="mt-1 line-clamp-1 text-[9px] text-text-muted">{running ? project.progress.label || humanStage(project.currentStage) : humanStage(project.currentStage)}</p>
    {running && project.progress.total > 0 && <div className="mt-3"><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-cyan transition-all" style={{ width: `${Math.min(100, Math.round((project.progress.current / project.progress.total) * 100))}%` }} /></div><span className="mt-1.5 block text-[8px] text-text-soft">{project.progress.current} / {project.progress.total}</span></div>}
    <div className="mt-4 flex items-center justify-between gap-2 border-t border-border-soft pt-3">
      <span className="inline-flex items-center gap-1 text-[8px] text-text-soft"><Clock3 className="size-3" />{relativeTime(project.updatedAt)}</span>
      <div className="flex gap-1.5"><button aria-label={`Archive ${project.name}`} className="grid size-8 place-items-center rounded-lg border border-transparent text-text-soft opacity-0 transition hover:border-border-soft hover:bg-slate-50 hover:text-text-main group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-30" disabled={busy || running} onClick={onArchive} type="button"><Archive className="size-3.5" /></button><Button disabled={busy} onClick={onOpen} size="sm">{running ? 'View' : 'Open'}<ArrowRight className="size-3" /></Button></div>
    </div>
  </article>
}

function ProjectFoundation({ project, activeProject, onBack }: { project: CreativeFlowProject; activeProject: CreativeFlowProject | null; onBack: () => void }) {
  const blockedByAnother = Boolean(activeProject && activeProject.id !== project.id)
  return <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
    <div className="rounded-[24px] border border-border-soft bg-white p-5 shadow-[0_16px_48px_rgba(15,23,42,.06)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><span className="text-[9px] font-bold uppercase tracking-[.16em] text-brand-cyan">Project foundation</span><h3 className="mt-1 text-xl font-semibold">{project.name}</h3><p className="mt-1 text-[10px] text-text-muted">Created {new Date(project.createdAt).toLocaleString()} · Last opened {new Date(project.lastOpenedAt).toLocaleString()}</p></div>
        <span className="rounded-full border border-border-soft bg-slate-50 px-3 py-1.5 text-[9px] font-semibold text-text-muted">{project.activeJobType ? 'Running' : project.status === 'DRAFT' ? 'Draft' : humanStage(project.currentStage)}</span>
      </div>

      {blockedByAnother && <div className="mt-5 rounded-2xl border border-brand-amber/20 bg-brand-amber/[.04] p-4"><strong className="text-[10px]">This project is safely stored as a draft.</strong><p className="mt-1 text-[9px] leading-4 text-text-muted">“{activeProject?.name}” currently owns the active Creative Flow job. You will still be able to prepare this project, but a second AI-processing job will not start until the active one finishes.</p></div>}

      <div className="mt-6 grid min-h-[300px] place-items-center rounded-[22px] border border-dashed border-brand-cyan/25 bg-[radial-gradient(circle_at_50%_40%,rgba(45,212,191,.05),transparent_18rem)] p-8 text-center">
        <div className="max-w-lg">
          <span className="mx-auto grid size-16 place-items-center rounded-[22px] border border-brand-cyan/20 bg-white text-brand-cyan shadow-[0_14px_34px_rgba(20,184,166,.08)]"><WandSparkles className="size-6" /></span>
          <h4 className="mt-4 text-base font-semibold">Project persistence is ready</h4>
          <p className="mt-2 text-[10px] leading-5 text-text-muted">This project now has its own permanent identity, stage, progress and active-job state. The full motion workflow canvas will attach to this project rather than living in a temporary browser session.</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-green/20 bg-brand-green/[.05] px-3 py-1.5 text-[9px] font-semibold text-brand-green"><CheckCircle2 className="size-3.5" />Safe to close and reopen</div>
        </div>
      </div>

      <div className="mt-5 flex justify-start"><Button onClick={onBack} size="sm"><ArrowLeft className="size-3.5" />Back to projects</Button></div>
    </div>
  </div>
}

function humanStage(value: string) {
  const map: Record<string, string> = {
    PROJECT_CREATED: 'Project created',
    PRODUCT_READY: 'Product ready',
    STRATEGY_READY: 'Strategy ready',
    REVIEW_READY: 'Ready for review',
    COMPLETED: 'Completed',
    FAILED: 'Needs attention',
  }
  return map[value] || String(value || 'Draft').replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase())
}

function relativeTime(value: string) {
  const time = new Date(value).getTime()
  const diff = Math.max(0, Date.now() - time)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days < 7 ? `${days}d ago` : new Date(value).toLocaleDateString()
}
