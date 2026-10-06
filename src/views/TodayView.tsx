import { useState } from 'react'
import { History, PencilLine } from 'lucide-react'
import { EntryForm } from '../components/EntryForm'
import { EntrySummary } from '../components/EntrySummary'
import { Button, Card } from '../components/ui'
import { formatDateJa, shiftDate } from '../lib/date'
import { isFilled } from '../lib/stats'
import { loadPref, savePref } from '../lib/theme'
import { useFields, useJournal } from '../store'

const MINIMAL_KEY = 'cj-minimal'

interface Props {
  onSave(date: string, values: Record<string, string>): Promise<void>
}

export function TodayView({ onSave }: Props) {
  const today = useJournal((s) => s.today)
  const fields = useFields()
  const entries = useJournal((s) => s.entries)
  const [editing, setEditing] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const [minimal, setMinimal] = useState(() => loadPref(MINIMAL_KEY, '0') === '1')

  const todayEntry = entries[today]
  const yesterday = shiftDate(today, -1)
  const hasAny = Object.values(entries).some(isFilled)
  // 昨日の分は今日書いても連続記録に数える。書き忘れの救済として出す
  const canBackfill = hasAny && !isFilled(entries[yesterday])

  const toggleMinimal = () => {
    setMinimal((m) => {
      savePref(MINIMAL_KEY, m ? '0' : '1')
      return !m
    })
  }

  const modeToggle = (
    <button
      type="button"
      onClick={toggleMinimal}
      className="text-xs font-medium text-accent underline-offset-2 hover:underline"
    >
      {minimal ? '3項目で書く' : '1行だけ書く'}
    </button>
  )

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-bold">
            今日 <span className="text-sm font-normal text-stone-500">{formatDateJa(today)}</span>
          </h2>
          {(!isFilled(todayEntry) || editing) && modeToggle}
        </div>

        {isFilled(todayEntry) && !editing ? (
          <>
            <EntrySummary entry={todayEntry} fields={fields} />
            <Button variant="ghost" className="mt-3 -ml-2" onClick={() => setEditing(true)}>
              <PencilLine className="size-4" />
              編集する
            </Button>
          </>
        ) : (
          <EntryForm
            key={`${today}-${editing}`}
            fields={fields}
            initial={todayEntry && !todayEntry.deleted ? todayEntry.fields : undefined}
            minimal={minimal}
            autoFocus
            submitLabel={editing ? '更新する' : '記録する'}
            onCancel={editing ? () => setEditing(false) : undefined}
            onSubmit={async (values) => {
              await onSave(today, values)
              setEditing(false)
            }}
          />
        )}
      </Card>

      {canBackfill &&
        (backfilling ? (
          <Card>
            <h2 className="mb-3 font-bold">
              昨日 <span className="text-sm font-normal text-stone-500">{formatDateJa(yesterday)}</span>
            </h2>
            <EntryForm
              fields={fields}
              minimal={minimal}
              autoFocus
              onCancel={() => setBackfilling(false)}
              onSubmit={async (values) => {
                await onSave(yesterday, values)
                setBackfilling(false)
              }}
            />
          </Card>
        ) : (
          <button
            type="button"
            onClick={() => setBackfilling(true)}
            className="flex w-full items-center gap-2 rounded-xl border border-dashed border-stone-300 px-4 py-3 text-left text-sm text-stone-600 hover:bg-white dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-900"
          >
            <History className="size-4 shrink-0" />
            昨日の分を書く（連続記録に数えます）
          </button>
        ))}
    </div>
  )
}
