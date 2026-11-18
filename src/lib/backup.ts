import { format } from 'date-fns'
import { SCHEMA_VERSION, type JournalEntry, type MemoKeyInfo, type SealedMemo } from '../types'
import { saveTextFile } from './download'
import { isFilled } from './stats'

const APP_ID = 'career-journal'

interface BackupFile {
  app: typeof APP_ID
  schemaVersion: number
  exportedAt: string
  entries: JournalEntry[]
  /** メモは暗号化したまま入れる（読むには合言葉が要る）。古い版の控えには無い */
  memos?: SealedMemo[]
  memoKey?: MemoKeyInfo | null
}

export interface BackupData {
  entries: JournalEntry[]
  memos: SealedMemo[]
  memoKey: MemoKeyInfo | null
}

export function buildBackup(entries: JournalEntry[], sealed?: Omit<BackupData, 'entries'>): string {
  const data: BackupFile = {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    entries: entries.filter(isFilled).sort((a, b) => a.date.localeCompare(b.date)),
    ...(sealed && sealed.memos.length > 0 ? { memos: sealed.memos, memoKey: sealed.memoKey } : {}),
  }
  return JSON.stringify(data, null, 2)
}

export function downloadBackup(entries: JournalEntry[], sealed?: Omit<BackupData, 'entries'>): void {
  saveTextFile(
    `career-journal-${format(new Date(), 'yyyyMMdd-HHmm')}.json`,
    buildBackup(entries, sealed),
    'application/json',
  )
}

const isSealedMemo = (m: unknown): m is SealedMemo => {
  const x = m as Partial<SealedMemo> | null
  return (
    typeof x?.id === 'string' &&
    typeof x.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(x.date) &&
    typeof x.createdAt === 'string' &&
    typeof x.updatedAt === 'string' &&
    typeof x.iv === 'string' &&
    typeof x.ct === 'string'
  )
}

const isKeyInfo = (k: unknown): k is MemoKeyInfo => {
  const x = k as Partial<MemoKeyInfo> | null
  return x?.v === 1 && typeof x.salt === 'string' && typeof x.iter === 'number' && typeof x.iv === 'string' && typeof x.ct === 'string'
}

/** 形が合わないファイルは例外を投げる。メッセージはそのまま画面に出す */
export function parseBackup(text: string): BackupData {
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
  const entries = file.entries.filter(
    (e): e is JournalEntry =>
      typeof e?.id === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
      e.id === e.date &&
      typeof e.fields === 'object' &&
      typeof e.updatedAt === 'string' &&
      typeof e.createdAt === 'string',
  )
  const memos = Array.isArray(file.memos) ? file.memos.filter(isSealedMemo) : []
  return { entries, memos, memoKey: isKeyInfo(file.memoKey) ? file.memoKey : null }
}
