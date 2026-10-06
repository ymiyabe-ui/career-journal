import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, PencilLine } from 'lucide-react'
import { EntryForm } from '../components/EntryForm'
import { EntrySummary } from '../components/EntrySummary'
import { Button, Card } from '../components/ui'
import { DEFAULT_FIELDS } from '../config/fields'
import { formatMonthJa, monthMatrix, shiftMonth } from '../lib/calendar'
import { daysBetween, formatDateJa } from '../lib/date'
import { isFilled } from '../lib/stats'
import { useJournal } from '../store'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

interface Props {
  onSave(date: string, values: Record<string, string>): Promise<void>
}

export function CalendarView({ onSave }: Props) {
  const today = useJournal((s) => s.today)
  const entries = useJournal((s) => s.entries)
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const weeks = useMemo(() => monthMatrix(month), [month])
  const recordedInMonth = Object.values(entries).filter((e) => isFilled(e) && e.date.startsWith(month)).length
  const entry = selected ? entries[selected] : undefined
  const filled = isFilled(entry)

  const select = (date: string) => {
    setSelected((cur) => (cur === date ? null : date))
    setEditing(false)
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <Button variant="ghost" className="px-2 py-1.5" aria-label="前の月" onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft className="size-5" />
          </Button>
          <div className="text-center">
            <h2 className="font-bold">{formatMonthJa(month)}</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">{recordedInMonth}日 記録</p>
          </div>
          <Button
            variant="ghost"
            className="px-2 py-1.5"
            aria-label="次の月"
            disabled={month >= today.slice(0, 7)}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={`pb-1 text-xs font-medium ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-sky-600 dark:text-sky-400' : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              {w}
            </div>
          ))}
          {weeks.flat().map((date, i) => {
            if (!date) return <div key={`blank-${i}`} />
            const done = isFilled(entries[date])
            const future = date > today
            const isToday = date === today
            return (
              <button
                key={date}
                type="button"
                disabled={future}
                aria-label={`${formatDateJa(date)}${done ? ' 記録あり' : ''}`}
                aria-pressed={selected === date}
                onClick={() => select(date)}
                className={`aspect-square rounded-lg text-sm font-medium tabular-nums transition-colors ${
                  done
                    ? 'bg-accent text-white dark:text-stone-950'
                    : future
                      ? 'text-stone-300 dark:text-stone-700'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700'
                } ${isToday ? 'ring-2 ring-accent ring-offset-2 ring-offset-white dark:ring-offset-stone-900' : ''} ${
                  selected === date ? 'outline-2 outline-offset-1 outline-stone-900 dark:outline-stone-100' : ''
                }`}
              >
                {Number(date.slice(8))}
              </button>
            )
          })}
        </div>
      </Card>

      {selected && (
        <Card>
          <h2 className="mb-2 font-bold">{formatDateJa(selected)}</h2>
          {filled && !editing ? (
            <>
              <EntrySummary entry={entry} fields={DEFAULT_FIELDS} />
              <Button variant="ghost" className="mt-3 -ml-2" onClick={() => setEditing(true)}>
                <PencilLine className="size-4" />
                編集する
              </Button>
            </>
          ) : (
            <>
              {!filled && (
                <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
                  {daysBetween(selected, today) <= 1
                    ? 'この日の記録はまだありません。書くと連続記録に数えます。'
                    : 'この日の記録はまだありません。書くと累計にだけ入ります（連続記録には数えません）。'}
                </p>
              )}
              <EntryForm
                key={`${selected}-${editing}`}
                fields={DEFAULT_FIELDS}
                initial={filled ? entry.fields : undefined}
                minimal={false}
                autoFocus
                submitLabel={filled ? '更新する' : '記録する'}
                onCancel={() => {
                  setEditing(false)
                  if (!filled) setSelected(null)
                }}
                onSubmit={async (values) => {
                  await onSave(selected, values)
                  setEditing(false)
                }}
              />
            </>
          )}
        </Card>
      )}
    </div>
  )
}
