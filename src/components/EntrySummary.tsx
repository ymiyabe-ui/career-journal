import type { FieldDef, JournalEntry } from '../types'

export function EntrySummary({ entry, fields }: { entry: JournalEntry; fields: FieldDef[] }) {
  const rows = fields.filter((f) => entry.fields[f.id]?.trim())
  return (
    <dl className="space-y-3">
      {rows.map((f) => (
        <div key={f.id}>
          <dt className="text-xs font-semibold text-stone-500 dark:text-stone-400">{f.label}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap leading-relaxed">{entry.fields[f.id]}</dd>
        </div>
      ))}
    </dl>
  )
}
