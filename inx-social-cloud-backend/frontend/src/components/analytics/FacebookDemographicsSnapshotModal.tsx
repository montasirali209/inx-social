import { X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { AudienceDemographics } from '../../types/dashboard'
import { Button } from '../ui/Button'

const ages = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const
type SnapshotRow = { age: string; women: number; men: number; unknown: number }

function initialRows(snapshot: AudienceDemographics | null): SnapshotRow[] {
  return ages.map(age => ({
    age,
    women: snapshot?.ageGender.find(row => row.age === age && row.gender === 'women')?.percentage || 0,
    men: snapshot?.ageGender.find(row => row.age === age && row.gender === 'men')?.percentage || 0,
    unknown: snapshot?.ageGender.find(row => row.age === age && row.gender === 'unknown')?.percentage || 0,
  }))
}

export function FacebookDemographicsSnapshotModal({ pageName, snapshot, onClose, onSave }: { pageName: string; snapshot: AudienceDemographics | null; onClose: () => void; onSave: (input: { capturedAt: string; audienceSize: number | null; ageGender: SnapshotRow[] }) => Promise<void> }) {
  const [capturedAt, setCapturedAt] = useState(snapshot?.capturedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10))
  const [audienceSize, setAudienceSize] = useState(snapshot?.audienceSize ? String(snapshot.audienceSize) : '')
  const [rows, setRows] = useState(() => initialRows(snapshot))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const total = useMemo(() => rows.reduce((sum, row) => sum + row.women + row.men + row.unknown, 0), [rows])

  function update(index: number, key: 'women' | 'men' | 'unknown', value: string) {
    const next = Math.max(0, Math.min(100, Number(value || 0)))
    setRows(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: next } : row))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (total <= 0 || total > 101) return setError('Enter percentages that total no more than 100%.')
    setSaving(true)
    setError('')
    try {
      await onSave({ capturedAt, audienceSize: audienceSize ? Number(audienceSize) : null, ageGender: rows })
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The Facebook snapshot could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(<div className="fixed inset-0 z-[95] grid place-items-center overflow-y-auto bg-[#020914]/85 p-3 backdrop-blur-md sm:p-6" onMouseDown={event => { if (event.currentTarget === event.target) onClose() }}><form aria-labelledby="facebook-demographics-title" aria-modal="true" className="my-auto flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-panel border border-brand-cyan/30 bg-panel shadow-[0_32px_130px_rgba(0,0,0,.7)]" onSubmit={submit} role="dialog"><header className="flex items-start justify-between gap-4 border-b border-border-soft p-5 sm:p-6"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#60a5fa]">Facebook Business Suite</p><h2 className="mt-1 text-lg font-semibold" id="facebook-demographics-title">Audience snapshot · {pageName}</h2><p className="mt-1 text-xs leading-5 text-text-muted">Copy the age and gender percentages shown in Business Suite. INX Social stores the source date and never presents this snapshot as live API data.</p></div><button aria-label="Close Facebook demographic snapshot" className="rounded-xl border border-border-soft p-2 text-text-muted hover:text-white" onClick={onClose} type="button"><X className="size-4" /></button></header><div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6"><div className="grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-semibold text-text-muted">Snapshot date<input className="mt-1 min-h-10 w-full rounded-xl border border-border-soft bg-bg/45 px-3 text-xs text-white outline-none focus:border-brand-cyan" max={new Date().toISOString().slice(0, 10)} onChange={event => setCapturedAt(event.target.value)} required type="date" value={capturedAt} /></label><label className="text-[10px] font-semibold text-text-muted">Audience size (optional)<input className="mt-1 min-h-10 w-full rounded-xl border border-border-soft bg-bg/45 px-3 text-xs text-white outline-none focus:border-brand-cyan" min="1" onChange={event => setAudienceSize(event.target.value)} placeholder="e.g. 161500" type="number" value={audienceSize} /></label></div><div className="mt-5 overflow-x-auto"><div className="min-w-[520px]"><div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-2 px-1 text-[9px] font-bold uppercase tracking-wider text-text-soft"><span>Age</span><span>Women %</span><span>Men %</span><span>Unspecified %</span></div><div className="mt-2 grid gap-2">{rows.map((row, index) => <div className="grid grid-cols-[80px_1fr_1fr_1fr] items-center gap-2" key={row.age}><strong className="text-xs">{row.age}</strong>{(['women', 'men', 'unknown'] as const).map(key => <input aria-label={`${row.age} ${key} percentage`} className="min-h-9 rounded-lg border border-border-soft bg-bg/45 px-2 text-xs outline-none focus:border-brand-cyan" key={key} max="100" min="0" onChange={event => update(index, key, event.target.value)} step="0.1" type="number" value={row[key]} />)}</div>)}</div></div></div><div className={`mt-4 rounded-xl border px-3 py-2 text-[10px] ${total > 101 ? 'border-brand-red/30 bg-brand-red/8 text-brand-red' : 'border-border-soft bg-bg/30 text-text-muted'}`}>Current total: <b>{total.toFixed(1)}%</b>. A small rounding difference below 100% is acceptable.</div>{error && <div className="mt-3 rounded-xl border border-brand-red/25 bg-brand-red/8 px-3 py-2 text-[11px] text-brand-red">{error}</div>}</div><footer className="flex justify-end gap-2 border-t border-border-soft bg-bg/35 px-5 py-4"><Button disabled={saving} onClick={onClose} type="button" variant="ghost">Cancel</Button><Button disabled={saving || total <= 0 || total > 101} type="submit" variant="primary">{saving ? 'Saving…' : 'Save verified snapshot'}</Button></footer></form></div>, document.body)
}
