type WorkspaceLoadingStateProps = {
  title: string
  message: string
  stats?: Array<{ label: string; emoji: string }>
  panels?: Array<{ title: string; emoji?: string; rows?: number; minHeight?: string }>
}

export function WorkspaceLoadingState({
  title,
  message,
  stats = [],
  panels = [],
}: WorkspaceLoadingStateProps) {
  return (
    <div aria-label={`Loading ${title}`} className="dashboard-canvas space-y-4" role="status">
      {stats.length ? (
        <section className="flex items-stretch gap-3 overflow-hidden md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {stats.map((stat, index) => (
            <article className="relative min-h-[104px] min-w-52 overflow-hidden rounded-card border border-border-soft bg-panel/70 p-3.5 md:min-w-0" key={stat.label}>
              <div className="flex items-center gap-3">
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/[.07] bg-white/[.025] text-lg motion-safe:animate-bounce"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  {stat.emoji}
                </span>
                <span className="min-w-0">
                  <small className="block truncate text-[10px] font-semibold text-text-muted">{stat.label}</small>
                  <strong className="mt-1 block text-sm">Updating…</strong>
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border-soft">
                <span
                  className="block h-full animate-pulse rounded-full bg-gradient-to-r from-brand-teal/60 to-brand-cyan motion-reduce:animate-none"
                  style={{ width: `${52 + (index % 4) * 10}%`, animationDelay: `${index * 90}ms` }}
                />
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <section className="rounded-panel border border-brand-cyan/12 bg-panel/55 px-4 py-3 shadow-panel">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand-cyan/15 bg-brand-cyan/[.05] text-lg motion-safe:animate-bounce">⏳</span>
          <span className="min-w-0">
            <strong className="block text-sm">{title}</strong>
            <small className="mt-0.5 block text-[10px] leading-4 text-text-muted">{message}</small>
          </span>
          <span className="ml-auto hidden items-center gap-1.5 text-[9px] font-semibold text-brand-cyan sm:inline-flex">
            <i className="size-1.5 animate-pulse rounded-full bg-brand-cyan motion-reduce:animate-none" />
            Syncing live data
          </span>
        </div>
      </section>

      {panels.length ? (
        <section className={`grid gap-4 ${panels.length === 1 ? '' : panels.length === 2 ? 'xl:grid-cols-2' : 'lg:grid-cols-2 xl:grid-cols-3'}`}>
          {panels.map((panel, index) => (
            <article
              className="overflow-hidden rounded-panel border border-border-soft bg-panel/65 p-4"
              key={panel.title}
              style={{ minHeight: panel.minHeight || (index === 0 ? '260px' : '220px') }}
            >
              <header className="flex items-center justify-between gap-3">
                <span>
                  <strong className="block text-sm">{panel.title}</strong>
                  <small className="mt-1 block text-[10px] text-text-muted">Preparing the latest workspace data</small>
                </span>
                <span className="text-xl motion-safe:animate-pulse">{panel.emoji || '✨'}</span>
              </header>
              <div className="mt-5 space-y-3">
                {Array.from({ length: panel.rows || 4 }, (_, row) => (
                  <div className="flex items-center gap-3 rounded-xl border border-white/[.035] bg-white/[.018] p-2.5" key={row}>
                    <span className="size-9 shrink-0 animate-pulse rounded-lg bg-white/[.04] motion-reduce:animate-none" />
                    <span className="min-w-0 flex-1">
                      <i className="block h-2.5 w-3/5 animate-pulse rounded-full bg-white/[.055] motion-reduce:animate-none" />
                      <i className="mt-2 block h-2 w-2/5 animate-pulse rounded-full bg-white/[.035] motion-reduce:animate-none" />
                    </span>
                    <span className="h-2 w-10 animate-pulse rounded-full bg-brand-cyan/10 motion-reduce:animate-none" />
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  )
}
