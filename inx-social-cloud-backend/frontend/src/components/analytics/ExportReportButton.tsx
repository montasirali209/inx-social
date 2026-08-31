import { Download, FileJson, FileSpreadsheet, Mail, Printer, type LucideIcon } from 'lucide-react'
import type { AnalyticsView } from '../../types/analytics'
import { formatAnalyticsValue } from '../../data/analyticsData'

function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = name; anchor.click()
  URL.revokeObjectURL(url)
}

export function ExportReportButton({ view }: { view: AnalyticsView }) {
  const rows = view.stats.map((stat) => [stat.label, formatAnalyticsValue(stat.value, stat.format), stat.detail])
  const exportCsv = () => downloadFile(`inx-social-analytics-${new Date().toISOString().slice(0, 10)}.csv`, ['Metric,Value,Detail', ...rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))].join('\n'), 'text/csv;charset=utf-8')
  const exportExcel = () => downloadFile(`inx-social-analytics-${new Date().toISOString().slice(0, 10)}.xls`, `<table><tr><th>Metric</th><th>Value</th><th>Detail</th></tr>${rows.map((row) => `<tr>${row.map((value) => `<td>${String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</td>`).join('')}</tr>`).join('')}</table>`, 'application/vnd.ms-excel')
  const exportJson = () => downloadFile(`inx-social-analytics-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ page: view.source.page.name, fetchedAt: view.source.fetchedAt, summary: view.source.summary }, null, 2), 'application/json')
  const email = () => { window.location.href = `mailto:?subject=${encodeURIComponent(`INX Social analytics — ${view.source.page.name}`)}&body=${encodeURIComponent(rows.map((row) => `${row[0]}: ${row[1]}`).join('\n'))}` }
  const actions: Array<{ icon: LucideIcon; label: string; action: () => void }> = [
    { icon: Printer, label: 'Export PDF / Print', action: () => window.print() },
    { icon: FileSpreadsheet, label: 'Export CSV', action: exportCsv },
    { icon: FileSpreadsheet, label: 'Export Excel', action: exportExcel },
    { icon: FileJson, label: 'Export JSON', action: exportJson },
    { icon: Mail, label: 'Email Report', action: email },
  ]
  return <details className="group relative"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-border-soft bg-panel/70 px-4 text-xs font-semibold transition hover:border-brand-cyan/40 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan"><Download className="size-4" />Export Report</summary><div className="notification-pop absolute right-0 top-full z-40 mt-2 w-52 rounded-xl border border-border-soft bg-panel p-2 shadow-panel">{actions.map(({ icon: Icon, label, action }) => <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-text-muted transition hover:bg-panel-hover hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan" key={label} onClick={action} type="button"><Icon className="size-4" />{label}</button>)}</div></details>
}
