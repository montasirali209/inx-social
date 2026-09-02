import { Bell, Building2, CalendarClock, ChevronRight, Crown, Link2, Send, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { SettingsCardData, SettingsValues } from '../../types/settings'
import { SettingRow } from './SettingRow'

const icons: Record<string, LucideIcon> = {
  building: Building2,
  send: Send,
  calendar: CalendarClock,
  sparkles: Sparkles,
  link: Link2,
  bell: Bell,
  crown: Crown,
}

const toneClasses = {
  teal: 'border-brand-teal/20 bg-brand-teal/10 text-brand-cyan',
  green: 'border-brand-green/20 bg-brand-green/10 text-brand-green',
  blue: 'border-brand-blue/20 bg-brand-blue/10 text-[#60a5fa]',
  purple: 'border-brand-purple/20 bg-brand-purple/10 text-[#c4b5fd]',
  amber: 'border-brand-amber/20 bg-brand-amber/10 text-brand-amber',
  red: 'border-brand-red/20 bg-brand-red/10 text-[#fb7185]',
}

const platformStyle: Record<string, string> = {
  facebook: 'bg-[#1877f2] text-white',
  instagram: 'bg-gradient-to-br from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white',
  linkedin: 'bg-[#0a66c2] text-white',
  youtube: 'bg-[#ff0000] text-white',
  x: 'bg-white text-black',
}

const platformMark: Record<string, string> = { facebook: 'f', instagram: '◎', linkedin: 'in', youtube: '▶', x: '𝕏' }

type Props = {
  card: SettingsCardData
  connectedPlatforms?: string[]
  onAction: (card: SettingsCardData) => void
  onChange: (key: keyof SettingsValues, value: string | boolean) => void
}

export function SettingsCard({ card, connectedPlatforms = [], onAction, onChange }: Props) {
  const Icon = icons[card.icon] || Building2
  const span = card.number <= 3 ? '2xl:col-span-4' : '2xl:col-span-3'

  return (
    <section className={`group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border-soft bg-[linear-gradient(145deg,rgba(15,36,52,.82),rgba(7,24,38,.9))] shadow-[0_16px_44px_rgba(0,0,0,.14)] backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-brand-teal/30 hover:shadow-[0_20px_55px_rgba(0,0,0,.22)] focus-within:border-brand-teal/35 ${span}`} data-settings-card={card.id}>
      <header className="flex items-start gap-3 p-4 pb-2 sm:p-5 sm:pb-2">
        <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-xl border ${toneClasses[card.tone]}`}><Icon className="size-5" /></span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-[-0.02em] text-text-main">{card.number}. {card.title}</h2>
          <p className="mt-1 text-[11px] leading-4 text-text-muted">{card.description}</p>
        </div>
      </header>

      {card.id === 'connected_accounts' && connectedPlatforms.length > 0 && (
        <div aria-label="Connected platforms" className="flex flex-wrap gap-2 px-4 pb-2 sm:px-5">
          {connectedPlatforms.map((platform) => (
            <span className={`grid size-7 place-items-center rounded-lg text-[10px] font-black ${platformStyle[platform] || 'bg-panel-soft text-text-main'}`} key={platform} title={platform}>{platformMark[platform] || '•'}</span>
          ))}
        </div>
      )}

      <div className="flex-1 px-4 sm:px-5">
        {card.rows.map((row) => <SettingRow key={row.id} onChange={onChange} row={row} />)}
      </div>

      <button className="flex min-h-12 w-full items-center justify-between border-t border-border-soft px-4 text-left text-sm font-medium text-text-main transition hover:bg-brand-teal/7 hover:text-brand-cyan focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-cyan sm:px-5" onClick={() => onAction(card)} type="button">
        <span>{card.actionLabel}</span><ChevronRight aria-hidden="true" className="size-4 transition group-hover:translate-x-0.5" />
      </button>
    </section>
  )
}
