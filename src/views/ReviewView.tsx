import { useState } from 'react'
import { CalendarView } from './CalendarView'
import { SummaryView } from './SummaryView'
import { TrendsView } from './TrendsView'

type Section = 'calendar' | 'trends' | 'summary'

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'calendar', label: 'カレンダー' },
  { id: 'trends', label: '推移' },
  { id: 'summary', label: 'サマリー' },
]

export function ReviewView({ onSave }: { onSave(date: string, values: Record<string, string>): Promise<void> }) {
  const [section, setSection] = useState<Section>('calendar')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={section === s.id}
            onClick={() => setSection(s.id)}
            className={`rounded-lg py-2 text-sm font-medium ${
              section === s.id ? 'bg-white shadow-sm dark:bg-stone-950' : 'text-stone-500 dark:text-stone-400'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {section === 'calendar' && <CalendarView onSave={onSave} />}
      {section === 'trends' && <TrendsView />}
      {section === 'summary' && <SummaryView />}
    </div>
  )
}
