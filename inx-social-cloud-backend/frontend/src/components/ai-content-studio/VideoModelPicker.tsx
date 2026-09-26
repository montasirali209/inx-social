import { useMemo, useState } from 'react'
import { BadgeDollarSign, Check, Film, Search, Shapes, Sparkles, X, Zap } from 'lucide-react'
import type { VideoModelOption } from '../../lib/ai-next-studio-api'

type Category = 'best' | 'popular' | 'specialists' | 'all'

const POPULAR_HINTS = /p-video|kling|wan|runway|seedance|minimax|hailuo|ltx|veo|sora/i

function modelModes(model: VideoModelOption) {
  const values: string[] = []
  if (model.modes?.includes('TEXT_TO_VIDEO')) values.push('Text')
  if (model.modes?.includes('IMAGE_TO_VIDEO') || model.imageReferenceSupported) values.push('Image')
  if (model.referenceImagesSupported) values.push('References')
  return values
}

function scoreBestValue(model: VideoModelOption) {
  const credits = typeof model.baselineCredits === 'number' ? model.baselineCredits : 999999
  const budget = /best value|budget|fast|economy/i.test(`${model.badge || ''} ${(model.tags || []).join(' ')}`) ? -1000 : 0
  return budget + credits
}

function categoryModels(models: VideoModelOption[], category: Category) {
  if (category === 'best') {
    return [...models]
      .filter((model) => typeof model.baselineCredits === 'number' || /best value|budget|fast|economy/i.test(`${model.badge || ''} ${(model.tags || []).join(' ')}`))
      .sort((a, b) => scoreBestValue(a) - scoreBestValue(b))
      .slice(0, 14)
  }
  if (category === 'popular') {
    const popular = models.filter((model) => POPULAR_HINTS.test(`${model.name} ${model.creator || ''}`))
    return (popular.length ? popular : models).slice(0, 18)
  }
  if (category === 'specialists') {
    return models.filter((model) =>
      model.referenceImagesSupported ||
      model.lastFrameSupported ||
      model.draftSupported ||
      model.audioSupported ||
      (model.durations || []).some((value) => value >= 20) ||
      (model.resolutions || []).some((value) => /1080|1440|2160/i.test(value)),
    )
  }
  return models
}

function categoryIcon(category: Category) {
  if (category === 'best') return <BadgeDollarSign className="size-3.5" />
  if (category === 'popular') return <Sparkles className="size-3.5" />
  if (category === 'specialists') return <Shapes className="size-3.5" />
  return <Film className="size-3.5" />
}

export function VideoModelPicker({
  open,
  models,
  selectedId,
  onSelect,
  onClose,
}: {
  open: boolean
  models: VideoModelOption[]
  selectedId: string
  onSelect: (model: VideoModelOption) => void
  onClose: () => void
}) {
  const [category, setCategory] = useState<Category>('best')
  const [search, setSearch] = useState('')

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    const base = query ? models : categoryModels(models, category)
    return base.filter((model) => {
      if (!query) return true
      return `${model.name} ${model.creator || ''} ${model.description || ''} ${(model.tags || []).join(' ')}`.toLowerCase().includes(query)
    })
  }, [category, models, search])

  if (!open) return null

  const categories: Array<{ key: Category; label: string }> = [
    { key: 'best', label: 'Best Value' },
    { key: 'popular', label: 'Popular' },
    { key: 'specialists', label: 'Specialists' },
    { key: 'all', label: 'All Models' },
  ]

  return <div className="absolute inset-0 z-[30] flex items-stretch justify-center bg-[#01070d]/88 p-2 backdrop-blur-xl sm:p-5">
    <div className="flex w-full max-w-[1180px] flex-col overflow-hidden rounded-[28px] border border-brand-cyan/25 bg-[radial-gradient(circle_at_16%_0%,rgba(0,214,192,.09),transparent_34%),linear-gradient(145deg,#071b28,#020b13)] shadow-[0_35px_120px_rgba(0,0,0,.72)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft px-4 py-4 sm:px-6">
        <div>
          <span className="text-[8px] font-bold uppercase tracking-[.18em] text-brand-cyan">Choose video model</span>
          <h3 className="mt-1 text-base font-bold">Runware model library</h3>
          <p className="mt-1 text-[9px] text-text-muted">{models.length} generation-ready models available in this workspace.</p>
        </div>
        <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-xl border border-border-soft text-text-muted transition hover:border-brand-cyan/30 hover:text-white"><X className="size-4" /></button>
      </header>

      <div className="border-b border-border-soft px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((item) => <button
              type="button"
              key={item.key}
              onClick={() => { setCategory(item.key); setSearch('') }}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-[9px] font-semibold transition ${category === item.key && !search ? 'border-brand-cyan/35 bg-brand-cyan/[.08] text-white shadow-[0_10px_30px_rgba(0,214,192,.07)]' : 'border-border-soft bg-black/10 text-text-muted hover:border-brand-cyan/25 hover:text-white'}`}
            >{categoryIcon(item.key)}{item.label}</button>)}
          </div>
          <label className="flex min-w-0 items-center gap-2 rounded-xl border border-border-soft bg-black/15 px-3 py-2.5 lg:w-[320px]">
            <Search className="size-3.5 shrink-0 text-text-soft" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search model, creator or capability…" className="min-w-0 flex-1 bg-transparent text-[9px] outline-none placeholder:text-text-soft" />
          </label>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {visible.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((model) => {
            const active = model.id === selectedId
            const modes = modelModes(model)
            return <button
              type="button"
              key={model.id}
              onClick={() => { onSelect(model); onClose() }}
              className={`group relative min-h-[180px] overflow-hidden rounded-[22px] border p-4 text-left transition-all duration-300 hover:-translate-y-0.5 ${active ? 'border-brand-cyan/45 bg-brand-cyan/[.07] shadow-[0_18px_55px_rgba(0,214,192,.08)]' : 'border-border-soft bg-black/12 hover:border-brand-cyan/25 hover:bg-white/[.025]'}`}
            >
              <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="flex items-start justify-between gap-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl border ${active ? 'border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan' : 'border-white/8 bg-white/[.035] text-text-muted'}`}>{model.speed === 'fast' ? <Zap className="size-4" /> : <Film className="size-4" />}</span>
                <div className="flex items-center gap-2">
                  {typeof model.baselineCredits === 'number' && <span className="rounded-full border border-amber-300/20 bg-amber-300/[.05] px-2 py-1 text-[7px] font-semibold text-amber-200">from {model.baselineCredits} cr</span>}
                  {active && <span className="grid size-6 place-items-center rounded-full bg-brand-green/15 text-brand-green"><Check className="size-3.5" /></span>}
                </div>
              </div>
              <strong className="mt-3 block text-[11px] text-white">{model.name}</strong>
              <span className="mt-1 block text-[8px] font-semibold uppercase tracking-[.09em] text-text-soft">{model.creator || model.badge || 'Runware'}</span>
              <p className="mt-2 line-clamp-3 text-[8px] leading-4 text-text-muted">{model.description || 'AI video generation model.'}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {modes.slice(0, 3).map((mode) => <span key={mode} className="rounded-full border border-white/7 bg-white/[.025] px-2 py-1 text-[7px] text-text-soft">{mode}</span>)}
                {(model.resolutions || []).slice(0, 2).map((value) => <span key={value} className="rounded-full border border-white/7 bg-white/[.025] px-2 py-1 text-[7px] text-text-soft">{value}</span>)}
              </div>
            </button>
          })}
        </div> : <div className="grid min-h-[320px] place-items-center text-center"><div><Search className="mx-auto size-8 text-text-soft" /><h4 className="mt-3 text-sm font-semibold">No matching model</h4><p className="mt-1 text-[9px] text-text-muted">Try a broader model, creator or capability search.</p></div></div>}
      </div>
    </div>
  </div>
}
