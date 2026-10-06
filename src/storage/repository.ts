import type { JournalEntry } from '../types'

/**
 * 保存先の抽象。画面側はこの形だけを使い、保存先（IndexedDB／テスト用のメモリ）を知らない。
 * 削除も put（deleted: true）で行う。
 */
export interface EntryRepository {
  /** 削除の印が付いたものも含めて全件返す */
  list(): Promise<JournalEntry[]>
  /** この端末で書いた・直した記録を保存し、未送信の印を付ける */
  putLocal(entries: JournalEntry[]): Promise<void>
  /**
   * 同期で届いた記録を保存する。手元のほうが新しいもの（同期中に書き直した分）は上書きしない。
   * 実際に保存したものを返す
   */
  putRemote(entries: JournalEntry[]): Promise<JournalEntry[]>
  /** 未送信の記録のid */
  pendingIds(): Promise<string[]>
  clearPending(ids: string[]): Promise<void>
  getMeta<T>(key: string): Promise<T | undefined>
  setMeta(key: string, value: unknown): Promise<void>
}
