import { useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { EntryForm } from './EntryForm'
import { Card } from './ui'
import { daysBetween, formatDateJa, shiftDate } from '../lib/date'
import { isFilled } from '../lib/stats'
import { useFields, useJournal } from '../store'

const DATE_INPUT =
  'rounded-xl border border-stone-300 bg-white px-3 py-2 text-base focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none dark:border-stone-700 dark:bg-stone-950'

/** 日付を選んで、その日の記録を書く（過去の書き忘れの救済）。記録済みの日を選ぶと編集になる */
export function BackfillCard({ onSave }: { onSave(date: string, values: Record<string, string>): Promise<void> }) {
  const today = useJournal((s) => s.today)
  const fields = useFields()
  const entries = useJournal((s) => s.entries)
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setDate(shiftDate(today, -1))
          setOpen(true)
        }}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-stone-300 px-4 py-3 text-left text-sm text-stone-600 hover:bg-white dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-900"
      >
        <CalendarPlus className="size-4 shrink-0" />
        日付を選んで書く
      </button>
    )
  }

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today
  const existing = valid ? entries[date] : undefined
  const exists = isFilled(existing)
  // 連続記録に数えるのは、その日の当日か翌日に書いた分だけ
  const countsForStreak = valid && daysBetween(date, today) <= 1

  return (
    <Card>
      <label className="mb-3 flex items-center gap-3">
        <span className="text-sm font-semibold">日付</span>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          className={DATE_INPUT}
        />
      </label>

      {!valid ? (
        <p className="text-sm text-stone-500">今日以前の日付を選んでください。</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
            {exists
              ? `${formatDateJa(date)}はすでに記録があります。内容を直します。`
              : countsForStreak
                ? `${formatDateJa(date)}の分です。連続記録に数えます。`
                : `${formatDateJa(date)}の分です。連続記録には数えず、累計にだけ入ります。`}
          </p>
          <EntryForm
            key={date}
            fields={fields}
            initial={exists ? existing.fields : undefined}
            minimal={false}
            autoFocus
            submitLabel={exists ? '更新する' : '記録する'}
            onCancel={() => setOpen(false)}
            onSubmit={async (values) => {
              await onSave(date, values)
              setOpen(false)
            }}
          />
        </>
      )}
      {!valid && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-3 text-sm text-stone-500 underline-offset-2 hover:underline"
        >
          やめる
        </button>
      )}
    </Card>
  )
}
