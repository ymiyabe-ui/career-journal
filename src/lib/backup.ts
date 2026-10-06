import { format } from 'date-fns'
import { SCHEMA_VERSION, type JournalEntry } from '../types'
import { saveTextFile } from './download'
import { isFilled } from './stats'

const APP_ID = 'career-journal'

interface BackupFile {
  app: typeof APP_ID
  schemaVersion: number
  exportedAt: string
  entries: JournalEntry[]
}

export function buildBackup(entries: JournalEntry[]): string {
  const data: BackupFile = {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    entries: entries.filter(isFilled).sort((a, b) => a.date.localeCompare(b.date)),
  }
  return JSON.stringify(data, null, 2)
}

export function downloadBackup(entries: JournalEntry[]): void {
  saveTextFile(
    `career-journal-${format(new Date(), 'yyyyMMdd-HHmm')}.json`,
    buildBackup(entries),
    'application/json',
  )
}

/** 形が合わないファイルは例外を投げる。メッセージはそのまま画面に出す */
export function parseBackup(text: string): JournalEntry[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('JSONとして読めませんでした')
  }
  const file = data as Partial<BackupFile>
  if (file?.app !== APP_ID || !Array.isArray(file.entries)) {
    throw new Error('このアプリで書き出したファイルではありません')
  }
  if ((file.schemaVersion ?? 0) > SCHEMA_VERSION) {
    throw new Error('新しい版のアプリで書き出したファイルです。アプリを更新してください')
  }
  return file.entries.filter(
    (e): e is JournalEntry =>
      typeof e?.id === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
      e.id === e.date &&
      typeof e.fields === 'object' &&
      typeof e.updatedAt === 'string' &&
      typeof e.createdAt === 'string',
  )
}
