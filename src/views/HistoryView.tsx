import { useState } from 'react'
import { PencilLine, Trash2 } from 'lucide-react'
import { BackfillCard } from '../components/BackfillCard'
import { EntryForm } from '../components/EntryForm'
import { EntrySummary } from '../components/EntrySummary'
import { Button, Card } from '../components/ui'
import { formatDateJa } from '../lib/date'
import { isFilled } from '../lib/stats'
import { useFields, useJournal } from '../store'

interface Props {
  onSave(date: string, values: Record<string, string>): Promise<void>
}

export function HistoryView({ onSave }: Props) {
  const entries = useJournal((s) => s.entries)
  const remove = useJournal((s) => s.remove)
  const fields = useFields()
  const [editingDate, setEditingDate] = useState<string | null>(null)

  const list = Object.values(entries)
    .filter(isFilled)
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-3">
      <BackfillCard onSave={onSave} />
      {list.length === 0 && (
        <p className="py-12 text-center text-sm text-stone-500">
          まだ記録がありません。「今日」から1行書くか、日付を選んで書いてみましょう。
        </p>
      )}
      {list.map((entry) => (
        <Card key={entry.id}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">{formatDateJa(entry.date)}</h2>
            {editingDate !== entry.date && (
              <div className="-mr-2 flex">
                <Button
                  variant="ghost"
                  className="px-2 py-1.5"
                  aria-label="編集"
                  onClick={() => setEditingDate(entry.date)}
                >
                  <PencilLine className="size-4" />
                </Button>
                <Button
                  variant="danger"
                  className="px-2 py-1.5"
                  aria-label="削除"
                  onClick={() => {
                    if (confirm(`${formatDateJa(entry.date)}の記録を削除しますか？`)) {
                      void remove(entry.date)
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          </div>
          {editingDate === entry.date ? (
            <EntryForm
              fields={fields}
              initial={entry.fields}
              minimal={false}
              autoFocus
              submitLabel="更新する"
              onCancel={() => setEditingDate(null)}
              onSubmit={async (values) => {
                await onSave(entry.date, values)
                setEditingDate(null)
              }}
            />
          ) : (
            <EntrySummary entry={entry} fields={fields} />
          )}
        </Card>
      ))}
    </div>
  )
}
