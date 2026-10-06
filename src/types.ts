export const SCHEMA_VERSION = 1

/**
 * 1日1件の記録。id は date と同じ値にする。
 * スマホとPCで同じ日を別々に書いても、同期のときに同じ記録として扱えるようにするため。
 */
export interface JournalEntry {
  id: string
  /** 記録の対象日（YYYY-MM-DD）。1日の区切りは dayStartHour で決まる */
  date: string
  /** 入力項目ID → 本文。項目は config/fields.ts の定義で増減できる */
  fields: Record<string, string>
  createdAt: string
  updatedAt: string
  /** 削除の印。同期のときに他の端末へ削除を伝えるため、実際には消さない */
  deleted?: boolean
  schemaVersion: number
}

export interface FieldDef {
  id: string
  label: string
  placeholder: string
  required?: boolean
}

export interface Stats {
  currentStreak: number
  longestStreak: number
  totalEntries: number
  monthEntries: number
  lastEntryDate: string | null
  todayDone: boolean
}
